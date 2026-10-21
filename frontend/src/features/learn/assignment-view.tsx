'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { safeHttpUrl } from '@/lib/url';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';

const schema = z.object({
  content: z.string().trim().min(1, 'val.required').max(20000, 'val.tooLong'),
  linkUrl: z
    .string()
    .trim()
    .max(500, 'val.tooLong')
    .refine((v) => v === '' || safeHttpUrl(v) !== null, 'val.url'),
});
type Values = z.infer<typeof schema>;

export function AssignmentView({
  courseId,
  assignmentId,
}: {
  courseId: string;
  assignmentId: string;
}) {
  const { t, date, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const a = useQuery({
    queryKey: ['learn', courseId, 'assignment', assignmentId],
    queryFn: () => assignmentsApi.get(assignmentId),
  });
  const sub = useQuery({
    queryKey: ['learn', courseId, 'submission', a.data?.mySubmission?.id],
    queryFn: () => assignmentsApi.submission(a.data?.mySubmission?.id as string),
    enabled: !!a.data?.mySubmission?.id,
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', linkUrl: '' },
  });
  const { register, handleSubmit, reset, formState } = form;
  useEffect(() => {
    if (sub.data) reset({ content: sub.data.content, linkUrl: sub.data.linkUrl ?? '' });
  }, [sub.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      assignmentsApi.submit(assignmentId, {
        content: v.content,
        ...(v.linkUrl ? { linkUrl: v.linkUrl } : {}),
      }),
    onSuccess: () => {
      toast.success(t('assign.savedToast'));
      void qc.invalidateQueries({ queryKey: ['learn', courseId] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });

  return (
    <QueryBoundary query={a} skeleton={<Skeleton className="h-80" />}>
      {(x) => {
        const graded = sub.data?.status === 'GRADED';
        const closed = !!x.dueAt && new Date(x.dueAt) < new Date() && !x.allowLate && !sub.data;
        return (
          <div>
            <Breadcrumbs
              label={t('common.breadcrumb')}
              items={[
                { label: t('nav.myDashboard'), href: '/student' },
                { label: t('learn.courseHome'), href: `/learn/${courseId}` },
                { label: x.title },
              ]}
            />
            <h1 className="text-2xl font-bold md:text-3xl">{x.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {t('assign.due', { date: x.dueAt ? date(x.dueAt, true) : t('assign.noDue') })} ·{' '}
              {t('assign.points', { n: num(x.maxPoints) })}
              {x.allowLate ? ` · ${t('assign.lateAllowed')}` : ''}
            </p>
            <Card className="mt-5 p-5">
              <p className="prose-lms">{x.instructions}</p>
            </Card>

            {sub.data && (
              <Card className="mt-6 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{t('assign.yourSubmission')}</h2>
                  {graded ? (
                    <Badge tone="success">
                      {t('assign.graded', { n: sub.data.grade ?? 0, max: x.maxPoints })}
                    </Badge>
                  ) : (
                    <Badge tone="info">{t('assign.submitted')}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {t('assign.submittedAt', { date: date(sub.data.submittedAt, true) })}
                  {sub.data.isLate ? ` · ${t('assign.late')}` : ''}
                </p>
                {graded && (
                  <div className="mt-4 rounded-(--radius-control) bg-ink-50 p-4">
                    <p className="font-semibold">{t('assign.feedback')}</p>
                    <p className="prose-lms mt-1">{sub.data.feedback || t('assign.noFeedback')}</p>
                  </div>
                )}
              </Card>
            )}

            {graded ? (
              <Alert tone="info" className="mt-6">
                {t('err.gradedLocked')}
              </Alert>
            ) : closed ? (
              <Alert tone="danger" className="mt-6">
                {t('err.deadlinePassed')}
              </Alert>
            ) : (
              <form
                onSubmit={handleSubmit((v) => save.mutate(v))}
                noValidate
                className="mt-6 grid gap-4"
              >
                <h2 className="text-lg font-semibold">
                  {sub.data ? t('assign.editSubmission') : t('assign.newSubmission')}
                </h2>
                <Textarea
                  label={t('assign.answer')}
                  rows={10}
                  required
                  error={fieldMessage(t, formState.errors.content)}
                  {...register('content')}
                />
                <Input
                  label={t('assign.link')}
                  hint={t('assign.linkHint')}
                  dir="ltr"
                  type="url"
                  error={fieldMessage(t, formState.errors.linkUrl)}
                  {...register('linkUrl')}
                />
                <div>
                  <Button type="submit" size="lg" variant="accent" loading={save.isPending}>
                    {sub.data ? t('assign.update') : t('assign.submit')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}
