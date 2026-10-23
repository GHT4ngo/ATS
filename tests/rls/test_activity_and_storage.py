"""RLS for the activity log and the private cvs storage bucket."""

import uuid

import pytest
from conftest import Org, World
from postgrest.exceptions import APIError
from storage3.exceptions import StorageApiError

PDF = b"%PDF-1.4\n%rls test\n"


# activity_log -----------------------------------------------------------------


def _entry(org: Org, actor_id: str, entity_id: str | None = None) -> dict:
    return {
        "organization_id": org.id,
        "actor_id": actor_id,
        "entity": "candidate",
        "entity_id": entity_id or org.candidate_id,
        "action": "rls_test",
    }


def test_customer_reads_only_own_activity(world: World, login):
    ids = {
        r["id"] for r in login(world.customer_a).table("activity_log").select("id").execute().data
    }
    assert world.org_a.activity_id in ids
    assert world.org_b.activity_id not in ids


def test_admin_reads_all_activity(world: World, login):
    ids = {r["id"] for r in login(world.admin).table("activity_log").select("id").execute().data}
    assert {world.org_a.activity_id, world.org_b.activity_id} <= ids


def test_customer_logs_as_self_in_own_org(world: World, login):
    rows = (
        login(world.customer_a)
        .table("activity_log")
        .insert(_entry(world.org_a, world.customer_a.id))
        .execute()
        .data
    )
    assert rows[0]["actor_id"] == world.customer_a.id


def test_customer_cannot_log_as_someone_else(world: World, login):
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table("activity_log").insert(
            _entry(world.org_a, world.teammate_a.id)
        ).execute()
    assert exc.value.code == "42501"


def test_customer_cannot_log_into_other_org(world: World, login):
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table("activity_log").insert(
            _entry(world.org_b, world.customer_a.id)
        ).execute()
    assert exc.value.code == "42501"


def test_admin_logs_into_any_org_as_self(world: World, login):
    rows = (
        login(world.admin)
        .table("activity_log")
        .insert(_entry(world.org_b, world.admin.id))
        .execute()
        .data
    )
    assert rows[0]["actor_id"] == world.admin.id


@pytest.mark.parametrize("who", ["customer_a", "admin"])
def test_entry_must_reference_entity_in_same_org(who, world: World, login):
    with pytest.raises(APIError) as exc:
        login(getattr(world, who)).table("activity_log").insert(
            _entry(world.org_a, getattr(world, who).id, world.org_b.candidate_id)
        ).execute()
    assert exc.value.code == "23503"


@pytest.mark.parametrize("who", ["customer_a", "admin"])
def test_activity_log_is_append_only(who, world: World, login, service):
    client = login(getattr(world, who))
    with pytest.raises(APIError):
        client.table("activity_log").update({"action": "tampered"}).eq(
            "id", world.org_a.activity_id
        ).execute()
    with pytest.raises(APIError):
        client.table("activity_log").delete().eq("id", world.org_a.activity_id).execute()
    row = (
        service.table("activity_log")
        .select("action")
        .eq("id", world.org_a.activity_id)
        .single()
        .execute()
        .data
    )
    assert row["action"] == "created"


# storage ----------------------------------------------------------------------


def _path(org_id: str) -> str:
    return f"{org_id}/{uuid.uuid4()}/cv.pdf"


def _upload(client, path: str):
    return client.storage.from_("cvs").upload(path, PDF, {"content-type": "application/pdf"})


def test_customer_uploads_reads_and_deletes_own_org_cv(world: World, login):
    bucket = login(world.customer_a).storage.from_("cvs")
    path = _path(world.org_a.id)
    _upload(login(world.customer_a), path)
    assert bucket.download(path) == PDF
    bucket.remove([path])
    with pytest.raises(StorageApiError):
        bucket.download(path)


def test_customer_cannot_upload_to_other_org(world: World, login):
    with pytest.raises(StorageApiError):
        _upload(login(world.customer_a), _path(world.org_b.id))


def test_customer_cannot_upload_outside_org_folder(world: World, login):
    with pytest.raises(StorageApiError):
        _upload(login(world.customer_a), f"not-an-org/{uuid.uuid4()}/cv.pdf")


def test_customer_cannot_read_or_delete_other_org_cv(world: World, login, service):
    path = _path(world.org_b.id)
    _upload(service, path)
    try:
        bucket = login(world.customer_a).storage.from_("cvs")
        with pytest.raises(StorageApiError):
            bucket.download(path)
        bucket.remove([path])
        assert service.storage.from_("cvs").download(path) == PDF
    finally:
        service.storage.from_("cvs").remove([path])


def test_admin_manages_any_org_cv(world: World, login):
    bucket = login(world.admin).storage.from_("cvs")
    path = _path(world.org_b.id)
    _upload(login(world.admin), path)
    assert bucket.download(path) == PDF
    bucket.remove([path])


def test_inactive_user_cannot_upload(world: World, login):
    with pytest.raises(StorageApiError):
        _upload(login(world.inactive_a), _path(world.org_a.id))


def test_bucket_rejects_non_pdf(world: World, login):
    with pytest.raises(StorageApiError):
        login(world.customer_a).storage.from_("cvs").upload(
            _path(world.org_a.id), b"hello", {"content-type": "text/plain"}
        )


def test_customer_cannot_move_cv_into_other_org(world: World, login):
    bucket = login(world.customer_a).storage.from_("cvs")
    path = _path(world.org_a.id)
    _upload(login(world.customer_a), path)
    try:
        with pytest.raises(StorageApiError):
            bucket.move(path, _path(world.org_b.id))
    finally:
        bucket.remove([path])


def test_customer_cannot_overwrite_other_org_cv(world: World, login, service):
    path = _path(world.org_b.id)
    _upload(service, path)
    try:
        with pytest.raises(StorageApiError):
            login(world.customer_a).storage.from_("cvs").update(
                path, b"%PDF-1.4\n%tampered\n", {"content-type": "application/pdf"}
            )
        assert service.storage.from_("cvs").download(path) == PDF
    finally:
        service.storage.from_("cvs").remove([path])


def test_customer_and_admin_update_cv_in_scope(world: World, login):
    for user, org in [(world.customer_a, world.org_a), (world.admin, world.org_b)]:
        bucket = login(user).storage.from_("cvs")
        path, moved = _path(org.id), _path(org.id)
        _upload(login(user), path)
        bucket.move(path, moved)
        assert bucket.download(moved) == PDF
        bucket.remove([moved])
