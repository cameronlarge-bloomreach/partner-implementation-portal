// A segmented tick-track: one tick per step, filled left-to-right.
// Used instead of a continuous progress bar so the count itself is
// the visualization — "5 of 7 filled" reads as the literal status of
// a partner's rollout, not just an abstract percentage.
export default function RolloutRail({ total, completed, color = 'var(--gold)', size = 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'
  return (
    <div className={`flex gap-1 ${height}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-colors"
          style={{ background: i < completed ? color : 'var(--hairline)' }}
        />
      ))}
    </div>
  )
}
