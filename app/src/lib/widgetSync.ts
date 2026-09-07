import { writeSnapshot as bridgeWrite } from "widget-bridge";

export function writeSnapshot(s: {
  count: number;
  oldestAgeMin: number;
  ciFails: number;
}): void {
  bridgeWrite(s).catch(() => {});
}
