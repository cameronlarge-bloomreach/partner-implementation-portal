// Mirrors supabase/functions/raise-sdc-ticket/index.ts — these are display
// labels only (the edge function holds the real ClickUp field/option ids
// and is the source of truth); keep the label lists identical to it.

export const JOB_TYPE_OPTIONS = [
  'Warmup Scenario',
  'Manuel Testing of Use Cases (fixed use cases)',
  'Consent page adjustments',
  'Catalog Vadliation and Recs test',
  'Website/App QA data validation',
  'Cloning UCC use cases',
  'New Channel Admin SMS WA',
  'Data Audits',
  'Basic Weblayers',
  'New market expansion',
  'Ad Hoc',
]

export const PRIORITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW']
