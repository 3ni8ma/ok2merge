# OK2Merge — Brand Guidelines (v1)

Source of truth for name, voice, visuals, and store assets. Approved 2026-09-07.

## Positioning

OK2Merge is the PR inbox for developers who want to stop being the bottleneck — because triage takes seconds, not a laptop.

- Mission: We clear code reviews for developers by putting the PR inbox on their phone so they can merge without opening a laptop.
- Vision: A world where no PR waits overnight for a rubber stamp.
- Value prop: For developers drowning in review requests, OK2Merge is a mobile PR inbox that explains each diff in plain English. Unlike desktop review tools, you clear it with a swipe.

## Voice

Dry dev humor, short sentences. Never corporate, never hype-beast.

- Primary message: Clear your code reviews from your phone.
- Supporting: AI summarizes. You decide. / Swipe right to merge. / Stop being the bottleneck.
- 10-second pitch: OK2Merge is the PR inbox for your phone — AI explains each diff, you swipe right to approve.

## Visual identity

### Logo

- Mark: tilted (-8°) concentric approval seal — bold green ring + hairline inner ring on ink, paper check-arrow locked on the optical center. No decoration; every element earns its place.
- Files: `assets/logo.svg` (mark), `assets/icon.svg` (1024 store icon master).
- Rules: don't stretch, don't recolor, don't add effects, don't place on busy backgrounds. Clear space = height of the check on all sides.

### Palette

| Color   | Hex     | Usage                              |
|---------|---------|------------------------------------|
| Merge   | #22C55E | Primary, approve actions, icon bg  |
| Ink     | #0D1117 | Backgrounds (GitHub-dark)          |
| Paper   | #F6F8FA | Text on dark                       |
| Amber   | #F59E0B | Request-changes                    |
| Red     | #EF4444 | Blocked / CI failed                |

Text contrast: Paper on Ink ≈ 19:1. White on Merge ≈ 3.5:1 — Merge is for large glyphs and buttons with bold text, never small body copy.

### Typography

| Usage   | Font         | Notes                              |
|---------|--------------|------------------------------------|
| Display | Space Grotesk| Wordmark, headlines, posters       |
| UI/Body | Inter        | App UI, store description          |

Both open-source (Google Fonts), both load in Expo.

## App Store listing

- Name: `OK2Merge` · Subtitle: `Swipe through PR reviews`
- Keywords: `codereview,github,pullrequest,merge,developer,git,approval,workflow,team`
- Icon: 1024×1024 PNG exported from `assets/icon.svg`, fully opaque, sharp square corners — Apple and Google apply their own masks, and pre-rounded corners get rejected or double-masked. Our art already complies (full-bleed ink, mark inside the safe zone). Later: dedicated dark/tinted variants (iOS 18+) and Android adaptive-icon foreground/background split (art inside the 72dp-center safe zone).
- Screenshots: 1290×2796 (iPhone 6.9") + matching Play sizes, captured from real builds, never mockups of unshipped UI.

## Launch posters

1. "Your team is waiting on YOU" — giant push notification on Ink, green Approve button.
2. "Clear 12 PRs from your couch" — phone mid-swipe, card deck fanned behind.
3. "AI reads. You rule." — split screen: diff vs. big green check-arrow.

Sizes: 1600×900 (X/LinkedIn), 240×240 + gallery (Product Hunt).
