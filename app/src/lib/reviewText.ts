export function parseChecklist(summary: string): string[] {
  const line = summary.split("\n").find((l) => l.startsWith("CHECK:")) ?? "";
  const body = line.replace(/^CHECK:\s*/, "");
  return body
    .split(/[;•\n-]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export const CANNED_REPLIES = [
  "Please add tests.",
  "Nit: please address comments.",
  "Please rebase on main.",
];
