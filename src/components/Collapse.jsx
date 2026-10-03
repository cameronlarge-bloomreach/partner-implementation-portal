// Animated expand/collapse for content that is otherwise conditionally shown.
// Uses the grid 0fr → 1fr trick so the height animates without measuring.
// Collapsed content is `inert` (unfocusable, unclickable) and hidden from
// assistive tech, but stays mounted so form state survives a close.
export default function Collapse({ open, className = '', children }) {
  return (
    <div className={`collapse ${className}`} data-open={open} inert={!open} aria-hidden={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  )
}
