/** Reusable skeleton/shimmer primitives for loading states */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/** 4 KPI cards skeleton for Dashboard */
export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Two chart cards skeleton for Dashboard */
export function ChartsSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Pipeline columns skeleton for Leads page */
export function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 max-w-7xl mx-auto">
      {[...Array(6)].map((_, col) => (
        <div key={col} className="min-w-[260px] flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-2">
            {[...Array(col < 2 ? 3 : 1)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-sm p-3 border border-gray-100"
              >
                <Skeleton className="h-3 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table rows skeleton for list views */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-gray-100 flex gap-6">
          {[...Array(6)].map((_, j) => (
            <Skeleton key={j} className={`h-3 ${j === 0 ? "w-28" : "w-16"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Detail page skeleton (CallDetail, LeadDetail) */
export function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-5 w-48 mb-2" />
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** Settings toggles skeleton */
export function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between"
        >
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Agent cards skeleton for Team page */
export function TeamSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Campaign cards skeleton */
export function CampaignsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
