import { describe, expect, it } from "vitest";
import { C } from "../theme";

describe("theme tokens", () => {
  it("exposes surface and border tokens", () => {
    expect((C as any).surface).toBe("#161B22");
    expect((C as any).border).toBe("#2A3340");
  });
});
