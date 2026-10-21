import { AttemptAnswers, Question, QuestionType } from '../../database/entities';

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  pointsAwarded: number;
  points: number;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  percent: number;
  results: QuestionResult[];
}

const sameSet = (a: string[], b: string[]): boolean => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

/**
 * Pure, deterministic grading. All-or-nothing per question: the selected option set must equal the
 * correct option set exactly (no partial credit). Unanswered questions score 0.
 */
export function gradeAttempt(
  questions: Pick<Question, 'id' | 'points' | 'correctOptionIds' | 'type'>[],
  answers: AttemptAnswers,
): GradeResult {
  let score = 0;
  let maxScore = 0;
  const results = questions.map((q) => {
    maxScore += q.points;
    const selected = answers[q.id] ?? [];
    const correct = selected.length > 0 && sameSet(selected, q.correctOptionIds);
    const pointsAwarded = correct ? q.points : 0;
    score += pointsAwarded;
    return { questionId: q.id, correct, pointsAwarded, points: q.points };
  });
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  return { score, maxScore, percent, results };
}

/** Structural validation of a submitted answer map against the assessment's questions. Returns an error message or null. */
export function validateAnswers(
  questions: Pick<Question, 'id' | 'type' | 'options'>[],
  answers: unknown,
): string | null {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    return 'answers must be an object';
  const byId = new Map(questions.map((q) => [q.id, q]));
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.length > 500) return 'too many answers';
  for (const [qid, value] of entries) {
    const q = byId.get(qid);
    if (!q) return `Unknown question: ${qid}`;
    if (!Array.isArray(value) || value.length > 20 || value.some((v) => typeof v !== 'string')) {
      return `Answer for ${qid} must be an array of option ids`;
    }
    const ids = value as string[];
    if (new Set(ids).size !== ids.length) return `Duplicate options for ${qid}`;
    const valid = new Set(q.options.map((o) => o.id));
    if (ids.some((id) => !valid.has(id))) return `Unknown option for question ${qid}`;
    if (q.type !== QuestionType.MULTIPLE_CHOICE && ids.length > 1)
      return `Question ${qid} accepts a single option`;
  }
  return null;
}

/** Validates question definition rules that cannot be expressed per-field. */
export function validateQuestionShape(q: {
  type: QuestionType;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
}): string | null {
  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return 'Option ids must be unique';
  if (q.type === QuestionType.TRUE_FALSE && ids.length !== 2)
    return 'TRUE_FALSE questions need exactly 2 options';
  if (q.options.length < 2) return 'At least 2 options are required';
  if (q.correctOptionIds.length < 1) return 'At least one correct option is required';
  if (new Set(q.correctOptionIds).size !== q.correctOptionIds.length)
    return 'Duplicate correct option ids';
  if (q.correctOptionIds.some((c) => !ids.includes(c)))
    return 'correctOptionIds must reference existing options';
  if (q.type !== QuestionType.MULTIPLE_CHOICE && q.correctOptionIds.length !== 1) {
    return `${q.type} questions must have exactly one correct option`;
  }
  return null;
}
