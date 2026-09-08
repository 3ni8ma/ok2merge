import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { writeSnapshot } from "../lib/widgetSync";
import { C } from "../theme";
import type { PR, ReviewEvent } from "../components/InboxDeck";
import { Deck } from "../components/Deck";
import { ReviewSheet } from "../components/ReviewSheet";
import { PRCard as PRCardStatic } from "../components/PRCard";
import Logo from "../components/Logo";

type Tab = "review" | "authored" | "done";

const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "🔍 Needs Review" },
  { id: "authored", label: "🚀 My PRs" },
  { id: "done", label: "✅ Done" },
];

export default function Inbox() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("review");
  const [lists, setLists] = useState<Record<Tab, PR[] | null>>({
    review: null,
    authored: null,
    done: null,
  });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [unlinked, setUnlinked] = useState(false);
  const [failed, setFailed] = useState("");
  const [pending, setPending] = useState<{ pr: PR; event: ReviewEvent } | null>(
    null
  );

  function load(which: Tab) {
    setFailed("");
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          nav("/onboarding"); // logged out: inbox has nothing to show
          return null;
        }
        const call =
          which === "review"
            ? api.inbox()
            : which === "authored"
              ? api.authored()
              : api.activity();
        return call;
      })
      .then((d) => {
        if (!d) return;
        setLists((prev) => ({ ...prev, [which]: d.prs }));
        if (which === "review")
          writeSnapshot({ count: d.prs.length, oldestAgeMin: 0, ciFails: 0 });
      })
      .catch((e: Error) => {
        if (e.message.includes("409")) setUnlinked(true);
        else if (!navigator.onLine) setOffline(true);
        else setFailed(e.message);
      });
  }

  useEffect(() => {
    load(tab);
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function onSwipe(pr: PR, event: ReviewEvent) {
    setPending({ pr, event });
  }

  if (unlinked)
    return (
      <div
        style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}
      >
        <p>GitHub not connected.</p>
        <a href="/onboarding">Finish onboarding</a>
      </div>
    );

  const prs = lists[tab];
  const counts = {
    review: lists.review?.length,
    authored: lists.authored?.length,
    done: lists.done?.length,
  };

  return (
    <div style={{ background: C.ink, minHeight: "100dvh", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Logo size={40} />
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", color: C.paper }}>
          OK2Merge
        </h1>
      </header>
      <nav style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? C.merge : "#161B22",
              color: tab === t.id ? C.ink : C.paper,
            }}
          >
            {t.label}
            {typeof counts[t.id] === "number" ? ` (${counts[t.id]})` : ""}
          </button>
        ))}
      </nav>
      {offline && (
        <div style={{ color: C.amber }}>
          Offline — cached view, swipes disabled.
        </div>
      )}
      {prs === null ? (
        <div style={{ color: C.paper, padding: 24 }}>
          {failed ? (
            <>
              <p>Couldn't reach the review server.</p>
              <p style={{ color: C.muted, fontSize: 13 }}>{failed}</p>
              <button onClick={() => load(tab)}>Retry</button>
            </>
          ) : (
            "Loading…"
          )}
        </div>
      ) : prs.length === 0 ? (
        <div style={{ color: C.muted, textAlign: "center", padding: 48 }}>
          <Logo size={72} />
          <p>Nothing here. Inbox zero. 🎉</p>
        </div>
      ) : tab === "review" ? (
        <Deck prs={prs} onSwipe={offline ? () => {} : onSwipe} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prs.map((pr) => (
            <PRCardStatic key={`${pr.repo}#${pr.number}`} pr={pr} />
          ))}
        </div>
      )}
      {pending && (
        <ReviewSheet
          pr={pending.pr}
          event={pending.event}
          onDone={() => {
            setPending(null);
            load("review");
          }}
        />
      )}
    </div>
  );
}
