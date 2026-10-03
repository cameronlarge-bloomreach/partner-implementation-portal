export function SkeletonBar({ className = '', style }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />
}

// Mirrors ImplCard's footprint so the grid doesn't shift when data lands.
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid var(--hairline)' }} aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <SkeletonBar className="h-4 w-1/2" />
        <SkeletonBar className="h-4 w-14 !rounded-full" />
      </div>
      <SkeletonBar className="h-3 w-1/3 mt-2" />
      <SkeletonBar className="h-2 w-full mt-5 !rounded-full" />
      <SkeletonBar className="h-2 w-full mt-4 !rounded-full" />
      <div className="flex justify-end mt-4"><SkeletonBar className="h-3 w-12" /></div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading implementations">
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <SkeletonBar className="h-[88px] !rounded-2xl" />
      </div>
      <div className="grid gap-2.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {Array.from({ length: 5 }, (_, i) => <SkeletonBar key={i} className="h-[46px] !rounded-xl" />)}
      </div>
      <SkeletonBar className="h-5 w-40 mb-3" />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}
