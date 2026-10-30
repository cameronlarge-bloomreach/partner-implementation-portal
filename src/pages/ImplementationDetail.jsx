import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  getImplementation, updateDates, updateTouchPoint,
  updateImplementationStatus, updateWorkfrontProject,
  deleteImplementation, updateSlackChannel, triggerBauHandover,
  addRaidItem, updateRaidItem, deleteRaidItem, getStepDefinitions,
  addMeetingNote, deleteMeetingNote, updateBloomreachOrgLink,
  updatePricingModel, updateBloomreachRegion, upsertUsageMetric, USAGE_METERS,
  CONTRACT_ALLOWANCES, extractContractLimits,
  IMPLEMENTATION_STATUSES, listStaffAvatars, RAG_STATUSES, updateRag,
} from '../api'
import Navbar from '../components/Navbar'
import StepsManager from '../components/StepsManager'
import AccountTeam from '../components/AccountTeam'
import ImplementationDocuments from '../components/ImplementationDocuments'
import QAWorkbookModal from '../components/QAWorkbookModal'
import RaiseTicketModal from '../components/RaiseTicketModal'
import ContractReviewModal from '../components/ContractReviewModal'
import { TeamStack } from '../components/ImplCard'
import RagBadge from '../components/RagBadge'
import RolloutRail from '../components/RolloutRail'
import { QA_WORKBOOKS } from '../qaWorkbooks'
import { setupTodos, nameFromEmail } from '../implStatus'

const DATE_FIELDS = [
  { key: 'planned_completion_date', label: 'Planned Completion', note: 'Set at start' },
  { key: 'actual_completion_date', label: 'Actual Completion' },
  { key: 'planned_go_live_date', label: 'Planned Go Live', note: 'Set at start' },
  { key: 'actual_time_to_live', label: 'Actual Go Live' },
]

const TOUCH_POINTS = [
  { key: 'account_creation', label: 'Account Creation' },
  { key: 'frontend_data', label: 'Front End Data' },
  { key: 'backend_data', label: 'Backend Data' },
  { key: 'integration_sms', label: 'SMS Integration' },
  { key: 'integration_email', label: 'Email Integration' },
  { key: 'integration_whatsapp', label: 'WhatsApp Integration' },
  { key: 'use_cases', label: 'Use Cases' },
]

const QA_STEPS = [
  { key: 'qa_peer_review_1', label: 'ID Validation' },
  { key: 'qa_peer_review_2', label: 'Back End Tracking' },
  { key: 'qa_peer_review_3', label: 'Front End Tracking' },
  { key: 'qa_peer_review_4', label: 'Use Cases Data Check & Debugging' },
  { key: 'qa_peer_review_5', label: 'Data Mapping' },
  { key: 'qa_peer_review_6', label: 'Expiration & Data Cleanliness' },
]

const RAID_TYPES = ['Risk', 'Action', 'Issue', 'Dependency']
const RAID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']
const EMPTY_RAID = { type: 'Risk', title: '', description: '', status: 'Open', owner: '' }
const EMPTY_NOTE = { title: '', meeting_date: new Date().toISOString().slice(0, 10), content: '' }

const RAID_TYPE_STYLE = {
  Risk: { background: 'var(--rust-bg)', color: 'var(--rust)' },
  Action: { background: '#e7f4fb', color: '#017aaa' },
  Issue: { background: '#fdf3e0', color: '#a3730a' },
  Dependency: { background: '#f2ecfb', color: '#6b3fa0' },
}
const RAID_STATUS_STYLE = {
  Open: { background: 'var(--rust-bg)', color: 'var(--rust)' },
  'In Progress': { background: '#e7f4fb', color: '#017aaa' },
  Resolved: { background: 'var(--moss-bg)', color: 'var(--moss)' },
  Closed: { background: '#f2f1ec', color: 'var(--muted)' },
}

