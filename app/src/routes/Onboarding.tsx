import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { appleSignIn, registerPush } from "../lib/native";
import { supabase } from "../lib/supabase";
import { C } from "../theme";
import { needsGithubLink } from "./onboarding-logic";

type Step = "apple" | "github" | "push" | "done";

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("apple");
  const [error, setError] = useState("");

  async function doApple() {
    setError("");
    try {
      const r = await appleSignIn(import.meta.env.VITE_APPLE_SERVICE_ID!);
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: r.idToken,
      });
      if (error) throw error;
      setStep(needsGithubLink(data.session) ? "github" : "push");
    } catch (e: any) {
      setError(e?.message ?? "Apple sign-in failed");
    }
  }

  async function doGithub() {
    setError("");
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: "repo",
          redirectTo: "ok2merge://onboarding",
        },
      });
      if (error) throw error;
      // After the browser flow returns via ok2merge:// deep link:
      const { data } = await supabase.auth.getSession();
      const token = (data.session as any)?.provider_token as string | undefined;
      const login = data.session?.user?.user_metadata?.user_name as string;
      if (!token) throw new Error("GitHub did not return a token");
      await api.githubConnect({ token, login });
      setStep("push");
    } catch (e: any) {
      setError(e?.message ?? "GitHub connect failed");
    }
  }

  async function doPush() {
    setError("");
    try {
      const reg = await registerPush();
      if (reg) await api.pushToken({ fcm_token: reg.token, platform: reg.platform });
      setStep("done");
      nav("/");
    } catch (e: any) {
      setError(e?.message ?? "Push setup failed");
    }
  }

  return (
    <div style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}>
      <h1 style={{ fontFamily: "Space Grotesk" }}>OK2Merge</h1>
      {step === "apple" && (
        <button onClick={doApple}>Continue with Apple</button>
      )}
      {step === "github" && (
        <button onClick={doGithub}>Connect GitHub</button>
      )}
      {step === "push" && (
        <button onClick={doPush}>Enable notifications</button>
      )}
      {error && <p style={{ color: C.red }}>{error}</p>}
    </div>
  );
}
