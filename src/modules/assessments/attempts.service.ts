import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Assessment,
  AssessmentAttempt,
  AttemptStatus,
  Course,
  Enrollment,
  PublishStatus,
  Question,
  ReviewPolicy,
} from '../../database/entities';
import { PageQueryDto, PageResult, skipTake } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from '../courses/course-access.service';
import { AssessmentsService } from './assessments.service';
import { SubmitAttemptDto } from './dto';
import { gradeAttempt, validateAnswers } from './grading';

/** Network/clock slack so a submission sent right at the deadline is not rejected. */
const GRACE_MS = 5_000;

@Injectable()
export class AttemptsService {
  constructor(
    @InjectRepository(AssessmentAttempt) private readonly attempts: Repository<AssessmentAttempt>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly assessments: AssessmentsService,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  /** Questions as shown to a learner taking the assessment: no answer key, no explanation. */
  private async learnerQuestions(assessmentId: string) {
    const rows = await this.questions.find({
      where: { assessmentId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
      position: q.position,
    }));
  }

  private summary(t: AssessmentAttempt) {
    return {
      id: t.id,
      assessmentId: t.assessmentId,
      attemptNumber: t.attemptNumber,
      status: t.status,
      startedAt: t.startedAt,
      deadlineAt: t.deadlineAt,
      submittedAt: t.submittedAt,
      score: t.score,
      maxScore: t.maxScore,
      percent: t.percent,
      passed: t.passed,
    };
  }

  private async expire(t: AssessmentAttempt, em?: EntityManager): Promise<void> {
    const attemptsRepo = em ? em.getRepository(AssessmentAttempt) : this.attempts;
    const maxRow = await (em ? em.getRepository(Question) : this.questions)
      .createQueryBuilder('q')
      .select('COALESCE(SUM(q.points), 0)', 'sum')
      .where('q.assessmentId = :id', { id: t.assessmentId })
      .getRawOne<{ sum: string }>();
    await attemptsRepo.update(
      { id: t.id, status: AttemptStatus.IN_PROGRESS },
      {
        status: AttemptStatus.EXPIRED,
        score: 0,
        maxScore: Number(maxRow?.sum ?? 0),
        percent: 0,
        passed: false,
      },
    );
    t.status = AttemptStatus.EXPIRED;
    t.score = 0;
    t.percent = 0;
    t.passed = false;
  }

  private isPastDeadline(t: AssessmentAttempt, graceMs = 0): boolean {
    return !!t.deadlineAt && Date.now() > t.deadlineAt.getTime() + graceMs;
  }

  async start(user: AuthUser, assessmentId: string, meta: RequestMeta) {
    const a: Assessment = await this.assessments.findOrThrow(assessmentId);
    if (a.status !== PublishStatus.PUBLISHED) throw new NotFoundException('Assessment not found');
    const course: Course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role !== 'learner')
      throw new ForbiddenException('Only enrolled students can take assessments');

    const now = new Date();
    if (a.availableFrom && now < a.availableFrom)
      throw new ConflictException('This assessment is not open yet');
    if (a.dueAt && now > a.dueAt) throw new ConflictException('This assessment is closed');

    // Serialise starts per student/course: the enrolment row lock makes "check open attempt, count, insert"
    // atomic, so double-clicks and parallel requests can never create extra attempts.
    const outcome = await this.dataSource.transaction(async (em) => {
      await em
        .getRepository(Enrollment)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.courseId = :c AND e.studentId = :s', { c: a.courseId, s: user.id })
        .getOne();
      const repo = em.getRepository(AssessmentAttempt);

      const open = await repo.findOne({
        where: { assessmentId, studentId: user.id, status: AttemptStatus.IN_PROGRESS },
      });
      if (open) {
        if (!this.isPastDeadline(open)) return { attempt: open, resumed: true };
        await this.expire(open, em);
      }

      const used = await repo.count({ where: { assessmentId, studentId: user.id } });
      if (used >= a.maxAttempts) throw new ConflictException('No attempts remaining');

      const limitEnd = a.timeLimitMinutes ? now.getTime() + a.timeLimitMinutes * 60_000 : null;
      const dueEnd = a.dueAt ? a.dueAt.getTime() : null;
      const deadline =
        limitEnd !== null && dueEnd !== null ? Math.min(limitEnd, dueEnd) : (limitEnd ?? dueEnd);
      const created = await repo.save(
        repo.create({
          assessmentId,
          studentId: user.id,
          attemptNumber: used + 1,
          status: AttemptStatus.IN_PROGRESS,
          startedAt: now,
          deadlineAt: deadline === null ? null : new Date(deadline),
        }),
      );
      return { attempt: created, resumed: false };
    });
    const attempt = outcome.attempt;
    if (outcome.resumed) {
      return {
        attempt: this.summary(attempt),
        questions: await this.learnerQuestions(assessmentId),
        resumed: true,
      };
    }
    await this.audit.record({
      actorId: user.id,
      action: 'ATTEMPT_STARTED',
      entityType: 'AssessmentAttempt',
      entityId: attempt.id,
      metadata: { assessmentId },
      meta,
    });
    return {
      attempt: this.summary(attempt),
      questions: await this.learnerQuestions(assessmentId),
      resumed: false,
    };
  }

