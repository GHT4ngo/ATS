const PAGE = 1000;

/**
 * Reads every page of a query. PostgREST returns at most 1000 rows per
 * request, and totals must not be cut off silently. The query needs a stable
 * order for the pages to line up.
 */
export async function allRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[] }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows };
  }
}
