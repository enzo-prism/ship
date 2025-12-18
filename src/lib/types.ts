export type CommitItem = {
  sha: string;
  repo: string;
  htmlUrl: string;
  committedAt: string;
  messageSubject: string;
  messageBody: string;
};

export type DayRepoCount = {
  repo: string;
  count: number;
};

export type DailySummary = {
  dayKey: string;
  count: number;
  topRepos: DayRepoCount[];
};

export type CommitsResponse = {
  commits: CommitItem[];
  totalCommits: number;
  dailySummaries: DailySummary[];
};
