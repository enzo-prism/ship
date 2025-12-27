const REPO_EMOJI_MAP: Record<string, string | null> = {
  "age-boldly-vibrantly": "💚",
  "exquisite-dentistry": "🦷",
  "pti": "💼",
  "leadership-retreat": "🌸",
  "canary-foundation": "💛",
  "chris-dentist": "🦷",
  "canary-cove-alpha": "🏖️",
  "drnjo": "💼",
  "wine-country-root-canal": "🦷",
  "family-first-smile-care": "🦷",
  "infobell-it-2": "💻",
  "matisse": "🏃🏽‍♀️",
  "philippine-athletics": "🇵🇭",
  "saorsa-3": "🌱",
  "listwin-ventures": "💼",
  "ambergris-support-spark": "☀️",
  "olympicbootworks-retail": "🎿",
  "grace-dental": "🦷",
  "density": null,
  "yt-keywords": null,
};

export function emojiForRepo(repo: string) {
  const slug = repo.split("/").at(-1)?.toLowerCase() ?? repo.toLowerCase();
  const emoji = REPO_EMOJI_MAP[slug];
  if (emoji === null) return null;
  return emoji ?? "📁";
}
