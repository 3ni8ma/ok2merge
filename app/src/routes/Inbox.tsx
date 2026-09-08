import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { writeSnapshot } from "../lib/widgetSync";
import { C } from "../theme";
import type { PR, ReviewEvent } from "../components/InboxDeck";
import { Deck } from "../components/Deck";
import { ReviewSheet } from "../components/ReviewSheet";

export default function Inbox() {
  const nav = useNavigate();
  const [prs, setPrs] = useState<PR[] | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [unlinked, setUnlinked] = useState(false);
  const [failed, setFailed] = useState("");
  const [pending, setPending] = useState<{ pr: PR; event: ReviewEvent } | null>(
    null
  );

  function load() {
    setFailed("");
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          nav("/onboarding"); // logged out: inbox has nothing to show
          return null;
        }
        return api.inbox();
      })
      .then((d) => {
        if (!d) return;
        setPrs(d.prs);
        writeSnapshot({ count: d.prs.length, oldestAgeMin: 0, ciFails: 0 });
      })
      .catch((e: Error) => {
        if (e.message.includes("409")) setUnlinked(true);
        else if (!navigator.onLine) setOffline(true);
        else setFailed(e.message);
      });
  }

  useEffect(() => {
    load();
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  if (prs === null)
    return (
      <div
        style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}
      >
        {failed ? (
          <>
            <p>Couldn't reach the review server.</p>
            <p style={{ color: C.muted, fontSize: 13 }}>{failed}</p>
            <button onClick={load}>Retry</button>
          </>
        ) : (
          "Loading review inbox…"
        )}
      </div>
    );
  return (
    <div style={{ background: C.ink, minHeight: "100dvh", padding: 16 }}>
      {offline && (
        <div style={{ color: C.amber }}>
          Offline — cached view, swipes disabled.
        </div>
      )}
      <Deck prs={prs} onSwipe={offline ? () => {} : onSwipe} />
      {pending && (
        <ReviewSheet
          pr={pending.pr}
          event={pending.event}
          onDone={() => setPending(null)}
        />
      )}
    </div>
  );
}
