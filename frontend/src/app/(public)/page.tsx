import type { Metadata } from 'next';
import { ClipboardCheck, GraduationCap, LineChart, ShieldCheck } from 'lucide-react';
import { getT } from '@/i18n/server';
import { LinkButton } from '@/components/ui/button';
import { HeroVisual } from '@/components/three/hero-visual';
import { LatestCourses } from '@/features/courses/latest-courses';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: { absolute: t('meta.title') }, description: t('meta.description') };
}

export default async function HomePage() {
  const { t } = await getT();
  const steps = [
    { title: t('home.step1Title'), text: t('home.step1Text') },
    { title: t('home.step2Title'), text: t('home.step2Text') },
    { title: t('home.step3Title'), text: t('home.step3Text') },
  ];
  const roles = [
    { icon: GraduationCap, title: t('home.roleStudent'), text: t('home.roleStudentText') },
    { icon: ClipboardCheck, title: t('home.roleInstructor'), text: t('home.roleInstructorText') },
    { icon: ShieldCheck, title: t('home.roleAdmin'), text: t('home.roleAdminText') },
  ];
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-10 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight md:text-5xl md:leading-tight">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t('home.heroText')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/courses" size="lg">
              {t('home.ctaBrowse')}
            </LinkButton>
            <LinkButton href="/register" size="lg" variant="accent">
              {t('home.ctaJoin')}
            </LinkButton>
          </div>
        </div>
        <div className="flex justify-center">
          <HeroVisual />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="latest">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-2xl font-bold">
            {t('home.latest')}
          </h2>
          <LinkButton href="/courses" variant="ghost" size="sm">
            {t('home.allCourses')}
          </LinkButton>
        </div>
        <LatestCourses />
      </section>

      <section
        id="how"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12"
        aria-labelledby="how-title"
      >
        <h2 id="how-title" className="mb-6 text-2xl font-bold">
          {t('home.howTitle')}
        </h2>
        {/* A real sequence, so numbered steps are meaningful here. */}
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-4 rounded-(--radius-panel) border border-line bg-surface p-5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="roles-title">
        <h2 id="roles-title" className="mb-6 text-2xl font-bold">
          {t('home.rolesTitle')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.title} className="rounded-(--radius-panel) bg-ink-900 p-6 text-ink-100">
              <r.icon className="size-7 text-saffron-500" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold text-white">{r.title}</h3>
              <p className="mt-1">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-muted">
          <LineChart className="size-5" aria-hidden />
          {t('home.progressNote')}
        </p>
      </section>
    </>
  );
}
