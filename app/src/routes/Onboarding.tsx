import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { isNative, registerPush } from "../lib/native";
import { supabase } from "../lib/supabase";
import { C } from "../theme";
import Logo from "../components/Logo";
import { needsGithubLink } from "./onboarding-logic";

export default function Onboarding() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Returning from the GitHub OAuth redirect? Finish linking.
  // NOTE: supabase-js parses the URL hash asynchronously, so a single
  // getSession() on mount races it and misses the fresh session. Subscribe
  // to auth changes AND check immediately — whichever fires first wins.
  useEffect(() => {
    let done = false;
    async function finish(session: any) {
      if (done || !session || needsGithubLink(session)) return;
      done = true;
      try {
        await finishGithub(session);
      } catch (e: any) {
        done = false;
        setError(e?.message ?? "GitHub connect failed");
      }
    }
    supabase.auth.getSession().then(({ data }) => finish(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) =>
      finish(session)
    );
    return () => {
      done = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishGithub(session: any) {
    const token = session?.provider_token as string | undefined;
    const login = session?.user?.user_metadata?.user_name as string;
    if (!token) {
      throw new Error("GitHub did not return a token");
    }
    await api.githubConnect({ token, login });
    const reg = await registerPush();
    if (reg)
      await api.pushToken({ fcm_token: reg.token, platform: reg.platform });
    nav("/");
  }

  async function doGithub() {
    setError("");
    setBusy(true);
    try {
      const redirectTo = isNative()
        ? "ok2merge://onboarding" // APK deep link (manifest filter committed)
        : window.location.origin + "/onboarding"; // PWA https callback
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { scopes: "repo", redirectTo },
      });
      if (error) throw error;
      // Browser redirects away; the effect above finishes on return.
    } catch (e: any) {
      setError(e?.message ?? "GitHub sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: C.ink,
        color: C.paper,
        minHeight: "100dvh",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
      }}
    >
      <span className="logo-pulse">
        <Logo size={96} />
      </span>
      <h1 style={{ fontFamily: "Space Grotesk, sans-serif", margin: 0 }}>
        OK2Merge
      </h1>
      <p style={{ color: C.muted, margin: 0 }}>
        Clear your code reviews from your phone.
      </p>
      <button onClick={doGithub} disabled={busy}>
        {busy ? "Redirecting to GitHub…" : "Continue with GitHub"}
      </button>
      {error && <p style={{ color: C.red }}>{error}</p>}
    </div>
  );
}
