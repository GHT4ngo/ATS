"""RLS for organization scoped data: jobs, candidates and applications.

Each table has one "organization access" policy covering every command, so
every command is checked for both a customer and an admin.
"""

import uuid

import pytest
from conftest import Org, World
from postgrest.exceptions import APIError

TABLES = ["jobs", "candidates", "applications"]


def row_id(org: Org, table: str) -> str:
    return {"jobs": org.job_id, "candidates": org.candidate_id, "applications": org.application_id}[
        table
    ]


def update_for(table: str) -> dict:
    return {
        "jobs": {"title": "Changed"},
        "candidates": {"notes": "Changed"},
        "applications": {"rating": 5},
    }[table]


@pytest.mark.parametrize("table", TABLES)
def test_customer_reads_only_own_org(table, world: World, login):
    rows = login(world.customer_a).table(table).select("id, organization_id").execute().data
    ids = {r["id"] for r in rows}
    assert row_id(world.org_a, table) in ids
    assert row_id(world.org_b, table) not in ids
    assert {r["organization_id"] for r in rows} == {world.org_a.id}


@pytest.mark.parametrize("table", TABLES)
def test_admin_reads_every_org(table, world: World, login):
    ids = {r["id"] for r in login(world.admin).table(table).select("id").execute().data}
    assert {row_id(world.org_a, table), row_id(world.org_b, table)} <= ids


@pytest.mark.parametrize("table", TABLES)
def test_inactive_user_reads_nothing(table, world: World, login):
    assert login(world.inactive_a).table(table).select("id").execute().data == []


@pytest.mark.parametrize("table", TABLES)
def test_customer_cannot_update_other_org(table, world: World, login, service):
    target = row_id(world.org_b, table)
    result = (
        login(world.customer_a).table(table).update(update_for(table)).eq("id", target).execute()
    )
    assert result.data == []
    before = service.table(table).select("*").eq("id", target).single().execute().data
    key, value = next(iter(update_for(table).items()))
    assert before[key] != value


@pytest.mark.parametrize("table", TABLES)
def test_customer_cannot_delete_other_org(table, world: World, login, service):
    target = row_id(world.org_b, table)
    login(world.customer_a).table(table).delete().eq("id", target).execute()
    assert service.table(table).select("id").eq("id", target).execute().data != []


def _fresh_candidate(service, org: Org) -> str:
    return (
        service.table("candidates")
        .insert({"organization_id": org.id, "full_name": f"Extra {uuid.uuid4().hex[:6]}"})
        .execute()
        .data[0]["id"]
    )


def _payload(table: str, org: Org, service) -> dict:
    if table == "jobs":
        return {"organization_id": org.id, "title": "New job"}
    if table == "candidates":
        return {"organization_id": org.id, "full_name": "New candidate"}
    # A new application needs a candidate that has none for this job yet.
    return {
        "organization_id": org.id,
        "candidate_id": _fresh_candidate(service, org),
        "job_id": org.job_id,
    }


@pytest.mark.parametrize("table", TABLES)
def test_customer_cannot_insert_into_other_org(table, world: World, login, service):
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table(table).insert(_payload(table, world.org_b, service)).execute()
    assert exc.value.code == "42501"


@pytest.mark.parametrize("table", TABLES)
def test_customer_crud_in_own_org(table, world: World, login, service):
    client = login(world.customer_a)
    created = client.table(table).insert(_payload(table, world.org_a, service)).execute().data[0]
    updated = client.table(table).update(update_for(table)).eq("id", created["id"]).execute().data
    assert len(updated) == 1
    client.table(table).delete().eq("id", created["id"]).execute()
    assert service.table(table).select("id").eq("id", created["id"]).execute().data == []


@pytest.mark.parametrize("table", TABLES)
def test_admin_crud_in_any_org(table, world: World, login, service):
    client = login(world.admin)
    created = client.table(table).insert(_payload(table, world.org_b, service)).execute().data[0]
    updated = client.table(table).update(update_for(table)).eq("id", created["id"]).execute().data
    assert len(updated) == 1
    client.table(table).delete().eq("id", created["id"]).execute()
    assert service.table(table).select("id").eq("id", created["id"]).execute().data == []


@pytest.mark.parametrize("table", TABLES)
def test_customer_cannot_move_row_to_other_org(table, world: World, login):
    if table == "applications":
        pytest.skip("covered by test_application_cannot_mix_organizations")
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table(table).update({"organization_id": world.org_b.id}).eq(
            "id", row_id(world.org_a, table)
        ).execute()
    assert exc.value.code == "42501"


def test_application_cannot_mix_organizations(world: World, login):
    """A customer cannot link their candidate to another organization's job."""
    with pytest.raises(APIError):
        login(world.customer_a).table("applications").insert(
            {
                "organization_id": world.org_a.id,
                "candidate_id": world.org_a.candidate_id,
                "job_id": world.org_b.job_id,
            }
        ).execute()


def test_anon_reads_nothing(world: World, anon):
    for table in TABLES:
        with pytest.raises(APIError):
            anon.table(table).select("id").execute()


@pytest.mark.parametrize("table", ["jobs", "candidates"])
def test_created_by_is_forced_to_caller(table, world: World, login, service):
    client = login(world.customer_a)
    row = _payload(table, world.org_a, service) | {"created_by": world.teammate_a.id}
    created = client.table(table).insert(row).execute().data[0]
    assert created["created_by"] == world.customer_a.id
    updated = (
        client.table(table)
        .update({"created_by": world.teammate_a.id})
        .eq("id", created["id"])
        .execute()
        .data[0]
    )
    assert updated["created_by"] == world.customer_a.id
    client.table(table).delete().eq("id", created["id"]).execute()


def test_stage_changed_at_is_set_by_database(world: World, login, service):
    client = login(world.customer_a)
    row = _payload("applications", world.org_a, service) | {"stage_changed_at": "2000-01-01"}
    created = client.table("applications").insert(row).execute().data[0]
    assert not created["stage_changed_at"].startswith("2000")
    same = (
        client.table("applications")
        .update({"stage_changed_at": "2000-01-01"})
        .eq("id", created["id"])
        .execute()
        .data[0]
    )
    assert same["stage_changed_at"] == created["stage_changed_at"]
    moved = (
        client.table("applications")
        .update({"stage": "screening"})
        .eq("id", created["id"])
        .execute()
        .data[0]
    )
    assert moved["stage_changed_at"] > created["stage_changed_at"]
    client.table("applications").delete().eq("id", created["id"]).execute()


def test_cv_path_must_be_in_candidates_own_folder(world: World, login):
    client = login(world.customer_a)
    candidate_id = world.org_a.candidate_id
    with pytest.raises(APIError) as exc:
        client.table("candidates").update(
            {"cv_path": f"{world.org_b.id}/{world.org_b.candidate_id}/cv.pdf"}
        ).eq("id", candidate_id).execute()
    assert exc.value.code == "23514"
    own = f"{world.org_a.id}/{candidate_id}/cv.pdf"
    rows = client.table("candidates").update({"cv_path": own}).eq("id", candidate_id).execute()
    assert rows.data[0]["cv_path"] == own
    client.table("candidates").update({"cv_path": None}).eq("id", candidate_id).execute()
