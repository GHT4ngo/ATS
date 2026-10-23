"use server";

import { z } from "zod";
import { getOptionalScope } from "@/lib/data/scope";

export type SearchResult = {
  id: string;
  group: "candidates" | "jobs";
  label: string;
  href: string;
};

const LIMIT = 8;

/** Candidates and jobs in the active organization whose name matches the query. */
export async function searchEverything(query: string): Promise<SearchResult[]> {
  const parsed = z.string().trim().max(100).safeParse(query);
  if (!parsed.success) return [];
  const scope = await getOptionalScope();
  if (!scope) return [];

  const term = parsed.data.replace(/[%_,()]/g, " ");
  let candidates = scope.candidates().order("full_name").limit(LIMIT);
  let jobs = scope.jobs().order("title").limit(LIMIT);
  if (term) {
    candidates = candidates.ilike("full_name", `%${term}%`);
    jobs = jobs.ilike("title", `%${term}%`);
  }
  const [{ data: c }, { data: j }] = await Promise.all([candidates, jobs]);

  return [
    ...(c ?? []).map((cand) => ({
      id: cand.id,
      group: "candidates" as const,
      label: cand.full_name,
      href: `/candidates?candidate=${cand.id}`,
    })),
    ...(j ?? []).map((job) => ({
      id: job.id,
      group: "jobs" as const,
      label: job.title,
      href: `/pipeline?jobs=${job.id}`,
    })),
  ];
}
