"""job_stages: RLS, default stages, the phase sync on applications and the guards."""

import pytest
from conftest import World
from postgrest.exceptions import APIError

from supabase import Client

PHASES = ["applied", "screening", "interview", "offer", "hired", "rejected"]


def stages_of(client: Client, job_id: str) -> list[dict]:
    return (
        client.table("job_stages")
        .select("*")
        .eq("job_id", job_id)
        .order("phase")
        .order("position")
        .execute()
        .data
    )


def test_every_job_has_one_default_stage_per_phase(world: World, service: Client):
    for org in (world.org_a, world.org_b):
        stages = stages_of(service, org.job_id)
        assert [s["phase"] for s in stages] == PHASES
        assert all(s["name"] is None for s in stages)


def test_customer_sees_only_own_org_stages(world: World, login):
    rows = login(world.customer_a).table("job_stages").select("organization_id").execute().data
    assert rows and {r["organization_id"] for r in rows} == {world.org_a.id}


def test_admin_sees_every_org(world: World, login):
    rows = login(world.admin).table("job_stages").select("organization_id").execute().data
    assert {world.org_a.id, world.org_b.id} <= {r["organization_id"] for r in rows}


def test_inactive_user_sees_nothing(world: World, login):
    assert login(world.inactive_a).table("job_stages").select("id").execute().data == []


def test_customer_cannot_add_stage_to_other_org(world: World, login):
    with pytest.raises(APIError):
        login(world.customer_a).table("job_stages").insert(
            {
                "organization_id": world.org_b.id,
                "job_id": world.org_b.job_id,
                "name": "Sneaky",
                "phase": "interview",
            }
        ).execute()


def test_customer_cannot_rename_other_org_stage(world: World, login, service: Client):
    target = stages_of(service, world.org_b.job_id)[0]
    result = (
        login(world.customer_a)
        .table("job_stages")
        .update({"name": "Changed"})
        .eq("id", target["id"])
        .execute()
    )
    assert result.data == []
    assert stages_of(service, world.org_b.job_id)[0]["name"] is None


@pytest.fixture
def tech_test(world: World, login) -> dict:
    client = login(world.customer_a)
    stage = (
        client.table("job_stages")
        .insert(
            {
                "organization_id": world.org_a.id,
                "job_id": world.org_a.job_id,
                "name": "Tech test",
                "phase": "interview",
                "position": 10,
            }
        )
        .execute()
        .data[0]
    )
    yield stage
    # Put the fixture application back first; a stage in use cannot go.
    client.table("applications").update({"stage": "applied"}).eq(
        "id", world.org_a.application_id
    ).execute()
    client.table("job_stages").delete().eq("id", stage["id"]).execute()


def test_moving_to_a_custom_stage_syncs_the_phase(world: World, login, tech_test):
    client = login(world.customer_a)
    row = (
        client.table("applications")
        .update({"stage_id": tech_test["id"]})
        .eq("id", world.org_a.application_id)
        .execute()
        .data[0]
    )
    assert row["stage"] == "interview"
    assert row["stage_id"] == tech_test["id"]


def test_setting_only_the_phase_picks_its_first_stage(world: World, login, tech_test):
    client = login(world.customer_a)
    row = (
        client.table("applications")
        .update({"stage": "interview"})
        .eq("id", world.org_a.application_id)
        .execute()
        .data[0]
    )
    default_interview = next(
        s for s in stages_of(client, world.org_a.job_id) if s["phase"] == "interview"
    )
    assert row["stage_id"] == default_interview["id"]


def test_move_within_a_phase_restarts_days_in_stage(
    world: World, login, service: Client, tech_test
):
    client = login(world.customer_a)
    client.table("applications").update({"stage": "interview"}).eq(
        "id", world.org_a.application_id
    ).execute()
    service.table("applications").update({"stage_changed_at": "2020-01-01T00:00:00Z"}).eq(
        "id", world.org_a.application_id
    ).execute()
    row = (
        client.table("applications")
        .update({"stage_id": tech_test["id"]})
        .eq("id", world.org_a.application_id)
        .execute()
        .data[0]
    )
    assert not row["stage_changed_at"].startswith("2020")


def test_application_cannot_use_another_jobs_stage(world: World, service: Client):
    other_stage = stages_of(service, world.org_b.job_id)[0]
    with pytest.raises(APIError):
        service.table("applications").update({"stage_id": other_stage["id"]}).eq(
            "id", world.org_a.application_id
        ).execute()


def test_stage_phase_cannot_change(world: World, login, tech_test):
    with pytest.raises(APIError):
        login(world.customer_a).table("job_stages").update({"phase": "offer"}).eq(
            "id", tech_test["id"]
        ).execute()


def test_last_stage_of_a_phase_cannot_be_deleted(world: World, login):
    client = login(world.customer_a)
    offer = next(s for s in stages_of(client, world.org_a.job_id) if s["phase"] == "offer")
    with pytest.raises(APIError):
        client.table("job_stages").delete().eq("id", offer["id"]).execute()


def test_stage_in_use_cannot_be_deleted(world: World, login, tech_test):
    client = login(world.customer_a)
    client.table("applications").update({"stage_id": tech_test["id"]}).eq(
        "id", world.org_a.application_id
    ).execute()
    with pytest.raises(APIError):
        client.table("job_stages").delete().eq("id", tech_test["id"]).execute()


def test_anon_reads_nothing(anon: Client):
    with pytest.raises(APIError):
        anon.table("job_stages").select("id").execute()
