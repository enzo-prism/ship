import {
  Activity,
  Building2,
  Compass,
  Folder,
  HeartHandshake,
  Hospital,
  Landmark,
  Palette,
  Sparkles,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react";

const REPO_ICON_MAP: Record<string, LucideIcon> = {
  "age-boldly-vibrantly": Sparkles,
  "exquisite-dentistry": Hospital,
  "prism-website": Sparkles,
  "pti": Building2,
  "leadership-retreat": Landmark,
  "canary-foundation": HeartHandshake,
  "chris-dentist": Stethoscope,
  "canary-cove-alpha": Compass,
  "drnjo": Stethoscope,
  "wine-country-root-canal": Stethoscope,
  "family-first-smile-care": Hospital,
  "infobell-it-2": Activity,
  "matisse": Palette,
  "philippine-athletics": Trophy,
  "saorsa-3": Building2,
};

export function iconForRepo(repo: string) {
  const slug = repo.split("/").at(-1)?.toLowerCase() ?? repo.toLowerCase();
  return REPO_ICON_MAP[slug] ?? Folder;
}
