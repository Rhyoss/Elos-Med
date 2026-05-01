import { T } from '@dermaos/ui/ds';

function Skel({ width, height, delay = 0 }: { width: string | number; height: number; delay?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: T.r.md,
        background: `linear-gradient(90deg, ${T.skel}, rgba(200,200,200,0.25), ${T.skel})`,
        backgroundSize: '200% 100%',
        animation: `shimmer 1.8s ease-in-out ${delay}ms infinite`,
      }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <Skel width={260} height={12} />
        <div style={{ height: 8 }} />
        <Skel width={160} height={30} />
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
          gap: 10,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skel key={i} width="100%" height={110} delay={i * 60} />
        ))}
      </div>

      {/* Three columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skel key={i} width="100%" height={280} delay={i * 100 + 300} />
        ))}
      </div>

      {/* Communications */}
      <Skel width="100%" height={180} delay={600} />

      <style>{`@keyframes shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  );
}
