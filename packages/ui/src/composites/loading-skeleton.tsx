import * as React from 'react';
import { cn } from '../utils.js';

/* ── Base ────────────────────────────────────────────────────────────────── */

function SkeletonBase({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/* ── Variantes compostas ─────────────────────────────────────────────────── */

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-6 flex flex-col gap-4', className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonBase className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2 flex-1">
          <SkeletonBase className="h-4 w-1/3" />
          <SkeletonBase className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-border" aria-hidden="true">
      <SkeletonBase className="h-4 w-4 rounded" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <SkeletonBase
          key={i}
          className="h-4 flex-1"
          style={{ maxWidth: i === 0 ? '200px' : undefined }}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }[size];
  return <SkeletonBase className={cn('rounded-full', sizeClass)} aria-hidden="true" />;
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-end gap-2 h-32', className)} aria-hidden="true">
      {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65].map((h, i) => (
        <SkeletonBase key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/* ── LoadingSkeleton namespace ───────────────────────────────────────────── */

function LoadingSkeletonTable({ count = 5, columns = 5 }: { count?: number; columns?: number }) {
  return (
    <div aria-label="Carregando..." aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

export const LoadingSkeleton = Object.assign(SkeletonBase, {
  Text: SkeletonText,
  Card: SkeletonCard,
  TableRow: SkeletonTableRow,
  Table: LoadingSkeletonTable,
  Avatar: SkeletonAvatar,
  Chart: SkeletonChart,
});

export {
  SkeletonBase as Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonAvatar,
  SkeletonChart,
};
