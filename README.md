# OK2Merge

Mobile PR inbox: swipe to approve, biometric to merge. Spec: `docs/superpowers/specs/2026-09-07-pr-swipe-design.md`.

## External accounts (human checklist — cannot be automated)
- [ ] Apple Developer Program ($99/yr) — TestFlight + App Store
- [ ] Google Play Console ($25 one-time) + Payments merchant profile
- [ ] Supabase project (record URL + anon key + service-role key)
- [ ] GitHub OAuth App (scopes: `repo`; callback = Supabase auth callback URL)
- [ ] RevenueCat project (Apple + Google apps, shared webhook secret)
- [ ] Xcode + Android Studio (builds run locally; no cloud-build service in v1)
- [ ] Firebase project with FCM enabled: `google-services.json`, `GoogleService-Info.plist`, backend service-account JSON
- [ ] Apple Service ID for Sign in with Apple on Android/web (Client ID for `VITE_APPLE_SERVICE_ID`)
