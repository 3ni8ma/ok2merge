import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import { C } from "../theme";

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
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.kind === "loading")
    return <div style={{ color: C.paper }}>Summarizing…</div>;
  if (state.kind === "capped")
    return (
      <div style={{ color: C.paper }}>
        Daily cap reached — <Link to="/paywall">Pro removes it</Link>.
      </div>
    );
  if (state.kind === "error")
    return <button onClick={state.retry}>Retry summary</button>;
  return (
    <div style={{ background: C.ink, color: C.paper, padding: 16 }}>
      {state.partial && (
        <div style={{ color: C.amber }}>Partial summary (first files only).</div>
      )}
      <pre style={{ whiteSpace: "pre-wrap" }}>{state.summary}</pre>
    </div>
  );
}
