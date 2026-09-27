import { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";

const Onboarding = lazy(() => import("./routes/Onboarding"));
const Inbox = lazy(() => import("./routes/Inbox"));
const PRDetail = lazy(() => import("./routes/PRDetail"));
const Settings = lazy(() => import("./routes/Settings"));
const Paywall = lazy(() => import("./routes/Paywall"));

export function isNativeShell(): boolean {
  const proto = window.location?.protocol ?? "";
  if (proto === "capacitor:" || proto === "file:") return true;
  const cap = (window as any)?.Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export default function App() {
  const Router: any = isNativeShell() ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Suspense fallback={<div>Loading…</div>}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/pr/*" element={<PRDetail />} />
          <Route path="/" element={<Inbox />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
