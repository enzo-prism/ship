import { CommitFeed } from "@/components/commit-feed";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Project Ship</h1>
            <p className="text-sm text-muted-foreground">
              A public feed of recent GitHub commits across enzo-prism projects.
            </p>
          </div>
        </div>
        <CommitFeed />
      </main>
    </div>
  );
}
