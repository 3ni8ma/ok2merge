# OK2Merge

Mobile PR inbox: swipe to approve, biometric to merge. Spec: `docs/superpowers/specs/2026-09-07-pr-swipe-design.md`.

## Shipped (free-first, $0 spent)
- PWA: https://ok2merge.vercel.app (Vercel, auto-deploys from `main`)
- API: https://ok2merge-api.onrender.com (Render free tier, auto-deploys from `main`)
- APK: signed beta attached to [GitHub Release v1.0-beta](https://github.com/3ni8ma/ok2merge/releases/tag/v1.0-beta)
- Auth: GitHub OAuth App → Supabase (provider + manual linking on; Site URL + `https://ok2merge.vercel.app/**` + `ok2merge://**` allowlisted)

## External accounts (deferred to revenue unless checked)
- [ ] Apple Developer Program ($99/yr) — store return only
- [ ] Google Play Console ($25 one-time) — store return only (sideload APK instead)
- [x] Supabase project (ok2merge — live, schema + Vault helpers applied)
- [x] GitHub OAuth App (OK2Merge, `repo` scope; provider enabled, manual linking on)
- [ ] RevenueCat project — deferred (web payments at revenue time, not IAP)
- [x] Android SDK cmdline tools (free — local APK builds verified)
- [ ] Firebase project with FCM enabled (free; needed before push delivers)
- [x] Free static host (Vercel) + free backend host (Render free tier)
