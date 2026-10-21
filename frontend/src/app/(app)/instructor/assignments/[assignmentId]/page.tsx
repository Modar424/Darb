import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { AssignmentManager } from '@/features/instructor/assignment-manager';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('assign.title'), robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return (
    <RequireRole roles={['INSTRUCTOR', 'ADMIN']}>
      <AssignmentManager assignmentId={assignmentId} />
    </RequireRole>
  );
}
