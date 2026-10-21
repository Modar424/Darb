import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AdminOverview } from '@/features/admin/overview';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.overview'), robots: { index: false } };
}
export default function Page() {
  return (
    <RequireRole roles={['ADMIN']}>
      <Suspense>
        <AdminOverview />
      </Suspense>
    </RequireRole>
  );
}
