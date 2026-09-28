import { describe, expect, it } from "vitest";

describe("deck a11y contract", () => {
  it("deck exposes button fallback roles", async () => {
    const src = await import("../components/Deck?raw");
    const text = src.default as unknown as string;
    expect(text).toContain("Approve");
    expect(text).toContain("radiogroup");
  });
  it("review sheet is a dialog with cancel", async () => {
    const src = await import("../components/ReviewSheet?raw");
    const text = src.default as unknown as string;
    expect(text).toContain('role="dialog"');
    expect(text).toContain("Cancel");
  });
});
