'use client';

import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { assessmentsApi, type QuestionInput } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { toLocalInput } from '@/lib/datetime';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { QueryBoundary } from '@/components/states';
import {
  AssessmentFields,
  assessmentBody,
  assessmentSchema,
  type AssessmentFormInput,
  type AssessmentFormOutput,
} from './manage/assessments-tab';
import type { Assessment, StaffQuestion } from '@/lib/api/types';

export const questionSchema = z
  .object({
    type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']),
    prompt: z.string().trim().min(1, 'val.required').max(2000, 'val.tooLong'),
    points: z.coerce.number().int('val.integer').min(1, 'val.range').max(100, 'val.range'),
    explanation: z.string().trim().max(2000, 'val.tooLong'),
    // Option text is required only for types that show editable options; true/false options are fixed ("صح"/"خطأ").
    options: z
      .array(z.object({ text: z.string().trim().max(500, 'val.tooLong'), correct: z.boolean() }))
      .min(2, 'val.minOptions')
      .max(10),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'TRUE_FALSE')
      v.options.forEach((o, i) => {
        if (!o.text)
          ctx.addIssue({ code: 'custom', path: ['options', i, 'text'], message: 'val.required' });
      });
    const n = v.options.filter((o) => o.correct).length;
    if (v.type === 'MULTIPLE_CHOICE' ? n < 1 : n !== 1)
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: v.type === 'MULTIPLE_CHOICE' ? 'val.atLeastOneCorrect' : 'val.exactlyOneCorrect',
      });
  });
type QInput = z.input<typeof questionSchema>;
type QOutput = z.output<typeof questionSchema>;
const optionId = (i: number) => `o${i + 1}`;

