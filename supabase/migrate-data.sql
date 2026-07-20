-- ============================================================
-- Partner Implementation Portal — Data migration
-- Run AFTER schema.sql. Contents exported from the live Google
-- Sheet (1mK7w_0NereXovs1339C9Rgc3nQQteH4JcdIebqcVFGg) on 2026-07-17.
-- Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- ============================================================

-- Admins (from the Admins sheet)
insert into admin_emails (email) values
  ('cameron.large@bloomreach.com')
on conflict do nothing;

-- Implementations (ids preserved from the Sheet / Loomi tracker)
insert into implementations
  (id, partner_name, client_name, contract_sign_date, status,
   slack_channel_id, bloomreach_org_id, bloomreach_org_name,
   scenarios_synced_at, profile_count, profile_count_synced_at)
values
  ('478c479c-9a74-45e9-b3bb-72300b09eacf', 'Heystack', 'Dormeo', null, 'active',
   '', '72ba3f68-1443-45eb-85ae-c86e62db368c', 'Dormeo',
   '2026-07-13 21:08:21+00', null, null),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'Datacop', 'OneDayBelow', '2026-06-18', 'active',
   '', '', '', null, null, null),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', 'Heystack', 'Inn Collection Group', null, 'active',
   'C0B23DJBZFD', 'c105205b-9201-4203-856a-21ec8cf38af0', 'Inn Collection Group',
   '2026-07-13 21:18:01+00', 6647, '2026-07-13 22:07:55+00')
on conflict (id) do nothing;

-- Touch points (includes the free-text 'qa_peer_review_1_notes' row)
insert into touch_points (implementation_id, key, status) values
  ('478c479c-9a74-45e9-b3bb-72300b09eacf', 'account_creation', 'in_progress'),
  ('478c479c-9a74-45e9-b3bb-72300b09eacf', 'qa_peer_review_1', 'in_progress'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'account_creation', 'complete'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'qa_peer_review_1', 'complete'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'qa_peer_review_2', 'in_progress'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'frontend_data', 'in_progress'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'backend_data', 'in_progress'),
  ('c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df', 'qa_peer_review_1_notes', 'Standard ID Structure - No QA Validation required from a TC')
on conflict (implementation_id, key) do nothing;

-- Access (email -> implementation)
insert into access (email, implementation_id) values
  ('cameron6333@aol.com', 'c3dfeebd-bd8a-49b3-b6ed-45f8dd8f15df'),
  ('cameron.large.admin@bloomreach.com', '66620a6d-7d7a-46f1-9010-5d0dc480058e')
on conflict do nothing;

-- Scenario sync (Inn Collection Group)
insert into scenario_sync (implementation_id, scenario_id, name, status, tags) values
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a2aef4a4762a1f47f348161', 'Email Domain Strip [do not stop]', 'active', ''),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a4ba2bdcf4871dd54e4736a', 'Heystack test', 'inactive', ''),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a54af60c8df9de36313154e', 'Testing Warm Up Emails', 'draft', ''),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a4b81bf40b1f7b56b54f80b', 'Warm Up', 'active', ''),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a3d499f2c5ffb1b4e718f78', 'Warm-up | Audience Selection', 'draft', ''),
  ('66620a6d-7d7a-46f1-9010-5d0dc480058e', '6a3d499e2c5ffb1b4e718f4b', 'Warm-up | Sending Flow', 'draft', '')
on conflict (implementation_id, scenario_id) do nothing;

-- Meeting notes (1 note — Dormeo weekly call).
-- NOTE: the Sheet export flattened newlines; markdown structure was
-- reconstructed. Worth a quick visual check after migrating.
insert into meeting_notes (id, implementation_id, title, meeting_date, content, source, granola_meeting_id, created_at) values
  ('4fd2e30a-8396-4894-99ea-edc3c0cc1348', '478c479c-9a74-45e9-b3bb-72300b09eacf', 'Weekly Call', '2026-07-08', $md$### Project ID Setup

- Phone as a soft ID to be added to the setup form now, even though SMS isn’t in current SOW
  - Ensures it’s ready when SMS implementation comes
  - Field format agreed: phone_underscore_ID to distinguish from existing attribute

### Data Schema Review

- Seb consolidated events and attributes from the workbook into a draft schema document
  - Some Bloomreach events can be merged (e.g. all purchase variants under one purchase event with a purchase_status attribute)
  - Document also covers migration checklist, product catalog structure, and attributes
- Dormeo to review and add comments; Sumra to send as follow-up

### IP Warming Plan

- Dormeo’s current send cadence: Thursday/Friday campaign, Saturday/Sunday non-opener follow-up, Monday final send
  - Open to sending more frequently to accelerate warming
  - Accepted some short-term performance dip during the process
- Sumra’s recommendations:
  - Multiple sends per week will move through warming faster
  - Weekday-only sends preferred at the start, to monitor for any issues
- Unsubscribe management between Klaviyo and Bloomreach still to be resolved
  - Options: webhook sync or manual list imports
  - Dormeo previously used manual uploads when migrating from Dotdigital to Klaviyo
  - Sumra to come back with a recommendation once full picture is clear

### Magento Integration Approach

- Dormeo flagged cost concern around using webhooks vs. a direct API connection to Magento
  - Rowan is the outsourced dev resource; time/cost is the driver
- Sumra confirmed API is viable and aligns with what she and Seb had discussed
  - Heystack will help Rowan set up API consoles once Bloomreach access is granted
  - Added to the Productive task list

### Project Tracking and Training

- Project now tracked in Productive (not the shared sheet); Amy confirmed she has access
  - Sumra will update task cards and tag Amy when input is needed
  - Teams and email remain available for communication
- Bloomreach training call to be scheduled once project is set up and email integrations are ready
- Academy access: Cameron to set up accounts for Amy and Marius; third pass to be allocated later for annual leave cover

### Next Steps

- **Send Academy access invites to Amy and Marius** (Cameron)
  - Third pass to be assigned later once Dormeo confirms annual leave cover needs.
- **Add phone_underscore_ID to the project ID setup form** (Amy)
  - Enables SMS to be ready for implementation when needed.
- **Review and comment on the data schema document** (Amy)
  - Sumra to send the document as a follow-up after the call.
- **Provide unsubscribe management recommendation** (Sumra)
  - Webhook sync vs. manual imports: advise once full send volume and setup details are known.
- **Add Magento API setup to Productive task list and assist Rowan** (Sumra)
  - Help configure API consoles once Bloomreach access is granted.$md$, 'manual', '', '2026-07-13 15:26:09+00')
on conflict (id) do nothing;
