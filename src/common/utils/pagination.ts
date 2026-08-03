export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

// Shared by every admin list endpoint so the page/limit clamping logic isn't
// repeated per module. Silently falls back to sane defaults on bad input
// instead of erroring — these are internal admin list views, not a public API.
export function parsePagination(
  query: Record<string, unknown>,
  { defaultLimit = 20, maxLimit = 100 }: PaginationOptions = {},
): PaginationResult {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
