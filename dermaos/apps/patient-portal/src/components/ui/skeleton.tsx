interface SkeletonProps {
  height?: string | number;
  width?:  string | number;
  rounded?: boolean;
  style?:  React.CSSProperties;
}

export function Skeleton({ height = 20, width = '100%', rounded = false, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{
        height:        typeof height === 'number' ? `${height}px` : height,
        width:         typeof width  === 'number' ? `${width}px`  : width,
        borderRadius:  rounded ? '9999px' : '6px',
        ...style,
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div
      style={{
        padding:      '16px',
        borderRadius: '16px',
        border:       '1px solid #e5e5e5',
        display:      'flex',
        flexDirection:'column',
        gap:          '12px',
      }}
    >
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="80%" />
      <Skeleton height={14} width="40%" />
    </div>
  );
}
