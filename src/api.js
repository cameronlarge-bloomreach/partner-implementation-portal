// Data layer backed by Supabase (replaces the Apps Script Web App).
//
// Function signatures are kept identical to the old Apps Script layer so
// the page components don't change: every function still accepts `token`
// as its first argument, but it is ignored — the supabase client carries
// the session internally. Response shapes mirror the old buildImplResponse.

import { supabase } from './supabaseClient'

function fail(error) {
  return { error: error.message || String(error) }
}

const IMPL_DATE_KEYS = [
  'contract_sign_date', 'planned_completion_date', 'target_completion_date',
  'actual_completion_date', 'planned_go_live_date', 'target_time_to_live',
  'actual_time_to_live',
]

function splitTouchPoints(rows) {
  const touchPoints = {}
  const qaSteps = {}
  for (const r of rows) {
    if (r.key.startsWith('qa_')) qaSteps[r.key] = r.status
    else touchPoints[r.key] = r.status
  }
  return { touchPoints, qaSteps }
}

function shapeRaid(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    status: r.status,
    owner: r.owner,
    raised_date: r.raised_date || '',
  }
}

function shapeNote(n) {
  return {
    id: n.id,
    title: n.title,
    meeting_date: n.meeting_date || '',
    content: n.content,
    source: n.source,
    granola_meeting_id: n.granola_meeting_id,
    created_at: n.created_at,
  }
}

function shapeScenario(s) {
  return { scenario_id: s.scenario_id, name: s.name, status: s.status, tags: s.tags }
}

function shapeScope(s) {
  return { id: s.id, category: s.category, title: s.title, detail: s.detail || '', position: s.position }
}

function buildImplResponse(impl, tpRows, raidRows, isAdmin, accessEmails, noteRows, scenarioRows, scopeRows) {
  const { touchPoints, qaSteps } = splitTouchPoints(tpRows)
  const resp = {
    id: impl.id,
    partner_name: impl.partner_name,
    client_name: impl.client_name,
    status: impl.status || 'active',
    isAdmin,
    accessEmails,
    slackChannelId: isAdmin ? (impl.slack_channel_id || '') : undefined,
    touchPoints,
    qaSteps,
    raid: raidRows.map(shapeRaid),
    scope: (scopeRows || []).map(shapeScope),
    meetingNotes: isAdmin ? noteRows.map(shapeNote) : [],
    bloomreachOrgId: isAdmin ? (impl.bloomreach_org_id || '') : undefined,
    bloomreachOrgName: isAdmin ? (impl.bloomreach_org_name || '') : undefined,
    scenariosSyncedAt: isAdmin ? (impl.scenarios_synced_at || '') : undefined,
    scenarios: isAdmin ? scenarioRows.map(shapeScenario) : [],
    profileCount: isAdmin ? (impl.profile_count ?? null) : undefined,
    profileCountSyncedAt: isAdmin ? (impl.profile_count_synced_at || '') : undefined,
    // Bloomreach bills either on profiles or on events — the model decides
    // which usage figure the Control Centre leads with.
    pricingModel: impl.pricing_model || 'profiles',
    eventCount: isAdmin ? (impl.event_count ?? null) : undefined,
    eventCountSyncedAt: isAdmin ? (impl.event_count_synced_at || '') : undefined,
    profileLimit: isAdmin ? (impl.profile_limit ?? null) : undefined,
    eventLimit: isAdmin ? (impl.event_limit ?? null) : undefined,
  }
  for (const key of IMPL_DATE_KEYS) resp[key] = impl[key] || ''
  return resp
}

async function callerIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) throw error
  return data === true
}

// ---- Reads ----

export async function getMyImplementations() {
  try {
    const [isAdmin, { data: impls, error }] = await Promise.all([
      callerIsAdmin(),
      supabase.from('implementations').select('id, partner_name, client_name').order('partner_name'),
    ])
    if (error) throw error
    if (!isAdmin && impls.length === 0) return { error: 'unauthorized' }
    return { isAdmin, implementations: impls }
  } catch (e) { return fail(e) }
}

