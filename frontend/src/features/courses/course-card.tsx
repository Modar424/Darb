'use client';

import Link from 'next/link';
import { BookOpen, Users } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { Badge, Card } from '@/components/ui/primitives';
import type { CourseLevel, CourseSummary } from '@/lib/api/types';

const LEVEL_KEYS = {
  BEGINNER: 'level.BEGINNER',
  INTERMEDIATE: 'level.INTERMEDIATE',
  ADVANCED: 'level.ADVANCED',
} as const satisfies Record<CourseLevel, string>;
export const levelKey = (l: CourseLevel) => LEVEL_KEYS[l];

export function CourseCard({
  course,
  headingLevel: Heading = 'h3',
}: {
  course: CourseSummary;
  /** Use h2 when the card list sits directly under the page's h1 (keeps heading order valid). */
  headingLevel?: 'h2' | 'h3';
}) {
  const { t, num } = useI18n();
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-(--shadow-pop)">
      <Link
        href={`/courses/${course.slug}`}
        className="flex h-full flex-col gap-3 rounded-(--radius-panel) p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{t(levelKey(course.level))}</Badge>
          <Badge>{course.language === 'ar' ? 'العربية' : 'English'}</Badge>
        </div>
        <Heading className="text-lg font-semibold">{course.title}</Heading>
        <p className="line-clamp-3 text-muted">{course.summary}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-muted">
          <span>{course.instructor?.fullName}</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-4" aria-hidden />
              {t('course.lessonsCount', { n: num(course.lessonCount) })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" aria-hidden />
              {num(course.learnerCount)}
            </span>
          </span>
        </div>
      </Link>
    </Card>
  );
}
