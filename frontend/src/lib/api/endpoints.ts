import { api, apiPage, del, get, patch, post, put } from './client';
import type {
  AdminCourse,
  AdminStats,
  Assessment,
  Assignment,
  AttemptDetail,
  AttemptSummary,
  AuditLogEntry,
  AuthResult,
  CourseDetail,
  CourseLevel,
  CourseProgress,
  CourseStatus,
  CourseSummary,
  Curriculum,
  Learner,
  Lesson,
  LessonCompletion,
  Locale,
  MyEnrollment,
  ProgressSummary,
  QuestionType,
  ReviewPolicy,
  Role,
  StaffQuestion,
  StartAttemptResult,
  Submission,
  SubmissionStatus,
  User,
  UserStatus,
} from './types';

type PageQ = { page?: number; pageSize?: number; sort?: string };

export const authApi = {
  /** A 401 here just means "not signed in"; it must not trigger the session-expired redirect. */
  me: () => api<AuthResult>('GET', '/auth/me', { skipUnauthorizedHandler: true }),
  login: (b: { email: string; password: string }) =>
    post<AuthResult>('/auth/login', b, { skipUnauthorizedHandler: true }),
  register: (b: { email: string; password: string; fullName: string; locale: Locale }) =>
    post<AuthResult>('/auth/register', b, { skipUnauthorizedHandler: true }),
  logout: () =>
    post<{ success: true }>('/auth/logout', undefined, { skipUnauthorizedHandler: true }),
  forgot: (b: { email: string }) =>
    post<{ message: string }>('/auth/forgot-password', b, { skipUnauthorizedHandler: true }),
  reset: (b: { token: string; newPassword: string }) =>
    post<{ success: true }>('/auth/reset-password', b, { skipUnauthorizedHandler: true }),
  changePassword: (b: { currentPassword: string; newPassword: string }) =>
    post<{ success: true }>('/auth/change-password', b),
};

export const usersApi = {
  updateMe: (b: { fullName?: string; bio?: string; locale?: Locale }) =>
    patch<User>('/users/me', b),
};

export const coursesApi = {
  list: (q: PageQ & { q?: string; level?: CourseLevel; language?: Locale }) =>
    apiPage<CourseSummary>('/courses', { query: q }),
  mine: (q: PageQ = {}) => apiPage<CourseSummary>('/courses/mine', { query: q }),
  bySlug: (slug: string) => get<CourseDetail>(`/courses/by-slug/${encodeURIComponent(slug)}`),
  get: (id: string) => get<CourseDetail>(`/courses/${id}`),
  curriculum: (id: string) => get<Curriculum>(`/courses/${id}/curriculum`),
  create: (b: {
    title: string;
    summary: string;
    description: string;
    level?: CourseLevel;
    language?: Locale;
  }) => post<CourseDetail>('/courses', b),
  update: (
    id: string,
    b: Partial<{
      title: string;
      summary: string;
      description: string;
      level: CourseLevel;
      language: Locale;
    }>,
  ) => patch<CourseDetail>(`/courses/${id}`, b),
  publish: (id: string) => post<CourseDetail>(`/courses/${id}/publish`),
  unpublish: (id: string) => post<CourseDetail>(`/courses/${id}/unpublish`),
  archive: (id: string) => post<CourseDetail>(`/courses/${id}/archive`),
  remove: (id: string) => del<{ success: true }>(`/courses/${id}`),
};

export interface LessonInput {
  title: string;
  contentType?: 'TEXT' | 'VIDEO' | 'LINK';
  content?: string;
  contentUrl?: string;
  durationMinutes?: number;
  isPreview?: boolean;
}
export const structureApi = {
  createModule: (courseId: string, b: { title: string; description?: string }) =>
    post(`/courses/${courseId}/modules`, b),
  updateModule: (id: string, b: { title?: string; description?: string }) =>
    patch(`/modules/${id}`, b),
  removeModule: (id: string) => del(`/modules/${id}`),
  reorderModules: (courseId: string, ids: string[]) =>
    put(`/courses/${courseId}/modules/order`, { ids }),
  createLesson: (moduleId: string, b: LessonInput) =>
    post<Lesson>(`/modules/${moduleId}/lessons`, b),
  updateLesson: (id: string, b: Partial<LessonInput>) => patch<Lesson>(`/lessons/${id}`, b),
  removeLesson: (id: string) => del(`/lessons/${id}`),
  reorderLessons: (moduleId: string, ids: string[]) =>
    put(`/modules/${moduleId}/lessons/order`, { ids }),
  getLesson: (id: string) => get<Lesson>(`/lessons/${id}`),
};