export async function getImplementation(_token, implementationId) {
  try {
    const isAdmin = await callerIsAdmin()
    const [impl, tps, raid, scope, access, notes, scenarios] = await Promise.all([
      supabase.from('implementations').select('*').eq('id', implementationId).maybeSingle(),
      supabase.from('touch_points').select('key, status').eq('implementation_id', implementationId),
      supabase.from('raid_items').select('*').eq('implementation_id', implementationId).order('created_at'),
      supabase.from('scope_items').select('*').eq('implementation_id', implementationId).order('category').order('position'),
      supabase.from('access').select('email').eq('implementation_id', implementationId),
      isAdmin
        ? supabase.from('meeting_notes').select('*').eq('implementation_id', implementationId).order('meeting_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase.from('scenario_sync').select('*').eq('implementation_id', implementationId).order('name')
        : Promise.resolve({ data: [] }),
    ])
    const firstError = [impl, tps, raid, scope, access, notes, scenarios].find(r => r.error)
    if (firstError) throw firstError.error
    if (!impl.data) return { error: 'not_found' }
    const partnerGrants = await supabase.from('partner_access')
      .select('email').ilike('partner_name', impl.data.partner_name)
    const emails = [
      ...access.data.map(a => a.email),
      ...(partnerGrants.data || []).map(g => `${g.email} (partner-wide)`),
    ]
    return buildImplResponse(
      impl.data, tps.data, raid.data, isAdmin,
      emails, notes.data, scenarios.data, scope.data,
    )
  } catch (e) { return fail(e) }
}

export async function getAllImplementations() {
  try {
    const [impls, tps, raid, scope, access, notes, scenarios, partnerGrants] = await Promise.all([
      supabase.from('implementations').select('*').order('partner_name'),
      supabase.from('touch_points').select('implementation_id, key, status'),
      supabase.from('raid_items').select('*').order('created_at'),
      supabase.from('scope_items').select('*').order('position'),
      supabase.from('access').select('email, implementation_id'),
      supabase.from('meeting_notes').select('*').order('meeting_date', { ascending: false }),
      supabase.from('scenario_sync').select('*').order('name'),
      supabase.from('partner_access').select('email, partner_name'),
    ])
    const firstError = [impls, tps, raid, scope, access, notes, scenarios].find(r => r.error)
    if (firstError) throw firstError.error
    const grantsByPartner = {}
    for (const g of partnerGrants.data || []) {
      (grantsByPartner[g.partner_name.toLowerCase()] ||= []).push(`${g.email} (partner-wide)`)
    }
    const byImpl = (rows) => {
      const map = {}
      for (const r of rows) (map[r.implementation_id] ||= []).push(r)
      return map
    }
    const tpMap = byImpl(tps.data)
    const raidMap = byImpl(raid.data)
    const scopeMap = byImpl(scope.data)
    const accessMap = byImpl(access.data)
    const noteMap = byImpl(notes.data)
    const scenarioMap = byImpl(scenarios.data)
    return impls.data.map(impl => buildImplResponse(
      impl, tpMap[impl.id] || [], raidMap[impl.id] || [], true,
      [
        ...(accessMap[impl.id] || []).map(a => a.email),
        ...(grantsByPartner[(impl.partner_name || '').toLowerCase()] || []),
      ],
      noteMap[impl.id] || [], scenarioMap[impl.id] || [], scopeMap[impl.id] || [],
    ))
  } catch (e) { return fail(e) }
}

// ---- Writes ----

export async function updateTouchPoint(_token, implementationId, key, status) {
  const { error } = await supabase.from('touch_points')
    .upsert({ implementation_id: implementationId, key, status })
  return error ? fail(error) : { ok: true }
}

export async function updateDates(_token, implementationId, dates) {
  const patch = {}
  for (const key of IMPL_DATE_KEYS) {
    if (dates[key] !== undefined) patch[key] = dates[key] === '' ? null : dates[key]
  }
  const { error } = await supabase.from('implementations').update(patch).eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

export async function addRaidItem(_token, implementationId, item) {
  const { data, error } = await supabase.from('raid_items').insert({
    implementation_id: implementationId,
    type: item.type || 'risk',
    title: item.title || '',
    description: item.description || '',
    status: item.status || 'open',
    owner: item.owner || '',
    raised_date: item.raised_date || null,
  }).select('id').single()
  return error ? fail(error) : { ok: true, id: data.id }
}

export async function updateRaidItem(_token, id, fields) {
  const patch = { ...fields }
  if (patch.raised_date === '') patch.raised_date = null
  const { error } = await supabase.from('raid_items').update(patch).eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function deleteRaidItem(_token, id) {
  const { error } = await supabase.from('raid_items').delete().eq('id', id)
  return error ? fail(error) : { ok: true }
}

// ---- Scope of work (admin-editable, partner-visible) ----

export async function addScopeItem(_token, implementationId, item) {
  const { data: existing } = await supabase.from('scope_items')
    .select('position').eq('implementation_id', implementationId).eq('category', item.category)
    .order('position', { ascending: false }).limit(1)
  const position = (existing?.[0]?.position || 0) + 1
  const { data, error } = await supabase.from('scope_items').insert({
    implementation_id: implementationId,
    category: item.category,
    title: (item.title || '').trim(),
    detail: (item.detail || '').trim(),
    position,
  }).select('id').single()
  return error ? fail(error) : { ok: true, id: data.id }
}

export async function updateScopeItem(_token, id, fields) {
  const { error } = await supabase.from('scope_items').update(fields).eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function deleteScopeItem(_token, id) {
  const { error } = await supabase.from('scope_items').delete().eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function addImplementation(_token, data) {
  if (!data.client_name) return { error: 'missing_client_name' }
  const { data: impl, error } = await supabase.from('implementations').insert({
    partner_name: data.partner_name || '',
    client_name: data.client_name,
    slack_channel_id: (data.slackChannelId || '').trim(),
  }).select('id').single()
  if (error) return fail(error)
  const emails = String(data.emails || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (emails.length) {
    const { error: accessError } = await supabase.from('access')
      .upsert(emails.map(email => ({ email, implementation_id: impl.id })))
    if (accessError) return fail(accessError)
  }
  return { ok: true, id: impl.id }
}

export async function updateImplementationStatus(_token, implementationId, status) {
  const { error } = await supabase.from('implementations').update({ status }).eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

export async function deleteImplementation(_token, implementationId) {
  const { error } = await supabase.from('implementations').delete().eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

export async function updateSlackChannel(_token, implementationId, slackChannelId) {
  const { error } = await supabase.from('implementations')
    .update({ slack_channel_id: (slackChannelId || '').trim() }).eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

export async function addAccess(_token, implementationId, email) {
  const { error } = await supabase.from('access')
    .upsert({ email: email.trim().toLowerCase(), implementation_id: implementationId })
  return error ? fail(error) : { ok: true }
}

export async function removeAccess(_token, implementationId, email) {
  const { error } = await supabase.from('access').delete()
    .eq('implementation_id', implementationId).eq('email', email.trim().toLowerCase())
  return error ? fail(error) : { ok: true }
}

export async function addMeetingNote(_token, implementationId, note) {
  const { data, error } = await supabase.from('meeting_notes').insert({
    implementation_id: implementationId,
    title: note.title || '',
    meeting_date: note.meeting_date || null,
    content: note.content || '',
    source: note.source || 'manual',
    granola_meeting_id: note.granola_meeting_id || '',
  }).select('id').single()
  return error ? fail(error) : { ok: true, id: data.id }
}

export async function deleteMeetingNote(_token, id) {
  const { error } = await supabase.from('meeting_notes').delete().eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function updatePricingModel(_token, implementationId, pricingModel) {
  const { error } = await supabase.from('implementations')
    .update({ pricing_model: pricingModel }).eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

// field is 'profile_limit' or 'event_limit'; value is a number or null to clear.
export async function updateUsageLimit(_token, implementationId, field, value) {
  if (!['profile_limit', 'event_limit'].includes(field)) return { error: 'Invalid limit field' }
  const { error } = await supabase.from('implementations')
    .update({ [field]: value }).eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

export async function updateBloomreachOrgLink(_token, implementationId, orgId, orgName) {
  const { error } = await supabase.from('implementations')
    .update({ bloomreach_org_id: orgId || '', bloomreach_org_name: orgName || '' })
    .eq('id', implementationId)
  return error ? fail(error) : { ok: true }
}

// ---- Auth (Supabase email magic link, PKCE flow) ----

export async function requestMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  return error ? fail(error) : { ok: true }
}

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  return error ? fail(error) : { ok: true }
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin + window.location.pathname,
  })
  return error ? fail(error) : { ok: true }
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  return error ? fail(error) : { ok: true }
}

// ---- Progress step definitions ----
// Falls back to the original hardcoded steps until
// supabase/partner-access-and-steps.sql has been run.

export const DEFAULT_STEPS = {
  touchpoints: [
    { key: 'account_creation', label: 'Account Creation' },
    { key: 'frontend_data', label: 'Front End Data' },
    { key: 'backend_data', label: 'Backend Data' },
    { key: 'integration_sms', label: 'SMS Integration' },
    { key: 'integration_email', label: 'Email Integration' },
    { key: 'integration_whatsapp', label: 'WhatsApp Integration' },
    { key: 'use_cases', label: 'Use Cases' },
  ],
  qaSteps: [
    { key: 'qa_peer_review_1', label: 'ID Validation' },
    { key: 'qa_peer_review_2', label: 'Back End Tracking' },
    { key: 'qa_peer_review_3', label: 'Front End Tracking' },
    { key: 'qa_peer_review_4', label: 'Use Cases Data Check & Debugging' },
    { key: 'qa_peer_review_5', label: 'Data Mapping' },
    { key: 'qa_peer_review_6', label: 'Expiration & Data Cleanliness' },
  ],
}

// Steps are per-implementation. An implementation with no rows of its own
// inherits the global template (implementation_id is null); the first edit
// forks that template into its own copy so other clients are unaffected.
export async function getStepDefinitions(implementationId = null) {
  try {
    const shape = (rows, custom) => ({
      touchpoints: rows.filter(s => s.category === 'touchpoint'),
      qaSteps: rows.filter(s => s.category === 'qa'),
      isCustom: custom,
    })
    if (implementationId) {
      const { data: own } = await supabase.from('step_definitions')
        .select('id, key, label, category, position')
        .eq('implementation_id', implementationId).order('position')
      if (own?.length) return shape(own, true)
    }
    const { data, error } = await supabase.from('step_definitions')
      .select('id, key, label, category, position')
      .is('implementation_id', null).order('position')
    if (error || !data?.length) return { ...DEFAULT_STEPS, isCustom: false }
    return shape(data, false)
  } catch {
    return { ...DEFAULT_STEPS, isCustom: false }
  }
}

// Copies the global template into this implementation so it can be edited
// without touching every other client. No-op if it already has its own.
async function forkStepsFor(implementationId) {
  const { data: own } = await supabase.from('step_definitions')
    .select('id').eq('implementation_id', implementationId).limit(1)
  if (own?.length) return { ok: true }
  const { data: template } = await supabase.from('step_definitions')
    .select('key, label, category, position').is('implementation_id', null)
  const rows = (template?.length ? template : [
    ...DEFAULT_STEPS.touchpoints.map((s, i) => ({ ...s, category: 'touchpoint', position: i + 1 })),
    ...DEFAULT_STEPS.qaSteps.map((s, i) => ({ ...s, category: 'qa', position: i + 1 })),
  ]).map(s => ({ ...s, implementation_id: implementationId }))
  const { error } = await supabase.from('step_definitions').insert(rows)
  return error ? fail(error) : { ok: true }
}

export async function addStepDefinition(category, label, implementationId) {
  if (implementationId) {
    const forked = await forkStepsFor(implementationId)
    if (forked.error) return forked
  }
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const key = `${category === 'qa' ? 'qa_' : ''}${base}_${Date.now().toString(36)}`
  const q = supabase.from('step_definitions').select('position').eq('category', category)
  const { data: existing } = await (implementationId
    ? q.eq('implementation_id', implementationId)
    : q.is('implementation_id', null)).order('position', { ascending: false }).limit(1)
  const position = (existing?.[0]?.position || 0) + 1
  const { error } = await supabase.from('step_definitions')
    .insert({ key, label: label.trim(), category, position, implementation_id: implementationId || null })
  return error ? fail(error) : { ok: true, key }
}

// `step` is a row from getStepDefinitions (needs id, key) so we can tell an
// inherited template row from one this implementation already owns.
export async function updateStepDefinition(step, fields, implementationId) {
  if (implementationId) {
    const forked = await forkStepsFor(implementationId)
    if (forked.error) return forked
    const { error } = await supabase.from('step_definitions')
      .update(fields).eq('implementation_id', implementationId).eq('key', step.key)
    return error ? fail(error) : { ok: true }
  }
  const { error } = await supabase.from('step_definitions')
    .update(fields).is('implementation_id', null).eq('key', step.key)
  return error ? fail(error) : { ok: true }
}

export async function deleteStepDefinition(step, implementationId) {
  if (implementationId) {
    const forked = await forkStepsFor(implementationId)
    if (forked.error) return forked
    const { error } = await supabase.from('step_definitions')
      .delete().eq('implementation_id', implementationId).eq('key', step.key)
    return error ? fail(error) : { ok: true }
  }
  const { error } = await supabase.from('step_definitions')
    .delete().is('implementation_id', null).eq('key', step.key)
  return error ? fail(error) : { ok: true }
}

// ---- Sign-up approval ----

// target: { type: 'admin' } | { type: 'partner', partnerName } | { type: 'implementation', id }
export async function approveSignup(email, target) {
  const clean = email.trim().toLowerCase()
  if (target.type === 'admin') {
    const { error } = await supabase.from('admin_emails').insert({ email: clean })
    return error ? fail(error) : { ok: true }
  }
  if (target.type === 'partner') {
    const { error } = await supabase.from('partner_access')
      .upsert({ email: clean, partner_name: target.partnerName })
    return error ? fail(error) : { ok: true }
  }
  const { error } = await supabase.from('access')
    .upsert({ email: clean, implementation_id: target.id })
  return error ? fail(error) : { ok: true }
}

// Accounts that exist but have no implementation access and aren't admins —
// shown on the admin dashboard for approval. Returns [] until the profiles
// table exists (supabase/pending-signups.sql).
// Declining marks the profile rather than deleting the auth user — removing
// a user needs the service role key, which the browser must never hold.
// A declined person keeps their account but stays on the waiting screen.
export async function declineSignup(profileId) {
  const { error } = await supabase.from('profiles')
    .update({ declined: true, decided_at: new Date().toISOString() }).eq('id', profileId)
  return error ? fail(error) : { ok: true }
}

export async function getPendingSignups() {
  try {
    const [profiles, access, admins, partnerGrants] = await Promise.all([
      supabase.from('profiles').select('id, email, created_at').eq('declined', false).order('created_at', { ascending: false }),
      supabase.from('access').select('email'),
      supabase.from('admin_emails').select('email'),
      supabase.from('partner_access').select('email'),
    ])
    if (profiles.error) return []
    const known = new Set([
      ...(access.data || []).map(a => a.email),
      ...(admins.data || []).map(a => a.email),
      ...(partnerGrants.data || []).map(a => a.email),
    ])
    return profiles.data.filter(p => !known.has(p.email))
  } catch {
    return []
  }
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) return fail(error)
  // Supabase returns an obfuscated existing user (no identities) rather than
  // an error when the email is already registered.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists. Sign in instead, or use “Forgot password?”.' }
  }
  return { ok: true, needsConfirmation: !data.session }
}

export async function signOut() {
  // scope: 'local' ends only this device's session — signing out on one
  // device no longer logs the user out everywhere.
  await supabase.auth.signOut({ scope: 'local' })
}

// Builds the userInfo object App.jsx keeps in state, from a live session.
export async function loadUserInfo(session) {
  const info = await getMyImplementations()
  if (info.error) return { error: info.error, email: session.user.email }
  return {
    email: session.user.email,
    name: session.user.email,
    isAdmin: info.isAdmin,
    implementations: info.implementations,
  }
}
