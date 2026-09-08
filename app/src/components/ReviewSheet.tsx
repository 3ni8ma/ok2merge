import { useState } from "react";

import { api } from "../lib/api";
import { newReviewKey } from "../lib/idempotency";
import { buzz, confirmHuman } from "../lib/native";
import { C } from "../theme";
import type { PR, ReviewEvent } from "./InboxDeck";

export function confirmText(event: ReviewEvent, ref: string): string {
  const verb = event === "APPROVE" ? "Approve" : "Request changes on";
  return `${verb} ${ref} — this posts to GitHub immediately`;
}

export function ReviewSheet({
  pr,
  event,
  onDone,
}: {
  pr: PR;
  event: ReviewEvent;
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = `${pr.repo}#${pr.number}`;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const ok = await confirmHuman("Confirm approval");
      if (!ok) {
        setError("Couldn't confirm it's you on this device — approvals need biometrics.");
        setBusy(false);
        return;
      }
      await api.review({
        repo: pr.repo,
        number: pr.number,
        event,
        body,
        key: newReviewKey(),
      });
      buzz();
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Review failed");
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#161B22", borderRadius: "16px 16px 0 0", padding: 16 }}>
      <p style={{ color: C.paper }}>{confirmText(event, ref)}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {(event === "APPROVE"
          ? ["LGTM — nice work", "Approved with nits"]
          : ["Needs changes — see comments", "Blocking: tests failing"]
        ).map((preset) => (
          <button
            key={preset}
            onClick={() => setBody(preset)}
            style={{ background: "#0D1117", color: C.paper, fontSize: 13 }}
          >
            {preset}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Comment (optional — use the OS dictation key to dictate)"
        rows={3}
        style={{ width: "100%" }}
      />
      {error && <p style={{ color: C.red }}>{error}</p>}
      <button disabled={busy} onClick={submit}>
        {busy ? "Posting…" : "Confirm"}
      </button>
    </div>
  );
}
