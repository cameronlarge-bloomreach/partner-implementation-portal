// "What's new" entries shown to admins after a portal update — see
// WhatsNewModal.jsx. Newest first. `version` is just the ship date (ISO,
// sorts correctly as a string) — add a new entry here whenever a real,
// admin-visible change ships, rather than trying to auto-generate this
// from git history.
export const CHANGELOG = [
  {
    version: '2026-10-02',
    date: '2 October 2026',
    items: [
      'New "Consultant Hours" card on each implementation (Overview) — Implementation-Activation Services hours used vs purchased, and Activation Support (PSM) hours used vs planned, synced daily from Workfront.',
      'Link an implementation to its Workfront project from the Internal tab (Workfront Project) — 19 are linked already; the rest need their project ID pasting in.',
    ],
  },
  {
    version: '2026-10-01b',
    date: '1 October 2026',
    items: [
      'Removed the "Setup" tab on implementation pages — partner access management moved to the admin Permissions page, and everything else (Slack, Key Dates, Scope of Work, Progress Steps, Implementation Actions) now lives in the Internal tab alongside the rest of the internal-only info.',
    ],
  },
  {
    version: '2026-09-22',
    date: '22 September 2026',
    items: [
      'Portal is now live at bloomreach-blimp.com, its own domain.',
      'Switched to the Bloomreach Sans typeface across the whole app.',
      'Dashboard stat tiles (Active / Pending / Closed / Open RAID / Overdue) are now clickable — they jump to or filter the implementation list.',
      'A "what\'s new" pop-up (this one) now shows admins what changed after each update.',
      'New "Usage" health check flags implementations whose contracted usage data is missing, mismatched for their pricing model, or hasn\'t been updated in over 60 days.',
      'Admins can now upload a Sales Order PDF and have usage limits extracted automatically for review (Setup tab → Scope of Work → "Extract usage limits" on a PDF) — nothing saves until you confirm each value.',
    ],
  },
  {
    version: '2026-09-23',
    date: '23 September 2026',
    items: [
      'New "Generate BAU Handover" button on the Setup tab (next to the Closed status button).',
    ],
  },
  {
    version: '2026-09-29',
    date: '29 September 2026',
    items: [
      'Portal moved to its new domain, partner-blimp.com (bloomreach-blimp.com never cleared its registrar review).',
    ],
  },
  {
    version: '2026-09-30',
    date: '30 September 2026',
    items: [
      'Removed email sign-in links — sign in with email + password, or "Forgot password?" to set one.',
    ],
  },
  {
    version: '2026-10-01',
    date: '1 October 2026',
    items: [
      'New admin "Permissions" page (Dashboard → Permissions) — see who has access to what, grant or revoke access to a partner, a single implementation, or admin/SDC, for anyone whether or not they\'ve signed up yet.',
    ],
  },
]
