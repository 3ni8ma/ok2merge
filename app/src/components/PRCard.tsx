import { Link } from "react-router-dom";

import type { PR } from "./InboxDeck";
import { C } from "../theme";

export function PRCard({ pr }: { pr: PR }) {
  return (
    <div style={{ background: "#161B22", borderRadius: 16, padding: 16 }}>
      <div style={{ color: C.muted, fontSize: 13 }}>
        {pr.repo} #{pr.number} · by {pr.author}
      </div>
      <Link
        to={`/pr/${pr.repo}/${pr.number}?sha=${pr.head_sha}`}
        style={{ color: C.paper, fontSize: 18 }}
      >
        {pr.title}
      </Link>
    </div>
  );
}
