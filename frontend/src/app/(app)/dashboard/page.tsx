'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/roles';
import { Skeleton } from '@/components/ui/primitives';

/** /dashboard simply forwards to the role-appropriate home. */
export default function DashboardRedirect() {
  const { user, status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') router.replace(homeFor(user));
  }, [status, user, router]);
  return <Skeleton className="h-40 w-full" />;
}
