import { NextResponse } from "next/server";
import { buildDateRangeFromPreset, buildDateRangeFromYmd } from "@/lib/date-range";
import {
  isAllowedRepo,
  REPO_ALLOWLIST,
  type AllowedRepo,
} from "@/lib/repo-allowlist";
import { GitHubApiError, listCommitsForRepo } from "@/lib/github";
import type { CommitItem } from "@/lib/types";

type ApiError = { error: string };

function jsonError(status: number, error: string) {
  return NextResponse.json<ApiError>(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex++;
      if (index >= items.length) break;
      results[index] = await fn(items[index]!);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const repoParam = (searchParams.get("repo") ?? "all").trim();
  const rangeParam = searchParams.get("range")?.trim();
  const sinceParam = searchParams.get("since")?.trim();
  const untilParam = searchParams.get("until")?.trim();

  if (rangeParam && (sinceParam || untilParam)) {
    return jsonError(400, "Use either `range` or (`since` and `until`), not both.");
  }

  let dateRangeResult;
  if (rangeParam) {
    if (rangeParam !== "7" && rangeParam !== "30" && rangeParam !== "60") {
      return jsonError(400, "Invalid `range`. Must be 7, 30, or 60.");
    }
    dateRangeResult = buildDateRangeFromPreset(Number(rangeParam) as 7 | 30 | 60);
  } else if (sinceParam || untilParam) {
    if (!sinceParam || !untilParam) {
      return jsonError(400, "When using custom dates, provide both `since` and `until`.");
    }
    dateRangeResult = buildDateRangeFromYmd(sinceParam, untilParam, 60);
  } else {
    dateRangeResult = buildDateRangeFromPreset(7);
  }

  if (!dateRangeResult.ok) return jsonError(400, dateRangeResult.error);

  let repos: AllowedRepo[];
  if (repoParam === "all") {
    repos = [...REPO_ALLOWLIST];
  } else if (isAllowedRepo(repoParam)) {
    repos = [repoParam];
  } else {
    return jsonError(400, "Invalid `repo`. Must be `all` or an allowlisted owner/repo.");
  }

  try {
    const perRepo = await mapWithConcurrency(repos, repoParam === "all" ? 4 : 1, (repo) =>
      listCommitsForRepo({
        repo,
        sinceIso: dateRangeResult.sinceIso,
        untilIso: dateRangeResult.untilIso,
        perPage: 100,
        maxPages: 3,
        revalidateSeconds: 60,
      }),
    );

    const commits = perRepo.flat();
    commits.sort(
      (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
    );

    return NextResponse.json<CommitItem[]>(commits, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const message =
        error.status === 403
          ? "GitHub API rate limit reached. Try again shortly."
          : `GitHub API error: ${error.message}`;
      return jsonError(502, message);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(500, message);
  }
}
