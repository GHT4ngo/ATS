# Privacy and GDPR

How the ATS handles personal data, and what a customer needs to know to use it lawfully. This describes the system as built; it is not legal advice.

## Roles

* **The customer** (the recruiting company) is the **controller** for its candidates' data. It decides what to collect and why, informs the candidates and answers their requests.
* **We** (the ATS provider) are the **processor**. Admins can reach every organization's data to support customers, and every change they make is logged under their own name.

## What is stored

| Data | Where | Why |
|:-----|:------|:----|
| Candidate profile: name, email, phone, location, LinkedIn and code profile links, notes | `candidates` | Running the recruitment |
| CV (PDF) | Private `cvs` storage bucket, one folder per candidate | Running the recruitment and the optional AI assessment |
| Applications: job, stage, marks, rating, dates | `applications` | The pipeline |
| AI CV assessments: score, summary, strengths, gaps, interview questions | `cv_assessments` | Decision support for the recruiter |
| Activity history: who did what and when | `activity_log` | Accountability and the timeline |
| Erasures: kind of row, reason, who, when, with no personal data | `erasure_log` | Showing that erasure requests were met |
| Users: name, email, role | `profiles`, Supabase Auth | Signing in |

The browser stores only the login cookies and display settings (theme, language, folded sections). There is no tracking or analytics, so no consent banner is needed.

## Where it is processed

| Processor | What | Region |
|:----------|:-----|:-------|
| Supabase | Database, files, login | EU (Ireland, `eu-west-1`) |
| Vercel | Runs the app | EU (Dublin, `dub1`, set in `vercel.json`) |
| Anthropic | CV text and job description for an assessment; pipeline data the assistant reads to answer a question | US |

Anthropic and Vercel are US companies, so transfers rely on their data processing agreements (with the EU standard contractual clauses or the EU US Data Privacy Framework). Anthropic does not train on API data and keeps it only for a limited period under its commercial terms; check the current period in Anthropic's privacy documentation, and ask for zero data retention if a customer needs it.

## Candidates' rights

| Right | How |
|:------|:----|
| Access and portability (Art. 15 and 20) | **Export data** in the candidate profile downloads a JSON file with everything stored about the candidate. **Open CV** downloads the CV. The export is logged. |
| Rectification (Art. 16) | **Edit profile** in the candidate profile. |
| Erasure (Art. 17) | **Erase permanently** in the candidate profile deletes the CV file first, then the candidate, the applications, the AI assessments and the history about them in one transaction, and records the erasure in `erasure_log`. If the file cannot be deleted, nothing is, so the erase can simply be tried again. |
| Objection to automated decisions (Art. 22) | Nothing is decided automatically. The AI score is advice, the app says so, and a low score only tints the card; a person moves or rejects every candidate. |

**Remove is not erase.** Remove hides a candidate or a job and lets an admin restore it. Use Erase for a request to be forgotten.

## Retention

A job runs every night (`/api/cron/retention`, Vercel Cron, 03:00 UTC):

* Candidates and jobs **removed more than 30 days ago** are erased for good.
* Candidates with **no activity for 24 months** are erased for good. Activity means a change to the profile, to any of their applications, or a new AI assessment. Two years follows common Swedish practice, which keeps applicant data as long as a discrimination claim can be brought.

Both limits are constants in `src/lib/data/erase.ts`. Every erasure is recorded in `erasure_log` with the reason `removed` or `retention`.

**Copies outside the database.** Supabase backups keep erased rows until the backup rotates out under the plan's backup retention. Anthropic keeps API inputs for its limited retention period. Files a recruiter downloaded or emailed are outside the system.

## Security

* Row level security on every table, with a pytest test for each policy, keeps each organization's data apart.
* CVs live in a private bucket and are opened through links that expire after 60 seconds. A removed candidate's CV is locked as well, and history entries about removed rows are hidden with them.
* The service role key is server only. It writes AI assessments, erases data and runs the retention job, always after the server has checked the caller.
* The retention job only runs with the `CRON_SECRET` bearer token.

## AI and the EU AI Act

AI that screens or ranks job applicants is classed as **high risk** in Annex III of the AI Act. After the Digital Omnibus (Regulation (EU) 2026/1744), those obligations apply from **2 December 2027**. The transparency duties in Article 50 already apply.

Until then, a customer using the AI assessment should:

* tell candidates that AI helps assess applications, in the privacy notice they give them (Art. 13 and 14 GDPR);
* keep a person in charge of every decision, which the app enforces;
* review the scores now and then for bias. The prompt keeps protected traits out of the judgement, and `scripts/eval_assessment.py` checks that the scores are consistent.

## Known limits

* The customer, as controller, writes the privacy notice for its candidates; the app does not collect consent or record where a candidate came from.
* Notes are free text. Recruiters should not write sensitive data (health, religion, union membership and so on) in them.
* Erasing a candidate does not reach backups or Anthropic until their retention runs out, as described above.
