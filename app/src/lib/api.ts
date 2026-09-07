const BASE = import.meta.env.VITE_API_URL!;

async function authed(path: string, init: RequestInit = {}) {
  const { supabase } = await import("./supabase");
  const { data } = await supabase.auth.getSession();
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status}`);
  return r.json();
}

export const api = {
  inbox: () => authed("/api/prs"),
  summary: (repo: string, n: number, sha: string) =>
    authed(`/api/prs/${repo}/${n}/summary?sha=${sha}`),
  review: (b: object) =>
    authed("/api/reviews", { method: "POST", body: JSON.stringify(b) }),
  githubConnect: (b: object) =>
    authed("/api/github/connect", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  githubDisconnect: () => authed("/api/github/connect", { method: "DELETE" }),
  pushToken: (b: object) =>
    authed("/api/push/register", { method: "POST", body: JSON.stringify(b) }),
  deleteAccount: () => authed("/api/account", { method: "DELETE" }),
};
