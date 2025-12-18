"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { repoDisplayName } from "@/lib/repo-allowlist";
import type { CommitItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShippingHeatmapProps = {
  commits: CommitItem[];
  rangeStart: Date;
  rangeEnd: Date;
  selectedRepo: string;
  loading?: boolean;
};

type DayRepoCount = { repo: string; count: number };

type HeatmapCell = {
  date: Date;
  dayKey: string;
  inRange: boolean;
  count: number;
  topRepos: DayRepoCount[];
};

const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
});

const bestDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function clampPercentileIndex(n: number, rawIndex: number) {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, rawIndex));
}

function quantile(sorted: number[], percentile: number) {
  if (sorted.length === 0) return 0;
  const idx = clampPercentileIndex(sorted.length, Math.floor((sorted.length - 1) * percentile));
  return sorted[idx] ?? 0;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function formatDayLabel(date: Date) {
  return dayLabelFormatter.format(date);
}

function formatMonthLabel(date: Date) {
  return monthLabelFormatter.format(date);
}

function parseYmdToLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const yyyy = Number(match[1]);
  const mm = Number(match[2]);
  const dd = Number(match[3]);
  if (!yyyy || !mm || !dd) return null;
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }
  return date;
}

function intensityLevel(count: number, q1: number, q2: number, q3: number) {
  if (count <= 0) return 0;
  if (count <= q1) return 1;
  if (count <= q2) return 2;
  if (count <= q3) return 3;
  return 4;
}

const levelClasses: Record<number, string> = {
  0: "bg-muted/35",
  1: "bg-primary/15",
  2: "bg-primary/25",
  3: "bg-primary/35",
  4: "bg-primary/50",
};

function HeatmapLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 text-xs text-muted-foreground", className)}>
      <span>Less</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "h-3 w-3 rounded-[3px] border border-border/60",
              idx === 0 ? "bg-muted/35" : levelClasses[idx],
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

