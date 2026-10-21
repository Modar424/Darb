import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import {
  Assignment,
  AssignmentSubmission,
  CourseModule,
  PublishStatus,
  SubmissionStatus,
} from '../../database/entities';
import { PageQueryDto, PageResult, skipTake } from '../../common/dto/pagination';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from '../courses/course-access.service';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  ListSubmissionsQueryDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from './dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private readonly assignments: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission)
    private readonly submissions: Repository<AssignmentSubmission>,
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  private view(a: Assignment, extra: Record<string, unknown> = {}) {
    return {
      id: a.id,
      courseId: a.courseId,
      moduleId: a.moduleId,
      title: a.title,
      instructions: a.instructions,
      status: a.status,
      maxPoints: a.maxPoints,
      dueAt: a.dueAt,
      allowLate: a.allowLate,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      ...extra,
    };
  }

  private submissionView(s: AssignmentSubmission, withStudent?: { id: string; fullName: string }) {
    return {
      id: s.id,
      assignmentId: s.assignmentId,
      status: s.status,
      content: s.content,
      linkUrl: s.linkUrl,
      submittedAt: s.submittedAt,
      isLate: s.isLate,
      grade: s.grade,
      feedback: s.feedback,
      gradedAt: s.gradedAt,
      gradedById: s.gradedById,
      ...(withStudent ? { student: withStudent } : {}),
    };
  }

  async findOrThrow(id: string): Promise<Assignment> {
    const a = await this.assignments.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  private async assertModuleInCourse(moduleId: string | undefined, courseId: string) {
    if (moduleId && !(await this.modules.exist({ where: { id: moduleId, courseId } }))) {
      throw new BadRequestException('moduleId does not belong to this course');
    }
  }

  async create(user: AuthUser, courseId: string, dto: CreateAssignmentDto, meta: RequestMeta) {
    await this.access.getManageable(user, courseId);
    await this.assertModuleInCourse(dto.moduleId, courseId);
    const a = await this.assignments.save(
      this.assignments.create({
        courseId,
        moduleId: dto.moduleId ?? null,
        title: cleanText(dto.title),
        instructions: cleanText(dto.instructions),
        maxPoints: dto.maxPoints ?? 100,
        dueAt: dto.dueAt ?? null,
        allowLate: dto.allowLate ?? false,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: a.id,
      metadata: { courseId },
      meta,
    });
    return this.view(a);
  }

  async listForCourse(user: AuthUser, courseId: string, q: PageQueryDto) {
    const course = await this.access.findOrThrow(courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    const qb = this.assignments
      .createQueryBuilder('a')
      .where('a.courseId = :courseId', { courseId });
    if (role === 'learner') qb.andWhere('a.status = :s', { s: PublishStatus.PUBLISHED });
    const [rows, total] = await qb
      .orderBy('a.dueAt', 'ASC')
      .addOrderBy('a.createdAt', 'ASC')
      .addOrderBy('a.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();

    const mine = new Map<string, AssignmentSubmission>();
    if (role === 'learner' && rows.length) {
      const subs = await this.submissions
        .createQueryBuilder('s')
        .where('s.studentId = :sid AND s.assignmentId IN (:...ids)', {
          sid: user.id,
          ids: rows.map((r) => r.id),
        })
        .getMany();
      subs.forEach((s) => mine.set(s.assignmentId, s));
    }
    return PageResult.of(
      rows.map((a) =>
        this.view(
          a,
          role === 'learner'
            ? {
                mySubmission: mine.has(a.id)
                  ? {
                      id: mine.get(a.id)!.id,
                      status: mine.get(a.id)!.status,
                      grade: mine.get(a.id)!.grade,
                    }
                  : null,
              }
            : {},
        ),
      ),
      total,
      q,
    );
  }

  async get(user: AuthUser, id: string) {
    const a = await this.findOrThrow(id);
    const course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role === 'learner' && a.status !== PublishStatus.PUBLISHED)
      throw new NotFoundException('Assignment not found');
    if (role === 'learner') {
      // The learner's own submission summary (same shape as in the list) so the detail page can show
      // status/grade and offer editing without a second lookup.
      const mine = await this.submissions.findOne({
        where: { assignmentId: id, studentId: user.id },
      });
      return this.view(a, {
        mySubmission: mine ? { id: mine.id, status: mine.status, grade: mine.grade } : null,
      });
    }
    return this.view(a);
  }

  async update(user: AuthUser, id: string, dto: UpdateAssignmentDto, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    await this.assertModuleInCourse(dto.moduleId, a.courseId);
    if (dto.maxPoints !== undefined && dto.maxPoints !== a.maxPoints) {
      if (
        await this.submissions.exist({
          where: { assignmentId: id, status: SubmissionStatus.GRADED },
        })
      ) {
        throw new ConflictException('maxPoints cannot change once submissions have been graded');
      }
      a.maxPoints = dto.maxPoints;
    }
    if (dto.title !== undefined) a.title = cleanText(dto.title);
    if (dto.instructions !== undefined) a.instructions = cleanText(dto.instructions);
    if (dto.moduleId !== undefined) a.moduleId = dto.moduleId;
    if (dto.dueAt !== undefined) a.dueAt = dto.dueAt;
    if (dto.allowLate !== undefined) a.allowLate = dto.allowLate;
    await this.dataSource.transaction(async (em) => {
      await em.getRepository(Assignment).save(a);
      // Lateness is derived from the deadline, so it must follow deadline changes (graded work is left untouched).
      if (dto.dueAt !== undefined) {
        const subs = em.getRepository(AssignmentSubmission);
        const open = { assignmentId: id, status: Not(SubmissionStatus.GRADED) };
        if (a.dueAt === null) await subs.update(open, { isLate: false });
        else {
          await subs.update({ ...open, submittedAt: MoreThan(a.dueAt) }, { isLate: true });
          await subs.update({ ...open, submittedAt: LessThanOrEqual(a.dueAt) }, { isLate: false });
        }
      }
    });
    await this.audit.record({
      actorId: user.id,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'Assignment',
      entityId: a.id,
      meta,
    });
    return this.view(a);
  }

  async setPublished(user: AuthUser, id: string, publish: boolean, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    const target = publish ? PublishStatus.PUBLISHED : PublishStatus.DRAFT;
    if (a.status === target)
      throw new ConflictException(
        publish ? 'Assignment is already published' : 'Assignment is not published',
      );
    if (!publish && (await this.submissions.exist({ where: { assignmentId: id } })))
      throw new ConflictException('Assignment already has submissions');
    a.status = target;
    await this.assignments.save(a);
    await this.audit.record({
      actorId: user.id,
      action: publish ? 'ASSIGNMENT_PUBLISHED' : 'ASSIGNMENT_UNPUBLISHED',
      entityType: 'Assignment',
      entityId: a.id,
      meta,
    });
    return this.view(a);
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const a = await this.findOrThrow(id);
    await this.access.getManageable(user, a.courseId);
    if (await this.submissions.exist({ where: { assignmentId: id } }))
      throw new ConflictException('Assignment has submissions and cannot be deleted');
    await this.assignments.delete({ id });
    await this.audit.record({
      actorId: user.id,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'Assignment',
      entityId: id,
      metadata: { courseId: a.courseId },
      meta,
    });
    return { success: true };
  }

  /** Create or replace the student's submission until it has been graded. */
  async submit(
    user: AuthUser,
    assignmentId: string,
    dto: SubmitAssignmentDto,
    meta: RequestMeta,
    retry = true,
  ): Promise<ReturnType<AssignmentsService['submissionView']>> {
    const a = await this.findOrThrow(assignmentId);
    if (a.status !== PublishStatus.PUBLISHED) throw new NotFoundException('Assignment not found');
    const course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role !== 'learner')
      throw new ForbiddenException('Only enrolled students can submit assignments');

    const now = new Date();
    const late = !!a.dueAt && now > a.dueAt;
    if (late && !a.allowLate)
      throw new ConflictException('The deadline has passed and late submissions are not allowed');

    // Row lock: a resubmission can never overwrite a submission that is being graded at the same moment.
    const updated = await this.dataSource.transaction(async (em) => {
      const existing = await em
        .getRepository(AssignmentSubmission)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.assignmentId = :assignmentId AND s.studentId = :studentId', {
          assignmentId,
          studentId: user.id,
        })
        .getOne();
      if (!existing) return null;
      if (existing.status === SubmissionStatus.GRADED)
        throw new ConflictException('Graded submissions cannot be changed');
      existing.content = cleanText(dto.content);
      existing.linkUrl = dto.linkUrl ?? null;
      existing.submittedAt = now;
      existing.isLate = late;
      await em.getRepository(AssignmentSubmission).save(existing);
      await this.audit.record(
        {
          actorId: user.id,
          action: 'SUBMISSION_UPDATED',
          entityType: 'AssignmentSubmission',
          entityId: existing.id,
          metadata: { assignmentId },
          meta,
        },
        em,
      );
      return existing;
    });
    if (updated) return this.submissionView(updated);
    try {
      const s = await this.submissions.save(
        this.submissions.create({
          assignmentId,
          studentId: user.id,
          content: cleanText(dto.content),
          linkUrl: dto.linkUrl ?? null,
          submittedAt: now,
          isLate: late,
        }),
      );
      await this.audit.record({
        actorId: user.id,
        action: 'SUBMISSION_CREATED',
        entityType: 'AssignmentSubmission',
        entityId: s.id,
        metadata: { assignmentId, late },
        meta,
      });
      return this.submissionView(s);
    } catch (err) {
      // Concurrent first submission: the unique (assignment, student) key rejected the loser; apply it as an update.
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY' && retry)
        return this.submit(user, assignmentId, dto, meta, false);
      throw err;
    }
  }

  async listSubmissions(user: AuthUser, assignmentId: string, q: ListSubmissionsQueryDto) {
    const a = await this.findOrThrow(assignmentId);
    const course = await this.access.findOrThrow(a.courseId);
    const role = await this.access.assertLearnerOrManager(user, course);
    if (role === 'learner' && a.status !== PublishStatus.PUBLISHED)
      throw new NotFoundException('Assignment not found');
    const qb = this.submissions
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.student', 'u')
      .where('s.assignmentId = :assignmentId', { assignmentId });
    if (role === 'learner') qb.andWhere('s.studentId = :sid', { sid: user.id });
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    const [rows, total] = await qb
      .orderBy('s.submittedAt', 'DESC')
      .addOrderBy('s.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    return PageResult.of(
      rows.map((s) =>
        this.submissionView(
          s,
          role === 'manager' ? { id: s.student.id, fullName: s.student.fullName } : undefined,
        ),
      ),
      total,
      q,
    );
  }

  /** Owner or course staff only; everyone else gets 404. */
  async getSubmission(user: AuthUser, id: string) {
    const s = await this.submissions.findOne({ where: { id }, relations: { student: true } });
    if (!s) throw new NotFoundException('Submission not found');
    const a = await this.findOrThrow(s.assignmentId);
    const course = await this.access.findOrThrow(a.courseId);
    const manager = this.access.canManage(user, course);
    if (s.studentId !== user.id && !manager) throw new NotFoundException('Submission not found');
    return this.submissionView(
      s,
      manager ? { id: s.student.id, fullName: s.student.fullName } : undefined,
    );
  }

  async grade(user: AuthUser, id: string, dto: GradeSubmissionDto, meta: RequestMeta) {
    const found = await this.submissions.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Submission not found');
    const a = await this.findOrThrow(found.assignmentId);
    await this.access.getManageable(user, a.courseId);
    if (dto.grade > a.maxPoints)
      throw new BadRequestException(`grade cannot exceed maxPoints (${a.maxPoints})`);

    // Lock the row so grading and a concurrent resubmission are strictly ordered.
    const graded = await this.dataSource.transaction(async (em) => {
      const s = await em
        .getRepository(AssignmentSubmission)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id })
        .getOne();
      if (!s) throw new NotFoundException('Submission not found');
      s.grade = dto.grade;
      s.feedback = dto.feedback ? cleanText(dto.feedback) : null;
      s.status = SubmissionStatus.GRADED;
      s.gradedById = user.id;
      s.gradedAt = new Date();
      await em.getRepository(AssignmentSubmission).save(s);
      await this.audit.record(
        {
          actorId: user.id,
          action: 'SUBMISSION_GRADED',
          entityType: 'AssignmentSubmission',
          entityId: s.id,
          metadata: { assignmentId: a.id, grade: dto.grade },
          meta,
        },
        em,
      );
      return s;
    });
    const student = await this.submissions.findOneOrFail({
      where: { id },
      relations: { student: true },
    });
    return this.submissionView(graded, {
      id: student.student.id,
      fullName: student.student.fullName,
    });
  }
}
