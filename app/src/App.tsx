import { BrowserRouter, Route, Routes } from "react-router-dom";

import Onboarding from "./routes/Onboarding";
import { C } from "./theme";

function InboxPlaceholder() {
  return (
    <div style={{ background: C.ink, color: C.paper, minHeight: "100dvh", padding: 24 }}>
      Inbox lands in Task 12.
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<InboxPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}
