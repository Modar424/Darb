'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/api/types';
import { hasRole } from '@/lib/roles';
import { ForbiddenState } from '@/components/states';
import { Skeleton } from '@/components/ui/primitives';

/**
 * Client-side convenience guard (the API remains authoritative): renders the forbidden state for
 * signed-in users without the role, so they never see a page whose requests would all be rejected.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === 'loading') return <Skeleton className="h-40 w-full" />;
  if (!user || !hasRole(user, ...roles)) return <ForbiddenState />;
  return <>{children}</>;
}
