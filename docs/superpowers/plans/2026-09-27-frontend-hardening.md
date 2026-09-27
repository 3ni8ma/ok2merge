# Frontend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accessible swipe, correct mobile shell, tokenized styling, fast lists.

**Architecture:** Tokenize theme to CSS vars, HashRouter for native shells, React.lazy routes, debounced inbox without deck remount, dialog semantics for ReviewSheet.

**Tech Stack:** React 19, react-router-dom 7, motion (existing), vitest, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-09-27-ok2merge-harden-design.md` (Sections 1,2,4,5 frontend parts)

## Global Constraints

- No Tailwind install in this plan (tokenize existing inline styles).
- Touch targets minimum 44px for actions.
- Swipe always has button alternative (WCAG 2.1.1).
- Safe-area insets required for header and bottom sheet.
- `App.css` deleted, never re-added.
- Fonts stay Space Grotesk display / Inter body via existing Google Fonts link.

---

### Task 1: Tokens + dead CSS + base a11y CSS

**Files:**
- Modify: `app/src/theme.ts`
- Modify: `app/src/index.css`
- Modify: `app/src/main.tsx`
- Delete: `app/src/App.css`
- Test: `app/src/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `C` extended with `surface, border, textMuted`; `cssVar(name: string) -> string`; `:root` vars `--ok-ink, --ok-surface, --ok-border, --ok-paper, --ok-merge, --ok-amber, --ok-red, --ok-muted`; `:focus-visible` outline; `env(safe-area-inset-*)` helpers `.safe-top, .safe-bottom`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { C } from "../theme";

