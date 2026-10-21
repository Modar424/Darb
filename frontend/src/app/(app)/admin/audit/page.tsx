import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AdminAudit } from '@/features/admin/audit';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.audit'), robots: { index: false } };
}
export default function Page() {
  return (
    <RequireRole roles={['ADMIN']}>
      <Suspense>
        <AdminAudit />
      </Suspense>
    </RequireRole>
  );
}
