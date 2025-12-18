export const REPO_ALLOWLIST = [
  "enzo-prism/exquisite-dentistry",
  "enzo-prism/prism-website",
  "enzo-prism/pti",
  "enzo-prism/age-boldly-vibrantly",
  "enzo-prism/leadership-retreat",
  "enzo-prism/canary-foundation",
  "enzo-prism/chris-dentist",
  "enzo-prism/canary-cove-alpha",
  "enzo-prism/DrNjo",
  "enzo-prism/wine-country-root-canal",
  "enzo-prism/Family-First-Smile-Care",
  "enzo-prism/saorsa-2",
] as const;

export type AllowedRepo = (typeof REPO_ALLOWLIST)[number];

export function isAllowedRepo(value: string): value is AllowedRepo {
  return (REPO_ALLOWLIST as readonly string[]).includes(value);
}

export function repoDisplayName(repo: string) {
  const parts = repo.split("/");
  return parts.at(-1) ?? repo;
}

