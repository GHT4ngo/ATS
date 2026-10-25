"""Seed a demo customer: Nordlys Tech AB, a fictional Stockholm tech company.

Creates the organization, two customer users, four jobs and 23 candidates
spread across the pipeline stages, each with a generated PDF CV, backdated
stage times and an activity history. Running it again replaces the demo data.

    .venv/bin/python scripts/seed.py           # local Supabase (supabase start)
    .venv/bin/python scripts/seed.py --prod    # the project in .env.local

The customer password comes from SEED_PASSWORD, or is generated and printed.
"""

import argparse
import json
import os
import secrets
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
from fpdf import FPDF

from supabase import Client, create_client

ROOT = Path(__file__).resolve().parent.parent
ORG = {"name": "Nordlys Tech AB", "slug": "nordlys-tech"}
STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"]

USERS = [
    ("sara.lindqvist@nordlys.example", "Sara Lindqvist"),
    ("johan.ek@nordlys.example", "Johan Ek"),
]

JOBS = {
    "frontend": {
        "openings": 2,
        "title": "Frontendutvecklare",
        "location": "Stockholm (hybrid)",
        "employment_type": "full_time",
        "description": (
            "Vi söker en frontendutvecklare som vill bygga vår bokningsplattform för "
            "energibolag. Du arbetar i ett team med fem utvecklare och en designer.\n\n"
            "Krav:\n- Minst tre års erfarenhet av React och TypeScript\n"
            "- Erfarenhet av Next.js eller annan SSR\n- God känsla för tillgänglighet\n\n"
            "Meriterande:\n- Tailwind CSS\n- Testning med Playwright\n- Erfarenhet av designsystem"
        ),
    },
    "backend": {
        "openings": 2,
        "title": "Backendutvecklare",
        "location": "Stockholm",
        "employment_type": "full_time",
        "description": (
            "Du bygger API:er och dataflöden som tar emot mätdata från tusentals "
            "elmätare i realtid.\n\nKrav:\n- Minst tre års erfarenhet av Node.js, Go "
            "eller Python\n- PostgreSQL och datamodellering\n- Erfarenhet av molnmiljöer "
            "(AWS eller GCP)\n\nMeriterande:\n- Kafka eller annan eventströmning\n"
            "- Kubernetes\n- Säkerhet och GDPR"
        ),
    },
    "designer": {
        "openings": 1,
        "title": "Produktdesigner",
        "location": "Stockholm (hybrid)",
        "employment_type": "full_time",
        "description": (
            "Vi söker en produktdesigner som äger användarupplevelsen från research "
            "till färdig design.\n\nKrav:\n- Minst tre års erfarenhet av produktdesign "
            "för webb eller app\n- Figma och prototyper\n- Användarintervjuer och "
            "tester\n\nMeriterande:\n- Designsystem\n- Erfarenhet av B2B SaaS"
        ),
    },
    "csm": {
        "openings": 2,
        "title": "Customer Success Manager",
        "location": "Stockholm",
        "employment_type": "full_time",
        "description": (
            "Du ansvarar för att våra kunder, svenska energibolag, lyckas med "
            "plattformen.\n\nKrav:\n- Minst två års erfarenhet av customer success "
            "eller account management inom SaaS\n- Flytande svenska och engelska\n"
            "- Van att leda kundmöten och utbildningar\n\nMeriterande:\n"
            "- Erfarenhet från energibranschen\n- CRM som HubSpot eller Salesforce"
        ),
    },
}

# name, location, years, skills, current role, previous role, education,
# LinkedIn handle (or None), and the applications as (job, stage, days in stage)
# The frontend job shows custom stages: the defaults for screening and
# interview are renamed, and interview gets a second stage.
FRONTEND_STAGES = {
    "screening": ["Telefonintervju"],
    "interview": ["Kodtest", "Slutintervju"],
}
# Candidates placed in a named stage instead of their phase's first stage
IN_STAGE = {"Oskar Holm": "Slutintervju"}
# Recruiter marks, so the board and the dashboard show stars and flags
MARKS = {
    "Elin Sandberg": {"starred": True},
    "Maja Svensson": {"starred": True},
    "Fredrik Lund": {"flagged": True},
    "Ida Wallin": {"flagged": True},
    # Short of the requirements: they stay in Applied, marked, not rejected
    "Viktor Nyström": {"mismatch": True},
    "Daniel Kovács": {"mismatch": True},
    "Sofia Ekström": {"mismatch": True},
}
# Code profiles for some of the developers
REPOS = {
    "Elin Sandberg": "https://github.com/elinsandberg",
    "Oskar Holm": "https://github.com/oskarholm",
    "Linnea Berg": "https://github.com/linneaberg",
    "Karin Åberg": "https://gitlab.com/karinaberg",
    "Mohammed Rahimi": "https://github.com/mrahimi",
    "Fredrik Lund": "https://github.com/fredriklund",
    "Petra Lindholm": "https://github.com/petralindholm",
}

