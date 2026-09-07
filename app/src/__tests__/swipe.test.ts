import { describe, expect, test } from "vitest";

import { gestureToEvent } from "../components/InboxDeck";

describe("swipe", () => {
  test("right approves, left requests changes, short drag cancels", () => {
    expect(gestureToEvent(220)).toBe("APPROVE");
    expect(gestureToEvent(-220)).toBe("REQUEST_CHANGES");
    expect(gestureToEvent(30)).toBeNull();
  });
});
