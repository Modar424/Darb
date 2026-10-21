/**
 * Hand-written types mirroring the Phase 1 backend contract (see /api/v1/docs).
 * Phase 3 may replace these with types generated from the OpenAPI document.
 */
export type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
export type Locale = 'ar' | 'en';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type LessonContentType = 'TEXT' | 'VIDEO' | 'LINK';
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED';
export type PublishStatus = 'DRAFT' | 'PUBLISHED';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
export type ReviewPolicy = 'AFTER_SUBMISSION' | 'NEVER';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type SubmissionStatus = 'SUBMITTED' | 'GRADED';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  bio: string | null;
  locale: Locale;
  status: UserStatus;
  roles: Role[];
  lastLoginAt: string | null;
  createdAt: string;
}
export interface AuthResult {
  user: User;
  csrfToken: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  summary: string;
  level: CourseLevel;
  language: Locale;
  status: CourseStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  instructor: { id: string; fullName: string } | null;
  lessonCount: number;
  learnerCount: number;
}
export interface CourseDetail extends CourseSummary {
  description: string;
  canManage: boolean;
  enrollment: { status: EnrollmentStatus; enrolledAt: string; completedAt: string | null } | null;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  contentType: LessonContentType;
  durationMinutes: number;
  isPreview: boolean;
  position: number;
  completed: boolean;
}
export interface CurriculumModule {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: CurriculumLesson[];
}
export interface Curriculum {
  courseId: string;
  modules: CurriculumModule[];
}
export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  contentType: LessonContentType;
  content: string | null;
  contentUrl: string | null;
  durationMinutes: number;
  isPreview: boolean;
  position: number;
}

export interface ProgressSnapshot {
  completedLessons: number;
  totalLessons: number;
  percent: number;
}
export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  progress?: ProgressSnapshot;
  course: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    level: CourseLevel;
    status: CourseStatus;
    instructor: { id: string; fullName: string };
  };
}
export interface CourseProgress extends ProgressSnapshot {
  courseId: string;
  studentId: string;
  enrollmentStatus: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  completedLessonIds: string[];
}
export interface LessonCompletion extends ProgressSnapshot {
  lessonId: string;
  completed: boolean;
  courseStatus: EnrollmentStatus;
}
export interface ProgressSummary {
  enrolledCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  averageProgressPercent: number;
  lessonsCompleted: number;
  recentActivity: {
    lessonId: string;
    lessonTitle: string | null;
    courseId: string;
    completedAt: string;
  }[];
}
export interface Learner {
  enrollmentId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  student: { id: string; fullName: string; email: string };
  progress?: ProgressSnapshot;
}

export interface QuestionOption {
  id: string;
  text: string;
}
export interface LearnerQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  points: number;
  position: number;
}
export interface StaffQuestion extends LearnerQuestion {
  assessmentId: string;
  correctOptionIds: string[];
  explanation: string | null;
}
export interface Assessment {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  instructions: string | null;
  status: PublishStatus;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  availableFrom: string | null;
  dueAt: string | null;
  reviewPolicy: ReviewPolicy;
  createdAt: string;
  updatedAt: string;
  questionCount?: number;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  myProgress?: { attemptsUsed: number; bestPercent: number | null; passed: boolean };
  questions?: StaffQuestion[];
}
export interface AttemptSummary {
  id: string;
  assessmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
  student?: { id: string; fullName: string };
}
export interface ReviewItem {
  questionId: string;
  prompt: string;
  type: QuestionType;
  options: QuestionOption[];
  selectedOptionIds: string[];
  correctOptionIds: string[];
  correct: boolean;
  pointsAwarded: number;
  points: number;
  explanation: string | null;
}
export interface AttemptDetail extends AttemptSummary {
  studentId?: string;
  questions?: LearnerQuestion[];
  review?: ReviewItem[];
}
export interface StartAttemptResult {
  attempt: AttemptSummary;
  questions: LearnerQuestion[];
  resumed: boolean;
}

export interface Assignment {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  instructions: string;
  status: PublishStatus;
  maxPoints: number;
  dueAt: string | null;
  allowLate: boolean;
  createdAt: string;
  updatedAt: string;
  mySubmission?: { id: string; status: SubmissionStatus; grade: number | null } | null;
}
export interface Submission {
  id: string;
  assignmentId: string;
  status: SubmissionStatus;
  content: string;
  linkUrl: string | null;
  submittedAt: string;
  isLate: boolean;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedById: string | null;
  student?: { id: string; fullName: string };
}

export interface AdminCourse {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  level: CourseLevel;
  publishedAt: string | null;
  createdAt: string;
  instructor: { id: string; fullName: string };
  lessonCount: number;
}
export interface AdminStats {
  users: { total: number; byRole: Partial<Record<Role, number>> };
  courses: { total: number; byStatus: Record<CourseStatus, number> };
  enrollments: { active: number; completed: number };
  assessmentAttempts: number;
  assignmentSubmissions: number;
}
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
