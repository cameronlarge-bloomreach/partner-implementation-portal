// All calls go through the Apps Script Web App URL.
// The Google ID token is sent with every request so Apps Script
// can verify the caller and enforce data isolation server-side.

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

export async function getMyImplementation(idToken) {
  return request({ action: 'getImplementation', token: idToken })
}

export async function updateTouchPoint(idToken, implementationEmail, key, status) {
  return post({ action: 'updateTouchPoint', token: idToken, email: implementationEmail, key, status })
}

export async function getAllImplementations(idToken) {
  return request({ action: 'getAllImplementations', token: idToken })
}

export async function updateDates(idToken, email, dates) {
  return post({ action: 'updateDates', token: idToken, email, dates })
}

export async function addRaidItem(idToken, email, item) {
  return post({ action: 'addRaidItem', token: idToken, email, item })
}

export async function updateRaidItem(idToken, id, fields) {
  return post({ action: 'updateRaidItem', token: idToken, id, fields })
}

export async function deleteRaidItem(idToken, id) {
  return post({ action: 'deleteRaidItem', token: idToken, id })
}
