import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { StudentDashboard } from '@/features/student/dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.myDashboard'), robots: { index: false } };
}
export default function Page() {
  return (
    <RequireRole roles={['STUDENT']}>
      <StudentDashboard />
    </RequireRole>
  );
}
