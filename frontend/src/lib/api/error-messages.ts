import type { MessageKey } from '@/i18n/messages/ar';
import { ApiError } from './client';

/** Exact backend messages (English) → translation keys, so users see their own language. */
const KNOWN: Record<string, MessageKey> = {
  'Already enrolled in this course': 'err.alreadyEnrolled',
  'No attempts remaining': 'err.noAttempts',
  'This assessment is closed': 'err.assessmentClosed',
  'This assessment is not open yet': 'err.assessmentNotOpen',
  'This attempt has already been closed': 'err.attemptClosed',
  'Time limit exceeded; the attempt was closed without a score': 'err.timeExceeded',
  'The deadline has passed and late submissions are not allowed': 'err.deadlinePassed',
  'Graded submissions cannot be changed': 'err.gradedLocked',
  'A course needs at least one lesson before it can be published': 'err.courseNeedsLesson',
  'Add at least one question before publishing': 'err.assessmentNeedsQuestion',
  'A published assessment needs at least one question': 'err.assessmentNeedsQuestion',
  'Current password is incorrect': 'err.currentPassword',
  'Invalid or expired reset token': 'err.resetToken',
  'Registration could not be completed': 'err.registerFailed',
  'A user with this e-mail already exists': 'err.emailExists',
  'Cannot remove the last active administrator': 'err.lastAdmin',
  'Administrators cannot demote or suspend themselves': 'err.selfDemote',
  'Enroll in this course to access this lesson': 'err.enrollToAccess',
  'Completed courses cannot be dropped': 'err.completedNoDrop',
  'Course has enrolled learners; archive it instead of unpublishing': 'err.hasLearnersArchive',
  'Only draft courses can be deleted; archive it instead': 'err.onlyDraftDelete',
  'Course has enrollment history and cannot be deleted': 'err.hasHistory',
  'Course has enrollments; content cannot be deleted': 'err.contentLocked',
  'passingPercent cannot change after attempts have started': 'err.passingFrozen',
  'Assessment already has attempts': 'err.hasAttempts',
  'Assessment has attempts and cannot be deleted': 'err.hasAttempts',
  'Assignment has submissions and cannot be deleted': 'err.hasSubmissions',
  'maxPoints cannot change once submissions have been graded': 'err.maxPointsFrozen',
  'availableFrom must be before dueAt': 'err.windowOrder',
  'Questions cannot be changed after learners have started attempts': 'err.questionsLocked',
  'Assignment already has submissions': 'err.hasSubmissions',
  'Only enrolled students can submit assignments': 'err.enrollToAccess',
  'Only enrolled students can take assessments': 'err.enrollToAccess',
  'You must be enrolled in this course': 'err.enrollToAccess',
  'You are no longer enrolled in this course': 'err.enrollToAccess',
};

const BY_STATUS: Record<number, MessageKey> = {
  0: 'err.network',
  400: 'err.validation',
  401: 'err.unauthorized',
  403: 'err.forbidden',
  404: 'err.notFound',
  409: 'err.conflict',
  413: 'err.tooLarge',
  429: 'err.tooMany',
};

/** Returns a localisation key for an error. Never exposes raw server text to the user. */
export function errorKey(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    const known = KNOWN[err.message];
    if (known) return known;
    if (err.status === 401 && err.message === 'Invalid email or password')
      return 'err.badCredentials';
    if (err.status === 400 && err.message.startsWith('Password must')) return 'err.passwordPolicy';
    return BY_STATUS[err.status] ?? (err.status >= 500 ? 'err.server' : 'err.unknown');
  }
  return 'err.unknown';
}

/** Per-field validation details, when the API provides them (400 "Validation failed"). */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return {};
  const out: Record<string, string> = {};
  for (const d of err.details as unknown[]) {
    if (typeof d === 'string') {
      const field = d.split(' ')[0] ?? '';
      if (field && !out[field]) out[field] = d;
    } else if (d && typeof d === 'object') {
      const o = d as { field?: unknown; property?: unknown; message?: unknown };
      const f = String(o.field ?? o.property ?? '');
      if (f && !out[f]) out[f] = String(o.message ?? '');
    }
  }
  return out;
}
