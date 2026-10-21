export * from './enums';
export * from './role.entity';
export * from './user.entity';
export * from './session.entity';
export * from './password-reset-token.entity';
export * from './course.entity';
export * from './course-module.entity';
export * from './lesson.entity';
export * from './enrollment.entity';
export * from './assessment.entity';
export * from './question.entity';
export * from './assessment-attempt.entity';
export * from './assignment.entity';
export * from './assignment-submission.entity';
export * from './progress-record.entity';
export * from './audit-log.entity';

import { Role } from './role.entity';
import { User } from './user.entity';
import { Session } from './session.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { Course } from './course.entity';
import { CourseModule } from './course-module.entity';
import { Lesson } from './lesson.entity';
import { Enrollment } from './enrollment.entity';
import { Assessment } from './assessment.entity';
import { Question } from './question.entity';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { Assignment } from './assignment.entity';
import { AssignmentSubmission } from './assignment-submission.entity';
import { ProgressRecord } from './progress-record.entity';
import { AuditLog } from './audit-log.entity';

export const ALL_ENTITIES = [
  Role,
  User,
  Session,
  PasswordResetToken,
  Course,
  CourseModule,
  Lesson,
  Enrollment,
  Assessment,
  Question,
  AssessmentAttempt,
  Assignment,
  AssignmentSubmission,
  ProgressRecord,
  AuditLog,
];
