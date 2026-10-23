"""RLS for organizations and profiles, including the profile field guard."""

import uuid

import pytest
from conftest import World
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

# organizations ----------------------------------------------------------------


def test_customer_reads_only_own_organization(world: World, login):
    rows = login(world.customer_a).table("organizations").select("id").execute().data
    assert [r["id"] for r in rows] == [world.org_a.id]


def test_admin_reads_every_organization(world: World, login):
    ids = {r["id"] for r in login(world.admin).table("organizations").select("id").execute().data}
    assert {world.org_a.id, world.org_b.id} <= ids


def test_customer_cannot_create_organization(world: World, login):
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table("organizations").insert(
            {"name": "Nope", "slug": f"nope-{uuid.uuid4().hex[:8]}"}
        ).execute()
    assert exc.value.code == "42501"


def test_customer_cannot_update_or_delete_organization(world: World, login, service):
    client = login(world.customer_a)
    assert (
        client.table("organizations")
        .update({"name": "Hacked"})
        .eq("id", world.org_a.id)
        .execute()
        .data
        == []
    )
    client.table("organizations").delete().eq("id", world.org_a.id).execute()
    row = (
        service.table("organizations")
        .select("name")
        .eq("id", world.org_a.id)
        .single()
        .execute()
        .data
    )
    assert row["name"] != "Hacked"


def test_admin_manages_organizations(world: World, login):
    client = login(world.admin)
    org = (
        client.table("organizations")
        .insert({"name": "Admin made", "slug": f"admin-made-{uuid.uuid4().hex[:8]}"})
        .execute()
        .data[0]
    )
    assert (
        client.table("organizations").update({"name": "Renamed"}).eq("id", org["id"]).execute().data
    )
    client.table("organizations").delete().eq("id", org["id"]).execute()
    assert client.table("organizations").select("id").eq("id", org["id"]).execute().data == []


# profiles ---------------------------------------------------------------------


def test_profile_created_from_app_metadata(world: World, service):
    profile = (
        service.table("profiles").select("*").eq("id", world.customer_a.id).single().execute().data
    )
    assert profile["role"] == "customer"
    assert profile["organization_id"] == world.org_a.id
    assert profile["full_name"] == "customer-a"
    admin = (
        service.table("profiles")
        .select("role, organization_id")
        .eq("id", world.admin.id)
        .single()
        .execute()
        .data
    )
    assert admin == {"role": "admin", "organization_id": None}


def test_user_metadata_cannot_grant_admin(service):
    """Role comes from app_metadata only; user_metadata is user controlled."""
    user = service.auth.admin.create_user(
        {
            "email": f"rls-sneaky-{uuid.uuid4().hex[:8]}@example.com",
            "password": "rls-test-password-1",
            "email_confirm": True,
            "app_metadata": {"role": "admin"},
            "user_metadata": {"role": "customer"},
        }
    ).user
    try:
        role = (
            service.table("profiles")
            .select("role")
            .eq("id", user.id)
            .single()
            .execute()
            .data["role"]
        )
        assert role == "admin"
    finally:
        service.auth.admin.delete_user(user.id)
    # Without a role in app_metadata no profile is created, so no access.
    user = service.auth.admin.create_user(
        {
            "email": f"rls-norole-{uuid.uuid4().hex[:8]}@example.com",
            "password": "rls-test-password-1",
            "email_confirm": True,
            "user_metadata": {"role": "admin"},
        }
    ).user
    try:
        assert service.table("profiles").select("id").eq("id", user.id).execute().data == []
    finally:
        service.auth.admin.delete_user(user.id)


def test_customer_requires_organization(service):
    with pytest.raises(AuthApiError):
        service.auth.admin.create_user(
            {
                "email": f"rls-orphan-{uuid.uuid4().hex[:8]}@example.com",
                "password": "rls-test-password-1",
                "email_confirm": True,
                "app_metadata": {"role": "customer"},
            }
        )


def test_customer_reads_self_and_team_only(world: World, login):
    ids = {r["id"] for r in login(world.customer_a).table("profiles").select("id").execute().data}
    assert {world.customer_a.id, world.teammate_a.id} <= ids
    assert world.customer_b.id not in ids
    assert world.admin.id not in ids


def test_admin_reads_every_profile(world: World, login):
    ids = {r["id"] for r in login(world.admin).table("profiles").select("id").execute().data}
    assert {world.customer_a.id, world.customer_b.id, world.admin.id} <= ids


def test_inactive_user_reads_only_self(world: World, login):
    rows = login(world.inactive_a).table("profiles").select("id").execute().data
    assert [r["id"] for r in rows] == [world.inactive_a.id]


def test_customer_updates_own_name_and_locale(world: World, login):
    client = login(world.customer_a)
    rows = (
        client.table("profiles")
        .update({"full_name": "Renamed", "locale": "en"})
        .eq("id", world.customer_a.id)
        .execute()
        .data
    )
    assert rows[0]["full_name"] == "Renamed"
    client.table("profiles").update({"full_name": "customer-a", "locale": "sv"}).eq(
        "id", world.customer_a.id
    ).execute()


