# OK2Merge — Design Spec (2026-09-07, rev 4: Capacitor)

Native App Store + Google Play app for mobile-first PR review: swipe to approve, biometric confirm to merge. GitHub-only v1, free beta on TestFlight + Play internal testing, paid via in-app purchase at public launch. Both stores ship from the same Capacitor web codebase at 1.0.

## 1. MVP scope

In:
- Capacitor + React + Vite + Tailwind (your web stack): one web codebase → iOS + Android native shells, plus a free PWA preview URL. Native powers (biometrics, push, Apple sign-in, haptics, IAP) via Capacitor plugins.
- PR inbox: only PRs where the user is a requested reviewer
- Per-PR card: title, repo, author, CI status, AI 3-bullet summary (changed / risk / what to check)
- Gestures: right = approve, left = request changes, up = voice comment (OS dictation keyboard v1, no custom STT)
- Biometric confirm for approve + merge (FaceID on iOS, Biometric Prompt on Android)
- Push on both platforms via FCM (Firebase Admin covers iOS + Android): review-requested, CI failed, mentions; tap deep-links into the PR card
- Home-screen widget (glanceable v1: review count, oldest waiting PR, CI-fail badge; tap deep-links into the inbox)
- Sign in with Apple + Connect-GitHub (two-step; Apple Guideline 4.8 requires Apple login wherever GitHub login is offered). iOS uses the native Apple button; Android uses the Supabase Apple-OAuth web flow — same linked account either way.
- In-app account deletion (required by Apple 5.1.1 and Google Play policy alike)
- Paywall screen wired to StoreKit + Play Billing via RevenueCat from day one, dormant during free beta (Apple ~15% under Small Business; Google 15% at this volume; no Stripe for digital subscriptions inside the app)

Out (explicit non-goals for v1):
- No rebase, conflict resolution, file editing on phone
- No GitLab/Bitbucket, no org analytics dashboard
- No auto-merge rules, no team billing backend (DB carries `org_id` placeholder only)
- No approve-from-widget actions in v1 (widget is read-only; approvals stay in-app behind biometrics — interactive widgets graduate to v2)
- AI is summary-only; it never approves. The swipe is the approval.

Ship order: local web dev (`vite dev`, instant PWA preview link) → `npx cap sync` + on-device runs via Xcode/Android Studio → TestFlight internal + Play internal testing (dogfood both) → TestFlight public beta + Play closed testing (free, no IAP) → 1.0 submitted to both stores together with IAP enabled.

Success: a simple PR can be cleared in under 2 minutes from a phone, no laptop; beta clears real PRs for 10 teams on both platforms before 1.0.

## 2. Architecture + components

- Mobile: React + Vite + Tailwind web app in Capacitor shells. Native via plugins: `@capawesome/capacitor-apple-sign-in` (all platforms), `@aparajita/capacitor-biometric-auth` (FaceID/Biometric + device-PIN fallback), `@capacitor/push-notifications` (APNs + FCM), `@capacitor/haptics`, `@capacitor/browser` + `App` (OAuth deep-links), `@revenuecat/purchases-capacitor` (paywall dormant in beta).
- Backend: Supabase (Apple + GitHub auth linking, Postgres: users / github_tokens / push_tokens / summary_cache / entitlements) + 1 tiny API (FastAPI on Render/Vercel, AuraFinance pattern) proxying GitHub + AI + verifying RevenueCat webhooks (one webhook handles both stores)
- GitHub access: OAuth App with `repo` scope for v1 (acts as the user; migrate to GitHub App later for org installs). GitHub token is linked to the Apple-signed-in app account, never on device (Supabase Vault).
- Build/release: Capacitor (`capacitor.config.ts` `appId` + app name fixed early and never renamed; `npx cap sync` then archive in Xcode / bundle in Android Studio; fastlane optional later), TestFlight + Play internal/closed tracks for all pre-release distribution, Play uploads via service-account key, `google-services.json` + `GoogleService-Info.plist` for FCM, `PrivacyInfo.xcprivacy` for the plugins that need it
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

