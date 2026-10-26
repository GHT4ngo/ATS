"""Removed candidates and jobs, and permanent erasure."""

import uuid

import pytest
from conftest import Org, World
from postgrest.exceptions import APIError

from supabase import Client

NOW = "2026-11-01T12:00:00Z"


def make_pair(service: Client, org: Org, email: str | None = None) -> dict:
    """A fresh job, candidate, application and log entry, so tests can remove them."""
    job = service.table("jobs").insert({"organization_id": org.id, "title": "Temp"}).execute()
    cand = (
        service.table("candidates")
        .insert({"organization_id": org.id, "full_name": "Temp", "email": email})
        .execute()
    )
    app = (
        service.table("applications")
        .insert(
            {
                "organization_id": org.id,
                "candidate_id": cand.data[0]["id"],
                "job_id": job.data[0]["id"],
            }
        )
        .execute()
    )
    service.table("activity_log").insert(
        {
            "organization_id": org.id,
            "entity": "application",
            "entity_id": app.data[0]["id"],
            "action": "moved",
        }
    ).execute()
    return {"job": job.data[0]["id"], "cand": cand.data[0]["id"], "app": app.data[0]["id"]}


@pytest.fixture
def pair(world: World, service: Client):
    ids = make_pair(service, world.org_a)
    yield ids
    service.table("candidates").delete().eq("id", ids["cand"]).execute()
    service.table("jobs").delete().eq("id", ids["job"]).execute()


def visible(client: Client, table: str, row_id: str) -> bool:
    return bool(client.table(table).select("id").eq("id", row_id).execute().data)


def test_customer_removes_candidate_and_it_disappears(world: World, login, service, pair):
    client = login(world.customer_a)
    assert client.rpc("remove_candidate", {"p_id": pair["cand"]}).execute().data is True
    row = service.table("candidates").select("*").eq("id", pair["cand"]).single().execute()
    assert row.data["removed_at"] is not None
    assert row.data["removed_by"] == world.customer_a.id
    for user in (world.customer_a, world.teammate_a, world.admin):
        assert not visible(login(user), "candidates", pair["cand"])
        assert not visible(login(user), "applications", pair["app"])
    # Removing twice reports nothing removed.
    assert client.rpc("remove_candidate", {"p_id": pair["cand"]}).execute().data is False


def test_removed_job_hides_applications_and_stages(world: World, login, pair):
    client = login(world.customer_a)
    assert client.rpc("remove_job", {"p_id": pair["job"]}).execute().data is True
    assert not visible(client, "jobs", pair["job"])
    assert not visible(client, "applications", pair["app"])
    assert visible(client, "candidates", pair["cand"])
    stages = client.table("job_stages").select("id").eq("job_id", pair["job"]).execute()
    assert stages.data == []


def test_removed_candidate_hides_assessments(world: World, login, service, pair):
    service.table("cv_assessments").insert(
        {
            "organization_id": world.org_a.id,
            "candidate_id": pair["cand"],
            "job_id": pair["job"],
            "score": 50,
            "summary": "s",
            "model": "m",
        }
    ).execute()
    client = login(world.customer_a)
    client.rpc("remove_candidate", {"p_id": pair["cand"]}).execute()
    for table in ("cv_assessments", "latest_cv_assessments"):
        rows = client.table(table).select("id").eq("candidate_id", pair["cand"]).execute()
        assert rows.data == []


def test_customer_cannot_remove_other_org(world: World, login, service):
    ids = make_pair(service, world.org_b)
    try:
        client = login(world.customer_a)
        assert client.rpc("remove_candidate", {"p_id": ids["cand"]}).execute().data is False
        assert client.rpc("remove_job", {"p_id": ids["job"]}).execute().data is False
        row = service.table("candidates").select("removed_at").eq("id", ids["cand"]).single()
        assert row.execute().data["removed_at"] is None
    finally:
        service.table("candidates").delete().eq("id", ids["cand"]).execute()
        service.table("jobs").delete().eq("id", ids["job"]).execute()


def test_removed_at_cannot_be_set_directly(world: World, login, pair):
    client = login(world.customer_a)
    with pytest.raises(APIError):
        client.table("candidates").update({"removed_at": NOW}).eq("id", pair["cand"]).execute()
    with pytest.raises(APIError):
        client.table("jobs").update({"removed_at": NOW}).eq("id", pair["job"]).execute()


def test_cannot_insert_removed_rows(world: World, login):
    client = login(world.customer_a)
    with pytest.raises(APIError):
        client.table("candidates").insert(
            {"organization_id": world.org_a.id, "full_name": "X", "removed_at": NOW}
        ).execute()


def test_removed_rows_cannot_be_changed(world: World, login, pair):
    client = login(world.customer_a)
    client.rpc("remove_candidate", {"p_id": pair["cand"]}).execute()
    result = (
        client.table("candidates").update({"notes": "x"}).eq("id", pair["cand"]).execute()
    )
    assert result.data == []
    result = (
        client.table("applications").update({"rating": 3}).eq("id", pair["app"]).execute()
    )
    assert result.data == []


def test_removed_email_can_be_reused(world: World, login, service):
    email = f"reuse-{uuid.uuid4().hex[:8]}@example.com"
    ids = make_pair(service, world.org_a, email)
    client = login(world.customer_a)
    new_id = None
    try:
        client.rpc("remove_candidate", {"p_id": ids["cand"]}).execute()
        new = (
            client.table("candidates")
            .insert({"organization_id": world.org_a.id, "full_name": "Again", "email": email})
            .execute()
        )
        new_id = new.data[0]["id"]
        # Restoring the old row now clashes with the new one.
        with pytest.raises(APIError):
            service.table("candidates").update({"removed_at": None}).eq(
                "id", ids["cand"]
            ).execute()
    finally:
        if new_id:
            service.table("candidates").delete().eq("id", new_id).execute()
        service.table("candidates").delete().eq("id", ids["cand"]).execute()
        service.table("jobs").delete().eq("id", ids["job"]).execute()


def test_erase_and_purge_are_service_role_only(world: World, login, pair):
    for user in (world.customer_a, world.admin):
        for fn in ("erase_candidate", "purge_job"):
            with pytest.raises(APIError):
                login(user).rpc(fn, {"p_id": pair["cand"]}).execute()


def test_erase_deletes_candidate_and_its_log(world: World, service, pair):
    service.table("activity_log").insert(
        {
            "organization_id": world.org_a.id,
            "entity": "candidate",
            "entity_id": pair["cand"],
            "action": "created",
            "payload": {"name": "Temp"},
        }
    ).execute()
    assert service.rpc("erase_candidate", {"p_id": pair["cand"]}).execute().data is True
    assert service.table("candidates").select("id").eq("id", pair["cand"]).execute().data == []
    assert service.table("applications").select("id").eq("id", pair["app"]).execute().data == []
    logs = (
        service.table("activity_log")
        .select("id")
        .in_("entity_id", [pair["cand"], pair["app"]])
        .execute()
    )
    assert logs.data == []
    # The job stays.
    assert service.table("jobs").select("id").eq("id", pair["job"]).execute().data


def test_purge_deletes_job_and_its_log(world: World, service, pair):
    assert service.rpc("purge_job", {"p_id": pair["job"]}).execute().data is True
    assert service.table("jobs").select("id").eq("id", pair["job"]).execute().data == []
    logs = service.table("activity_log").select("id").eq("entity_id", pair["app"]).execute()
    assert logs.data == []
    assert service.table("candidates").select("id").eq("id", pair["cand"]).execute().data
