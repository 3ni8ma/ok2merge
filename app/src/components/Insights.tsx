import { useMemo } from "react";

import type { PR } from "./InboxDeck";
import { computeStats } from "../lib/triage";
import { C } from "../theme";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "#161B22",
        borderRadius: 16,
        padding: 16,
        flex: "1 1 40%",
      }}
    >
      <div
        style={{
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 28,
          color: C.merge,
        }}
      >
        {value}
      </div>
      <div style={{ color: C.paper, fontSize: 14 }}>{label}</div>
      {sub && <div style={{ color: C.muted, fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export default function Insights({
  authored,
  activity,
}: {
  authored: PR[];
  activity: PR[];
}) {
  const stats = useMemo(
    () => computeStats(authored, activity),
    [authored, activity]
  );
  const maxRepo = Math.max(1, ...stats.perRepo.map((r) => r.count));
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="PRs opened" value={String(stats.authored)} />
        <StatCard label="Merged" value={String(stats.merged)} />
        <StatCard label="Reviews done" value={String(stats.reviewed)} />
        <StatCard
          label="Avg. time to merge"
          value={
            stats.avgTurnaroundH === null ? "—" : `${stats.avgTurnaroundH}h`
          }
        />
      </div>
      <h3 style={{ fontFamily: "Space Grotesk, sans-serif", color: C.paper }}>
        Top repos
      </h3>
      {stats.perRepo.length === 0 && (
        <p style={{ color: C.muted }}>No data yet — review something.</p>
      )}
      {stats.perRepo.map((r) => (
        <div key={r.repo} style={{ marginBottom: 8 }}>
          <div style={{ color: C.paper, fontSize: 13 }}>{r.repo}</div>
          <div
            style={{
              background: "#161B22",
              borderRadius: 8,
              height: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round((r.count / maxRepo) * 100)}%`,
                background: C.merge,
                height: "100%",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
