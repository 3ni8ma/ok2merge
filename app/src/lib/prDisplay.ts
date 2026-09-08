import type { PR } from "../components/InboxDeck";

export function ageParts(createdAt?: string): { text: string; stale: boolean } {
  if (!createdAt) return { text: "", stale: false };
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  );
  const stale = mins >= 3 * 24 * 60;
  if (mins < 60) return { text: `${mins}m old`, stale };
  const hours = Math.floor(mins / 60);
  if (hours < 48) return { text: `${hours}h old`, stale };
  return { text: `${Math.floor(hours / 24)}d old`, stale };
}

export function stateLabel(pr: PR): string {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  return pr.draft ? "draft" : "open";
}

export function canMerge(pr: PR): boolean {
  return pr.state === "open" && !pr.draft && pr.mergeable_state === "clean";
}

export type SortKey = "newest" | "oldest" | "discussed";

export function filterPrs(prs: PR[], query: string): PR[] {
  const q = query.trim().toLowerCase();
  if (!q) return prs;
  return prs.filter((pr) =>
    `${pr.title} ${pr.repo} ${pr.author} #${pr.number}`.toLowerCase().includes(q)
  );
}

export function sortPrs(prs: PR[], sort: SortKey): PR[] {
  const copy = [...prs];
  if (sort === "discussed")
    return copy.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0));
  return copy.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return sort === "newest" ? tb - ta : ta - tb;
  });
}

export function oldestWaiting(prs: PR[]): PR | null {
  const open = prs.filter((p) => p.state === "open" && p.created_at);
  if (!open.length) return null;
  return open.sort(
    (a, b) => +new Date(a.created_at!) - +new Date(b.created_at!)
  )[0];
}
