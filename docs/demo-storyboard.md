# Demo storyboard (5 minutes, Loom)

A script for the demo video. Each scene lists what to show, what to say, and which part of the brief it covers. Times are targets; the whole run is about 5 minutes.

## Before recording

* Reseed production for clean data: `.venv/bin/python scripts/seed.py --prod` (this sets a new demo password; note it).
* Have three logins ready: your admin account, `sara.lindqvist@nordlys.example` (a customer recruiter) and the new password.
* As Sara, run Bedöm CV once on Elin Sandberg (Frontendutvecklare), so one assessment already exists as a fallback. A fresh seed has none.
* Keep `docs/demo/cv-nils-ekman.pdf` on the desktop. Nils Ekman is a fictional frontend candidate who is not in the seed data, so his assessment is a fresh one.
* Browser at 1440 by 900 or similar, light mode, Swedish. Close other tabs and notifications.
* Open https://ats.t4ngo.com/login in one tab and the GitHub repo in another.

## Scenes

### 1. Intro (0:00 to 0:20)

**Show:** the login page.

**Say:** "This is Mini ATS, an applicant tracking system for a first customer, live at ats.t4ngo.com. It is built with Next.js and Supabase and was built almost entirely with Claude Code. I'll show the admin side, the customer's daily work, and the AI features."

### 2. Admin creates the customer (0:20 to 1:10)

Covers stories 1 and 7.

**Show:**

1. Log in as the admin. Open Users: the administrators first, then each organization with its users, in cards of the same size.
2. On Nordlys Tech AB, Add user: name, email, click Generate for a temporary password, Create. The user appears in the card; the dots menu resets a password or deactivates.
3. Turn on developer mode under the cog, then use the wrench menu to preview the app as Nordlys Tech AB. Point at the green banner: the admin tools are gone, but every change is still logged as the admin. Exit the preview.

**Say:** "Every customer is an organization with its own users. Admins create the accounts with a temporary password, since there is no self signup. To help a customer, an admin acts as their organization: the banner makes it clear, and every change is still logged as the admin, so there is no impersonation."

### 3. The recruiter's day (1:10 to 2:30)

Covers stories 2 to 6.

**Show:**

1. Sign out, log in as Sara. The dashboard: switch the chart between 7, 30 and 90 days, point at Needs attention (flagged, stuck, not assessed) and click a candidate to open the drawer.
2. Jobs: candidates per phase and the openings, such as 1 of 2. Customer Success Manager has filled both openings, so it sits under Filled jobs with Reopen. Open Edit on one job to show the fields, then cancel.
3. Candidates: new applicants of the last week on top, then one list per job from hired down to rejected. New candidate: Nils Ekman, an email, a LinkedIn link, attach `cv-nils-ekman.pdf`, tick Frontendutvecklare, Save.
4. Pipeline: one board per job. Nils is in Ansökt on the Frontendutvecklare board. Drag him to Screening and star him. Point at the red tinted cards in Ansökt: candidates who do not meet the requirements are marked, not rejected. Hover the clock for days in stage, then open the folded Anställd lane.
5. Filters: pick Frontendutvecklare in the jobs menu, then type "Nils" in the search. Point at the URL: the view can be shared. Clear.
6. Press Ctrl K and jump to a candidate by name.

**Say:** "Every job has its own board, and lanes fold away when they are not needed. Drag and drop also works with the keyboard. Finished cards can be cleared off the board, and rejected ones leave on their own after a week. Filters live in the URL, so a recruiter can send a colleague the exact view."

### 4. AI CV assessment (2:30 to 3:30)

Covers the extra task.

**Show:**

1. Open Nils Ekman's drawer. Read the disclaimer aloud in one sentence.
2. Click Bedöm CV. While it runs (about 10 to 20 seconds), explain the approach.
3. Walk through the result: the score, the summary, strengths, gaps, the skill match with evidence, the interview questions. Close the drawer and point at the score badge on his card.

**Say, while it runs:** "The server reads the text from the PDF and sends it, together with the job description, to Claude with a fixed scoring rubric and structured output, so the result always has the same shape. The prompt tells the model to judge only job related evidence, never protected traits, and to treat the CV as data, not instructions. It only runs on a click, to control cost and keep a person in the loop. I also wrote an eval that scores the same CVs several times: the scores stay within 6 points and the ranking holds."

### 5. The recruiter assistant (3:30 to 4:20)

**Show:**

1. Click Assistent in the sidebar. Ask: "Vilka frontendkandidater har högst AI-poäng, och var i processen är de?" Let the answer stream in.
2. Ask: "Flytta Nils Ekman till Telefonintervju." The approval card appears. Click Godkänn; the card moves on the board behind the panel.

**Say:** "The assistant uses tools on the server that run as the signed in user, so it can only see what Sara can see. It can draft emails, but nothing is sent, and it never changes data without approval."

### 6. Custom stages (4:20 to 4:45)

**Show:**

1. Jobs, Steg on Frontendutvecklare: stages inside the fixed phases, such as Telefonintervju, Kodtest and Slutintervju.
2. Back on the pipeline: the Frontendutvecklare board shows those stages as its own lanes, while the dashboard and the filters keep the six common phases.

**Say:** "Each job can have its own process, while reporting keeps a common scale across jobs."

### 7. Quality and wrap up (4:45 to 5:00)

**Show:** the GitHub repo: the README, then the Actions tab with green runs.

**Say:** "Every table has row level security with a test for each policy, CI runs lint, unit, database and end to end tests on every pull request, and each phase was reviewed before merging. The assumptions I made are in the email. Thanks for watching."

## If something goes wrong

* An assessment fails: say so, click Bedöm igen, or show a candidate that was already assessed (Elin Sandberg).
* The assistant is slow: keep talking about the approval design; it usually answers within 10 seconds.
* A typo when adding Nils: edit the profile from the drawer, which also shows that editing works.
