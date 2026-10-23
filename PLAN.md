# PLAN: Mini ATS

> **Status:** Phase 4 (core customer features) merged (PR #3). Phase 5 (polish) built on `feat/polish`, awaiting review. Next: Phase 6.
> **Deadline:** Friday 30 October 2026. **Live URL:** https://ats.t4ngo.com
> Usage budget and model routing: [BUDGET.md](./BUDGET.md). Review process: [REVIEW.md](./REVIEW.md).

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

* [ ] Playwright end to end test: admin creates a customer, the customer logs in, creates a job, adds a candidate, drags the card and filters
* [ ] GitHub Actions CI: lint, typecheck, Vitest, Playwright and the pytest RLS suite
* [ ] Seed script (Python in the venv, service role key, runs against local and production): a fictional Stockholm tech company with 4 jobs (frontend developer, backend developer, product designer, customer success manager) and about 20 candidates spread across the stages, with sample CVs
* [ ] **Delivery v1:** admin login, live URL and repo link

## Phase 7: AI CV assessment (Wed 28)

* [ ] An "Assess CV" button per candidate and job (never automatic, to control cost and keep a human in the loop)
* [ ] Upload the CV (PDF), extract the text on the server, then send the CV text and job description to Claude with structured output
* [ ] Output: a **score from 0 to 100**, a summary, strengths, gaps, skill matches and suggested interview questions
* [ ] Store the result in `cv_assessments`; show a score badge on the kanban card and a full panel in the drawer
* [ ] Show a disclaimer: decision support, not a decision (bias, GDPR, a human in the loop)
* [ ] Eval script in the venv: run sample CVs several times to check score consistency

## Phase 8: Extras (Thu 29, only after v1 is tested)

To be prioritized together:

1. **Claude recruiter agent:** a chat panel using tool use over server side tools (search candidates, move stage, summarize the pipeline, draft emails). It runs as the logged in user, so RLS still applies.
2. Custom pipeline stages per job
3. Public career page per job, where applicants land directly in Applied
4. Email invites and notifications (Resend)
5. Comments and mentions on candidates
6. CSV import and export of candidates
7. Interview scheduling (calendar links)
8. Audit log view for admins

## Phase 9: Deliverables (Thu 29 and Fri 30)

* [ ] Assumptions email (drafted for review before sending)
* [ ] Storyboard for the 5 minute Loom demo in `docs/demo-storyboard.md` (the user records it, adding one or two candidates live)
* [ ] Final README: screenshots, setup instructions, architecture overview

## Assumptions (for the email)

* B2B: each customer is an **organization**, and an organization can have several users.
* Admins are internal staff who create every account (no self signup), with a temporary password the user can change.
* A candidate belongs to one organization and can apply to several of its jobs.
* Pipeline stages are fixed in v1.
* Data is hosted in the EU (Supabase EU region) because of GDPR.

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