  private async review(t: AssessmentAttempt) {
    const questions = await this.assessments.loadQuestionsWithKey(t.assessmentId);
    const answers = t.answers ?? {};
    const grade = gradeAttempt(questions, answers);
    const byId = new Map(grade.results.map((r) => [r.questionId, r]));
    return questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      selectedOptionIds: answers[q.id] ?? [],
      correctOptionIds: q.correctOptionIds,
      correct: byId.get(q.id)?.correct ?? false,
      pointsAwarded: byId.get(q.id)?.pointsAwarded ?? 0,
      points: q.points,
      explanation: q.explanation,
    }));
  }

  /** Owner or the course's staff only. Anyone else gets 404 (no existence leak). */
  async get(user: AuthUser, attemptId: string) {
    const t = await this.attempts.findOne({ where: { id: attemptId } });
    if (!t) throw new NotFoundException('Attempt not found');
    const a = await this.assessments.findOrThrow(t.assessmentId);
    const course = await this.access.findOrThrow(a.courseId);
    const isOwner = t.studentId === user.id;
    const manager = this.access.canManage(user, course);
    if (!isOwner && !manager) throw new NotFoundException('Attempt not found');

    if (t.status === AttemptStatus.IN_PROGRESS && this.isPastDeadline(t)) await this.expire(t);

    const base = { ...this.summary(t), ...(manager ? { studentId: t.studentId } : {}) };
    if (t.status === AttemptStatus.IN_PROGRESS) {
      return isOwner ? { ...base, questions: await this.learnerQuestions(t.assessmentId) } : base;
    }
    const includeReview =
      t.status === AttemptStatus.SUBMITTED &&
      (manager || a.reviewPolicy === ReviewPolicy.AFTER_SUBMISSION);
    return includeReview ? { ...base, review: await this.review(t) } : base;
  }

  async submit(user: AuthUser, attemptId: string, dto: SubmitAttemptDto, meta: RequestMeta) {
    const outcome = await this.dataSource.transaction(async (em) => {
      // Row lock serialises concurrent/double submissions of the same attempt.
      const t = await em
        .getRepository(AssessmentAttempt)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id: attemptId })
        .getOne();
      if (!t || t.studentId !== user.id) throw new NotFoundException('Attempt not found');
      if (t.status !== AttemptStatus.IN_PROGRESS)
        throw new ConflictException('This attempt has already been closed');

      const a = await em.getRepository(Assessment).findOneOrFail({ where: { id: t.assessmentId } });
      if (!(await this.access.isEnrolled(user.id, a.courseId)))
        throw new ForbiddenException('You are no longer enrolled in this course');

      const questions = await em
        .getRepository(Question)
        .createQueryBuilder('q')
        .addSelect(['q.correctOptionIds', 'q.explanation'])
        .where('q.assessmentId = :id', { id: a.id })
        .orderBy('q.position', 'ASC')
        .getMany();

      if (this.isPastDeadline(t, GRACE_MS)) {
        const maxScore = questions.reduce((s, q) => s + q.points, 0);
        await em
          .getRepository(AssessmentAttempt)
          .update(
            { id: t.id },
            { status: AttemptStatus.EXPIRED, score: 0, maxScore, percent: 0, passed: false },
          );
        await this.audit.record(
          {
            actorId: user.id,
            action: 'ATTEMPT_EXPIRED',
            entityType: 'AssessmentAttempt',
            entityId: t.id,
            meta,
          },
          em,
        );
        return { expired: true as const };
      }

      const problem = validateAnswers(questions, dto.answers);
      if (problem) throw new BadRequestException(problem);

      const grade = gradeAttempt(questions, dto.answers);
      const passed = grade.percent >= a.passingPercent;
      const submittedAt = new Date();
      await em.getRepository(AssessmentAttempt).update(
        { id: t.id },
        {
          status: AttemptStatus.SUBMITTED,
          answers: dto.answers,
          submittedAt,
          score: grade.score,
          maxScore: grade.maxScore,
          percent: grade.percent,
          passed,
        },
      );
      await this.audit.record(
        {
          actorId: user.id,
          action: 'ATTEMPT_SUBMITTED',
          entityType: 'AssessmentAttempt',
          entityId: t.id,
          metadata: { assessmentId: a.id, percent: grade.percent, passed },
          meta,
        },
        em,
      );
      return { expired: false as const, id: t.id };
    });

    if (outcome.expired)
      throw new ConflictException('Time limit exceeded; the attempt was closed without a score');
    return this.get(user, outcome.id);
  }

  async list(user: AuthUser, assessmentId: string, q: PageQueryDto) {
    const a = await this.assessments.findOrThrow(assessmentId);
    const course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role === 'learner' && a.status !== PublishStatus.PUBLISHED)
      throw new NotFoundException('Assessment not found');

    const qb = this.attempts
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.student', 's')
      .where('t.assessmentId = :assessmentId', { assessmentId });
    if (role === 'learner') qb.andWhere('t.studentId = :sid', { sid: user.id });
    const [rows, total] = await qb
      .orderBy('t.startedAt', 'DESC')
      .addOrderBy('t.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    return PageResult.of(
      rows.map((t) => ({
        ...this.summary(t),
        ...(role === 'manager'
          ? { student: { id: t.student.id, fullName: t.student.fullName } }
          : {}),
      })),
      total,
      q,
    );
  }
}
