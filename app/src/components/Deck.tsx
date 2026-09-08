import { useState } from "react";
import { motion } from "motion/react";

import type { PR, ReviewEvent } from "./InboxDeck";
import { gestureToEvent } from "./InboxDeck";
import { PRCard } from "./PRCard";

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
  if (top >= prs.length) return <div>No more PRs. Inbox zero.</div>;
  const pr = prs[top];
  return (
    <motion.div
      key={`${pr.repo}#${pr.number}`}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={(_, info) => {
        setGlow(
          info.offset.x > 40 ? "approve" : info.offset.x < -40 ? "reject" : "none"
        );
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
      style={{ borderRadius: 16 }}
    >
      <PRCard pr={pr} />
    </motion.div>
  );
}
