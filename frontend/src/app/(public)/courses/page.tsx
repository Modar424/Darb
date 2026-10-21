import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/i18n/server';
import { PageHeader } from '@/components/ui/primitives';
import { Catalog } from '@/features/courses/catalog';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.courses'), description: t('catalog.subtitle') };
}
export default async function CoursesPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t('nav.courses')} description={t('catalog.subtitle')} />
      <Suspense>
        <Catalog />
      </Suspense>
    </div>
  );
}
