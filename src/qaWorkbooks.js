// Content for the interactive QA Workbooks — one per QA Peer Review step.
// Sourced from the SDC team's "Bloomreach QA Workbook" review docs (2026-09).
// Guidance lines prefixed with '· ' render as an indented sub-bullet.
//
// Each step's `checks` are what SDC works through and scores Pass / Pass
// with comments / Fail / N/A (+ optional severity + notes). Filled values
// live in the qa_workbook_entries table, one row per (implementation, step).

const INTRO = "This workbook is completed by the Service Delivery Centre and returned to the partner. Work through each check in order, mark a status, and use the notes field to record what was seen — screenshots, event names, IDs. Anything marked Fail or Pass with comments must be addressed in the action list."

export const QA_WORKBOOKS = {
  qa_peer_review_1: {
    label: 'ID Validation',
    reviewNumber: 1,
    scope: 'Account & projects',
    reviewer: 'Technical Consultant',
    intro: INTRO,
    checks: [
      {
        key: 'c1', title: 'Project ID Form',
        guidance: [
          'Open the completed Project ID Form from the project Slack channel.',
          'Confirm it has been signed via DocuSign by the client.',
          'Check the basics are correct:',
          '· Client company name and project name',
          '· Region',
          '· Bloomreach products (Marketing, Search, etc.)',
          '· Pricing model and profile / event limits match the contract',
          '· Instance type — Shared, Private, or Exclusive',
          '· Number of projects / environments matches the SOW',
        ],
      },
      {
        key: 'c2', title: 'Account & project setup',
        guidance: [
          'Log into the Bloomreach Cloud Organization and open the workspace.',
          "Check the workspace name follows naming conventions, e.g. 'ClientName Region'.",
          'Confirm the correct number of projects have been created and are linked to the workspace.',
          'Verify timezone and currency settings are correct.',
          'Check data retention settings align with the contract.',
        ],
      },
      {
        key: 'c3', title: 'User access',
        guidance: [
          'Check the main client stakeholder has Cloud Org Admin + Workspace Admin access.',
          'Verify partner users have appropriate access for implementation.',
          'Confirm roles are assigned under the correct Application:',
          "· 'Engagement' or 'Discovery' — day-to-day platform users",
          "· 'Data Hub' — Event Streams, Item Collections, and Data Hub features",
          "· 'Administration' — org-level roles such as Cloud Org Admin and SSO Admin",
          'If SSO is required, verify it is configured at the Cloud Organization level.',
        ],
        commonIssue: "The most common mistake is assigning roles under the wrong Application. If someone cannot see Data Hub features, check they are assigned under 'Data Hub', not 'Engagement'.",
      },
      {
        key: 'c4', title: 'Overall decision & next steps',
        guidance: [
          'Based on the checks above, decide whether the project is ready to proceed.',
          'Go — proceed to implementation.',
          'No go — issues must be resolved before proceeding.',
        ],
      },
    ],
  },

  qa_peer_review_2: {
    label: 'Back End Tracking',
    reviewNumber: 2,
    scope: 'Backend events',
    reviewer: 'Partner + TC',
    intro: INTRO,
    checks: [
      {
        key: 'purchase', title: 'Purchase events',
        guidance: [
          'Go to Data & Assets › Events in the Bloomreach project.',
          "Find the purchase / transaction events (e.g. 'purchase', 'order_completed').",
          'Open 5–10 recent purchase events and confirm each contains:',
          '· Order ID / transaction ID',
          '· Total amount and currency',
          '· Timestamps (order date, payment date)',
          '· Product / item detail — product IDs, names, quantities, prices',
          "Cross-reference a few events against the client's order system to confirm accuracy.",
        ],
      },
      {
        key: 'consent', title: 'Consent events',
        guidance: [
          "Search for consent events (e.g. 'consent', 'marketing_consent', 'opt_in').",
          'Verify each includes:',
          '· Consent category — email, SMS, push',
          '· Consent action — grant or revoke',
          '· Timestamp',
          'Confirm both historical consent records and live consent changes are flowing through.',
          'Check consent status is correctly reflected on customer profiles.',
        ],
      },
      {
        key: 'historical', title: 'Historical data import',
        guidance: [
          'Compare the volume of imported historical events against what the partner said to expect.',
          'Verify the date range matches what was agreed in the SOW.',
          'Spot-check a few historical customer profiles:',
          '· Is purchase history attached to the correct profile?',
          '· Are event timestamps the original dates, not the import date?',
          '· Are customer attributes (name, email) correctly populated?',
          'Look for duplicate events or profiles created during the import.',
        ],
        commonIssue: 'If all historical events carry the same timestamp (the import date), flag this as Critical. Original timestamps must be preserved or every piece of time-based segmentation built on this data will be wrong.',
      },
      {
        key: 'tracking', title: 'Live tracking',
        guidance: [
          "Trigger a test purchase from the client's backend system.",
          'Verify the event appears in Bloomreach within seconds / minutes.',
          'Confirm it is attributed to the correct customer profile.',
          'Check all required attributes are present.',
        ],
      },
    ],
  },

  qa_peer_review_3: {
    label: 'Front End Tracking',
    reviewNumber: 3,
    scope: 'SDK & events',
    reviewer: 'Partner + TC',
    intro: INTRO,
    checks: [
      {
        key: 'c1', title: 'SDK loading',
        guidance: [
          "Open the client's website in Chrome and open Developer Tools (F12).",
          "Go to the Network tab and filter for 'bloomreach' or 'exponea'.",
          'Confirm the SDK script loads successfully (HTTP 200).',
          'Check it loads on all page types, not just the homepage:',
          '· Homepage · Category / listing pages · Product detail pages',
          '· Cart / basket · Checkout · Order confirmation / thank you',
          '· Account / login · Search results',
          'If using GTM, check the Bloomreach tag fires on all pages via GTM Preview mode.',
          'Confirm the snippet is using the correct project token (staging vs production).',
        ],
        commonIssue: 'Wrong project token means data going to the wrong environment. Flag as Critical if found.',
      },
      {
        key: 'c2', title: 'Event tracking',
        guidance: [
          'Using the tracking document as your reference, test each required event by performing the action on the website and confirming the event appears in Bloomreach.',
          'Cart events — add to cart, update quantity, remove from cart. Check each includes product IDs, prices, and quantities.',
          'Conversion events — complete a checkout. Check the event includes order ID, items, and amounts.',
          'Product interactions — view a product, click a product, add to wishlist.',
          'Search events — perform a search, click a result.',
          'Form / consent events — submit a newsletter signup or consent form.',
          'For each event, verify attribute names match the tracking document exactly.',
        ],
        commonIssue: 'If cart events are missing product IDs or prices, abandoned cart scenarios will fail. Flag as Critical.',
      },
      {
        key: 'c3', title: 'Customer identity',
        guidance: [
          'Browse the site as an anonymous visitor — confirm a cookie-based profile is created in Bloomreach.',
          'Log in to a customer account — confirm the anonymous profile merges with the identified profile.',
          "Check the customer's email is correctly captured on the profile.",
          'Verify events from the anonymous session are retained after login.',
        ],
      },
      {
        key: 'c4', title: 'Tracking document',
        guidance: [
          'Go through the tracking document line by line.',
          'Mark each event / attribute as implemented correctly, partially implemented, or not implemented.',
          'Share the updated tracking document with the partner.',
        ],
      },
    ],
  },

  qa_peer_review_4: {
    label: 'Use Cases Data Check & Debugging',
    reviewNumber: 4,
    scope: 'Scenarios & events',
    reviewer: 'Partner + BC',
    intro: INTRO,
    checks: [
      {
        key: 'c1', title: 'Data for each use case',
        guidance: [
          'Get the full use case list from the SOW, then work through it one use case at a time. Identify what data it needs:',
          "· Trigger event, e.g. 'cart_update' for abandoned cart",
          "· Required event attributes, e.g. 'product_list', 'total_price'",
          '· Required customer attributes, e.g. email, consent status',
          '· Required catalog data, e.g. product name, image, price',
          'Go to Data & Assets › Events and confirm the trigger event exists.',
          'Open 5–10 instances of the trigger event and check all required attributes are present and correctly formatted.',
          'Document any missing or incorrectly formatted data.',
        ],
      },
      {
        key: 'c2', title: 'Use case-specific checks',
        guidance: [
          'Apply these checks depending on which use cases are in scope.',
          "Abandoned cart — 'cart_update' events contain 'product_list' with product IDs, names, prices, quantities; product IDs in cart events match the catalog; cart events fire on add, update, and remove actions.",
          'Post-purchase — purchase events contain order ID, items, amounts, currency; purchase events are deduplicated (no double-counting).',
          "Browse abandonment — 'product_view' events contain product ID and category; product views are correctly attributed to customer profiles.",
        ],
        commonIssue: "A 'cart_update' event with the wrong 'product_list' attribute will break abandoned cart scenarios. Flag as Critical.",
      },
      {
        key: 'c3', title: 'Scenario logic',
        guidance: [
          'Open each scenario in the Scenarios editor.',
          'Check the trigger node — correct event type selected, correct filter conditions applied, frequency limits set (e.g. do not send an abandoned cart email if the customer already purchased).',
          'Check condition / filter nodes — a consent check is in place before any communication; suppression rules are correct (e.g. do not email if purchased within X hours).',
          'Check action nodes — correct email / SMS / push template selected, personalisation tokens reference the correct attributes, timing / delay nodes are set appropriately.',
        ],
        commonIssue: 'No consent check before sending is a GDPR compliance risk. Flag as Critical.',
      },
      {
        key: 'c4', title: 'Test with real data',
        guidance: [
          'Find or create a test customer profile with known data.',
          'Trigger the use case event, e.g. add items to cart and abandon.',
          'Verify the scenario fires correctly — trigger event is detected, conditions evaluate correctly, communication is sent (or would be sent in test mode), personalisation content renders correctly with real data.',
          'Check the scenario logs for any errors.',
        ],
      },
      {
        key: 'c5', title: 'Issues summary',
        guidance: [
          'For each issue found, document the following in the notes and in the action list on the final page:',
          '· Which use case is affected',
          '· What the specific data gap or error is — include an example',
          '· Your recommended fix',
          '· Severity: Critical / Important / Top Tip',
        ],
      },
    ],
  },

  qa_peer_review_5: {
    label: 'Data Mapping',
    reviewNumber: 5,
    scope: 'Data Manager › Mapping',
    reviewer: 'Partner + BC',
    intro: INTRO,
    checks: [
      {
        key: 'c1', title: 'Event mapping',
        guidance: [
          'Go to Data Manager › Mapping in the Bloomreach project.',
          'For each mapped event, verify:',
          '· It is mapped to the correct entity (customer, order, etc.)',
          '· Event attributes are mapped to the correct fields',
          '· Field types are appropriate — string, number, date, boolean',
          'Cross-reference the mapping against the tracking document.',
          'Check that all events required for the planned use cases are mapped.',
        ],
      },
      {
        key: 'c2', title: 'Customer attribute mapping',
        guidance: [
          'Review the customer attribute mappings and verify the core attributes are mapped:',
          '· Email address · First name / last name · Phone number',
          '· Consent preferences · Customer ID / external ID',
          'Check that custom attributes needed for segmentation are also mapped.',
          'Verify data types are correct — dates stored as dates, not strings.',
        ],
        commonIssue: 'Date fields mapped as strings will break time-based segmentation and filtering. Flag as Important.',
      },
      {
        key: 'c3', title: 'Catalog mapping (if applicable)',
        guidance: [
          'Go to Data Manager › Item Collections (Data Hub) or Catalogs.',
          'Verify the catalog schema:',
          '· Product ID is set as the unique identifier',
          '· Variant ID is unique within its parent product',
          '· Required fields are mapped — name, price, image URL, category',
          'Check that product IDs in cart / purchase events match catalog product IDs.',
          'Spot-check 10–20 products for correct and complete data.',
        ],
        commonIssue: 'If product IDs in events do not match the catalog, recommendations, abandoned cart emails, and product personalisation will all fail. Flag as Critical.',
      },
      {
        key: 'c4', title: 'Mapping supports the use cases',
        guidance: [
          'For each planned use case, trace the data path: what event triggers it, what customer attributes does it need, what catalog data does it reference.',
          'Confirm all required data points are mapped and accessible.',
          'Document any gaps where use cases need data that is not mapped yet.',
        ],
      },
      {
        key: 'c5', title: 'Partner education',
        guidance: [
          'Walk the partner through the Data Manager › Mapping interface.',
          'Explain how changes to mapping affect downstream use cases and scenarios.',
          'The goal: the partner should leave this review able to instruct their client on data mapping.',
        ],
      },
    ],
  },

  qa_peer_review_6: {
    label: 'Expiration & Data Cleanliness',
    reviewNumber: 6,
    scope: 'Data Manager',
    reviewer: 'Partner + BC',
    intro: INTRO,
    checks: [
      {
        key: 'c1', title: 'Event expiration settings',
        guidance: [
          'Go to Data Manager › Events in the Bloomreach project.',
          'For each event type, check the configured expiration period against these guidelines:',
          '· Purchase / transaction events — 2–3 years (needed for RFM and lifetime value)',
          '· Session / page view events — 30–90 days (high volume, limited long-term value)',
          '· Cart events — 30–90 days',
          '· Campaign events (email opens, clicks) — 6–12 months',
          '· Consent events — should never expire (legal requirement)',
          'Take screenshots of the recommended setup to share with the partner.',
        ],
        commonIssue: 'Consent events set to expire is a GDPR compliance risk. Flag as Critical.',
      },
      {
        key: 'c2', title: 'Customer attribute expiration',
        guidance: [
          'Go to Data Manager › Customer Attributes. Check which attributes have expiration set.',
          "Attributes that should expire — temporary campaign attributes (e.g. 'last_campaign_clicked'), session-based attributes (e.g. 'current_cart_value').",
          'Attributes that should never expire — core identity (email, name, phone), consent preferences, lifetime value metrics.',
        ],
      },
      {
        key: 'c3', title: 'Profile hygiene',
        guidance: [
          'Look for cookie-only profiles with no meaningful data (no email, no purchases, no recent activity) — these inflate profile counts against contracted limits.',
          'Look for outdated profiles with no activity in 12+ months.',
          'Check for duplicate profiles that should have been merged.',
          'Compare total profile count against the contracted profile limit.',
          'If there are issues, recommend a cleanup strategy such as archiving inactive profiles.',
        ],
      },
      {
        key: 'c4', title: 'Analytics configuration',
        guidance: [
          'Review the list of configured analytics / aggregates.',
          'Look for duplicate analytics tracking the same metric.',
          'Look for analytics that are configured but not used in any scenario, dashboard, or segment.',
          'Recommend consolidation or removal of anything redundant.',
        ],
        commonIssue: 'Multiple analytics tracking the same thing wastes resources and creates confusing reporting. Flag as Top Tip.',
      },
      {
        key: 'c5', title: 'Recommendations for the partner',
        guidance: [
          'Prepare a summary of all expiration settings with your recommended values.',
          'Include screenshots of the recommended Data Manager configuration.',
          'The goal: the partner should leave this review able to advise their client on data hygiene going forward.',
        ],
      },
    ],
  },
}

