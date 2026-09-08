import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Last-resort watchdog: if React never paints (crash before first render),
// show the actual error instead of a blank screen.
const failures: string[] = [];
window.addEventListener('error', (e) => {
  failures.push(String(e.message || e.error || 'unknown error'));
});
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML =
      '<div style="padding:24px;font-family:sans-serif">' +
      '<h2>OK2Merge failed to start</h2>' +
      '<p>' + (failures.length ? failures.join('<br>') : 'No error captured — the bundle may not have loaded.') + '</p>' +
      '<p>Please screenshot this and send it to support.</p></div>';
  }
}, 4000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
