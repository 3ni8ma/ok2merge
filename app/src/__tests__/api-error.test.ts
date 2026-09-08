import { describe, expect, test, vi } from "vitest";

import { api } from "../lib/api";

describe("api errors", () => {
  test("http failures carry a single method-path-status prefix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    );
    await expect(api.inbox()).rejects.toThrow("GET /api/prs -> 401");
    vi.unstubAllGlobals();
  });
});
