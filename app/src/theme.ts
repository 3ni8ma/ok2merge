export const C = {
  merge: "#22C55E",
  ink: "#0D1117",
  surface: "#161B22",
  border: "#2A3340",
  paper: "#F6F8FA",
  amber: "#F59E0B",
  red: "#EF4444",
  muted: "#8B949E",
};
export const Fonts = { display: "Space Grotesk", body: "Inter" };
export const cssVar = (name: keyof typeof C) => `var(--ok-${name})`;
