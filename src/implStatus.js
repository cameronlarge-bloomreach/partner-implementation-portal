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

// Contracted billing meters are manual entry (no API source) — flag when
// they're missing, look mismatched for the client's pricing model, or
// haven't been touched in a while, so someone goes and checks them.
const STALE_USAGE_DAYS = 60

export function usageIssue(impl) {
  const required = USAGE_METERS[impl.pricingModel] || USAGE_METERS.profiles
  const other = USAGE_METERS[impl.pricingModel === 'profiles' ? 'events' : 'profiles']
  const metrics = impl.usageMetrics || {}

  const missing = required.filter(m => metrics[m.key]?.value == null || metrics[m.key]?.limit == null)
  if (missing.length) return `missing ${missing.map(m => m.label).join(', ')}`

  const wrongModel = other.filter(m => metrics[m.key]?.value != null)
  if (wrongModel.length) return `has ${impl.pricingModel === 'profiles' ? 'event' : 'profile'} data despite being on the ${impl.pricingModel} model`

  const stalest = required.map(m => metrics[m.key]?.updatedAt).filter(Boolean).sort()[0]
  if (stalest && (Date.now() - new Date(stalest)) / 86400000 > STALE_USAGE_DAYS) return `stale (last updated over ${STALE_USAGE_DAYS} days ago)`

  return null
}

export function viewOf(impl) {
  return impl.status === 'pending' ? 'pending' : impl.status === 'complete' ? 'closed' : 'active'
}