export const enrollmentsApi = {
  enroll: (courseId: string) =>
    post<{ id: string; courseId: string; status: string; enrolledAt: string }>(
      `/courses/${courseId}/enroll`,
    ),
  drop: (courseId: string) => del<{ success: true }>(`/courses/${courseId}/enroll`),
  mine: (q: PageQ = {}) => apiPage<MyEnrollment>('/enrollments/me', { query: q }),
  learners: (courseId: string, q: PageQ = {}) =>
    apiPage<Learner>(`/courses/${courseId}/learners`, { query: q }),
};

export const progressApi = {
  summary: () => get<ProgressSummary>('/progress/me/summary'),
  course: (courseId: string) => get<CourseProgress>(`/courses/${courseId}/progress`),
  complete: (lessonId: string) => post<LessonCompletion>(`/lessons/${lessonId}/complete`),
  uncomplete: (lessonId: string) => del<LessonCompletion>(`/lessons/${lessonId}/complete`),
  learner: (courseId: string, studentId: string) =>
    get<CourseProgress>(`/courses/${courseId}/learners/${studentId}/progress`),
};

export interface AssessmentInput {
  title: string;
  instructions?: string;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  passingPercent?: number;
  availableFrom?: string;
  dueAt?: string;
  reviewPolicy?: ReviewPolicy;
}
export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  points?: number;
  explanation?: string;
}
export const assessmentsApi = {
  list: (courseId: string, q: PageQ = {}) =>
    apiPage<Assessment>(`/courses/${courseId}/assessments`, { query: q }),
  get: (id: string) => get<Assessment>(`/assessments/${id}`),
  create: (courseId: string, b: AssessmentInput) =>
    post<Assessment>(`/courses/${courseId}/assessments`, b),
  update: (id: string, b: Partial<AssessmentInput>) => patch<Assessment>(`/assessments/${id}`, b),
  publish: (id: string) => post<Assessment>(`/assessments/${id}/publish`),
  unpublish: (id: string) => post<Assessment>(`/assessments/${id}/unpublish`),
  remove: (id: string) => del(`/assessments/${id}`),
  addQuestion: (id: string, b: QuestionInput) =>
    post<StaffQuestion>(`/assessments/${id}/questions`, b),
  updateQuestion: (id: string, b: Partial<QuestionInput>) =>
    patch<StaffQuestion>(`/questions/${id}`, b),
  removeQuestion: (id: string) => del(`/questions/${id}`),
  start: (id: string) => post<StartAttemptResult>(`/assessments/${id}/attempts`),
  attempts: (id: string, q: PageQ = {}) =>
    apiPage<AttemptSummary>(`/assessments/${id}/attempts`, { query: q }),
  attempt: (id: string) => get<AttemptDetail>(`/attempts/${id}`),
  submit: (attemptId: string, answers: Record<string, string[]>) =>
    post<AttemptDetail>(`/attempts/${attemptId}/submit`, { answers }),
};

export interface AssignmentInput {
  title: string;
  instructions: string;
  maxPoints?: number;
  dueAt?: string;
  allowLate?: boolean;
}
export const assignmentsApi = {
  list: (courseId: string, q: PageQ = {}) =>
    apiPage<Assignment>(`/courses/${courseId}/assignments`, { query: q }),
  get: (id: string) => get<Assignment>(`/assignments/${id}`),
  create: (courseId: string, b: AssignmentInput) =>
    post<Assignment>(`/courses/${courseId}/assignments`, b),
  update: (id: string, b: Partial<AssignmentInput>) => patch<Assignment>(`/assignments/${id}`, b),
  publish: (id: string) => post<Assignment>(`/assignments/${id}/publish`),
  unpublish: (id: string) => post<Assignment>(`/assignments/${id}/unpublish`),
  remove: (id: string) => del(`/assignments/${id}`),
  submit: (id: string, b: { content: string; linkUrl?: string }) =>
    put<Submission>(`/assignments/${id}/submission`, b),
  submissions: (id: string, q: PageQ & { status?: SubmissionStatus } = {}) =>
    apiPage<Submission>(`/assignments/${id}/submissions`, { query: q }),
  submission: (id: string) => get<Submission>(`/submissions/${id}`),
  grade: (id: string, b: { grade: number; feedback?: string }) =>
    put<Submission>(`/submissions/${id}/grade`, b),
};

export const adminApi = {
  users: (q: PageQ & { q?: string; role?: Role; status?: UserStatus }) =>
    apiPage<User>('/admin/users', { query: q }),
  createUser: (b: { email: string; password: string; fullName: string; roles: Role[] }) =>
    post<User>('/admin/users', b),
  updateUser: (id: string, b: { fullName?: string; status?: UserStatus; roles?: Role[] }) =>
    patch<User>(`/admin/users/${id}`, b),
  courses: (q: PageQ & { q?: string; status?: CourseStatus }) =>
    apiPage<AdminCourse>('/admin/courses', { query: q }),
  stats: () => get<AdminStats>('/admin/stats'),
  audit: (q: PageQ & { action?: string; entityType?: string }) =>
    apiPage<AuditLogEntry>('/admin/audit-logs', { query: q }),
};
