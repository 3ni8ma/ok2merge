import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import {
  filterPrs,
  oldestWaiting,
  sortPrs,
  type SortKey,
} from "../lib/prDisplay";
import { supabase } from "../lib/supabase";
import {
  applySnooze,
  deleteFilter,
  loadFilters,
  saveFilter,
  type SavedFilter,
} from "../lib/triage";
import { newReviewKey } from "../lib/idempotency";
import { writeSnapshot } from "../lib/widgetSync";
import { C } from "../theme";
import type { PR, ReviewEvent } from "../components/InboxDeck";
import { Deck } from "../components/Deck";
import { ReviewSheet } from "../components/ReviewSheet";
import { PRCard as PRCardStatic } from "../components/PRCard";
import Insights from "../components/Insights";
import Logo from "../components/Logo";
import {
  AlertIcon,
  BellIcon,
  ChartIcon,
  CheckCircleIcon,
  GearIcon,
  InboxIcon,
  PartyIcon,
  RocketIcon,
  SearchIcon,
} from "../components/icons";

type Tab = "review" | "authored" | "done" | "mentions" | "insights";

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "review", label: "Review", Icon: InboxIcon },
  { id: "authored", label: "Mine", Icon: RocketIcon },
  { id: "done", label: "Done", Icon: CheckCircleIcon },
  { id: "mentions", label: "Pinged", Icon: BellIcon },
  { id: "insights", label: "Stats", Icon: ChartIcon },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "discussed", label: "Discussed" },
];

const EMPTY_COPY: Record<string, string> = {
  review: "Nothing waiting on you. Inbox zero.",
  authored: "No PRs you've opened. Ship something.",
  done: "No reviewed or merged PRs yet. History lands here.",
  mentions: "Nobody has pinged you. Enjoy the silence.",
};

type Lists = Record<"review" | "authored" | "done" | "mentions", PR[] | null>;

