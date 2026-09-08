import { describe, expect, test, vi } from "vitest";

import {
  applySnooze,
  computeStats,
  deleteFilter,
  isSnoozed,
  loadFilters,
  saveFilter,
  snoozeUntil,
} from "../lib/triage";
import type { PR } from "../components/InboxDeck";

const base: PR = {
  repo: "o/r",
  number: 1,
  title: "t",
  author: "a",
  head_sha: "s",
};

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
});

describe("triage", () => {
  test("snooze hides then expires", () => {
    const pr = { ...base };
    expect(isSnoozed(pr)).toBe(false);
    snoozeUntil(pr, 24);
    expect(isSnoozed(pr)).toBe(true);
    expect(applySnooze([pr, { ...base, number: 2 }]).map((p) => p.number)).toEqual([2]);
    expect(isSnoozed(pr, Date.now() + 25 * 3600 * 1000)).toBe(false);
  });

  test("saved filters round-trip", () => {
    expect(loadFilters()).toEqual([]);
    saveFilter({ name: "mine", tab: "authored", query: "bug", sort: "newest" });
    expect(loadFilters().map((f) => f.name)).toEqual(["mine"]);
    saveFilter({ name: "mine", tab: "review", query: "", sort: "oldest" });
    expect(loadFilters()).toHaveLength(1); // same name replaces
    deleteFilter("mine");
    expect(loadFilters()).toEqual([]);
  });

  test("stats count, average, and top repos", () => {
    const authored: PR[] = [
      {
        ...base, number: 1, state: "merged",
        created_at: "2026-09-01T00:00:00Z", merged_at: "2026-09-02T00:00:00Z",
      },
      { ...base, number: 2, state: "open", created_at: "2026-09-05T00:00:00Z" },
    ];
    const s = computeStats(authored, [{ ...base, number: 9, repo: "o/other" }]);
    expect(s).toMatchObject({ authored: 2, merged: 1, reviewed: 1, avgTurnaroundH: 24 });
    expect(s.perRepo[0]).toEqual({ repo: "o/r", count: 2 });
  });
});
