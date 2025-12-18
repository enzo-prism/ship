const REPO_EMOJI_MAP: Record<string, string> = {
  "age-boldly-vibrantly": "🌅",
  "exquisite-dentistry": "🦷",
  "prism-website": "💎",
  "pti": "🏢",
  "leadership-retreat": "🏕️",
  "canary-foundation": "🐤",
  "chris-dentist": "🪥",
  "canary-cove-alpha": "🌊",
  "drnjo": "🩺",
  "wine-country-root-canal": "🍇",
  "family-first-smile-care": "👨‍👩‍👧‍👦",
  "infobell-it-2": "🛎️",
  "matisse": "🎨",
  "philippine-athletics": "🏅",
  "saorsa-3": "🌱",
};

export function emojiForRepo(repo: string) {
  const slug = repo.split("/").at(-1)?.toLowerCase() ?? repo.toLowerCase();
  return REPO_EMOJI_MAP[slug] ?? "📁";
}
