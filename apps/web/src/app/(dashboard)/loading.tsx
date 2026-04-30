import { T } from '@dermaos/ui/ds';

function SkeletonBar({ width, height }: { width: string | number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: T.r.md,
        background: 'rgba(0,0,0,0.04)',
        animation: 'shimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SkeletonBar width={200} height={28} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBar key={i} width="100%" height={110} />
        ))}
      </div>
      <SkeletonBar width="100%" height={280} />
      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  );
}
