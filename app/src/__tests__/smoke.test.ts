import { describe, expect, test } from "vitest";

describe("smoke", () => {
  test("all routes and native wrappers import without throwing", async () => {
    await expect(import("../lib/native")).resolves.toBeDefined();
    await expect(import("../lib/api")).resolves.toBeDefined();
    await expect(import("../lib/supabase")).resolves.toBeDefined();
    await expect(import("../routes/Onboarding")).resolves.toBeDefined();
    await expect(import("../routes/Inbox")).resolves.toBeDefined();
    await expect(import("../routes/PRDetail")).resolves.toBeDefined();
    await expect(import("../routes/Settings")).resolves.toBeDefined();
    await expect(import("../routes/Paywall")).resolves.toBeDefined();
  });
});
