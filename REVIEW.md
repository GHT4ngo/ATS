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
