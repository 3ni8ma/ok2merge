import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { C } from "../theme";

export default function Settings() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function disconnectGithub() {
    await api.githubDisconnect();
    nav("/onboarding");
  }

  async function deleteAccount() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await api.deleteAccount();
      await supabase.auth.signOut();
      nav("/onboarding");
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    }
  }

  return (
    <div style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 16 }}>
      <h2>Settings</h2>
      <button onClick={disconnectGithub}>Disconnect GitHub</button>
      <button onClick={deleteAccount} style={{ color: C.red }}>
        {confirming ? "Tap again to permanently delete" : "Delete account"}
      </button>
      {error && <p style={{ color: C.red }}>{error}</p>}
    </div>
  );
}