CANDIDATES = [
    (
        "Elin Sandberg",
        "Stockholm",
        6,
        "React, TypeScript, Next.js, Tailwind CSS, Playwright",
        "Senior frontendutvecklare, Klarbo AB",
        "Frontendutvecklare, Mediahuset",
        "Civilingenjör datateknik, KTH",
        "elinsandberg",
        [("frontend", "offer", 2)],
    ),
    (
        "Oskar Holm",
        "Solna",
        4,
        "React, JavaScript, Redux, CSS, Jest",
        "Frontendutvecklare, Resekollen",
        "Webbutvecklare, Byrå Nord",
        "Systemvetenskap, Stockholms universitet",
        "oskarholm",
        [("frontend", "interview", 5)],
    ),
    (
        "Amira Haddad",
        "Stockholm",
        3,
        "Vue, TypeScript, Nuxt, Figma, tillgänglighet",
        "Frontendutvecklare, Vårdappen",
        "Junior utvecklare, Konsultgruppen",
        "Webbutveckling, Nackademin",
        "amirahaddad",
        [("frontend", "screening", 3)],
    ),
    (
        "Viktor Nyström",
        "Uppsala",
        1,
        "HTML, CSS, JavaScript, React",
        "Junior utvecklare, Startup Lab",
        "Praktikant, Webbstudion",
        "Frontendutveckling, YH Uppsala",
        None,
        [("frontend", "applied", 1)],
    ),
    (
        "Linnea Berg",
        "Stockholm",
        8,
        "React, TypeScript, Next.js, designsystem, GraphQL",
        "Tech lead frontend, Betalo",
        "Senior utvecklare, Spelbolaget",
        "Civilingenjör medieteknik, KTH",
        "linneaberg",
        [("frontend", "hired", 20)],
    ),
    (
        "Daniel Kovács",
        "Täby",
        2,
        "Angular, TypeScript, RxJS",
        "Utvecklare, Försäkringsbolaget",
        "Supporttekniker, IT Partner",
        "Datavetenskap, Mälardalens universitet",
        "danielkovac",
        [("frontend", "applied", 9)],
    ),
    (
        "Karin Åberg",
        "Stockholm",
        7,
        "Go, PostgreSQL, Kafka, Kubernetes, AWS",
        "Senior backendutvecklare, Elnätet AB",
        "Backendutvecklare, Logistikhuset",
        "Civilingenjör teknisk fysik, KTH",
        "karinaberg",
        [("backend", "interview", 18)],
    ),
    (
        "Mohammed Rahimi",
        "Sundbyberg",
        5,
        "Python, Django, PostgreSQL, GCP, Docker",
        "Backendutvecklare, Fintechbolaget",
        "Utvecklare, Kommunens IT",
        "Datateknik, Chalmers",
        "mrahimi",
        [("backend", "screening", 2)],
    ),
    (
        "Fredrik Lund",
        "Stockholm",
        10,
        "Node.js, TypeScript, PostgreSQL, AWS, säkerhet",
        "Arkitekt, Bankgruppen",
        "Senior utvecklare, Telekombolaget",
        "Civilingenjör datateknik, Linköpings universitet",
        "fredriklund",
        [("backend", "offer", 1)],
    ),
    (
        "Sofia Ekström",
        "Nacka",
        3,
        "Java, Spring Boot, MySQL",
        "Utvecklare, E-handelsbolaget",
        "Trainee, Konsultbolaget",
        "Systemutveckling, KTH",
        None,
        [("backend", "applied", 2)],
    ),
    (
        "Jonas Pettersson",
        "Stockholm",
        4,
        "Python, FastAPI, PostgreSQL, Kafka",
        "Dataingenjör, Strömdata",
        "Backendutvecklare, Analysbyrån",
        "Datavetenskap, Uppsala universitet",
        "jonaspettersson",
        [("backend", "applied", 0), ("frontend", "rejected", 12)],
    ),
    (
        "Ida Wallin",
        "Stockholm",
        5,
        "Figma, prototyper, användartester, designsystem",
        "Produktdesigner, Hälsoappen",
        "UX designer, Digitalbyrån",
        "Interaktionsdesign, Malmö universitet",
        "idawallin",
        [("designer", "interview", 6)],
    ),
    (
        "Leo Andersson",
        "Göteborg (distans)",
        2,
        "Figma, Sketch, illustration",
        "UI designer, Reklambyrån",
        "Grafisk formgivare, Tryckeriet",
        "Grafisk design, Beckmans",
        "leoandersson",
        [("designer", "screening", 4)],
    ),
    (
        "Maja Svensson",
        "Stockholm",
        9,
        "Figma, research, B2B SaaS, designsystem, workshops",
        "Lead designer, Lagerplattformen",
        "Produktdesigner, Mobilbanken",
        "Kognitionsvetenskap, Linköpings universitet",
        "majasvensson",
        [("designer", "offer", 3)],
    ),
    (
        "Hugo Lindgren",
        "Stockholm",
        1,
        "Figma, Adobe XD",
        "Junior designer, Byrå Syd",
        "Praktikant, Designstudion",
        "UX design, Hyper Island",
        None,
        [("designer", "applied", 16)],
    ),
    (
        "Nora Karlsson",
        "Huddinge",
        4,
        "Figma, prototyper, användarintervjuer",
        "UX designer, Kollektivtrafiken",
        "Webbdesigner, Kommunikationsbyrån",
        "Medieteknik, Södertörns högskola",
        "norakarlsson",
        [("designer", "rejected", 3)],
    ),
    (
        "Emma Johansson",
        "Stockholm",
        4,
        "Customer success, HubSpot, onboarding, utbildningar",
        "Customer Success Manager, HR Systemet",
        "Account manager, Mediehuset",
        "Ekonomi, Stockholms universitet",
        "emmajohansson",
        [("csm", "interview", 3)],
    ),
    (
        "Ali Yilmaz",
        "Stockholm",
        6,
        "Account management, Salesforce, energibranschen",
        "Key account manager, Energibolaget Väst",
        "Säljare, Elhandeln",
        "Marknadsföring, Handelshögskolan",
        "aliyilmaz",
        [("csm", "screening", 1)],
    ),
    (
        "Klara Nilsson",
        "Södertälje",
        2,
        "Kundsupport, Zendesk, utbildningar",
        "Supportspecialist, Molntjänsten",
        "Kundtjänst, Telekombolaget",
        "Kandidat i ledarskap, Södertörns högskola",
        None,
        [("csm", "applied", 4), ("designer", "rejected", 15)],
    ),
    (
        "Gustav Öberg",
        "Stockholm",
        7,
        "Customer success, Salesforce, förhandling, SaaS",
        "Head of customer success, Fastighetsplattformen",
        "CSM, Bokföringsappen",
        "Civilekonom, Uppsala universitet",
        "gustavoberg",
        [("csm", "hired", 30)],
    ),
    (
        "Petra Lindholm",
        "Stockholm",
        8,
        "Kotlin, Java, PostgreSQL, Kafka, AWS",
        "Senior backendutvecklare, Betalkompaniet",
        "Backendutvecklare, Logistikdata",
        "Civilingenjör teknisk fysik, KTH",
        "petralindholm",
        [("backend", "hired", 58)],
    ),
    (
        "Samuel Ek",
        "Sundbyberg",
        2,
        "Figma, prototyper, användartester",
        "UX-designer, Appstudion",
        "Praktikant, Designbyrån",
        "Interaktionsdesign, Malmö universitet",
        None,
        [("designer", "rejected", 64)],
    ),
    (
        "Tove Hedlund",
        "Stockholm",
        5,
        "Kundframgång, onboarding, HubSpot, SaaS",
        "Customer success manager, Bokningsbolaget",
        "Kundansvarig, Telekom Syd",
        "Ekonomie kandidat, Uppsala universitet",
        "tovehedlund",
        [("csm", "hired", 75)],
    ),
]


