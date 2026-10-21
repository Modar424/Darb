export enum RoleName {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT = 'STUDENT',
}
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}
export enum CourseStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}
export enum CourseLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}
export enum LessonContentType {
  TEXT = 'TEXT',
  VIDEO = 'VIDEO',
  LINK = 'LINK',
}
export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}
export enum PublishStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}
export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
}
export enum ReviewPolicy {
  AFTER_SUBMISSION = 'AFTER_SUBMISSION',
  NEVER = 'NEVER',
}
export enum AttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  EXPIRED = 'EXPIRED',
}
export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  GRADED = 'GRADED',
}
