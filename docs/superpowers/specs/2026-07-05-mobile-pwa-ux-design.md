# Mobile PWA UX redesign — design

**Date:** 2026-07-05 · **Status:** approved (option "Approve (Recommended)")

## Problem (measured at 390×844)

- Topbar chrome = 216px; first content at 232px → **28% of the screen** before any data.
- Modals are centered desktop dialogs (350×776 floating box) instead of mobile sheets.
- Transactions filter stack = 148px before the list.
- Trend-mode toggles / x-ticks are 24–27px tap targets (guideline ≈ 44px).
- KPI cards render one per row (124px each) — a full screen of scrolling past stats.

## Approach

CSS-adaptive reshaping of the existing DOM behind `@media (max-width:760px)` —
no separate mobile tree, no UI library, desktop pixel-identical. Only JSX
additions: a floating action button, and ExportMenu gains an optional
"Bulk add" row (its trigger collapses to an icon on phones).

## Design

1. **Header diet (~216px → ~100px):** one sticky row — logo mark (wordmark
   hidden) · `‹ Month ›` centered · year pill · [Export ⋯ popover with
   CSV/PDF/Bulk] · theme icon. `Add expense`/`Bulk add` buttons leave the
   header (and the Transactions header): the **FAB** (fixed circular + above
   the bottom bar) is the add path; Bulk lives in the Export popover.
   `env(safe-area-inset-top)` padding so the sticky header clears the notch
   (required since viewport-fit=cover).
2. **KPI tiles 2×2:** `.kpi` spans 6 of 12 columns on phones, compact type.
3. **Bottom sheets:** all modals anchor to the bottom edge, full-width,
   rounded top corners, `max-height 92dvh`, slide-up animation, safe-area
   bottom padding.
4. **Compact filters:** search keeps its own row; the two selects share one.
5. **Fit & finish:** root `--pad/--gap/--r` step down on phones; trend-mode
   buttons and x-axis ticks get ≥40px touch height; sticky group headers
   re-offset to the slim topbar.

## Verification

Re-run the audit script: header ≤ ~110px, modal rect bottom == viewport
bottom, KPI grid 2-col, no horizontal overflow on all five views, FAB
present and above the bottom bar, popover contains Bulk add; desktop at
1280px shows no visual change (top tabs, original header); full test suite
and build stay green.
