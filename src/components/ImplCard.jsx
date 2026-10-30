import { Link } from 'react-router-dom'
import { IMPLEMENTATION_STATUSES } from '../api'
import { stepsDone, openRaidCount, daysUntil, setupTodos, viewOf, nameFromEmail } from '../implStatus'
import RolloutRail from './RolloutRail'
import RagBadge from './RagBadge'

// Implementation card, shared by the admin dashboard and the partner home
// page so both read the same way.

function Flag({ tone, children, title }) {
  const styles = {
    rust: { background: 'var(--rust-bg)', color: 'var(--rust)' },
    amber: { background: '#FFFCE8', color: '#8A7A00' },
    muted: { background: 'var(--paper)', color: 'var(--muted)' },
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={styles[tone]} title={title}>
      {children}
    </span>
  )
}

function DueLabel({ impl }) {
  const d = daysUntil(impl.planned_completion_date)
  if (d == null) return null
  const date = new Date(impl.planned_completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (d < 0) return <Flag tone="rust" title={`Planned completion ${date}`}>Overdue {-d}d</Flag>
  if (d <= 14) return <Flag tone="amber" title={`Planned completion ${date}`}>Due in {d}d</Flag>
  return <Flag tone="muted">Due {date}</Flag>
}

// Account team avatar stack (PSM, CSM, AM). Photos come from staff_avatars
// (Slack profile pictures); anyone without one gets their initials. The
// team fields are internal-only, so partners never see this.
const TEAM_ROLES = [['psm', 'PSM'], ['csm', 'CSM'], ['am', 'AM']]

export function TeamStack({ impl, avatars, size = 28 }) {
  // One bubble per person, even if they hold more than one role here.
  const people = []
  for (const [key, label] of TEAM_ROLES) {
    const email = (impl[`${key}Email`] || '').toLowerCase()
    if (!email) continue
    const existing = people.find(p => p.email === email)
    if (existing) { existing.roles.push(label); continue }
    const name = avatars[email]?.name || impl[`${key}Name`] || nameFromEmail(email)
    people.push({ email, name, roles: [label], photo: avatars[email]?.photoUrl })
  }
  if (!people.length) return null
  return (
    <div className="flex items-center shrink-0 -space-x-1.5" aria-label={people.map(p => `${p.roles.join(' & ')}: ${p.name}`).join(', ')}>
      {people.map(p => (
        <span
          key={p.email}
          title={`${p.roles.join(' & ')} · ${p.name}`}
          className="relative inline-flex items-center justify-center rounded-full overflow-hidden font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.36, background: 'var(--paper)', color: 'var(--ink)', boxShadow: '0 0 0 2px #fff' }}
        >
          {p.photo
            ? <img src={p.photo} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            : p.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </span>
      ))}
    </div>
  )
}

function Rail({ label, done, total, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{done}/{total}</span>
      </div>
      <RolloutRail total={total} completed={done} color={total && done === total ? 'var(--moss)' : color} size="sm" />
    </div>
  )
}

// showTodos: the Internal-tab setup checklist is Bloomreach-only, so the
// partner home page leaves it off.
export default function ImplCard({ impl, tpKeys, qaKeys, showPartner, to, showTodos = true, avatars = {}, index = 0 }) {
  const view = viewOf(impl)
  const openRaid = openRaidCount(impl)
  const todosLeft = showTodos && view === 'active' ? setupTodos(impl, impl.documents).filter(t => !t.done) : []
  const status = IMPLEMENTATION_STATUSES[impl.status] ?? IMPLEMENTATION_STATUSES.active
  const showRag = view === 'active' && !!impl.rag?.status

  return (
    <Link
      to={to}
      className="impl-card pressable card-enter flex flex-col bg-white rounded-2xl p-4"
      style={{ border: '1px solid var(--hairline)', '--i': Math.min(index, 10) }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{impl.client_name}</div>
          {showPartner && <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{impl.partner_name}</div>}
        </div>
        <TeamStack impl={impl} avatars={avatars} />
      </div>

      {(view !== 'active' || showRag || impl.planned_completion_date || openRaid > 0 || todosLeft.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {view === 'active'
            ? <DueLabel impl={impl} />
            : <Flag tone="muted"><span style={{ color: status.color }}>{status.label}</span></Flag>}
          {showRag && <RagBadge rag={impl.rag} />}
          {view === 'active' && openRaid > 0 && <Flag tone="rust">{openRaid} open RAID</Flag>}
          {todosLeft.length > 0 && (
            <Flag tone="amber" title={`To do: ${todosLeft.map(t => t.label).join(' · ')}`}>
              {todosLeft.length} to-do{todosLeft.length === 1 ? '' : 's'}
            </Flag>
          )}
        </div>
      )}

      {view !== 'pending' && (
        <div className="space-y-2.5 mt-auto pt-4">
          <Rail label="Rollout" done={stepsDone(impl.touchPoints, tpKeys)} total={tpKeys.length} color="var(--gold)" />
          <Rail label="QA" done={stepsDone(impl.qaSteps, qaKeys)} total={qaKeys.length} color="var(--arctic)" />
        </div>
      )}
    </Link>
  )
}
