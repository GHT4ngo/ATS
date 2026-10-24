# REVIEW: Code review log

One review per phase (or per larger PR), not per commit; that keeps the usage budget intact. Small fixes between reviews are covered by the next phase review.

## How a review is done

1. Finish the phase, with every commit pushed.
2. Switch to Opus and run `/code-review medium` on the phase's changes (`/code-review high` for Phase 2 security and Phase 3 auth).
3. Go through the checklist below.
4. Fix the findings, commit them as `fix: review findings phase N`, and add an entry to the log.

## Checklist

**Security**
* [ ] RLS is enabled on every new table, with a pytest test for each policy
* [ ] The service role key is used only in server code
* [ ] Every server action validates its input with zod and checks the user's role

**Correctness**
* [ ] The feature matches its user story in README.md
* [ ] Edge cases: empty lists, long names, missing LinkedIn link, slow network
* [ ] Lint, typecheck and all tests pass

**Quality**
* [ ] No hard coded UI strings; Swedish and English are both complete
* [ ] Checked in dark and light mode, on desktop and mobile width
* [ ] No dead code, console logs or leftover TODOs

## Log

| Date | Phase | Commits | Reviewer and model | Findings | Status |
|:-----|:------|:--------|:-------------------|:---------|:-------|
| 2026-10-23 | 2: data model and RLS | a781c99..e915f7a (PR #1) | `/code-review high`, Opus 5.5 | 10: cv_path could point at another organization's CV; deleted profile could be recreated from stale app_metadata; deactivated users could edit their profile; forgeable created_by and stage_changed_at; unsanitized user metadata; activity entries could reference other organizations; per row helper calls in policies; untested storage update and admin delete policies; cloud signup still open | Fixed, except cloud signup (manual step) |
| 2026-10-23 | 3: auth and admin | 8998946..5424414 (feat/auth-admin) | `/code-review high`, Opus 5.5 | 10, plus 3 found while checking: reset link rejected by local redirect allowlist; deactivated user e2e test too weak; ban and is_active could drift apart; logout kept the acting organization cookie; two server actions took unvalidated arguments; act as customer relies on every query filtering by organization; double Auth round trip per request in middleware; duplicated password field and hard coded minimum; RLS test did not restore its fixture on failure; biased password generator. Also: email provider disabled locally since Phase 2 (logins broke on restart), self referencing font variable (serif fallback), nav overflowing on mobile | Fixed, except organization scoping (moved to Phase 4 as its first task) |
| 2026-10-23 | 4: core customer features | a7400f7..fcba86d (feat/core-features) | `/code-review medium`, Opus 5.5 | 10, plus 1 found while fixing: a failed kanban move left the card in the wrong column; a card could not be moved down within its column; a failed application insert or CV upload left a half created candidate that a retry duplicated; React reset the forms on a server error; CVs over 4.5 MB hit the Vercel limit before the size check; updateCandidate ignored a failed application delete and a missing row; an invalid jobs id in the URL emptied the board; server locale dates; hard coded LinkedIn labels; actions bypassed the scope insert helpers. Also: a successful move made the board reset to stale server data | Fixed (3be4992). No e2e test yet for reordering within a column |
| 2026-10-23 | 5: polish | c775f21..295fa95 (PR #4) | `/code-review medium`, Opus 5.5 | 10, plus 1 found while checking: Ctrl K stopped working with the sidebar collapsed; the mobile drawer mounted a second palette; a collapsed sidebar hid sign out, theme and language; setLanguage ignored a failed save; the palette cap hid jobs; the layout fetched 700 rows on every render and bypassed the scope helper; hard coded strings in the global error page and the shortcut label; the drawer close button was labelled Open menu and had no focus trap; the collapsed sidebar flashed open on load. Also: the 404 button rendered a link without nativeButton | Fixed (295fa95). The org switcher still needs the sidebar expanded |
| 2026-10-23 | 7: AI CV assessment | bb9b65f..fa9d783 (PR #6) | `/code-review medium`, Opus 5.5 | 9: the 30 second cooldown let parallel clicks both call Claude and silently skipped a deliberate rerun (replaced by an atomic claim row per candidate and job); a failed CV download showed the upload error; the pipeline and drawer read every assessment ever written (now a security_invoker view of the latest per pair, filtered by job); non API failures were not logged; the PDF document was never destroyed and a corrupt PDF reported an AI failure; CV text could close the prompt's data tags; a failed activity log write went unnoticed | Fixed (fa9d783). One e2e flake in the core test, not reproduced in two full runs |
| 2026-10-24 | 8: recruiter agent | a0d69d3..773d764 (PR #7) | `/code-review medium`, Opus 5.5 | 10, plus 1 found while fixing: an unanswered tool call left in the history (cut off turn or failed approval request) made every later request fail; one invalid move hid the other valid moves in the same turn; no final event when the key was missing; Escape anywhere closed the panel and lost the conversation; requests were not cancelled; the 80 message cap was reached in normal use with a generic error; CV assessment error texts in the assistant; the move logic was copied without its revalidation (now shared with the kanban drag); writes to a disconnected stream threw; every tool loaded every table. Also: the optimistic user message was kept after a failed request and could break the history again | Fixed (773d764). Old turns are never trimmed, since editing history invalidates thinking blocks; a long conversation asks for a new one |
