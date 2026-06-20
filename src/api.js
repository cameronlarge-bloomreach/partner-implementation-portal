// All calls go through the Apps Script Web App URL.
// The auth token (Google ID token or magic-link session token) is sent
// with every request so Apps Script can verify the caller and enforce
// data isolation server-side.

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

async function request(params) {
  const url = new URL(APPS_SCRIPT_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { redirect: 'follow' })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

async function post(body) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for doPost
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function getMyImplementations(token) {
  return request({ action: 'getMyImplementations', token })
}

export async function getImplementation(token, implementationId) {
  return request({ action: 'getImplementation', token, implementationId })
}

export async function getAllImplementations(token) {
  return request({ action: 'getAllImplementations', token })
}

export async function updateTouchPoint(token, implementationId, key, status) {
  return post({ action: 'updateTouchPoint', token, implementationId, key, status })
}

export async function updateDates(token, implementationId, dates) {
  return post({ action: 'updateDates', token, implementationId, dates })
}

export async function addRaidItem(token, implementationId, item) {
  return post({ action: 'addRaidItem', token, implementationId, item })
}

export async function updateRaidItem(token, id, fields) {
  return post({ action: 'updateRaidItem', token, id, fields })
}

export async function deleteRaidItem(token, id) {
  return post({ action: 'deleteRaidItem', token, id })
}

export async function addImplementation(token, data) {
  return post({ action: 'addImplementation', token, data })
}

export async function updateImplementationStatus(token, implementationId, status) {
  return post({ action: 'updateImplementationStatus', token, implementationId, status })
}

export async function deleteImplementation(token, implementationId) {
  return post({ action: 'deleteImplementation', token, implementationId })
}

export async function updateSlackChannel(token, implementationId, slackChannelId) {
  return post({ action: 'updateSlackChannel', token, implementationId, slackChannelId })
}

export async function addAccess(token, implementationId, email) {
  return post({ action: 'addAccess', token, implementationId, email })
}

export async function removeAccess(token, implementationId, email) {
  return post({ action: 'removeAccess', token, implementationId, email })
}

export async function requestMagicLink(email) {
  return post({ action: 'requestMagicLink', email })
}

export async function verifyMagicLink(email, magicToken) {
  return post({ action: 'verifyMagicLink', email, magicToken })
}
