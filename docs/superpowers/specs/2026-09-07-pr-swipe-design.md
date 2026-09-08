# OK2Merge — Design Spec (2026-09-07, rev 5: free-first)

Zero-spend app for mobile-first PR review: swipe to approve, human-confirmed merge. PWA primary (iOS via Safari install, Android via Chrome) + Android sideload APK from GitHub Releases. GitHub-only v1, free beta, paid later via web payments. App Store + Play listings deferred until revenue pays the ~$125 first year.

## 1. MVP scope

In:
- Capacitor + React + Vite + Tailwind (your web stack): one web codebase → PWA (primary distribution, $0) + Android sideload APK from GitHub Releases. Native powers (biometrics, push, haptics) via Capacitor plugins; store shells stay buildable for later.
- PR inbox: only PRs where the user is a requested reviewer
- Per-PR card: title, repo, author, CI status, AI 3-bullet summary (changed / risk / what to check)
- Gestures: right = approve, left = request changes, up = voice comment (OS dictation keyboard v1, no custom STT)
- Human confirm for approve + merge: FaceID/Biometric in native shells, WebAuthn platform authenticator (or device PIN) in the PWA — approvals never fire without an explicit human gesture
- Push on both platforms via FCM (Firebase Admin covers iOS + Android): review-requested, CI failed, mentions; tap deep-links into the PR card
- Home-screen widget, Android APK only (glanceable v1: review count, oldest waiting PR, CI-fail badge; tap deep-links into the inbox). No widget on PWA (platform limit) or iOS (deferred with the native app).
- GitHub-only sign-in (single step — no Apple login outside the App Store, where it isn't required). Apple sign-in returns if/when the App Store ships.
- In-app account deletion (required by Apple 5.1.1 and Google Play policy alike)
- Pro tier designed now, collected later via web payments (Razorpay/Stripe link — no IAP without stores, no store fees). Entitlements already enforced backend-side, so billing plugs in without rewrites.

Out (explicit non-goals for v1):
- No rebase, conflict resolution, file editing on phone
- No GitLab/Bitbucket, no org analytics dashboard
- No auto-merge rules, no team billing backend (DB carries `org_id` placeholder only)
- No approve-from-widget actions in v1 (widget is read-only; approvals stay in-app behind biometrics — interactive widgets graduate to v2)
- AI is summary-only; it never approves. The swipe is the approval.

Ship order: local web dev (`vite dev`) → PWA preview link (dogfood + beta, $0) → Android APK via `cap sync` + Gradle, attached to GitHub Releases → stores + IAP only when revenue pays for them.

Success: a simple PR can be cleared in under 2 minutes from a phone, no laptop; beta clears real PRs for 10 teams on both platforms before 1.0.

## 2. Architecture + components

- Mobile: React + Vite + Tailwind web app (PWA first, Capacitor shells for APK/store later). Native via plugins: `@aparajita/capacitor-biometric-auth` (FaceID/Biometric + device-PIN fallback; WebAuthn in PWA), `@capacitor/push-notifications` (FCM incl. web push), `@capacitor/haptics`, `@capacitor/browser` + `App` (OAuth deep-links). Apple sign-in + RevenueCat stay installed-but-dormant for the store return.
- Backend: Supabase (GitHub auth, Postgres: users / github_tokens / push_tokens / summary_cache / entitlements) + 1 tiny API (FastAPI on Render free tier / Oracle Always Free, $0) proxying GitHub + AI
- GitHub access: OAuth App with `repo` scope for v1 (acts as the user; migrate to GitHub App later for org installs). GitHub token lives in Supabase Vault, never on device.
- Build/release ($0): PWA via `vite build` on free static hosting; Android APK via `npx cap sync` + Gradle (SDK is free) attached to GitHub Releases; `google-services.json` for FCM. Store archives (Xcode/Play) only when revenue funds them.
- Boundary: phone → our API → GitHub. Phone never holds a GitHub token; AI key never ships in the app.

Components (one job each):
- `InboxScreen`: swipe deck of PRs needing review
- `PRCard`: title/author/CI dot/summary, tap for read-only files-changed
- `VoiceCommentSheet`: OS dictation → review comment
- `OnboardingFlow`: Apple sign-in (native button iOS / web flow Android) → connect GitHub → enable push → done (must be completable in <2 min or reviewers bounce)
- `PaywallScreen`: RevenueCat offering, StoreKit on iOS / Play Billing on Android (dormant/free-beta mode until 1.0)
- `SettingsScreen`: repos filter, biometric toggle, disconnect GitHub, delete account
- API: `GET /api/prs`, `GET /api/prs/:id/summary` (cached by head SHA, entitlement-checked), `POST /api/reviews`, `POST /webhooks/github`, `POST /webhooks/revenuecat`, `POST /api/push/register`, `DELETE /api/account`

## 3. Data flow

1. Sign-in (single step): app → Sign in with GitHub (Supabase GitHub provider, `repo` scope) → backend stores the provider token in Vault, issues session.
2. Inbox: app `GET /api/prs` → backend GitHub search `is:pr is:open review-requested:@me`, 60s cache, slim cards.
3. Summary: app `GET /api/prs/:id/summary` → entitlement check (beta = unlimited, 1.0 free tier = capped/day, pro = unlimited) → cache lookup by head SHA → on miss fetch diff (`Accept: application/vnd.github.diff`), truncate ~12k chars, AI returns exactly 3 bullets, cache, return. New SHA = new summary.
4. Review: swipe → confirm pill → biometric → `POST /api/reviews {event, body}` with client idempotency key → backend allowlists APPROVE / REQUEST_CHANGES / COMMENT → GitHub reviews API → haptic dismiss. Posted = posted; no fake undo after the network call.
5. Push: GitHub webhook → HMAC verify → FCM via Firebase Admin (covers Android + iOS) → tap deep-links into the inbox.
6. Purchase (post-revenue only): web checkout (Razorpay/Stripe link) → backend webhook → `entitlements` row upsert → summary quota lifts. No store fees, no RevenueCat until/unless stores ship.
7. Delete account: `DELETE /api/account` → revoke GitHub grant → wipe token, push tokens, cache, entitlements → confirm. Fully in-app (also satisfies both stores' rules on the day we submit).

## 4. Error handling, edge cases, privacy, review risk

- Token dead/revoked → wipe stored token, force "reconnect GitHub".
- Oversize diff → truncate + label "partial summary (first N files)".
- AI fail → PR stays reviewable, summary slot shows Retry.
- Offline → cached inbox read-only, swipes disabled with banner (no queued phantom approvals in v1).
- Double-tap → idempotency key + card locked in flight.
- Throttled (GitHub 403 / AI 429) → friendly retry-after + server backoff.
- Android-specific: biometric unavailable (no hardware/enrolled) → fall back to device PIN via local-authentication, never silently skip the confirm step; FCM registration failure → push features degrade with a "notifications unavailable" notice, reviews still work.
- Privacy: tokens encrypted at rest, never on device, `repo` scope only; diffs truncated, never logged; summaries cached per-user by SHA, 30-day TTL; webhook HMAC; revoke wipes everything. Store declarations: Apple privacy nutrition labels + `PrivacyInfo.xcprivacy` manifest, and the Google Play Data Safety form — both state the same facts: no tracking (no ATT prompt needed), data linked to user (GitHub token, identifiers), purpose stated.
- Burn cap: ~50 summaries/user/day in beta; free-tier cap enforced by entitlement check at 1.0.
- Launch risks (no store review in v1, so the bar is self-imposed): no placeholder/lorem content in beta; PWA install prompt tested on iOS Safari + Android Chrome; sign-in-gated app gets a demo account for beta testers; the day stores return, the packet is ready (SIWA, privacy labels + manifest, Data Safety, reviewer video).

## 5. Testing, validation, money

- Mobile: unit tests for swipe→event + idempotency; browser preview plus real-device verification on iOS + Android (gestures/haptics, Apple sign-in on all surfaces, push via FCM, paywall sandbox on both stores).
- Backend: pytest for proxy, webhook HMACs (GitHub + RevenueCat), cache hit/miss, allowlist rejection, entitlement gating, account-wipe completeness.
- AI: 10 golden diffs, re-run on prompt change; log cost/summary.
- Security: no-token-in-logs test, revoke-wipes test.
- Readiness gate before public beta: on an iPhone (PWA installed) and an Android (PWA + sideload APK) — fresh install → GitHub sign-in → approve a real PR → delete account, all green.
- Validation: dogfood own repos + 30s demo clip; PWA link + sideload APK to 10 indie teams/OSS clubs free; win = median time-to-first-review drops and >30% of reviews on phone; kill rule: <30% on-phone after 2 weeks → pivot to read-only triage.
- Money: $0/month until revenue. Single Pro tier later (~$8/mo) for unlimited summaries + priority push + audit log; free tier keeps capped summaries. Running cost ≈ fractions of a cent per PR (cache + truncation, inside Gemini free tier). First store year (~$125: Apple + Play + domain) comes out of revenue, not savings. Needs (all free): Firebase project with FCM enabled + service-account key for the backend; free static host + free Render/Oracle backend.

## 6. Home-screen widget (Android APK only; glanceable, read-only)

- Android home-screen widget on the snapshot model (the sideload APK keeps it; PWA can't do widgets, iOS waits for the native app). Read-only in v1: counts and badges only, no approve buttons — actions stay behind the human-confirm gate; interactive widgets graduate to v2.
- New pieces: `WidgetExtension` (native widget target in the Gradle project — the snapshot crosses via a tiny custom plugin writing a named prefs file) + snapshot writer in the web app. (iOS App Groups variant stays specified in the plan for the store return.)
- Flow: every inbox fetch and every review push writes `{count, oldestAge, ciFails, updatedAt}` to the shared store; the widget timeline renders from that snapshot; taps deep-link into the inbox.
- Honesty: the widget always shows "updated Xm ago" and a distinct stale state past N minutes — it never implies live data, and nothing fires from it.
- Test: on-device light/dark, both sizes, stale rendering, tap-through; snapshot writes covered by unit tests.
