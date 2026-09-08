import { describe, expect, test } from "vitest";

import { shapeSnapshot } from "../lib/widget-bridge";

describe("widget-bridge", () => {
  test("snapshot carries updatedAt", () => {
    expect(shapeSnapshot({ count: 3 }).updatedAt).toBeGreaterThan(0);
  });
});
