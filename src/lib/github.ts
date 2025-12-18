import type { AllowedRepo } from "@/lib/repo-allowlist";
import type { CommitItem } from "@/lib/types";

type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    committer?: { date?: string | null } | null;
    author?: { date?: string | null } | null;
  };
};

export class GitHubApiError extends Error {
  status: number;
  documentationUrl?: string;
  constructor(message: string, options: { status: number; documentationUrl?: string }) {
    super(message);
    this.name = "GitHubApiError";
    this.status = options.status;
    this.documentationUrl = options.documentationUrl;
  }
}

export type GitHubAuthMode = "token" | "none";
export type CommitListResult = { commits: CommitItem[]; truncated: boolean };

function splitCommitMessage(message: string) {
  const lines = message.split(/\r?\n/);
  const subject = lines[0] ?? "";
  const body = lines.slice(1).join("\n").trim();
  return { subject, body };
}

async function readGitHubErrorMessage(res: Response) {
  try {
    const data = (await res.json()) as { message?: string; documentation_url?: string };
    return {
      message: data.message ?? `GitHub API error (${res.status})`,
      documentationUrl: data.documentation_url,
    };
  } catch {
    return { message: `GitHub API error (${res.status})` };
  }
}

export function readGitHubTokenFromEnv() {
  return process.env.GITHUB_TOKEN ?? process.env.SHIP_GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

export async function listCommitsForRepo(options: {
  repo: AllowedRepo;
  sinceIso: string;
  untilIso: string;
  perPage?: number;
  maxPages?: number;
  revalidateSeconds?: number;
  token?: string | null;
}): Promise<CommitListResult> {
  const token = options.token ?? readGitHubTokenFromEnv();
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 3;
  const revalidateSeconds = options.revalidateSeconds ?? 60;

  const commits: CommitItem[] = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`https://api.github.com/repos/${options.repo}/commits`);
    url.searchParams.set("sha", "main");
    url.searchParams.set("since", options.sinceIso);
    url.searchParams.set("until", options.untilIso);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "project-ship",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      headers,
      cache: "force-cache",
      next: { revalidate: revalidateSeconds },
    });

    if (res.status === 409) break;
    if (!res.ok) {
      const { message, documentationUrl } = await readGitHubErrorMessage(res);
      throw new GitHubApiError(message, { status: res.status, documentationUrl });
    }

    const data = (await res.json()) as GitHubCommit[];
    if (data.length === 0) break;

    for (const item of data) {
      const committedAt = item.commit.committer?.date ?? item.commit.author?.date ?? null;
      if (!committedAt) continue;
      const { subject, body } = splitCommitMessage(item.commit.message ?? "");
      commits.push({
        sha: item.sha,
        repo: options.repo,
        htmlUrl: item.html_url,
        committedAt,
        messageSubject: subject,
        messageBody: body,
      });
    }

    if (data.length < perPage) break;
    if (page === maxPages) truncated = true;
  }

  return { commits, truncated };
}
