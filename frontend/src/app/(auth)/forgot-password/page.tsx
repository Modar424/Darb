import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/i18n/server';
import { ForgotForm } from '@/features/auth/auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.forgotTitle'), robots: { index: false } };
}
export default function Page() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
