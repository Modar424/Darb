'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import { assessmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { fromLocalInput } from '@/lib/datetime';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';

const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || Number.isNaN(v) ? undefined : v),
    z.coerce.number().int('val.integer').min(min, 'val.range').max(max, 'val.range').optional(),
  );

export const assessmentSchema = z.object({
  title: z.string().trim().min(2, 'val.titleLength').max(160, 'val.titleLength'),
  instructions: z.string().trim().max(5000, 'val.tooLong'),
  timeLimitMinutes: optInt(1, 600),
  maxAttempts: z.coerce.number().int('val.integer').min(1, 'val.range').max(20, 'val.range'),
  passingPercent: z.coerce.number().int('val.integer').min(0, 'val.range').max(100, 'val.range'),
  availableFrom: z.string(),
  dueAt: z.string(),
  reviewPolicy: z.enum(['AFTER_SUBMISSION', 'NEVER']),
});
export type AssessmentFormInput = z.input<typeof assessmentSchema>;
export type AssessmentFormOutput = z.output<typeof assessmentSchema>;

export function assessmentBody(v: AssessmentFormOutput) {
  return {
    title: v.title,
    ...(v.instructions ? { instructions: v.instructions } : {}),
    ...(v.timeLimitMinutes ? { timeLimitMinutes: v.timeLimitMinutes } : {}),
    maxAttempts: v.maxAttempts,
    passingPercent: v.passingPercent,
    reviewPolicy: v.reviewPolicy,
    ...(fromLocalInput(v.availableFrom) ? { availableFrom: fromLocalInput(v.availableFrom) } : {}),
    ...(fromLocalInput(v.dueAt) ? { dueAt: fromLocalInput(v.dueAt) } : {}),
  };
}

export function AssessmentFields({
  form,
}: {
  form: ReturnType<typeof useForm<AssessmentFormInput, unknown, AssessmentFormOutput>>;
}) {
  const { t } = useI18n();
  const { register, formState } = form;
  const e = formState.errors;
  return (
    <div className="grid gap-4">
      <Input
        label={t('assess.fTitle')}
        required
        error={fieldMessage(t, e.title)}
        {...register('title')}
      />
      <Textarea
        label={t('assess.fInstructions')}
        rows={3}
        error={fieldMessage(t, e.instructions)}
        {...register('instructions')}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t('assess.fTimeLimit')}
          type="number"
          min={1}
          max={600}
          hint={t('assess.fTimeLimitHint')}
          error={fieldMessage(t, e.timeLimitMinutes)}
          {...register('timeLimitMinutes')}
        />
        <Input
          label={t('assess.fMaxAttempts')}
          type="number"
          min={1}
          max={20}
          required
          error={fieldMessage(t, e.maxAttempts)}
          {...register('maxAttempts')}
        />
        <Input
          label={t('assess.fPassing')}
          type="number"
          min={0}
          max={100}
          required
          error={fieldMessage(t, e.passingPercent)}
          {...register('passingPercent')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('assess.fAvailableFrom')}
          type="datetime-local"
          {...register('availableFrom')}
        />
        <Input label={t('assess.fDueAt')} type="datetime-local" {...register('dueAt')} />
      </div>
      <Select label={t('assess.fReview')} {...register('reviewPolicy')}>
        <option value="AFTER_SUBMISSION">{t('assess.reviewAfter')}</option>
        <option value="NEVER">{t('assess.reviewNever')}</option>
      </Select>
    </div>
  );
}

function CreateDialog({
  courseId,
  open,
  onClose,
}: {
  courseId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AssessmentFormInput, unknown, AssessmentFormOutput>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      title: '',
      instructions: '',
      timeLimitMinutes: undefined,
      maxAttempts: 1,
      passingPercent: 60,
      availableFrom: '',
      dueAt: '',
      reviewPolicy: 'AFTER_SUBMISSION',
    },
  });
  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await assessmentsApi.create(courseId, assessmentBody(v));
      await qc.invalidateQueries({ queryKey: ['instructor', 'course', courseId, 'assessments'] });
      toast.success(t('common.saved'));
      form.reset();
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!form.formState.isSubmitting}
      title={t('assess.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={form.formState.isSubmitting} onClick={() => void save()}>
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
      <form onSubmit={save} noValidate>
        <AssessmentFields form={form} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

export function AssessmentsTab({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['instructor', 'course', courseId, 'assessments'],
    queryFn: () => assessmentsApi.list(courseId, { pageSize: 50 }),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t('assess.create')}
        </Button>
      </div>
      <QueryBoundary query={q}>
        {(p) =>
          p.items.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-10" />}
              title={t('assess.emptyStaffTitle')}
              description={t('assess.emptyStaffText')}
            />
          ) : (
            <ul className="grid gap-3">
              {p.items.map((a) => (
                <li key={a.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <Link
                        href={`/instructor/assessments/${a.id}`}
                        className="text-lg font-semibold underline-offset-4 hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {t('assess.questionsCount', { n: a.questionCount ?? 0 })} ·{' '}
                        {t('assess.passingLine', { n: a.passingPercent })}
                      </p>
                    </div>
                    <Badge tone={a.status === 'PUBLISHED' ? 'success' : 'warning'}>
                      {t(`publish.${a.status}`)}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
      <CreateDialog courseId={courseId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
