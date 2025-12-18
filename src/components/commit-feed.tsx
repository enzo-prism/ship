"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Check, ChevronsUpDown, ExternalLink } from "lucide-react";

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

import { REPO_ALLOWLIST, repoDisplayName } from "@/lib/repo-allowlist";
import type { CommitItem } from "@/lib/types";

type RangePreset = "7" | "30" | "60";
type RangeMode = RangePreset | "custom";

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
  const repoOptions = React.useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...REPO_ALLOWLIST.map((repo) => ({ value: repo, label: repoDisplayName(repo) })),
    ],
    [],
  );

  const [repoOpen, setRepoOpen] = React.useState(false);
  const [selectedRepo, setSelectedRepo] = React.useState<string>("all");

  const [rangeMode, setRangeMode] = React.useState<RangeMode>("7");
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>(undefined);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [commits, setCommits] = React.useState<CommitItem[]>([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedCommit, setSelectedCommit] = React.useState<CommitItem | null>(null);

  const requestQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("repo", selectedRepo);

    if (rangeMode === "custom" && customRange?.from) {
      const from = customRange.from;
      const to = customRange.to ?? customRange.from;
      params.set("since", format(from, "yyyy-MM-dd"));
      params.set("until", format(to, "yyyy-MM-dd"));
    } else {
      params.set("range", rangeMode);
    }

    return params.toString();
  }, [selectedRepo, rangeMode, customRange?.from, customRange?.to]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/commits?${requestQuery}`, { signal: controller.signal });
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
  }, [requestQuery]);

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

    if (daysInclusive > 60) {
      setRangeError("Max custom range is 60 days.");
      setCustomRange({ from, to: addDays(from, 59) });
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
                  if (value === "7" || value === "30" || value === "60") setRangeMode(value);
                }}
              >
                <ToggleGroupItem value="7">7d</ToggleGroupItem>
                <ToggleGroupItem value="30">30d</ToggleGroupItem>
                <ToggleGroupItem value="60">60d</ToggleGroupItem>
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
                        Max range: 60 days.
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomRange(undefined);
                          setRangeError(null);
                          setRangeMode("7");
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

          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${commits.length} commit${commits.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

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
