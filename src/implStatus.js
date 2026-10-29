import { USAGE_METERS } from './api'

// Status helpers for an implementation card/list — shared by the admin
// dashboard and the partner home page.

export function stepsDone(map, keys) {
  return keys.filter(k => (map || {})[k] === 'complete').length
}

export function openRaidCount(impl) {
  return (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
}

export function daysUntil(date) {
  if (!date) return null
  const ms = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86400000)
}

export function isOverdue(impl) {
  const d = daysUntil(impl.planned_completion_date)
  return d != null && d < 0
}

// Internal-tab setup checklist — derived from what's already saved on the
// implementation, so items tick themselves off as each section is filled in
// (nothing to maintain by hand). `target` is the Internal-tab Section id it
// jumps to. Pass documents as null when the caller can't see them (viewers),
// so the scope item is left out rather than always looking outstanding.
export function setupTodos(impl, documents) {
  const meters = USAGE_METERS[impl.pricingModel || 'profiles']
  const limitsSet = meters.filter(m => (impl.usageMetrics || {})[m.key]?.limit).length
  const team = [['PSM', impl.psmName], ['CSM', impl.csmName], ['AM', impl.amName]]
  const missingTeam = team.filter(([, name]) => !name).map(([role]) => role)
  return [
    { key: 'slack', label: 'Add the Slack channel', done: !!impl.slackChannelId, target: 'setup-connections' },
    { key: 'workfront', label: 'Link the Workfront project', done: !!impl.workfrontProjectId, target: 'setup-connections' },
    {
      key: 'team', label: 'Assign the project team', done: missingTeam.length === 0, target: 'setup-team',
      detail: missingTeam.length && missingTeam.length < team.length ? `Missing ${missingTeam.join(', ')}` : null,
    },
    {
      key: 'usage', label: 'Add usage limits', done: !!impl.bloomreachOrgId && limitsSet === meters.length, target: 'setup-usage',
      detail: !impl.bloomreachOrgId ? 'Link the Bloomreach org first' : limitsSet ? `${limitsSet} of ${meters.length} meters set` : null,
    },
    ...(documents ? [{ key: 'scope', label: 'Upload the scope of work', done: documents.length > 0, target: 'setup-scope' }] : []),
  ]
}

export function viewOf(impl) {
  return impl.status === 'pending' ? 'pending' : impl.status === 'complete' ? 'closed' : 'active'
}

// priya.shah@bloomreach.com -> "Priya Shah"
export function nameFromEmail(email) {
  return (email || '').split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

// Distinct lowercased PSM / CSM / AM emails on an implementation. Empty for
// partners — the team fields are internal-only.
export function teamEmails(impl) {
  return Array.from(new Set(['psm', 'csm', 'am']
    .map(k => (impl[`${k}Email`] || '').toLowerCase()).filter(Boolean)))
}
