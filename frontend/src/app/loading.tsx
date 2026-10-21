import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl p-6" aria-busy="true">
      <Skeleton className="mb-6 h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
