import { describe, expect, it } from "vitest";
import { parseChecklist } from "../lib/reviewText";

describe("triage actions", () => {
  it("parses CHECK line into items", () => {
    const s = "WHAT: x\nRISK: y\nCHECK: tests; lint - typecheck";
    expect(parseChecklist(s)).toEqual(["tests", "lint", "typecheck"]);
  });
});
