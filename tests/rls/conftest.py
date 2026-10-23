"""Fixtures for the RLS integration tests.

The tests run against the local Supabase stack (`pnpm exec supabase start`).
They create two organizations with users and sample data through the service
role, then sign in as each user with the anon key to check what RLS allows.
"""

import json
import os
import subprocess
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from urllib.parse import urlparse

import pytest

from supabase import Client, create_client

PASSWORD = "rls-test-password-1"


def _local_config() -> dict[str, str]:
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and anon and service):
        out = subprocess.run(
            ["pnpm", "exec", "supabase", "status", "-o", "json"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        status = json.loads(out[out.index("{") :])
        url, anon, service = status["API_URL"], status["ANON_KEY"], status["SERVICE_ROLE_KEY"]
    # These tests create and delete users; never point them at a real project.
    if urlparse(url).hostname not in ("127.0.0.1", "localhost"):
        raise RuntimeError(f"RLS tests only run against a local Supabase, not {url}")
    return {"url": url, "anon": anon, "service": service}


@dataclass
class User:
    id: str
    email: str


@dataclass
class Org:
    id: str
    job_id: str
    candidate_id: str
    application_id: str
    activity_id: int


@dataclass
class World:
    org_a: Org
    org_b: Org
    admin: User
    customer_a: User
    teammate_a: User
    customer_b: User
    inactive_a: User


@pytest.fixture(scope="session")
def config() -> dict[str, str]:
    return _local_config()


@pytest.fixture(scope="session")
def service(config: dict[str, str]) -> Client:
    return create_client(config["url"], config["service"])


@pytest.fixture(scope="session")
def anon(config: dict[str, str]) -> Client:
    return create_client(config["url"], config["anon"])


@pytest.fixture(scope="session")
def world(service: Client) -> Iterator[World]:
    run = uuid.uuid4().hex[:8]
    user_ids: list[str] = []
    org_ids: list[str] = []

    def make_org(label: str) -> Org:
        org = (
            service.table("organizations")
            .insert({"name": f"RLS {label} {run}", "slug": f"rls-{label}-{run}"})
            .execute()
            .data[0]
        )
        org_ids.append(org["id"])
        job = (
            service.table("jobs")
            .insert({"organization_id": org["id"], "title": f"Job {label}"})
            .execute()
            .data[0]
        )
        candidate = (
            service.table("candidates")
            .insert({"organization_id": org["id"], "full_name": f"Candidate {label}"})
            .execute()
            .data[0]
        )
        application = (
            service.table("applications")
            .insert(
                {
                    "organization_id": org["id"],
                    "candidate_id": candidate["id"],
                    "job_id": job["id"],
                }
            )
            .execute()
            .data[0]
        )
        activity = (
            service.table("activity_log")
            .insert(
                {
                    "organization_id": org["id"],
                    "entity": "candidate",
                    "entity_id": candidate["id"],
                    "action": "created",
                }
            )
            .execute()
            .data[0]
        )
        return Org(org["id"], job["id"], candidate["id"], application["id"], activity["id"])

    def make_user(label: str, role: str, org: Org | None, active: bool = True) -> User:
        email = f"rls-{label}-{run}@example.com"
        app_metadata = {"role": role}
        if org:
            app_metadata["organization_id"] = org.id
        user = service.auth.admin.create_user(
            {
                "email": email,
                "password": PASSWORD,
                "email_confirm": True,
                "app_metadata": app_metadata,
                "user_metadata": {"full_name": label},
            }
        ).user
        user_ids.append(user.id)
        if not active:
            service.table("profiles").update({"is_active": False}).eq("id", user.id).execute()
        return User(user.id, email)

    try:
        org_a = make_org("a")
        org_b = make_org("b")
        yield World(
            org_a=org_a,
            org_b=org_b,
            admin=make_user("admin", "admin", None),
            customer_a=make_user("customer-a", "customer", org_a),
            teammate_a=make_user("teammate-a", "customer", org_a),
            customer_b=make_user("customer-b", "customer", org_b),
            inactive_a=make_user("inactive-a", "customer", org_a, active=False),
        )
    finally:
        for user_id in user_ids:
            service.auth.admin.delete_user(user_id)
        for org_id in org_ids:
            service.table("organizations").delete().eq("id", org_id).execute()


@pytest.fixture(scope="session")
def login(config: dict[str, str]) -> Callable[[User], Client]:
    """Return a client signed in as the given user, cached per user."""
    clients: dict[str, Client] = {}

    def _login(user: User) -> Client:
        if user.id not in clients:
            client = create_client(config["url"], config["anon"])
            client.auth.sign_in_with_password({"email": user.email, "password": PASSWORD})
            clients[user.id] = client
        return clients[user.id]

    return _login
