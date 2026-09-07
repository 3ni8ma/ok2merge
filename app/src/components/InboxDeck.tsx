export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES";

export interface PR {
  repo: string;
  number: number;
  title: string;
  author: string;
  head_sha: string;
}

const THRESHOLD = 120;

export function gestureToEvent(dx: number): ReviewEvent | null {
  if (dx >= THRESHOLD) return "APPROVE";
  if (dx <= -THRESHOLD) return "REQUEST_CHANGES";
  return null;
}
