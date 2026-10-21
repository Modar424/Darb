import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AssignmentView } from '@/features/learn/assignment-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('assign.title'), robots: { index: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  return (
    <RequireRole roles={['STUDENT']}>
      <AssignmentView courseId={courseId} assignmentId={assignmentId} />
    </RequireRole>
  );
}
