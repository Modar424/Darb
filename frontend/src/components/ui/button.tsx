import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';
const variants: Record<Variant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950',
  accent: 'bg-saffron-500 text-ink-950 hover:bg-saffron-600 hover:text-white active:bg-saffron-600',
  secondary: 'border border-line bg-surface text-ink-900 hover:bg-ink-50 active:bg-ink-100',
  ghost: 'text-ink-800 hover:bg-ink-100 active:bg-ink-200',
  danger: 'bg-danger-700 text-white hover:bg-red-800 active:bg-red-900',
};
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-6 text-lg',
};
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cn(base, variants[variant], sizes[size], extra);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, keeps the width, and blocks duplicate submissions. */
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