1. Sign-in (two-step, both platforms): app → Sign in with Apple (native sheet on iOS, Supabase-hosted web flow on Android) → Supabase app account → "Connect GitHub" (GitHub OAuth) → backend stores encrypted GitHub token linked to the Apple user, issues session.
2. Inbox: app `GET /api/prs` → backend GitHub search `is:pr is:open review-requested:@me`, 60s cache, slim cards.
3. Summary: app `GET /api/prs/:id/summary` → entitlement check (beta = unlimited, 1.0 free tier = capped/day, pro = unlimited) → cache lookup by head SHA → on miss fetch diff (`Accept: application/vnd.github.diff`), truncate ~12k chars, AI returns exactly 3 bullets, cache, return. New SHA = new summary.
4. Review: swipe → confirm pill → biometric → `POST /api/reviews {event, body}` with client idempotency key → backend allowlists APPROVE / REQUEST_CHANGES / COMMENT → GitHub reviews API → haptic dismiss. Posted = posted; no fake undo after the network call.
5. Push: GitHub webhook → HMAC verify → FCM via Firebase Admin (covers Android + iOS) → tap deep-links into the inbox.
6. Purchase (1.0 only): StoreKit / Play Billing purchase → RevenueCat → webhook to backend → `entitlements` row upsert → summary quota lifts. Refunds/cancellations flow from the stores; backend treats RevenueCat as source of truth.
7. Delete account: `DELETE /api/account` → revoke GitHub grant → wipe token, push tokens, cache, entitlements → confirm. Required by both stores; must work fully in-app.

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
- Store review risks and mitigations: Apple sign-in present (4.8); in-app account deletion (Apple 5.1.1 + Play policy); no placeholder/lorem content at submission — beta builds stay in TestFlight/closed tracks, only real functionality ships to review; minimum functionality covered by full approve/request/comment/merge-confirm flow, not a web wrapper; sign-in-gated app gets a demo account + review-notes video for both reviewers; rejection recovery = fix, rebuild, resubmit, no architecture change needed.

## 5. Testing, validation, money

- Mobile: unit tests for swipe→event + idempotency; browser preview plus real-device verification on iOS + Android (gestures/haptics, Apple sign-in on all surfaces, push via FCM, paywall sandbox on both stores).
- Backend: pytest for proxy, webhook HMACs (GitHub + RevenueCat), cache hit/miss, allowlist rejection, entitlement gating, account-wipe completeness.
- AI: 10 golden diffs, re-run on prompt change; log cost/summary.
- Security: no-token-in-logs test, revoke-wipes test.
- Store readiness gate before 1.0 submission: on a clean iPhone and a clean Android device — fresh install → Apple sign-in → connect GitHub → approve a real PR → delete account, all via store-track builds.
- Validation: dogfood own repos + 30s demo clip; public TestFlight beta + Play closed testing with 10 indie teams/OSS clubs free; win = median time-to-first-review drops and >30% of reviews on phone; kill rule: <30% on-phone after 2 weeks → pivot to read-only triage.
- Money (1.0): single Pro tier via IAP on both stores (~$8/mo, USD tiers) for unlimited summaries + priority push + audit log; free tier keeps capped summaries. ~15% store fees priced in. MVP cost ≈ fractions of a cent per PR via cache + truncation. Needs before launch: Apple Developer Program ($99/yr) for TestFlight external/App Store, Google Play Console ($25 one-time) + merchant/Payments profile for Play Billing, Firebase project with FCM enabled + service-account key for the backend.

## 6. Home-screen widget (v1: glanceable, read-only)

- iOS WidgetKit small/medium + Android home-screen widget on the same snapshot model. Read-only in v1: counts and badges only, no approve buttons — actions stay behind the in-app biometric gate; interactive widgets graduate to v2.
- New pieces: `WidgetExtension` (native widget targets added to the Xcode/Gradle projects — `@capacitor/preferences` groups are NOT App Groups suites, so the snapshot crosses via a tiny custom plugin writing the App Groups suite on iOS / a named prefs file on Android) + snapshot writer in the web app.
- Flow: every inbox fetch and every review push writes `{count, oldestAge, ciFails, updatedAt}` to the shared store; the widget timeline renders from that snapshot; taps deep-link into the inbox.
- Honesty: the widget always shows "updated Xm ago" and a distinct stale state past N minutes — it never implies live data, and nothing fires from it.
- Test: on-device light/dark, both sizes, stale rendering, tap-through; snapshot writes covered by unit tests.
