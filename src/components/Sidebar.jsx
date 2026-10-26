import { useEffect, useRef, useState } from 'react'

// Sticky filter sidebar that scrolls by itself when it's taller than the
// screen. Fading edges plus a "More below" pill make it obvious there's
// more to see; the pill scrolls down a step when clicked.
export function SidebarPanel({ className = '', children }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function update() {
      setEdges({
        top: el.scrollTop > 2,
        bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [])

  return (
    <aside
      className={`no-print hidden md:flex md:flex-col md:sticky md:top-6 relative bg-white rounded-2xl ${className}`}
      style={{ border: '1px solid var(--hairline)', maxHeight: 'calc(100vh - 3rem)' }}
    >
      <div ref={ref} className="sidebar-scroll overflow-y-auto overscroll-contain p-3">
        <div>{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-2xl transition-opacity"
        style={{ background: 'linear-gradient(#fff, rgba(255,255,255,0))', opacity: edges.top ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-14 rounded-b-2xl flex items-end justify-center pb-2 transition-opacity"
        style={{ background: 'linear-gradient(rgba(255,255,255,0), #fff 70%)', opacity: edges.bottom ? 1 : 0, pointerEvents: 'none' }}
      >
        <button
          type="button"
          tabIndex={edges.bottom ? 0 : -1}
          onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.7, behavior: 'smooth' })}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm"
          style={{ background: 'var(--ink)', color: '#fff', pointerEvents: edges.bottom ? 'auto' : 'none' }}
        >
          More below ↓
        </button>
      </div>
    </aside>
  )
}

// Shows the first `limit` items with a "Show all N" toggle, so long lists
// (partners, people) don't push everything else out of view. Items for
// which `pinned` returns true always stay visible (e.g. the selected one).
export function CollapsibleList({ items, limit = 8, pinned = () => false, noun = 'items', children }) {
  const [expanded, setExpanded] = useState(false)
  const hidden = items.length - limit
  const shown = expanded || hidden <= 1
    ? items
    : items.filter((item, i) => i < limit || pinned(item))

  return (
    <>
      {shown.map(children)}
      {hidden > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left text-xs font-medium px-3 py-1.5 rounded-lg hover:underline"
          style={{ color: 'var(--arctic-dark)' }}
        >
          {expanded ? 'Show fewer' : `Show all ${items.length} ${noun}`}
        </button>
      )}
    </>
  )
}
