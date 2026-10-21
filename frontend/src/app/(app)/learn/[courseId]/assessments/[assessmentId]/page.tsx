import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AssessmentIntro } from '@/features/learn/assessment-intro';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('assess.title'), robots: { index: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; assessmentId: string }>;
}) {
  const { courseId, assessmentId } = await params;
  return (
    <RequireRole roles={['STUDENT']}>
      <AssessmentIntro courseId={courseId} assessmentId={assessmentId} />
    </RequireRole>
  );
}
