// "What's new" entries shown to admins after a portal update — see
// WhatsNewModal.jsx. Newest first. `version` is just the ship date (ISO,
// sorts correctly as a string) — add a new entry here whenever a real,
// admin-visible change ships, rather than trying to auto-generate this
// from git history.
export const CHANGELOG = [
  {
    version: '2026-09-22',
    date: '22 September 2026',
    items: [
      'Portal is now live at bloomreach-blimp.com, its own domain.',
      'Switched to the Bloomreach Sans typeface across the whole app.',
      'Dashboard stat tiles (Active / Pending / Closed / Open RAID / Overdue) are now clickable — they jump to or filter the implementation list.',
    ],
  },
]
