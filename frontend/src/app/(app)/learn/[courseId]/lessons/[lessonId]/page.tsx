import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { LessonView } from '@/features/learn/lesson-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('lesson.title'), robots: { index: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return (
    <RequireRole roles={['STUDENT']}>
      <LessonView courseId={courseId} lessonId={lessonId} />
    </RequireRole>
  );
}
