'use client';

interface SkeletonTextProps {
  width?: string;
  className?: string;
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-24 rounded-2xl bg-vitae-card animate-pulse ${className}`}
    />
  );
}

export function SkeletonText({ width = '100%', className = '' }: SkeletonTextProps) {
  return (
    <div
      className={`h-4 rounded bg-vitae-card-light animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

export function SkeletonCircle({ size = 48, className = '' }: SkeletonCircleProps) {
  return (
    <div
      className={`rounded-full bg-vitae-card animate-pulse ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 pt-4">
      {/* Header area */}
      <div className="flex items-center gap-4">
        <SkeletonCircle size={56} />
        <div className="flex-1 space-y-2">
          <SkeletonText width="60%" />
          <SkeletonText width="40%" />
        </div>
      </div>

      {/* Section title */}
      <SkeletonText width="35%" className="mt-6" />

      {/* Cards */}
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Another section */}
      <SkeletonText width="45%" className="mt-4" />

      {/* Smaller content blocks */}
      <div className="space-y-2">
        <SkeletonText width="100%" />
        <SkeletonText width="85%" />
        <SkeletonText width="70%" />
      </div>

      {/* Bottom card */}
      <SkeletonCard />
    </div>
  );
}
