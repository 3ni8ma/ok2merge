# Triage Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trustworthy swipes via threads, merge badge, failed-run context, size chips, checklist, canned replies, deep-links.

**Architecture:** Read-only thread viewer over existing repo scope; merge badge from existing mergeable_state; failed runs from existing checks API; size/checklist derived client-side from AI summary; canned replies as ReviewSheet presets; shareable /pr/:owner/:repo/:number route parsing.

**Tech Stack:** React 19, FastAPI (one new comments endpoint), existing GitHub repo scope, vitest + pytest.

**Spec:** `docs/superpowers/specs/2026-09-27-ok2merge-harden-design.md` (Section 2 feature cut)

## Global Constraints

- AI is summary-only; swipe is the approval (Phase A).
- No rebase/conflict resolution, no comment posting from thread viewer (read-only).
- Threads viewer uses existing `repo` scope, truncated lists, never logs diffs.
- Deep-links validate `owner/repo/number` shape, friendly not-found otherwise.
- All new UI keeps 44px targets, dialog semantics, safe-area.

---

### Task 1: Read-only thread viewer (backend + sheet)

**Files:**
- Create: `api/app/routes/comments.py` — actually add to existing `api/app/routes/prs.py` as `GET /api/prs/{owner}/{repo}/{n}/comments`
- Modify: `api/app/github.py` — add `get_pr_comments(token, owner_repo, n, per_page=30)`
- Modify: `app/src/routes/PRDetail.tsx` — add ThreadSheet bottom-sheet
- Test: `api/tests/test_comments.py`, `app/src/__tests__/threads.test.ts`

**Interfaces:**
- Consumes: `gh_raise` + `gh(token)` client pattern.
- Produces: `get_pr_comments(token, owner_repo, n) -> [{id, user, avatar, body(≤500 chars), created_at}]`; `GET …/comments -> {comments: [...]}`; `ThreadSheet({open, onClose, comments})` with `role="dialog"`.

- [ ] **Step 1: Write the failing test (backend)**

```python
def test_comments_endpoint_exists():
    from api.app.routes import prs
    routes = [r.path for r in prs.router.routes]
    assert "/api/prs/{owner}/{repo}/{n}/comments" in routes
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_comments.py -v`
Expected: FAIL (route missing).

- [ ] **Step 3: Write minimal implementation**

In `api/app/github.py`:

```python
def get_pr_comments(token: str, owner_repo: str, n: int, per_page: int = 30) -> list:
    with gh(token) as c:
        r = c.get(f"/repos/{owner_repo}/issues/{n}/comments", params={"per_page": per_page})
        gh_raise(r, "comments")
        return [
            {
                "id": m["id"],
                "user": m["user"]["login"],
                "avatar": m["user"].get("avatar_url"),
                "body": (m.get("body") or "")[:500],
                "created_at": m.get("created_at"),
            }
            for m in r.json()
        ]
```

In `api/app/routes/prs.py`:

```python
@router.get("/api/prs/{owner}/{repo}/{n}/comments")
def comments(owner: str, repo: str, n: int, user_id: str = Depends(get_current_user)):
    token = _authed_token(user_id)
    return {"comments": get_pr_comments(token, f"{owner}/{repo}", n)}
```

Frontend `ThreadSheet` in `PRDetail.tsx`: button "View comments (N)" opens fixed bottom sheet with `role="dialog" aria-modal`, list, Close button + Esc, safe-bottom padding.

Add frontend test asserting `role="dialog"` + "View comments" strings exist via `?raw` import (same pattern as frontend-hardening plan Task 3).

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_comments.py -v`
Run: `npm test -- src/__tests__/threads.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/github.py api/app/routes/prs.py api/tests/test_comments.py app/src/routes/PRDetail.tsx app/src/__tests__/threads.test.ts
git commit -m "feat(triage): read-only thread viewer"
```

### Task 2: Merge badge + failed-run excerpt + size chips

**Files:**
- Modify: `app/src/components/PRCard.tsx`
- Modify: `app/src/lib/prDisplay.ts`
- Test: `app/src/__tests__/badges.test.ts`

**Interfaces:**
- Consumes: PR dict fields already in enrich output (`mergeable_state, draft, state, additions, deletions, labels`).
- Produces: `mergeBadge(pr) -> "ready" | "blocked" | "draft" | "unknown"`; `sizeChip(additions+deletions) -> "XS"|"S"|"M"|"L"|"XL"`; `PRCard` shows badge + failed-run names (props `runs: [{name, conclusion}]`) + chips with text labels (never color-only).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mergeBadge, sizeChip } from "../lib/prDisplay";

describe("badges", () => {
  it("maps mergeable_state to badge", () => {
    expect(mergeBadge({ mergeable_state: "clean", draft: false } as any)).toBe("ready");
    expect(mergeBadge({ mergeable_state: "dirty", draft: false } as any)).toBe("blocked");
    expect(mergeBadge({ draft: true } as any)).toBe("draft");
  });
  it("sizes by lines changed", () => {
    expect(sizeChip(10)).toBe("XS");
    expect(sizeChip(5000)).toBe("XL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/badges.test.ts`
