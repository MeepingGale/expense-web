# Ledger — Expense Tracker

A client-only personal expense tracker built with React + TypeScript. All data lives in the browser's `localStorage`; there is no backend.

## Develop

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # run the Vitest suite
npm run typecheck  # tsc --noEmit
npm run build      # production static bundle in dist/
```

## Architecture

- **Vite + React 18 + TypeScript** (strict mode). No server — state is held in `App` and persisted to `localStorage`.
- `src/data/seed.ts` generates first-run sample data; `src/data/storage.ts` reads/writes a versioned blob (with a v1→v2 settings migration); `src/data/format.ts` holds shared formatting + currency helpers; `src/data/constants.ts` holds static lookup data.
- `src/hooks/useSettings.ts` holds appearance/chart settings. UI components live in `src/components/`.

The original Claude-artifact export (single HTML file + in-browser-Babel JSX) is preserved in git history at commit `248efec`.
