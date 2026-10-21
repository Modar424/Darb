import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course, CourseStatus, Enrollment, EnrollmentStatus } from '../../database/entities';
import { PageQueryDto, PageResult, skipTake } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from '../courses/course-access.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    private readonly access: CourseAccessService,
    private readonly progress: ProgressService,
    private readonly audit: AuditService,
  ) {}

  async enroll(user: AuthUser, courseId: string, meta: RequestMeta) {
    const course = await this.courses.findOne({ where: { id: courseId } });
    // Unpublished/archived courses are indistinguishable from non-existent ones for enrolment purposes.
    if (!course || course.status !== CourseStatus.PUBLISHED)
      throw new NotFoundException('Course not found');

    const existing = await this.enrollments.findOne({ where: { courseId, studentId: user.id } });
    if (existing && existing.status !== EnrollmentStatus.DROPPED)
      throw new ConflictException('Already enrolled in this course');

    let enrollment: Enrollment;
    if (existing) {
      const complete = await this.progress.isFullyComplete(user.id, courseId);
      existing.status = complete ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE;
      existing.completedAt = complete ? (existing.completedAt ?? new Date()) : null;
      existing.enrolledAt = new Date();
      enrollment = await this.enrollments.save(existing);
    } else {
      try {
        enrollment = await this.enrollments.save(
          this.enrollments.create({
            courseId,
            studentId: user.id,
            status: EnrollmentStatus.ACTIVE,
          }),
        );
      } catch (err) {
        // Concurrent duplicate request: the unique (course, student) constraint is the final arbiter.
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY')
          throw new ConflictException('Already enrolled in this course');
        throw err;
      }
    }
    await this.audit.record({
      actorId: user.id,
      action: 'ENROLLED',
      entityType: 'Course',
      entityId: courseId,
      meta,
    });
    return {
      id: enrollment.id,
      courseId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
    };
  }

  async drop(user: AuthUser, courseId: string, meta: RequestMeta) {
    const enrollment = await this.enrollments.findOne({ where: { courseId, studentId: user.id } });
    if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED)
      throw new NotFoundException('Enrollment not found');
    if (enrollment.status === EnrollmentStatus.COMPLETED)
      throw new ConflictException('Completed courses cannot be dropped');
    enrollment.status = EnrollmentStatus.DROPPED;
    await this.enrollments.save(enrollment);
    await this.audit.record({
      actorId: user.id,
      action: 'ENROLLMENT_DROPPED',
      entityType: 'Course',
      entityId: courseId,
      meta,
    });
    return { success: true };
  }

  async myEnrollments(user: AuthUser, q: PageQueryDto) {
    const [rows, total] = await this.enrollments
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.course', 'c')
      .innerJoinAndSelect('c.instructor', 'i')
      .where('e.studentId = :uid AND e.status <> :dropped', {
        uid: user.id,
        dropped: EnrollmentStatus.DROPPED,
      })
      .orderBy('e.enrolledAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    const progress = await this.progress.forStudent(
      user.id,
      rows.map((r) => r.courseId),
    );
    const items = rows.map((e) => ({
      id: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      progress: progress.get(e.courseId),
      course: {
        id: e.course.id,
        title: e.course.title,
        slug: e.course.slug,
        summary: e.course.summary,
        level: e.course.level,
        status: e.course.status,
        instructor: { id: e.course.instructor.id, fullName: e.course.instructor.fullName },
      },
    }));
    return PageResult.of(items, total, q);
  }

  /** Learner roster of a course the caller manages. Email is visible to the course's own staff only. */
  async learners(user: AuthUser, courseId: string, q: PageQueryDto) {
    await this.access.getManageable(user, courseId);
    const [rows, total] = await this.enrollments
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.student', 's')
      .where('e.courseId = :courseId AND e.status <> :dropped', {
        courseId,
        dropped: EnrollmentStatus.DROPPED,
      })
      .orderBy('e.enrolledAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    const progress = await this.progress.forCourse(
      courseId,
      rows.map((r) => r.studentId),
    );
    return PageResult.of(
      rows.map((e) => ({
        enrollmentId: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
        student: { id: e.student.id, fullName: e.student.fullName, email: e.student.email },
        progress: progress.get(e.studentId),
      })),
      total,
      q,
    );
  }
}
