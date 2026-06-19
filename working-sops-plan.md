# Working SOPs (Playbooks) — Implementation Plan

> From client feedback: make SOPs **action-oriented "working SOPs"** — a built-in
> checklist that guides the EA through the workflow, plus **Success Criteria /
> Deliverables** so it's clear when a task is done. Apply across all SOPs.

## The idea (restated)

Today an SOP is a document you *read*, then go do the work elsewhere. We turn each
SOP into a **guided, tickable workflow** the EA runs *inside* the app:

- a **checklist** of steps that must be done, in order,
- **Success Criteria / Deliverables** at the end (the definition of "done"),
- a recorded **run** each time it's executed (who, which client, when, completed?),
- optional **AI hooks** on steps (e.g. "AI support used" launches the right tool).

This delivers exactly the three goals in the feedback: **executable**, **consistent across EAs**, **easier onboarding** — plus a bonus: a record of every run for quality/accountability.

## Anatomy of a Working SOP

Using the **Inbox Triage** example from the feedback:

**Checklist**
- ☐ Request acknowledged within 15 minutes
- ☐ Urgency assigned (Urgent / Standard / Low)
- ☐ Client profile reviewed
- ☐ AI support used (if applicable)
- ☐ Output reviewed against quality standards
- ☐ Response / action delivered
- ☐ Client preferences updated (if applicable)

**Success Criteria / Deliverables**
- ✓ Client has received a response
- ✓ Required action has been completed
- ✓ CRM / system has been updated
- ✓ Client profile updated with any new preferences

When every required step is ticked and the criteria are met → the run is marked **Complete**.

## Where it lives

A new **"SOPs"** section in the left nav (Operations group), subtitle *"Working checklists."*
- **Library view** — cards for each SOP (Inbox Triage, Meeting Prep, etc.) with a short description and a **Start** button.
- **Run view** — opens the SOP: the checklist (tick as you go, progress bar), the Success Criteria panel, an optional client to attach, and **Complete** (enabled once required steps are done).

## Data model (brief)

- `sops` — `id, workspace_id, title, description, category, steps (jsonb: [{label, required, ai_action?}]), success_criteria (jsonb: [string]), is_active`.
- `sop_runs` — `id, workspace_id, owner_id, sop_id, client_id?, started_at, completed_at, checked (jsonb: step ids done), status (in_progress|completed)`.

Both workspace-scoped with the same per-EA / admin RLS as the rest of the app. A small migration seeds the default SOPs.

## Build phases

**Phase 1 — Core (the feedback, end to end)**
- Migration: `sops` + `sop_runs` + seed the starter SOPs (with steps + success criteria).
- **SOPs library page** + nav item.
- **Run flow:** Start → tickable checklist with progress → Success Criteria panel → Complete (records the run).
- Result: every SOP is an executable checklist with a clear "done."

**Phase 2 — Make it smart**
- **Attach a client** to a run; show that client's preferences inline (so "Client profile reviewed" is one glance).
- **AI-linked steps:** a step like *"AI support used"* shows a button that launches the matching tool (Inbox Triage → AI draft; Meeting Prep → meeting brief) and auto-ticks when used.
- Link a run to a **task** so completing the SOP can close the task.

**Phase 3 — Consistency & onboarding**
- **Admin editing:** admins edit an SOP's steps and criteria (no code needed).
- **Run history & metrics:** per-SOP completion rate, average time, who ran what — the consistency signal across EAs.
- **Onboarding mode:** show inline guidance/tips on each step for new EAs.

## Starter SOP set (seeded)

1. **Inbox Triage** — exactly the checklist + criteria above.
2. **Meeting Preparation** — gather attendee profiles, draft agenda, attach docs, send reminder → criteria: brief delivered, reminders sent.
3. **Executive Priority Alignment** — review calendar/tasks/inbox, flag conflicts, produce the daily brief → criteria: brief delivered before 8 AM.
4. **Expense / Bookkeeping** — collect receipts, categorise, generate report, submit → criteria: report generated, submitted, logged.
5. **Client Onboarding** — discovery call, profile created in Vault, preferences captured, 30-day check-in scheduled → criteria: profile complete, kickoff sent.

Each follows the same shape: **Checklist → Success Criteria** — so they're consistent and new SOPs are easy to add.

## Open questions for the team (incl. Belle's feedback)

- Naming: **"SOPs"** vs "Playbooks" vs "Workflows"?
- Should completing an SOP run **auto-update** the linked task/client, or just prompt the EA?
- Which SOPs to seed first, and the exact wording of each checklist (we'll use the team's canonical SOPs).
- Do you want **required vs optional** steps (block "Complete" until required ones are ticked)?

---

**Recommendation:** build **Phase 1** now (delivers the exact ask — checklists + success criteria, executable in-app), starting with the Inbox Triage SOP as the template, then replicate to the rest. Phases 2–3 layer on the smart + admin pieces once the team confirms wording.
