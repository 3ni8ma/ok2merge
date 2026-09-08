import { describe, expect, test } from "vitest";

import { ageParts, canMerge, stateLabel } from "../lib/prDisplay";
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
});
