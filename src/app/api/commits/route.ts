import { NextResponse } from "next/server";
import {
  buildDateRangeFromPreset,
  buildDateRangeFromYmd,
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
  RANGE_PRESET_DAYS,
  type RangePresetDays,
} from "@/lib/date-range";
import {
  isAllowedRepo,
  REPO_ALLOWLIST,
  type AllowedRepo,
} from "@/lib/repo-allowlist";
import { GitHubApiError, listCommitsForRepo, readGitHubTokenFromEnv } from "@/lib/github";
import type { CommitsResponse, DayRepoCount } from "@/lib/types";

type ApiError = { error: string };

const FEED_LIMIT = 50;

function toDayKey(iso: string, tzOffsetMinutes: number) {
  const date = new Date(iso);
  const adjusted = new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

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
  const tzParam = searchParams.get("tz")?.trim();
  const pageParam = searchParams.get("page")?.trim();
  const tzValue = tzParam ? Number(tzParam) : 0;
  // Apply client timezone offset so day buckets match the viewer's local day boundaries.
  const tzOffsetMinutes = Number.isFinite(tzValue) ? Math.max(-840, Math.min(840, tzValue)) : 0;
  const pageValue = pageParam ? Number(pageParam) : 1;
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;

  if (rangeParam && (sinceParam || untilParam)) {
    return jsonError(400, "Use either `range` or (`since` and `until`), not both.");
  }

  let dateRangeResult;
  if (rangeParam) {
    const rangeDays = Number(rangeParam);
    if (
      !Number.isFinite(rangeDays) ||
      !RANGE_PRESET_DAYS.includes(rangeDays as RangePresetDays)
    ) {
      return jsonError(400, "Invalid `range`. Must be 7, 30, 60, or 365.");
    }
    dateRangeResult = buildDateRangeFromPreset(rangeDays as RangePresetDays);
  } else if (sinceParam || untilParam) {
    if (!sinceParam || !untilParam) {
      return jsonError(400, "When using custom dates, provide both `since` and `until`.");
    }
    dateRangeResult = buildDateRangeFromYmd(sinceParam, untilParam, MAX_RANGE_DAYS);
  } else {
    dateRangeResult = buildDateRangeFromPreset(DEFAULT_RANGE_DAYS);
  }

  if (!dateRangeResult.ok) return jsonError(400, dateRangeResult.error);
  const rangeDays = dateRangeResult.daysInclusive;

  let repos: AllowedRepo[];
  const isAllProjects = repoParam === "all";
  if (repoParam === "all") {
    repos = [...REPO_ALLOWLIST];
  } else if (isAllowedRepo(repoParam)) {
    repos = [repoParam];
  } else {
    return jsonError(400, "Invalid `repo`. Must be `all` or an allowlisted owner/repo.");
  }

  try {
    const token = readGitHubTokenFromEnv();
    const hasToken = Boolean(token);
    const revalidateSeconds = hasToken ? 60 : 900;
    const concurrency = isAllProjects ? (hasToken ? 4 : 2) : 1;
    const maxPages = hasToken
      ? rangeDays >= MAX_RANGE_DAYS
        ? 8
        : rangeDays >= 180
          ? 6
          : rangeDays >= 90
            ? 4
            : 3
      : isAllProjects
        ? 1
        : 2;

    const repoFailures: Array<{ repo: AllowedRepo; status?: number; message: string }> = [];
    const perRepo = await mapWithConcurrency(repos, concurrency, async (repo) => {
      try {
        return await listCommitsForRepo({
          repo,
          sinceIso: dateRangeResult.sinceIso,
          untilIso: dateRangeResult.untilIso,
          perPage: 100,
          maxPages,
          revalidateSeconds,
          token,
        });
      } catch (err) {
        if (!isAllProjects) throw err;

        if (err instanceof GitHubApiError) {
          if (err.status === 401) throw err;
          if (err.status === 403 && /rate limit/i.test(err.message)) throw err;
          repoFailures.push({ repo, status: err.status, message: err.message });
          return { commits: [], truncated: false };
        }

        const message = err instanceof Error ? err.message : "Unknown error";
        repoFailures.push({ repo, message });
        return { commits: [], truncated: false };
      }
    });

    const commits = perRepo.flatMap((entry) => entry.commits);
    const truncated = perRepo.some((entry) => entry.truncated);
    commits.sort(
      (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
    );

    const totalCommits = commits.length;
    const totalPages = Math.max(1, Math.ceil(totalCommits / FEED_LIMIT));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * FEED_LIMIT;
    const limitedCommits = commits.slice(startIndex, startIndex + FEED_LIMIT);

    const dayCounts = new Map<string, number>();
    const perDayRepos = new Map<string, Map<string, number>>();
    for (const commit of commits) {
      const dayKey = toDayKey(commit.committedAt, tzOffsetMinutes);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
      if (!isAllProjects) continue;
      const existing = perDayRepos.get(dayKey) ?? new Map<string, number>();
      existing.set(commit.repo, (existing.get(commit.repo) ?? 0) + 1);
      perDayRepos.set(dayKey, existing);
    }

    const dailySummaries = Array.from(dayCounts.entries())
      .map(([dayKey, count]) => {
        let topRepos: DayRepoCount[] = [];
        if (isAllProjects) {
          const repoMap = perDayRepos.get(dayKey);
          if (repoMap) {
            topRepos = Array.from(repoMap.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([repo, repoCount]) => ({ repo, count: repoCount }));
          }
        }
        return { dayKey, count, topRepos };
      })
      .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));

    const isPartial = (isAllProjects && repoFailures.length > 0) || truncated;

    const payload: CommitsResponse = {
      commits: limitedCommits,
      totalCommits,
      dailySummaries,
      page: safePage,
      pageSize: FEED_LIMIT,
      totalPages,
    };

    return NextResponse.json<CommitsResponse>(payload, {
      headers: {
        "Cache-Control": `s-maxage=${hasToken ? 60 : 900}, stale-while-revalidate=${hasToken ? 300 : 900}`,
        "X-Ship-Auth": hasToken ? "token" : "none",
        ...(isPartial ? { "X-Ship-Partial": "1" } : {}),
        ...(truncated ? { "X-Ship-Truncated": "1" } : {}),
        ...(isAllProjects && repoFailures.length > 0
          ? {
              "X-Ship-Repo-Failures": String(repoFailures.length),
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const message =
        error.status === 403 && /rate limit/i.test(error.message)
          ? "GitHub API rate limit reached. Try again shortly."
          : error.status === 401
            ? "GitHub API authentication failed. Try again later."
          : `GitHub API error: ${error.message}`;
      return jsonError(502, message);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(500, message);
  }
}
