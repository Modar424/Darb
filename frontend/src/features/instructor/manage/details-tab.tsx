'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { CourseForm } from '../course-form';
import type { CourseDetail } from '@/lib/api/types';

type Action = 'publish' | 'unpublish' | 'archive' | 'delete';

export function DetailsTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);

  const run = useMutation({
    mutationFn: async (a: Action): Promise<void> => {
      if (a === 'publish') await coursesApi.publish(course.id);
      else if (a === 'unpublish') await coursesApi.unpublish(course.id);
      else if (a === 'archive') await coursesApi.archive(course.id);
      else await coursesApi.remove(course.id);
    },
    onSuccess: async (_r, a) => {
      setConfirm(null);
      toast.success(t(`course.done.${a}`));
      await qc.invalidateQueries({ queryKey: ['instructor'] });
      await qc.invalidateQueries({ queryKey: ['course'] });
      if (a === 'delete') router.replace('/instructor');
    },
    onError: (e) => {
      setConfirm(null);
      setError(t(errorKey(e)));
    },
  });

  const s = course.status;
  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold">{t('course.lifecycle')}</h2>
        <p className="mb-4 text-sm text-muted">{t(`course.lifecycleHelp.${s}`)}</p>
        {error && (
          <Alert tone="danger" live className="mb-3">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {s === 'DRAFT' && (
            <Button
              variant="accent"
              onClick={() => {
                setError(null);
                run.mutate('publish');
              }}
              loading={run.isPending && run.variables === 'publish'}
            >
              {t('course.publish')}
            </Button>
          )}
          {s === 'PUBLISHED' && (
            <Button variant="secondary" onClick={() => setConfirm('unpublish')}>
              {t('course.unpublish')}
            </Button>
          )}
          {s === 'PUBLISHED' && (
            <Button variant="secondary" onClick={() => setConfirm('archive')}>
              {t('course.archive')}
            </Button>
          )}
          {s === 'DRAFT' && (
            <Button variant="danger" onClick={() => setConfirm('delete')}>
              {t('course.delete')}
            </Button>
          )}
        </div>
      </Card>
      <CourseForm
        course={course}
        submitLabel={t('common.save')}
        disabled={s === 'ARCHIVED'}
        onSubmit={async (v) => {
          setError(null);
          try {
            await coursesApi.update(course.id, v);
            await qc.invalidateQueries({ queryKey: ['instructor'] });
            await qc.invalidateQueries({ queryKey: ['course'] });
            toast.success(t('common.saved'));
          } catch (e) {
            setError(t(errorKey(e)));
          }
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm ? t(`course.confirm.${confirm}.title`) : ''}
        description={confirm ? t(`course.confirm.${confirm}.text`) : undefined}
        confirmLabel={confirm ? t(`course.${confirm}`) : ''}
        danger={confirm === 'delete' || confirm === 'archive'}
        loading={run.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && run.mutate(confirm)}
      />
    </div>
  );
}
