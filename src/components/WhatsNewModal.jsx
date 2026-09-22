import { useState } from 'react'
import { CHANGELOG } from '../changelog'

const STORAGE_KEY = 'blimp-last-seen-changelog'

function getLastSeen() {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function setLastSeen(version) {
  try { localStorage.setItem(STORAGE_KEY, version) } catch { /* private browsing, etc. — just re-show next time */ }
}

// Admin-only "what's new" pop-up, shown once per release — same idea as an
// Engagement weblayer, but announcing portal changes instead of promotions.
export default function WhatsNewModal() {
  const lastSeen = getLastSeen()
  const unseen = CHANGELOG.filter(entry => !lastSeen || entry.version > lastSeen)
  const [dismissed, setDismissed] = useState(unseen.length === 0)

  if (dismissed || unseen.length === 0) return null

  function handleDismiss() {
    setLastSeen(CHANGELOG[0].version)
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.45)' }} onClick={handleDismiss}>
      <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ border: '1px solid var(--hairline)', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '2px solid #000' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>What's new</div>
              <h2 className="font-display text-xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>Bloomreach Blimp updates</h2>
            </div>
            <button onClick={handleDismiss} className="text-2xl leading-none" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {unseen.map(entry => (
            <div key={entry.version}>
              <div className="text-[11.5px] font-semibold mb-2" style={{ color: 'var(--muted)' }}>{entry.date}</div>
              <ul className="space-y-1.5 list-disc pl-4">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-sm" style={{ color: 'var(--ink)' }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--hairline)' }}>
          <button onClick={handleDismiss}
            className="text-black text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90" style={{ background: 'var(--gold)' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
