import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { writeSnapshot } from "../lib/widgetSync";
import { C } from "../theme";
import type { PR, ReviewEvent } from "../components/InboxDeck";
import { Deck } from "../components/Deck";
import { ReviewSheet } from "../components/ReviewSheet";

export default function Inbox() {
  const [prs, setPrs] = useState<PR[] | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [unlinked, setUnlinked] = useState(false);
  const [pending, setPending] = useState<{ pr: PR; event: ReviewEvent } | null>(
    null
  );

  useEffect(() => {
    api
      .inbox()
      .then((d) => {
        setPrs(d.prs);
        writeSnapshot({ count: d.prs.length, oldestAgeMin: 0, ciFails: 0 });
      })
      .catch((e: Error) => {
        if (e.message.includes("409")) setUnlinked(true);
        else if (!navigator.onLine) setOffline(true);
      });
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  function onSwipe(pr: PR, event: ReviewEvent) {
    setPending({ pr, event });
  }

  if (unlinked) return <div>GitHub not connected — finish onboarding.</div>;
  if (prs === null)
    return <div style={{ color: C.paper }}>Loading review inbox…</div>;
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
