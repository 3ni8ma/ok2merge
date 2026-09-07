import { describe, expect, test } from "vitest";

import { confirmText } from "../components/ReviewSheet";

describe("review", () => {
  test("confirm copy names the action and repo", () => {
    expect(confirmText("APPROVE", "o/r#7")).toContain("Approve");
    expect(confirmText("APPROVE", "o/r#7")).toContain("o/r#7");
  });
});
