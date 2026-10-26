import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RemovedItem = {
  id: string;
  name: string;
  detail: string | null;
  removedAt: string;
  removedBy: string | null;
};

/**
 * Removed candidates or jobs in one organization. RLS hides these from every
 * signed in user, so this reads through the service role: call it only after
 * checking that the caller is an admin outside preview.
 */
export async function removedItems(
  orgId: string,
  entity: "candidate" | "job",
): Promise<RemovedItem[]> {
  const admin = createAdminClient();
  const rows =
    entity === "candidate"
      ? (
          await admin
            .from("candidates")
            .select("id, full_name, email, removed_at, removed_by")
            .eq("organization_id", orgId)
            .not("removed_at", "is", null)
            .order("removed_at", { ascending: false })
        ).data?.map((c) => ({
          id: c.id,
          name: c.full_name,
          detail: c.email,
          removed_at: c.removed_at,
          removed_by: c.removed_by,
        }))
      : (
          await admin
            .from("jobs")
            .select("id, title, location, removed_at, removed_by")
            .eq("organization_id", orgId)
            .not("removed_at", "is", null)
            .order("removed_at", { ascending: false })
        ).data?.map((j) => ({
          id: j.id,
          name: j.title,
          detail: j.location || null,
          removed_at: j.removed_at,
          removed_by: j.removed_by,
        }));
  if (!rows?.length) return [];

  const actorIds = [
    ...new Set(rows.map((r) => r.removed_by).filter(Boolean)),
  ] as string[];
  const { data: actors } = actorIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [] };
  const actor = new Map(
    (actors ?? []).map((a) => [a.id, a.full_name || a.email || null]),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    detail: r.detail,
    removedAt: r.removed_at!,
    removedBy: r.removed_by ? (actor.get(r.removed_by) ?? null) : null,
  }));
}
