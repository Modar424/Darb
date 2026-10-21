import { describe, expect, it } from 'vitest';
import { questionSchema } from './assessment-editor';

const base = { prompt: 'سؤال', points: 1, explanation: '' };
const blank = [
  { text: '', correct: true },
  { text: '', correct: false },
];

describe('questionSchema', () => {
  it('accepts a true/false question whose (hidden) option texts are empty', () => {
    expect(questionSchema.safeParse({ ...base, type: 'TRUE_FALSE', options: blank }).success).toBe(
      true,
    );
  });
  it('requires option text for single and multiple choice', () => {
    for (const type of ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] as const) {
      const r = questionSchema.safeParse({ ...base, type, options: blank });
      expect(r.success).toBe(false);
      expect(
        r.error?.issues.some(
          (i) => i.path.join('.') === 'options.0.text' && i.message === 'val.required',
        ),
      ).toBe(true);
    }
  });
  it('single choice needs exactly one correct answer; multiple needs at least one', () => {
    const two = [
      { text: 'أ', correct: true },
      { text: 'ب', correct: true },
    ];
    const none = [
      { text: 'أ', correct: false },
      { text: 'ب', correct: false },
    ];
    expect(questionSchema.safeParse({ ...base, type: 'SINGLE_CHOICE', options: two }).success).toBe(
      false,
    );
    expect(
      questionSchema.safeParse({ ...base, type: 'MULTIPLE_CHOICE', options: two }).success,
    ).toBe(true);
    expect(
      questionSchema.safeParse({ ...base, type: 'MULTIPLE_CHOICE', options: none }).success,
    ).toBe(false);
  });
});
