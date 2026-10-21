'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ToastItem {
  id: number;
  tone: 'success' | 'danger';
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}
const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

/** Toasts live in a polite live region so they are announced without stealing focus. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem['tone'], text: string) => {
    const id = ++seq;
    setItems((cur) => [...cur.slice(-3), { id, tone, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 5000);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({ success: (t) => push('success', t), error: (t) => push('danger', t) }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((i) => {
          const Icon = i.tone === 'success' ? CheckCircle2 : XCircle;
          return (
            <div
              key={i.id}
              className={cn(
                'pointer-events-auto flex max-w-md items-center gap-2 rounded-(--radius-control) px-4 py-3 text-sm font-medium text-white shadow-(--shadow-pop)',
                i.tone === 'success' ? 'bg-teal-700' : 'bg-danger-700',
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {i.text}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}
