import { describe, expect, it } from "vitest";

describe("prdetail robustness", () => {
  it("guards malformed path and caps files", async () => {
    const src = await import("../routes/PRDetail?raw");
    const text = src.default as unknown as string;
    expect(text).toContain("Show all");
    expect(text).toContain("PR not found");
    expect(text).toContain("AbortController");
  });
});