function HeatmapSkeleton({
  weeks,
  monthLabels,
}: {
  weeks: Array<Array<{ inRange: boolean; dayKey: string }>>;
  monthLabels: Array<string | null>;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max pb-2">
        <div
          className="mb-1 grid grid-flow-col auto-cols-max gap-1 text-[10px] leading-none text-muted-foreground"
          aria-hidden="true"
        >
          {monthLabels.map((label, idx) => (
            <div key={`skeleton-month:${weeks[idx]?.[0]?.dayKey ?? idx}`} className="h-4 w-3 overflow-visible">
              {label ? <span className="block whitespace-nowrap">{label}</span> : null}
            </div>
          ))}
        </div>
        <div className="grid grid-flow-col auto-cols-max gap-1" aria-hidden="true">
          {weeks.map((week) => (
            <div key={week[0]?.dayKey} className="grid grid-rows-7 gap-1">
              {week.map((day) =>
                day.inRange ? (
                  <Skeleton key={day.dayKey} className="h-3 w-3 rounded-[3px]" />
                ) : (
                  <div
                    key={day.dayKey}
                    className="h-3 w-3 rounded-[3px] border border-border/30 bg-muted/15 opacity-50"
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShippingHeatmap({
  commits,
  rangeStart,
  rangeEnd,
  selectedRepo,
  loading = false,
}: ShippingHeatmapProps) {
  const [rangeStartDay, rangeEndDay] = React.useMemo(() => {
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    return start.getTime() <= end.getTime() ? [start, end] : [end, start];
  }, [rangeStart, rangeEnd]);

  const rangeStartKey = React.useMemo(() => format(rangeStartDay, "yyyy-MM-dd"), [rangeStartDay]);
  const rangeEndKey = React.useMemo(() => format(rangeEndDay, "yyyy-MM-dd"), [rangeEndDay]);

  const { dayCounts, perDayRepoCounts, totalCommits } = React.useMemo(() => {
    const counts = new Map<string, number>();
    const perRepo = new Map<string, Map<string, number>>();

    for (const commit of commits) {
      const dayKey = format(new Date(commit.committedAt), "yyyy-MM-dd");
      if (dayKey < rangeStartKey || dayKey > rangeEndKey) continue;

      counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);

      if (selectedRepo === "all") {
        const existing = perRepo.get(dayKey) ?? new Map<string, number>();
        existing.set(commit.repo, (existing.get(commit.repo) ?? 0) + 1);
        perRepo.set(dayKey, existing);
      }
    }

    let total = 0;
    for (const value of counts.values()) total += value;

    return { dayCounts: counts, perDayRepoCounts: perRepo, totalCommits: total };
  }, [commits, rangeStartKey, rangeEndKey, selectedRepo]);

  const { activeDays, currentStreak, bestDayKey, bestDayCount } = React.useMemo(() => {
    const active = dayCounts.size;

    let streak = 0;
    for (let cursor = rangeEndDay; cursor.getTime() >= rangeStartDay.getTime(); cursor = addDays(cursor, -1)) {
      const key = format(cursor, "yyyy-MM-dd");
      if ((dayCounts.get(key) ?? 0) === 0) break;
      streak++;
    }

    let bestKey: string | null = null;
    let bestCount = 0;
    for (const [key, count] of dayCounts.entries()) {
      if (count > bestCount || (count === bestCount && bestKey && key > bestKey)) {
        bestCount = count;
        bestKey = key;
      }
      if (!bestKey && count > 0) {
        bestCount = count;
        bestKey = key;
      }
    }

    return {
      activeDays: active,
      currentStreak: streak,
      bestDayKey: bestKey,
      bestDayCount: bestCount,
    };
  }, [dayCounts, rangeEndDay, rangeStartDay]);

  const { q1, q2, q3 } = React.useMemo(() => {
    const nonZero = Array.from(dayCounts.values())
      .filter((count) => count > 0)
      .sort((a, b) => a - b);
    return {
      q1: quantile(nonZero, 0.25),
      q2: quantile(nonZero, 0.5),
      q3: quantile(nonZero, 0.75),
    };
  }, [dayCounts]);

  const { weeks, gridStartKey, monthLabels } = React.useMemo(() => {
    const gridStart = startOfWeek(rangeStartDay, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(rangeEndDay, { weekStartsOn: 1 });
    const daySpan = differenceInCalendarDays(gridEnd, gridStart) + 1;
    const weekCount = Math.max(1, Math.ceil(daySpan / 7));

    const weekColumns: HeatmapCell[][] = [];
    const labels: Array<string | null> = [];
    for (let w = 0; w < weekCount; w++) {
      const weekStart = addDays(gridStart, w * 7);
      const days: HeatmapCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        const dayKey = format(date, "yyyy-MM-dd");
        const inRange = dayKey >= rangeStartKey && dayKey <= rangeEndKey;

        const count = inRange ? (dayCounts.get(dayKey) ?? 0) : 0;
        const topRepos: DayRepoCount[] = [];
        if (inRange && selectedRepo === "all") {
          const perRepo = perDayRepoCounts.get(dayKey);
          if (perRepo) {
            const entries = Array.from(perRepo.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2);
            for (const [repo, repoCount] of entries) {
              topRepos.push({ repo, count: repoCount });
            }
          }
        }

        days.push({ date, dayKey, inRange, count, topRepos });
      }

      let label: string | null = null;
      const monthStart = days.find((day) => day.date.getDate() === 1);
      if (monthStart) {
        label = formatMonthLabel(monthStart.date);
      } else if (w === 0) {
        label = formatMonthLabel(rangeStartDay);
      }
      labels.push(label);

      weekColumns.push(days);
    }

    return {
      weeks: weekColumns,
      gridStartKey: format(gridStart, "yyyy-MM-dd"),
      monthLabels: labels,
    };
  }, [dayCounts, perDayRepoCounts, rangeEndDay, rangeEndKey, rangeStartDay, rangeStartKey, selectedRepo]);

  const bestDayDate = React.useMemo(() => {
    if (!bestDayKey) return null;
    return parseYmdToLocalDate(bestDayKey);
  }, [bestDayKey]);

  const statsBadge = (
    <div className="flex flex-wrap items-center gap-2">
      {loading ? (
        <>
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </>
      ) : (
        <>
          <Badge variant="secondary">
            {totalCommits} {pluralize(totalCommits, "commit")}
          </Badge>
          <Badge variant="secondary">
            {activeDays} active {pluralize(activeDays, "day")}
          </Badge>
          <Badge variant="secondary">
            {currentStreak}d streak
          </Badge>
          <Badge variant="secondary">
            Best:{" "}
            {bestDayCount > 0 && bestDayDate
              ? `${bestDayCount} on ${bestDayFormatter.format(bestDayDate)}`
              : "—"}
          </Badge>
          {bestDayCount > 0 && bestDayKey ? (
            <Badge variant="outline" className="border-primary/30 text-primary">
              {bestDayKey === rangeEndKey ? "🏆 New record day" : "🏆 Best day"}
            </Badge>
          ) : null}
        </>
      )}
    </div>
  );

  const skeletonWeeks = React.useMemo(
    () =>
      weeks.map((week) =>
        week.map((cell) => ({ inRange: cell.inRange, dayKey: cell.dayKey })),
      ),
    [weeks],
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle>Shipping heatmap</CardTitle>
            <CardDescription>
              Daily commit volume for the current filters.
            </CardDescription>
          </div>
          {statsBadge}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <HeatmapSkeleton weeks={skeletonWeeks} monthLabels={monthLabels} />
        ) : (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <div className="min-w-max pb-2">
                <div
                  className="mb-1 grid grid-flow-col auto-cols-max gap-1 text-[10px] leading-none text-muted-foreground"
                  aria-hidden="true"
                >
                  {monthLabels.map((label, idx) => (
                    <div key={`${gridStartKey}:month:${idx}`} className="h-4 w-3 overflow-visible">
                      {label ? <span className="block whitespace-nowrap">{label}</span> : null}
                    </div>
                  ))}
                </div>
                <div
                  role="grid"
                  aria-label="Shipping heatmap"
                  className="grid grid-flow-col auto-cols-max gap-1"
                >
                  {weeks.map((week, weekIdx) => (
                    <div
                      key={`${gridStartKey}:${weekIdx}`}
                      role="row"
                      className="grid grid-rows-7 gap-1"
                    >
                      {week.map((cell) => {
                        if (!cell.inRange) {
                          return (
                            <div
                              key={cell.dayKey}
                              className="h-3 w-3 rounded-[3px] border border-border/30 bg-muted/15 opacity-50"
                              aria-hidden="true"
                            />
                          );
                        }

                        const level = intensityLevel(cell.count, q1, q2, q3);
                        const isBestDay = bestDayCount > 0 && cell.dayKey === bestDayKey;
                        const isRangeEnd = cell.dayKey === rangeEndKey;

                        const tooltipTitle = `${formatDayLabel(cell.date)} — ${cell.count} ${pluralize(
                          cell.count,
                          "commit",
                        )}`;

                        const topReposLabel =
                          selectedRepo === "all" && cell.topRepos.length > 0
                            ? ` Top repos: ${cell.topRepos
                                .map((r) => `${repoDisplayName(r.repo)} ${r.count}`)
                                .join(", ")}.`
                            : "";

                        const ariaLabel = `${tooltipTitle}.${topReposLabel}`;

                        return (
                          <Tooltip key={cell.dayKey}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={ariaLabel}
                                className={cn(
                                  "h-3 w-3 rounded-[3px] border border-border/60",
                                  levelClasses[level],
                                  isBestDay &&
                                    "ring-1 ring-primary/50 ring-offset-1 ring-offset-background",
                                  isRangeEnd &&
                                    "outline outline-2 outline-muted-foreground/25 outline-offset-1",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-[260px]">
                              <div className="font-medium text-foreground">{tooltipTitle}</div>
                              {selectedRepo === "all" && cell.topRepos.length > 0 ? (
                                <div className="mt-1 space-y-0.5 text-muted-foreground">
                                  {cell.topRepos.map((repo) => (
                                    <div key={repo.repo}>
                                      {repoDisplayName(repo.repo)}: {repo.count}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}

        <HeatmapLegend />
      </CardContent>
    </Card>
  );
}
