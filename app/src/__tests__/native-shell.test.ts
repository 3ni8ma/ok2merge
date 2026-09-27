import { describe, expect, it } from "vitest";

describe("native shell detect", () => {
  it("exposes isNativeShell helper", async () => {
    const m = await import("../App");
    expect(typeof (m as any).isNativeShell).toBe("function");
  });
});
