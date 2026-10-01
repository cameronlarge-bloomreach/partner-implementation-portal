-- Dedicated sign-in for scheduled automation (Loomi sync, usage meters,
-- weekly update). Replaces the magic-link flow removed on 2026-09-30.
--
-- 1. Supabase dashboard → Authentication → Users → Add user → Create new user:
--      email:    cameron.large+blimp-automation@bloomreach.com
--      password: a long random one
--      tick "Auto Confirm User" (no email is sent)
-- 2. Run this in the SQL editor so the account passes is_admin():
insert into admin_emails (email)
values ('cameron.large+blimp-automation@bloomreach.com')
on conflict (email) do nothing;
-- 3. Put the same email + password in automation/.env on the Mac that runs
--    the scheduled tasks (SB_AUTOMATION_EMAIL / SB_AUTOMATION_PASSWORD),
--    then check with:  node automation/sb-auth.js login
