import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { RequireRole } from '@/components/layout/require-role';
import { CourseManage } from '@/features/instructor/manage/course-manage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.myCourses'), robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return (
    <RequireRole roles={['INSTRUCTOR', 'ADMIN']}>
      <CourseManage courseId={courseId} />
    </RequireRole>
  );
}
