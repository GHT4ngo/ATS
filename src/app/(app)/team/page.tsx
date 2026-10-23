import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const t = await getTranslations("Team");
  const c = await getTranslations("Common");
  const org = await getActiveOrganization();

  if (!org) {
    return (
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("pickOrganization")}</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("organization_id", org.id)
    .order("full_name");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description", { organization: org.name })}
        </p>
      </div>
      {members?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c("name")}</TableHead>
              <TableHead>{c("email")}</TableHead>
              <TableHead>{c("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.full_name || "-"}
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Badge variant={m.is_active ? "secondary" : "outline"}>
                    {m.is_active ? c("active") : c("inactive")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
