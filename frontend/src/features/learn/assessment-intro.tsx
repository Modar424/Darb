'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';

export function AssessmentIntro({
  courseId,
  assessmentId,
}: {
  courseId: string;
  assessmentId: string;
}) {
  const { t, date, pct, num } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const a = useQuery({
    queryKey: ['learn', courseId, 'assessment', assessmentId],
    queryFn: () => assessmentsApi.get(assessmentId),
  });
  const attempts = useQuery({
    queryKey: ['learn', courseId, 'attempts', assessmentId],
    queryFn: () => assessmentsApi.attempts(assessmentId, { pageSize: 50 }),
  });

  const start = useMutation({
    mutationFn: () => assessmentsApi.start(assessmentId),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['learn', courseId] });
      router.push(`/learn/${courseId}/attempts/${r.attempt.id}`);
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });

  return (
    <QueryBoundary query={a} skeleton={<Skeleton className="h-64" />}>
      {(x) => {
        const inProgress = attempts.data?.items.find((i) => i.status === 'IN_PROGRESS');
        const remaining =
          x.attemptsRemaining ?? Math.max(0, x.maxAttempts - (attempts.data?.items.length ?? 0));
        return (
          <div>
            <Breadcrumbs
              label={t('common.breadcrumb')}
              items={[
                { label: t('nav.myDashboard'), href: '/student' },
                { label: t('learn.courseHome'), href: `/learn/${courseId}` },
                { label: x.title },
              ]}
            />
            <h1 className="text-2xl font-bold md:text-3xl">{x.title}</h1>
            {x.instructions && <p className="prose-lms mt-3 text-muted">{x.instructions}</p>}
            <Card className="mt-5 p-5">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted">{t('assess.questions')}</dt>
                  <dd className="font-semibold">{num(x.questionCount ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t('assess.passing')}</dt>
                  <dd className="font-semibold">{pct(x.passingPercent)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t('assess.timeLimit')}</dt>
                  <dd className="font-semibold">
                    {x.timeLimitMinutes
                      ? t('common.minutes', { n: num(x.timeLimitMinutes) })
                      : t('assess.noLimit')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t('assess.attemptsLeft')}</dt>
                  <dd className="font-semibold">
                    {num(remaining)} / {num(x.maxAttempts)}
                  </dd>
                </div>
              </dl>
              {x.dueAt && (
                <p className="mt-3 text-sm text-muted">
                  {t('assess.closes', { date: date(x.dueAt, true) })}
                </p>
              )}
              {x.timeLimitMinutes && (
                <Alert tone="warning" className="mt-4">
                  {t('assess.timerWarning')}
                </Alert>
              )}
              <div className="mt-5">
                {inProgress ? (
                  <LinkButton
                    href={`/learn/${courseId}/attempts/${inProgress.id}`}
                    variant="accent"
                    size="lg"
                  >
                    {t('assess.resume')}
                  </LinkButton>
                ) : remaining > 0 ? (
                  <Button
                    size="lg"
                    variant="accent"
                    loading={start.isPending}
                    onClick={() => start.mutate()}
                  >
                    {t('assess.start')}
                  </Button>
                ) : (
                  <Alert tone="info">{t('err.noAttempts')}</Alert>
                )}
              </div>
            </Card>
            <section className="mt-8" aria-labelledby="att">
              <h2 id="att" className="mb-3 text-xl font-semibold">
                {t('assess.myAttempts')}
              </h2>
              <QueryBoundary query={attempts} skeleton={<Skeleton className="h-24" />}>
                {(p) =>
                  p.items.length === 0 ? (
                    <p className="text-muted">{t('assess.noAttempts')}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {p.items.map((at) => (
                        <li key={at.id}>
                          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                              <p className="font-medium">
                                {t('assess.attemptN', { n: at.attemptNumber })}
                              </p>
                              <p className="text-sm text-muted">{date(at.startedAt, true)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {at.status === 'IN_PROGRESS' ? (
                                <Badge tone="warning">{t('assess.inProgress')}</Badge>
                              ) : at.status === 'EXPIRED' ? (
                                <Badge tone="danger">{t('assess.expired')}</Badge>
                              ) : (
                                <>
                                  <span className="font-semibold">
                                    {at.percent != null ? pct(at.percent) : '—'}
                                  </span>
                                  <Badge tone={at.passed ? 'success' : 'danger'}>
                                    {at.passed ? t('assess.passed') : t('assess.notPassed')}
                                  </Badge>
                                </>
                              )}
                              <LinkButton
                                href={`/learn/${courseId}/attempts/${at.id}`}
                                variant="secondary"
                                size="sm"
                              >
                                {at.status === 'IN_PROGRESS'
                                  ? t('assess.resume')
                                  : t('assess.viewResult')}
                              </LinkButton>
                            </div>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </QueryBoundary>
            </section>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