def config(prod: bool) -> tuple[str, str]:
    if prod:
        env = {**dotenv_values(ROOT / ".env.local"), **os.environ}
        url, key = env.get("NEXT_PUBLIC_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not (url and key):
            sys.exit("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing")
        return url, key
    out = subprocess.run(
        ["pnpm", "exec", "supabase", "status", "-o", "json"],
        capture_output=True,
        text=True,
        check=True,
        cwd=ROOT,
    ).stdout
    status = json.loads(out[out.index("{") :])
    return status["API_URL"], status["SERVICE_ROLE_KEY"]


def cv_pdf(c: tuple, email: str, phone: str, job_title: str) -> bytes:
    name, location, years, skills, current, previous, education, linkedin, _ = c
    pdf = FPDF()
    pdf.set_margins(20, 20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, name, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    contact = [email, phone, location]
    if linkedin:
        contact.append(f"linkedin.com/in/{linkedin}")
    pdf.cell(0, 6, "  |  ".join(contact), new_x="LMARGIN", new_y="NEXT")

    def section(title: str, body: str) -> None:
        pdf.ln(5)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5, body)

    section(
        "Profil",
        f"{years} års erfarenhet inom området. Söker rollen som {job_title} för att "
        f"arbeta med {skills.split(', ')[0]} i ett produktbolag med tydlig mission.",
    )
    first = max(years - 2, 0)
    section(
        "Erfarenhet",
        f"{current} ({datetime.now().year - min(years, 2)} till nu)\n"
        f"Ansvarade för leveranser med {skills}.\n\n"
        f"{previous} ({datetime.now().year - years} till {datetime.now().year - min(years, 2)})\n"
        f"Arbetade i team om fyra till åtta personer, {first} år med egna kunder.",
    )
    section("Kompetenser", skills)
    section("Utbildning", education)
    section("Språk", "Svenska och engelska, flytande")
    return bytes(pdf.output())


def wipe(db: Client) -> None:
    found = db.table("organizations").select("id").eq("slug", ORG["slug"]).execute().data
    if not found:
        return
    org_id = found[0]["id"]
    paths = [
        r["cv_path"]
        for r in db.table("candidates")
        .select("cv_path")
        .eq("organization_id", org_id)
        .execute()
        .data
        if r["cv_path"]
    ]
    if paths:
        db.storage.from_("cvs").remove(paths)
    for p in db.table("profiles").select("id").eq("organization_id", org_id).execute().data:
        db.auth.admin.delete_user(p["id"])
    db.table("organizations").delete().eq("id", org_id).execute()


def seed(db: Client, password: str) -> None:
    now = datetime.now(UTC)
    org_id = db.table("organizations").insert(ORG).execute().data[0]["id"]

    user_ids = []
    for email, name in USERS:
        user = db.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": {"role": "customer", "organization_id": org_id},
                "user_metadata": {"full_name": name},
            }
        ).user
        user_ids.append(user.id)
    recruiter = user_ids[0]

    activity = []

    def log(entity: str, entity_id: str, action: str, at: datetime, **payload) -> None:
        activity.append(
            {
                "organization_id": org_id,
                "actor_id": recruiter,
                "entity": entity,
                "entity_id": entity_id,
                "action": action,
                "payload": payload,
                "created_at": at.isoformat(),
            }
        )

    job_ids = {}
    for key, job in JOBS.items():
        created = now - timedelta(days=100)
        row = (
            db.table("jobs")
            .insert(
                {
                    **job,
                    "organization_id": org_id,
                    "created_by": recruiter,
                    "created_at": created.isoformat(),
                }
            )
            .execute()
            .data[0]
        )
        job_ids[key] = row["id"]
        log("job", row["id"], "created", created, title=job["title"])

    # A trigger created one default stage per phase for each job.
    stage_ids = {}
    for phase, names in FRONTEND_STAGES.items():
        default = (
            db.table("job_stages")
            .select("id")
            .eq("job_id", job_ids["frontend"])
            .eq("phase", phase)
            .single()
            .execute()
            .data
        )
        db.table("job_stages").update({"name": names[0]}).eq("id", default["id"]).execute()
        stage_ids[names[0]] = default["id"]
        for n, name in enumerate(names[1:], start=2):
            row = (
                db.table("job_stages")
                .insert(
                    {
                        "organization_id": org_id,
                        "job_id": job_ids["frontend"],
                        "phase": phase,
                        "name": name,
                        "position": 10 + n,
                    }
                )
                .execute()
                .data[0]
            )
            stage_ids[name] = row["id"]

    positions = {}
    for i, c in enumerate(CANDIDATES):
        name, location, *_, linkedin, apps = c
        email = name.lower().replace(" ", ".")
        for a, b in (("å", "a"), ("ä", "a"), ("ö", "o"), ("á", "a")):
            email = email.replace(a, b)
        email = f"{email}@example.com"
        phone = f"070-{100 + i:03d} {10 + i:02d} {30 + i:02d}"
        days_ago = max(d for _, _, d in apps) + 3 + 2 * len(STAGES)
        created = now - timedelta(days=days_ago, hours=i)
        cand = (
            db.table("candidates")
            .insert(
                {
                    "organization_id": org_id,
                    "full_name": name,
                    "email": email,
                    "phone": phone,
                    "location": location,
                    "created_by": recruiter,
                    "created_at": created.isoformat(),
                    "linkedin_url": f"https://www.linkedin.com/in/{linkedin}" if linkedin else None,
                    "repo_url": REPOS.get(name),
                    "notes": "",
                }
            )
            .execute()
            .data[0]
        )
        log("candidate", cand["id"], "created", created, name=name)

        path = f"{org_id}/{cand['id']}/cv.pdf"
        db.storage.from_("cvs").upload(
            path,
            cv_pdf(c, email, phone, JOBS[apps[0][0]]["title"]),
            {"content-type": "application/pdf", "upsert": "true"},
        )
        db.table("candidates").update({"cv_path": path}).eq("id", cand["id"]).execute()

        for job, stage, days in apps:
            changed = now - timedelta(days=days, hours=i)
            pos = positions[stage] = positions.get(stage, 0) + 1
            app = (
                db.table("applications")
                .insert(
                    {
                        "organization_id": org_id,
                        "candidate_id": cand["id"],
                        "job_id": job_ids[job],
                        "stage": stage,
                        # Set at insert, so the backdated stage time is kept
                        **(
                            {"stage_id": stage_ids[IN_STAGE[name]]}
                            if job == "frontend" and name in IN_STAGE
                            else {}
                        ),
                        "position": pos,
                        **MARKS.get(name, {}),
                        "created_at": created.isoformat(),
                        "stage_changed_at": changed.isoformat(),
                    }
                )
                .execute()
                .data[0]
            )
            # Walk the history: forward through the stages, or straight to rejected
            path_to = (
                ["applied", "screening", "rejected"]
                if stage == "rejected"
                else STAGES[: STAGES.index(stage) + 1]
            )
            steps = list(pairwise(path_to))
            for n, (frm, to) in enumerate(steps):
                at = changed - timedelta(days=2 * (len(steps) - 1 - n))
                log(
                    "application",
                    app["id"],
                    "moved",
                    at,
                    **{"from": frm, "to": to, "job": JOBS[job]["title"]},
                )

    db.table("activity_log").insert(activity).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--prod", action="store_true", help="seed the project in .env.local")
    parser.add_argument("--yes", action="store_true", help="skip the production prompt")
    args = parser.parse_args()

    url, key = config(args.prod)
    local = urlparse(url).hostname in ("127.0.0.1", "localhost")
    if args.prod and local:
        sys.exit(".env.local points at a local Supabase; drop --prod")
    if args.prod and not args.yes:
        answer = input(f"Replace the {ORG['name']} demo data on {url}? Type yes: ")
        if answer.strip() != "yes":
            sys.exit("Aborted")

    password = os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(12)
    db = create_client(url, key)
    wipe(db)
    seed(db, password)

    print(f"Seeded {ORG['name']} on {url}")
    print(f"  {len(JOBS)} jobs, {len(CANDIDATES)} candidates")
    for email, _ in USERS:
        print(f"  login: {email}")
    if not os.environ.get("SEED_PASSWORD"):
        print(f"  password: {password}")


if __name__ == "__main__":
    main()
