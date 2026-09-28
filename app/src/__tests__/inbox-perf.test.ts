import { describe, expect, it } from "vitest";

describe("inbox perf contract", () => {
  it("deck key excludes query", async () => {
    const src = await import("../routes/Inbox?raw");
    const text = src.default as unknown as string;
    expect(text).not.toContain("`${tab}:${query}:${sort}`");
    expect(text).toContain("setAppBadge");
    expect(text).toContain('aria-label="Remove filter"');
  });
});
