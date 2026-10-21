import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ProfileView } from '@/features/profile/profile-view';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.profile'), robots: { index: false } };
}
export default function Page() {
  return <ProfileView />;
}
