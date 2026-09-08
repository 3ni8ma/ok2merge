import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import { C } from "../theme";
import { AlertIcon, CheckCircleIcon, LinkIcon, MergeIcon } from "../components/icons";

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
  const [copied, setCopied] = useState(false);
  const [mergeState, setMergeState] = useState<
    "idle" | "working" | "merged" | "already" | "failed"
  >("idle");

  const [owner, repo, n] = (rest ?? "").split("/");
  const fullRepo = `${owner}/${repo}`;

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
