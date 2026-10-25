"""Job openings, archived applications and the candidate repository link."""

import pytest
from conftest import World
from postgrest.exceptions import APIError

from supabase import Client

NOW = "2026-10-31T12:00:00Z"


def row(service: Client, table: str, row_id: str) -> dict:
    return service.table(table).select("*").eq("id", row_id).single().execute().data


def test_defaults(world: World, service: Client):
    assert row(service, "jobs", world.org_a.job_id)["openings"] == 1
    assert row(service, "candidates", world.org_a.candidate_id)["repo_url"] is None
    assert row(service, "applications", world.org_a.application_id)["archived_at"] is None


def test_customer_sets_openings_and_repo(world: World, login, service: Client):
    client = login(world.customer_a)
    try:
        job = client.table("jobs").update({"openings": 3}).eq("id", world.org_a.job_id).execute()
        assert job.data[0]["openings"] == 3
        url = "https://github.com/example"
        cand = (
            client.table("candidates")
            .update({"repo_url": url})
            .eq("id", world.org_a.candidate_id)
            .execute()
        )
        assert cand.data[0]["repo_url"] == url
    finally:
        service.table("jobs").update({"openings": 1}).eq("id", world.org_a.job_id).execute()
        service.table("candidates").update({"repo_url": None}).eq(
            "id", world.org_a.candidate_id
        ).execute()


def test_openings_must_be_positive(world: World, login):
    with pytest.raises(APIError):
        login(world.customer_a).table("jobs").update({"openings": 0}).eq(
            "id", world.org_a.job_id
        ).execute()


def test_customer_archives_own_application(world: World, login, service: Client):
    app_id = world.org_a.application_id
    try:
        result = (
            login(world.customer_a)
            .table("applications")
            .update({"archived_at": NOW})
            .eq("id", app_id)
            .execute()
        )
        assert result.data[0]["archived_at"] is not None
    finally:
        service.table("applications").update({"archived_at": None}).eq("id", app_id).execute()


def test_customer_cannot_archive_other_org(world: World, login, service: Client):
    result = (
        login(world.customer_a)
        .table("applications")
        .update({"archived_at": NOW})
        .eq("id", world.org_b.application_id)
        .execute()
    )
    assert result.data == []
    assert row(service, "applications", world.org_b.application_id)["archived_at"] is None


def test_stage_change_brings_card_back(world: World, login, service: Client):
    app_id = world.org_a.application_id
    service.table("applications").update({"stage": "hired", "archived_at": NOW}).eq(
        "id", app_id
    ).execute()
    try:
        result = (
            login(world.customer_a)
            .table("applications")
            .update({"stage": "offer"})
            .eq("id", app_id)
            .execute()
        )
        assert result.data[0]["archived_at"] is None
    finally:
        service.table("applications").update({"stage": "applied", "archived_at": None}).eq(
            "id", app_id
        ).execute()
