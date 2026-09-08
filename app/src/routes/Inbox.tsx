import { useEffect, useMemo, useState, type JSX } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import {
  filterPrs,
  oldestWaiting,
  sortPrs,
  type SortKey,
} from "../lib/prDisplay";
import { supabase } from "../lib/supabase";
import { writeSnapshot } from "../lib/widgetSync";
import { C } from "../theme";
import type { PR, ReviewEvent } from "../components/InboxDeck";
import { Deck } from "../components/Deck";
import { ReviewSheet } from "../components/ReviewSheet";
import { PRCard as PRCardStatic } from "../components/PRCard";
import Logo from "../components/Logo";
import {
  AlertIcon,
  CheckCircleIcon,
  GearIcon,
  InboxIcon,
  PartyIcon,
  RocketIcon,
  SearchIcon,
} from "../components/icons";

type Tab = "review" | "authored" | "done";

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "review", label: "Review", Icon: InboxIcon },
  { id: "authored", label: "Mine", Icon: RocketIcon },
  { id: "done", label: "Done", Icon: CheckCircleIcon },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "discussed", label: "Discussed" },
];

const EMPTY_COPY: Record<Tab, string> = {
  review: "Nothing waiting on you. Inbox zero.",
  authored: "No PRs you've opened. Ship something.",
  done: "No reviewed or merged PRs yet. History lands here.",
};

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
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

  const raw = lists[tab];
  const visible = useMemo(
    () => (raw ? sortPrs(filterPrs(raw, query), sort) : null),
    [raw, query, sort]
  );
  const oldest = useMemo(
    () => (tab === "review" && raw ? oldestWaiting(raw) : null),
    [tab, raw]
  );

  if (unlinked)
    return (
      <div
        style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}
      >
        <p>GitHub not connected.</p>
        <a href="/onboarding">Finish onboarding</a>
      </div>
    );

  return (
    <div style={{ background: C.ink, minHeight: "100dvh", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={40} />
          <h1
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              color: C.paper,
              margin: 0,
            }}
          >
            OK2Merge
          </h1>
        </div>
        <Link to="/settings" style={{ color: C.muted }} aria-label="Settings">
          <GearIcon size={22} />
        </Link>
      </header>

      <nav style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {TABS.map((t) => {
          const count = lists[t.id]?.length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? C.merge : "#161B22",
                color: active ? C.ink : C.paper,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <t.Icon size={16} />
              {t.label}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
      </nav>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              color: C.muted,
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, repo, author…"
            style={{ paddingLeft: 36 }}
            aria-label="Filter pull requests"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort pull requests"
          style={{
            background: "#161B22",
            color: C.paper,
            border: "1px solid #2A3340",
            borderRadius: 12,
            padding: "0 8px",
          }}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {oldest && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "#161B22",
            border: "1px solid #2A3340",
            borderRadius: 12,
            padding: "8px 12px",
            marginBottom: 12,
            color: C.amber,
            fontSize: 13,
          }}
        >
          <AlertIcon size={16} />
          <span>
            Oldest waiting: {oldest.repo}#{oldest.number} — don't let it rot.
          </span>
        </div>
      )}

      {offline && (
        <div style={{ color: C.amber, marginBottom: 12 }}>
          Offline — cached view, swipes disabled.
        </div>
      )}

      {visible === null ? (
        <div
          style={{
            color: C.paper,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          {failed ? (
            <>
              <p>Couldn't reach the review server.</p>
              <p style={{ color: C.muted, fontSize: 13 }}>{failed}</p>
              <button onClick={() => load(tab)}>Retry</button>
            </>
          ) : (
            <>
              <span className="logo-pulse">
                <Logo size={72} />
              </span>
              <span>Loading review inbox…</span>
            </>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div
          style={{
            color: C.muted,
            textAlign: "center",
            padding: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <PartyIcon size={40} />
          <p>{raw && raw.length > 0 ? "No matches for that filter." : EMPTY_COPY[tab]}</p>
        </div>
      ) : tab === "review" ? (
        <Deck prs={visible} onSwipe={offline ? () => {} : onSwipe} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((pr) => (
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
