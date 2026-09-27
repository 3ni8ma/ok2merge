# OK2Merge — Harden Design Spec (2026-09-27, Phase A: efficiency + UI + triage)

Sequencing approved: Phase A (this spec) hardens current GitHub + human-confirm contract. Phase B (next spec) adds multi-provider abstraction + policy approvals / auto-merge. User relaxed GitHub-only + mandatory-human-approval constraints for Phase B only — Phase A keeps them.

Zero-spend, PWA-primary, swipe-is-approval, no offline approve-queue. All Phase A work stays in this contract.

## 1. Architecture (Phase A)

Keep current shape: React PWA → FastAPI → GitHub. Phone never holds GitHub token, AI key server-only. Changes are internal, not topological:

- Backend concurrency: `api/app/github.py` moves from blocking `httpx.Client` sequential per-PR fetches to `httpx.AsyncClient` + `asyncio.gather(sem=8)`. Same 60s cache discipline, but cache becomes bounded `TTLCache(maxsize=512, ttl=60)` keyed `(token_hash, qualifier, login)` instead of unbounded process-local dict. `get_current_user` result cached 60s to remove ~100-300ms per-request Supabase Auth tax.
- Quota atomicity: day-rollover + increment moves from 3-round-trip read-modify-write into single Postgres function / `UPDATE … WHERE` upsert. Missing `entitlements` row → upsert free-tier row, never `None['day']` crash.
- Frontend shell: `BrowserRouter` for web PWA, `HashRouter` for `capacitor://`/`file://` native shells (feature-detect). No service-worker offline writes in Phase A — honest read cache + `aria-live` stale labeling only.
- Styling: no Tailwind install — tokenize existing `theme.ts` + CSS vars, delete dead `App.css`, remove global `button`/`input` overrides. Smaller diff, same payoff.
- Phase B seam (no code): extract `GitHubProvider` from current `github.py` so Phase B can add `GitLabProvider` without rewrites. No OAuth/webhook changes in A.

## 2. Components (one job each)

Backend (`api/app/`):
- `github.py` — `gh_raise()` mapper (401→409 reconnect, 403+rate→429 with `Retry-After`, 404→404) + `raise_for_status()` everywhere; paginate `get_pr_files`/`get_check_runs`; async enrich with semaphore.
- `routes/prs.py` — summary wraps diff+Gemini in try→502/504, validates `WHAT:/RISK:/CHECK:` shape, `on_conflict` cache upsert; lists use new enrich.
- `routes/github_connect.py` — verify `GET /user.login == body.login` before storing.
- `routes/webhooks.py` — fail closed when secrets empty at startup; batch `.in_(logins)` lookups + background FCM dispatch.
- `deps.py`/`config.py` — cached auth, clean boot error message.

Frontend (`app/src/`):
- `Inbox.tsx` — debounce query 150ms, Deck key `tab:sort` only, virtualize non-review lists, sticky 44px bulk bar, visible `×` deletes filters, Badge API count + `aria-live`.
- `Deck.tsx` + `PRCard.tsx` — Approve/Changes buttons under stack, roles + focus, `prefers-reduced-motion` guard, cancellable swipe, lazy avatars, size/triage chips.
- `ReviewSheet.tsx` — `role=dialog aria-modal`, focus-trap + Esc + Cancel, labeled textarea, canned replies.
- `PRDetail.tsx` — guard `rest.split('/')`, cap files 20 + Show all, read-only thread bottom-sheet, merge-readiness badge + failed-log excerpt (~15 lines), tappable checklist, shareable `/pr/:owner/:repo/:number` route.
- `App.tsx`/`theme.ts`/`index.css` — router switch, tokenize hex, safe-area insets, `:focus-visible`, delete `App.css`.

Phase A feature cut: thread viewer, merge badge, failed excerpt, chips, checklist, canned replies, deep-link. Deferred: nudge author, quiet hours (A-follow-up); providers, policies, auto-merge (Phase B).

## 3. Data flow

1. Inbox: `GET /api/prs*` → bounded-cache lookup → miss: `search/issues` + async enrich (≤8 concurrent) → 60s cache → slim cards + badge. Tab switches dedupe/cancel in-flight loads.
2. Summary: `GET …/summary?sha=` → atomic entitlement upsert/check → SHA-cache hit? return : fetch diff (12k, hunk boundary), Gemini timeout/retry, validate 3-bullet shape, conflict-target upsert, return. Fail → Retry slot, no quota consumed, single-flight.
3. Review: swipe/buttons → ReviewSheet (human confirm + biometric) → `POST /api/reviews {event, body, idempotencyKey}` claim-first → GitHub → haptic dismiss. Card locks in flight, cancel restores. Bulk = sequential idempotent POSTs behind one biometric gate.
4. Detail: summary/files/checks parallel with abort on unmount; threads read-only; merge gated to approved + clean + human confirm.
5. Push: webhook HMAC-verify (fail closed) → batch lookup → background FCM → deep-link to card or `/pr/…`. Fast return avoids 10s retry/double-push.

## 4. Error handling, edge cases, privacy

- GitHub errors mapped everywhere: 401 → reconnect + wipe token; 403 rate → retry-after + backoff; 404 → card-level not-found; diff 404/401 never cached as AI input. No `KeyError → 500`.
- Quota: missing row → create free-tier; cap → 429 with reset; Gemini fail → 502/504 + Retry; oversize diff → hunk-boundary truncate + partial label.
- Swipe safety: offline → read-only + disabled swipes + banner; double-tap → idempotency + lock; cancel → restore.
- Mobile: no-biometric → device-PIN fallback, never skip confirm; FCM fail → notice, reviews work; malformed `/pr/*` → friendly not-found.
- Privacy unchanged: Vault tokens, never on device/log; diffs truncated, never logged; summaries per-user by SHA 30-day TTL; HMAC fail-closed; revoke wipes 6 tables + `auth.delete_user` + grant revoke; login verified on connect.
- Phase B risk note: auto-merge policies get own threat model (preview + audit log + double-confirm).

## 5. Testing, validation, cost

- Backend pytest: enrich concurrency (mocked), 403→429 + `Retry-After`, files/checks pagination, quota atomicity (concurrent, rollover, missing-row, pro, 429), summary fail → 502/504 + no-quota-consumed, connect-mismatch rejected, webhook fail-closed + batch + fast-return, wipe completeness. Fix boot: dummy-env fallback + `.env.example` so bare `pytest` gives clear skip instead of import `AssertionError`.
- Frontend vitest: Deck→Inbox→POST wiring (bodies, key, offline block, cancel restore), dialog roles + Esc + focus-trap, debounced query without remount, Detail abort + malformed-link guard, badge call. Keep existing 16 green.
- Manual gate: iPhone PWA + Android PWA/APK fresh install → sign-in → approve real PR → delete account; widget/badge stale, light/dark, notch safe-area.
- Cost: $0 delta. Async gather cuts wall-time not call count (same 60s cache); truncation + SHA cache keeps Gemini in free tier; no new infra.

## Phase B preview (next spec, not this cycle)

Provider interface (`providers/`), GitLab OAuth/webhooks/token vault, per-repo approval policies (human-default, opt-in auto-merge when green + approved + checklist), audit log, policy preview UI in Settings. Own data-flow + threat model required before code.
