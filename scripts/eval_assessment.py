"""Score consistency eval for the AI CV assessment.

Runs the app's assessment prompt (src/lib/ai/assessment-prompt.json) several
times on sample CVs from the seed data against the frontend job, then reports
the spread of each candidate's scores and whether the ranking makes sense.

    .venv/bin/python scripts/eval_assessment.py            # 3 runs per CV
    .venv/bin/python scripts/eval_assessment.py --runs 5

Needs ANTHROPIC_API_KEY (environment or .env.local). Each run is one API call,
about 0.03 USD; the default costs well under 1 USD. Exits 1 when a candidate's
scores spread more than --max-spread points or the ranking is off.
"""

import argparse
import io
import itertools
import json
import os
import re
import statistics
import sys
from pathlib import Path
from typing import Literal

import anthropic
from dotenv import dotenv_values
from pydantic import BaseModel
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).parent))

from seed import CANDIDATES, JOBS, cv_pdf

ROOT = Path(__file__).resolve().parent.parent
PROMPT = json.loads((ROOT / "src/lib/ai/assessment-prompt.json").read_text())
MODEL = "claude-sonnet-5-5"  # keep in step with ASSESSMENT_MODEL in src/lib/ai/assess.ts

# Sample CVs for the frontend job, from the strongest to the weakest expected match
SAMPLE = ["Linnea Berg", "Elin Sandberg", "Amira Haddad", "Viktor Nyström", "Gustav Öberg"]


# Mirrors assessmentSchema in src/lib/ai/schema.ts
class SkillMatch(BaseModel):
    skill: str
    match: Literal["strong", "partial", "missing"]
    evidence: str


class Assessment(BaseModel):
    score: int
    summary: str
    strengths: list[str]
    gaps: list[str]
    skillMatches: list[SkillMatch]
    interviewQuestions: list[str]


def cv_text(name: str) -> str:
    c = next(c for c in CANDIDATES if c[0] == name)
    pdf = cv_pdf(c, "kandidat@example.com", "070-000 00 00", JOBS["frontend"]["title"])
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages).strip()


def neutralise_tags(text: str) -> str:
    return re.sub(r"<\s*/?\s*(cv|job|language)\b[^>]*>", "", text, flags=re.IGNORECASE)


def user_prompt(cv: str) -> str:
    job = JOBS["frontend"]
    values = {
        "language": "Swedish",
        "title": neutralise_tags(job["title"]),
        "description": neutralise_tags(job["description"]),
        "cv": neutralise_tags(cv),
    }
    # One pass, like buildUserPrompt in src/lib/ai/prompt.ts
    return re.sub(r"\{(language|title|description|cv)\}", lambda m: values[m[1]], PROMPT["user"])


def assess(client: anthropic.Anthropic, cv: str) -> tuple[int, int, int]:
    response = client.beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium"},
        output_format=Assessment,
        system=PROMPT["system"],
        messages=[{"role": "user", "content": user_prompt(cv)}],
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(f"no assessment (stop reason {response.stop_reason})")
    usage = response.usage
    return response.parsed_output.score, usage.input_tokens, usage.output_tokens


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--max-spread", type=int, default=10)
    args = parser.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY") or dotenv_values(ROOT / ".env.local").get(
        "ANTHROPIC_API_KEY"
    )
    if not key:
        sys.exit("ANTHROPIC_API_KEY is missing")
    client = anthropic.Anthropic(api_key=key)

    print(f"{MODEL}, prompt v{PROMPT['version']}, {args.runs} runs per CV\n")
    means, failed, tokens_in, tokens_out = [], False, 0, 0
    for name in SAMPLE:
        cv = cv_text(name)
        scores = []
        for _ in range(args.runs):
            score, i, o = assess(client, cv)
            scores.append(score)
            tokens_in, tokens_out = tokens_in + i, tokens_out + o
        spread = max(scores) - min(scores)
        sd = statistics.pstdev(scores)
        ok = spread <= args.max_spread
        failed |= not ok
        means.append(statistics.mean(scores))
        print(
            f"{'ok  ' if ok else 'FAIL'} {name:16} scores {scores}  "
            f"mean {means[-1]:5.1f}  sd {sd:4.1f}  spread {spread}"
        )

    # Allow a small tie between neighbours, but the strongest must beat the weakest.
    ranked = all(a >= b - 5 for a, b in itertools.pairwise(means)) and means[0] > means[-1]
    failed |= not ranked
    cost = tokens_in * 2 / 1e6 + tokens_out * 10 / 1e6
    print(f"\nranking {'ok' if ranked else 'FAIL'} (expected {' > '.join(SAMPLE)})")
    print(f"tokens in {tokens_in}, out {tokens_out}, about {cost:.2f} USD")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
