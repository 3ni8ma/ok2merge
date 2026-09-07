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
  if (top >= prs.length) return <div>No more PRs. Inbox zero.</div>;
  const pr = prs[top];
  return (
    <motion.div
      key={`${pr.repo}#${pr.number}`}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (locked !== null) return;
        const event = gestureToEvent(info.offset.x);
        if (!event) return;
        setLocked(pr.number);
        onSwipe(pr, event);
        setTop((t) => t + 1);
        setLocked(null);
      }}
    >
      <PRCard pr={pr} />
    </motion.div>
  );
}
