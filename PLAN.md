# PLAN: Mini ATS

> **Status:** Phases 1 to 8, 10 and 11 merged and live (PR #11 is the latest); Phase 9 deliverables in progress. Next: the v1 delivery.
> **Deadline:** Friday 30 October 2026. **Live URL:** https://ats.t4ngo.com
> Usage budget and model routing: [BUDGET.md](./BUDGET.md). Review process: [REVIEW.md](./REVIEW.md).

## Where we left off (25 Oct)

* **Production:** all seven migrations applied; Phase 11 (PR #11) is live. The Nordlys Tech demo was reseeded on 25 Oct with openings, code profiles and candidates marked as not meeting the requirements (logins `sara.lindqvist@nordlys.example` and `johan.ek@nordlys.example`, the password the reseed prints is kept outside the repo); `ANTHROPIC_API_KEY` is set on Vercel (Production only, not Preview).
* **Done in Phase 8:** the recruiter agent (PR #7) and custom pipeline stages per job (PR #8), both reviewed and live.
* **Open items:**
  * Send the v1 delivery (admin login, live URL, repo link).
  * Smoke test one assistant question on the live site (a real CV assessment ran fine on 25 Oct).
  * The pipeline and candidates pages read one page of up to 1000 applications.
  * The admin organization switcher needs the sidebar expanded.
* **Next:** review and send the assumptions email, record the Loom video, send the v1 delivery. Phase 9 docs are in `docs/`.

## Goal

A professional, production quality mini ATS on Supabase that a first customer can use right away. The priority order:

1. **Core first.** Build the seven required user stories, test them and ship v1.
2. **AI CV assessment** (the extra task).
3. **Extras**, prioritized together, only after v1 is tested.

## Decisions

| Topic | Decision |
|:------|:---------|
| Stack | Next.js 15 (App Router, TS), Tailwind, shadcn/ui |
| Backend | Supabase: Auth, Postgres with RLS, Storage (EU region for GDPR) |
| Python | `.venv` in the repo root for seed scripts, RLS integration tests (pytest) and AI evals |
| Hosting | Vercel, with a Cloudflare DNS CNAME from `ats` to Vercel |
| Languages | next intl: Swedish (default) and English |
| Theme | next themes: dark, light, system |
| AI in the app | Claude via the Anthropic SDK (Sonnet for scoring, Opus for the agent) |
| Package manager | pnpm |
| Team users | Several customer users per organization from v1 |
| Admin access | Organization switcher with a "Viewing as X" banner; no impersonation |
| Onboarding | Admin sets email and a temporary password; user can change it later; no SMTP in v1 |
| AI trigger | "Assess CV" button per candidate and job; never automatic |
| Demo | Seed script with a fictional Stockholm tech company; the user records the Loom video |

## Phase 1: Foundations (Fri 23 and Sat 24)

* [x] Scaffold the Next.js app (TS, ESLint, Tailwind, `src/`) and initialize shadcn/ui
* [x] Supabase CLI as a dev dependency: `supabase init` and `supabase start` (local Docker)
* [x] Libraries: Supabase SSR, next intl, next themes, dnd kit, zod, react hook form, sonner, lucide, TanStack Table
* [x] Quality: Prettier, ESLint, Vitest, Playwright; ruff and pytest in the venv
* [x] Create the Supabase cloud project and the Vercel project, and point the DNS at Vercel
* [x] Get a first page live on ats.t4ngo.com on day one

## Phase 2: Data model and security (Sat 24)

| Table | Key columns |
|:------|:------------|
| `organizations` | name, slug |
| `profiles` | id (the auth user), full_name, role (admin or customer), organization_id (many users per organization), locale, is_active |
| `jobs` | organization_id, title, description, location, employment_type, status (open, paused, closed) |
| `candidates` | organization_id, full_name, email, phone, linkedin_url, location, notes, cv_path |
| `applications` | candidate_id, job_id, stage, position (kanban order), rating; unique per candidate and job |
| `activity_log` | actor_id, entity, entity_id, action, payload |

* [x] **Stages in v1 (fixed):** Applied, Screening, Interview, Offer, Hired, Rejected
* [x] **RLS on every table.** Security definer helpers `is_admin()` and `current_org_id()`. Customers have full access only within their own organization; admins can do everything; deactivated users can only read their own profile.
* [x] **Storage:** a private `cvs` bucket (PDF only, 10 MB) with path policies per organization (`<organization_id>/<candidate_id>/<file>`).
* [x] **Tests (pytest):** customer A cannot read or write organization B's data, and an admin can (`tests/rls/`).
* [x] Profiles are created by a trigger from `app_metadata` (role, organization), which only the service role can set; public signup is disabled in `supabase/config.toml` (the cloud project needs the same setting).
* [x] Generated TypeScript types in `src/lib/supabase/database.types.ts` (`pnpm db:types`).

Additions to the table above: `applications` and `activity_log` also carry `organization_id` (composite foreign keys keep the candidate, job and application in the same organization), `applications.stage_changed_at` drives "days in stage", and `jobs` and `candidates` have `created_by`. The activity log is append only and must reference an entity in the same organization. Triggers own `created_by`, `created_at`, `updated_at` and `stage_changed_at`, and `cv_path` must point into the candidate's own folder.

## Phase 3: Auth and admin (Sun 25)

* [x] Email and password login, password reset, protected routes via middleware
* [x] Admin panel: create organizations; create accounts on the server with `auth.admin.createUser` (email, name, role, organization and a temporary password), where the service role key never reaches the browser; list, deactivate and reset accounts
* [x] Team list per organization, showing every user in it
* [x] Profile settings: name, language and change password
* [x] **Act as customer:** an organization switcher for admins, so the whole app runs in the chosen customer's context. Actions are logged under the admin's own identity.

## Phase 4: Core customer features (Sun 25 to Mon 26)

* [x] **Organization scope:** one helper that every data query and insert goes through, scoped to `getActiveOrganization()`. RLS gives admins every organization, so act as customer only works if no query forgets the filter (review finding, Phase 3).
* [x] **Jobs:** list, create, edit and change status, with candidate counts per stage
* [x] **Candidates:** create and edit with profile fields (LinkedIn and more), an optional CV upload (PDF), and attaching a candidate to one or more jobs
* [x] **Kanban:** compact columns per stage, drag and drop with optimistic updates and saved order. Cards show initials, job tag, days in stage and a LinkedIn icon.
* [x] **Filters:** job (choose several) and candidate name (search as you type), kept in the URL so filtered views can be shared
* [x] **Candidate drawer:** profile, applications, notes and an activity timeline
* [x] **Dashboard:** key numbers (open jobs, active candidates, hires this month) and a pipeline funnel

## Phase 5: Polish (Tue 27)

* [x] Dark, light and system theme; language switcher saved on the profile
* [x] Responsive layout with a collapsible sidebar
* [x] Command palette (Ctrl K) to jump to any candidate or job
* [x] Empty states, skeleton loaders, toasts and confirm dialogs
* [x] Accessibility: keyboard drag and drop, focus rings, contrast
* [x] Error boundaries, a 404 page, meta tags and a favicon

## Phase 6: Test and ship v1 (Tue 27)

* [x] Playwright end to end test: admin creates a customer, the customer logs in, creates a job, adds a candidate, drags the card and filters
* [x] GitHub Actions CI: lint, typecheck, Vitest, Playwright and the pytest RLS suite
* [x] Seed script (Python in the venv, service role key, runs against local and production): a fictional Stockholm tech company with 4 jobs (frontend developer, backend developer, product designer, customer success manager) and about 20 candidates spread across the stages, with sample CVs
* [ ] **Delivery v1:** admin login, live URL and repo link

## Phase 7: AI CV assessment (Wed 28)

* [x] An "Assess CV" button per candidate and job (never automatic, to control cost and keep a human in the loop)
* [x] Upload the CV (PDF), extract the text on the server, then send the CV text and job description to Claude with structured output
* [x] Output: a **score from 0 to 100**, a summary, strengths, gaps, skill matches and suggested interview questions
* [x] Store the result in `cv_assessments`; show a score badge on the kanban card and a full panel in the drawer
* [x] Show a disclaimer: decision support, not a decision (bias, GDPR, a human in the loop)
* [x] Eval script in the venv: run sample CVs several times to check score consistency (`scripts/eval_assessment.py`; 2026-10-23: 5 CVs x 3 runs, max spread 6 points, ranking ok, 0.20 USD; rerun 2026-10-24 for prompt v2 with the same result)

## Phase 8: Extras (Thu 29, only after v1 is tested)

Prioritized on 24 Oct: the agent first, then custom pipeline stages; the rest only if time allows.

1. [x] **Claude recruiter agent:** a chat panel using tool use over server side tools (search candidates, move stage, summarize the pipeline, draft emails). It runs as the logged in user, so RLS still applies.
2. [x] Custom pipeline stages per job
3. Public career page per job, where applicants land directly in Applied
4. Email invites and notifications (Resend)
5. Comments and mentions on candidates
6. CSV import and export of candidates
7. Interview scheduling (calendar links)
8. Audit log view for admins

## Phase 9: Deliverables (Thu 29 and Fri 30)

* [x] Assumptions email (drafted for review before sending): `docs/assumptions-email.md`
* [x] Storyboard for the 5 minute Loom demo in `docs/demo-storyboard.md` (the user records it, adding one or two candidates live)
* [x] Final README: screenshots, setup instructions, architecture overview

## Phase 10: Feedback round (Sat 24 to Sun 25)

From the first walk through of v1. Branch `feat/phase-10-ux`.

* [x] Violet theme and one colour per phase on every page (blue, violet, amber, cyan, green, red)
* [x] Dashboard: clickable stats with change against the previous period, activity chart for 7, 30 or 90 days, clickable funnel, needs attention, standouts and team
* [x] Pipeline uses the full width, coloured columns and cards, amber days in stage after 14 days
* [x] Star and flag per application; "does not meet requirements" from an AI score below 40 or the recruiter's own call
* [x] Mark and phase filters on the pipeline and candidates pages; jobs page with phase coloured counts
* [x] Team and Settings pages removed: team on the dashboard, settings in a dialog behind the cog
* [x] Organizations and users merged into one Customers page
* [x] Developer mode for admins with a customer preview (admin tools hidden, changes still logged as the admin)
* [x] Fix: the activity log kept no backdated seed history, so the demo timeline showed the seed time
* [x] Apply the migration in production and reseed the demo (24 Oct, new password kept outside the repo)
* [x] New README screenshots, including the dashboard

## Phase 11: Second feedback round (Sun 25)

Toned down colours and a pipeline per job. Branch `feat/phase-11-polish`, PR #11.

* [x] Translucent phase colours, layered shadows and a soft glow; a green or blue translucent banner when viewing a company
* [x] Dashboard with depth and motion (cards rise in, lines draw, bars grow) and less text; flagged, not assessed and days in stage as icons with hover explanations
* [x] One board per job with hiring progress; every lane folds, hired and rejected start folded
* [x] Candidates who do not meet the requirements stay in Applied with a red tinted card instead of being rejected
* [x] Hired and rejected cards can be removed with undo; rejected cards leave the board after 7 days, with a countdown
* [x] LinkedIn logo in its own blue; a new code profile link with the GitHub logo
* [x] Openings per job; filled jobs move to their own table and can be reopened
* [x] Candidates: new applicants of the last 7 days on top, then a foldable list per job from hired down to rejected, rejected greyed out
* [x] Icon filters with a search field
* [x] Customers renamed Users: administrators first, organizations in alphabetical order, cards of equal size, user actions in a menu
* [x] Theme icons and language flags in the sidebar footer
* [x] Fix: a backdrop blur offset the drag preview, so a keyboard move could skip a lane
* [x] Review with `/code-review medium`, 10 findings fixed
* [x] Apply the migration in production
* [x] Reseed the production demo (25 Oct, new password kept outside the repo)
* [x] New README screenshots and storyboard

## Assumptions (for the email)

* B2B: each customer is an **organization**, and an organization can have several users.
* Admins are internal staff who create every account (no self signup), with a temporary password the user can change.
* A candidate belongs to one organization and can apply to several of its jobs.
* Pipeline stages: six fixed phases, with custom stages per job inside them (added in Phase 8).
* Data is hosted in the EU (Supabase EU region) because of GDPR.
* CVs are text based PDFs. Scanned CVs (images only) are not assessed; the app says so instead of guessing.
* The AI assessment is decision support only. The CV text is sent to Anthropic for processing, which the UI states; every decision stays with a person.

## Workflow

* **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:` and so on), committing after every logical unit and pushing often
* **Branches:** small changes go to `main`; larger phases go through feature branches and PRs, which get Vercel preview deploys
* **Reviews:** one review per phase, logged in [REVIEW.md](./REVIEW.md)
* **Definition of done:** lint, typecheck and tests pass, both themes and both languages are checked, the change is deployed and reviewed

## Decisions log (23 Oct)

* **Team users:** several users per customer organization in v1; this replaces the "team members" extra.
* **Admin access:** an organization switcher instead of impersonation, for security and a clean audit trail.
* **AI trigger:** a button click only, for cost control and a human in the loop.
* **Onboarding:** the admin sets a temporary password, so no email setup is needed for v1.
* **Demo:** a seed script provides realistic data; the user records the Loom video by hand.

## Decisions log (Phases 5 to 7)

* **Command palette:** searches on the server as you type (pages, candidates, jobs in the active organization) instead of loading every row into the layout.
* **Sidebar state:** kept in a cookie and read on the server, so a collapsed sidebar does not flash open on load.
* **Seed data:** a Python script that wipes and recreates only the demo organization, with generated PDF CVs, so it can run against production safely and again at any time.
* **CI:** two jobs: fast checks (lint, typecheck, Vitest), then Supabase with the RLS suite, the seed script and Playwright.
* **AI model:** Claude Sonnet 5.5 at medium effort with structured output; server side refusal fallback. The eval showed a spread of at most 6 points over three runs.
* **Assessment writes:** users can only read `cv_assessments`; the server writes rows with the service role after checking access as the user, so a score cannot be forged through the API.
* **Concurrency:** one running assessment per candidate and job, claimed atomically in the database before the paid call; stale claims expire after 3 minutes.
* **History:** every assessment run is kept; the `latest_cv_assessments` view (security invoker, so RLS applies) gives the newest per pair.
* **Shared prompt:** the prompt lives in `src/lib/ai/assessment-prompt.json`, read by both the app and the Python eval, so they cannot drift apart.
* **Tests without the API:** `AI_FAKE=1` returns a fixed assessment in e2e and CI; it is ignored in production builds.

## Decisions log (Phase 8)

* **Recruiter agent:** Claude Opus 5.5 at medium effort in a manual streaming tool loop (`src/lib/agent/`), served by `/api/agent` as NDJSON events. Five tools (search candidates, get candidate, list jobs, pipeline summary, move candidate) run as the signed in user through the scope helper, so RLS applies.
* **Human approval:** `move_candidate` never runs on its own; the loop stops, the panel shows an approve or decline card, and the next request resumes with the decision. Emails are drafts in the chat only.
* **State:** the browser keeps the API history (thinking blocks echoed unchanged) and sends it each turn; the server validates its shape, allows only text and tool results in user turns, caps size and runs at most 8 model calls per request.
* **Prompt:** stage names come from the UI message files; candidates are referred to by name, never with a gender guessed from it (found in a real run).
* **Custom stages:** per job, on top of the six fixed phases (decided 24 Oct). `job_stages` holds each job's stages; `applications.stage_id` points at one, and a trigger keeps `applications.stage` as its phase, so the dashboard, filters, agent summaries and assessments are unchanged. New jobs get one default stage per phase (no name, shown with the phase name in the UI language).
* **Stage rules in the database:** a stage keeps its job and phase; the last stage of a phase and stages with candidates cannot be deleted; an application can only use a stage of its own job. Moving between two stages of one phase restarts days in stage.
* **Board:** one job filtered shows that job's stages as columns; otherwise the phases, with custom stage names on the cards.
* **Migration safety:** the backfill was checked against seeded data: phase, days in stage and position were identical for every application before and after.
