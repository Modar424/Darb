import { getT } from '@/i18n/server';
import { Brand } from '@/components/brand';

export async function SiteFooter() {
  const { t } = await getT();
  return (
    <footer className="mt-20 border-t border-line bg-ink-950 text-ink-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
        <Brand name={t('app.name')} light />
        <p className="text-sm">{t('footer.tagline')}</p>
      </div>
    </footer>
  );
}