Expected: FAIL (functions missing).

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/prDisplay.ts` append:

```ts
export function mergeBadge(pr: { mergeable_state?: string | null; draft?: boolean }): string {
  if (pr.draft) return "draft";
  if (pr.mergeable_state === "clean") return "ready";
  if (pr.mergeable_state === "dirty" || pr.mergeable_state === "blocked") return "blocked";
  return "unknown";
}

export function sizeChip(total: number): string {
  if (total < 50) return "XS";
  if (total < 200) return "S";
  if (total < 600) return "M";
  if (total < 2000) return "L";
  return "XL";
}
```

In `PRCard.tsx`: render `<span aria-label={`Merge status ${badge}`}>{badge === "ready" ? "✓ Ready" : badge === "blocked" ? "✕ Blocked" : badge === "draft" ? "Draft" : "Unknown"}</span>` plus `<span>{sizeChip(additions + deletions)}</span>` plus failed runs `{runs.filter(r => r.conclusion === "failure").slice(0, 3).map(r => <span key={r.id}>✕ {r.name}</span>)}` with text (not color-only).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/badges.test.ts src/__tests__/prDisplay.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/prDisplay.ts app/src/components/PRCard.tsx app/src/__tests__/badges.test.ts
git commit -m "feat(triage): merge badge + failed runs + size chips"
```

### Task 3: Checklist + canned replies + deep-link route

**Files:**
- Modify: `app/src/components/PRCard.tsx` (checklist from CHECK line)
- Modify: `app/src/components/ReviewSheet.tsx` (canned replies)
- Modify: `app/src/App.tsx` (deep-link `/pr/:owner/:repo/:number` alias, keep `/pr/*` compat)
- Test: `app/src/__tests__/triage-actions.test.ts`

**Interfaces:**
- Consumes: summary text shape `WHAT:/RISK:/CHECK:`; `mergeBadge/sizeChip` from Task 2.
- Produces: `parseChecklist(summary) -> string[]` (splits CHECK line on `;`/`•`/`-`); canned preset buttons set textarea value; deep-link route renders PRDetail with validated params.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseChecklist } from "../lib/reviewText";

describe("triage actions", () => {
  it("parses CHECK line into items", () => {
    const s = "WHAT: x\nRISK: y\nCHECK: tests; lint - typecheck";
    expect(parseChecklist(s)).toEqual(["tests", "lint", "typecheck"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/triage-actions.test.ts`
Expected: FAIL (parseChecklist missing).

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/reviewText.ts`:

```ts
export function parseChecklist(summary: string): string[] {
  const line = summary.split("\n").find((l) => l.startsWith("CHECK:")) ?? "";
  const body = line.replace(/^CHECK:\s*/, "");
  return body
    .split(/[;•\n-]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export const CANNED_REPLIES = [
  "Please add tests.",
  "Nit: please address comments.",
  "Please rebase on main.",
];
```

In `PRCard.tsx`: render checklist as tappable checkboxes (local state only, pre-swipe confirm — does not gate API).

In `ReviewSheet.tsx`: map CANNED_REPLIES to 44px buttons setting textarea value.

In `App.tsx`: add `<Route path="/pr/:owner/:repo/:number" element={<PRDetail />} />` alongside existing `/pr/*`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/triage-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/reviewText.ts app/src/components/PRCard.tsx app/src/components/ReviewSheet.tsx app/src/App.tsx app/src/__tests__/triage-actions.test.ts
git commit -m "feat(triage): checklist + canned replies + deep-link"
```
