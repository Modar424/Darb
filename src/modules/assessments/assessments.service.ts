import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Assessment,
  AssessmentAttempt,
  CourseModule,
  PublishStatus,
  Question,
} from '../../database/entities';
import { PageQueryDto, PageResult, skipTake } from '../../common/dto/pagination';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from '../courses/course-access.service';
import {
  CreateAssessmentDto,
  CreateQuestionDto,
  UpdateAssessmentDto,
  UpdateQuestionDto,
} from './dto';
import { validateQuestionShape } from './grading';

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment) private readonly assessments: Repository<Assessment>,
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(AssessmentAttempt) private readonly attempts: Repository<AssessmentAttempt>,
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  /** Questions including the protected answer key. Never serialise this directly to students. */
  async loadQuestionsWithKey(assessmentId: string): Promise<Question[]> {
    return this.questions
      .createQueryBuilder('q')
      .addSelect(['q.correctOptionIds', 'q.explanation'])
      .where('q.assessmentId = :assessmentId', { assessmentId })
      .orderBy('q.position', 'ASC')
      .addOrderBy('q.createdAt', 'ASC')
      .getMany();
  }

  async findOrThrow(id: string): Promise<Assessment> {
    const a = await this.assessments.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  private meta(a: Assessment, extra: Record<string, unknown> = {}) {
    return {
      id: a.id,
      courseId: a.courseId,
      moduleId: a.moduleId,
      title: a.title,
      instructions: a.instructions,
      status: a.status,
      timeLimitMinutes: a.timeLimitMinutes,
      maxAttempts: a.maxAttempts,
      passingPercent: a.passingPercent,
      availableFrom: a.availableFrom,
      dueAt: a.dueAt,
      reviewPolicy: a.reviewPolicy,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      ...extra,
    };
  }

  private async assertModuleInCourse(moduleId: string | undefined, courseId: string) {
    if (!moduleId) return;
    const ok = await this.modules.exist({ where: { id: moduleId, courseId } });
    if (!ok) throw new BadRequestException('moduleId does not belong to this course');
  }

  private validateWindow(from: Date | null | undefined, due: Date | null | undefined) {
    if (from && due && from.getTime() >= due.getTime())
      throw new BadRequestException('availableFrom must be before dueAt');
  }

  async create(user: AuthUser, courseId: string, dto: CreateAssessmentDto, meta: RequestMeta) {
    await this.access.getManageable(user, courseId);
    await this.assertModuleInCourse(dto.moduleId, courseId);
    this.validateWindow(dto.availableFrom, dto.dueAt);
    const a = await this.assessments.save(
      this.assessments.create({
        courseId,
        moduleId: dto.moduleId ?? null,
        title: cleanText(dto.title),
        instructions: dto.instructions ? cleanText(dto.instructions) : null,
        timeLimitMinutes: dto.timeLimitMinutes ?? null,
        maxAttempts: dto.maxAttempts ?? 1,
        passingPercent: dto.passingPercent ?? 60,
        availableFrom: dto.availableFrom ?? null,
        dueAt: dto.dueAt ?? null,
        reviewPolicy: dto.reviewPolicy,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'ASSESSMENT_CREATED',
      entityType: 'Assessment',
      entityId: a.id,
      metadata: { courseId },
      meta,
    });
    return this.meta(a);
  }

  async listForCourse(user: AuthUser, courseId: string, q: PageQueryDto) {
    const course = await this.access.findOrThrow(courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    const qb = this.assessments
      .createQueryBuilder('a')
      .where('a.courseId = :courseId', { courseId });
    if (role === 'learner') qb.andWhere('a.status = :s', { s: PublishStatus.PUBLISHED });
    const [rows, total] = await qb
      .orderBy('a.createdAt', 'ASC')
      .addOrderBy('a.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();

    const ids = rows.map((r) => r.id);
    const qCounts = new Map<string, number>();
    const mine = new Map<
      string,
      { attemptsUsed: number; bestPercent: number | null; passed: boolean }
    >();
    if (ids.length) {
      const counts = await this.questions
        .createQueryBuilder('q')
        .select('q.assessmentId', 'assessmentId')
        .addSelect('COUNT(*)', 'n')
        .where('q.assessmentId IN (:...ids)', { ids })
        .groupBy('q.assessmentId')
        .getRawMany<{ assessmentId: string; n: string }>();
      counts.forEach((c) => qCounts.set(c.assessmentId, Number(c.n)));
      if (role === 'learner') {
        const rowsA = await this.attempts
          .createQueryBuilder('t')
          .select('t.assessmentId', 'assessmentId')
          .addSelect('COUNT(*)', 'used')
          .addSelect('MAX(t.percent)', 'best')
          .addSelect('MAX(t.passed)', 'passed')
          .where('t.studentId = :sid AND t.assessmentId IN (:...ids)', { sid: user.id, ids })
          .groupBy('t.assessmentId')
          .getRawMany<{
            assessmentId: string;
            used: string;
            best: string | null;
            passed: string | null;
          }>();
        rowsA.forEach((r) =>
          mine.set(r.assessmentId, {
            attemptsUsed: Number(r.used),
            bestPercent: r.best === null ? null : Number(r.best),
            passed: Number(r.passed) === 1,
          }),
        );
      }
    }
    return PageResult.of(
      rows.map((a) =>
        this.meta(a, {
          questionCount: qCounts.get(a.id) ?? 0,
          ...(role === 'learner'
            ? {
                myProgress: mine.get(a.id) ?? { attemptsUsed: 0, bestPercent: null, passed: false },
              }
            : {}),
        }),
      ),
      total,
      q,
    );
  }

  /** Managers get questions with the answer key; learners get metadata only (questions arrive when an attempt starts). */
  async get(user: AuthUser, id: string) {
    const a = await this.findOrThrow(id);
    const course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role === 'learner') {
      if (a.status !== PublishStatus.PUBLISHED) throw new NotFoundException('Assessment not found');
      const questionCount = await this.questions.count({ where: { assessmentId: id } });
      const attemptsUsed = await this.attempts.count({
        where: { assessmentId: id, studentId: user.id },
      });
      return this.meta(a, {
        questionCount,
        attemptsUsed,
        attemptsRemaining: Math.max(0, a.maxAttempts - attemptsUsed),
      });
    }
    const questions = await this.loadQuestionsWithKey(id);
    return this.meta(a, { questions });
  }

  async update(user: AuthUser, id: string, dto: UpdateAssessmentDto, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    await this.assertModuleInCourse(dto.moduleId, a.courseId);
    if (dto.title !== undefined) a.title = cleanText(dto.title);
    if (dto.instructions !== undefined) a.instructions = cleanText(dto.instructions) || null;
    if (dto.moduleId !== undefined) a.moduleId = dto.moduleId;
    if (dto.timeLimitMinutes !== undefined) a.timeLimitMinutes = dto.timeLimitMinutes;
    if (dto.maxAttempts !== undefined) a.maxAttempts = dto.maxAttempts;
    if (dto.passingPercent !== undefined && dto.passingPercent !== a.passingPercent) {
      // `passed` is stored per attempt, so changing the threshold afterwards would make results inconsistent.
      if (await this.attempts.exist({ where: { assessmentId: id } }))
        throw new ConflictException('passingPercent cannot change after attempts have started');
      a.passingPercent = dto.passingPercent;
    }
    if (dto.availableFrom !== undefined) a.availableFrom = dto.availableFrom;
    if (dto.dueAt !== undefined) a.dueAt = dto.dueAt;
    if (dto.reviewPolicy !== undefined) a.reviewPolicy = dto.reviewPolicy;
    this.validateWindow(a.availableFrom, a.dueAt);
    await this.assessments.save(a);
    await this.audit.record({
      actorId: user.id,
      action: 'ASSESSMENT_UPDATED',
      entityType: 'Assessment',
      entityId: a.id,
      meta,
    });
    return this.meta(a);
  }

  async publish(user: AuthUser, id: string, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    if (a.status === PublishStatus.PUBLISHED)
      throw new ConflictException('Assessment is already published');
    if ((await this.questions.count({ where: { assessmentId: id } })) === 0)
      throw new ConflictException('Add at least one question before publishing');
    a.status = PublishStatus.PUBLISHED;
    await this.assessments.save(a);
    await this.audit.record({
      actorId: user.id,
      action: 'ASSESSMENT_PUBLISHED',
      entityType: 'Assessment',
      entityId: a.id,
      meta,
    });
    return this.meta(a);
  }

  async unpublish(user: AuthUser, id: string, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    if (a.status !== PublishStatus.PUBLISHED)
      throw new ConflictException('Assessment is not published');
    if (await this.attempts.exist({ where: { assessmentId: id } }))
      throw new ConflictException('Assessment already has attempts');
    a.status = PublishStatus.DRAFT;
    await this.assessments.save(a);
    await this.audit.record({
      actorId: user.id,
      action: 'ASSESSMENT_UNPUBLISHED',
      entityType: 'Assessment',
      entityId: a.id,
      meta,
    });
    return this.meta(a);
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    if (await this.attempts.exist({ where: { assessmentId: id } }))
      throw new ConflictException('Assessment has attempts and cannot be deleted');
    await this.assessments.delete({ id });
    await this.audit.record({
      actorId: user.id,
      action: 'ASSESSMENT_DELETED',
      entityType: 'Assessment',
      entityId: id,
      metadata: { courseId: a.courseId },
      meta,
    });
    return { success: true };
  }

  // ---------- questions ----------
  private async assertEditable(assessmentId: string) {
    if (await this.attempts.exist({ where: { assessmentId } })) {
      throw new ConflictException(
        'Questions cannot be changed after learners have started attempts',
      );
    }
  }

  async addQuestion(
    user: AuthUser,
    assessmentId: string,
    dto: CreateQuestionDto,
    meta: RequestMeta,
  ) {
    const a = await this.findOrThrow(assessmentId);
    await this.access.getManageable(user, a.courseId);
    await this.assertEditable(assessmentId);
    const options = dto.options.map((o) => ({ id: o.id, text: cleanText(o.text) }));
    const error = validateQuestionShape({
      type: dto.type,
      options,
      correctOptionIds: dto.correctOptionIds,
    });
    if (error) throw new BadRequestException(error);
    const max = await this.questions
      .createQueryBuilder('q')
      .select('COALESCE(MAX(q.position), 0)', 'max')
      .where('q.assessmentId = :id', { id: assessmentId })
      .getRawOne<{ max: string }>();
    const q = await this.questions.save(
      this.questions.create({
        assessmentId,
        type: dto.type,
        prompt: cleanText(dto.prompt),
        options,
        correctOptionIds: dto.correctOptionIds,
        explanation: dto.explanation ? cleanText(dto.explanation) : null,
        points: dto.points ?? 1,
        position: Number(max?.max ?? 0) + 1,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'QUESTION_CREATED',
      entityType: 'Question',
      entityId: q.id,
      metadata: { assessmentId },
      meta,
    });
    return { ...q, correctOptionIds: dto.correctOptionIds, explanation: q.explanation };
  }

  private async questionWithKey(id: string): Promise<Question> {
    const q = await this.questions
      .createQueryBuilder('q')
      .addSelect(['q.correctOptionIds', 'q.explanation'])
      .where('q.id = :id', { id })
      .getOne();
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async updateQuestion(user: AuthUser, id: string, dto: UpdateQuestionDto, meta: RequestMeta) {
    const q = await this.questionWithKey(id);
    const a = await this.findOrThrow(q.assessmentId);
    await this.access.getManageable(user, a.courseId);
    await this.assertEditable(a.id);
    if (dto.type !== undefined) q.type = dto.type;
    if (dto.prompt !== undefined) q.prompt = cleanText(dto.prompt);
    if (dto.options !== undefined)
      q.options = dto.options.map((o) => ({ id: o.id, text: cleanText(o.text) }));
    if (dto.correctOptionIds !== undefined) q.correctOptionIds = dto.correctOptionIds;
    if (dto.points !== undefined) q.points = dto.points;
    if (dto.explanation !== undefined) q.explanation = cleanText(dto.explanation) || null;
    const error = validateQuestionShape({
      type: q.type,
      options: q.options,
      correctOptionIds: q.correctOptionIds,
    });
    if (error) throw new BadRequestException(error);
    await this.questions.save(q);
    await this.audit.record({
      actorId: user.id,
      action: 'QUESTION_UPDATED',
      entityType: 'Question',
      entityId: q.id,
      meta,
    });
    return q;
  }

  async removeQuestion(user: AuthUser, id: string, meta: RequestMeta) {
    const q = await this.questions.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    const a = await this.findOrThrow(q.assessmentId);
    await this.access.getManageable(user, a.courseId);
    await this.assertEditable(a.id);
    const remaining = await this.questions.count({ where: { assessmentId: a.id } });
    if (a.status === PublishStatus.PUBLISHED && remaining <= 1)
      throw new ConflictException('A published assessment needs at least one question');
    await this.questions.delete({ id });
    await this.audit.record({
      actorId: user.id,
      action: 'QUESTION_DELETED',
      entityType: 'Question',
      entityId: id,
      metadata: { assessmentId: a.id },
      meta,
    });
    return { success: true };
  }
}
