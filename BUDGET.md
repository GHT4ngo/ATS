# BUDGET: Claude usage for the week

Goal: finish the project by Fri 30 Oct without running out of subscription usage. Check where we stand with `/usage` in Claude Code at the start of every day.

## Daily allocation (share of the weekly limit)

| Day | Work | Budget |
|:----|:-----|:------:|
| Fri 23 | Setup, plan, docs | 5% |
| Sat 24 | Foundations, data model, RLS | 15% |
| Sun 25 | Auth, admin, start of core features | 15% |
| Mon 26 | Core features: jobs, candidates, kanban | 20% |
| Tue 27 | Polish, tests, ship v1 | 15% |
| Wed 28 | AI CV assessment | 10% |
| Thu 29 | Extras, assumptions email, Loom script | 10% |
| Fri 30 | Fixes, final delivery | 5% |
| Reserve | Bugs and surprises | 5% |

If a day runs over, take it from the extras (Thu 29) first, never from the reserve.

## Model routing

| Task | Model | Why |
|:-----|:------|:----|
| Planning, architecture, RLS policies, phase reviews, tricky bugs | Opus | Mistakes here are expensive to fix later |
| Most feature work: components, server actions, pages | Sonnet | Good quality at a much lower cost |
| Mechanical work: translations (sv/en), seed data, boilerplate, renames, simple tests | Haiku subagent | Cheapest; the task is fully specified |

How to apply it:

* Run the main session on **Sonnet** by default (`/model sonnet`). Switch to **Opus** (`/model opus`) only for planning, phase reviews and hard problems, then switch back.
* Use **subagents sparingly.** Each one starts with no context and has to read the files again, so a subagent costs more than doing a small task directly. Use them only for large, well defined, mechanical batches, with a short and precise prompt and the Haiku model.
* Don't run several subagents in parallel for the same feature.

## Habits that save the most

* **One phase per session.** Run `/clear` between phases; PLAN.md and CLAUDE.md carry the context forward, so the chat history doesn't have to.
* Use `/compact` when a session gets long instead of letting it grow.
* Give precise instructions with file names; vague requests lead to wide searches.
* Keep CLAUDE.md short, because it is loaded in every session.
* Run tests and builds with quiet output, and read only the failures.
* Review once per phase, not once per commit (see [REVIEW.md](./REVIEW.md)).

## Separate cost: the Claude API in the app

The CV scoring and the agent use the **Anthropic API**, which is billed separately from this subscription. Plan for a small prepaid amount (for example 10 to 20 USD), set a spending limit in the Anthropic console, and use Sonnet for scoring. Assessments run on a button click, not automatically.
