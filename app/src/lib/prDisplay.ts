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
