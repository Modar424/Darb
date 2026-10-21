import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { CourseDetailView } from '@/features/courses/course-detail';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('course.detail') };
}
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CourseDetailView slug={decodeURIComponent(slug)} />
    </div>
  );
}
