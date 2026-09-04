import { useEffect, useState } from 'react'
import { getQAWorkbook, saveQAWorkbook } from '../api'
import { QA_WORKBOOKS, STATUSES, SEVERITIES, emptyWorkbookData, computeVerdict } from '../qaWorkbooks'

function StatusPill({ value, active, onClick, disabled }) {
  const def = STATUSES[value]
  const on = active === value
  return (
    <button type="button" disabled={disabled} onClick={() => onClick(value)}
      className="text-xs font-semibold px-3 py-1 rounded-full transition-colors disabled:cursor-default"
      style={{
        border: `1px solid ${on ? def.color : 'var(--hairline)'}`,
        background: on ? def.bg : '#fff',
        color: on ? def.color : 'var(--muted)',
      }}>
      {def.label}
    </button>
  )
}

function SeverityPill({ value, active, onClick, disabled }) {
  const def = SEVERITIES[value]
  const on = active === value
  return (
    <button type="button" disabled={disabled} onClick={() => onClick(value)}
      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors disabled:cursor-default"
      style={{
        border: `1px solid ${on ? def.color : 'var(--hairline)'}`,
        background: on ? def.bg : '#fff',
        color: on ? def.color : 'var(--muted)',
      }}>
      {def.label}
    </button>
  )
}

function GuidanceList({ lines }) {
  return (
    <ul className="text-[13px] leading-relaxed" style={{ color: '#3d3d3d' }}>
      {lines.map((line, i) => {
        const sub = line.startsWith('· ')
        return (
          <li key={i} className={sub ? 'pl-5 mt-1' : 'pl-0 mt-1.5 first:mt-0'} style={{ color: sub ? 'var(--muted)' : '#1a1a1a' }}>
            {sub ? line.slice(2) : `• ${line}`}
          </li>
        )
      })}
    </ul>
  )
}

