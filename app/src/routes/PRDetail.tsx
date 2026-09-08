import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import { C } from "../theme";
import {
  AlertIcon,
  CheckCircleIcon,
  LinkIcon,
  MergeIcon,
  SnoozeIcon,
} from "../components/icons";

interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export default function PRDetail() {
  const { "*": rest } = useParams();
  const [search] = useSearchParams();
  const sha = search.get("sha") ?? "";
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; summary: string; partial: boolean }
    | { kind: "capped" }
    | { kind: "error"; retry: () => void }
  >({ kind: "loading" });

  const [files, setFiles] = useState<FileChange[] | null>(null);
  const [checks, setChecks] = useState<CheckRun[] | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [mergeState, setMergeState] = useState<
    "idle" | "working" | "merged" | "already" | "failed"
  >("idle");

  const [owner, repo, n] = (rest ?? "").split("/");
  const fullRepo = `${owner}/${repo}`;
  const nav = useNavigate();

  function copyLink() {
    navigator.clipboard
      ?.writeText(`https://github.com/${fullRepo}/pull/${n}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function load() {
    setState({ kind: "loading" });
    const [owner, repo, n] = (rest ?? "").split("/");
    api
      .summary(`${owner}/${repo}`, Number(n), sha)
      .then((d) => setState({ kind: "ok", summary: d.summary, partial: d.partial }))
      .catch((e: Error) => {
        if (e.message.includes("429")) setState({ kind: "capped" });
        else setState({ kind: "error", retry: load });
      });
    api
      .files(`${owner}/${repo}`, Number(n))
      .then((d) => setFiles(d.files))
      .catch(() => setFiles([]));
    api
      .checks(`${owner}/${repo}`, Number(n), sha)
      .then((d) => setChecks(d.runs))
      .catch(() => setChecks([]));
  }

  async function doRerun(runId: number) {
    const [owner, repo] = (rest ?? "").split("/");
    try {
      await api.rerun({ repo: `${owner}/${repo}`, run_id: runId });
      setNotice("Re-run requested.");
    } catch {
      setNotice("Re-run failed.");
    }
  }

  async function doRerequest() {
    const [owner, repo, n] = (rest ?? "").split("/");
    const name = reviewer.trim().replace(/^@/, "");
    if (!name) return;
    try {
      await api.reviewers({
        repo: `${owner}/${repo}`,
        number: Number(n),
        reviewers: [name],
      });
      setNotice(`Review requested from @${name}.`);
      setReviewer("");
    } catch {
      setNotice("Request failed — check the username.");
    }
  }

  function doSnooze() {
    const [owner, repo, n] = (rest ?? "").split("/");
    try {
      const map = JSON.parse(localStorage.getItem("ok2merge-snoozed") ?? "{}");
      map[`${owner}/${repo}#${n}`] = Date.now() + 24 * 3600 * 1000;
      localStorage.setItem("ok2merge-snoozed", JSON.stringify(map));
    } catch {
      // storage unavailable — nothing to do
    }
    nav("/");
  }

  async function doMerge() {
    const [owner, repo, n] = (rest ?? "").split("/");
    setMergeState("working");
    try {
      const r = await api.merge({ repo: `${owner}/${repo}`, number: Number(n) });
      setMergeState(r.ok ? "merged" : "already");
    } catch {
      setMergeState("failed");
    }
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.kind === "loading")
    return (
      <div
        style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}
      >
        Summarizing…
      </div>
    );
  if (state.kind === "capped")
    return (
      <div
        style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}
      >
        Daily cap reached — <Link to="/paywall">Pro removes it</Link>.
      </div>
    );
  if (state.kind === "error")
    return <button onClick={state.retry}>Retry summary</button>;
  return (
    <div style={{ background: C.ink, color: C.paper, padding: 16, minHeight: "100dvh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <MergeIcon size={20} />
        <span style={{ color: C.muted }}>
          {fullRepo}#{n}
        </span>
        <button
          onClick={copyLink}
          style={{ background: "#161B22", color: C.paper, fontSize: 13 }}
          aria-label="Copy PR link"
        >
          <LinkIcon size={14} /> {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {state.partial && (
        <div style={{ color: C.amber }}>Partial summary (first files only).</div>
      )}
      <pre style={{ whiteSpace: "pre-wrap" }}>{state.summary}</pre>
      <h3 style={{ fontFamily: "Space Grotesk, sans-serif" }}>
        Checks {checks === null ? "…" : `(${checks.length})`}
      </h3>
      {checks !== null && checks.length > 0 && (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {checks.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background:
                    c.conclusion === "success"
                      ? C.merge
                      : c.conclusion === "failure"
                        ? C.red
                        : C.amber,
                }}
              />
              <span style={{ flex: 1 }}>
                {c.name} · {c.conclusion ?? c.status}
              </span>
              {c.conclusion === "failure" && (
                <button
                  onClick={() => doRerun(c.id)}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Re-run failed
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3 style={{ fontFamily: "Space Grotesk, sans-serif" }}>
        Files {files === null ? "…" : `(${files.length})`}
      </h3>
      {files !== null && files.length > 0 && (
        <ul style={{ paddingLeft: 18, color: C.muted, fontSize: 13 }}>
          {files.slice(0, 20).map((f) => (
            <li key={f.filename}>
              {f.filename}{" "}
              <span style={{ color: C.merge }}>+{f.additions}</span>{" "}
              <span style={{ color: C.red }}>−{f.deletions}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="@username to re-request"
          style={{ maxWidth: 220 }}
          aria-label="Reviewer username"
        />
        <button onClick={doRerequest}>Request review</button>
        <button
          onClick={doSnooze}
          style={{ background: "#161B22", color: C.paper }}
        >
          <SnoozeIcon size={14} /> Snooze 24h
        </button>
      </div>
      {notice && (
        <p style={{ color: C.muted, fontSize: 13 }}>{notice}</p>
      )}
      <div style={{ marginTop: 16 }}>
        {mergeState === "idle" && (
          <button onClick={doMerge}>Merge when green</button>
        )}
        {mergeState === "working" && <span>Merging…</span>}
        {mergeState === "merged" && (
          <span style={{ color: C.merge }}>
            <CheckCircleIcon size={16} /> Merged.
          </span>
        )}
        {mergeState === "already" && (
          <span style={{ color: C.amber }}>Already merged.</span>
        )}
        {mergeState === "failed" && (
          <>
            <span style={{ color: C.red }}>
              <AlertIcon size={16} /> Merge failed (not green yet?).{" "}
            </span>
            <button onClick={doMerge}>Retry</button>
          </>
        )}
      </div>
    </div>
  );
}
