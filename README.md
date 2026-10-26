# علفتي الذكية — SmartFeed

Least-cost livestock feed formulation for Algerian sheep and goat farmers. Arabic/RTL UI, local-first (IndexedDB), PWA shell, with a real linear programming solver and strict data-provenance rules.

> **بيانات عرض توضيحية — غير معتمدة لاتخاذ قرارات تغذية حقيقية**  
> **Illustrative demonstration data — not approved for real feeding decisions**

## 1) Setup

### Requirements
- Windows PowerShell (the repo is in `C:\Users\LAPTA\Downloads\app`)
- Node.js v24.22.1 LTS (used: `C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64`). PowerShell blocks `npm.ps1`, so always use `npm.cmd`/`npx.cmd`.

### Install dependencies
```powershell
$base='C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64'
$env:PATH="$base;$env:PATH"
cd 'C:\Users\LAPTA\Downloads\app'
npm.cmd install
```

### Run in development
```powershell
$base='C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64'
$env:PATH="$base;$env:PATH"
cd 'C:\Users\LAPTA\Downloads\app'
npm.cmd run dev
```
Open `http://localhost:5173/#/`.

### Build (production)
```powershell
$base='C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64'
$env:PATH="$base;$env:PATH"
cd 'C:\Users\LAPTA\Downloads\app'
npm.cmd run build
```
Output goes to `dist/` (PWA assets generated via `vite-plugin-pwa`).

### Preview build
```powershell
$base='C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64'
$env:PATH="$base;$env:PATH"
cd 'C:\Users\LAPTA\Downloads\app'
npm.cmd run preview
```

## 2) Testing

### Run all tests
```powershell
$base='C:\Users\LAPTA\AppData\Local\Temp\opencode\node-v24.22.1-win-x64'
$env:PATH="$base;$env:PATH"
cd 'C:\Users\LAPTA\Downloads\app'
npm.cmd test
```

### Actual test results (recorded)
- **Test Files:** 5 passed (5)
- **Tests:** 51 passed (51)
- **Suites:** `tests/units.test.ts`, `tests/requirements.test.ts`, `tests/formulate.test.ts`, `tests/backup.test.ts`, `tests/storage.test.ts`
- **Duration:** ~5.17s (environment/setup heavy due to jsdom + fake-indexeddb)

Key coverage:
- Unit conversions (DM/AF, DZD, formatting)
- Requirement computation and profile validation
- LP formulation: cheaper choice wins, NDF minimum produces constrained optimum, infeasibility without relaxing constraints, missing required nutrients cause exclusion (not zero), missing-data-only refuses to optimize, DM-correct pricing (wet feed), stock bounds, illustrative vs verified status, disabled NDF marked unevaluated, invalid inputs/profile completeness, input fingerprint stability
- Backup: round-trip, app/schema rejection, malformed ingredient rejection, missing settings, invalid DM%, duplicate IDs warning, non-object rejection
- Storage (IndexedDB via idb + fake-indexeddb): first-run seed (13 built-ins + 3 example profiles), no reseed on restart/delete of built-ins, CRUD for ingredients/profiles/formulations, settings persistence, export passes validation, atomic replace, reset re-seeds

## 3) Sources actually used

- **Feed composition (consulted):** [INRAE-CIRAD-AFZ Feedtables](https://www.feedtables.com/) — 12 ingredients scraped on DM basis with `verified_reference`/provenance; a 13th (mineral-vitamin premix) was intentionally left with null nutrients to demonstrate the missing-data exclusion path.
- **Nutrient requirements:** NRC 2007 tables were **not available as extractable text** in this environment. No NRC numbers are used. The built-in standard `inrae-2018` contains **illustrative coefficients** (`status: 'illustrative'`) and can only return `feasible_unverified_adequacy`. `nrc-2007` ships as `status: 'incomplete'` with empty models to exercise the blocking path.
- **Prices:** Local market prices are user-supplied. Built-in prices are `illustrative_demo` and must be replaced.

## 4) Validated features

### Architecture & safety
- TypeScript strict mode, domain/UI separation, engine versioning, input fingerprinting
- Never fabricates requirements/composition/results/references
- Never labels a ration "balanced" unless verified; never silently relaxes constraints
- Distinguishes verified vs demo vs user data; unevaluated constraints tracked
- Mandatory Arabic safety notice (§19) present in footer and safety sections
- Permanent demo label on header/footer
- Local-first, no login, IndexedDB persistence

### Data & storage
- 13 built-in ingredients (including premix with missing data), 3 example livestock profiles
- Seed only on first run (guarded by `meta` key `seed_v1`); deleting built-ins does not reseed
- Full JSON export/import with strict schema validation; replace is atomic; reset re-seeds
- Price snapshots on saved formulations; price changes detected on demand
- Confirm dialogs for destructive actions

### Optimization engine
- Works on kg DM/animal/day; fixes `Σxᵢ = targetDm` (or computed intake), minimizes `Σ(pricePerKgAF / DMfrac) × xᵢ`
- Constraints: min UFL/UFV (by category), PDI, Ca, P, Na, optional min NDF; per-ingredient inclusion/stock bounds
- Solver: `javascript-lp-solver` v1.0.3 with independent post-solve verification (1e-6 relative / 1e-7 absolute)
- Excludes ingredients with missing required nutrients (never treats as zero); refuses if all missing
- Honest statuses: `feasible_unverified_adequacy`, `feasible_verified` (only when standard verified + all evaluated), `infeasible` (no auto-relax), `missing_ingredient_data`, `insufficient_animal_data`, `invalid_input`, `solver_error`

### UI (Arabic/RTL)
- 8 sections: Dashboard, Formulate New Ration, Feed Ingredient DB, My Livestock, Compare, Cost Calculator, Saved Formulations/History, Settings & Backup
- Cairo/Tajawal, agricultural green/white/beige, DZD (دج), Latin numerals/tabular alignment
- HashRouter, routes include `/saved/:formulationId`
- Ingredient editor (built-in composition read-only; price/inclusion/stock editable), profile management, formulation save/load, export/import/reset in Settings
- PWA icons present (`public/icon.svg`, `public/icon-maskable.svg`); app shell cached by PWA (Cairo font requires first load network)

## 5) Unresolved limitations

- **Requirements tables:** NRC 2007 not consulted/extracted; `inrae-2018` is illustrative only. No ration from this app should be called balanced.
- **Premix/incomplete data:** `ing-mineral-premix` has null nutrients and is excluded by design — requires complete values before use.
- **Prices:** All built-in prices are illustrative_demo; must be updated to local Algerian market prices.
- **Inclusion limits:** Conservative practical bounds, not taken from a published standard (explicitly flagged).
- **Font loading:** Offline claim is limited — PWA caches app shell but Cairo/Tajawal may need first-load network.
- **NDF:** When disabled, NDF remains unevaluated (never treated as satisfied).
- **Scope:** No login/cloud sync; data stays local to the browser/device.
- **Solver:** Uses a JS LP solver; results are mathematical optima under the stated constraints only.

## 6) Quick verification notes

- Dev server was started in background during validation; app loads at `/#/` with RTL, demo labels, and the safety notice.
- Formulate page shows INRAE illustrative requirements (unverified), NRC 2007 marked incomplete, premix flagged as missing data and excluded (12 selectable).
- Build completed successfully (Vite + TypeScript). Tests all pass.
- npm reported 4 vulnerabilities (2 moderate, 2 critical) and esbuild postinstall warning; build ran successfully in this environment.
