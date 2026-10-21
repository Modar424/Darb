import type { HTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-(--radius-panel) border border-line bg-surface shadow-(--shadow-panel)',
        className,
      )}
      {...rest}
    />
  );
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
const badgeTone: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-800',
  info: 'bg-ink-100 text-ink-800',
  success: 'bg-teal-100 text-teal-700',
  warning: 'bg-warn-100 text-warn-800',
  danger: 'bg-danger-100 text-danger-700',
};
/** Status is always conveyed by text (and a dot shape), never by color alone. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium',
        badgeTone[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full bg-current',
          tone === 'warning' && 'rounded-[1px]',
          tone === 'danger' && 'rotate-45 rounded-none',
        )}
      />
      {children}
    </span>
  );
}

const alertTone: Record<Exclude<Tone, 'neutral'>, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-ink-200 bg-ink-50 text-ink-900', Icon: Info },
  success: { box: 'border-teal-700/30 bg-teal-100 text-teal-700', Icon: CheckCircle2 },
  warning: { box: 'border-saffron-600/40 bg-warn-100 text-warn-800', Icon: AlertTriangle },
  danger: { box: 'border-danger-700/30 bg-danger-100 text-danger-700', Icon: XCircle },
};
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  live = false,
}: {
  tone?: Exclude<Tone, 'neutral'>;
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Announce immediately to assistive tech (use for errors after an action). */
  live?: boolean;
}) {
  const { box, Icon } = alertTone[tone];
  return (
    <div
      role={live ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-(--radius-control) border p-3.5', box, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-(--radius-control)', className)} />;
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <span
        className="size-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-700"
        aria-hidden
      />
      <span className="text-sm">{label}</span>
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}
    >
      <div
        className="h-full rounded-full bg-teal-700 transition-[width] duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-dashed border-ink-200 bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="text-ink-600" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
