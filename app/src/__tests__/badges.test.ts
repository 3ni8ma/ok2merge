import { describe, expect, it } from "vitest";
import { mergeBadge, sizeChip } from "../lib/prDisplay";

describe("badges", () => {
  it("maps mergeable_state to badge", () => {
    expect(mergeBadge({ mergeable_state: "clean", draft: false } as any)).toBe("ready");
    expect(mergeBadge({ mergeable_state: "dirty", draft: false } as any)).toBe("blocked");
    expect(mergeBadge({ draft: true } as any)).toBe("draft");
  });
  it("sizes by lines changed", () => {
    expect(sizeChip(10)).toBe("XS");
    expect(sizeChip(5000)).toBe("XL");
  });
});
