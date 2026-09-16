import { useState } from 'react'
import { raiseSdcTicket, attachTicketToWorkbook } from '../api'
import { JOB_TYPE_OPTIONS, PRIORITY_OPTIONS } from '../clickupTicket'

export default function RaiseTicketModal({ implementationId, stepKey, workbookLabel, clientName, psmName, psmEmail, onClose, onRaised }) {
  const [taskName, setTaskName] = useState(`${clientName} - ${workbookLabel}`)
  const [description, setDescription] = useState('')
  const [jobType, setJobType] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [customer, setCustomer] = useState(clientName)
  const [sdcAdded, setSdcAdded] = useState(false)
  const [workfrontUrl, setWorkfrontUrl] = useState('')
  const [bloomreachUrl, setBloomreachUrl] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { url } once raised

  async function handleSubmit(e) {
    e.preventDefault()
    if (!taskName.trim() || !customer.trim() || !jobType || !priority) {
      setError('Task name, customer, job type, and priority are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    const res = await raiseSdcTicket({
      taskName: taskName.trim(),
      description,
      jobType,
      priority,
      customer: customer.trim(),
      sdcAdded,
      workfrontUrl: workfrontUrl.trim(),
      bloomreachUrl: bloomreachUrl.trim(),
      estimatedHours: estimatedHours.trim(),
      psmName: psmName || '',
      psmEmail: psmEmail || '',
    })
    setSubmitting(false)
    if (res.error) { setError(res.error); return }
    const ticket = { id: res.taskId, url: res.url, name: taskName.trim(), raisedAt: new Date().toISOString() }
    // Best-effort — the ticket is already raised in ClickUp either way, so a
    // failure here just means the portal won't show the link until reopened.
    await attachTicketToWorkbook(implementationId, stepKey, ticket)
    setResult(ticket)
    onRaised?.(ticket)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col" style={{ border: '1px solid var(--hairline)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '2px solid #000' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>SDC Tickets · Backlog</div>
              <h2 className="font-display text-xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>Raise ClickUp ticket</h2>
            </div>
            <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: 'var(--muted)' }}>
            {psmName
              ? <>Owner on record: <strong style={{ color: 'var(--ink)' }}>{psmName}</strong> — credited on the ticket alongside you.</>
              : 'No Partner Services Manager set for this account — set one on the Internal tab so tickets credit them too.'}
          </p>
        </div>

        {result ? (
          <div className="px-6 py-8 text-center">
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--moss)' }}>Ticket raised ✓</div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{result.name}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="inline-block text-sm font-medium px-4 py-2 rounded-lg text-black" style={{ background: 'var(--gold)' }}>
              Open in ClickUp ↗
            </a>
            <div className="mt-4">
              <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 overflow-y-auto flex-1 space-y-3.5">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Task Name *</label>
              <input type="text" required value={taskName} onChange={e => setTaskName(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Task Description</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Add as much detail as possible"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={{ border: '1px solid var(--hairline)' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Job Type *</label>
                <select required value={jobType} onChange={e => setJobType(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                  <option value="">Select option…</option>
                  {JOB_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Priority *</label>
                <select required value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                  {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Customer *</label>
              <input type="text" required value={customer} onChange={e => setCustomer(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
            </div>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink)' }}>
              <input type="checkbox" checked={sdcAdded} onChange={e => setSdcAdded(e.target.checked)} />
              SDC Added to Bloomreach Project?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Workfront Project URL</label>
                <input type="text" value={workfrontUrl} onChange={e => setWorkfrontUrl(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Bloomreach Project URL</label>
                <input type="text" value={bloomreachUrl} onChange={e => setBloomreachUrl(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Estimated Hours</label>
              <input type="text" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} placeholder="e.g. 30min or 2h"
                className="w-full max-w-[160px] rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--rust)' }}>{error}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--muted)' }}>Cancel</button>
              <button type="submit" disabled={submitting}
                className="text-black text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                {submitting ? 'Raising…' : 'Raise ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
