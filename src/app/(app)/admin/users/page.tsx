import { getTranslations } from "next-intl/server";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const { profile: me } = await requireAdmin();
  const t = await getTranslations("Admin");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const [{ data: users }, { data: organizations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, organization_id")
      .order("full_name"),
    supabase.from("organizations").select("id, name").order("name"),
  ]);
  const orgName = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("usersTitle")}
          </h1>
          <p className="text-muted-foreground">{t("usersDescription")}</p>
        </div>
        <CreateUserDialog organizations={organizations ?? []} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{c("name")}</TableHead>
            <TableHead>{c("email")}</TableHead>
            <TableHead>{c("role")}</TableHead>
            <TableHead>{c("organization")}</TableHead>
            <TableHead>{c("status")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.full_name || "-"}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                {u.role === "admin" ? c("admin") : c("customer")}
              </TableCell>
              <TableCell>
                {u.organization_id
                  ? orgName.get(u.organization_id)
                  : t("adminNoOrganization")}
              </TableCell>
              <TableCell>
                <Badge variant={u.is_active ? "secondary" : "outline"}>
                  {u.is_active ? c("active") : c("inactive")}
                </Badge>
              </TableCell>
              <TableCell>
                <UserActions
                  userId={u.id}
                  name={u.full_name || u.email || ""}
                  isActive={u.is_active}
                  isSelf={u.id === me.id}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