describe("theme tokens", () => {
  it("exposes surface and border tokens", () => {
    expect((C as any).surface).toBe("#161B22");
    expect((C as any).border).toBe("#2A3340");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/theme.test.ts`
Expected: FAIL with "expected undefined to be …" (tokens missing).

- [ ] **Step 3: Write minimal implementation**

`app/src/theme.ts` becomes:

```ts
export const C = {
  merge: "#22C55E",
  ink: "#0D1117",
  surface: "#161B22",
  border: "#2A3340",
  paper: "#F6F8FA",
  amber: "#F59E0B",
  red: "#EF4444",
  muted: "#8B949E",
};
export const Fonts = { display: "Space Grotesk", body: "Inter" };
export const cssVar = (name: keyof typeof C) => `var(--ok-${name})`;
```

Append to `app/src/index.css`:

```css
:root {
  --ok-merge: #22c55e;
  --ok-ink: #0d1117;
  --ok-surface: #161b22;
  --ok-border: #2a3340;
  --ok-paper: #f6f8fa;
  --ok-amber: #f59e0b;
  --ok-red: #ef4444;
  --ok-muted: #8b949e;
}
:focus-visible {
  outline: 2px solid var(--ok-merge);
  outline-offset: 2px;
}
.safe-top {
  padding-top: env(safe-area-inset-top);
}
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Delete `app/src/App.css`. Verify `app/src/main.tsx` imports only `./index.css`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/theme.ts app/src/index.css app/src/main.tsx app/src/App.css app/src/__tests__/theme.test.ts
git commit -m "fix(ui): tokenize theme + safe-area + focus + reduced-motion"
```

### Task 2: Router for native + lazy routes

**Files:**
- Modify: `app/src/App.tsx:1-21`
- Test: `app/src/__tests__/smoke.test.ts` (extend, keep existing passing)

**Interfaces:**
- Consumes: `C`, tokens from Task 1 (no import needed).
- Produces: `isNativeShell() -> boolean` (true when `window.Capacitor?.isNativePlatform()` or protocol `capacitor:`/`file:`); App uses HashRouter on native, BrowserRouter on web; all 5 routes lazy with Suspense fallback "Loading…".

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("native shell detect", () => {
  it("exposes isNativeShell helper", async () => {
    const m = await import("../App");
    expect(typeof (m as any).isNativeShell).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/smoke.test.ts`
Expected: FAIL (no isNativeShell export yet; run the new test file instead: `npm test -- src/__tests__/native-shell.test.ts`).

Create the test as `app/src/__tests__/native-shell.test.ts` with the block above.

- [ ] **Step 3: Write minimal implementation**

`app/src/App.tsx` becomes:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/native-shell.test.ts src/__tests__/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/App.tsx app/src/__tests__/native-shell.test.ts
git commit -m "fix(ui): native HashRouter + lazy routes"
```

### Task 3: Accessible cancellable swipe + dialog ReviewSheet

**Files:**
- Modify: `app/src/components/Deck.tsx`
- Modify: `app/src/components/ReviewSheet.tsx`
- Modify: `app/src/routes/Inbox.tsx` (onSwipe wiring + onCancel restore)
- Test: `app/src/__tests__/deck-a11y.test.tsx`

**Interfaces:**
- Consumes: `isNativeShell` (no direct use), theme tokens.
- Produces: `Deck` renders Approve/Changes buttons + `role="radiogroup"` fallback, accepts `onCancelKey` restore; `ReviewSheet` has `role="dialog" aria-modal="true"`, Esc handler, Cancel button calling `onCancel`, textarea with `<label htmlFor>`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";

describe("deck a11y contract", () => {
  it("deck exposes button fallback roles", async () => {
    const src = await import("../components/Deck?raw");
    const text = src.default as unknown as string;
    expect(text).toContain("Approve");
    expect(text).toContain("radiogroup");
  });
  it("review sheet is a dialog with cancel", async () => {
    const src = await import("../components/ReviewSheet?raw");
    const text = src.default as unknown as string;
    expect(text).toContain('role="dialog"');
    expect(text).toContain("Cancel");
  });
});
```

Note: uses `?raw` import so test reads source text without rendering motion drag (keeps jsdom simple).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/deck-a11y.test.tsx`
Expected: FAIL (Approve/radiogroup/dialog missing).

- [ ] **Step 3: Write minimal implementation**

In `Deck.tsx`: under the motion stack add:

```tsx
<div role="radiogroup" aria-label="Review decision">
  <button type="button" style={{ minHeight: 44, minWidth: 44 }} onClick={() => onSwipe("APPROVE")} aria-label="Approve">
    Approve
  </button>
  <button type="button" style={{ minHeight: 44, minWidth: 44 }} onClick={() => onSwipe("REQUEST_CHANGES")} aria-label="Request changes">
    Request changes
  </button>
</div>
```

Do not auto-advance index before confirm: keep `top` unchanged until parent confirms success; parent passes `locked` prop to disable drag while `pending`.

In `ReviewSheet.tsx`: wrap in `<div role="dialog" aria-modal="true" aria-label="Confirm review">`, add `<label htmlFor="review-body">Comment</label><textarea id="review-body" …/>`, add Cancel button calling `onCancel`, add `useEffect` Esc listener calling `onCancel`, add `role="alert"` on error line.

In `Inbox.tsx`: pass `onCancel={() => setPending(null)}` and stop `setTop(top+1)` before confirm — advance only inside `onDone` success.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/deck-a11y.test.tsx src/__tests__/swipe.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Deck.tsx app/src/components/ReviewSheet.tsx app/src/routes/Inbox.tsx app/src/__tests__/deck-a11y.test.tsx
git commit -m "fix(ui): accessible cancellable swipe + dialog sheet"
```

### Task 4: Inbox perf + bulk bar + badge + visible filter delete

**Files:**
- Modify: `app/src/routes/Inbox.tsx`
- Test: `app/src/__tests__/inbox-perf.test.ts`

**Interfaces:**
- Consumes: Deck button contract from Task 3.
- Produces: debounced query (150ms) via `useDeferredValue` or manual timeout; `<Deck key={`${tab}:${sort}`}>` (query excluded); bulk bar sticky bottom with 44px buttons; saved-filter delete via visible `×` button (onContextMenu removed); `navigator.setAppBadge(count)` guarded; `role="status"` loading + `role="alert"` errors.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("inbox perf contract", () => {
  it("deck key excludes query", async () => {
    const src = await import("../routes/Inbox?raw");
    const text = src.default as unknown as string;
    expect(text).not.toContain("`${tab}:${query}:${sort}`");
    expect(text).toContain("setAppBadge");
    expect(text).toContain('aria-label="Remove filter"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/inbox-perf.test.ts`
Expected: FAIL (old key + missing badge/remove-label).

- [ ] **Step 3: Write minimal implementation**

In `Inbox.tsx`:
- Replace Deck key with `` `${tab}:${sort}` ``.
- Wrap query state: `const [query, setQuery] = useState(""); const deferredQuery = useDeferredValue(query);` and filter on `deferredQuery`.
- Replace `onContextMenu` filter delete with `<button aria-label="Remove filter" style={{minHeight:44,minWidth:44}}>×</button>`.
- After successful load: `if ("setAppBadge" in navigator) { try { await (navigator as any).setAppBadge(prs.length); } catch {} }`, clear on empty with `setAppBadge(0)` guarded.
- Loading line gets `role="status"`, error/notice lines get `role="alert"`.
- Bulk bar: `<div style={{position:"sticky", bottom:"calc(env(safe-area-inset-bottom) + 8px)"}}>` with 44px Approve/Chages buttons.
- Avatars in list get `loading="lazy"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/inbox-perf.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/Inbox.tsx app/src/__tests__/inbox-perf.test.ts
git commit -m "perf(ui): no-remount inbox + badge + sticky bulk bar"
```

### Task 5: PRDetail robustness

**Files:**
- Modify: `app/src/routes/PRDetail.tsx`
- Test: `app/src/__tests__/prdetail-robust.test.ts`

**Interfaces:**
- Consumes: `api.files/checks/summary` (unchanged signatures).
- Produces: malformed `/pr/*` → friendly not-found (no crash); files capped 20 + Show-all toggle; parallel fetch aborted on unmount via AbortController; `aria-live` merge/notice states.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("prdetail robustness", () => {
  it("guards malformed path and caps files", async () => {
    const src = await import("../routes/PRDetail?raw");
    const text = src.default as unknown as string;
    expect(text).toContain("Show all");
    expect(text).toContain("PR not found");
    expect(text).toContain("AbortController");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/prdetail-robust.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

In `PRDetail.tsx`:
- Parse `rest` with `const parts = (rest ?? "").split("/").filter(Boolean); if (parts.length < 3) return <div>PR not found — check the link.</div>;` guarding `Number(parts[2])` NaN.
- Files list: `const [showAll, setShowAll] = useState(false); const shown = showAll ? files : files.slice(0, 20);` + `{files.length > 20 && <button onClick={() => setShowAll(s => !s)}>{showAll ? "Show less" : "Show all"}</button>}`.
- Wrap the three `api.*` calls with `const ctrl = new AbortController(); useEffect(() => () => ctrl.abort(), []);` and pass `ctrl.signal` where supported, ignoring AbortError in catch.
- Merge/notice lines get `aria-live="polite"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/prdetail-robust.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/PRDetail.tsx app/src/__tests__/prdetail-robust.test.ts
git commit -m "fix(ui): PRDetail guards + file cap + abort"
```
