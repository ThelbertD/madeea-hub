-- 0014_automation_health.sql — make automation failures exist.
--
-- Until now a failed run wrote NOTHING: run-automation inserted into
-- automation_runs only after the work succeeded, and the catch block just
-- returned a 500. So the run history was a list of successes by construction and
-- an automation could break with no trace of it anywhere. There was nothing for a
-- health view to read.

alter table automation_runs add column if not exists status text not null default 'succeeded';
alter table automation_runs add column if not exists error_message text;
alter table automation_runs add column if not exists duration_ms int;
alter table automation_runs add column if not exists finished_at timestamptz;

-- Existing rows really are successes — they only got written on the happy path —
-- so the 'succeeded' default backfills them accurately rather than by assumption.
alter table automation_runs drop constraint if exists automation_runs_status_check;
alter table automation_runs add constraint automation_runs_status_check
  check (status in ('running', 'succeeded', 'failed'));

-- The health view always wants the newest runs for one automation.
create index if not exists automation_runs_recent_idx
  on automation_runs (automation_id, ran_at desc);

-- ---------- stop claiming a schedule that doesn't exist ----------
-- The seeded copy said "Every morning at 7:30 AM…", but nothing has ever run on a
-- timer: there is no cron, and run-automation only fires when someone presses Run
-- Now. The health view says "Manual — not scheduled", and leaving the old text in
-- place would have the app contradicting itself on the same screen.
--
-- Scoped to rows whose description is still the seeded string, so a description
-- the user has since edited is left alone.
update automations
   set description = 'Analyses your calendar, emails and task list to produce a prioritised daily briefing. Flags conflicts, urgent items and schedule optimisations.'
 where automation_key = 'priority_alignment'
   and description like 'Every morning at 7:30 AM%';
