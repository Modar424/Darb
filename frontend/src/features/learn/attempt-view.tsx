'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { assessmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';
import type { AttemptDetail, LearnerQuestion, ReviewItem } from '@/lib/api/types';

function useCountdown(deadlineAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
}
const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function QuestionBlock({
  q,
  index,
  value,
  onChange,
}: {
  q: LearnerQuestion;
  index: number;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { t, num } = useI18n();
  const multi = q.type === 'MULTIPLE_CHOICE';
  const toggle = (id: string) =>
    onChange(multi ? (value.includes(id) ? value.filter((x) => x !== id) : [...value, id]) : [id]);
  return (
    <Card className="p-5">
      <fieldset>
        <legend className="mb-1 text-lg font-semibold">
          <span className="text-muted">{num(index + 1)}.</span> {q.prompt}
        </legend>
        <p className="mb-3 text-sm text-muted">
          {multi ? t('assess.chooseMany') : t('assess.chooseOne')} ·{' '}
          {t('assess.points', { n: q.points })}
        </p>
        <div className="grid gap-2">
          {q.options.map((o) => {
            const checked = value.includes(o.id);
            return (
              <label
                key={o.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3 py-2 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-saffron-500 ${checked ? 'border-ink-700 bg-ink-100' : 'border-line hover:bg-ink-50'}`}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={q.id}
                  checked={checked}
                  onChange={() => toggle(o.id)}
                  className="size-5 accent-ink-900"
                />
                <span>{o.text}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </Card>
  );
}

function TakeAttempt({
  attempt,
  questions,
  courseId,
}: {
  attempt: AttemptDetail;
  questions: LearnerQuestion[];
  courseId: string;
}) {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(attempt.deadlineAt);
  const submitted = useRef(false);

  const submit = useMutation({
    mutationFn: (a: Record<string, string[]>) => assessmentsApi.submit(attempt.id, a),
    onSuccess: (r) => {
      submitted.current = true;
      qc.setQueryData(['learn', courseId, 'attempt', attempt.id], r);
      void qc.invalidateQueries({ queryKey: ['learn', courseId] });
    },
    onError: (e) => {
      submitted.current = false;
      setConfirm(false);
      setError(t(errorKey(e)));
      void qc.invalidateQueries({ queryKey: ['learn', courseId, 'attempt', attempt.id] });
    },
  });

  // Auto-submit exactly once when the countdown reaches zero.
  useEffect(() => {
    if (left === 0 && !submitted.current && !submit.isPending) {
      submitted.current = true;
      submit.mutate(answers);
    }
  }, [left, submit, answers]);

  // Warn before leaving with unsent answers.
  const dirty = Object.values(answers).some((a) => a.length > 0) && !submit.isSuccess;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const answered = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const announce = left !== null && (left === 300 || left === 60 || left === 10);
  const onChange = useCallback(
    (id: string, v: string[]) => setAnswers((a) => ({ ...a, [id]: v })),
    [],
  );

  return (
    <div>
      {left !== null && (
        <div className="sticky top-14 z-20 -mx-1 mb-4 flex items-center justify-between rounded-(--radius-panel) bg-ink-900 px-4 py-2.5 text-white shadow-(--shadow-pop) lg:top-2">
          <span className="inline-flex items-center gap-2">
            <Clock className="size-5" aria-hidden />
            {t('assess.timeLeft')}
          </span>
          <span
            role="timer"
            className={`ltr-isolate font-display text-xl font-bold ${left <= 60 ? 'text-saffron-500' : ''}`}
          >
            {mmss(left)}
          </span>
          <span className="sr-only" aria-live="assertive">
            {announce
              ? t('assess.timeLeftAnnounce', {
                  n: left >= 60 ? num(Math.round(left / 60)) : num(left),
                  unit: left >= 60 ? t('common.minutesUnit') : t('common.secondsUnit'),
                })
              : ''}
          </span>
        </div>
      )}
      {error && (
        <Alert tone="danger" live className="mb-4">
          {error}
        </Alert>
      )}
      <div className="grid gap-4">
        {questions.map((q, i) => (
          <QuestionBlock
            key={q.id}
            q={q}
            index={i}
            value={answers[q.id] ?? []}
            onChange={(v) => onChange(q.id, v)}
          />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted" aria-live="polite">
          {t('assess.answeredOf', { done: num(answered), total: num(questions.length) })}
        </p>
        <Button size="lg" variant="accent" onClick={() => setConfirm(true)}>
          {t('assess.submit')}
        </Button>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        dismissible={!submit.isPending}
        title={t('assess.submitTitle')}
        description={
          answered < questions.length
            ? t('assess.submitUnanswered', { n: num(questions.length - answered) })
            : t('assess.submitText')
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirm(false)}
              disabled={submit.isPending}
            >
              {t('assess.keepWorking')}
            </Button>
            <Button
              variant="accent"
              loading={submit.isPending}
              onClick={() => submit.mutate(answers)}
            >
              {t('assess.submitConfirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ReviewList({ items }: { items: ReviewItem[] }) {
  const { t, num } = useI18n();
  return (
    <ol className="grid gap-4">
      {items.map((r, i) => (
        <li key={r.questionId}>
          <Card className="p-5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">
                <span className="text-muted">{num(i + 1)}.</span> {r.prompt}
              </h3>
              {r.correct ? (
                <Badge tone="success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t('assess.correct')}
                </Badge>
              ) : (
                <Badge tone="danger">
                  <XCircle className="size-4" aria-hidden />
                  {t('assess.incorrect')}
                </Badge>
              )}
            </div>
            <ul className="grid gap-1.5">
              {r.options.map((o) => {
                const chosen = r.selectedOptionIds.includes(o.id);
                const right = r.correctOptionIds.includes(o.id);
                return (
                  <li
                    key={o.id}
                    className={`flex flex-wrap items-center gap-2 rounded-(--radius-control) border px-3 py-2 ${right ? 'border-teal-700 bg-teal-100' : chosen ? 'border-danger-700 bg-danger-100' : 'border-line'}`}
                  >
                    <span>{o.text}</span>
                    {chosen && (
                      <span className="text-sm font-medium">({t('assess.yourAnswer')})</span>
                    )}
                    {right && (
                      <span className="text-sm font-medium">({t('assess.correctAnswer')})</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {r.explanation && (
              <p className="mt-3 text-sm text-muted">
                <strong>{t('assess.explanation')}:</strong> {r.explanation}
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              {t('assess.pointsAwarded', { got: num(r.pointsAwarded), max: num(r.points) })}
            </p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function AttemptView({ courseId, attemptId }: { courseId: string; attemptId: string }) {
  const { t, pct, date } = useI18n();
  const q = useQuery({
    queryKey: ['learn', courseId, 'attempt', attemptId],
    queryFn: () => assessmentsApi.attempt(attemptId),
    staleTime: 0,
  });
  return (
    <QueryBoundary query={q} skeleton={<Skeleton className="h-96" />}>
      {(a) => (
        <div>
          <Breadcrumbs
            label={t('common.breadcrumb')}
            items={[
              { label: t('nav.myDashboard'), href: '/student' },
              { label: t('learn.courseHome'), href: `/learn/${courseId}` },
              { label: t('assess.attemptN', { n: a.attemptNumber }) },
            ]}
          />
          {a.status === 'IN_PROGRESS' && a.questions ? (
            <>
              <h1 className="mb-4 text-2xl font-bold">
                {t('assess.attemptN', { n: a.attemptNumber })}
              </h1>
              <TakeAttempt attempt={a} questions={a.questions} courseId={courseId} />
            </>
          ) : (
            <>
              <h1 className="mb-4 text-2xl font-bold">{t('assess.resultTitle')}</h1>
              <Card className="mb-6 p-6">
                {a.status === 'EXPIRED' ? (
                  <Alert tone="danger">{t('assess.expiredText')}</Alert>
                ) : (
                  <div className="flex flex-wrap items-center gap-6">
                    <p className="font-display text-5xl font-extrabold text-ink-900">
                      {a.percent != null ? pct(a.percent) : '—'}
                    </p>
                    <div>
                      <Badge tone={a.passed ? 'success' : 'danger'}>
                        {a.passed ? t('assess.passed') : t('assess.notPassed')}
                      </Badge>
                      <p className="mt-1 text-sm text-muted">
                        {t('assess.scoreLine', { got: a.score ?? 0, max: a.maxScore ?? 0 })}
                      </p>
                      <p className="text-sm text-muted">{date(a.submittedAt, true)}</p>
                    </div>
                  </div>
                )}
              </Card>
              {a.review ? (
                <ReviewList items={a.review} />
              ) : a.status === 'SUBMITTED' ? (
                <Alert tone="info">{t('assess.reviewHidden')}</Alert>
              ) : null}
              <div className="mt-6 flex gap-2">
                <LinkButton
                  href={`/learn/${courseId}/assessments/${a.assessmentId}`}
                  variant="secondary"
                >
                  {t('assess.backToAssessment')}
                </LinkButton>
                <LinkButton href={`/learn/${courseId}`} variant="ghost">
                  {t('learn.courseHome')}
                </LinkButton>
              </div>
            </>
          )}
        </div>
      )}
    </QueryBoundary>
  );
}
