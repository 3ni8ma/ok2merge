import { useState } from "react";
import { motion } from "motion/react";

import type { PR, ReviewEvent } from "./InboxDeck";
import { gestureToEvent } from "./InboxDeck";
import { PRCard } from "./PRCard";
import { buzz } from "../lib/native";
import { CheckIcon, XIcon } from "./icons";

export function Deck({
  prs,
  onSwipe,
}: {
  prs: PR[];
  onSwipe: (pr: PR, event: ReviewEvent) => void;
}) {
  const [locked, setLocked] = useState<number | null>(null);
  const [top, setTop] = useState(0);
  const [glow, setGlow] = useState<"none" | "approve" | "reject">("none");
  if (top >= prs.length)
    return <div style={{ color: "#8B949E" }}>No more PRs. Inbox zero.</div>;
  const pr = prs[top];
  const upcoming = prs.slice(top + 1, top + 3);
  return (
    <div>
      <div style={{ color: "#8B949E", fontSize: 13, marginBottom: 8 }}>
        {top + 1} of {prs.length}
      </div>
      <div style={{ position: "relative" }}>
        {upcoming
          .slice()
          .reverse()
          .map((u, i) => (
            <div
              key={`${u.repo}#${u.number}`}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${(upcoming.length - i) * 10}px) scale(${1 - (upcoming.length - i) * 0.03})`,
                opacity: 0.5,
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              <PRCard pr={u} />
            </div>
          ))}
        <motion.div
          key={`${pr.repo}#${pr.number}`}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDrag={(_, info) => {
            const next =
              info.offset.x > 40
                ? "approve"
                : info.offset.x < -40
                  ? "reject"
                  : "none";
            setGlow((prev) => {
              if (prev !== next && next !== "none") buzz();
              return next;
            });
          }}
          onDragEnd={(_, info) => {
            setGlow("none");
            if (locked !== null) return;
            const event = gestureToEvent(info.offset.x);
            if (!event) return;
            setLocked(pr.number);
            onSwipe(pr, event);
            setTop((t) => t + 1);
            setLocked(null);
          }}
          animate={{
            boxShadow:
              glow === "approve"
                ? "0 0 32px rgba(34,197,94,0.55)"
                : glow === "reject"
                  ? "0 0 32px rgba(245,158,11,0.55)"
                  : "0 0 0px rgba(0,0,0,0)",
          }}
          style={{ borderRadius: 16, position: "relative" }}
        >
          {glow !== "none" && (
            <div
              style={{
                position: "absolute",
                top: 12,
                [glow === "approve" ? "right" : "left"]: 12,
                background: glow === "approve" ? "#22C55E" : "#F59E0B",
                color: "#0D1117",
                borderRadius: 999,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                zIndex: 1,
              }}
            >
              {glow === "approve" ? <CheckIcon size={14} /> : <XIcon size={14} />}
              {glow === "approve" ? "APPROVE" : "CHANGES"}
            </div>
          )}
          <PRCard pr={pr} />
        </motion.div>
      </div>
    </div>
  );
}
