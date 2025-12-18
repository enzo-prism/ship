"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Check, ChevronsUpDown, ExternalLink } from "lucide-react";

import { CopyLinkButton } from "@/components/copy-link-button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS } from "@/lib/date-range";
import { isAllowedRepo, REPO_ALLOWLIST, repoDisplayName } from "@/lib/repo-allowlist";
import type { CommitItem } from "@/lib/types";

const RANGE_PRESET_OPTIONS = [
  { value: "7", label: "7d", days: 7 },
  { value: "30", label: "30d", days: 30 },
  { value: "60", label: "60d", days: 60 },
  { value: "365", label: "1y", days: MAX_RANGE_DAYS },
] as const;

const DEFAULT_RANGE_VALUE =
  RANGE_PRESET_OPTIONS.find((option) => option.days === DEFAULT_RANGE_DAYS)?.value ??
  RANGE_PRESET_OPTIONS[RANGE_PRESET_OPTIONS.length - 1].value;
const COMMIT_LIST_LIMIT = 1000;
const commitCountFormatter = new Intl.NumberFormat();

type RangePreset = (typeof RANGE_PRESET_OPTIONS)[number]["value"];
type RangeMode = RangePreset | "custom";

function isRangePreset(value: string): value is RangePreset {
  return RANGE_PRESET_OPTIONS.some((option) => option.value === value);
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

type ParsedFilters = {
  selectedRepo: string;
  rangeMode: RangeMode;
  customRange?: DateRange;
};

type SearchParamsLike = Pick<URLSearchParams, "get">;

function parseFiltersFromSearchParams(params: SearchParamsLike): ParsedFilters {
  const repoParam = params.get("repo")?.trim() ?? "";
  const selectedRepo = repoParam === "all" || isAllowedRepo(repoParam) ? repoParam : "all";

  const sinceParam = params.get("since")?.trim();
  const untilParam = params.get("until")?.trim();

  if (sinceParam && untilParam) {
    const sinceDate = parseYmdToLocalDate(sinceParam);
    const untilDate = parseYmdToLocalDate(untilParam);

    if (sinceDate && untilDate) {
      const [from, to] =
        sinceDate.getTime() <= untilDate.getTime() ? [sinceDate, untilDate] : [untilDate, sinceDate];
      const daysInclusive = differenceInCalendarDays(to, from) + 1;
      if (daysInclusive >= 1 && daysInclusive <= MAX_RANGE_DAYS) {
        return { selectedRepo, rangeMode: "custom", customRange: { from, to } };
      }
    }
  }

  const rangeParam = params.get("range")?.trim() ?? "";
  if (rangeParam && isRangePreset(rangeParam)) {
    return { selectedRepo, rangeMode: rangeParam };
  }

  return { selectedRepo, rangeMode: DEFAULT_RANGE_VALUE };
}

function buildShareQuery(options: {
  selectedRepo: string;
  rangeMode: RangeMode;
  customRange?: DateRange;
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

  const repoOptions = React.useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...REPO_ALLOWLIST.map((repo) => ({ value: repo, label: repoDisplayName(repo) })),
    ],
    [],
  );

  const initialFiltersRef = React.useRef<ParsedFilters | null>(null);
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
  const [customOpen, setCustomOpen] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [commits, setCommits] = React.useState<CommitItem[]>([]);
  const [authMode, setAuthMode] = React.useState<"token" | "none" | null>(null);
  const [repoFailures, setRepoFailures] = React.useState<number | null>(null);
  const [dataTruncated, setDataTruncated] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedCommit, setSelectedCommit] = React.useState<CommitItem | null>(null);

  const shareQuery = React.useMemo(
    () => buildShareQuery({ selectedRepo, rangeMode, customRange }),
    [selectedRepo, rangeMode, customRange],
  );

  const sharePath = React.useMemo(
    () => (shareQuery ? `${pathname}?${shareQuery}` : pathname),
    [pathname, shareQuery],
  );

  React.useEffect(() => {
    const currentQuery = window.location.search.replace(/^\?/, "");
    if (currentQuery === shareQuery) return;
    router.replace(sharePath, { scroll: false });
  }, [router, sharePath, shareQuery]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      setAuthMode(null);
      setRepoFailures(null);
      setDataTruncated(false);
      try {
        const res = await fetch(`/api/commits?${shareQuery}`, { signal: controller.signal });
        const auth = res.headers.get("X-Ship-Auth");
        if (auth === "token" || auth === "none") setAuthMode(auth);
        const failures = res.headers.get("X-Ship-Repo-Failures");
        if (failures && Number.isFinite(Number(failures))) setRepoFailures(Number(failures));
        setDataTruncated(res.headers.get("X-Ship-Truncated") === "1");

        const data = (await res.json()) as CommitItem[] | { error?: string };
        if (!res.ok) {
          const message =
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "Failed to load commits.";
          throw new Error(message);
        }
        setCommits(data as CommitItem[]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to load commits.";
        setCommits([]);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void run();
    return () => controller.abort();
  }, [shareQuery]);

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

  const commitOverflow = commits.length > COMMIT_LIST_LIMIT;
  const visibleCommits = commitOverflow ? commits.slice(0, COMMIT_LIST_LIMIT) : commits;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedRepo === opt.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{opt.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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
                    className="justify-start"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    <span className="truncate">{customLabel}</span>
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

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {loading ? "Loading…" : `${commits.length} commit${commits.length === 1 ? "" : "s"}`}
            </span>
            <CopyLinkButton path={sharePath} />
          </div>
        </div>
      </div>

      <ShippingHeatmap
        commits={commits}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        selectedRepo={selectedRepo}
        loading={loading}
      />

      {authMode === "none" || repoFailures || dataTruncated ? (
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
          {dataTruncated ? (
            <p className={cn((authMode === "none" || repoFailures) && "mt-2")}>
              Commit history may be incomplete for this range. Narrow the range or filter to a
              single project for full results.
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
          {commitOverflow ? (
            <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              Showing latest {commitCountFormatter.format(COMMIT_LIST_LIMIT)} of{" "}
              {commitCountFormatter.format(commits.length)} commits. Narrow the range to see
              older items.
            </div>
          ) : null}
          {visibleCommits.map((commit, idx) => (
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
                {repoDisplayName(commit.repo)}
              </Badge>
            </button>
          ))}
        </div>
      )}

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

                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
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
