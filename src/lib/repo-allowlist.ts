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
  "enzo-prism/infobell-it-2",
  "enzo-prism/matisse",
  "enzo-prism/philippine-athletics",
  "enzo-prism/saorsa-3",
  "enzo-prism/listwin-ventures",
  "enzo-prism/ambergris-support-spark",
  "enzo-prism/olympicbootworks-retail",
  "enzo-prism/ship",
] as const;

export type AllowedRepo = (typeof REPO_ALLOWLIST)[number];

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "age-boldly-vibrantly": "Rebellious Aging",
  "exquisite-dentistry": "Exquisite Dentistry",
  "leadership-retreat": "Leadership Retreat",
  "canary-foundation": "Canary Foundation",
  "prism-website": "Prism",
  "pti": "PTI",
  "chris-dentist": "Dr. Wong",
  "canary-cove-alpha": "Canary Cove",
  "drnjo": "Dental Strategies",
  "wine-country-root-canal": "Wine Country Root Canal",
  "family-first-smile-care": "Family First Smile Care",
  "infobell-it-2": "Infobell IT",
  "matisse": "Matisse",
  "philippine-athletics": "Philippine Athletics",
  "saorsa-3": "Saorsa Growth Partners",
  "listwin-ventures": "Listwin Ventures",
  "ambergris-support-spark": "Belize Kids",
  "olympicbootworks-retail": "Olympic Bootworks",
  "ship": "🚢 ship",
};

export function isAllowedRepo(value: string): value is AllowedRepo {
  return (REPO_ALLOWLIST as readonly string[]).includes(value);
}

export function repoDisplayName(repo: string) {
  const parts = repo.split("/");
  const slug = parts.at(-1) ?? repo;
  return DISPLAY_NAME_OVERRIDES[slug.toLowerCase()] ?? slug;
}
