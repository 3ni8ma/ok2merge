import { describe, expect, test } from "vitest";

import { newReviewKey } from "../lib/idempotency";

describe("idempotency", () => {
  test("keys are unique per call", () => {
    expect(newReviewKey()).not.toEqual(newReviewKey());
  });
});
