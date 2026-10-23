"""RLS for cv_assessments: organization members read, only the service role writes."""

from collections.abc import Iterator

import pytest
from conftest import Org, World
from postgrest.exceptions import APIError

from supabase import Client


def assessment(org: Org, score: int = 70) -> dict:
    return {
        "organization_id": org.id,
        "candidate_id": org.candidate_id,
        "job_id": org.job_id,
        "score": score,
        "summary": "Test",
        "model": "test",
    }


@pytest.fixture(scope="module")
def rows(world: World, service: Client) -> Iterator[dict[str, str]]:
    a = service.table("cv_assessments").insert(assessment(world.org_a)).execute().data[0]
    b = service.table("cv_assessments").insert(assessment(world.org_b)).execute().data[0]
    yield {"a": a["id"], "b": b["id"]}
    service.table("cv_assessments").delete().in_("id", [a["id"], b["id"]]).execute()


def test_customer_reads_only_own_org(world: World, login, rows):
    data = login(world.customer_a).table("cv_assessments").select("id").execute().data
    ids = {r["id"] for r in data}
    assert rows["a"] in ids
    assert rows["b"] not in ids


def test_admin_reads_every_org(world: World, login, rows):
    data = login(world.admin).table("cv_assessments").select("id").execute().data
    assert {rows["a"], rows["b"]} <= {r["id"] for r in data}


def test_inactive_user_reads_nothing(world: World, login, rows):
    assert login(world.inactive_a).table("cv_assessments").select("id").execute().data == []


@pytest.mark.parametrize("user", ["customer_a", "admin"])
def test_users_cannot_insert(user, world: World, login):
    with pytest.raises(APIError):
        login(getattr(world, user)).table("cv_assessments").insert(
            assessment(world.org_a, 100)
        ).execute()


@pytest.mark.parametrize("user", ["customer_a", "admin"])
def test_users_cannot_update_or_delete(user, world: World, login, service, rows):
    client = login(getattr(world, user))
    with pytest.raises(APIError):
        client.table("cv_assessments").update({"score": 100}).eq("id", rows["a"]).execute()
    with pytest.raises(APIError):
        client.table("cv_assessments").delete().eq("id", rows["a"]).execute()
    row = service.table("cv_assessments").select("score").eq("id", rows["a"]).single().execute()
    assert row.data["score"] == 70


def test_anon_reads_nothing(anon: Client, rows):
    with pytest.raises(APIError):
        anon.table("cv_assessments").select("id").execute()


def test_cross_org_candidate_is_rejected(world: World, service: Client):
    bad = {**assessment(world.org_a), "candidate_id": world.org_b.candidate_id}
    with pytest.raises(APIError):
        service.table("cv_assessments").insert(bad).execute()


# latest_cv_assessments: a security_invoker view, so the table's RLS applies


def test_latest_view_follows_rls(world: World, login, service: Client, rows):
    newer = service.table("cv_assessments").insert(assessment(world.org_a, 55)).execute().data[0]
    try:
        data = login(world.customer_a).table("latest_cv_assessments").select("*").execute().data
        pair = [
            r
            for r in data
            if r["candidate_id"] == world.org_a.candidate_id and r["job_id"] == world.org_a.job_id
        ]
        assert [r["id"] for r in pair] == [newer["id"]]
        assert {r["organization_id"] for r in data} == {world.org_a.id}
        assert (
            login(world.inactive_a).table("latest_cv_assessments").select("id").execute().data == []
        )
    finally:
        service.table("cv_assessments").delete().eq("id", newer["id"]).execute()


def test_anon_cannot_read_latest_view(anon: Client, rows):
    with pytest.raises(APIError):
        anon.table("latest_cv_assessments").select("id").execute()


# cv_assessment_locks and claim_cv_assessment: service role only


@pytest.mark.parametrize("user", ["customer_a", "admin"])
def test_users_cannot_use_locks(user, world: World, login):
    client = login(getattr(world, user))
    with pytest.raises(APIError):
        client.table("cv_assessment_locks").select("*").execute()
    with pytest.raises(APIError):
        client.table("cv_assessment_locks").insert(
            {"candidate_id": world.org_a.candidate_id, "job_id": world.org_a.job_id}
        ).execute()
    with pytest.raises(APIError):
        client.rpc(
            "claim_cv_assessment",
            {
                "p_candidate": world.org_a.candidate_id,
                "p_job": world.org_a.job_id,
                "p_stale_seconds": 0,
            },
        ).execute()


def test_claim_is_exclusive_until_stale(world: World, service: Client):
    args = {"p_candidate": world.org_b.candidate_id, "p_job": world.org_b.job_id}
    locks = service.table("cv_assessment_locks")
    try:
        assert service.rpc("claim_cv_assessment", {**args, "p_stale_seconds": 180}).execute().data
        assert (
            not service.rpc("claim_cv_assessment", {**args, "p_stale_seconds": 180}).execute().data
        )
        # A claim older than the stale window is taken over
        locks.update({"locked_at": "2000-01-01T00:00:00Z"}).eq(
            "candidate_id", args["p_candidate"]
        ).execute()
        assert service.rpc("claim_cv_assessment", {**args, "p_stale_seconds": 180}).execute().data
    finally:
        locks.delete().eq("candidate_id", args["p_candidate"]).execute()
