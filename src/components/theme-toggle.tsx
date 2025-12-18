"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-[184px] rounded-md border border-border/60 bg-muted/30",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={theme ?? "system"}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
      className={cn("bg-background", className)}
    >
      {OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
