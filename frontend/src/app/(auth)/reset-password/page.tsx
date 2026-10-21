import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/i18n/server';
import { ResetForm } from '@/features/auth/auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.resetTitle'), robots: { index: false } };
}
export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
