import { Suspense } from "react";

import { CommitFeed } from "@/components/commit-feed";
import { HeroVideo } from "@/components/hero-video";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <div className="space-y-8">
          <HeroVideo />
          <div className="flex items-end justify-between gap-6">
            <div className="flex items-start gap-3">
              <Avatar className="mt-0.5 h-8 w-8 border border-border/60">
                <AvatarImage
                  src="https://res.cloudinary.com/dhqpqfw6w/image/upload/v1766089226/Enzo_Avatar_isiqzl.webp"
                  alt="Enzo"
                />
                <AvatarFallback>EN</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Project Ship</h1>
                <p className="text-sm text-muted-foreground">
                  A public feed of recent GitHub commits across enzo-prism projects.
                </p>
              </div>
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
        </div>
      </main>
    </div>
  );
}
