import type { PR } from "../components/InboxDeck";

const SNOOZE_KEY = "ok2merge-snoozed";
const FILTERS_KEY = "ok2merge-filters";

export interface SavedFilter {
  name: string;
  tab: string;
  query: string;
  sort: string;
}

function readMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function snoozeRef(pr: PR): string {
  return `${pr.repo}#${pr.number}`;
}

export function snoozeUntil(pr: PR, hours = 24): void {
  const map = readMap();
  map[snoozeRef(pr)] = Date.now() + hours * 3600 * 1000;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
}

export function isSnoozed(pr: PR, now = Date.now()): boolean {
  return (readMap()[snoozeRef(pr)] ?? 0) > now;
}

export function applySnooze(prs: PR[], now = Date.now()): PR[] {
  return prs.filter((p) => !isSnoozed(p, now));
}

export function loadFilters(): SavedFilter[] {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveFilter(f: SavedFilter): SavedFilter[] {
  const all = loadFilters().filter((x) => x.name !== f.name);
  all.push(f);
  localStorage.setItem(FILTERS_KEY, JSON.stringify(all));
  return all;
}

export function deleteFilter(name: string): SavedFilter[] {
  const all = loadFilters().filter((x) => x.name !== name);
  localStorage.setItem(FILTERS_KEY, JSON.stringify(all));
  return all;
}

export interface Stats {
  authored: number;
  merged: number;
  reviewed: number;
  avgTurnaroundH: number | null;
  perRepo: { repo: string; count: number }[];
}

export function computeStats(authored: PR[], activity: PR[]): Stats {
  const merged = authored.filter((p) => p.state === "merged");
  const hours = merged
    .map((p) =>
      p.created_at && p.merged_at
        ? (new Date(p.merged_at).getTime() - new Date(p.created_at).getTime()) /
          3600000
        : null
    )
    .filter((h): h is number => h !== null && h >= 0);
  const byRepo = new Map<string, number>();
  for (const p of [...authored, ...activity])
    byRepo.set(p.repo, (byRepo.get(p.repo) ?? 0) + 1);
  return {
    authored: authored.length,
    merged: merged.length,
    reviewed: activity.length,
    avgTurnaroundH: hours.length
      ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
      : null,
    perRepo: [...byRepo.entries()]
      .map(([repo, count]) => ({ repo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