def test_customer_cannot_update_teammate(world: World, login, service):
    login(world.customer_a).table("profiles").update({"full_name": "Hacked"}).eq(
        "id", world.teammate_a.id
    ).execute()
    row = (
        service.table("profiles")
        .select("full_name")
        .eq("id", world.teammate_a.id)
        .single()
        .execute()
        .data
    )
    assert row["full_name"] == "teammate-a"


@pytest.mark.parametrize(
    "change",
    [{"role": "admin"}, {"is_active": False}, {"organization_id": "org_b"}],
)
def test_customer_cannot_change_own_role_org_or_status(change, world: World, login):
    if change.get("organization_id") == "org_b":
        change = {"organization_id": world.org_b.id}
    with pytest.raises(APIError) as exc:
        login(world.customer_a).table("profiles").update(change).eq(
            "id", world.customer_a.id
        ).execute()
    assert exc.value.code == "42501"


def test_admin_updates_any_profile(world: World, login):
    client = login(world.admin)
    rows = (
        client.table("profiles")
        .update({"is_active": False})
        .eq("id", world.teammate_a.id)
        .execute()
        .data
    )
    assert rows[0]["is_active"] is False
    client.table("profiles").update({"is_active": True}).eq("id", world.teammate_a.id).execute()


def test_customer_cannot_delete_profiles(world: World, login, service):
    login(world.customer_a).table("profiles").delete().eq("id", world.teammate_a.id).execute()
    assert service.table("profiles").select("id").eq("id", world.teammate_a.id).execute().data != []


def test_profiles_cannot_be_inserted_directly(world: World, login):
    with pytest.raises(APIError) as exc:
        login(world.admin).table("profiles").insert({"id": str(uuid.uuid4())}).execute()
    assert exc.value.code == "42501"


def test_inactive_user_cannot_update_own_profile(world: World, login, service):
    login(world.inactive_a).table("profiles").update({"full_name": "x"}).eq(
        "id", world.inactive_a.id
    ).execute()
    row = (
        service.table("profiles")
        .select("full_name")
        .eq("id", world.inactive_a.id)
        .single()
        .execute()
        .data
    )
    assert row["full_name"] == "inactive-a"


def test_admin_deletes_profile_and_it_is_not_recreated(world: World, login, service):
    user = service.auth.admin.create_user(
        {
            "email": f"rls-deleted-{uuid.uuid4().hex[:8]}@example.com",
            "password": "rls-test-password-1",
            "email_confirm": True,
            "app_metadata": {"role": "admin"},
        }
    ).user
    try:
        login(world.admin).table("profiles").delete().eq("id", user.id).execute()
        assert service.table("profiles").select("id").eq("id", user.id).execute().data == []
        # A later app_metadata change must not bring the old admin role back.
        service.auth.admin.update_user_by_id(user.id, {"app_metadata": {"note": "x"}})
        assert service.table("profiles").select("id").eq("id", user.id).execute().data == []
    finally:
        service.auth.admin.delete_user(user.id)


def test_user_metadata_is_sanitized(world: World, service):
    user = service.auth.admin.create_user(
        {
            "email": f"rls-meta-{uuid.uuid4().hex[:8]}@example.com",
            "password": "rls-test-password-1",
            "email_confirm": True,
            "app_metadata": {"role": "customer", "organization_id": world.org_a.id},
            "user_metadata": {"full_name": "x" * 300, "locale": "de"},
        }
    ).user
    try:
        row = (
            service.table("profiles")
            .select("full_name, locale")
            .eq("id", user.id)
            .single()
            .execute()
            .data
        )
        assert row == {"full_name": "x" * 200, "locale": "sv"}
    finally:
        service.auth.admin.delete_user(user.id)


# profile email --------------------------------------------------------------


def test_profile_email_is_copied_from_the_login(world: World, login):
    row = (
        login(world.customer_a)
        .table("profiles")
        .select("email")
        .eq("id", world.customer_a.id)
        .single()
        .execute()
        .data
    )
    assert row["email"] == world.customer_a.email


def test_nobody_can_write_the_profile_email(world: World, login):
    for user in (world.customer_a, world.admin):
        with pytest.raises(APIError) as exc:
            login(user).table("profiles").update({"email": "x@example.com"}).eq(
                "id", world.customer_a.id
            ).execute()
        assert exc.value.code == "42501"


def test_profile_email_follows_an_email_change(world: World, service):
    new_email = f"changed-{uuid.uuid4().hex[:8]}@example.com"
    service.auth.admin.update_user_by_id(world.teammate_a.id, {"email": new_email})
    try:
        row = (
            service.table("profiles")
            .select("email")
            .eq("id", world.teammate_a.id)
            .single()
            .execute()
        )
        assert row.data["email"] == new_email
    finally:
        service.auth.admin.update_user_by_id(world.teammate_a.id, {"email": world.teammate_a.email})


def test_public_signup_is_disabled(anon):
    with pytest.raises(AuthApiError):
        anon.auth.sign_up(
            {"email": f"signup-{uuid.uuid4().hex[:8]}@example.com", "password": "signup-password-1"}
        )
