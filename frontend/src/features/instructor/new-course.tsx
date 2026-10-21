'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { coursesApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { CourseForm } from './course-form';

export function NewCourse() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Breadcrumbs
        label={t('common.breadcrumb')}
        items={[{ label: t('nav.myCourses'), href: '/instructor' }, { label: t('nav.newCourse') }]}
      />
      <PageHeader title={t('nav.newCourse')} description={t('instructor.newText')} />
      {error && (
        <Alert tone="danger" live className="mb-4 max-w-2xl">
          {error}
        </Alert>
      )}
      <CourseForm
        submitLabel={t('instructor.createCourse')}
        onSubmit={async (v) => {
          setError(null);
          try {
            const c = await coursesApi.create(v);
            void qc.invalidateQueries({ queryKey: ['instructor'] });
            toast.success(t('instructor.created'));
            router.push(`/instructor/courses/${c.id}`);
          } catch (e) {
            setError(t(errorKey(e)));
          }
        }}
      />
    </>
  );
}
