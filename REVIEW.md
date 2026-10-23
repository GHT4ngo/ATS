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
| | | | | | |