export const STATUSES = {
  pass: { label: 'Pass', color: '#019ACE', bg: '#e7f4fb' },
  comments: { label: 'Pass with comments', color: '#8A7A00', bg: '#FFFCE8' },
  fail: { label: 'Fail', color: '#000000', bg: '#f2f1ec' },
  na: { label: 'N/A', color: '#6b6b6b', bg: '#f7f7f7' },
}

export const SEVERITIES = {
  critical: { label: 'Critical', color: '#000000', bg: '#f2f1ec' },
  major: { label: 'Major', color: '#8A7A00', bg: '#FFFCE8' },
  minor: { label: 'Minor', color: '#6b6b6b', bg: '#f7f7f7' },
}

export function emptyWorkbookData(steps) {
  const checks = {}
  steps.forEach(c => { checks[c.key] = { status: null, severity: null, notes: '' } })
  return { reviewDate: '', version: '', checks, actions: [], partnerResponse: '', signoff: { sdc: '', partner: '', psm: '' } }
}

export function computeVerdict(workbook, data) {
  const keys = workbook.checks.map(c => c.key)
  const st = data.checks || {}
  const done = keys.filter(k => st[k]?.status).length
  const fails = keys.filter(k => st[k]?.status === 'fail').length
  const comments = keys.filter(k => st[k]?.status === 'comments').length
  if (done === 0) return { label: 'Not yet reviewed', color: '#8a8a8a' }
  if (done < keys.length) return { label: 'Review in progress', color: '#019ACE' }
  if (fails > 0) return { label: 'Changes required', color: '#000000' }
  if (comments > 0) return { label: 'Passed with comments', color: '#8A7A00' }
  return { label: 'Passed', color: '#017AA4' }
}
