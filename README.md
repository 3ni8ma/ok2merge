# OK2Merge

Mobile PR inbox: swipe to approve, biometric to merge. Spec: `docs/superpowers/specs/2026-09-07-pr-swipe-design.md`.

## External accounts (human checklist — cannot be automated)
- [ ] Apple Developer Program ($99/yr) — TestFlight + App Store
- [ ] Google Play Console ($25 one-time) + Payments merchant profile
- [x] Supabase project (ok2merge — live, schema + Vault helpers applied)
- [x] GitHub OAuth App (OK2Merge, `repo` scope; callback = Supabase; provider enabled, manual linking on)
- [ ] RevenueCat project (Apple + Google apps, shared webhook secret)
- [ ] Xcode + Android SDK (this machine has neither — native compile/device runs pending)
- [ ] Firebase project with FCM enabled: `google-services.json`, `GoogleService-Info.plist`, backend service-account JSON
- [ ] Apple Service ID for Sign in with Apple on Android/web (Client ID for `VITE_APPLE_SERVICE_ID`)
