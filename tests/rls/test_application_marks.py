"""Recruiter marks on applications: starred, flagged and the manual mismatch."""

from conftest import World

from supabase import Client

MARKS = {"starred": True, "flagged": True, "mismatch": True}
CLEARED = {"starred": False, "flagged": False, "mismatch": None}


def app_row(service: Client, app_id: str) -> dict:
    return service.table("applications").select("*").eq("id", app_id).single().execute().data


def test_marks_default_to_unset(world: World, service: Client):
    row = app_row(service, world.org_b.application_id)
    assert (row["starred"], row["flagged"], row["mismatch"]) == (False, False, None)


def test_customer_marks_own_application(world: World, login, service: Client):
    client = login(world.customer_a)
    try:
        row = (
            client.table("applications")
            .update(MARKS)
            .eq("id", world.org_a.application_id)
            .execute()
            .data[0]
        )
        assert all(row[k] == v for k, v in MARKS.items())
    finally:
        service.table("applications").update(CLEARED).eq(
            "id", world.org_a.application_id
        ).execute()


def test_customer_cannot_mark_other_org(world: World, login, service: Client):
    result = (
        login(world.customer_a)
        .table("applications")
        .update(MARKS)
        .eq("id", world.org_b.application_id)
        .execute()
    )
    assert result.data == []
    assert app_row(service, world.org_b.application_id)["starred"] is False


def test_marking_keeps_days_in_stage(world: World, login, service: Client):
    app_id = world.org_a.application_id
    service.table("applications").update({"stage_changed_at": "2020-01-01T00:00:00Z"}).eq(
        "id", app_id
    ).execute()
    try:
        row = (
            login(world.customer_a)
            .table("applications")
            .update({"starred": True})
            .eq("id", app_id)
            .execute()
            .data[0]
        )
        assert row["stage_changed_at"].startswith("2020")
    finally:
        service.table("applications").update(CLEARED).eq("id", app_id).execute()
