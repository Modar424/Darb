import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AssessmentEditor } from '@/features/instructor/assessment-editor';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('assess.title'), robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  return (
    <RequireRole roles={['INSTRUCTOR', 'ADMIN']}>
      <AssessmentEditor assessmentId={assessmentId} />
    </RequireRole>
  );
}
