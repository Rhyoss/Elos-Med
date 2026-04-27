import { LoadingSkeleton } from '@dermaos/ui';

export default function DashboardLoading() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <LoadingSkeleton className="h-8 w-48 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <LoadingSkeleton className="h-64 rounded-xl" />
    </div>
  );
}
