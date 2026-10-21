import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AttemptView } from '@/features/learn/attempt-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('assess.attemptTitle'), robots: { index: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; attemptId: string }>;
}) {
  const { courseId, attemptId } = await params;
  return (
    <RequireRole roles={['STUDENT']}>
      <AttemptView courseId={courseId} attemptId={attemptId} />
    </RequireRole>
  );
}
