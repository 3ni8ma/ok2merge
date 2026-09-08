import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { isNative, registerPush } from "../lib/native";
import { supabase } from "../lib/supabase";
import { C } from "../theme";
import { needsGithubLink } from "./onboarding-logic";

export default function Onboarding() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Returning from the GitHub OAuth redirect? Finish linking.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && !needsGithubLink(data.session)) {
        await finishGithub(data.session);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishGithub(session: any) {
    const token = session?.provider_token as string | undefined;
    const login = session?.user?.user_metadata?.user_name as string;
    if (!token) {
      setError("GitHub did not return a token");
      return;
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
      // Browser redirects away; finishGithub() runs on return.
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
      }}
    >
      <h1 style={{ fontFamily: "Space Grotesk" }}>OK2Merge</h1>
      <p>Clear your code reviews from your phone.</p>
      <button onClick={doGithub} disabled={busy}>
        {busy ? "Redirecting to GitHub…" : "Continue with GitHub"}
      </button>
      {error && <p style={{ color: C.red }}>{error}</p>}
    </div>
  );
}
