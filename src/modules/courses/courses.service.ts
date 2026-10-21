import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  Course,
  CourseModule,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  ProgressRecord,
  RoleName,
  User,
} from '../../database/entities';
import { escapeLike, PageResult, parseSort, skipTake } from '../../common/dto/pagination';
import { cleanText, slugify } from '../../common/utils/text';
import { AuthUser, isAdmin, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from './course-access.service';
import { CreateCourseDto, ListCoursesQueryDto, UpdateCourseDto } from './dto';
import { PageQueryDto } from '../../common/dto/pagination';

const COURSE_SORT = {
  publishedAt: 'c.publishedAt',
  title: 'c.title',
  createdAt: 'c.createdAt',
  updatedAt: 'c.updatedAt',
};

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(ProgressRecord) private readonly progress: Repository<ProgressRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  private async decorate(rows: Course[]) {
    const ids = rows.map((c) => c.id);
    const lessonCounts = new Map<string, number>();
    const learnerCounts = new Map<string, number>();
    if (ids.length) {
      const l = await this.lessons
        .createQueryBuilder('l')
        .select('l.courseId', 'courseId')
        .addSelect('COUNT(*)', 'n')
        .where('l.courseId IN (:...ids)', { ids })
        .groupBy('l.courseId')
        .getRawMany<{ courseId: string; n: string }>();
      l.forEach((r) => lessonCounts.set(r.courseId, Number(r.n)));
      const e = await this.enrollments
        .createQueryBuilder('e')
        .select('e.courseId', 'courseId')
        .addSelect('COUNT(*)', 'n')
        .where('e.courseId IN (:...ids)', { ids })
        .andWhere('e.status <> :dropped', { dropped: EnrollmentStatus.DROPPED })
        .groupBy('e.courseId')
        .getRawMany<{ courseId: string; n: string }>();
      e.forEach((r) => learnerCounts.set(r.courseId, Number(r.n)));
    }
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      summary: c.summary,
      level: c.level,
      language: c.language,
      status: c.status,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      instructor: c.instructor ? { id: c.instructor.id, fullName: c.instructor.fullName } : null,
      lessonCount: lessonCounts.get(c.id) ?? 0,
      learnerCount: learnerCounts.get(c.id) ?? 0,
    }));
  }

  /** Public catalogue: published courses only, bounded pagination, allowlisted sort/filter. */
  async listPublished(q: ListCoursesQueryDto) {
    const sort = parseSort(q.sort, COURSE_SORT, { field: 'publishedAt', dir: 'DESC' });
    const qb = this.courses
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.instructor', 'i')
      .where('c.status = :status', { status: CourseStatus.PUBLISHED });
    if (q.level) qb.andWhere('c.level = :level', { level: q.level });
    if (q.language) qb.andWhere('c.language = :language', { language: q.language });
    if (q.instructorId) qb.andWhere('c.instructorId = :iid', { iid: q.instructorId });
    if (q.q) {
      qb.andWhere('(c.title LIKE :term OR c.summary LIKE :term)', { term: `%${escapeLike(q.q)}%` });
    }
    const [rows, total] = await qb
      .orderBy(sort.column, sort.dir)
      .addOrderBy('c.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    return PageResult.of(await this.decorate(rows), total, q);
  }

  async listMine(user: AuthUser, q: PageQueryDto) {
    const sort = parseSort(q.sort, COURSE_SORT, { field: 'updatedAt', dir: 'DESC' });
    const [rows, total] = await this.courses
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.instructor', 'i')
      .where('c.instructorId = :uid', { uid: user.id })
      .orderBy(sort.column, sort.dir)
      .addOrderBy('c.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    return PageResult.of(await this.decorate(rows), total, q);
  }

  async getDetail(user: AuthUser | null, courseId: string) {
    const course = await this.access.getReadable(user, courseId);
    return this.detail(user, course);
  }

  async getDetailBySlug(user: AuthUser | null, slug: string) {
    const found = await this.courses.findOne({ where: { slug } });
    if (!found) throw new NotFoundException('Course not found');
    const course = await this.access.getReadable(user, found.id);
    return this.detail(user, course);
  }

  private async detail(user: AuthUser | null, course: Course) {
    const full = await this.courses.findOneOrFail({
      where: { id: course.id },
      relations: { instructor: true },
    });
    const [summary] = await this.decorate([full]);
    const enrollment = user
      ? await this.enrollments.findOne({ where: { courseId: course.id, studentId: user.id } })
      : null;
    return {
      ...summary,
      description: full.description,
      canManage: this.access.canManage(user, course),
      enrollment: enrollment
        ? {
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            completedAt: enrollment.completedAt,
          }
        : null,
    };
  }

  async create(user: AuthUser, dto: CreateCourseDto, meta: RequestMeta) {
    let instructorId = user.id;
    if (dto.instructorId && dto.instructorId !== user.id) {
      if (!isAdmin(user))
        throw new BadRequestException('Only administrators can assign another instructor');
      const target = await this.users.findOne({ where: { id: dto.instructorId } });
      if (!target || !target.roles.some((r) => r.name === RoleName.INSTRUCTOR)) {
        throw new BadRequestException('instructorId must refer to a user with the INSTRUCTOR role');
      }
      instructorId = target.id;
    }
    const course = await this.courses.save(
      this.courses.create({
        title: cleanText(dto.title),
        slug: `${slugify(dto.title)}-${randomBytes(3).toString('hex')}`,
        summary: cleanText(dto.summary),
        description: cleanText(dto.description),
        level: dto.level,
        language: dto.language ?? 'ar',
        instructorId,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: course.id,
      meta,
    });
    return this.detail(user, course);
  }

  async update(user: AuthUser, courseId: string, dto: UpdateCourseDto, meta: RequestMeta) {
    const course = await this.access.getManageable(user, courseId);
    const fields: string[] = [];
    if (dto.title !== undefined) {
      course.title = cleanText(dto.title);
      fields.push('title');
    }
    if (dto.summary !== undefined) {
      course.summary = cleanText(dto.summary);
      fields.push('summary');
    }
    if (dto.description !== undefined) {
      course.description = cleanText(dto.description);
      fields.push('description');
    }
    if (dto.level !== undefined) {
      course.level = dto.level;
      fields.push('level');
    }
    if (dto.language !== undefined) {
      course.language = dto.language;
      fields.push('language');
    }
    await this.courses.save(course);
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: course.id,
      metadata: { fields },
      meta,
    });
    return this.detail(user, course);
  }

  async publish(user: AuthUser, courseId: string, meta: RequestMeta) {
    const course = await this.access.getManageable(user, courseId);
    if (course.status === CourseStatus.PUBLISHED)
      throw new ConflictException('Course is already published');
    const lessonCount = await this.lessons.count({ where: { courseId } });
    if (lessonCount === 0)
      throw new ConflictException('A course needs at least one lesson before it can be published');
    course.status = CourseStatus.PUBLISHED;
    course.publishedAt = course.publishedAt ?? new Date();
    await this.courses.save(course);
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_PUBLISHED',
      entityType: 'Course',
      entityId: course.id,
      meta,
    });
    return this.detail(user, course);
  }

  /** PUBLISHED -> DRAFT, only while nobody is enrolled (otherwise archive instead). */
  async unpublish(user: AuthUser, courseId: string, meta: RequestMeta) {
    const course = await this.access.getManageable(user, courseId);
    if (course.status !== CourseStatus.PUBLISHED)
      throw new ConflictException('Only published courses can be unpublished');
    const learners = await this.enrollments.count({
      where: { courseId, status: Not(EnrollmentStatus.DROPPED) },
    });
    if (learners > 0)
      throw new ConflictException(
        'Course has enrolled learners; archive it instead of unpublishing',
      );
    course.status = CourseStatus.DRAFT;
    await this.courses.save(course);
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_UNPUBLISHED',
      entityType: 'Course',
      entityId: course.id,
      meta,
    });
    return this.detail(user, course);
  }

  /** PUBLISHED -> ARCHIVED: hidden from the catalogue, no new enrollments, existing learners keep access. */
  async archive(user: AuthUser, courseId: string, meta: RequestMeta) {
    const course = await this.access.getManageable(user, courseId);
    if (course.status !== CourseStatus.PUBLISHED)
      throw new ConflictException('Only published courses can be archived');
    course.status = CourseStatus.ARCHIVED;
    await this.courses.save(course);
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_ARCHIVED',
      entityType: 'Course',
      entityId: course.id,
      meta,
    });
    return this.detail(user, course);
  }

  async remove(user: AuthUser, courseId: string, meta: RequestMeta) {
    const course = await this.access.getManageable(user, courseId);
    if (course.status !== CourseStatus.DRAFT)
      throw new ConflictException('Only draft courses can be deleted; archive it instead');
    const hasEnrollments = await this.enrollments.exist({ where: { courseId } });
    if (hasEnrollments)
      throw new ConflictException('Course has enrollment history and cannot be deleted');
    await this.courses.delete({ id: courseId });
    await this.audit.record({
      actorId: user.id,
      action: 'COURSE_DELETED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { title: course.title },
      meta,
    });
    return { success: true };
  }

  /** Outline (no lesson bodies). Completed lesson ids are included for the caller's own progress only. */
  async curriculum(user: AuthUser | null, courseId: string) {
    const course = await this.access.getReadable(user, courseId);
    const modules = await this.modules.find({
      where: { courseId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    const lessons = modules.length
      ? await this.lessons.find({
          where: { courseId },
          select: [
            'id',
            'moduleId',
            'title',
            'contentType',
            'durationMinutes',
            'isPreview',
            'position',
          ],
          order: { position: 'ASC', createdAt: 'ASC' },
        })
      : [];
    let completed = new Set<string>();
    if (user) {
      const rows = await this.progress.find({
        where: { studentId: user.id, courseId },
        select: ['lessonId'],
      });
      completed = new Set(rows.map((r) => r.lessonId));
    }
    return {
      courseId: course.id,
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        position: m.position,
        lessons: lessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            contentType: l.contentType,
            durationMinutes: l.durationMinutes,
            isPreview: l.isPreview,
            position: l.position,
            completed: completed.has(l.id),
          })),
      })),
    };
  }

  async countLessonsFor(courseIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!courseIds.length) return map;
    const rows = await this.lessons
      .createQueryBuilder('l')
      .select('l.courseId', 'courseId')
      .addSelect('COUNT(*)', 'n')
      .where({ courseId: In(courseIds) })
      .groupBy('l.courseId')
      .getRawMany<{ courseId: string; n: string }>();
    rows.forEach((r) => map.set(r.courseId, Number(r.n)));
    return map;
  }
}
