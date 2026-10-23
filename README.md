<div align="center">

# ATS: Mini Applicant Tracking System

**A fast, modern applicant tracking system, built to be in the hands of a first customer as quickly as possible.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude](https://img.shields.io/badge/AI-Claude-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Vercel](https://img.shields.io/badge/Hosted%20on-Vercel-000?logo=vercel)](https://vercel.com)

**Live:** [ats.t4ngo.com](https://ats.t4ngo.com) · **Plan:** [PLAN.md](./PLAN.md) · **Deadline:** Friday 30 October 2026

</div>

## The assignment

Build a **mini ATS (applicant tracking system)** that can be live with a first customer as quickly as possible.

### Core features

| # | As a | I can | Status |
|:--|:-----|:------|:------:|
| 1 | **Admin** | create accounts (both admin and customer accounts) | Todo |
| 2 | **Customer** | log in | Todo |
| 3 | **Customer** | post jobs I'm recruiting candidates for | Todo |
| 4 | **Customer** | add candidates with profile information (for example a LinkedIn link) | Todo |
| 5 | **Customer** | see a compact kanban view of all my candidates | Todo |
| 6 | **Customer** | filter the kanban view by job and candidate name | Todo |
| 7 | **Admin** | do everything customers can do, on their behalf | Todo |

### Guidelines

* **Supabase** as the backend (authentication and database)
* Build as much as possible **with AI tools** (Claude Code, Cursor, Copilot and similar) to move fast
* Free to make assumptions about customers, wishes and needs
* Free to add further functionality that fits an ATS if time allows

### Extra task: AI feature

* Implement a simple, stripped down **AI powered assessment of a candidate's CV**
* At minimum, explain in the demo how such a problem would be approached

### Deliverables

* [ ] Admin login to the platform
* [ ] 5 minute demo video (Loom or similar)
* [ ] Email describing the assumptions made
* [ ] Link to this repository
* [ ] Ship often; multiple deliveries are welcome

## Tech stack

| Layer | Choice |
|:------|:-------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase: Auth, Postgres with Row Level Security, Storage |
| Kanban | dnd kit (accessible drag and drop) |
| Language and theme | next intl (Swedish default, English), next themes (dark, light, system) |
| AI | Anthropic Claude: CV scoring and a recruiter assistant agent |
| Tooling | pnpm, Python venv (seed scripts, RLS tests, AI evals), Vitest, Playwright, GitHub Actions |
| Hosting | Vercel, with Cloudflare DNS (ats.t4ngo.com) |

## Roadmap

See **[PLAN.md](./PLAN.md)** for the full plan. In short:

1. **Foundations:** scaffold, Supabase, CI, first deploy live
2. **Data model and security:** schema plus RLS, tested per organization
3. **Auth and admin:** login, account management, act as customer
4. **Core features:** jobs, candidates, kanban with filters
5. **Polish:** dark and light mode, Swedish and English, command palette, responsive layout
6. **Test and ship v1**
7. **AI CV assessment** with Claude
8. **Extras:** Claude recruiter agent, custom stages, career page and more

## Getting started

Requirements: Node.js 24, pnpm 11, Python 3.14 and Docker (for the local Supabase stack).

```bash
git clone https://github.com/GHT4ngo/ATS.git
cd ATS
pnpm install
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
pnpm exec supabase start          # local Postgres, Auth and Storage in Docker
cp .env.example .env.local        # fill in the values from `pnpm exec supabase status`
pnpm dev                          # http://localhost:3000
```

Demo data (a fictional Stockholm company with 4 jobs and 20 candidates with CVs):

```bash
SEED_PASSWORD=choose-one .venv/bin/python scripts/seed.py         # local
SEED_PASSWORD=choose-one .venv/bin/python scripts/seed.py --prod  # the project in .env.local, asks first
```

AI CV assessment needs `ANTHROPIC_API_KEY` in `.env.local`. Without a key, set `AI_FAKE=1` for a fixed test result.

### Tests

```bash
pnpm lint && pnpm typecheck && pnpm test     # ESLint, TypeScript, Vitest
.venv/bin/pytest                             # RLS policies against the local Supabase
pnpm e2e                                     # Playwright, starts its own dev server on port 3100
.venv/bin/python scripts/eval_assessment.py  # AI score consistency, calls the API (about 0.20 USD)
```

GitHub Actions runs everything except the eval on every pull request.

<details>
<summary><b>Originaluppgiften (svenska)</b></summary>

<br>

Bygg ett mini ATS (applicant tracking system) som kan vara live i händerna på en första kund så snabbt som möjligt.

**Core features**

* Som admin kan jag skapa konton (både admin konton och kund konton)
* Som kund kan jag logga in
* Som kund kan jag lägga upp jobb jag söker kandidater till
* Som kund kan jag lägga till kandidater med dess profilinformation (t.ex. Linkedin länk)
* Som kund kan jag se en kompakt kanban vy med alla kandidater tillhörande
* Som kund kan jag filtrera kanban vyn på jobb och kandidatnamn
* Som admin kan jag göra allt som kunder kan göra åt dem

**Guidelines**

* Använd Supabase som backend (tex authentication och databas)
* Utveckla så mycket som möjligt mha av AI verktyg för att kunna bygga så snabbt som möjligt (t.ex. Lovable, Cursor, Claude Code, Codex, Copilot)
* Känn dig fri att göra valfria antaganden kring kunder, önskemål, behov, osv.
* Känn dig fri att bygga ut ytterligare funktionalitet du anser vara lämplig i ett ATS om du har tid över

**Leverans**

* Dela admin login till plattformen med mig
* Spela in en 5 min demo video mha Loom eller liknande verktyg och dela med mig
* Dela eventuella antaganden du gjort i ett mejl till mig
* Dela länk till repot
* Känn dig fri att shippa ofta (dvs du kan leverera flera gånger om du vill)

**Extra uppgift (AI feature)**

* Implementera en enkel, avskalad funktion för bedömning av kandidatens CV med hjälp av AI
* Åtminstone: berätta i demon hur du hade angripit ett sådant problem

**Deadline:** 1 vecka, alltså fredag 30 oktober.

</details>

<div align="center">
<sub>Built with the help of <a href="https://claude.com/claude-code">Claude Code</a></sub>
</div>
