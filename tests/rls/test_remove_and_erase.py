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


def erase_args(row_id: str, actor: str | None, reason: str = "request") -> dict:
    return {"p_id": row_id, "p_actor": actor, "p_reason": reason}


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
                login(user).rpc(fn, erase_args(pair["cand"], user.id)).execute()
        for fn, args in (
            ("expired_candidates", {"p_removed_days": 30, "p_retention_months": 24}),
            ("expired_jobs", {"p_removed_days": 30}),
        ):
            with pytest.raises(APIError):
                login(user).rpc(fn, args).execute()


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
    assert service.rpc("erase_candidate", erase_args(pair["cand"], world.customer_a.id)).execute().data is True
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
    assert service.rpc("purge_job", erase_args(pair["job"], None, "removed")).execute().data is True
    assert service.table("jobs").select("id").eq("id", pair["job"]).execute().data == []
    logs = service.table("activity_log").select("id").eq("entity_id", pair["app"]).execute()
    assert logs.data == []
    assert service.table("candidates").select("id").eq("id", pair["cand"]).execute().data


def erasures(service: Client, org: Org) -> list[dict]:
    return service.table("erasure_log").select("*").eq("organization_id", org.id).execute().data


def test_erase_is_recorded_without_personal_data(world: World, service, login, pair):
    before = len(erasures(service, world.org_a))
    service.rpc("erase_candidate", erase_args(pair["cand"], world.customer_a.id)).execute()
    rows = erasures(service, world.org_a)
    assert len(rows) == before + 1
    last = max(rows, key=lambda r: r["id"])
    assert (last["entity"], last["reason"], last["erased_by"]) == (
        "candidate",
        "request",
        world.customer_a.id,
    )
    assert set(last) == {"id", "organization_id", "entity", "reason", "erased_by", "erased_at"}
    # Erasing a candidate that is already gone records nothing.
    again = service.rpc("erase_candidate", erase_args(pair["cand"], None)).execute()
    assert again.data is False
    assert len(erasures(service, world.org_a)) == before + 1


def test_erasure_log_read_by_own_org_only(world: World, service, login, pair):
    service.rpc("purge_job", erase_args(pair["job"], None, "removed")).execute()
    own = login(world.customer_a).table("erasure_log").select("id").execute().data
    other = login(world.customer_b).table("erasure_log").select("organization_id").execute()
    assert own
    assert all(r["organization_id"] == world.org_b.id for r in other.data)
    assert login(world.admin).table("erasure_log").select("id").execute().data


def test_erasure_log_cannot_be_written_by_users(world: World, login):
    for user in (world.customer_a, world.admin):
        with pytest.raises(APIError):
            login(user).table("erasure_log").insert(
                {"organization_id": world.org_a.id, "entity": "job", "reason": "request"}
            ).execute()


def expired(service: Client) -> dict[str, str]:
    rows = service.rpc(
        "expired_candidates", {"p_removed_days": 30, "p_retention_months": 24}
    ).execute()
    return {r["id"]: r["reason"] for r in rows.data}



OLD = "2020-01-01T00:00:00Z"


def test_expired_candidates(world: World, service: Client):
    job = world.org_a.job_id
    old = service.table("candidates").insert(
        {"organization_id": world.org_a.id, "full_name": "Old", "updated_at": OLD}
    ).execute().data[0]["id"]
    service.table("applications").insert(
        {
            "organization_id": world.org_a.id,
            "candidate_id": old,
            "job_id": job,
            "created_at": OLD,
            "updated_at": OLD,
        }
    ).execute()
    # Old profile, but an application that moved recently.
    busy = service.table("candidates").insert(
        {"organization_id": world.org_a.id, "full_name": "Busy", "updated_at": OLD}
    ).execute().data[0]["id"]
    service.table("applications").insert(
        {"organization_id": world.org_a.id, "candidate_id": busy, "job_id": job}
    ).execute()
    gone = service.table("candidates").insert(
        {"organization_id": world.org_a.id, "full_name": "Gone"}
    ).execute().data[0]["id"]
    service.table("candidates").update({"removed_at": OLD}).eq("id", gone).execute()
    fresh = service.table("candidates").insert(
        {"organization_id": world.org_a.id, "full_name": "Fresh"}
    ).execute().data[0]["id"]
    service.table("candidates").update({"removed_at": "now()"}).eq("id", fresh).execute()
    try:
        found = expired(service)
        assert found.get(old) == "retention"
        assert found.get(gone) == "removed"
        assert busy not in found
        assert fresh not in found
        assert world.org_a.candidate_id not in found
    finally:
        service.table("candidates").delete().in_("id", [old, busy, gone, fresh]).execute()


def test_expired_jobs(world: World, service: Client):
    ids = make_pair(service, world.org_a)
    try:
        service.table("jobs").update({"removed_at": OLD}).eq("id", ids["job"]).execute()
        rows = service.rpc("expired_jobs", {"p_removed_days": 30}).execute().data
        assert ids["job"] in {r["id"] for r in rows}
        assert world.org_a.job_id not in {r["id"] for r in rows}
    finally:
        service.table("candidates").delete().eq("id", ids["cand"]).execute()
        service.table("jobs").delete().eq("id", ids["job"]).execute()
