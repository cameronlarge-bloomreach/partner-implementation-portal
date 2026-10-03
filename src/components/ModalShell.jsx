import { useEffect, useState } from 'react'

const EXIT_MS = 150

// Shared backdrop + panel for every modal. Enters with a fade + slight scale
// from the centre, exits faster than it enters. The transition is driven by a
// single `shown` flag, so closing mid-open (or reopening mid-close) reverses
// from the live on-screen value rather than jumping. `children` is a function
// that receives `close` — use it for the × / Close / Cancel buttons so they
// animate out too; calling the raw `onClose` still works, it just cuts.
export default function ModalShell({ onClose, panelClassName = '', panelStyle, backdropOpacity = 0.45, children }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function close() {
    if (!shown) return // already closing
    setShown(false)
    setTimeout(onClose, EXIT_MS)
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      data-shown={shown}
      style={{ background: `rgba(10,10,10,${backdropOpacity})` }}
      onClick={close}
    >
      <div
        className={`modal-panel bg-white rounded-2xl w-full flex flex-col ${panelClassName}`}
        style={{ border: '1px solid var(--hairline)', ...panelStyle }}
        onClick={e => e.stopPropagation()}
      >
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  )
}
