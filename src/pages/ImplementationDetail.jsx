import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getImplementation, updateDates, updateTouchPoint,
  addAccess, removeAccess, updateImplementationStatus,
  deleteImplementation, updateSlackChannel,
  addRaidItem, updateRaidItem, deleteRaidItem, getStepDefinitions,
  addMeetingNote, deleteMeetingNote, updateBloomreachOrgLink,
  updatePricingModel, upsertUsageMetric, USAGE_METERS,
} from '../api'
import Navbar from '../components/Navbar'
import StepsManager from '../components/StepsManager'
import ImplementationDocuments from '../components/ImplementationDocuments'
import ProgressRing from '../components/ProgressRing'

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
const STATUS_DOT = { complete: 'var(--moss)', in_progress: 'var(--arctic)', not_started: 'var(--hairline)', not_required: '#c9b8e8' }

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

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${className}`} style={{ border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, pill }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>{children}</h2>
      {pill}
    </div>
  )
}

function StatusSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="text-xs rounded-lg px-2 py-1 focus:outline-none disabled:opacity-40 bg-white cursor-pointer"
      style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
      <option value="not_started">Not Started</option>
      <option value="in_progress">In Progress</option>
      <option value="complete">Complete</option>
      <option value="not_required">Not Required</option>
    </select>
  )
}

// Edits one billing meter: current usage + contracted limit, with a utilisation bar.
function MeterEditor({ meter, data, onSave }) {
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
          <input type="number" min="0" value={usage} onChange={e => setUsage(e.target.value)} placeholder="—"
            className="w-32 font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
        </label>
        <span className="pb-2" style={{ color: 'var(--muted)' }}>/</span>
        <label className="flex flex-col">
          <span className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>Limit</span>
          <input type="number" min="0" value={limit} onChange={e => setLimit(e.target.value)} placeholder="—"
            className="w-32 font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
        </label>
        <button type="submit" disabled={saving} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
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

export default function ImplementationDetail({ credential, userInfo, onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()

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

  const [expandedQANote, setExpandedQANote] = useState(null)
  const [qaNoteText, setQaNoteText] = useState({})
  const [savingQANote, setSavingQANote] = useState(null)

  const [newAccessEmail, setNewAccessEmail] = useState('')
  const [addingAccess, setAddingAccess] = useState(false)

  const [slackChannelId, setSlackChannelId] = useState('')
  const [savingSlack, setSavingSlack] = useState(false)
  const [slackSaved, setSlackSaved] = useState(false)

  const [savingStatus, setSavingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Internal tab (admin only)
  const [editingOrgLink, setEditingOrgLink] = useState(false)
  const [orgLinkInput, setOrgLinkInput] = useState({ orgId: '', orgName: '' })
  const [savingOrgLink, setSavingOrgLink] = useState(false)
  const [savingPricing, setSavingPricing] = useState(false)
  const [expandedNote, setExpandedNote] = useState(null)
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
        setRaidItems(data.raid || [])
        setDocuments(data.documents || [])
        const notes = {}
        Object.keys(data.qaSteps || {}).forEach(k => {
          if (k.endsWith('_notes')) notes[k.replace('_notes', '')] = data.qaSteps[k]
        })
        setQaNoteText(notes)
        setActiveTab('overview')
      }
    }).catch(() => setError('Failed to load this implementation. Please refresh.'))
      .finally(() => setLoading(false))
  }, [id, credential])

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

  async function handleSaveQANote(stepKey) {
    const text = qaNoteText[stepKey] || ''
    setSavingQANote(stepKey)
    try {
      await updateTouchPoint(credential, id, stepKey + '_notes', text)
      setImpl(prev => ({ ...prev, qaSteps: { ...prev.qaSteps, [stepKey + '_notes']: text } }))
    } catch { /* silent */ }
    setSavingQANote(null)
  }

  async function handleAddAccess(e) {
    e.preventDefault()
    const newEmail = newAccessEmail.trim().toLowerCase()
    if (!newEmail || (impl.accessEmails || []).includes(newEmail)) return
    setAddingAccess(true)
    try {
      await addAccess(credential, id, newEmail)
      patchImpl({ accessEmails: [...(impl.accessEmails || []), newEmail] })
      setNewAccessEmail('')
    } catch { /* silent */ }
    setAddingAccess(false)
  }

  async function handleRemoveAccess(emailToRemove) {
    try {
      await removeAccess(credential, id, emailToRemove)
      patchImpl({ accessEmails: (impl.accessEmails || []).filter(e => e !== emailToRemove) })
    } catch { /* silent */ }
  }

  async function handleToggleStatus() {
    const newStatus = impl.status === 'complete' ? 'active' : 'complete'
    setSavingStatus(true)
    try {
      await updateImplementationStatus(credential, id, newStatus)
      patchImpl({ status: newStatus })
    } catch { /* silent */ }
    setSavingStatus(false)
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

  async function saveMetric(metricKey, value, limit) {
    const res = await upsertUsageMetric(credential, id, metricKey, { value, limit })
    if (!res.error) {
      patchImpl({ usageMetrics: { ...(impl.usageMetrics || {}), [metricKey]: { value, limit, updatedAt: new Date().toISOString() } } })
    }
    return res
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
  const tp = impl.touchPoints || {}
  const qa = impl.qaSteps || {}
  const tpRequired = tpList.filter(x => (tp[x.key] || 'not_started') !== 'not_required')
  const tpCompleted = tpList.filter(x => tp[x.key] === 'complete').length
  const qaRequired = qaList.filter(x => (qa[x.key] || 'not_started') !== 'not_required')
  const qaCompleted = qaList.filter(x => qa[x.key] === 'complete').length
  const tpPct = tpRequired.length === 0 ? 100 : Math.round(tpCompleted / tpRequired.length * 100)
  const qaPct = qaRequired.length === 0 ? 100 : Math.round(qaCompleted / qaRequired.length * 100)
  const openRaid = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress').length

  const backHref = isAdmin ? '/admin' : (userInfo?.implementations?.length > 1 ? '/select' : null)
  const backLabel = isAdmin ? '← All partners' : '← My implementations'

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'setup', label: 'Setup' },
    ...(isAdmin ? [{ key: 'internal', label: 'Internal' }] : []),
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title={isAdmin ? 'Admin — Partner Portal' : 'Partner Portal'} />

      <div className="max-w-[1120px] mx-auto px-7 py-7">
        {backHref && <Link to={backHref} className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>{backLabel}</Link>}

        {/* Hero card */}
        <div className="bg-white rounded-[20px] p-6 mt-3.5 mb-5" style={{ border: '1px solid var(--hairline)' }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11.5px] font-semibold uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>{impl.partner_name}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: impl.status === 'complete' ? 'var(--moss-bg)' : 'var(--hairline)', color: impl.status === 'complete' ? 'var(--moss)' : 'var(--muted)' }}>
                  {impl.status === 'complete' ? 'Complete' : 'Active'}
                </span>
              </div>
              <h1 className="font-display text-[26px] font-semibold" style={{ color: 'var(--ink)' }}>{impl.client_name}</h1>
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--muted)' }}>{(impl.accessEmails || []).join(', ') || 'No partner access granted yet'}</p>
            </div>
            <div className="flex items-center gap-7">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={tpPct} size={64} color="var(--gold)" />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold" style={{ color: 'var(--ink)' }}>{tpPct}%</span>
                </div>
                <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>Progress</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={qaPct} size={64} color="var(--arctic)" />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold" style={{ color: 'var(--arctic)' }}>{qaPct}%</span>
                </div>
                <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>QA</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-mono text-lg font-semibold"
                  style={{ background: openRaid > 0 ? 'var(--rust-bg)' : 'var(--moss-bg)', color: openRaid > 0 ? 'var(--rust)' : 'var(--moss)' }}>
                  {openRaid}
                </div>
                <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>Open RAID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-white rounded-xl p-1 mb-5 w-fit" style={{ border: '1px solid var(--hairline)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="text-[13px] font-medium px-4 py-2 rounded-[9px] transition-colors"
              style={activeTab === t.key ? { background: 'var(--gold)', color: '#000' } : { background: 'transparent', color: 'var(--muted)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <SectionTitle>Partner Access</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {(impl.accessEmails || []).length === 0 ? (
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>No partner access granted yet.</span>
                ) : impl.accessEmails.map(email => (
                  <span key={email} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                    {email}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Scope of Work</SectionTitle>
              <ImplementationDocuments credential={credential} implementationId={id} documents={documents} editable={false} onChange={() => {}} />
              {isAdmin && (
                <p className="text-xs mt-2.5" style={{ color: 'var(--muted)' }}>
                  Slack channel: <span className="font-mono">{impl.slackChannelId || 'Not set'}</span>
                </p>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <SectionTitle>Key Dates</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {DATE_FIELDS.map(f => (
                  <div key={f.key}>
                    <p className="text-[11.5px] mb-0.5" style={{ color: 'var(--muted)' }}>{f.label}</p>
                    <p className="font-mono text-sm" style={{ color: 'var(--ink)' }}>{formatDate(impl[f.key])}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle pill={
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full text-black" style={{ background: 'var(--gold)' }}>{tpPct}%</span>
              }>Touch Points</SectionTitle>
              <div>
                {tpList.map(item => {
                  const status = tp[item.key] || 'not_started'
                  return (
                    <div key={item.key} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--paper)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[status] }} />
                        <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {savingStep === item.key && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
                        <StatusSelect value={status} onChange={v => handleTPChange(item.key, v)} disabled={savingStep === item.key} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card>
              <SectionTitle pill={
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: qaPct === 100 ? 'var(--moss-bg)' : 'var(--arctic)', color: qaPct === 100 ? 'var(--moss)' : '#fff' }}>{qaPct}%</span>
              }>QA Peer Reviews</SectionTitle>
              <div>
                {qaList.map((step, i) => {
                  const status = qa[step.key] || 'not_started'
                  const noteExpanded = expandedQANote === step.key
                  const currentNote = qaNoteText[step.key] || ''
                  return (
                    <div key={step.key} className="border-b last:border-0" style={{ borderColor: 'var(--paper)' }}>
                      <div className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs w-4 flex-shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[status] }} />
                          <span className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>{step.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <button onClick={() => setExpandedQANote(noteExpanded ? null : step.key)} className="text-xs font-medium" style={{ color: currentNote ? 'var(--arctic)' : 'var(--muted)' }}>
                            {currentNote ? 'Note ✓' : 'Note'}
                          </button>
                          {savingStep === step.key && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
                          <StatusSelect value={status} onChange={v => handleQAChange(step.key, v)} disabled={savingStep === step.key} />
                        </div>
                      </div>
                      {noteExpanded && (
                        <div className="pb-3 pl-6">
                          <textarea value={currentNote} onChange={e => setQaNoteText(n => ({ ...n, [step.key]: e.target.value }))}
                            rows={3} placeholder="Add QA feedback or notes…"
                            className="w-full rounded-lg px-3 py-2 text-xs resize-none focus:outline-none"
                            style={{ border: '1px solid var(--hairline)', background: 'var(--paper)', color: 'var(--ink)' }} />
                          <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={() => handleSaveQANote(step.key)} disabled={savingQANote === step.key}
                              className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50 text-black" style={{ background: 'var(--gold)' }}>
                              {savingQANote === step.key ? 'Saving…' : 'Save note'}
                            </button>
                            <button onClick={() => setExpandedQANote(null)} className="text-xs" style={{ color: 'var(--muted)' }}>Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <SectionTitle pill={
                <button onClick={() => setShowAddRaid(v => !v)} className="text-xs font-semibold px-3.5 py-1.5 rounded-[9px] text-black" style={{ background: 'var(--gold)' }}>+ Add</button>
              }>RAID Log — {raidItems.length} item{raidItems.length !== 1 ? 's' : ''}{openRaid > 0 ? `, ${openRaid} open` : ''}</SectionTitle>

              {showAddRaid && (
                <form onSubmit={handleAddRaid} className="mb-4 p-3 rounded-xl space-y-2.5 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newRaid.type} onChange={e => setNewRaid(r => ({ ...r, type: e.target.value }))}
                      className="w-full rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                      {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <select value={newRaid.status} onChange={e => setNewRaid(r => ({ ...r, status: e.target.value }))}
                      className="w-full rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                      {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <input type="text" required value={newRaid.title} onChange={e => setNewRaid(r => ({ ...r, title: e.target.value }))}
                    placeholder="Title *" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                  <textarea value={newRaid.description} onChange={e => setNewRaid(r => ({ ...r, description: e.target.value }))}
                    rows={2} placeholder="Description" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none resize-none" style={{ border: '1px solid var(--hairline)' }} />
                  <input type="text" value={newRaid.owner} onChange={e => setNewRaid(r => ({ ...r, owner: e.target.value }))}
                    placeholder="Owner" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingRaid} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                      {addingRaid ? 'Adding…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => { setShowAddRaid(false); setNewRaid(EMPTY_RAID) }} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                  </div>
                </form>
              )}

              {raidItems.length === 0 ? (
                <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>No RAID items logged yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {raidItems.map(item => (
                    <div key={item.id} className="rounded-xl p-3.5" style={{ border: '1px solid var(--hairline)' }}>
                      {editingRaid === item.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <select value={editRaidData.type} onChange={e => setEditRaidData(d => ({ ...d, type: e.target.value }))}
                              className="rounded-lg px-2 py-1 text-xs bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                              {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <select value={editRaidData.status} onChange={e => setEditRaidData(d => ({ ...d, status: e.target.value }))}
                              className="rounded-lg px-2 py-1 text-xs bg-white focus:outline-none" style={{ border: '1px solid var(--hairline)' }}>
                              {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <input type="text" value={editRaidData.title} onChange={e => setEditRaidData(d => ({ ...d, title: e.target.value }))}
                            className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                          <textarea value={editRaidData.description} onChange={e => setEditRaidData(d => ({ ...d, description: e.target.value }))}
                            rows={2} className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none resize-none" style={{ border: '1px solid var(--hairline)' }} />
                          <input type="text" value={editRaidData.owner} onChange={e => setEditRaidData(d => ({ ...d, owner: e.target.value }))}
                            placeholder="Owner" className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateRaid(item.id)} className="text-black text-xs font-medium px-3 py-1 rounded-lg" style={{ background: 'var(--gold)' }}>Save</button>
                            <button onClick={() => setEditingRaid(null)} className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={RAID_TYPE_STYLE[item.type] || {}}>{item.type}</span>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={RAID_STATUS_STYLE[item.status] || {}}>{item.status}</span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => { setEditingRaid(item.id); setEditRaidData({ type: item.type, title: item.title, description: item.description, status: item.status, owner: item.owner }) }}
                                className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>Edit</button>
                              <button onClick={() => handleDeleteRaid(item.id)} className="text-xs" style={{ color: 'var(--rust)' }}>Delete</button>
                            </div>
                          </div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{item.title}</p>
                          {item.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{item.description}</p>}
                          <p className="font-mono text-[11.5px] mt-2" style={{ color: 'var(--muted)' }}>
                            {item.owner && `Owner: ${item.owner}`}{item.owner && item.raised_date && ' · '}{item.raised_date && formatDate(item.raised_date)}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Setup */}
        {activeTab === 'setup' && (
          <div className="flex flex-col gap-5">
            <Card>
              <SectionTitle>Partner Access</SectionTitle>
              <div className="flex flex-wrap gap-1.5 mb-3.5">
                {(impl.accessEmails || []).length === 0 ? (
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>No partner access granted yet.</span>
                ) : impl.accessEmails.map(email => (
                  <span key={email} className="inline-flex items-center gap-1.5 text-xs font-medium pl-3 pr-2 py-1.5 rounded-full" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                    {email}
                    {isAdmin && <button onClick={() => handleRemoveAccess(email)} className="leading-none" style={{ color: 'var(--muted)' }}>×</button>}
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddAccess} className="flex gap-2 max-w-sm">
                <input type="email" required value={newAccessEmail} onChange={e => setNewAccessEmail(e.target.value)}
                  placeholder="partner@company.com" className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                <button type="submit" disabled={addingAccess} className="disabled:opacity-50 text-black text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90" style={{ background: 'var(--gold)' }}>
                  {addingAccess ? 'Adding…' : isAdmin ? 'Grant access' : 'Invite'}
                </button>
              </form>
            </Card>

            {isAdmin && (
              <Card>
                <div className="flex items-center justify-between mb-3.5">
                  <SectionTitle>Slack Notifications</SectionTitle>
                  {slackSaved && <span className="text-xs font-medium -mt-3.5" style={{ color: 'var(--moss)' }}>Saved!</span>}
                </div>
                <p className="text-xs mb-3 -mt-2.5" style={{ color: 'var(--muted)' }}>
                  Partner touch point/QA updates post to this channel. Invite the bot to the channel first (<span className="font-mono">/invite @YourAppName</span>), then paste its channel ID below.
                </p>
                <form onSubmit={handleSaveSlackChannel} className="flex gap-2 max-w-sm">
                  <input type="text" value={slackChannelId} onChange={e => setSlackChannelId(e.target.value)} placeholder="C0123ABCD"
                    className="flex-1 font-mono rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                  <button type="submit" disabled={savingSlack} className="disabled:opacity-50 text-black text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90" style={{ background: 'var(--gold)' }}>
                    {savingSlack ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </Card>
            )}

            {isAdmin && (
              <Card>
                <div className="flex items-center justify-between mb-3.5">
                  <SectionTitle>Key Dates</SectionTitle>
                  {datesSaved && <span className="text-xs font-medium -mt-3.5" style={{ color: 'var(--moss)' }}>Saved!</span>}
                </div>
                <form onSubmit={saveDates} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {DATE_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                        {field.label}
                        {field.note && <span className="ml-1" style={{ color: 'var(--arctic)' }}>({field.note})</span>}
                      </label>
                      <input type="date" value={dates[field.key] || ''} onChange={e => setDates(d => ({ ...d, [field.key]: e.target.value }))}
                        className="w-full font-mono rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={{ border: '1px solid var(--hairline)', background: 'var(--paper)' }} />
                    </div>
                  ))}
                  <button type="submit" disabled={savingDates} className="sm:col-span-4 disabled:opacity-50 text-black text-sm font-medium py-2 rounded-lg transition-opacity hover:opacity-90" style={{ background: 'var(--gold)' }}>
                    {savingDates ? 'Saving…' : 'Save dates'}
                  </button>
                </form>
              </Card>
            )}

            {isAdmin && (
              <Card>
                <SectionTitle>Scope of Work</SectionTitle>
                <p className="text-xs -mt-2.5 mb-3" style={{ color: 'var(--muted)' }}>The partner's SOW and any related documents. Visible to the partner on their Overview tab.</p>
                <ImplementationDocuments credential={credential} implementationId={id} documents={documents} editable={true} onChange={setDocuments} />
              </Card>
            )}

            {isAdmin && (
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <SectionTitle>Progress Steps</SectionTitle>
                    <p className="text-xs -mt-3" style={{ color: 'var(--muted)' }}>
                      {stepDefs?.isCustom ? 'Custom checklist for this client.' : 'Using the standard checklist.'} {tpList.length} touch points · {qaList.length} QA steps
                    </p>
                  </div>
                  <button onClick={() => setShowSteps(v => !v)} className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                    {showSteps ? 'Done' : 'Edit steps'}
                  </button>
                </div>
                {showSteps && stepDefs && (
                  <div className="mt-4">
                    <StepsManager implementationId={id} steps={stepDefs} onChanged={setStepDefs} onClose={() => setShowSteps(false)} />
                  </div>
                )}
              </Card>
            )}

            {isAdmin && (
              <Card>
                <SectionTitle>Implementation Actions</SectionTitle>
                <div className="flex items-center gap-2">
                  <button onClick={handleToggleStatus} disabled={savingStatus}
                    className="text-xs font-medium px-3.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                    {savingStatus ? 'Saving…' : impl.status === 'complete' ? 'Reopen' : 'Mark Complete'}
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-xs font-medium px-3.5 py-1.5 rounded-lg hover:bg-[var(--rust-bg)] disabled:opacity-50 transition-colors" style={{ border: '1px solid var(--rust)', color: 'var(--rust)' }}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Internal — admin only */}
        {activeTab === 'internal' && isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted)' }} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Bloomreach-internal — hidden from the partner</span>
            </div>
            <div className="flex flex-col gap-5">
              <Card>
                <div className="flex items-center justify-between mb-2.5">
                  <SectionTitle>Bloomreach Org</SectionTitle>
                  {!editingOrgLink && (
                    <button onClick={() => { setOrgLinkInput({ orgId: impl.bloomreachOrgId || '', orgName: impl.bloomreachOrgName || '' }); setEditingOrgLink(true) }}
                      className="text-xs font-medium -mt-3.5" style={{ color: 'var(--arctic)' }}>
                      {impl.bloomreachOrgId ? 'Edit' : 'Link org'}
                    </button>
                  )}
                </div>

                {editingOrgLink ? (
                  <form onSubmit={handleSaveOrgLink} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" value={orgLinkInput.orgName} onChange={e => setOrgLinkInput(v => ({ ...v, orgName: e.target.value }))}
                      placeholder="Org name (e.g. Dormeo)" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                    <input type="text" value={orgLinkInput.orgId} onChange={e => setOrgLinkInput(v => ({ ...v, orgId: e.target.value }))}
                      placeholder="Org ID" className="w-full font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{ border: '1px solid var(--hairline)' }} />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" disabled={savingOrgLink} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                        {savingOrgLink ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingOrgLink(false)} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                    </div>
                  </form>
                ) : impl.bloomreachOrgId ? (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>{impl.bloomreachOrgName}</span>
                      <span className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>{impl.bloomreachOrgId}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full ml-auto" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
                        {impl.pricingModel === 'events' ? 'Events' : 'Profiles'}
                      </span>
                    </div>
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
                      <p className="text-[10px] font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Billing model</p>
                      <div className="flex gap-2 mb-3">
                        {[['profiles', 'Profiles'], ['events', 'Events']].map(([value, label]) => {
                          const active = (impl.pricingModel || 'profiles') === value
                          return (
                            <button key={value} disabled={savingPricing} onClick={() => handleSetPricingModel(value)}
                              className="text-xs font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={active ? { background: 'var(--gold)', color: '#000', border: '1px solid var(--gold)' } : { background: '#fff', color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      <div className="space-y-3">
                        {(USAGE_METERS[impl.pricingModel || 'profiles']).map(meter => (
                          <MeterEditor key={meter.key} meter={meter} data={(impl.usageMetrics || {})[meter.key]} onSave={(value, limit) => saveMetric(meter.key, value, limit)} />
                        ))}
                      </div>
                      <p className="text-[11px] mt-3 italic" style={{ color: 'var(--muted)' }}>
                        Enter from the order form (limit) and usage dashboard (usage) — these meters aren't available via the API.
                        {(impl.profileCount !== null && impl.profileCount !== undefined) || (impl.eventCount !== null && impl.eventCount !== undefined) ? (
                          <span className="block mt-0.5">
                            Live (indicative): {fmt(impl.profileCount)} profiles · {fmt(impl.eventCount)} events
                            {impl.profileCountSyncedAt && <span> · synced {formatDateTime(impl.profileCountSyncedAt)}</span>}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Not linked yet — ask Claude to match this implementation to its Bloomreach org, or link it manually above.</p>
                )}
              </Card>

              <Card>
                <SectionTitle>Use Cases</SectionTitle>
                <p className="text-xs -mt-2.5 mb-3" style={{ color: 'var(--muted)' }}>
                  {(impl.scenarios || []).length} scenario{(impl.scenarios || []).length !== 1 ? 's' : ''}
                  {impl.scenariosSyncedAt && <span> · Last synced {formatDateTime(impl.scenariosSyncedAt)}</span>}
                </p>
                {(impl.scenarios || []).length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {impl.scenariosSyncedAt ? 'Synced, but no scenarios found in the Production project' : 'Not synced yet — ask Claude to sync use cases for this implementation'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {impl.scenarios.map(sc => {
                      const style = SCENARIO_STATUS_STYLE[(sc.status || '').toLowerCase()] || { background: 'var(--hairline)', color: 'var(--muted)' }
                      return (
                        <div key={sc.scenario_id} className="flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5" style={{ border: '1px solid var(--hairline)' }}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{sc.name}</p>
                            {sc.tags && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sc.tags}</p>}
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={style}>{sc.status}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <SectionTitle pill={
                  <button onClick={() => setShowAddNote(v => !v)} className="text-xs font-semibold px-3.5 py-1.5 rounded-[9px] text-black" style={{ background: 'var(--gold)' }}>+ Add note</button>
                }>Meeting Notes</SectionTitle>

                {showAddNote && (
                  <form onSubmit={handleAddNote} className="mb-4 p-3 rounded-xl space-y-2.5 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input type="text" required value={newNote.title} onChange={e => setNewNote(n => ({ ...n, title: e.target.value }))}
                        placeholder="Title *" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)' }} />
                      <input type="date" value={newNote.meeting_date} onChange={e => setNewNote(n => ({ ...n, meeting_date: e.target.value }))}
                        className="w-full font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)' }} />
                    </div>
                    <textarea value={newNote.content} onChange={e => setNewNote(n => ({ ...n, content: e.target.value }))}
                      rows={4} placeholder="Notes…" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none resize-none bg-white" style={{ border: '1px solid var(--hairline)' }} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={addingNote} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                        {addingNote ? 'Adding…' : 'Add'}
                      </button>
                      <button type="button" onClick={() => { setShowAddNote(false); setNewNote(EMPTY_NOTE) }} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                    </div>
                  </form>
                )}

                {(impl.meetingNotes || []).length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No meeting notes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {impl.meetingNotes.map(note => {
                      const isExpanded = expandedNote === note.id
                      return (
                        <div key={note.id} className="rounded-xl p-3" style={{ border: '1px solid var(--hairline)' }}>
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => setExpandedNote(isExpanded ? null : note.id)} className="text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{note.title}</span>
                                {note.source && note.source !== 'manual' && (
                                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--moss-bg)', color: 'var(--moss)' }}>{note.source}</span>
                                )}
                              </div>
                              <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(note.meeting_date)}</div>
                            </button>
                            <button onClick={() => handleDeleteNote(note.id)} disabled={deletingNoteId === note.id} className="text-xs disabled:opacity-50 flex-shrink-0" style={{ color: 'var(--rust)' }}>
                              {deletingNoteId === note.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                          {isExpanded && note.content && (
                            <p className="text-xs mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{note.content}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
