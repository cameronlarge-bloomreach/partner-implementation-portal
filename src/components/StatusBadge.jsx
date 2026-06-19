const styles = {
  'not_started': 'bg-slate-100 text-slate-600',
  'in_progress': 'bg-blue-100 text-blue-700',
  'complete': 'bg-green-100 text-green-700',
}

const labels = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'complete': 'Complete',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles['not_started']}`}>
      {labels[status] || 'Not Started'}
    </span>
  )
}
