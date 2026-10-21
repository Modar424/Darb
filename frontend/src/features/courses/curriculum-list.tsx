'use client';

import Link from 'next/link';
import { CheckCircle2, ChevronDown, Circle, FileText, Link2, PlayCircle } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import type { Curriculum, CurriculumLesson } from '@/lib/api/types';
import { Badge } from '@/components/ui/primitives';

const ICONS = { TEXT: FileText, VIDEO: PlayCircle, LINK: Link2 } as const;

export function CurriculumList({
  curriculum,
  showProgress,
  lessonHref,
  currentLessonId,
}: {
  curriculum: Curriculum;
  showProgress?: boolean;
  /** When provided, lessons become links (learner view). */
  lessonHref?: (l: CurriculumLesson) => string;
  currentLessonId?: string;
}) {
  const { t, num } = useI18n();
  return (
    <div className="grid gap-3">
      {curriculum.modules.map((m) => {
        const done = m.lessons.filter((l) => l.completed).length;
        return (
          <details
            key={m.id}
            open
            className="group rounded-(--radius-panel) border border-line bg-surface"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
              <span className="min-w-0">
                {m.title}
                {m.description && (
                  <span className="mt-0.5 block text-sm font-normal text-muted">
                    {m.description}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-sm font-normal text-muted">
                {showProgress
                  ? t('curriculum.doneOf', { done: num(done), total: num(m.lessons.length) })
                  : t('course.lessonsCount', { n: num(m.lessons.length) })}
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </span>
            </summary>
            <ul className="border-t border-line">
              {m.lessons.map((l) => {
                const Icon = ICONS[l.contentType];
                const body = (
                  <>
                    {showProgress ? (
                      l.completed ? (
                        <CheckCircle2
                          className="size-5 shrink-0 text-teal-700"
                          aria-label={t('lesson.completed')}
                        />
                      ) : (
                        <Circle
                          className="size-5 shrink-0 text-ink-200"
                          aria-label={t('lesson.notCompleted')}
                        />
                      )
                    ) : (
                      <Icon className="size-5 shrink-0 text-ink-600" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">{l.title}</span>
                    {l.isPreview && <Badge tone="success">{t('lesson.preview')}</Badge>}
                    {l.durationMinutes > 0 && (
                      <span className="shrink-0 text-sm text-muted">
                        {t('common.minutes', { n: num(l.durationMinutes) })}
                      </span>
                    )}
                  </>
                );
                const current = currentLessonId === l.id;
                return (
                  <li key={l.id} className="border-b border-line last:border-b-0">
                    {lessonHref ? (
                      <Link
                        href={lessonHref(l)}
                        aria-current={current ? 'page' : undefined}
                        className={`flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-ink-50 ${current ? 'bg-ink-100 font-semibold' : ''}`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
              {m.lessons.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted">{t('curriculum.noLessons')}</li>
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
