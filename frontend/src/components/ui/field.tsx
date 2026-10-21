import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-(--radius-control) border bg-surface px-3 text-base text-text placeholder:text-muted/70 transition-colors disabled:bg-ink-50 disabled:text-muted aria-[invalid=true]:border-danger-700';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}
/** Associates label, hint and error with the control through ids (screen-reader friendly). */
export function FieldShell({ label, error, hint, required, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
        {required && (
          <span aria-hidden className="ms-1 text-danger-700">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

type Shared = { label: string; error?: string; hint?: string; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Shared>(
  function Input({ label, error, hint, wrapperClassName, className, required, ...rest }, ref) {
    return (
      <FieldShell
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={wrapperClassName}
      >
        {({ id, describedBy, invalid }) => (
          <input
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={cn(control, 'min-h-11 border-line', className)}
            {...rest}
          />
        )}
      </FieldShell>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & Shared
>(function Textarea(
  { label, error, hint, wrapperClassName, className, required, rows = 5, ...rest },
  ref,
) {
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={wrapperClassName}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(control, 'border-line py-2.5', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & Shared
>(function Select(
  { label, error, hint, wrapperClassName, className, required, children, ...rest },
  ref,
) {
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={wrapperClassName}
    >
      {({ id, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, 'min-h-11 border-line', className)}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
});
