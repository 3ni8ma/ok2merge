import { describe, expect, it } from "vitest";

describe("threads", () => {
  it("has read-only thread sheet with dialog semantics", async () => {
    const src = await import("../routes/PRDetail?raw");
    const text = src.default as unknown as string;
    expect(text).toContain("View comments");
    expect(text).toContain('role="dialog"');
    expect(text).toContain("aria-modal");
    expect(text).toContain("Close");
    expect(text).toContain("Escape");
  });
});
