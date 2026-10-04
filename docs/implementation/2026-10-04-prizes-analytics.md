# Prize settings and participant analytics, 2026-10-04

This update extends the existing Arabic RTL competition demonstration. It aligns the book cover across all three designs, uses the executing organization's logo in designs 2 and 3, upgrades their prize presentation, and adds persistent prize controls and participant analytics to the committee workspace.

## Existing visual system and local decisions

The source remains the design authority; this task adds no `PRODUCT.md`, `DESIGN.md`, or replacement identity.

| Source evidence | Existing identity retained |
| --- | --- |
| `src/app/layout.tsx`, `src/app/globals.css` | Arabic `lang`, RTL direction, locally bundled Noto Sans Arabic controls/body and Noto Naskh Arabic headings; cream surfaces, olive text, copper accents. |
| `src/app/designs.css`, `data-design="official"` | Design 2: blue `#074572`, cyan `#00a4e0`, white/light-blue surfaces, locally bundled Frutiger Arabic. |
| `src/app/designs.css`, `data-design="hybrid"` | Design 3: green `#18523f`, dark green `#113f33`, pale green surfaces, Frutiger Arabic inherited from the official identity. |
| `src/components/ui.tsx`, `BrandMark` | Designs 2 and 3 show `/images/organizations/general-presidency.png`, matching the executing organization shown in the organizer section. |

The book keeps the original design's responsive size: browser measurements are **318 px** at a 1440 px viewport and **206.5 px** at a 390 px viewport in every design. Designs 2 and 3 inherit their own palette for prize cards, dark first-place emphasis, total award panel, and recognition cards. Their persisted layout can be a podium or a horizontal list (`ledger`), which stacks on narrow screens. Prize amounts are shared across all three designs. Analytics and editor controls reuse the existing admin panels, typography, table and form patterns. Local muted-color overrides improve analytics heading and small-label contrast without changing global identity tokens.

## Settings and analytics behavior

- `src/lib/prizes.ts` validates six independently editable ranks for each of the three educational stages, the media prize, and the layout. Amounts must be whole Saudi riyals between 0 and 10,000,000. Stage and overall totals derive from the saved amounts; the original default remains **52,000 SAR**.
- `src/lib/db.ts` initializes the database setting without replacing existing settings. `src/lib/service.ts` saves prizes in a transaction, increments the version, records before/after values in the audit trail, and rejects stale saves with HTTP 409. The API permits prize updates only for an admin session.
- `src/components/admin-prizes.tsx` provides an unsaved preview and server-confirmed save notice. `src/components/competition-prizes.tsx` renders the shared public/preview presentation, and `src/app/page.tsx` reads persisted values for the public homepage. Refresh or reopen the public page to see saved changes.
- `src/components/admin-analytics.tsx` combines gender, school/university, educational stage, city/governorate, region, Saudi Arabia local Gregorian registration year, participation status, score range, and participant/institution/location search. The filters apply to summaries, distributions, grouped averages, cross-tab counts, participant rows, and CSV export.
- `src/lib/analytics.ts` computes percentages from each attempt's frozen question count, supplied by the server query as `max_score`. Completed zero scores count in averages; incomplete attempts do not. Score filters include completed attempts only. Missing demographic/institution fields remain visible as “غير مسجل”. The API CSV export uses the same filtering and percentage functions.
- Only the six built-in synthetic seed records receive demographic enrichment. Actual registrations are not assigned inferred demographics. Registration year means the Gregorian year in `Asia/Riyadh`, including the UTC-to-Saudi New Year boundary.

## Navigation and recorded verification

Open [the isolated preview](http://127.0.0.1:3001), then `/admin` → **دخول عرض اللجنة**. **الجوائز والتصميم** opens amounts, layout and preview controls; **تحليلات المسابقة** opens combined filters, comparisons and CSV export. The Vision 2030 button cycles the original, official and hybrid designs and remembers the selection locally.

Verification commands:

```powershell
npm test
npm run typecheck
npm run build
npm run test:integration
npm run format:check
node tests/admin-updates.cjs
```

Recorded results: 10 domain tests, 43 integration checks, build, typecheck and formatting passed. The browser script checks book equality, organizer logo, horizontal overflow, combined analytics filters and matching CSV, prize preview/save, and public values/layout at desktop and mobile widths. It restores saved prize values after the successful flow and reports no page errors. It accepts `NBC_PREVIEW_URL` and `PLAYWRIGHT_MODULE` when the preview URL or available Playwright installation differs.

Evidence lives in `test-results/admin-updates/verification.json` and adjacent desktop/mobile PNG captures. Integration evidence lives in `test-results/integration.json`. The preview uses `.data/preview-updates-20261004`; integration checks use separate synthetic databases.

The independent finish review returned `ship` for the final contrast and calendar-year corrections. Refreshed official/hybrid analytics captures at 1440 and 390 px confirmed table headers and stage annotations exceed 4.5:1 contrast. The verdict pass covers those corrections; it is not an exhaustive accessibility audit.

## Limits

This remains a local demonstration with explicit demo staff entry; production authentication is not implemented. The ambiguous requested word “ears” was treated as geographical locations and explicit registration years. The application collects neither ages nor school years. Impeccable context/detector automation was unavailable because its local engine was missing; source review and browser verification supplied the available evidence.
