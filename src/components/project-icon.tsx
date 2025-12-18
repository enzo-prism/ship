"use client";

import * as React from "react";

import { iconForRepo } from "@/lib/repo-icons";
import { cn } from "@/lib/utils";

type ProjectIconProps = {
  repo: string;
  className?: string;
};

export function ProjectIcon({ repo, className }: ProjectIconProps) {
  const Icon = iconForRepo(repo);
  return <Icon aria-hidden="true" className={cn("h-4 w-4 text-muted-foreground", className)} />;
}
