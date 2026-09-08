import { Link } from "react-router-dom";

import type { PR } from "./InboxDeck";
import { ageParts, stateLabel } from "../lib/prDisplay";
import { C } from "../theme";

const STATE_COLORS: Record<string, string> = {
  open: "#22C55E",
  draft: "#8B949E",
  merged: "#8250DF",
  closed: "#EF4444",
};

export function PRCard({ pr }: { pr: PR }) {
  const age = ageParts(pr.created_at);
  const state = stateLabel(pr);
  return (
    <div
      style={{
        background: "#161B22",
        borderRadius: 16,
        padding: 16,
        borderLeft: `4px solid ${STATE_COLORS[state] ?? C.muted}`,
      }}
    >
      <div style={{ color: C.muted, fontSize: 13 }}>
        {pr.repo} #{pr.number} · by {pr.author}
      </div>
      <Link
        to={`/pr/${pr.repo}/${pr.number}?sha=${pr.head_sha}`}
        style={{
          color: C.paper,
          fontSize: 18,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        {pr.title}
      </Link>
      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12 }}>
        <span style={{ color: STATE_COLORS[state] ?? C.muted }}>{state}</span>
        {typeof pr.comments === "number" && (
          <span style={{ color: C.muted }}>💬 {pr.comments}</span>
        )}
        {typeof pr.additions === "number" && (
          <span style={{ color: C.muted }}>
            <span style={{ color: C.merge }}>+{pr.additions}</span>{" "}
            <span style={{ color: C.red }}>−{pr.deletions}</span>
          </span>
        )}
        {age.text && (
          <span style={{ color: age.stale ? C.red : C.muted }}>{age.text}</span>
        )}
      </div>
    </div>
  );
}
