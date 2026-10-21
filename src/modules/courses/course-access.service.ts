import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Course, CourseStatus, Enrollment, EnrollmentStatus } from '../../database/entities';
import { AuthUser, isAdmin, isInstructor } from '../../common/types';

/**
 * Central authorization rules for course-scoped resources. Every course-related service goes through
 * here so permission AND relationship (ownership/enrollment) are always checked together (anti-IDOR/BOLA).
 */
@Injectable()
export class CourseAccessService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
  ) {}

  canManage(user: AuthUser | null, course: Pick<Course, 'instructorId'>): boolean {
    if (!user) return false;
    return isAdmin(user) || (isInstructor(user) && course.instructorId === user.id);
  }

  async findOrThrow(courseId: string): Promise<Course> {
    const course = await this.courses.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  /** Course visible to the user: published/archived for everyone, drafts only for managers (404 otherwise). */
  async getReadable(user: AuthUser | null, courseId: string): Promise<Course> {
    const course = await this.findOrThrow(courseId);
    if (course.status === CourseStatus.PUBLISHED || this.canManage(user, course)) return course;
    // Enrolled students keep read access to archived courses.
    if (
      user &&
      course.status === CourseStatus.ARCHIVED &&
      (await this.isEnrolled(user.id, course.id))
    )
      return course;
    throw new NotFoundException('Course not found');
  }

  /** Course the user may modify. Hides drafts from non-owners (404) and forbids visible-but-not-owned (403). */
  async getManageable(user: AuthUser, courseId: string): Promise<Course> {
    const course = await this.findOrThrow(courseId);
    if (this.canManage(user, course)) return course;
    if (course.status === CourseStatus.DRAFT) throw new NotFoundException('Course not found');
    throw new ForbiddenException('You do not have permission to manage this course');
  }

  async isEnrolled(studentId: string, courseId: string): Promise<boolean> {
    return this.enrollments.exist({
      where: {
        studentId,
        courseId,
        status: In([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
      },
    });
  }

  /**
   * Learning content (lessons, assessments, assignments) is available to managers, and to enrolled students
   * once the course is not a draft.
   */
  async assertLearnerOrManager(user: AuthUser, course: Course): Promise<'manager' | 'learner'> {
    if (this.canManage(user, course)) return 'manager';
    if (course.status !== CourseStatus.DRAFT && (await this.isEnrolled(user.id, course.id)))
      return 'learner';
    // Do not reveal existence of content the caller has no relationship with.
    throw new NotFoundException('Resource not found');
  }
}
