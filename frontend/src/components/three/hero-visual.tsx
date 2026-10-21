'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { Skeleton } from '@/components/ui/primitives';

// The 3D bundle (three + R3F) is only downloaded on the route that renders this component.
const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Lightweight static illustration: used without WebGL, with reduced motion, or before hydration. */
export function TowerFallback() {
  return (
    <svg viewBox="0 0 320 300" className="size-full" aria-hidden focusable="false">
      <ellipse cx="160" cy="262" rx="120" ry="16" fill="#0f2a43" opacity="0.12" />
      <rect x="40" y="206" width="240" height="48" rx="12" fill="#24507a" />
      <rect x="62" y="152" width="196" height="48" rx="12" fill="#356b9c" />
      <rect x="84" y="98" width="152" height="48" rx="12" fill="#0b6b6a" />
      <rect x="106" y="44" width="108" height="48" rx="12" fill="#f2a900" />
      <circle cx="28" cy="170" r="9" fill="#f2a900" />
      <circle cx="294" cy="120" r="9" fill="#ffffff" stroke="#c9d9e8" />
      <circle cx="300" cy="220" r="9" fill="#f2a900" />
    </svg>
  );
}

type Mode = 'pending' | 'fallback' | 'scene';

export function HeroVisual() {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('pending');
  const [inView, setInView] = useState(false);
  const [foreground, setForeground] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let idle: number | undefined;
    const decide = () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (reduce.matches || !hasWebGL()) return setMode('fallback');
      // Let the page become interactive first: the (heavy) 3D bundle starts only when the browser is idle.
      const start = () => setMode('scene');
      if (window.requestIdleCallback) idle = window.requestIdleCallback(start, { timeout: 2000 });
      else idle = window.setTimeout(start, 800);
    };
    decide();
    reduce.addEventListener('change', decide);
    return () => {
      reduce.removeEventListener('change', decide);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
    };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    const onVis = () => setForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div
      ref={wrap}
      role="img"
      aria-label={t('home.sceneAlt')}
      className="aspect-[4/3] w-full max-w-xl"
    >
      {mode === 'scene' ? <HeroScene active={inView && foreground} /> : <TowerFallback />}
    </div>
  );
}
