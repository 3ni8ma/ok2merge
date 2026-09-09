import { useState } from "react";
import { Link } from "react-router-dom";

import type { PR } from "./InboxDeck";
import { ageParts, stateLabel } from "../lib/prDisplay";
import { C } from "../theme";
import { ClockIcon, MessageIcon } from "./icons";

const STATE_COLORS: Record<string, string> = {
  open: "#22C55E",
  draft: "#8B949E",
  merged: "#8250DF",
  closed: "#EF4444",
};

export function PRCard({
  pr,
  onLabelsChange,
}: {
  pr: PR;
  onLabelsChange?: (labels: string[]) => void;
}) {
  const age = ageParts(pr.created_at);
  const state = stateLabel(pr);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const labels = pr.labels ?? [];
  return (
    <div
      style={{
        background: "#161B22",
        borderRadius: 16,
        padding: 16,
        borderLeft: `4px solid ${STATE_COLORS[state] ?? C.muted}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: C.muted,
          fontSize: 13,
        }}
      >
        {pr.author_avatar ? (
          <img
            src={pr.author_avatar}
            alt={pr.author}
            width={22}
            height={22}
            style={{ borderRadius: "50%" }}
          />
        ) : null}
        <span>
          {pr.repo} #{pr.number} · by {pr.author}
        </span>
      </div>
      <Link
        to={`/pr/${pr.repo}/${pr.number}?sha=${pr.head_sha}`}
        style={{
          color: C.paper,
          fontSize: 18,
          fontFamily: "Space Grotesk, sans-serif",
          textDecoration: "none",
          display: "block",
          marginTop: 6,
        }}
      >
        {pr.title}
      </Link>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 10,
          fontSize: 12,
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: STATE_COLORS[state] ?? C.muted,
            border: `1px solid ${STATE_COLORS[state] ?? C.muted}`,
            borderRadius: 999,
            padding: "2px 10px",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontSize: 11,
          }}
        >
          {state}
        </span>
        {typeof pr.comments === "number" && pr.comments > 0 && (
          <span style={{ color: C.muted }}>
            <MessageIcon size={14} /> {pr.comments}
          </span>
        )}
        {typeof pr.additions === "number" && (
          <span style={{ color: C.muted }}>
            <span style={{ color: C.merge }}>+{pr.additions}</span>{" "}
            <span style={{ color: C.red }}>−{pr.deletions}</span>
          </span>
        )}
        {age.text && (
          <span style={{ color: age.stale ? C.red : C.muted }}>
            <ClockIcon size={14} /> {age.text}
          </span>
        )}
      </div>
      {(labels.length > 0 || (onLabelsChange && state !== "merged" && state !== "closed")) && (
        <div
          style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}
        >
          {labels.map((l) => (
            <button
              key={l}
              onClick={() =>
                onLabelsChange?.(labels.filter((x) => x !== l))
              }
              title={onLabelsChange ? "Tap to remove" : l}
              style={{
                background: "#0D1117",
                color: C.paper,
                fontSize: 11,
                padding: "2px 10px",
              }}
            >
              {l}{onLabelsChange ? " ×" : ""}
            </button>
          ))}
          {onLabelsChange &&
            (adding ? (
              <span style={{ display: "flex", gap: 4 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="label"
                  style={{ width: 100, padding: 4, fontSize: 12 }}
                  aria-label="New label"
                />
                <button
                  onClick={() => {
                    const name = draft.trim();
                    if (name) onLabelsChange([...labels, name]);
                    setDraft("");
                    setAdding(false);
                  }}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  Add
                </button>
              </span>
            ) : (
              <button
                onClick={() => setAdding(true)}
                style={{
                  background: "transparent",
                  color: C.muted,
                  fontSize: 11,
                }}
              >
                + label
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