function QuestionDialog({
  assessmentId,
  question,
  open,
  onClose,
}: {
  assessmentId: string;
  question: StaffQuestion | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const defaults: QInput = question
    ? {
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        explanation: question.explanation ?? '',
        options: question.options.map((o) => ({
          text: o.text,
          correct: question.correctOptionIds.includes(o.id),
        })),
      }
    : {
        type: 'SINGLE_CHOICE',
        prompt: '',
        points: 1,
        explanation: '',
        options: [
          { text: '', correct: true },
          { text: '', correct: false },
        ],
      };
  const form = useForm<QInput, unknown, QOutput>({
    resolver: zodResolver(questionSchema),
    values: defaults,
  });
  const { register, handleSubmit, control, formState, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });
  const type = useWatch({ control, name: 'type' });
  const options = useWatch({ control, name: 'options' }) ?? [];

  const save = handleSubmit(async (v) => {
    setError(null);
    const tf = v.type === 'TRUE_FALSE';
    const opts = tf
      ? [
          { text: t('assess.true'), correct: v.options[0]?.correct ?? true },
          { text: t('assess.false'), correct: !(v.options[0]?.correct ?? true) },
        ]
      : v.options;
    const body: QuestionInput = {
      type: v.type,
      prompt: v.prompt,
      points: v.points,
      ...(v.explanation ? { explanation: v.explanation } : {}),
      options: opts.map((o, i) => ({ id: optionId(i), text: o.text })),
      correctOptionIds: opts.flatMap((o, i) => (o.correct ? [optionId(i)] : [])),
    };
    try {
      if (question) await assessmentsApi.updateQuestion(question.id, body);
      else await assessmentsApi.addQuestion(assessmentId, body);
      await qc.invalidateQueries({ queryKey: ['instructor', 'assessment', assessmentId] });
      toast.success(t('common.saved'));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  const setCorrect = (i: number, checked: boolean) => {
    if (type === 'MULTIPLE_CHOICE')
      setValue(`options.${i}.correct`, checked, { shouldValidate: true });
    else
      options.forEach((_, j) =>
        setValue(`options.${j}.correct`, j === i, { shouldValidate: true }),
      );
  };
  const optionsError =
    formState.errors.options?.root?.message ??
    (formState.errors.options as { message?: string } | undefined)?.message;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!formState.isSubmitting}
      title={question ? t('assess.editQuestion') : t('assess.addQuestion')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={formState.isSubmitting} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" live className="mb-3">
          {error}
        </Alert>
      )}
      <form onSubmit={save} noValidate className="grid gap-4">
        <Select label={t('assess.qType')} {...register('type')}>
          <option value="SINGLE_CHOICE">{t('qtype.SINGLE_CHOICE')}</option>
          <option value="MULTIPLE_CHOICE">{t('qtype.MULTIPLE_CHOICE')}</option>
          <option value="TRUE_FALSE">{t('qtype.TRUE_FALSE')}</option>
        </Select>
        <Textarea
          label={t('assess.qPrompt')}
          rows={3}
          required
          error={fieldMessage(t, formState.errors.prompt)}
          {...register('prompt')}
        />
        {type === 'TRUE_FALSE' ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('assess.qCorrect')}</legend>
            {[true, false].map((val) => (
              <label key={String(val)} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="tf"
                  className="size-5 accent-ink-900"
                  checked={(options[0]?.correct ?? true) === val}
                  onChange={() =>
                    setValue('options', [
                      { text: t('assess.true'), correct: val },
                      { text: t('assess.false'), correct: !val },
                    ])
                  }
                />
                {val ? t('assess.true') : t('assess.false')}
              </label>
            ))}
            {optionsError && (
              <p role="alert" className="text-sm font-medium text-danger-700">
                {t(optionsError as Parameters<typeof t>[0])}
              </p>
            )}
          </fieldset>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t('assess.qOptions')}{' '}
              <span className="font-normal text-muted">
                (
                {type === 'MULTIPLE_CHOICE'
                  ? t('assess.markManyCorrect')
                  : t('assess.markOneCorrect')}
                )
              </span>
            </legend>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <input
                  type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                  name="correct"
                  className="mt-3 size-5 shrink-0 accent-ink-900"
                  aria-label={t('assess.markCorrect', { n: i + 1 })}
                  checked={options[i]?.correct ?? false}
                  onChange={(e) => setCorrect(i, e.target.checked)}
                />
                <div className="flex-1">
                  <Input
                    label={t('assess.optionN', { n: i + 1 })}
                    error={fieldMessage(t, formState.errors.options?.[i]?.text)}
                    {...register(`options.${i}.text`)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-7"
                  disabled={fields.length <= 2}
                  aria-label={t('common.delete')}
                  onClick={() => remove(i)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {optionsError && (
              <p role="alert" className="text-sm font-medium text-danger-700">
                {t(optionsError as Parameters<typeof t>[0])}
              </p>
            )}
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={fields.length >= 10}
                onClick={() => append({ text: '', correct: false })}
              >
                <Plus className="size-4" aria-hidden />
                {t('assess.addOption')}
              </Button>
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('assess.qPoints')}
            type="number"
            min={1}
            max={100}
            error={fieldMessage(t, formState.errors.points)}
            {...register('points')}
          />
        </div>
        <Textarea
          label={t('assess.qExplanation')}
          rows={2}
          error={fieldMessage(t, formState.errors.explanation)}
          {...register('explanation')}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

function SettingsPanel({ a }: { a: Assessment }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AssessmentFormInput, unknown, AssessmentFormOutput>({
    resolver: zodResolver(assessmentSchema),
    values: {
      title: a.title,
      instructions: a.instructions ?? '',
      timeLimitMinutes: a.timeLimitMinutes ?? undefined,
      maxAttempts: a.maxAttempts,
      passingPercent: a.passingPercent,
      availableFrom: toLocalInput(a.availableFrom),
      dueAt: toLocalInput(a.dueAt),
      reviewPolicy: a.reviewPolicy,
    },
  });
  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await assessmentsApi.update(a.id, assessmentBody(v));
      await qc.invalidateQueries({ queryKey: ['instructor'] });
      toast.success(t('common.saved'));
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <form onSubmit={save} noValidate className="grid max-w-2xl gap-4">
      {error && (
        <Alert tone="danger" live>
          {error}
        </Alert>
      )}
      {(a.attemptsUsed ?? 0) > 0 && <Alert tone="info">{t('assess.frozenNote')}</Alert>}
      <AssessmentFields form={form} />
      <div>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function AttemptsPanel({ assessmentId }: { assessmentId: string }) {
  const { t, date, pct } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['instructor', 'assessment', assessmentId, 'attempts', page],
    queryFn: () => assessmentsApi.attempts(assessmentId, { page, pageSize: 20 }),
  });
  return (
    <QueryBoundary query={q}>
      {(p) =>
        p.items.length === 0 ? (
          <EmptyState title={t('assess.noAttemptsStaff')} />
        ) : (
          <>
            <DataTable
              caption={t('assess.attemptsCaption')}
              rows={p.items}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: 's',
                  header: t('table.name'),
                  primary: true,
                  cell: (r) => r.student?.fullName ?? '—',
                },
                { key: 'n', header: t('assess.attemptLabel'), cell: (r) => r.attemptNumber },
                {
                  key: 'st',
                  header: t('table.status'),
                  cell: (r) => (
                    <Badge
                      tone={
                        r.status === 'SUBMITTED' ? (r.passed ? 'success' : 'danger') : 'warning'
                      }
                    >
                      {r.status === 'SUBMITTED'
                        ? r.passed
                          ? t('assess.passed')
                          : t('assess.notPassed')
                        : r.status === 'EXPIRED'
                          ? t('assess.expired')
                          : t('assess.inProgress')}
                    </Badge>
                  ),
                },
                {
                  key: 'sc',
                  header: t('assess.score'),
                  cell: (r) => (r.percent != null ? pct(r.percent) : '—'),
                },
                { key: 'd', header: t('table.date'), cell: (r) => date(r.startedAt, true) },
              ]}
            />
            <Pagination meta={p.meta} onPage={setPage} />
          </>
        )
      }
    </QueryBoundary>
  );
}

