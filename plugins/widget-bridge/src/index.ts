import { registerPlugin } from "@capacitor/core";

import type { WidgetBridgePlugin } from "./definitions";

const native = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

export interface Snapshot {
  count: number;
  oldestAgeMin: number;
  ciFails: number;
  updatedAt: number;
}

export function shapeSnapshot(s: Partial<Snapshot>): Snapshot {
  return {
    count: 0,
    oldestAgeMin: 0,
    ciFails: 0,
    updatedAt: Date.now(),
    ...s,
  };
}

export const writeSnapshot = (s: Partial<Snapshot>) =>
  native.writeSnapshot({ json: JSON.stringify(shapeSnapshot(s)) });
