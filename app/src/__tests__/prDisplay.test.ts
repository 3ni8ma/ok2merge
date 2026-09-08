import { describe, expect, test } from "vitest";

import { ageParts, canMerge, filterPrs, oldestWaiting, sortPrs, stateLabel } from "../lib/prDisplay";
import type { PR } from "../components/InboxDeck";

const base: PR = {
  repo: "o/r",
  number: 1,
  title: "t",
  author: "a",
  head_sha: "s",
};

describe("prDisplay", () => {
  test("state labels prefer merged, then closed, then draft", () => {
    expect(stateLabel({ ...base, state: "open", draft: true })).toBe("draft");
    expect(stateLabel({ ...base, state: "open" })).toBe("open");
    expect(stateLabel({ ...base, state: "closed" })).toBe("closed");
    expect(stateLabel({ ...base, state: "merged" })).toBe("merged");
  });

  test("merge gate requires open, non-draft, clean", () => {
    expect(
      canMerge({ ...base, state: "open", mergeable_state: "clean" })
    ).toBe(true);
    expect(
      canMerge({ ...base, state: "open", draft: true, mergeable_state: "clean" })
    ).toBe(false);
    expect(
      canMerge({ ...base, state: "open", mergeable_state: "dirty" })
    ).toBe(false);
    expect(canMerge({ ...base, state: "merged" })).toBe(false);
  });

  test("age marks stale after 3 days", () => {
    const old = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
    const fresh = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(ageParts(old).stale).toBe(true);
    expect(ageParts(old).text).toBe("4d old");
    expect(ageParts(fresh)).toEqual({ text: "30m old", stale: false });
    expect(ageParts(undefined)).toEqual({ text: "", stale: false });
  });

  test("filter matches title, repo, author, number", () => {
    const prs: PR[] = [
      { ...base, title: "Fix login bug", repo: "o/web", author: "amy", number: 3 },
      { ...base, title: "Add dark mode", repo: "o/app", author: "bob", number: 7 },
    ];
    expect(filterPrs(prs, "dark").map((p) => p.number)).toEqual([7]);
    expect(filterPrs(prs, "AMY").map((p) => p.number)).toEqual([3]);
    expect(filterPrs(prs, "#3").map((p) => p.number)).toEqual([3]);
    expect(filterPrs(prs, "  ").length).toBe(2);
  });

  test("sort orders by age or discussion", () => {
    const old: PR = { ...base, number: 1, created_at: "2026-01-01T00:00:00Z", comments: 1 };
    const fresh: PR = { ...base, number: 2, created_at: "2026-09-01T00:00:00Z", comments: 9 };
    expect(sortPrs([old, fresh], "newest").map((p) => p.number)).toEqual([2, 1]);
    expect(sortPrs([old, fresh], "oldest").map((p) => p.number)).toEqual([1, 2]);
    expect(sortPrs([old, fresh], "discussed").map((p) => p.number)).toEqual([2, 1]);
  });

  test("oldestWaiting skips merged and dateless PRs", () => {
    expect(oldestWaiting([])).toBeNull();
    const prs: PR[] = [
      { ...base, number: 1, state: "merged", created_at: "2026-01-01T00:00:00Z" },
      { ...base, number: 2, state: "open", created_at: "2026-08-01T00:00:00Z" },
      { ...base, number: 3, state: "open" },
    ];
    expect(oldestWaiting(prs)?.number).toBe(2);
  });
});
