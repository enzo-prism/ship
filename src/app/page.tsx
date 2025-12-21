import { Suspense } from "react";

import { CommitFeed } from "@/components/commit-feed";
import { CommitRefreshButton } from "@/components/commit-refresh-button";
import { HeroVideo } from "@/components/hero-video";
import { RotatingQuote } from "@/components/rotating-quote";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <ScrollToTop />
        <div className="space-y-8">
          <RotatingQuote />
          <HeroVideo />
          <div className="flex items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Engineering Tracker</h1>
                <p className="text-sm text-muted-foreground">
                  We ship new code for clients 24hrs a day, 7 days a week.
                </p>
              </div>
              <a
                href="https://enzosison.com/education"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Avatar className="h-8 w-8 border border-border/60 transition group-hover:scale-[1.03] group-hover:border-border">
                  <AvatarImage
                    src="https://res.cloudinary.com/dhqpqfw6w/image/upload/v1766089226/Enzo_Avatar_isiqzl.webp"
                    alt="Enzo Sison"
                  />
                  <AvatarFallback>EN</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium transition-colors group-hover:text-foreground">
                  made by enzo
                </span>
              </a>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                Loading commits...
              </div>
            }
          >
            <CommitFeed />
          </Suspense>
          <footer className="pt-2">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                <CommitRefreshButton />
                <span className="h-4 w-px bg-border/60" aria-hidden="true" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  Theme
                </span>
                <ThemeToggle className="bg-transparent" />
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
