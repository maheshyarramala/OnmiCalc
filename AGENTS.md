<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## OmniCalc architecture
- Pure calculation logic lives in `src/lib/calc/*` and `src/lib/finance/logic.ts` with no React imports, so it stays unit-testable in `src/test/omnicalc-rules.test.ts`.
- App data is stored on-device via Zustand `persist` stores (`src/lib/finance/store.ts`, `history-store.ts`, `settings-store.ts`); the source Android app had no server or accounts.
- Backup files use the Android app's JSON v3 format (`src/lib/finance/backup.ts`) so existing phone backups restore unchanged; keep field names compatible.
- Zustand selectors must return stable references (select the raw array, filter outside the selector) to avoid render loops.
- Chart SVG coordinates are rounded so server and browser render identical markup.