export function AssessmentEditor({ assessmentId }: { assessmentId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('questions');
  // The dialog stays mounted after closing (so the browser can return focus to the opener); `key` changes on every
  // opening so each opening starts from a fresh form instead of the previous question's values.
  const [qDlg, setQDlg] = useState<{ q: StaffQuestion | null; key: number; open: boolean } | null>(
    null,
  );
  const openQuestion = (q: StaffQuestion | null) =>
    setQDlg((p) => ({ q, key: (p?.key ?? 0) + 1, open: true }));
  const [delQ, setDelQ] = useState<StaffQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['instructor', 'assessment', assessmentId],
    queryFn: () => assessmentsApi.get(assessmentId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['instructor'] });
  const toggle = useMutation({
    mutationFn: (publish: boolean) =>
      publish ? assessmentsApi.publish(assessmentId) : assessmentsApi.unpublish(assessmentId),
    onSuccess: async (r) => {
      setError(null);
      toast.success(
        r.status === 'PUBLISHED' ? t('assess.publishedToast') : t('assess.unpublishedToast'),
      );
      await refresh();
    },
    onError: (e) => setError(t(errorKey(e))),
  });
  const removeQ = useMutation({
    mutationFn: (id: string) => assessmentsApi.removeQuestion(id),
    onSuccess: async () => {
      setDelQ(null);
      toast.success(t('common.deleted'));
      await refresh();
    },
    onError: (e) => {
      setDelQ(null);
      setError(t(errorKey(e)));
    },
  });

  return (
    <QueryBoundary query={q} skeleton={<Skeleton className="h-96" />}>
      {(a) => (
        <>
          <Breadcrumbs
            label={t('common.breadcrumb')}
            items={[
              { label: t('nav.myCourses'), href: '/instructor' },
              { label: t('assess.title'), href: `/instructor/courses/${a.courseId}` },
              { label: a.title },
            ]}
          />
          <PageHeader
            title={a.title}
            actions={
              <>
                <Badge tone={a.status === 'PUBLISHED' ? 'success' : 'warning'}>
                  {t(`publish.${a.status}`)}
                </Badge>
                {a.status === 'DRAFT' ? (
                  <Button
                    variant="accent"
                    size="sm"
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate(true)}
                  >
                    {t('common.publish')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate(false)}
                  >
                    {t('common.unpublish')}
                  </Button>
                )}
              </>
            }
          />
          {error && (
            <Alert tone="danger" live className="mb-4">
              {error}
            </Alert>
          )}
          <Tabs
            label={t('assess.sections')}
            value={tab}
            onChange={setTab}
            items={[
              {
                id: 'questions',
                label: t('assess.tabQuestions'),
                content: (
                  <div>
                    <div className="mb-4 flex justify-end">
                      <Button onClick={() => openQuestion(null)}>
                        <Plus className="size-4" aria-hidden />
                        {t('assess.addQuestion')}
                      </Button>
                    </div>
                    {(a.questions ?? []).length === 0 ? (
                      <EmptyState
                        title={t('assess.noQuestions')}
                        description={t('assess.noQuestionsHint')}
                      />
                    ) : (
                      <ol className="grid gap-3">
                        {(a.questions ?? []).map((qq, i) => (
                          <li key={qq.id}>
                            <Card className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-semibold">
                                  <span className="text-muted">{i + 1}.</span> {qq.prompt}
                                </p>
                                <span className="flex shrink-0 gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t('common.edit')}
                                    onClick={() => openQuestion(qq)}
                                  >
                                    <Pencil className="size-4" aria-hidden />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t('common.delete')}
                                    onClick={() => setDelQ(qq)}
                                  >
                                    <Trash2 className="size-4 text-danger-700" aria-hidden />
                                  </Button>
                                </span>
                              </div>
                              <ul className="mt-2 grid gap-1 text-sm">
                                {qq.options.map((o) => (
                                  <li key={o.id} className="flex gap-2">
                                    <span aria-hidden>
                                      {qq.correctOptionIds.includes(o.id) ? '✓' : '○'}
                                    </span>
                                    <span
                                      className={
                                        qq.correctOptionIds.includes(o.id) ? 'font-semibold' : ''
                                      }
                                    >
                                      {o.text}
                                      {qq.correctOptionIds.includes(o.id) && (
                                        <span className="sr-only">
                                          {' '}
                                          ({t('assess.correctAnswer')})
                                        </span>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-sm text-muted">
                                {t(`qtype.${qq.type}`)} · {t('assess.points', { n: qq.points })}
                              </p>
                            </Card>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ),
              },
              { id: 'settings', label: t('assess.tabSettings'), content: <SettingsPanel a={a} /> },
              {
                id: 'attempts',
                label: t('assess.tabAttempts'),
                content: <AttemptsPanel assessmentId={a.id} />,
              },
            ]}
          />
          {qDlg && (
            <QuestionDialog
              key={qDlg.key}
              assessmentId={a.id}
              question={qDlg.q}
              open={qDlg.open}
              onClose={() => setQDlg((p) => (p ? { ...p, open: false } : p))}
            />
          )}
          <ConfirmDialog
            open={!!delQ}
            title={t('assess.deleteQuestionTitle')}
            description={delQ?.prompt}
            confirmLabel={t('common.delete')}
            loading={removeQ.isPending}
            onClose={() => setDelQ(null)}
            onConfirm={() => delQ && removeQ.mutate(delQ.id)}
          />
        </>
      )}
    </QueryBoundary>
  );
}
