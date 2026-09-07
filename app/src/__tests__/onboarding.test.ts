import { describe, expect, test } from "vitest";

import { needsGithubLink } from "../routes/onboarding-logic";

describe("onboarding", () => {
  test("flags session without github identity", () => {
    expect(
      needsGithubLink({ user: { identities: [{ provider: "apple" }] } } as any)
    ).toBe(true);
    expect(
      needsGithubLink({
        user: { identities: [{ provider: "apple" }, { provider: "github" }] },
      } as any)
    ).toBe(false);
  });
});
