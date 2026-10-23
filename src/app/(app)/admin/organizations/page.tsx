import { getTranslations } from "next-intl/server";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";
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

export default async function OrganizationsPage() {
  await requireAdmin();
  const t = await getTranslations("Admin");
  const c = await getTranslations("Common");
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, slug, created_at")
    .order("name");

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("organizationsTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("organizationsDescription")}
          </p>
        </div>
        <CreateOrganizationDialog />
      </div>
      {organizations?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c("name")}</TableHead>
              <TableHead>{t("slug")}</TableHead>
              <TableHead>{c("created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="font-mono text-xs">{o.slug}</TableCell>
                <TableCell>{o.created_at.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t("noOrganizations")}</p>
      )}
    </div>
  );
}
