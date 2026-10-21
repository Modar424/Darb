'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Link2,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { coursesApi, structureApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { safeHttpUrl } from '@/lib/url';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';
import type { CurriculumLesson, CurriculumModule } from '@/lib/api/types';

const moduleSchema = z.object({
  title: z.string().trim().min(2, 'val.titleLength').max(160, 'val.titleLength'),
  description: z.string().trim().max(1000, 'val.tooLong'),
});
const lessonSchema = z
  .object({
    title: z.string().trim().min(2, 'val.titleLength').max(160, 'val.titleLength'),
    contentType: z.enum(['TEXT', 'VIDEO', 'LINK']),
    content: z.string().trim().max(100000, 'val.tooLong'),
    contentUrl: z.string().trim().max(500, 'val.tooLong'),
    durationMinutes: z.coerce
      .number()
      .int('val.integer')
      .min(0, 'val.range')
      .max(1000, 'val.range'),
    isPreview: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.contentType === 'TEXT' && !v.content)
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'val.required' });
    if (v.contentType !== 'TEXT' && !safeHttpUrl(v.contentUrl))
      ctx.addIssue({ code: 'custom', path: ['contentUrl'], message: 'val.url' });
  });
type LessonValues = z.input<typeof lessonSchema>;

function ModuleDialog({
  courseId,
  module,
  onClose,
}: {
  courseId: string;
  module: CurriculumModule | 'new' | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const editing = module && module !== 'new' ? module : null;
  const form = useForm<z.infer<typeof moduleSchema>>({
    resolver: zodResolver(moduleSchema),
    values: { title: editing?.title ?? '', description: editing?.description ?? '' },
  });
  const { register, handleSubmit, formState } = form;
  const save = handleSubmit(async (v) => {
    setError(null);
    try {
      const body = { title: v.title, ...(v.description ? { description: v.description } : {}) };
      if (editing) await structureApi.updateModule(editing.id, body);
      else await structureApi.createModule(courseId, body);
      await qc.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });
      toast.success(t('common.saved'));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <Dialog
      open={!!module}
      onClose={onClose}
      dismissible={!formState.isSubmitting}
      title={editing ? t('curriculum.editModule') : t('curriculum.addModule')}
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
        <Input
          label={t('curriculum.moduleTitle')}
          required
          error={fieldMessage(t, formState.errors.title)}
          {...register('title')}
        />
        <Textarea
          label={t('curriculum.moduleDescription')}
          rows={3}
          error={fieldMessage(t, formState.errors.description)}
          {...register('description')}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

type LessonTarget = { moduleId: string; lessonId?: string } | null;
function LessonDialog({
  courseId,
  target,
  onClose,
}: {
  courseId: string;
  target: LessonTarget;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const existing = useQuery({
    queryKey: ['instructor', 'lesson', target?.lessonId],
    queryFn: () => structureApi.getLesson(target?.lessonId as string),
    enabled: !!target?.lessonId,
  });
  const form = useForm<LessonValues, unknown, z.output<typeof lessonSchema>>({
    resolver: zodResolver(lessonSchema),
    values: {
      title: existing.data?.title ?? '',
      contentType: existing.data?.contentType ?? 'TEXT',
      content: existing.data?.content ?? '',
      contentUrl: existing.data?.contentUrl ?? '',
      durationMinutes: existing.data?.durationMinutes ?? 0,
      isPreview: existing.data?.isPreview ?? false,
    },
  });
  const { register, handleSubmit, formState, control } = form;
  const type = useWatch({ control, name: 'contentType' });
  const save = handleSubmit(async (v) => {
    setError(null);
    const body = {
      title: v.title,
      contentType: v.contentType,
      durationMinutes: v.durationMinutes,
      isPreview: v.isPreview,
      ...(v.contentType === 'TEXT'
        ? { content: v.content }
        : { contentUrl: v.contentUrl, ...(v.content ? { content: v.content } : {}) }),
    };
    try {
      if (target?.lessonId) await structureApi.updateLesson(target.lessonId, body);
      else await structureApi.createLesson(target?.moduleId as string, body);
      await qc.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });
      toast.success(t('common.saved'));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  const loading = !!target?.lessonId && existing.isPending;
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      size="lg"
      dismissible={!formState.isSubmitting}
      title={target?.lessonId ? t('curriculum.editLesson') : t('curriculum.addLesson')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={formState.isSubmitting} disabled={loading} onClick={() => void save()}>
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
      {existing.isError ? (
        <Alert tone="danger" live>
          {t(errorKey(existing.error))}
        </Alert>
      ) : (
        <form onSubmit={save} noValidate className="grid gap-4" aria-busy={loading}>
          <Input
            label={t('curriculum.lessonTitle')}
            required
            error={fieldMessage(t, formState.errors.title)}
            {...register('title')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('curriculum.contentType')} {...register('contentType')}>
              <option value="TEXT">{t('lessonType.TEXT')}</option>
              <option value="VIDEO">{t('lessonType.VIDEO')}</option>
              <option value="LINK">{t('lessonType.LINK')}</option>
            </Select>
            <Input
              label={t('curriculum.duration')}
              type="number"
              min={0}
              max={1000}
              error={fieldMessage(t, formState.errors.durationMinutes)}
              {...register('durationMinutes')}
            />
          </div>
          {type !== 'TEXT' && (
            <Input
              label={t('curriculum.contentUrl')}
              type="url"
              dir="ltr"
              required
              hint={t('curriculum.urlHint')}
              error={fieldMessage(t, formState.errors.contentUrl)}
              {...register('contentUrl')}
            />
          )}
          <Textarea
            label={type === 'TEXT' ? t('curriculum.contentText') : t('curriculum.contentNote')}
            rows={8}
            required={type === 'TEXT'}
            error={fieldMessage(t, formState.errors.content)}
            {...register('content')}
          />
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-ink-900" {...register('isPreview')} />
            {t('curriculum.isPreview')}
          </label>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Dialog>
  );
}

const typeIcon = { TEXT: FileText, VIDEO: PlayCircle, LINK: Link2 } as const;

export function CurriculumTab({ courseId }: { courseId: string }) {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['instructor', 'course', courseId, 'curriculum'];
  const q = useQuery({ queryKey: key, queryFn: () => coursesApi.curriculum(courseId) });
  const [moduleDlg, setModuleDlg] = useState<CurriculumModule | 'new' | null>(null);
  const [lessonDlg, setLessonDlg] = useState<LessonTarget>(null);
  const [del, setDel] = useState<{ kind: 'module' | 'lesson'; id: string; title: string } | null>(
    null,
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });
  const onErr = (e: unknown) => toast.error(t(errorKey(e)));
  const reorderModules = useMutation({
    mutationFn: (ids: string[]) => structureApi.reorderModules(courseId, ids),
    onSuccess: refresh,
    onError: onErr,
  });
  const reorderLessons = useMutation({
    mutationFn: (v: { moduleId: string; ids: string[] }) =>
      structureApi.reorderLessons(v.moduleId, v.ids),
    onSuccess: refresh,
    onError: onErr,
  });
  const remove = useMutation({
    mutationFn: (d: NonNullable<typeof del>) =>
      d.kind === 'module' ? structureApi.removeModule(d.id) : structureApi.removeLesson(d.id),
    onSuccess: async () => {
      setDel(null);
      toast.success(t('common.deleted'));
      await refresh();
    },
    onError: (e) => {
      setDel(null);
      onErr(e);
    },
  });
  const move = <T extends { id: string }>(list: T[], i: number, dir: -1 | 1) => {
    const ids = list.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return null;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    return ids;
  };
  const busy = reorderModules.isPending || reorderLessons.isPending;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModuleDlg('new')}>
          <Plus className="size-4" aria-hidden />
          {t('curriculum.addModule')}
        </Button>
      </div>
      <QueryBoundary query={q}>
        {(cur) =>
          cur.modules.length === 0 ? (
            <EmptyState
              title={t('curriculum.empty')}
              description={t('curriculum.emptyHint')}
              action={
                <Button onClick={() => setModuleDlg('new')}>{t('curriculum.addModule')}</Button>
              }
            />
          ) : (
            <ol className="grid gap-4">
              {cur.modules.map((m, mi) => (
                <li key={m.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
                      <h3 className="min-w-0 text-lg font-semibold">{m.title}</h3>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy || mi === 0}
                          aria-label={t('common.moveUp')}
                          onClick={() => {
                            const ids = move(cur.modules, mi, -1);
                            if (ids) reorderModules.mutate(ids);
                          }}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy || mi === cur.modules.length - 1}
                          aria-label={t('common.moveDown')}
                          onClick={() => {
                            const ids = move(cur.modules, mi, 1);
                            if (ids) reorderModules.mutate(ids);
                          }}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('common.edit')}
                          onClick={() => setModuleDlg(m)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('common.delete')}
                          onClick={() => setDel({ kind: 'module', id: m.id, title: m.title })}
                        >
                          <Trash2 className="size-4 text-danger-700" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <ul>
                      {m.lessons.map((l: CurriculumLesson, li) => {
                        const Icon = typeIcon[l.contentType];
                        return (
                          <li
                            key={l.id}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 last:border-b-0"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="size-4 shrink-0 text-ink-600" aria-hidden />
                              {l.title}
                              {l.isPreview && <Badge tone="success">{t('lesson.preview')}</Badge>}
                              {l.durationMinutes > 0 && (
                                <span className="text-sm text-muted">
                                  {t('common.minutes', { n: num(l.durationMinutes) })}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy || li === 0}
                                aria-label={t('common.moveUp')}
                                onClick={() => {
                                  const ids = move(m.lessons, li, -1);
                                  if (ids) reorderLessons.mutate({ moduleId: m.id, ids });
                                }}
                              >
                                <ArrowUp className="size-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy || li === m.lessons.length - 1}
                                aria-label={t('common.moveDown')}
                                onClick={() => {
                                  const ids = move(m.lessons, li, 1);
                                  if (ids) reorderLessons.mutate({ moduleId: m.id, ids });
                                }}
                              >
                                <ArrowDown className="size-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t('common.edit')}
                                onClick={() => setLessonDlg({ moduleId: m.id, lessonId: l.id })}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t('common.delete')}
                                onClick={() => setDel({ kind: 'lesson', id: l.id, title: l.title })}
                              >
                                <Trash2 className="size-4 text-danger-700" aria-hidden />
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="p-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setLessonDlg({ moduleId: m.id })}
                      >
                        <Plus className="size-4" aria-hidden />
                        {t('curriculum.addLesson')}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )
        }
      </QueryBoundary>
      <ModuleDialog courseId={courseId} module={moduleDlg} onClose={() => setModuleDlg(null)} />
      <LessonDialog courseId={courseId} target={lessonDlg} onClose={() => setLessonDlg(null)} />
      <ConfirmDialog
        open={!!del}
        title={
          del?.kind === 'module'
            ? t('curriculum.deleteModuleTitle')
            : t('curriculum.deleteLessonTitle')
        }
        description={del ? t('common.deleteNamed', { name: del.title }) : undefined}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onClose={() => setDel(null)}
        onConfirm={() => del && remove.mutate(del)}
      />
    </div>
  );
}