const SCENARIO_STATUS_STYLE = {
  active: { background: 'var(--moss-bg)', color: 'var(--moss)' },
  draft: { background: 'var(--hairline)', color: 'var(--muted)' },
  inactive: { background: 'var(--hairline)', color: 'var(--muted)' },
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmt(n) {
  return n === null || n === undefined ? '—' : Number(n).toLocaleString()
}

function Card({ children, className = '', style = {}, id }) {
  return (
    <div id={id} className={`bg-white rounded-2xl p-5 scroll-mt-4 ${className}`} style={{ border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  )
}

// Card with a title row (title, optional count/subtitle, optional action on
// the right) — the building block for both tabs.
function Section({ title, subtitle, action, children, className = '', id }) {
  return (
    <Card className={className} id={id}>
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

// RAG health on the Overview tab — partners see it read-only; admins pick a
// colour and say why. Saves the colour and note together so they never drift.
function RagCard({ rag, canEdit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState(rag.status)
  const [note, setNote] = useState(rag.note)
  const [saving, setSaving] = useState(false)
  const meta = RAG_STATUSES[rag.status]

  function startEdit() {
    setStatus(rag.status || 'green')
    setNote(rag.note)
    setEditing(true)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ status, note })
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  const updated = rag.updatedAt && `Updated ${formatDate(rag.updatedAt.slice(0, 10))}${rag.updatedBy ? ` by ${rag.updatedBy.includes('@') ? nameFromEmail(rag.updatedBy) : rag.updatedBy}` : ''}`

  return (
    <Section
      title="RAG status"
      subtitle={editing ? 'Visible to the partner too' : updated || (canEdit ? 'Not set yet · visible to the partner too' : null)}
      action={canEdit && !editing && (
        <button onClick={startEdit} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--gold)', color: '#000' }}>
          {meta ? 'Update' : 'Set'}
        </button>
      )}
    >
      {editing ? (
        <form onSubmit={save} className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="RAG status">
            {Object.values(RAG_STATUSES).map(m => (
              <button key={m.key} type="button" role="radio" aria-checked={status === m.key} onClick={() => setStatus(m.key)}
                className="flex flex-col items-center gap-1 rounded-xl py-2 text-[12px] font-semibold transition-colors"
                style={status === m.key
                  ? { background: m.bg, color: m.color, border: `1.5px solid ${m.color}` }
                  : { background: '#fff', color: 'var(--muted)', border: '1.5px solid var(--hairline)' }}>
                <span className="w-3 h-3 rounded-full" style={{ background: m.color, opacity: status === m.key ? 1 : 0.45 }} aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder={status === 'green' ? 'Optional: anything worth noting' : 'Why, and what’s being done about it'}
            className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white resize-none" style={{ border: '1px solid var(--hairline)' }} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)', color: '#000' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
          </div>
        </form>
      ) : meta ? (
        <div className="flex items-start gap-3">
          <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5" style={{ background: meta.color, boxShadow: `0 0 0 4px ${meta.bg}` }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold" style={{ color: meta.color }}>{meta.short} · {meta.label}</p>
            {rag.note && <p className="text-xs mt-1 leading-relaxed whitespace-pre-line" style={{ color: 'var(--ink)' }}>{rag.note}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No RAG status set yet.</p>
      )}
    </Section>
  )
}

function SetupChecklist({ todos }) {
  const done = todos.filter(t => t.done).length
  const pct = Math.round(done / todos.length * 100)
  return (
    <Section
      title="Setup to-do"
      subtitle={done === todos.length ? 'Everything on the Internal tab is filled in' : `${done} of ${todos.length} done · ticks itself off as each section is filled in`}
    >
      <div className="h-1.5 rounded-full overflow-hidden mb-3.5" style={{ background: 'var(--hairline)' }}>
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: done === todos.length ? 'var(--moss)' : 'var(--gold)' }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {todos.map(t => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => document.getElementById(t.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="w-full flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--paper)]"
            >
              <span className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                style={t.done ? { background: 'var(--moss)', color: '#fff' } : { border: '1.5px solid var(--hairline)' }}
                aria-hidden="true">{t.done ? '✓' : ''}</span>
              <span className="min-w-0">
                <span className="block text-[13px]" style={{ color: t.done ? 'var(--muted)' : 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}>
                  {t.label}<span className="sr-only">{t.done ? ' (done)' : ' (to do)'}</span>
                </span>
                {!t.done && t.detail && <span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>{t.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Pill({ tone = 'muted', children, title }) {
  const tones = {
    muted: { background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--hairline)' },
    rust: { background: 'var(--rust-bg)', color: 'var(--rust)', border: '1px solid transparent' },
    amber: { background: '#FFFCE8', color: '#8A7A00', border: '1px solid transparent' },
    moss: { background: 'var(--moss-bg)', color: 'var(--moss)', border: '1px solid transparent' },
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={tones[tone]} title={title}>
      {children}
    </span>
  )
}

// Header stat tile: big number, label, optional rail or hint underneath.
function Stat({ label, value, sub, tone, children }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 flex flex-col" style={{ border: '1px solid var(--hairline)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
        {sub && <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{sub}</span>}
      </div>
      <div className="font-mono text-[22px] font-semibold leading-tight mt-1"
        style={{ color: tone === 'rust' ? 'var(--rust)' : tone === 'moss' ? 'var(--moss)' : 'var(--ink)' }}>
        {value}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

const STEP_STATUS = {
  not_started: { label: 'Not started', bg: 'var(--paper)', color: 'var(--muted)', border: 'var(--hairline)' },
  in_progress: { label: 'In progress', bg: '#e7f4fb', color: '#017aaa', border: '#cbe7f5' },
  complete: { label: 'Complete', bg: 'var(--moss-bg)', color: 'var(--moss)', border: '#cfe6d7' },
  not_required: { label: 'Not required', bg: '#f2ecfb', color: '#6b3fa0', border: '#e2d6f5' },
}

// Status as a coloured pill that is also the select (read-only users just
// see the pill).
function StatusSelect({ value, onChange, disabled }) {
  const meta = STEP_STATUS[value] || STEP_STATUS.not_started
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="status-pill text-[11.5px] font-semibold rounded-full pl-2.5 pr-6 py-1 focus:outline-none cursor-pointer disabled:cursor-default"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
      {Object.entries(STEP_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
    </select>
  )
}

// Small segmented control (billing model, region, status, RAID filter).
function SegButtons({ options, value, onPick, disabled }) {
  return (
    <div className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
      {options.map(([v, label]) => (
        <button key={v} type="button" disabled={disabled} onClick={() => onPick(v)}
          className="text-xs font-medium px-3 py-1 rounded-md transition-colors disabled:opacity-60"
          style={value === v ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function daysFromToday(val) {
  if (!val) return null
  const d = new Date(val)
  if (isNaN(d)) return null
  return Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

// "in 12 days" / "3 days ago" / "today"
function relativeDays(n) {
  if (n === null) return ''
  if (n === 0) return 'today'
  const abs = Math.abs(n)
  const unit = abs === 1 ? 'day' : 'days'
  return n > 0 ? `in ${abs} ${unit}` : `${abs} ${unit} ago`
}

// Edits one billing meter: current usage + contracted limit, with a utilisation bar.
function MeterEditor({ meter, data, onSave, editable = true }) {
  const [usage, setUsage] = useState(data?.value ?? '')
  const [limit, setLimit] = useState(data?.limit ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setUsage(data?.value ?? '')
    setLimit(data?.limit ?? '')
  }, [data?.value, data?.limit])

  const pctVal = (usage !== '' && limit !== '' && Number(limit) > 0)
    ? Math.round((Number(usage) / Number(limit)) * 100) : null
  const color = pctVal === null ? 'var(--muted)'
    : pctVal >= 100 ? 'var(--rust)' : pctVal >= 85 ? '#c99a00' : 'var(--moss)'

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const res = await onSave(usage === '' ? null : Number(usage), limit === '' ? null : Number(limit))
    setSaving(false)
    if (!res?.error) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <form onSubmit={save} className="rounded-lg p-3" style={{ border: '1px solid var(--hairline)' }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{meter.label}</span>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{meter.hint}</span>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col">
          <span className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>Usage</span>
          <input type="number" min="0" value={usage} disabled={!editable} onChange={e => setUsage(e.target.value)} placeholder="—"
            className="w-32 font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none disabled:opacity-60" style={{ border: '1px solid var(--hairline)' }} />
        </label>
        <span className="pb-2" style={{ color: 'var(--muted)' }}>/</span>
        <label className="flex flex-col">
          <span className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>Limit</span>
          <input type="number" min="0" value={limit} disabled={!editable} onChange={e => setLimit(e.target.value)} placeholder="—"
            className="w-32 font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none disabled:opacity-60" style={{ border: '1px solid var(--hairline)' }} />
        </label>
        {editable && (
          <button type="submit" disabled={saving} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
      {pctVal !== null && (
        <div className="mt-2">
          <span className="font-mono text-[11px]" style={{ color }}>{pctVal}% of limit</span>
          <div className="mt-1 h-1.5 w-full max-w-xs rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(pctVal, 100)}%`, background: color }} />
          </div>
        </div>
      )}
    </form>
  )
}

// Edits one contract allowance — limit only, no paired usage figure. Nobody
// hand-tracks actual usage against these day to day, unlike MeterEditor's
// meters, so no utilisation bar either — that would just show a permanent
// dash and imply monitoring that isn't happening.
function AllowanceRow({ meter, data, onSave, editable = true }) {
  const [limit, setLimit] = useState(data?.limit ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Same sync-on-external-change shape as MeterEditor's effect above —
  // a key-based remount was tried instead but it also fires on this row's
  // own optimistic save (patchImpl updates the same prop that would key
  // it), which unmounts the row before the "Saved" flash can show. This is
  // the correct behavior, just not the eslint-preferred shape; matches the
  // pre-existing, already-accepted pattern this component was modeled on.
  useEffect(() => { setLimit(data?.limit ?? '') }, [data?.limit])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const res = await onSave(limit === '' ? null : Number(limit))
    setSaving(false)
    if (!res?.error) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <form onSubmit={save} className="rounded-lg p-3" style={{ border: '1px solid var(--hairline)' }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{meter.label}</span>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{meter.hint}</span>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col">
          <span className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>Limit</span>
          <input type="number" min="0" value={limit} disabled={!editable} onChange={e => setLimit(e.target.value)} placeholder="—"
            className="w-40 font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none disabled:opacity-60" style={{ border: '1px solid var(--hairline)' }} />
        </label>
        {editable && (
          <button type="submit" disabled={saving} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        )}
        {data?.source === 'contract_extraction' && (
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>from uploaded contract</span>
        )}
      </div>
    </form>
  )
}

function fmtHours(n) {
  return Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 })
}

// One consultant-hours line: used of planned, remaining, and a bar that
// turns rust once the hours are over-used.
function HoursRow({ label, hint, hours }) {
  const planned = hours?.planned ?? null
  const actual = hours?.actual ?? null
  if (!hours || actual === null) {
    return (
      <div>
        <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Not tracked in Workfront yet</p>
      </div>
    )
  }
  const pct = planned ? Math.round((actual / planned) * 100) : null
  const over = planned !== null && planned > 0 && actual > planned
  const remaining = planned === null ? null : planned - actual
  const color = over ? 'var(--rust)' : pct !== null && pct >= 85 ? '#c99a00' : 'var(--moss)'
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-1.5">
        <span className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
        <span className="font-mono text-[12px]" style={{ color }}>
          {fmtHours(actual)}{planned !== null ? ` / ${fmtHours(planned)}` : ''} hrs{pct !== null ? ` · ${pct}%` : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct === null ? 0 : Math.min(pct, 100)}%`, background: color }} />
      </div>
      <p className="text-[11.5px] mt-1.5" style={{ color: over ? 'var(--rust)' : 'var(--muted)' }}>
        {remaining === null ? hint : over ? `${fmtHours(-remaining)} hrs over` : `${fmtHours(remaining)} hrs remaining`}
        {remaining !== null && !over ? ` · ${hint}` : ''}
      </p>
    </div>
  )
}

export default function ImplementationDetail({ credential, userInfo, onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [impl, setImpl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const [stepDefs, setStepDefs] = useState(null)
  const [showSteps, setShowSteps] = useState(false)
  const tpList = stepDefs?.touchpoints || TOUCH_POINTS
  const qaList = stepDefs?.qaSteps || QA_STEPS

  const [dates, setDates] = useState({})
  const [savingDates, setSavingDates] = useState(false)
  const [datesSaved, setDatesSaved] = useState(false)
  const [savingStep, setSavingStep] = useState(null)

  const [documents, setDocuments] = useState([])
  const [raidItems, setRaidItems] = useState([])
  const [showAddRaid, setShowAddRaid] = useState(false)
  const [newRaid, setNewRaid] = useState(EMPTY_RAID)
  const [addingRaid, setAddingRaid] = useState(false)
  const [editingRaid, setEditingRaid] = useState(null)
  const [editRaidData, setEditRaidData] = useState({})

  // Deep-linkable: opening a workbook writes ?qa=<step key> to the URL, so
  // "share this QA doc" is just "copy the address bar" — reopening it (or
  // a link someone sent) restores the same modal on load.
  const [openWorkbookStep, setOpenWorkbookStep] = useState(() => {
    const q = searchParams.get('qa')
    return q && QA_WORKBOOKS[q] ? q : null
  })

  function openWorkbook(stepKey) {
    setOpenWorkbookStep(stepKey)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('qa', stepKey)
      return next
    })
  }

  function closeWorkbook() {
    setOpenWorkbookStep(null)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('qa')
      return next
    })
  }

  // Raise-a-ClickUp-ticket, step one before SDC works the actual workbook.
  // raisedTickets only tracks what happened this session — the durable
  // record lives on the workbook itself (qa_workbook_entries.data.ticket),
  // shown there whenever it's reopened.
  const [raisingTicketStep, setRaisingTicketStep] = useState(null)
  const [raisedTickets, setRaisedTickets] = useState({})

  const [slackChannelId, setSlackChannelId] = useState('')
  const [savingSlack, setSavingSlack] = useState(false)
  const [workfrontProjectId, setWorkfrontProjectId] = useState('')
  const [savingWorkfront, setSavingWorkfront] = useState(false)
  const [workfrontSaved, setWorkfrontSaved] = useState(false)
  const [slackSaved, setSlackSaved] = useState(false)

  const [savingStatus, setSavingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingBau, setSavingBau] = useState(false)
  const [bauJustTriggered, setBauJustTriggered] = useState(false)

  // Internal tab (admin only)
  const [editingOrgLink, setEditingOrgLink] = useState(false)
  const [orgLinkInput, setOrgLinkInput] = useState({ orgId: '', orgName: '' })
  const [savingOrgLink, setSavingOrgLink] = useState(false)
  const [savingPricing, setSavingPricing] = useState(false)
  const [savingRegion, setSavingRegion] = useState(false)
  const [extracting, setExtracting] = useState(null) // doc being extracted, while in flight
  const [extractSeconds, setExtractSeconds] = useState(0)
  const [extractError, setExtractError] = useState(null)
  const [review, setReview] = useState(null) // { doc, metrics } once extraction returns
  const [expandedNote, setExpandedNote] = useState(null)
  const [raidFilter, setRaidFilter] = useState('open') // 'open' | 'all'
  const [avatars, setAvatars] = useState({})
  const [showAddNote, setShowAddNote] = useState(false)
  const [newNote, setNewNote] = useState(EMPTY_NOTE)
  const [addingNote, setAddingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState(null)

  useEffect(() => { getStepDefinitions(id).then(setStepDefs).catch(() => {}) }, [id])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getImplementation(credential, id).then(data => {
      if (data.error) {
        setError(data.error === 'not_found' ? 'Implementation not found.' : 'You do not have access to this implementation.')
      } else {
        setImpl(data)
        const d = {}
        DATE_FIELDS.forEach(f => { d[f.key] = data[f.key] || '' })
        setDates(d)
        setSlackChannelId(data.slackChannelId || '')
        setWorkfrontProjectId(data.workfrontProjectId || '')
        setRaidItems(data.raid || [])
        setDocuments(data.documents || [])
        setActiveTab('overview')
      }
    }).catch(() => setError('Failed to load this implementation. Please refresh.'))
      .finally(() => setLoading(false))
  }, [id, credential])

  // Account-team photos for the header (RLS: internal users only, else {}).
  useEffect(() => { listStaffAvatars().then(setAvatars).catch(() => {}) }, [])

  function patchImpl(fields) {
    setImpl(prev => ({ ...prev, ...fields }))
  }

  async function saveDates(e) {
    e.preventDefault()
    setSavingDates(true)
    await updateDates(credential, id, dates)
    patchImpl(dates)
    setSavingDates(false)
    setDatesSaved(true)
    setTimeout(() => setDatesSaved(false), 2000)
  }

  async function handleTPChange(key, status) {
    setSavingStep(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImpl(prev => ({ ...prev, touchPoints: { ...prev.touchPoints, [key]: status } }))
    } catch { /* silent */ }
    setSavingStep(null)
  }

  async function handleQAChange(key, status) {
    setSavingStep(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImpl(prev => ({ ...prev, qaSteps: { ...prev.qaSteps, [key]: status } }))
    } catch { /* silent */ }
    setSavingStep(null)
  }

  async function handleSaveWorkfrontProject(e) {
    e.preventDefault()
    setSavingWorkfront(true)
    try {
      await updateWorkfrontProject(credential, id, workfrontProjectId)
      patchImpl({ workfrontProjectId: workfrontProjectId.trim() })
      setWorkfrontSaved(true)
      setTimeout(() => setWorkfrontSaved(false), 2000)
    } catch { /* silent */ }
    setSavingWorkfront(false)
  }

  async function handleSetStatus(newStatus) {
    if (newStatus === impl.status) return
    setSavingStatus(true)
    try {
      await updateImplementationStatus(credential, id, newStatus)
      patchImpl({ status: newStatus })
    } catch { /* silent */ }
    setSavingStatus(false)
  }

  async function handleSaveRag({ status, note }) {
    const res = await updateRag(credential, id, { status, note, updatedBy: userInfo?.name || nameFromEmail(userInfo?.email) })
    if (!res.ok) throw new Error(res.error)
    patchImpl({ rag: res.rag })
  }

  async function handleSaveSlackChannel(e) {
    e.preventDefault()
    setSavingSlack(true)
    try {
      await updateSlackChannel(credential, id, slackChannelId.trim())
      patchImpl({ slackChannelId: slackChannelId.trim() })
      setSlackSaved(true)
      setTimeout(() => setSlackSaved(false), 2000)
    } catch { /* silent */ }
    setSavingSlack(false)
  }

  async function handleTriggerBauHandover() {
    if (!confirm(`Generate the BAU handover for "${impl.client_name}"?`)) return
    setSavingBau(true)
    try {
      await triggerBauHandover(credential, id)
      patchImpl({ bauHandoverStatus: 'Y' })
      setBauJustTriggered(true)
      setTimeout(() => setBauJustTriggered(false), 2000)
    } catch { /* silent */ }
    setSavingBau(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${impl.client_name}"? This permanently removes its progress, QA, RAID items, and partner access. This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteImplementation(credential, id)
      navigate('/admin', { replace: true })
    } catch {
      setDeleting(false)
    }
  }

  async function handleAddRaid(e) {
    e.preventDefault()
    if (!newRaid.title.trim()) return
    setAddingRaid(true)
    try {
      const res = await addRaidItem(credential, id, newRaid)
      setRaidItems(p => [...p, { ...newRaid, id: res.id, raised_date: new Date().toISOString().slice(0, 10) }])
      setNewRaid(EMPTY_RAID)
      setShowAddRaid(false)
    } catch { /* silent */ }
    setAddingRaid(false)
  }

  async function handleUpdateRaid(raidId) {
    try {
      await updateRaidItem(credential, raidId, editRaidData)
      setRaidItems(p => p.map(r => r.id === raidId ? { ...r, ...editRaidData } : r))
      setEditingRaid(null)
    } catch { /* silent */ }
  }

  async function handleDeleteRaid(raidId) {
    if (!confirm('Delete this RAID item?')) return
    try {
      await deleteRaidItem(credential, raidId)
      setRaidItems(p => p.filter(r => r.id !== raidId))
    } catch { /* silent */ }
  }

  async function handleSetPricingModel(value) {
    setSavingPricing(true)
    const res = await updatePricingModel(credential, id, value)
    if (!res.error) patchImpl({ pricingModel: value })
    setSavingPricing(false)
  }

  async function handleSetRegion(value) {
    setSavingRegion(true)
    const res = await updateBloomreachRegion(credential, id, value)
    if (!res.error) patchImpl({ bloomreachRegion: value })
    setSavingRegion(false)
  }

  async function saveMetric(metricKey, value, limit) {
    const res = await upsertUsageMetric(credential, id, metricKey, { value, limit })
    if (!res.error) {
      patchImpl({ usageMetrics: { ...(impl.usageMetrics || {}), [metricKey]: { value, limit, updatedAt: new Date().toISOString() } } })
    }
    return res
  }

  async function saveAllowance(metricKey, limit) {
    const res = await upsertUsageMetric(credential, id, metricKey, { value: null, limit })
    if (!res.error) {
      patchImpl({ usageMetrics: { ...(impl.usageMetrics || {}), [metricKey]: { value: null, limit, updatedAt: new Date().toISOString() } } })
    }
    return res
  }

  async function handleExtractUsage(doc) {
    setExtracting(doc.id)
    setExtractSeconds(0)
    setExtractError(null)
    const started = Date.now()
    const ticker = setInterval(() => setExtractSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    const res = await extractContractLimits(credential, id, doc.file_path)
    clearInterval(ticker)
    setExtracting(null)
    if (res.error) { setExtractError(res.error); return }
    setReview({ doc, metrics: res.metrics })
  }

  // Re-fetch after the review modal saves — simplest way to reflect
  // whichever metrics were confirmed without duplicating its save logic here.
  function handleContractSaved() {
    getImplementation(credential, id).then(data => { if (!data.error) setImpl(data) })
  }

  async function handleSaveOrgLink(e) {
    e.preventDefault()
    setSavingOrgLink(true)
    try {
      await updateBloomreachOrgLink(credential, id, orgLinkInput.orgId.trim(), orgLinkInput.orgName.trim())
      patchImpl({ bloomreachOrgId: orgLinkInput.orgId.trim(), bloomreachOrgName: orgLinkInput.orgName.trim() })
      setEditingOrgLink(false)
    } catch { /* silent */ }
    setSavingOrgLink(false)
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!newNote.title.trim()) return
    setAddingNote(true)
    try {
      const res = await addMeetingNote(credential, id, newNote)
      const saved = { ...newNote, id: res.id, source: 'manual' }
      patchImpl({ meetingNotes: [saved, ...(impl.meetingNotes || [])] })
      setNewNote(EMPTY_NOTE)
      setShowAddNote(false)
    } catch { /* silent */ }
    setAddingNote(false)
  }

  async function handleDeleteNote(noteId) {
    if (!confirm('Delete this meeting note?')) return
    setDeletingNoteId(noteId)
    try {
      await deleteMeetingNote(credential, noteId)
      patchImpl({ meetingNotes: (impl.meetingNotes || []).filter(n => n.id !== noteId) })
    } catch { /* silent */ }
    setDeletingNoteId(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
    </div>
  )

  if (error || !impl) return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />
      <div className="max-w-2xl mx-auto mt-20 text-center text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
    </div>
  )

  const isAdmin = !!impl.isAdmin
  // SDC sees everything admin sees (every tab, every field) but can only
  // ever write QA workbook entries — every other edit control below stays
  // gated to isAdmin specifically, while visibility gates use canViewAll.
  const isSDC = !!impl.isSDC
  // Viewer: same visibility as SDC but read-only everywhere (no QA workbook
  // edits, no RAID edits, no tickets) and no documents / scope of work.
  const isViewer = !!impl.isViewer
  const canViewAll = isAdmin || isSDC || isViewer
  const tp = impl.touchPoints || {}
  const qa = impl.qaSteps || {}
  const tpRequired = tpList.filter(x => (tp[x.key] || 'not_started') !== 'not_required')
  const tpCompleted = tpList.filter(x => tp[x.key] === 'complete').length
  const qaRequired = qaList.filter(x => (qa[x.key] || 'not_started') !== 'not_required')
  const qaCompleted = qaList.filter(x => qa[x.key] === 'complete').length
  const tpPct = tpRequired.length === 0 ? 100 : Math.round(tpCompleted / tpRequired.length * 100)
  const qaPct = qaRequired.length === 0 ? 100 : Math.round(qaCompleted / qaRequired.length * 100)
  const openRaid = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress').length

  const backHref = canViewAll ? '/admin' : (userInfo?.implementations?.length > 1 ? '/select' : null)
  const backLabel = canViewAll ? '← All implementations' : '← My implementations'

  const todos = canViewAll ? setupTodos(impl, impl.documents ? documents : null) : []
  const todosLeft = todos.filter(t => !t.done).length

  const tabs = [
    { key: 'overview', label: 'Overview' },
    ...(canViewAll ? [{ key: 'internal', label: 'Internal' }] : []),
  ]

  const statusMeta = IMPLEMENTATION_STATUSES[impl.status] ?? IMPLEMENTATION_STATUSES.active
  const dueIn = impl.actual_completion_date ? null : daysFromToday(impl.planned_completion_date)
  const openRaidItems = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress')
  const raidShown = raidFilter === 'open' && openRaidItems.length > 0 ? openRaidItems : raidItems
  const notes = impl.meetingNotes || []
  const scenarios = impl.scenarios || []
  const activeScenarios = scenarios.filter(sc => (sc.status || '').toLowerCase() === 'active').length

  const smallBtn = 'text-xs font-semibold px-3 py-1.5 rounded-lg'
  const goldBtn = { background: 'var(--gold)', color: '#000' }
  const inputCls = 'w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none bg-white'
  const inputStyle = { border: '1px solid var(--hairline)' }

  const raidList = (
    raidShown.length === 0 ? (
      <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>No RAID items logged yet.</p>
    ) : (
      <div className="divide-y divide-[var(--hairline)]">
        {raidShown.map(item => (
          <div key={item.id} className="py-3 first:pt-0 last:pb-0">
            {editingRaid === item.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={editRaidData.type} onChange={e => setEditRaidData(d => ({ ...d, type: e.target.value }))} className={inputCls} style={inputStyle}>
                    {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={editRaidData.status} onChange={e => setEditRaidData(d => ({ ...d, status: e.target.value }))} className={inputCls} style={inputStyle}>
                    {RAID_STATUSES.map(st => <option key={st}>{st}</option>)}
                  </select>
                </div>
                <input type="text" value={editRaidData.title} onChange={e => setEditRaidData(d => ({ ...d, title: e.target.value }))} className={inputCls} style={inputStyle} />
                <textarea value={editRaidData.description} onChange={e => setEditRaidData(d => ({ ...d, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputStyle} />
                <input type="text" value={editRaidData.owner} onChange={e => setEditRaidData(d => ({ ...d, owner: e.target.value }))} placeholder="Owner" className={inputCls} style={inputStyle} />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateRaid(item.id)} className={smallBtn} style={goldBtn}>Save</button>
                  <button onClick={() => setEditingRaid(null)} className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: (RAID_TYPE_STYLE[item.type] || {}).color || 'var(--hairline)' }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{item.title}</p>
                    {!isViewer && (
                      <div className="flex gap-2.5 shrink-0">
                        <button onClick={() => { setEditingRaid(item.id); setEditRaidData({ type: item.type, title: item.title, description: item.description, status: item.status, owner: item.owner }) }}
                          className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>Edit</button>
                        <button onClick={() => handleDeleteRaid(item.id)} className="text-xs" style={{ color: 'var(--rust)' }}>Delete</button>
                      </div>
                    )}
                  </div>
                  {item.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{item.description}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={RAID_TYPE_STYLE[item.type] || {}}>{item.type}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={RAID_STATUS_STYLE[item.status] || {}}>{item.status}</span>
                    {(item.owner || item.raised_date) && (
                      <span className="text-[11.5px] ml-1" style={{ color: 'var(--muted)' }}>
                        {item.owner}{item.owner && item.raised_date && ' · '}{item.raised_date && formatDate(item.raised_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title={isAdmin ? 'Admin — Partner Portal' : isSDC ? 'SDC — Partner Portal' : impl.isAccountTeam ? 'Account team — Partner Portal' : isViewer ? 'Viewer — Partner Portal' : 'Partner Portal'} />

      <div className="max-w-[1180px] mx-auto px-4 sm:px-7 py-7">
        {backHref && <Link to={backHref} className="text-xs font-medium hover:underline" style={{ color: 'var(--arctic-dark)' }}>{backLabel}</Link>}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11.5px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic-dark)' }}>{impl.partner_name}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: statusMeta.bg, color: statusMeta.color, border: '1px solid var(--hairline)' }}>
                {statusMeta.label}
              </span>
              <RagBadge rag={impl.rag} />
            </div>
            <h1 className="font-display text-[28px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{impl.client_name}</h1>
          </div>
          {canViewAll && (
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Account team</span>
              {impl.psmEmail || impl.csmEmail || impl.amEmail
                ? <TeamStack impl={impl} avatars={avatars} size={34} />
                : <span className="text-xs" style={{ color: 'var(--muted)' }}>Not set</span>}
            </div>
          )}
        </div>

        <div className="grid gap-3 mb-6 grid-cols-2 lg:grid-cols-4">
          <Stat label="Rollout" value={`${tpPct}%`} sub={`${tpCompleted}/${tpRequired.length}`} tone={tpPct === 100 ? 'moss' : undefined}>
            <RolloutRail total={tpRequired.length} completed={tpCompleted} color={tpPct === 100 ? 'var(--moss)' : 'var(--gold)'} size="sm" />
          </Stat>
          <Stat label="QA peer reviews" value={`${qaPct}%`} sub={`${qaCompleted}/${qaRequired.length}`} tone={qaPct === 100 ? 'moss' : undefined}>
            <RolloutRail total={qaRequired.length} completed={qaCompleted} color={qaPct === 100 ? 'var(--moss)' : 'var(--arctic)'} size="sm" />
          </Stat>
          <Stat label="Open RAID items" value={openRaid} tone={openRaid > 0 ? 'rust' : 'moss'} sub={`${raidItems.length} total`}>
            <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{openRaid > 0 ? 'Needs follow-up' : 'All clear'}</p>
          </Stat>
          <Stat
            label={impl.actual_completion_date ? 'Completed' : 'Planned completion'}
            value={formatDate(impl.actual_completion_date || impl.planned_completion_date)}
            tone={dueIn !== null && dueIn < 0 ? 'rust' : undefined}
          >
            {dueIn !== null
              ? <Pill tone={dueIn < 0 ? 'rust' : dueIn <= 14 ? 'amber' : 'muted'}>{dueIn < 0 ? `Overdue ${-dueIn}d` : relativeDays(dueIn)}</Pill>
              : <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{impl.actual_completion_date ? 'Done' : 'No date set'}</p>}
          </Stat>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="inline-flex rounded-xl p-1 mb-5 bg-white" style={{ border: '1px solid var(--hairline)' }} role="tablist">
            {tabs.map(t => (
              <button key={t.key} role="tab" aria-selected={activeTab === t.key} onClick={() => setActiveTab(t.key)}
                className="text-[13px] font-medium px-4 py-1.5 rounded-lg transition-colors"
                style={activeTab === t.key ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}>
                {t.label}
                {t.key === 'internal' && <span className="ml-1.5 text-[11px]" style={{ opacity: 0.6 }}>Bloomreach only</span>}
                {t.key === 'internal' && todosLeft > 0 && (
                  <span className="ml-1.5 text-[10.5px] font-semibold px-1.5 py-px rounded-full" style={{ background: 'var(--gold)', color: '#000' }}
                    title={`${todosLeft} setup item${todosLeft === 1 ? '' : 's'} to do`}>{todosLeft}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <Section title="Rollout" subtitle={`${tpCompleted} of ${tpRequired.length} touch points complete`}>
                <ol className="divide-y divide-[var(--hairline)]">
                  {tpList.map((item, i) => {
                    const status = tp[item.key] || 'not_started'
                    return (
                      <li key={item.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold shrink-0"
                            style={status === 'complete'
                              ? { background: 'var(--moss)', color: '#fff' }
                              : { background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                            {status === 'complete' ? '✓' : i + 1}
                          </span>
                          <span className="text-[13.5px] truncate" style={{ color: status === 'not_required' ? 'var(--muted)' : 'var(--ink)', textDecoration: status === 'not_required' ? 'line-through' : 'none' }}>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {savingStep === item.key && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
                          <StatusSelect value={status} onChange={v => handleTPChange(item.key, v)} disabled={savingStep === item.key || isSDC || isViewer} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Section>

              <Section title="QA peer reviews" subtitle={`${qaCompleted} of ${qaRequired.length} complete · open a step for its SDC review workbook`}>
                <ol className="divide-y divide-[var(--hairline)]">
                  {qaList.map((step, i) => {
                    const status = qa[step.key] || 'not_started'
                    return (
                      <li key={step.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold shrink-0"
                            style={status === 'complete'
                              ? { background: 'var(--moss)', color: '#fff' }
                              : { background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                            {status === 'complete' ? '✓' : i + 1}
                          </span>
                          {QA_WORKBOOKS[step.key] ? (
                            <button onClick={() => openWorkbook(step.key)} className="text-[13.5px] truncate text-left hover:underline underline-offset-2" style={{ color: 'var(--ink)' }}>
                              {step.label} <span style={{ color: 'var(--arctic)' }}>›</span>
                            </button>
                          ) : (
                            <span className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>{step.label}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          {canViewAll && QA_WORKBOOKS[step.key] && (isViewer ? !!raisedTickets[step.key] : true) && (
                            raisedTickets[step.key] ? (
                              <a href={raisedTickets[step.key].url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium" style={{ color: 'var(--moss)' }}>Ticket ↗</a>
                            ) : (
                              <button onClick={() => setRaisingTicketStep(step.key)} className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>Raise ticket</button>
                            )
                          )}
                          {savingStep === step.key && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
                          <StatusSelect value={status} onChange={v => handleQAChange(step.key, v)} disabled={savingStep === step.key || isSDC || isViewer} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Section>

              <Section
                title="RAID log"
                subtitle={`${raidItems.length} item${raidItems.length !== 1 ? 's' : ''}${openRaid > 0 ? ` · ${openRaid} open` : ''} — risks, actions, issues and dependencies`}
                action={
                  <div className="flex items-center gap-2 shrink-0">
                    {openRaidItems.length > 0 && openRaidItems.length < raidItems.length && (
                      <SegButtons options={[['open', `Open ${openRaidItems.length}`], ['all', `All ${raidItems.length}`]]} value={raidFilter} onPick={setRaidFilter} />
                    )}
                    {!isViewer && <button onClick={() => setShowAddRaid(v => !v)} className={smallBtn} style={goldBtn}>+ Add</button>}
                  </div>
                }
              >
                {showAddRaid && !isViewer && (
                  <form onSubmit={handleAddRaid} className="mb-4 p-3 rounded-xl space-y-2" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newRaid.type} onChange={e => setNewRaid(r => ({ ...r, type: e.target.value }))} className={inputCls} style={inputStyle}>
                        {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <select value={newRaid.status} onChange={e => setNewRaid(r => ({ ...r, status: e.target.value }))} className={inputCls} style={inputStyle}>
                        {RAID_STATUSES.map(st => <option key={st}>{st}</option>)}
                      </select>
                    </div>
                    <input type="text" required value={newRaid.title} onChange={e => setNewRaid(r => ({ ...r, title: e.target.value }))} placeholder="Title *" className={inputCls} style={inputStyle} />
                    <textarea value={newRaid.description} onChange={e => setNewRaid(r => ({ ...r, description: e.target.value }))} rows={2} placeholder="Description" className={`${inputCls} resize-none`} style={inputStyle} />
                    <input type="text" value={newRaid.owner} onChange={e => setNewRaid(r => ({ ...r, owner: e.target.value }))} placeholder="Owner" className={inputCls} style={inputStyle} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={addingRaid} className={`${smallBtn} disabled:opacity-50`} style={goldBtn}>{addingRaid ? 'Adding…' : 'Add'}</button>
                      <button type="button" onClick={() => { setShowAddRaid(false); setNewRaid(EMPTY_RAID) }} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                    </div>
                  </form>
                )}
                {raidList}
              </Section>
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <RagCard rag={impl.rag} canEdit={isAdmin} onSave={handleSaveRag} />
              <Section title="Key dates">
                <dl className="divide-y divide-[var(--hairline)]">
                  {DATE_FIELDS.map(f => {
                    const d = daysFromToday(impl[f.key])
                    const isPlanned = f.key.startsWith('planned')
                    const actualKey = f.key === 'planned_completion_date' ? 'actual_completion_date' : f.key === 'planned_go_live_date' ? 'actual_time_to_live' : null
                    const overdue = isPlanned && d !== null && d < 0 && !(actualKey && impl[actualKey])
                    return (
                      <div key={f.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <dt className="text-[13px]" style={{ color: 'var(--muted)' }}>{f.label}</dt>
                        <dd className="text-right">
                          <span className="font-mono text-[13px]" style={{ color: impl[f.key] ? 'var(--ink)' : 'var(--muted)' }}>{formatDate(impl[f.key])}</span>
                          {d !== null && (
                            <span className="block text-[11px]" style={{ color: overdue ? 'var(--rust)' : 'var(--muted)' }}>{overdue ? `overdue ${-d}d` : relativeDays(d)}</span>
                          )}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </Section>

              <Section title="Consultant hours" subtitle={impl.workfrontHours?.syncedAt ? `From Workfront · synced ${formatDateTime(impl.workfrontHours.syncedAt)}` : 'From Workfront'}>
                <div className="flex flex-col gap-5">
                  <HoursRow label="Implementation-Activation Services" hint="partner consultant hours purchased" hours={impl.workfrontHours?.activationServices} />
                  <HoursRow label="Activation Support" hint="Bloomreach PSM time" hours={impl.workfrontHours?.activationSupport} />
                  {impl.workfrontHours?.consultingServices && (
                    <HoursRow label="Additional Consulting" hint="consultancy hours on top of activation services" hours={impl.workfrontHours.consultingServices} />
                  )}
                </div>
              </Section>

              {!isViewer && (
                <Section title="Scope of work" subtitle="The SOW and related documents">
                  <ImplementationDocuments credential={credential} implementationId={id} documents={documents} editable={false} onChange={() => {}} />
                </Section>
              )}

              {!isViewer && (
                <Section title="Partner access" subtitle={`${(impl.accessEmails || []).length} ${(impl.accessEmails || []).length === 1 ? 'person' : 'people'} can see this implementation`}>
                  {(impl.accessEmails || []).length === 0 ? (
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No partner access granted yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {impl.accessEmails.map(entry => {
                        const email = entry.replace(' (partner-wide)', '')
                        return (
                          <li key={entry} className="flex items-center gap-2.5 min-w-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold shrink-0"
                              style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }} aria-hidden="true">
                              {email.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[13px] truncate" style={{ color: 'var(--ink)' }}>{email}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Section>
              )}
            </div>
          </div>
        )}

        {/* Internal — admin, SDC and viewers only, hidden from partners */}
        {activeTab === 'internal' && canViewAll && (<>
          <div className="mb-5"><SetupChecklist todos={todos} /></div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <Section
                id="setup-usage"
                title="Bloomreach org & usage"
                subtitle={impl.bloomreachOrgId ? undefined : 'Not linked yet — ask Claude to match it, or link it manually'}
                action={isAdmin && !editingOrgLink && (
                  <button onClick={() => { setOrgLinkInput({ orgId: impl.bloomreachOrgId || '', orgName: impl.bloomreachOrgName || '' }); setEditingOrgLink(true) }}
                    className="text-xs font-medium shrink-0" style={{ color: 'var(--arctic)' }}>
                    {impl.bloomreachOrgId ? 'Edit link' : 'Link org'}
                  </button>
                )}
              >
                {editingOrgLink && (
                  <form onSubmit={handleSaveOrgLink} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    <input type="text" value={orgLinkInput.orgName} onChange={e => setOrgLinkInput(v => ({ ...v, orgName: e.target.value }))} placeholder="Org name (e.g. Dormeo)" className={inputCls} style={inputStyle} />
                    <input type="text" value={orgLinkInput.orgId} onChange={e => setOrgLinkInput(v => ({ ...v, orgId: e.target.value }))} placeholder="Org ID" className={`${inputCls} font-mono`} style={inputStyle} />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" disabled={savingOrgLink} className={`${smallBtn} disabled:opacity-50`} style={goldBtn}>{savingOrgLink ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingOrgLink(false)} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                    </div>
                  </form>
                )}
                {impl.bloomreachOrgId && (
                  <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl p-3.5 mb-4" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Org</p>
                        <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{impl.bloomreachOrgName}</p>
                        <p className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{impl.bloomreachOrgId}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Billing model</p>
                        <SegButtons options={[['profiles', 'Profiles'], ['events', 'Events']]} value={impl.pricingModel || 'profiles'} onPick={handleSetPricingModel} disabled={savingPricing || !isAdmin} />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }} title="Which Loomi Connect instance the MCP should query for this client">Loomi region</p>
                        <SegButtons options={[['eu', 'EU'], ['uk', 'UK']]} value={impl.bloomreachRegion} onPick={handleSetRegion} disabled={savingRegion || !isAdmin} />
                      </div>
                    </div>

                    <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Billing meters</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(USAGE_METERS[impl.pricingModel || 'profiles']).map(meter => (
                        <MeterEditor key={meter.key} meter={meter} data={(impl.usageMetrics || {})[meter.key]} editable={isAdmin} onSave={(value, limit) => saveMetric(meter.key, value, limit)} />
                      ))}
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                      Limits from the order form, usage from the usage dashboard — these meters aren't available via the API.
                      {(impl.profileCount != null || impl.eventCount != null) && (
                        <span className="block mt-0.5">
                          Live (indicative): {fmt(impl.profileCount)} profiles · {fmt(impl.eventCount)} events
                          {impl.profileCountSyncedAt && <span> · synced {formatDateTime(impl.profileCountSyncedAt)}</span>}
                        </span>
                      )}
                    </p>

                    <h3 className="text-[11px] font-semibold uppercase tracking-wide mt-5 mb-2" style={{ color: 'var(--muted)' }}>Other contract allowances</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {CONTRACT_ALLOWANCES.map(meter => (
                        <AllowanceRow key={meter.key} meter={meter} data={(impl.usageMetrics || {})[meter.key]} editable={isAdmin} onSave={limit => saveAllowance(meter.key, limit)} />
                      ))}
                    </div>
                  </>
                )}
              </Section>

              <Section
                title="Use cases"
                subtitle={`${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''}${scenarios.length ? ` · ${activeScenarios} active` : ''}${impl.scenariosSyncedAt ? ` · synced ${formatDateTime(impl.scenariosSyncedAt)}` : ''}`}
              >
                {scenarios.length === 0 ? (
                  <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                    {impl.scenariosSyncedAt ? 'Synced, but no scenarios found in the Production project.' : 'Not synced yet — ask Claude to sync use cases for this implementation.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--hairline)]">
                    {scenarios.map(sc => {
                      const st = SCENARIO_STATUS_STYLE[(sc.status || '').toLowerCase()] || { background: 'var(--hairline)', color: 'var(--muted)' }
                      return (
                        <li key={sc.scenario_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>{sc.name}</p>
                            {sc.tags && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{sc.tags}</p>}
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={st}>{sc.status}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              <Section
                title="Meeting notes"
                subtitle={`${notes.length} note${notes.length !== 1 ? 's' : ''}`}
                action={isAdmin && <button onClick={() => setShowAddNote(v => !v)} className={smallBtn} style={goldBtn}>+ Add note</button>}
              >
                {isAdmin && showAddNote && (
                  <form onSubmit={handleAddNote} className="mb-4 p-3 rounded-xl space-y-2" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                      <input type="text" required value={newNote.title} onChange={e => setNewNote(n => ({ ...n, title: e.target.value }))} placeholder="Title *" className={inputCls} style={inputStyle} />
                      <input type="date" value={newNote.meeting_date} onChange={e => setNewNote(n => ({ ...n, meeting_date: e.target.value }))} className={`${inputCls} font-mono`} style={inputStyle} />
                    </div>
                    <textarea value={newNote.content} onChange={e => setNewNote(n => ({ ...n, content: e.target.value }))} rows={4} placeholder="Notes…" className={`${inputCls} resize-none`} style={inputStyle} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={addingNote} className={`${smallBtn} disabled:opacity-50`} style={goldBtn}>{addingNote ? 'Adding…' : 'Add'}</button>
                      <button type="button" onClick={() => { setShowAddNote(false); setNewNote(EMPTY_NOTE) }} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                    </div>
                  </form>
                )}
                {notes.length === 0 ? (
                  <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No meeting notes yet.</p>
                ) : (
                  <ul className="divide-y divide-[var(--hairline)]">
                    {notes.map(note => {
                      const isExpanded = expandedNote === note.id
                      return (
                        <li key={note.id} className="py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <button onClick={() => setExpandedNote(isExpanded ? null : note.id)} className="flex items-start gap-3 text-left flex-1 min-w-0" aria-expanded={isExpanded}>
                              <span className="font-mono text-[11.5px] w-20 shrink-0 pt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(note.meeting_date)}</span>
                              <span className="min-w-0">
                                <span className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>{note.title}</span>
                                {note.source && note.source !== 'manual' && (
                                  <span className="ml-2 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full align-middle" style={{ background: 'var(--moss-bg)', color: 'var(--moss)' }}>{note.source}</span>
                                )}
                              </span>
                            </button>
                            <div className="flex items-center gap-3 shrink-0">
                              {note.content && <span className="text-xs" style={{ color: 'var(--muted)' }}>{isExpanded ? '▾' : '▸'}</span>}
                              {isAdmin && (
                                <button onClick={() => handleDeleteNote(note.id)} disabled={deletingNoteId === note.id} className="text-xs disabled:opacity-50" style={{ color: 'var(--rust)' }}>
                                  {deletingNoteId === note.id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                          {isExpanded && note.content && (
                            <p className="text-[12.5px] mt-2 ml-[92px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{note.content}</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <Section id="setup-team" title="Account team" subtitle="The PSM is credited and notified on SDC tickets raised from here">
                <AccountTeam impl={impl} isAdmin={isAdmin} onChange={patchImpl} avatars={avatars} />
              </Section>

              {isAdmin && (
                <Section title="Status" action={savingStatus && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}>
                  <SegButtons
                    options={Object.values(IMPLEMENTATION_STATUSES).map(m => [m.key, m.label])}
                    value={impl.status || 'active'}
                    onPick={handleSetStatus}
                    disabled={savingStatus}
                  />
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
                    <button onClick={handleTriggerBauHandover} disabled={savingBau}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-70"
                      style={bauJustTriggered
                        ? { background: 'var(--moss-bg)', color: 'var(--moss)', border: '1px solid var(--moss)' }
                        : { background: '#fff', color: 'var(--ink)', border: '1px solid var(--hairline)' }}>
                      {savingBau ? 'Generating…' : bauJustTriggered ? 'BAU handover generated ✓' : 'Generate BAU handover'}
                    </button>
                  </div>
                </Section>
              )}

              <Section title="Key dates" action={datesSaved && <span className="text-xs font-medium" style={{ color: 'var(--moss)' }}>Saved ✓</span>}>
                <form onSubmit={saveDates} className="flex flex-col gap-2.5">
                  {DATE_FIELDS.map(field => (
                    <label key={field.key} className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                        {field.label}
                        {field.note && <span className="block text-[10.5px]" style={{ color: 'var(--arctic)' }}>{field.note}</span>}
                      </span>
                      <input type="date" value={dates[field.key] || ''} disabled={!isAdmin} onChange={e => setDates(d => ({ ...d, [field.key]: e.target.value }))}
                        className="w-40 font-mono rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60" style={{ border: '1px solid var(--hairline)', background: 'var(--paper)' }} />
                    </label>
                  ))}
                  {isAdmin && (
                    <button type="submit" disabled={savingDates} className="mt-1 text-xs font-semibold py-2 rounded-lg disabled:opacity-50" style={goldBtn}>
                      {savingDates ? 'Saving…' : 'Save dates'}
                    </button>
                  )}
                </form>
              </Section>

              <Section id="setup-connections" title="Connections" subtitle="Where updates post and where hours sync from">
                <form onSubmit={handleSaveSlackChannel} className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>Slack channel</span>
                    {slackSaved && <span className="text-xs font-medium" style={{ color: 'var(--moss)' }}>Saved ✓</span>}
                  </div>
                  <p className="text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>Touch point / QA updates post here. Invite the bot to the channel first, then paste its ID.</p>
                  <div className="flex gap-2">
                    <input type="text" value={slackChannelId} onChange={e => setSlackChannelId(e.target.value)} placeholder="C0123ABCD" disabled={!isAdmin} className={`${inputCls} font-mono disabled:opacity-60`} style={inputStyle} />
                    {isAdmin && <button type="submit" disabled={savingSlack} className={`${smallBtn} disabled:opacity-50`} style={goldBtn}>{savingSlack ? '…' : 'Save'}</button>}
                  </div>
                </form>
                <form onSubmit={handleSaveWorkfrontProject}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>Workfront project</span>
                    {workfrontSaved && <span className="text-xs font-medium" style={{ color: 'var(--moss)' }}>Saved ✓</span>}
                  </div>
                  <p className="text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>Holds the Activation Services / Support tasks. The hours sync only runs when this is set — paste the ID from the project's URL.</p>
                  <div className="flex gap-2">
                    <input type="text" value={workfrontProjectId} onChange={e => setWorkfrontProjectId(e.target.value)} placeholder="69fcaaa90009d30d…" disabled={!isAdmin} className={`${inputCls} font-mono disabled:opacity-60`} style={inputStyle} />
                    {isAdmin && <button type="submit" disabled={savingWorkfront} className={`${smallBtn} disabled:opacity-50`} style={goldBtn}>{savingWorkfront ? '…' : 'Save'}</button>}
                  </div>
                </form>
              </Section>

              <Section
                title="Progress steps"
                subtitle={`${stepDefs?.isCustom ? 'Custom checklist' : 'Standard checklist'} · ${tpList.length} touch points · ${qaList.length} QA steps`}
                action={isAdmin && (
                  <button onClick={() => setShowSteps(v => !v)} className="text-xs font-medium shrink-0" style={{ color: 'var(--arctic)' }}>
                    {showSteps ? 'Done' : 'Edit steps'}
                  </button>
                )}
              >
                {isAdmin && showSteps && stepDefs
                  ? <StepsManager implementationId={id} steps={stepDefs} onChanged={setStepDefs} onClose={() => setShowSteps(false)} />
                  : <p className="text-xs" style={{ color: 'var(--muted)' }}>Changes here only affect this client.</p>}
              </Section>

              {!isViewer && (
                <Section id="setup-scope" title="Scope of work" subtitle="Visible to the partner on their Overview tab">
                  <ImplementationDocuments credential={credential} implementationId={id} documents={documents} editable={isAdmin} onChange={setDocuments} onExtractUsage={isAdmin ? handleExtractUsage : undefined} />
                  {extracting && (
                    <div className="mt-2.5">
                      <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
                        Reading contract and extracting usage limits… {extractSeconds > 0 && `(${extractSeconds}s)`}
                      </p>
                      <div className="indeterminate-bar h-1.5 w-full rounded-full" />
                    </div>
                  )}
                  {extractError && <p className="text-xs mt-2" style={{ color: 'var(--rust)' }}>{extractError}</p>}
                </Section>
              )}

              {isAdmin && (
                <div className="rounded-2xl p-5" style={{ border: '1px solid #f0c9ba', background: '#fff' }}>
                  <h2 className="font-display text-[15px] font-semibold" style={{ color: 'var(--rust)' }}>Danger zone</h2>
                  <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--muted)' }}>Deleting removes this implementation and everything logged against it.</p>
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-xs font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[var(--rust-bg)] disabled:opacity-50 transition-colors" style={{ border: '1px solid var(--rust)', color: 'var(--rust)' }}>
                    {deleting ? 'Deleting…' : 'Delete implementation'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>)}
      </div>

      {openWorkbookStep && (
        <QAWorkbookModal
          credential={credential}
          implementationId={id}
          stepKey={openWorkbookStep}
          isAdmin={isAdmin || isSDC}
          readOnly={isViewer}
          clientName={impl.client_name}
          partnerName={impl.partner_name}
          onClose={closeWorkbook}
        />
      )}

      {raisingTicketStep && (
        <RaiseTicketModal
          implementationId={id}
          stepKey={raisingTicketStep}
          workbookLabel={QA_WORKBOOKS[raisingTicketStep]?.label || ''}
          clientName={impl.client_name}
          psmName={impl.psmName}
          psmEmail={impl.psmEmail}
          onClose={() => setRaisingTicketStep(null)}
          onRaised={ticket => setRaisedTickets(prev => ({ ...prev, [raisingTicketStep]: ticket }))}
        />
      )}

      {review && (
        <ContractReviewModal
          credential={credential}
          implementationId={id}
          doc={review.doc}
          metrics={review.metrics}
          currentUsageMetrics={impl.usageMetrics}
          onClose={() => setReview(null)}
          onSaved={handleContractSaved}
        />
      )}
    </div>
  )
}