export default function QAWorkbookModal({ credential, implementationId, stepKey, isAdmin, clientName, partnerName, onClose }) {
  const workbook = QA_WORKBOOKS[stepKey]
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getQAWorkbook(credential, implementationId, stepKey).then(res => {
      if (cancelled) return
      if (res.error) { setError(res.error); setLoading(false); return }
      setData(res.data || emptyWorkbookData(workbook.checks))
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [implementationId, stepKey])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,10,10,0.4)' }}>
        <div className="bg-white rounded-2xl px-6 py-5 text-sm" style={{ color: 'var(--muted)' }}>
          {error ? 'Failed to load this workbook.' : 'Loading…'}
        </div>
      </div>
    )
  }

  function patch(fields) { setData(d => ({ ...d, ...fields })) }
  function patchCheck(key, fields) {
    setData(d => ({ ...d, checks: { ...d.checks, [key]: { ...d.checks[key], ...fields } } }))
  }
  function pickStatus(key, value) {
    const cur = data.checks[key] || {}
    patchCheck(key, { status: cur.status === value ? null : value })
  }
  function pickSeverity(key, value) {
    const cur = data.checks[key] || {}
    patchCheck(key, { severity: cur.severity === value ? null : value })
  }
  function addAction() { patch({ actions: [...(data.actions || []), { text: '', owner: '', due: '' }] }) }
  function updateAction(i, fields) {
    patch({ actions: data.actions.map((a, idx) => idx === i ? { ...a, ...fields } : a) })
  }
  function removeAction(i) { patch({ actions: data.actions.filter((_, idx) => idx !== i) }) }

  async function handleSave() {
    setSaving(true)
    const res = await saveQAWorkbook(credential, implementationId, stepKey, data)
    setSaving(false)
    if (!res.error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const verdict = computeVerdict(workbook, data)
  const doneCount = workbook.checks.filter(c => data.checks[c.key]?.status).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col" style={{ border: '1px solid var(--hairline)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 pt-6 pb-5 rounded-t-2xl flex-shrink-0" style={{ borderBottom: '2px solid #000' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>
                Review #{workbook.reviewNumber} · Implementation QA
              </div>
              <h2 className="font-display text-[28px] font-semibold mt-1" style={{ color: 'var(--ink)' }}>{workbook.label}</h2>
            </div>
            <button onClick={onClose} className="text-2xl leading-none flex-shrink-0" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3 text-[11.5px]" style={{ color: 'var(--muted)' }}>
            <span><strong style={{ color: 'var(--ink)' }}>Scope</strong> &nbsp;{workbook.scope}</span>
            <span><strong style={{ color: 'var(--ink)' }}>Reviewer</strong> &nbsp;{workbook.reviewer}</span>
            <span><strong style={{ color: 'var(--ink)' }}>Client</strong> &nbsp;{clientName}</span>
            <span><strong style={{ color: 'var(--ink)' }}>Partner</strong> &nbsp;{partnerName}</span>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              Review date
              <input type="text" placeholder="DD MMM YYYY" disabled={!isAdmin} value={data.reviewDate}
                onChange={e => patch({ reviewDate: e.target.value })}
                className="font-mono text-xs rounded px-1.5 py-0.5 disabled:opacity-60" style={{ border: '1px solid var(--hairline)', width: 110 }} />
            </label>
            <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              Version
              <input type="text" placeholder="v1.0" disabled={!isAdmin} value={data.version}
                onChange={e => patch({ version: e.target.value })}
                className="font-mono text-xs rounded px-1.5 py-0.5 disabled:opacity-60" style={{ border: '1px solid var(--hairline)', width: 60 }} />
            </label>
          </div>
        </div>

        <div className="px-7 py-6 overflow-y-auto flex-1">
          <p className="text-[13px] leading-relaxed mb-6" style={{ color: 'var(--muted)' }}>{workbook.intro}</p>

          {/* Checks */}
          <div className="flex flex-col gap-7">
            {workbook.checks.map((check, i) => {
              const cd = data.checks[check.key] || {}
              return (
                <div key={check.key}>
                  <div className="flex items-baseline gap-3 mb-2.5">
                    <span className="font-display font-semibold text-[13px]" style={{ color: 'var(--arctic)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{check.title}</h3>
                  </div>
                  <GuidanceList lines={check.guidance} />
                  {check.commonIssue && (
                    <div className="flex gap-2.5 mt-3 px-3.5 py-2.5 rounded-r" style={{ borderLeft: '3px solid var(--gold)', background: '#FFFCE8' }}>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#000' }}>Common issue</div>
                        <p className="text-[12.5px] leading-relaxed mt-0.5" style={{ color: '#1a1a1a' }}>{check.commonIssue}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                    <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hairline)' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-widest w-14" style={{ color: 'var(--muted)' }}>Status</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.keys(STATUSES).map(k => (
                          <StatusPill key={k} value={k} active={cd.status} disabled={!isAdmin} onClick={v => pickStatus(check.key, v)} />
                        ))}
                      </div>
                    </div>
                    {(isAdmin || cd.severity) && (
                      <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2" style={{ borderBottom: '1px solid var(--hairline)' }}>
                        <span className="text-[10px] font-semibold uppercase tracking-widest w-14" style={{ color: 'var(--muted)' }}>Severity</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(SEVERITIES).map(k => (
                            <SeverityPill key={k} value={k} active={cd.severity} disabled={!isAdmin} onClick={v => pickSeverity(check.key, v)} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="p-3.5">
                      {isAdmin ? (
                        <textarea rows={3} value={cd.notes || ''} onChange={e => patchCheck(check.key, { notes: e.target.value })}
                          placeholder="Notes for the partner — what was checked, what was found, what needs to change."
                          className="w-full text-[13px] rounded-lg px-3 py-2 resize-none focus:outline-none" style={{ border: '1px solid var(--hairline)', background: '#fcfcfc' }} />
                      ) : (
                        <p className="text-[13px] leading-relaxed" style={{ color: cd.notes ? 'var(--ink)' : 'var(--muted)' }}>
                          {cd.notes || 'No notes from SDC yet.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="mt-9 pt-6" style={{ borderTop: '1px solid var(--hairline)' }}>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ink)' }}>Summary & required actions</h3>
            <div className="flex gap-3 mb-5">
              <div className="flex-1 rounded-lg p-3" style={{ border: '1px solid var(--hairline)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Overall verdict</div>
                <div className="font-display font-semibold text-lg mt-1" style={{ color: verdict.color }}>{verdict.label}</div>
              </div>
              <div className="flex-1 rounded-lg p-3" style={{ border: '1px solid var(--hairline)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Checks marked complete</div>
                <div className="font-display font-semibold text-lg mt-1" style={{ color: 'var(--ink)' }}>{doneCount} of {workbook.checks.length}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Required actions for the partner</h4>
              {isAdmin && <button onClick={addAction} className="text-xs font-semibold" style={{ color: 'var(--arctic)' }}>+ Add action</button>}
            </div>
            {(data.actions || []).length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>No actions logged.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-xs w-4 flex-shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                    <input type="text" disabled={!isAdmin} value={a.text} placeholder="What needs to change"
                      onChange={e => updateAction(i, { text: e.target.value })}
                      className="flex-1 text-[13px] rounded-lg px-2.5 py-1.5 disabled:opacity-70 focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                    <input type="text" disabled={!isAdmin} value={a.owner} placeholder="Owner"
                      onChange={e => updateAction(i, { owner: e.target.value })}
                      className="w-28 text-[13px] rounded-lg px-2.5 py-1.5 disabled:opacity-70 focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                    <input type="text" disabled={!isAdmin} value={a.due} placeholder="DD MMM"
                      onChange={e => updateAction(i, { due: e.target.value })}
                      className="w-24 font-mono text-[13px] rounded-lg px-2.5 py-1.5 disabled:opacity-70 focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                    {isAdmin && <button onClick={() => removeAction(i)} className="text-xs flex-shrink-0" style={{ color: 'var(--rust)' }}>Remove</button>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Partner response</h4>
              <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: 'var(--muted)' }}>For the partner to complete — confirmation of the changes made, or questions.</p>
              {isAdmin ? (
                <p className="text-[13px] leading-relaxed" style={{ color: data.partnerResponse ? 'var(--ink)' : 'var(--muted)' }}>
                  {data.partnerResponse || 'No response from the partner yet.'}
                </p>
              ) : (
                <textarea rows={4} value={data.partnerResponse} onChange={e => patch({ partnerResponse: e.target.value })}
                  placeholder="Response, questions, and confirmation of the changes made."
                  className="w-full text-[13px] rounded-lg px-3 py-2 resize-none focus:outline-none" style={{ border: '1px solid var(--hairline)', background: '#fcfcfc' }} />
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Reviewed by (SDC)</span>
                <input type="text" disabled={!isAdmin} value={data.signoff?.sdc || ''} placeholder="Name & date"
                  onChange={e => patch({ signoff: { ...data.signoff, sdc: e.target.value } })}
                  className="text-[13px] rounded px-1 py-1 disabled:opacity-70 focus:outline-none" style={{ borderBottom: '1px solid var(--hairline)' }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Partner sign-off</span>
                <input type="text" disabled={isAdmin} value={data.signoff?.partner || ''} placeholder="Name & date"
                  onChange={e => patch({ signoff: { ...data.signoff, partner: e.target.value } })}
                  className="text-[13px] rounded px-1 py-1 disabled:opacity-70 focus:outline-none" style={{ borderBottom: '1px solid var(--hairline)' }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Partner Services Manager</span>
                <input type="text" disabled={!isAdmin} value={data.signoff?.psm || ''} placeholder="Name & date"
                  onChange={e => patch({ signoff: { ...data.signoff, psm: e.target.value } })}
                  className="text-[13px] rounded px-1 py-1 disabled:opacity-70 focus:outline-none" style={{ borderBottom: '1px solid var(--hairline)' }} />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-7 py-4 rounded-b-2xl flex-shrink-0" style={{ borderTop: '1px solid var(--hairline)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{saved ? 'Saved' : ' '}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm px-4 py-1.5 rounded-lg" style={{ color: 'var(--muted)' }}>Close</button>
            <button onClick={handleSave} disabled={saving} className="text-black text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
