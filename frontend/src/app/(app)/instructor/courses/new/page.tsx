import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { NewCourse } from '@/features/instructor/new-course';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.newCourse'), robots: { index: false } };
}
export default function Page() {
  return (
    <RequireRole roles={['INSTRUCTOR', 'ADMIN']}>
      <NewCourse />
    </RequireRole>
  );
}
