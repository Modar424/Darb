import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Course,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  ProgressRecord,
} from '../../database/entities';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from '../courses/course-access.service';

export interface ProgressSnapshot {
  completedLessons: number;
  totalLessons: number;
  percent: number;
}

const percentOf = (done: number, total: number) =>
  total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(ProgressRecord) private readonly records: Repository<ProgressRecord>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  /** Progress for one student across several courses, derived from persisted rows only. */
  async forStudent(studentId: string, courseIds: string[]): Promise<Map<string, ProgressSnapshot>> {
    const out = new Map<string, ProgressSnapshot>();
    if (!courseIds.length) return out;
    const totals = await this.lessons
      .createQueryBuilder('l')
      .select('l.courseId', 'courseId')
      .addSelect('COUNT(*)', 'n')
      .where({ courseId: In(courseIds) })
      .groupBy('l.courseId')
      .getRawMany<{ courseId: string; n: string }>();
    const done = await this.records
      .createQueryBuilder('p')
      .select('p.courseId', 'courseId')
      .addSelect('COUNT(*)', 'n')
      .where({ courseId: In(courseIds), studentId })
      .groupBy('p.courseId')
      .getRawMany<{ courseId: string; n: string }>();
    const totalMap = new Map(totals.map((t) => [t.courseId, Number(t.n)]));
    const doneMap = new Map(done.map((d) => [d.courseId, Number(d.n)]));
    for (const id of courseIds) {
      const t = totalMap.get(id) ?? 0;
      const d = Math.min(doneMap.get(id) ?? 0, t);
      out.set(id, { completedLessons: d, totalLessons: t, percent: percentOf(d, t) });
    }
    return out;
  }

  /** Progress for many students within one course (instructor learner list). */
  async forCourse(courseId: string, studentIds: string[]): Promise<Map<string, ProgressSnapshot>> {
    const out = new Map<string, ProgressSnapshot>();
    if (!studentIds.length) return out;
    const total = await this.lessons.count({ where: { courseId } });
    const done = await this.records
      .createQueryBuilder('p')
      .select('p.studentId', 'studentId')
      .addSelect('COUNT(*)', 'n')
      .where({ courseId, studentId: In(studentIds) })
      .groupBy('p.studentId')
      .getRawMany<{ studentId: string; n: string }>();
    const doneMap = new Map(done.map((d) => [d.studentId, Number(d.n)]));
    for (const id of studentIds) {
      const d = Math.min(doneMap.get(id) ?? 0, total);
      out.set(id, { completedLessons: d, totalLessons: total, percent: percentOf(d, total) });
    }
    return out;
  }

  private async lessonForLearner(lessonId: string): Promise<{ lesson: Lesson; course: Course }> {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const course = await this.access.findOrThrow(lesson.courseId);
    if (course.status === CourseStatus.DRAFT) throw new NotFoundException('Lesson not found');
    return { lesson, course };
  }

  /** Idempotent. Marks the lesson done and completes the enrollment when every lesson is finished. */
  async completeLesson(user: AuthUser, lessonId: string, meta: RequestMeta) {
    const { lesson, course } = await this.lessonForLearner(lessonId);
    return this.dataSource.transaction(async (em) => {
      const enrollment = await em
        .getRepository(Enrollment)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.courseId = :cid AND e.studentId = :sid', { cid: course.id, sid: user.id })
        .getOne();
      if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED) {
        throw new ForbiddenException('You must be enrolled in this course');
      }
      await em
        .createQueryBuilder()
        .insert()
        .into(ProgressRecord)
        .values({
          studentId: user.id,
          courseId: course.id,
          lessonId: lesson.id,
          completedAt: new Date(),
        })
        .orIgnore()
        .execute();

      const total = await em.getRepository(Lesson).count({ where: { courseId: course.id } });
      const done = await em
        .getRepository(ProgressRecord)
        .count({ where: { courseId: course.id, studentId: user.id } });
      if (total > 0 && done >= total && enrollment.status !== EnrollmentStatus.COMPLETED) {
        await em
          .getRepository(Enrollment)
          .update(
            { id: enrollment.id },
            { status: EnrollmentStatus.COMPLETED, completedAt: new Date() },
          );
        await this.audit.record(
          {
            actorId: user.id,
            action: 'COURSE_COMPLETED',
            entityType: 'Course',
            entityId: course.id,
            meta,
          },
          em,
        );
        enrollment.status = EnrollmentStatus.COMPLETED;
      }
      return {
        lessonId: lesson.id,
        completed: true,
        courseStatus: enrollment.status,
        completedLessons: done,
        totalLessons: total,
        percent: percentOf(done, total),
      };
    });
  }

  async uncompleteLesson(user: AuthUser, lessonId: string) {
    const { lesson, course } = await this.lessonForLearner(lessonId);
    return this.dataSource.transaction(async (em) => {
      const enrollment = await em
        .getRepository(Enrollment)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.courseId = :cid AND e.studentId = :sid', { cid: course.id, sid: user.id })
        .getOne();
      if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED) {
        throw new ForbiddenException('You must be enrolled in this course');
      }
      await em.getRepository(ProgressRecord).delete({ studentId: user.id, lessonId: lesson.id });
      if (enrollment.status === EnrollmentStatus.COMPLETED) {
        await em
          .getRepository(Enrollment)
          .update({ id: enrollment.id }, { status: EnrollmentStatus.ACTIVE, completedAt: null });
        enrollment.status = EnrollmentStatus.ACTIVE;
      }
      const total = await em.getRepository(Lesson).count({ where: { courseId: course.id } });
      const done = await em
        .getRepository(ProgressRecord)
        .count({ where: { courseId: course.id, studentId: user.id } });
      return {
        lessonId: lesson.id,
        completed: false,
        courseStatus: enrollment.status,
        completedLessons: done,
        totalLessons: total,
        percent: percentOf(done, total),
      };
    });
  }

  private async detailFor(studentId: string, courseId: string) {
    const enrollment = await this.enrollments.findOne({ where: { studentId, courseId } });
    if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED)
      throw new NotFoundException('Enrollment not found');
    const snap = (await this.forStudent(studentId, [courseId])).get(courseId)!;
    const completed = await this.records.find({
      where: { studentId, courseId },
      select: ['lessonId', 'completedAt'],
    });
    return {
      courseId,
      studentId,
      enrollmentStatus: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      ...snap,
      completedLessonIds: completed.map((c) => c.lessonId),
    };
  }

  myCourseProgress(user: AuthUser, courseId: string) {
    return this.detailFor(user.id, courseId);
  }

  /** Instructor/admin view of one learner; requires management rights over the course AND an enrollment link. */
  async learnerProgress(manager: AuthUser, courseId: string, studentId: string) {
    await this.access.getManageable(manager, courseId);
    return this.detailFor(studentId, courseId);
  }

  /** Student dashboard numbers, all derived from persisted data. */
  async mySummary(user: AuthUser) {
    const enrollments = await this.enrollments.find({
      where: {
        studentId: user.id,
        status: In([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
      },
    });
    const progress = await this.forStudent(
      user.id,
      enrollments.map((e) => e.courseId),
    );
    const percents = enrollments.map((e) => progress.get(e.courseId)?.percent ?? 0);
    const recent = await this.records.find({
      where: { studentId: user.id },
      order: { completedAt: 'DESC' },
      take: 5,
      relations: { lesson: true },
    });
    return {
      enrolledCourses: enrollments.length,
      completedCourses: enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED).length,
      inProgressCourses: enrollments.filter((e) => e.status === EnrollmentStatus.ACTIVE).length,
      averageProgressPercent: percents.length
        ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
        : 0,
      lessonsCompleted: [...progress.values()].reduce((a, p) => a + p.completedLessons, 0),
      recentActivity: recent.map((r) => ({
        lessonId: r.lessonId,
        lessonTitle: r.lesson?.title ?? null,
        courseId: r.courseId,
        completedAt: r.completedAt,
      })),
    };
  }

  /** Used by enrollment flow when re-activating a dropped enrollment. */
  async isFullyComplete(studentId: string, courseId: string): Promise<boolean> {
    const snap = (await this.forStudent(studentId, [courseId])).get(courseId);
    return !!snap && snap.totalLessons > 0 && snap.completedLessons >= snap.totalLessons;
  }
}
