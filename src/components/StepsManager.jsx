import { useState } from 'react'
import {
  getStepDefinitions, addStepDefinition, updateStepDefinition, deleteStepDefinition,
} from '../api'

// Edits the progress/QA checklists for ONE implementation. The first edit
// forks the shared template into this implementation's own copy, so changes
// never leak across clients.
export default function StepsManager({ implementationId, steps, onChanged, onClose }) {
  const [error, setError] = useState(null)

  async function run(promise) {
    setError(null)
    const res = await promise
    if (res?.error) setError(res.error)
    else onChanged(await getStepDefinitions(implementationId))
  }

  return (
    <div className="no-print bg-white rounded-2xl p-6 mb-6" style={{ border: '1px solid var(--hairline)' }}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>Progress steps</h2>
        {onClose && <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>Close</button>}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        {steps.isCustom
          ? 'This implementation has its own checklist. Changes here affect only this client.'
          : 'Using the standard checklist. Your first change here creates a copy for this client only — other implementations keep the standard steps.'}
      </p>
      {error && <div className="text-sm mb-3" style={{ color: 'var(--rust)' }}>{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StepColumn title="Touch points" category="touchpoint" items={steps.touchpoints} run={run} implementationId={implementationId} />
        <StepColumn title="QA steps" category="qa" items={steps.qaSteps} run={run} implementationId={implementationId} />
      </div>
    </div>
  )
}

function StepColumn({ title, category, items, run, implementationId }) {
  const [newLabel, setNewLabel] = useState('')
  const [editingKey, setEditingKey] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  function move(idx, dir) {
    const other = idx + dir
    if (other < 0 || other >= items.length) return
    run(Promise.all([
      updateStepDefinition(items[idx], { position: items[other].position }, implementationId),
      updateStepDefinition(items[other], { position: items[idx].position }, implementationId),
    ]).then(rs => rs.find(r => r.error) || { ok: true }))
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{title}</h3>
      <ul className="space-y-1.5">
        {items.map((s, idx) => (
          <li key={s.key} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: '1px solid var(--hairline)' }}>
            {editingKey === s.key ? (
              <>
                <input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="flex-1 rounded px-2 py-1 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                  autoFocus
                />
                <button
                  className="text-xs font-medium"
                  style={{ color: 'var(--moss)' }}
                  onClick={() => { run(updateStepDefinition(s, { label: editLabel.trim() }, implementationId)); setEditingKey(null) }}
                >Save</button>
                <button className="text-xs" style={{ color: 'var(--muted)' }} onClick={() => setEditingKey(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>{s.label}</span>
                <button className="text-xs px-1" style={{ color: 'var(--muted)' }} title="Move up" onClick={() => move(idx, -1)}>↑</button>
                <button className="text-xs px-1" style={{ color: 'var(--muted)' }} title="Move down" onClick={() => move(idx, 1)}>↓</button>
                <button
                  className="text-xs font-medium px-1"
                  style={{ color: 'var(--arctic)' }}
                  onClick={() => { setEditingKey(s.key); setEditLabel(s.label) }}
                >Rename</button>
                <button
                  className="text-xs px-1"
                  style={{ color: 'var(--rust)' }}
                  onClick={() => { if (confirm(`Remove "${s.label}" from this implementation's checklist?`)) run(deleteStepDefinition(s, implementationId)) }}
                >Remove</button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm italic px-1" style={{ color: 'var(--muted)' }}>No steps.</li>}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={e => { e.preventDefault(); if (newLabel.trim()) { run(addStepDefinition(category, newLabel, implementationId)); setNewLabel('') } }}
      >
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder={`New ${category === 'qa' ? 'QA step' : 'touch point'}…`}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid var(--hairline)' }}
        />
        <button
          type="submit"
          className="text-black text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{ background: 'var(--gold)' }}
        >Add</button>
      </form>
    </div>
  )
}