export default function Inbox() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("review");
  const [lists, setLists] = useState<Lists>({
    review: null,
    authored: null,
    done: null,
    mentions: null,
  });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [unlinked, setUnlinked] = useState(false);
  const [failed, setFailed] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [pending, setPending] = useState<{ pr: PR; event: ReviewEvent } | null>(
    null
  );
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<"idle" | "working" | "done">("idle");
  const [filters, setFilters] = useState<SavedFilter[]>(() => loadFilters());
  const [savingFilter, setSavingFilter] = useState(false);
  const [filterName, setFilterName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  function load(which: Tab) {
    if (which === "insights") {
      // Stats derive from authored + activity; ensure both are loaded.
      if (lists.authored === null || lists.done === null) {
        load("authored");
        load("done");
      }
      return;
    }
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
              : which === "mentions"
                ? api.mentions()
                : api.activity();
        return call;
      })
      .then((d) => {
        if (!d) return;
        setLists((prev) => ({ ...prev, [which]: d.prs }));
        if (which === "review") {
          const oldest = oldestWaiting(d.prs);
          const oldestAgeMin = oldest?.created_at
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(oldest.created_at).getTime()) / 60000
                )
              )
            : 0;
          writeSnapshot({ count: d.prs.length, oldestAgeMin, ciFails: 0 });
        }
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

  useEffect(() => {
    function keys(e: KeyboardEvent) {
      const typing =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
        setTab(TABS[Number(e.key) - 1].id);
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  function onSwipe(pr: PR, event: ReviewEvent) {
    setPending({ pr, event });
  }

  function toggleSelect(pr: PR) {
    const ref = `${pr.repo}#${pr.number}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  async function approveSelected() {
    const targets = (lists.review ?? []).filter((p) =>
      selected.has(`${p.repo}#${p.number}`)
    );
    if (!targets.length) return;
    setBulkState("working");
    for (const pr of targets) {
      try {
        await api.review({
          repo: pr.repo,
          number: pr.number,
          event: "APPROVE",
          body: "",
          key: newReviewKey(),
        });
      } catch {
        // keep going; failures surface on the next load
      }
    }
    setBulkState("done");
    setSelected(new Set());
    setSelecting(false);
    setBulkState("idle");
    load("review");
  }

  const raw = tab === "insights" ? null : lists[tab as keyof Lists];
  const visible = useMemo(
    () => (raw ? sortPrs(filterPrs(applySnooze(raw), query), sort) : null),
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

      <nav style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const count =
            t.id === "insights" ? undefined : lists[t.id as keyof Lists]?.length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setSelecting(false);
                setSelected(new Set());
              }}
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

      {tab === "insights" ? (
        <Insights
          authored={lists.authored ?? []}
          activity={lists.done ?? []}
        />
      ) : (
        <>
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
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by title, repo, author…  ( / )"
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

          <div
            style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
          >
            {filters
              .filter((f) => f.tab === tab)
              .map((f) => (
                <button
                  key={f.name}
                  onClick={() => {
                    setQuery(f.query);
                    setSort(f.sort as SortKey);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setFilters(deleteFilter(f.name));
                  }}
                  title="Apply filter (right-click to delete)"
                  style={{
                    background: "#161B22",
                    color: C.paper,
                    fontSize: 13,
                  }}
                >
                  {f.name}
                </button>
              ))}
            {savingFilter ? (
              <span style={{ display: "flex", gap: 4 }}>
                <input
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Filter name"
                  style={{ width: 130, padding: 8 }}
                  aria-label="Filter name"
                />
                <button
                  onClick={() => {
                    if (filterName.trim())
                      setFilters(
                        saveFilter({ name: filterName.trim(), tab, query, sort })
                      );
                    setFilterName("");
                    setSavingFilter(false);
                  }}
                >
                  Save
                </button>
              </span>
            ) : (
              <button
                onClick={() => setSavingFilter(true)}
                style={{ background: "transparent", color: C.muted, fontSize: 13 }}
              >
                + Save filter
              </button>
            )}
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

          {tab === "review" && (visible?.length ?? 0) > 1 && (
            <div style={{ marginBottom: 12 }}>
              {selecting ? (
                <span style={{ display: "flex", gap: 8 }}>
                  <button onClick={approveSelected} disabled={selected.size === 0}>
                    Approve {selected.size} selected
                    {bulkState === "working" ? "…" : ""}
                  </button>
                  <button
                    onClick={() => {
                      setSelecting(false);
                      setSelected(new Set());
                    }}
                    style={{ background: "transparent", color: C.muted }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setSelecting(true)}
                  style={{ background: "transparent", color: C.muted, fontSize: 13 }}
                >
                  Select multiple…
                </button>
              )}
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
                  <button onClick={() => load(tab as "review" | "authored" | "done" | "mentions")}>
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <span className="logo-pulse">
                    <Logo size={72} />
                  </span>
                  <span>Loading…</span>
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
              <p>
                {raw && raw.length > 0
                  ? "No matches for that filter."
                  : EMPTY_COPY[tab]}
              </p>
            </div>
      ) : tab === "review" && !selecting ? (
        <Deck
          key={`${tab}:${query}:${sort}`}
          prs={visible}
          onSwipe={offline ? () => {} : onSwipe}
        />
      ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visible.map((pr) => {
                const ref = `${pr.repo}#${pr.number}`;
                return (
                  <div
                    key={ref}
                    style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                  >
                    {selecting && (
                      <input
                        type="checkbox"
                        checked={selected.has(ref)}
                        onChange={() => toggleSelect(pr)}
                        aria-label={`Select ${ref}`}
                        style={{ width: 20, marginTop: 18 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <PRCardStatic
                        pr={pr}
                        onLabelsChange={async (labels) => {
                          await api.labels({
                            repo: pr.repo,
                            number: pr.number,
                            labels,
                          });
                          load(tab as "authored" | "done" | "mentions");
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {pending && (
        <ReviewSheet
          pr={pending.pr}
          event={pending.event}
          onDone={() => {
            // Optimistic removal: GitHub search lags, so drop it locally now
            // (prevents reviewing the same PR twice) and refresh behind it.
            const ref = `${pending.pr.repo}#${pending.pr.number}`;
            setLists((prev) => ({
              ...prev,
              review: (prev.review ?? []).filter(
                (p) => `${p.repo}#${p.number}` !== ref
              ),
            }));
            setPending(null);
            load("review");
          }}
        />
      )}
    </div>
  );
}
