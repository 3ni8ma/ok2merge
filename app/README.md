# OK2Merge app

Capacitor 8.5.1 + React + Vite + Tailwind. Native shells in `ios/` + `android/`
(committed). `appId: app.ok2merge.dev` — never rename.

Env (see `.env.example`, never commit real values):
- `VITE_SUPABASE_URL`, `VITE_ANON_KEY`
- `VITE_API_URL` (FastAPI backend)
- `VITE_APPLE_SERVICE_ID` (Sign in with Apple on Android/web)
- `VITE_PRO_LIVE=false` until 1.0
