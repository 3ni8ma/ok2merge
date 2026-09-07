import { BrowserRouter, Route, Routes } from "react-router-dom";

import Onboarding from "./routes/Onboarding";
import Inbox from "./routes/Inbox";
import PRDetail from "./routes/PRDetail";
import Settings from "./routes/Settings";
import Paywall from "./routes/Paywall";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route path="/pr/*" element={<PRDetail />} />
        <Route path="/" element={<Inbox />} />
      </Routes>
    </BrowserRouter>
  );
}
