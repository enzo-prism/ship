"use client";

import { Button } from "@/components/ui/button";

export function CommitRefreshButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 hover:bg-transparent hover:text-foreground"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("ship:refresh-commits"));
      }}
      aria-label="Refresh commits"
    >
      Refresh
    </Button>
  );
}
