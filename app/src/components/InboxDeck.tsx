export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES";

export interface PR {
  repo: string;
  number: number;
  title: string;
  author: string;
  head_sha: string;
  state?: string;
  draft?: boolean;
  merged_at?: string | null;
  created_at?: string;
  comments?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  mergeable_state?: string | null;
}

const THRESHOLD = 120;

export function gestureToEvent(dx: number): ReviewEvent | null {
  if (dx >= THRESHOLD) return "APPROVE";
  if (dx <= -THRESHOLD) return "REQUEST_CHANGES";
  return null;
}
