"use client";

import * as React from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPY_RESET_MS = 2000;

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);
  return success;
}

type CopyLinkButtonProps = {
  path: string;
  className?: string;
};

export function CopyLinkButton({ path, className }: CopyLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const resetRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetRef.current) window.clearTimeout(resetRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    if (!path) return;
    const url = `${window.location.origin}${path}`;
    let didCopy = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        didCopy = true;
      } else {
        didCopy = fallbackCopy(url);
      }
    } catch {
      didCopy = fallbackCopy(url);
    }

    if (!didCopy) return;
    setCopied(true);
    if (resetRef.current) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setCopied(false), COPY_RESET_MS);
  }, [path]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("h-8 gap-2 text-xs", className)}
      disabled={!path}
      aria-live="polite"
    >
      <Link2 className="h-3.5 w-3.5" />
      <span>{copied ? "Copied" : "Copy link"}</span>
    </Button>
  );
}
