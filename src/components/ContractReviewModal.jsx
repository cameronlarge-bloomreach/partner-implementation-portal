import { useState } from 'react'
import { upsertUsageMetric, USAGE_METERS, CONTRACT_ALLOWANCES } from '../api'

// Every metric_key this app knows about, keyed for easy label lookup —
// combines the pricing-model meters with the contract-only allowances.
const ALL_METRICS_BY_KEY = Object.fromEntries(
  [...USAGE_METERS.profiles, ...USAGE_METERS.events, ...CONTRACT_ALLOWANCES].map(m => [m.key, m]),
)

// Shown after "Extract usage limits" on a contract PDF. Never writes
// anything until Confirm & Save — every value is editable, and known vs.
// unmapped metrics are kept visually separate so nothing looks more
// trustworthy than it is. See automation/../ContractReviewModal plan notes:
// the raw printed text sits next to the interpreted value on purpose, so a
// reviewer can catch a wrong unit conversion, not just an unconverted one.
export default function ContractReviewModal({ credential, implementationId, doc, metrics, currentUsageMetrics, onClose, onSaved }) {
  const known = metrics.filter(m => m.metricKey)
  const unmapped = metrics.filter(m => !m.metricKey)

  const [rows, setRows] = useState(() => Object.fromEntries(known.map(m => [
    m.metricKey,
    { value: m.interpretedValue != null ? String(m.interpretedValue) : '', checked: m.found && m.interpretedValue != null },
  ])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  function setRow(key, patch) {
    setRows(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    const toSave = known.filter(m => rows[m.metricKey]?.checked && rows[m.metricKey]?.value !== '')
    for (const m of toSave) {
      const res = await upsertUsageMetric(credential, implementationId, m.metricKey, {
        value: currentUsageMetrics?.[m.metricKey]?.value ?? null, // preserve any existing manually-tracked usage
        limit: Number(rows[m.metricKey].value),
        source: 'contract_extraction',
        sourceDocumentId: doc.id,
      })
      if (res.error) { setError(res.error); setSaving(false); return }
    }
    setSaving(false)
    setDone(true)
    onSaved?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col" style={{ border: '1px solid var(--hairline)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '2px solid #000' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>Extracted from {doc.file_name}</div>
              <h2 className="font-display text-xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>Review usage limits</h2>
            </div>
            <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: 'var(--muted)' }}>
            AI-extracted — check every value against the raw text before saving. Nothing is written until you confirm below.
          </p>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--moss)' }}>Saved ✓</div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Usage limits updated.</p>
            <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>Close</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
              {known.length === 0 && unmapped.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No contracted usage metrics found in this document.</p>
              )}

              {known.map(m => {
                const meta = ALL_METRICS_BY_KEY[m.metricKey]
                const row = rows[m.metricKey]
                return (
                  <div key={m.metricKey} className="rounded-lg p-3" style={{ border: '1px solid var(--hairline)' }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5" checked={row.checked} disabled={!m.found}
                          onChange={e => setRow(m.metricKey, { checked: e.target.checked })} />
                        <div>
                          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{meta?.label || m.metricKey}</span>
                          {meta?.hint && <span className="text-[10px] ml-1.5" style={{ color: 'var(--muted)' }}>{meta.hint}</span>}
                        </div>
                      </label>
                      {!m.found && <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--paper)', color: 'var(--muted)' }}>Not found in document</span>}
                    </div>
                    {m.found && (
                      <div className="ml-6 space-y-1.5">
                        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                          Printed as <span className="font-mono" style={{ color: 'var(--ink)' }}>"{m.rawText}"</span>
                          {m.interpretationNote && <span> → interpreted as <strong style={{ color: 'var(--ink)' }}>{m.interpretedValue?.toLocaleString()}</strong> ({m.interpretationNote})</span>}
                        </p>
                        {m.sourceQuote && <p className="text-[11px] italic" style={{ color: 'var(--muted)' }}>"{m.sourceQuote}"</p>}
                        <label className="flex flex-col w-40">
                          <span className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>Limit to save</span>
                          <input type="number" min="0" value={row.value} onChange={e => setRow(m.metricKey, { value: e.target.value })}
                            className="font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}

              {unmapped.length > 0 && (
                <div className="rounded-lg p-3" style={{ border: '1px dashed var(--hairline)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                    Also found — not saved, no matching field yet
                  </p>
                  <div className="space-y-2">
                    {unmapped.map((m, i) => (
                      <p key={i} className="text-[12px]" style={{ color: 'var(--muted)' }}>
                        <strong style={{ color: 'var(--ink)' }}>{m.label}</strong>: "{m.rawText}"
                        {m.interpretedValue != null && <span> → {m.interpretedValue.toLocaleString()}</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-xs" style={{ color: 'var(--rust)' }}>{error}</p>}
            </div>

            <div className="px-6 py-4 flex-shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
              <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--muted)' }}>Cancel</button>
              <button type="button" onClick={handleConfirm} disabled={saving || known.every(m => !rows[m.metricKey]?.checked)}
                className="text-black text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
