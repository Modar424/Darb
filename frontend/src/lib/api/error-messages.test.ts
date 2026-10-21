import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { errorKey, fieldErrors } from './error-messages';

describe('errorKey', () => {
  it('maps known backend messages to localisation keys', () => {
    expect(errorKey(new ApiError(409, 'Already enrolled in this course'))).toBe(
      'err.alreadyEnrolled',
    );
    expect(errorKey(new ApiError(401, 'Invalid email or password'))).toBe('err.badCredentials');
    expect(
      errorKey(
        new ApiError(
          400,
          'Password must be 10-128 characters and must not be a common or e-mail-derived password',
        ),
      ),
    ).toBe('err.passwordPolicy');
  });
  it('falls back by status and never exposes raw text', () => {
    expect(errorKey(new ApiError(0, 'Failed to fetch'))).toBe('err.network');
    expect(errorKey(new ApiError(403, 'secret internal detail'))).toBe('err.forbidden');
    expect(errorKey(new ApiError(404, 'x'))).toBe('err.notFound');
    expect(errorKey(new ApiError(429, 'x'))).toBe('err.tooMany');
    expect(errorKey(new ApiError(503, 'x'))).toBe('err.server');
    expect(errorKey(new Error('boom'))).toBe('err.unknown');
  });
});
describe('fieldErrors', () => {
  it('extracts the property name from class-validator style messages', () => {
    expect(
      fieldErrors(
        new ApiError(400, 'Validation failed', ['email must be an email', 'password is too short']),
      ),
    ).toEqual({
      email: 'email must be an email',
      password: 'password is too short',
    });
  });
  it('returns an empty object for other errors', () => {
    expect(fieldErrors(new ApiError(500, 'x'))).toEqual({});
    expect(fieldErrors(new Error('x'))).toEqual({});
  });
});

describe('errorKey coverage', () => {
  it('maps the quiz-locked and enrollment-required messages', () => {
    expect(
      errorKey(
        new ApiError(409, 'Questions cannot be changed after learners have started attempts'),
      ),
    ).toBe('err.questionsLocked');
    expect(errorKey(new ApiError(403, 'You must be enrolled in this course'))).toBe(
      'err.enrollToAccess',
    );
  });
});
