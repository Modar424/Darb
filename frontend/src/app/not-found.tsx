import { SiteHeader } from '@/components/layout/site-header';
import { NotFoundState } from '@/components/states';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-16">
        <NotFoundState />
      </main>
    </>
  );
}
