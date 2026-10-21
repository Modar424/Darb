import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { InstructorDashboard } from '@/features/instructor/dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.myCourses'), robots: { index: false } };
}
export default function Page() {
  return (
    <RequireRole roles={['INSTRUCTOR', 'ADMIN']}>
      <InstructorDashboard />
    </RequireRole>
  );
}
