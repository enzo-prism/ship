"use client";

import * as React from "react";

import { emojiForRepo } from "@/lib/repo-icons";
import { cn } from "@/lib/utils";

type ProjectIconProps = {
  repo: string;
  className?: string;
};

export function ProjectIcon({ repo, className }: ProjectIconProps) {
  const emoji = emojiForRepo(repo);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-4 w-4 items-center justify-center text-[13px]", className)}
    >
      {emoji}
    </span>
  );
}
