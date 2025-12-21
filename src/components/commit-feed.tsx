"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Check, ChevronsUpDown, ExternalLink, RefreshCw } from "lucide-react";

import { ProjectIcon } from "@/components/project-icon";
import { ShippingHeatmap } from "@/components/shipping-heatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS } from "@/lib/date-range";
import { isAllowedRepo, REPO_ALLOWLIST, repoDisplayName } from "@/lib/repo-allowlist";
import type { CommitItem, CommitsResponse, DailySummary } from "@/lib/types";

const RANGE_PRESET_OPTIONS = [
  { value: "7", label: "7d", days: 7 },
  { value: "30", label: "30d", days: 30 },
  { value: "60", label: "60d", days: 60 },
  { value: "365", label: "1y", days: MAX_RANGE_DAYS },
] as const;

const DEFAULT_RANGE_VALUE =
  RANGE_PRESET_OPTIONS.find((option) => option.days === DEFAULT_RANGE_DAYS)?.value ??
  RANGE_PRESET_OPTIONS[RANGE_PRESET_OPTIONS.length - 1].value;
const DEFAULT_PAGE_SIZE = 50;
const TOKEN_REFRESH_MS = 60_000;
const NO_TOKEN_REFRESH_MS = 900_000;

type RangePreset = (typeof RANGE_PRESET_OPTIONS)[number]["value"];
type RangeMode = RangePreset | "custom";

