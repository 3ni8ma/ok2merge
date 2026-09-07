import { BrowserRouter, Route, Routes } from "react-router-dom";

import Onboarding from "./routes/Onboarding";
import Inbox from "./routes/Inbox";
import PRDetail from "./routes/PRDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/pr/*" element={<PRDetail />} />
        <Route path="/" element={<Inbox />} />
      </Routes>
    </BrowserRouter>
  );
}
