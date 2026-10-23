import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { NewCandidateDialog } from "@/components/candidates/new-candidate-dialog";
import { FilterBar } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScope } from "@/lib/data/scope";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; candidate?: string }>;
}) {
  const { q, candidate } = await searchParams;
  const t = await getTranslations("Candidates");
  const c = await getTranslations("Common");
  const scope = await getScope();

  let query = scope.candidates().order("created_at", { ascending: false });
  const term = q?.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.ilike("full_name", `%${term}%`);

  const [{ data: candidates }, { data: jobs }, { data: apps }] =
    await Promise.all([
      query,
      scope.jobs().order("title"),
      scope.applications().select("candidate_id, job_id"),
    ]);
  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <NewCandidateDialog
          jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))}
        />
      </div>
      <FilterBar />
      {candidates?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c("name")}</TableHead>
              <TableHead>{t("jobs")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead>{c("created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((cand) => (
              <TableRow key={cand.id}>
                <TableCell>
                  <Link
                    href={`/candidates?${new URLSearchParams({ ...(q ? { q } : {}), candidate: cand.id })}`}
                    className="font-medium hover:underline"
                  >
                    {cand.full_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(apps ?? [])
                      .filter((a) => a.candidate_id === cand.id)
                      .map((a) => (
                        <Badge key={a.job_id} variant="secondary">
                          {jobTitle.get(a.job_id)}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell>{cand.location ?? ""}</TableCell>
                <TableCell>
                  {new Date(cand.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
      {candidate && (
        <CandidateDrawerLoader key={candidate} candidateId={candidate} />
      )}
    </div>
  );
}
