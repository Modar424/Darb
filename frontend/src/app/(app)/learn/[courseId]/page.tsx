import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { LearnHome } from '@/features/learn/learn-home';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('learn.courseHome'), robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return (
    <RequireRole roles={['STUDENT']}>
      <LearnHome courseId={courseId} />
    </RequireRole>
  );
}
