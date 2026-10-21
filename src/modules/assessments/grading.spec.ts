import { QuestionType } from '../../database/entities';
import { gradeAttempt, validateAnswers, validateQuestionShape } from './grading';

const q = (id: string, type: QuestionType, correct: string[], points = 1) => ({
  id,
  type,
  points,
  correctOptionIds: correct,
  options: ['a', 'b', 'c'].map((x) => ({ id: x, text: x })),
});

describe('gradeAttempt', () => {
  const questions = [
    q('q1', QuestionType.SINGLE_CHOICE, ['a'], 2),
    q('q2', QuestionType.MULTIPLE_CHOICE, ['a', 'c'], 3),
  ];

  it('awards full points only for exact matches', () => {
    expect(gradeAttempt(questions, { q1: ['a'], q2: ['c', 'a'] })).toMatchObject({
      score: 5,
      maxScore: 5,
      percent: 100,
    });
  });
  it('gives no partial credit and treats unanswered as zero', () => {
    expect(gradeAttempt(questions, { q1: ['b'], q2: ['a'] })).toMatchObject({
      score: 0,
      percent: 0,
    });
    expect(gradeAttempt(questions, {})).toMatchObject({ score: 0, maxScore: 5 });
  });
  it('rounds percent and handles empty assessments', () => {
    expect(gradeAttempt(questions, { q1: ['a'] }).percent).toBe(40);
    expect(gradeAttempt([], {})).toMatchObject({ maxScore: 0, percent: 0 });
  });
  it('rejects over-selection on multi choice', () => {
    expect(gradeAttempt(questions, { q2: ['a', 'b', 'c'] }).score).toBe(0);
  });
});

describe('validateAnswers', () => {
  const qs = [
    q('q1', QuestionType.SINGLE_CHOICE, ['a']),
    q('q2', QuestionType.MULTIPLE_CHOICE, ['a']),
  ];
  it('accepts well-formed input', () =>
    expect(validateAnswers(qs, { q1: ['a'], q2: ['a', 'b'] })).toBeNull());
  it.each([
    [null],
    [[]],
    ['str'],
    [{ nope: ['a'] }],
    [{ q1: 'a' }],
    [{ q1: [1] }],
    [{ q1: ['z'] }],
    [{ q1: ['a', 'b'] }],
    [{ q2: ['a', 'a'] }],
  ])('rejects %j', (input) => expect(validateAnswers(qs, input)).not.toBeNull());
});

describe('validateQuestionShape', () => {
  const options = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ];
  it('requires exactly one correct answer for single choice / true-false', () => {
    expect(
      validateQuestionShape({
        type: QuestionType.SINGLE_CHOICE,
        options,
        correctOptionIds: ['a', 'b'],
      }),
    ).not.toBeNull();
    expect(
      validateQuestionShape({ type: QuestionType.TRUE_FALSE, options, correctOptionIds: ['a'] }),
    ).toBeNull();
    expect(
      validateQuestionShape({
        type: QuestionType.TRUE_FALSE,
        options: [...options, { id: 'c', text: 'C' }],
        correctOptionIds: ['a'],
      }),
    ).not.toBeNull();
  });
  it('allows multiple correct answers for multiple choice and validates references', () => {
    expect(
      validateQuestionShape({
        type: QuestionType.MULTIPLE_CHOICE,
        options,
        correctOptionIds: ['a', 'b'],
      }),
    ).toBeNull();
    expect(
      validateQuestionShape({
        type: QuestionType.MULTIPLE_CHOICE,
        options,
        correctOptionIds: ['x'],
      }),
    ).not.toBeNull();
  });
});
