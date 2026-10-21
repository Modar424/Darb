'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileEdit, Plus } from 'lucide-react';
import { assignmentsApi, type AssignmentInput } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { fromLocalInput } from '@/lib/datetime';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';

export const assignmentSchema = z.object({
  title: z.string().trim().min(2, 'val.titleLength').max(160, 'val.titleLength'),
  instructions: z.string().trim().min(1, 'val.required').max(10000, 'val.tooLong'),
  maxPoints: z.coerce.number().int('val.integer').min(1, 'val.range').max(1000, 'val.range'),
  dueAt: z.string(),
  allowLate: z.boolean(),
});
export type AssignmentFormInput = z.input<typeof assignmentSchema>;
export type AssignmentFormOutput = z.output<typeof assignmentSchema>;
export const assignmentBody = (v: AssignmentFormOutput): AssignmentInput => ({
  title: v.title,
  instructions: v.instructions,
  maxPoints: v.maxPoints,
  allowLate: v.allowLate,
  ...(fromLocalInput(v.dueAt) ? { dueAt: fromLocalInput(v.dueAt) } : {}),
});

export function AssignmentFields({
  form,
}: {
  form: ReturnType<typeof useForm<AssignmentFormInput, unknown, AssignmentFormOutput>>;
}) {
  const { t } = useI18n();
  const { register, formState } = form;
  const e = formState.errors;
  return (
    <div className="grid gap-4">
      <Input
        label={t('assign.fTitle')}
        required
        error={fieldMessage(t, e.title)}
        {...register('title')}
      />
      <Textarea
        label={t('assign.fInstructions')}
        rows={6}
        required
        error={fieldMessage(t, e.instructions)}
        {...register('instructions')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('assign.fMaxPoints')}
          type="number"
          min={1}
          max={1000}
          required
          error={fieldMessage(t, e.maxPoints)}
          {...register('maxPoints')}
        />
        <Input label={t('assign.fDueAt')} type="datetime-local" {...register('dueAt')} />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-ink-900" {...register('allowLate')} />
        {t('assign.fAllowLate')}
      </label>
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
  const form = useForm<AssignmentFormInput, unknown, AssignmentFormOutput>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { title: '', instructions: '', maxPoints: 100, dueAt: '', allowLate: false },
  });
  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await assignmentsApi.create(courseId, assignmentBody(v));
      await qc.invalidateQueries({ queryKey: ['instructor', 'course', courseId, 'assignments'] });
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
      title={t('assign.create')}
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
        <AssignmentFields form={form} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

export function AssignmentsTab({ courseId }: { courseId: string }) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['instructor', 'course', courseId, 'assignments'],
    queryFn: () => assignmentsApi.list(courseId, { pageSize: 50 }),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t('assign.create')}
        </Button>
      </div>
      <QueryBoundary query={q}>
        {(p) =>
          p.items.length === 0 ? (
            <EmptyState
              icon={<FileEdit className="size-10" />}
              title={t('assign.emptyStaffTitle')}
              description={t('assign.emptyStaffText')}
            />
          ) : (
            <ul className="grid gap-3">
              {p.items.map((a) => (
                <li key={a.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <Link
                        href={`/instructor/assignments/${a.id}`}
                        className="text-lg font-semibold underline-offset-4 hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {t('assign.due', {
                          date: a.dueAt ? date(a.dueAt, true) : t('assign.noDue'),
                        })}{' '}
                        · {t('assign.points', { n: a.maxPoints })}
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
