import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Brand mark: three stacked layers (course → modules → lessons) with a saffron top layer. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden focusable="false">
      <rect x="3" y="21" width="26" height="6" rx="2" fill="#24507a" />
      <rect x="6" y="13" width="20" height="6" rx="2" fill="#356b9c" />
      <rect x="9" y="5" width="14" height="6" rx="2" fill="#f2a900" />
    </svg>
  );
}
export function Brand({
  name,
  href = '/',
  light = false,
}: {
  name: string;
  href?: string;
  light?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-md">
      <LogoMark />
      <span className={cn('font-display text-xl font-bold', light ? 'text-white' : 'text-ink-900')}>
        {name}
      </span>
    </Link>
  );
}
