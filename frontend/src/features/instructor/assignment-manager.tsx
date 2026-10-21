'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { safeHttpUrl } from '@/lib/url';
import { toLocalInput } from '@/lib/datetime';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { Alert, Badge, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';
import {
  AssignmentFields,
  assignmentBody,
  assignmentSchema,
  type AssignmentFormInput,
  type AssignmentFormOutput,
} from './manage/assignments-tab';
import type { Assignment, Submission, SubmissionStatus } from '@/lib/api/types';

function SettingsPanel({ a }: { a: Assignment }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AssignmentFormInput, unknown, AssignmentFormOutput>({
    resolver: zodResolver(assignmentSchema),
    values: {
      title: a.title,
      instructions: a.instructions,
      maxPoints: a.maxPoints,
      dueAt: toLocalInput(a.dueAt),
      allowLate: a.allowLate,
    },
  });
  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await assignmentsApi.update(a.id, assignmentBody(v));
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
      <AssignmentFields form={form} />
      <div>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function GradeDialog({
  assignment,
  submission,
  onClose,
}: {
  assignment: Assignment;
  submission: Submission | null;
  onClose: () => void;
}) {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({
    grade: z.coerce.number().min(0, 'val.range').max(assignment.maxPoints, 'val.range'),
    feedback: z.string().trim().max(5000, 'val.tooLong'),
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: { grade: submission?.grade ?? 0, feedback: submission?.feedback ?? '' },
  });
  const { register, handleSubmit, formState } = form;
  const save = handleSubmit(async (v) => {
    if (!submission) return;
    setError(null);
    try {
      await assignmentsApi.grade(submission.id, {
        grade: v.grade,
        ...(v.feedback ? { feedback: v.feedback } : {}),
      });
      await qc.invalidateQueries({ queryKey: ['instructor', 'assignment', assignment.id] });
      toast.success(t('assign.gradeSaved'));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  const link = safeHttpUrl(submission?.linkUrl);
  return (
    <Dialog
      open={!!submission}
      onClose={onClose}
      size="lg"
      dismissible={!formState.isSubmitting}
      title={t('assign.gradeTitle', { name: submission?.student?.fullName ?? '' })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={formState.isSubmitting} onClick={() => void save()}>
            {t('assign.saveGrade')}
          </Button>
        </>
      }
    >
      {submission && (
        <div className="grid gap-4">
          {error && (
            <Alert tone="danger" live>
              {error}
            </Alert>
          )}
          <p className="text-sm text-muted">
            {t('assign.submittedAt', { date: date(submission.submittedAt, true) })}
            {submission.isLate ? ` · ${t('assign.late')}` : ''}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-(--radius-control) bg-ink-50 p-4">
            <p className="prose-lms text-base">{submission.content}</p>
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="ltr-isolate break-all text-ink-700 underline"
            >
              {link}
            </a>
          )}
          <form onSubmit={save} noValidate className="grid gap-4">
            <Input
              label={t('assign.gradeOutOf', { max: assignment.maxPoints })}
              type="number"
              step="0.5"
              min={0}
              max={assignment.maxPoints}
              required
              error={fieldMessage(t, formState.errors.grade)}
              {...register('grade')}
            />
            <Textarea
              label={t('assign.feedback')}
              rows={4}
              error={fieldMessage(t, formState.errors.feedback)}
              {...register('feedback')}
            />
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </div>
      )}
    </Dialog>
  );
}

function SubmissionsPanel({ a }: { a: Assignment }) {
  const { t, date } = useI18n();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SubmissionStatus | ''>('');
  const [grading, setGrading] = useState<Submission | null>(null);
  const q = useQuery({
    queryKey: ['instructor', 'assignment', a.id, 'submissions', status, page],
    queryFn: () =>
      assignmentsApi.submissions(a.id, { page, pageSize: 20, ...(status ? { status } : {}) }),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Select
          label={t('table.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as SubmissionStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('catalog.all')}</option>
          <option value="SUBMITTED">{t('assign.needsGrading')}</option>
          <option value="GRADED">{t('assign.gradedFilter')}</option>
        </Select>
      </div>
      <QueryBoundary query={q}>
        {(p) =>
          p.items.length === 0 ? (
            <EmptyState title={t('assign.noSubmissions')} />
          ) : (
            <>
              <DataTable
                caption={t('assign.submissionsCaption')}
                rows={p.items}
                rowKey={(r) => r.id}
                columns={[
                  {
                    key: 'n',
                    header: t('table.name'),
                    primary: true,
                    cell: (r) => r.student?.fullName ?? '—',
                  },
                  {
                    key: 'd',
                    header: t('table.date'),
                    cell: (r) => (
                      <>
                        {date(r.submittedAt, true)}
                        {r.isLate && (
                          <Badge tone="warning" className="ms-2">
                            {t('assign.late')}
                          </Badge>
                        )}
                      </>
                    ),
                  },
                  {
                    key: 's',
                    header: t('table.status'),
                    cell: (r) =>
                      r.status === 'GRADED' ? (
                        <Badge tone="success">
                          {t('assign.graded', { n: r.grade ?? 0, max: a.maxPoints })}
                        </Badge>
                      ) : (
                        <Badge tone="info">{t('assign.needsGrading')}</Badge>
                      ),
                  },
                  {
                    key: 'a',
                    header: '',
                    cell: (r) => (
                      <Button
                        size="sm"
                        variant={r.status === 'GRADED' ? 'secondary' : 'primary'}
                        onClick={() => setGrading(r)}
                      >
                        {r.status === 'GRADED' ? t('assign.regrade') : t('assign.grade')}
                      </Button>
                    ),
                  },
                ]}
              />
              <Pagination meta={p.meta} onPage={setPage} />
            </>
          )
        }
      </QueryBoundary>
      <GradeDialog
        key={grading?.id ?? 'none'}
        assignment={a}
        submission={grading}
        onClose={() => setGrading(null)}
      />
    </div>
  );
}

export function AssignmentManager({ assignmentId }: { assignmentId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('submissions');
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['instructor', 'assignment', assignmentId],
    queryFn: () => assignmentsApi.get(assignmentId),
  });
  const toggle = useMutation({
    mutationFn: (publish: boolean) =>
      publish ? assignmentsApi.publish(assignmentId) : assignmentsApi.unpublish(assignmentId),
    onSuccess: async (r) => {
      setError(null);
      toast.success(
        r.status === 'PUBLISHED' ? t('assign.publishedToast') : t('assign.unpublishedToast'),
      );
      await qc.invalidateQueries({ queryKey: ['instructor'] });
    },
    onError: (e) => setError(t(errorKey(e))),
  });
  return (
    <QueryBoundary query={q} skeleton={<Skeleton className="h-96" />}>
      {(a) => (
        <>
          <Breadcrumbs
            label={t('common.breadcrumb')}
            items={[
              { label: t('nav.myCourses'), href: '/instructor' },
              { label: t('assign.title'), href: `/instructor/courses/${a.courseId}` },
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
            label={t('assign.sections')}
            value={tab}
            onChange={setTab}
            items={[
              {
                id: 'submissions',
                label: t('assign.tabSubmissions'),
                content: <SubmissionsPanel a={a} />,
              },
              { id: 'settings', label: t('assess.tabSettings'), content: <SettingsPanel a={a} /> },
            ]}
          />
        </>
      )}
    </QueryBoundary>
  );
}