function isRangePreset(value: string): value is RangePreset {
  return RANGE_PRESET_OPTIONS.some((option) => option.value === value);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
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

function parseCacheControlSeconds(value: string | null) {
  if (!value) return null;
  const sMaxAgeMatch = /s-maxage=(\d+)/.exec(value);
  if (sMaxAgeMatch) {
    const seconds = Number(sMaxAgeMatch[1]);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const maxAgeMatch = /max-age=(\d+)/.exec(value);
  if (maxAgeMatch) {
    const seconds = Number(maxAgeMatch[1]);
    return Number.isFinite(seconds) ? seconds : null;
  }
  return null;
}

function resolveRefreshMs(cacheControl: string | null, authMode: "token" | "none" | null) {
  const seconds = parseCacheControlSeconds(cacheControl);
  if (seconds && seconds > 0) return seconds * 1000;
  if (authMode === "token") return TOKEN_REFRESH_MS;
  if (authMode === "none") return NO_TOKEN_REFRESH_MS;
  return null;
}

function formatUpdatedLabel(lastUpdatedAt: Date, now: Date) {
  const diffMs = now.getTime() - lastUpdatedAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "Updated just now";
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${format(lastUpdatedAt, "MMM d")}`;
}

type ParsedFilters = {
  selectedRepo: string;
  rangeMode: RangeMode;
  customRange?: DateRange;
  page: number;
};

type SearchParamsLike = Pick<URLSearchParams, "get">;

function parseFiltersFromSearchParams(params: SearchParamsLike): ParsedFilters {
  const repoParam = params.get("repo")?.trim() ?? "";
  const selectedRepo = repoParam === "all" || isAllowedRepo(repoParam) ? repoParam : "all";

  const sinceParam = params.get("since")?.trim();
  const untilParam = params.get("until")?.trim();
  const pageParam = params.get("page")?.trim();
  const pageValue = pageParam ? Number(pageParam) : 1;
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;

  if (sinceParam && untilParam) {
    const sinceDate = parseYmdToLocalDate(sinceParam);
    const untilDate = parseYmdToLocalDate(untilParam);

    if (sinceDate && untilDate) {
      const [from, to] =
        sinceDate.getTime() <= untilDate.getTime() ? [sinceDate, untilDate] : [untilDate, sinceDate];
      const daysInclusive = differenceInCalendarDays(to, from) + 1;
      if (daysInclusive >= 1 && daysInclusive <= MAX_RANGE_DAYS) {
        return { selectedRepo, rangeMode: "custom", customRange: { from, to }, page };
      }
    }
  }

  const rangeParam = params.get("range")?.trim() ?? "";
  if (rangeParam && isRangePreset(rangeParam)) {
    return { selectedRepo, rangeMode: rangeParam, page };
  }

  return { selectedRepo, rangeMode: DEFAULT_RANGE_VALUE, page };
}

function buildShareQuery(options: {
  selectedRepo: string;
  rangeMode: RangeMode;
  customRange?: DateRange;
  page: number;
}) {
  const params = new URLSearchParams();
  params.set("repo", options.selectedRepo);

  if (options.rangeMode === "custom" && options.customRange?.from) {
    const from = options.customRange.from;
    const to = options.customRange.to ?? options.customRange.from;
    params.set("since", format(from, "yyyy-MM-dd"));
    params.set("until", format(to, "yyyy-MM-dd"));
  } else {
    const rangeValue = isRangePreset(options.rangeMode) ? options.rangeMode : DEFAULT_RANGE_VALUE;
    params.set("range", rangeValue);
  }

  if (options.page > 1) {
    params.set("page", String(options.page));
  }

  return params.toString();
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function getFullMessage(commit: CommitItem) {
  return [commit.messageSubject, commit.messageBody].filter(Boolean).join("\n\n");
}

function CommitListSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div
          key={idx}
          className={cn("flex items-center gap-3 px-4 py-3", idx > 0 && "border-t")}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-3 w-[45%]" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CommitFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const repoOptions = React.useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...REPO_ALLOWLIST.map((repo) => ({ value: repo, label: repoDisplayName(repo) })),
    ],
    [],
  );

  const initialFiltersRef = React.useRef<ParsedFilters | null>(null);
  const didInitRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const inFlightRef = React.useRef(false);
  const requestIdRef = React.useRef(0);
  if (!initialFiltersRef.current) {
    initialFiltersRef.current = parseFiltersFromSearchParams(searchParams);
  }

  const initialFilters = initialFiltersRef.current!;

  const [repoOpen, setRepoOpen] = React.useState(false);
  const [selectedRepo, setSelectedRepo] = React.useState<string>(initialFilters.selectedRepo);

  const [rangeMode, setRangeMode] = React.useState<RangeMode>(initialFilters.rangeMode);
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>(
    initialFilters.customRange,
  );
  const [page, setPage] = React.useState(initialFilters.page);
  const [totalPages, setTotalPages] = React.useState(1);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [commits, setCommits] = React.useState<CommitItem[]>([]);
  const [dailySummaries, setDailySummaries] = React.useState<DailySummary[]>([]);
  const [totalCommits, setTotalCommits] = React.useState(0);
  const [authMode, setAuthMode] = React.useState<"token" | "none" | null>(null);
  const [repoFailures, setRepoFailures] = React.useState<number | null>(null);
  const [refreshMs, setRefreshMs] = React.useState<number | null>(null);
  const [refreshStatus, setRefreshStatus] = React.useState<"idle" | "refreshing" | "success" | "error">(
    "idle",
  );
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedCommit, setSelectedCommit] = React.useState<CommitItem | null>(null);

  const shareQuery = React.useMemo(
    () => buildShareQuery({ selectedRepo, rangeMode, customRange, page }),
    [selectedRepo, rangeMode, customRange, page],
  );

  const tzOffset = React.useMemo(() => String(new Date().getTimezoneOffset()), []);
  const apiQuery = React.useMemo(() => {
    const params = new URLSearchParams(shareQuery);
    params.set("tz", tzOffset);
    return params.toString();
  }, [shareQuery, tzOffset]);

  const sharePath = React.useMemo(
    () => (shareQuery ? `${pathname}?${shareQuery}` : pathname),
    [pathname, shareQuery],
  );

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    const currentQuery = window.location.search.replace(/^\?/, "");
    if (currentQuery === shareQuery) return;
    router.replace(sharePath, { scroll: false });
  }, [router, sharePath, shareQuery]);

  const loadCommits = React.useCallback(
    async ({ mode }: { mode: "full" | "refresh" }) => {
      if (mode === "refresh" && inFlightRef.current) return;

      const requestId = (requestIdRef.current += 1);
      let requestStatus: "success" | "error" | null = null;
      if (mode === "full") {
        abortRef.current?.abort();
        setLoading(true);
        setError(null);
        setAuthMode(null);
        setRepoFailures(null);
      }
      setRefreshStatus("refreshing");

      const controller = new AbortController();
      abortRef.current = controller;
      inFlightRef.current = true;

      try {
        const res = await fetch(`/api/commits?${apiQuery}`, { signal: controller.signal });
        const authHeader = res.headers.get("X-Ship-Auth");
        const nextAuthMode =
          authHeader === "token" || authHeader === "none" ? authHeader : null;
        const failuresHeader = res.headers.get("X-Ship-Repo-Failures");
        const nextRepoFailures =
          failuresHeader && Number.isFinite(Number(failuresHeader))
            ? Number(failuresHeader)
            : null;
        const nextRefreshMs = resolveRefreshMs(
          res.headers.get("Cache-Control"),
          nextAuthMode,
        );

        const data = (await res.json()) as CommitsResponse | { error?: string };
        if (requestId !== requestIdRef.current) return;

        if (nextAuthMode) setAuthMode(nextAuthMode);
        if (nextRefreshMs) setRefreshMs(nextRefreshMs);

        if (!res.ok) {
          const message =
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "Failed to load commits.";
          requestStatus = "error";
          if (mode === "full") {
            setCommits([]);
            setDailySummaries([]);
            setTotalCommits(0);
            setTotalPages(1);
            setError(message);
          }
          return;
        }

        setError(null);
        setRepoFailures(nextRepoFailures);

        if ("commits" in data && Array.isArray(data.commits)) {
          setCommits(data.commits);
          setDailySummaries(Array.isArray(data.dailySummaries) ? data.dailySummaries : []);
          const nextTotalCommits = Number.isFinite(data.totalCommits)
            ? data.totalCommits
            : data.commits.length;
          const nextPageSize = Number.isFinite(data.pageSize) ? data.pageSize : DEFAULT_PAGE_SIZE;
          const nextTotalPages = Number.isFinite(data.totalPages)
            ? data.totalPages
            : Math.max(1, Math.ceil(nextTotalCommits / nextPageSize));
          setTotalCommits(nextTotalCommits);
          setTotalPages(nextTotalPages);
          if (Number.isFinite(data.page) && data.page !== page) {
            setPage(data.page);
          }
        } else if (mode === "full") {
          setCommits([]);
          setDailySummaries([]);
          setTotalCommits(0);
          setTotalPages(1);
        }
        requestStatus = "success";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        const message = err instanceof Error ? err.message : "Failed to load commits.";
        requestStatus = "error";
        if (mode === "full") {
          setCommits([]);
          setDailySummaries([]);
          setTotalCommits(0);
          setTotalPages(1);
          setError(message);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          if (mode === "full") setLoading(false);
          if (requestStatus) {
            setRefreshStatus(requestStatus);
            if (requestStatus === "success") {
              const updatedAt = new Date();
              setLastUpdatedAt(updatedAt);
              setNow(updatedAt);
            }
          }
        }
      }
    },
    [apiQuery, page],
  );

  const handleManualRefresh = React.useCallback(() => {
    void loadCommits({ mode: "refresh" });
  }, [loadCommits]);

  React.useEffect(() => {
    void loadCommits({ mode: "full" });
    return () => abortRef.current?.abort();
  }, [loadCommits]);

  React.useEffect(() => {
    window.addEventListener("ship:refresh-commits", handleManualRefresh);
    return () => window.removeEventListener("ship:refresh-commits", handleManualRefresh);
  }, [handleManualRefresh]);

  React.useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;

    let intervalId: number | null = null;
    const startInterval = () => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void loadCommits({ mode: "refresh" });
      }, refreshMs);
    };
    const stopInterval = () => {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadCommits({ mode: "refresh" });
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (document.visibilityState === "visible") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [loadCommits, refreshMs]);

  const isRefreshing = loading || refreshStatus === "refreshing";
  const refreshLabel = React.useMemo(() => {
    if (loading) return "Loading…";
    if (refreshStatus === "refreshing") return "Refreshing…";
    if (refreshStatus === "error") return "Refresh failed";
    if (lastUpdatedAt) return formatUpdatedLabel(lastUpdatedAt, now);
    return null;
  }, [lastUpdatedAt, loading, now, refreshStatus]);

  function openCommit(commit: CommitItem) {
    setSelectedCommit(commit);
    setDialogOpen(true);
  }

  function onSelectCustomRange(range: DateRange | undefined) {
    setRangeError(null);

    if (!range?.from) {
      setCustomRange(undefined);
      return;
    }

    const from = range.from;
    const to = range.to ?? range.from;
    const daysInclusive = differenceInCalendarDays(to, from) + 1;

    if (daysInclusive > MAX_RANGE_DAYS) {
      setRangeError(`Max custom range is ${MAX_RANGE_DAYS} days.`);
      setCustomRange({ from, to: addDays(from, MAX_RANGE_DAYS - 1) });
      setRangeMode("custom");
      setCustomOpen(false);
      return;
    }

    setCustomRange({ from, to });
    setRangeMode("custom");
    if (range.to) setCustomOpen(false);
  }

  React.useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    setPage(1);
  }, [selectedRepo, rangeMode, customRange?.from?.getTime(), customRange?.to?.getTime()]);

  const selectedRepoLabel =
    repoOptions.find((opt) => opt.value === selectedRepo)?.label ?? "All projects";

  const customLabel =
    rangeMode === "custom" && customRange?.from
      ? `${format(customRange.from, "MMM d, yyyy")} – ${format(
          customRange.to ?? customRange.from,
          "MMM d, yyyy",
        )}`
      : "Custom range";

  const { rangeStart, rangeEnd } = React.useMemo(() => {
    if (rangeMode === "custom" && customRange?.from) {
      const from = startOfDay(customRange.from);
      const to = startOfDay(customRange.to ?? customRange.from);
      return { rangeStart: from, rangeEnd: to };
    }

    const presetDays =
      RANGE_PRESET_OPTIONS.find((option) => option.value === rangeMode)?.days ??
      DEFAULT_RANGE_DAYS;
    const end = startOfDay(new Date());
    const start = addDays(end, -(presetDays - 1));
    return { rangeStart: start, rangeEnd: end };
  }, [customRange?.from, customRange?.to, rangeMode]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {isMobile ? (
              <Dialog open={repoOpen} onOpenChange={setRepoOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={repoOpen}
                    className="w-full justify-between md:w-[260px]"
                  >
                    <span className="truncate">{selectedRepoLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="top-16 max-h-[80vh] translate-y-0 p-0"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <DialogHeader className="px-4 pt-4 text-left">
                    <DialogTitle className="text-sm font-medium">Select project</DialogTitle>
                  </DialogHeader>
                  <Command className="rounded-none border-t">
                    <CommandInput placeholder="Search projects…" />
                    <CommandList className="max-h-[60vh]">
                      <CommandEmpty>No projects found.</CommandEmpty>
                      <CommandGroup>
                        {repoOptions.map((opt) => (
                          <CommandItem
                            key={opt.value}
                            value={opt.label}
                            onSelect={() => {
                              setSelectedRepo(opt.value);
                              setRepoOpen(false);
                            }}
                          >
                            <span className="mr-2 inline-flex w-4 justify-center">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedRepo === opt.value ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </span>
                            <ProjectIcon repo={opt.value} className="h-4 w-4" />
                            <span className="truncate">{opt.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            ) : (
              <Popover open={repoOpen} onOpenChange={setRepoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={repoOpen}
                    className="w-full justify-between md:w-[260px]"
                  >
                    <span className="truncate">{selectedRepoLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search projects…" />
                    <CommandList>
                      <CommandEmpty>No projects found.</CommandEmpty>
                      <CommandGroup>
                        {repoOptions.map((opt) => (
                          <CommandItem
                            key={opt.value}
                            value={opt.label}
                            onSelect={() => {
                              setSelectedRepo(opt.value);
                              setRepoOpen(false);
                            }}
                          >
                            <span className="mr-2 inline-flex w-4 justify-center">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedRepo === opt.value ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </span>
                            <ProjectIcon repo={opt.value} className="h-4 w-4" />
                            <span className="truncate">{opt.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                value={rangeMode === "custom" ? "" : rangeMode}
                onValueChange={(value) => {
                  if (isRangePreset(value)) setRangeMode(value);
                }}
              >
                {RANGE_PRESET_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <Popover open={customOpen} onOpenChange={setCustomOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={rangeMode === "custom" ? "secondary" : "outline"}
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Select custom date range"
                  >
                    <CalendarIcon className="h-4 w-4 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={customRange}
                      onSelect={onSelectCustomRange}
                      defaultMonth={customRange?.from}
                    />
                    {rangeError ? (
                      <p className="mt-2 text-sm text-destructive">{rangeError}</p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Max range: {MAX_RANGE_DAYS} days.
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomRange(undefined);
                          setRangeError(null);
                          setRangeMode(DEFAULT_RANGE_VALUE);
                          setCustomOpen(false);
                        }}
                      >
                        Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCustomOpen(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {refreshLabel ? (
              <span
                className={cn(
                  "text-[11px] text-muted-foreground/70",
                  refreshStatus === "error" && "text-destructive/70",
                )}
              >
                {refreshLabel}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              aria-label={refreshStatus === "error" ? "Refresh failed. Retry." : "Refresh commits"}
              title={
                lastUpdatedAt
                  ? `Last updated ${format(lastUpdatedAt, "PP p")}`
                  : "Refresh commits"
              }
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  isRefreshing && "animate-spin text-muted-foreground",
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      <ShippingHeatmap
        dailySummaries={dailySummaries}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        selectedRepo={selectedRepo}
        loading={loading}
        totalCommits={totalCommits}
      />

      {authMode === "none" || repoFailures ? (
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {authMode === "none" ? (
            <p>
              Using unauthenticated GitHub API mode (rate-limited). Add{" "}
              <span className="font-mono">GITHUB_TOKEN</span> in Vercel to improve reliability.
            </p>
          ) : null}
          {repoFailures ? (
            <p className={cn(authMode === "none" && "mt-2")}>
              Some projects couldn’t be loaded ({repoFailures}). Showing available commits.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium">Couldn’t load commits</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <CommitListSkeleton />
      ) : commits.length === 0 ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">No commits in this range.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          {commits.map((commit, idx) => (
            <button
              key={`${commit.repo}:${commit.sha}`}
              type="button"
              onClick={() => openCommit(commit)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                idx > 0 && "border-t",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{commit.messageSubject || "(no subject)"}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(commit.committedAt)}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                <ProjectIcon repo={commit.repo} className="h-3 w-3 text-[11px]" />
                {repoDisplayName(commit.repo)}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedCommit(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedCommit ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="pr-10">
                  {selectedCommit.messageSubject || "(no subject)"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCommit.repo}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="font-mono">{selectedCommit.sha.slice(0, 7)}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{formatDateTime(selectedCommit.committedAt)}</span>
                </div>

                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
                  {getFullMessage(selectedCommit)}
                </pre>

                <div>
                  <Button asChild variant="outline">
                    <a href={selectedCommit.htmlUrl} target="_blank" rel="noreferrer">
                      View on GitHub
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
