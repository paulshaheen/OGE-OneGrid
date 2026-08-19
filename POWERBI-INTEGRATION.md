# OneGrid in Power BI

Two complementary ways to present the OneGrid solution inside Power BI, shipped to the
live workspace and wired into the deploy wizard as an additive `powerbi` phase.

## Shipped to the live `OneGrid` workspace (additive — nothing existing modified)
- **Model:** `semantic-main-personas` — a persona-ready Direct Lake model reading
  `lh_poc` read-only, with 17 KPI measures.
- **Report:** `OneGrid Personas` — native persona dashboards (Executive / Control Room /
  Maintenance / Governance) on a dark theme, bound to that model.
- **App visual:** `fabric/powerbi-visual/OneGridApp.pbiviz` — the OneGrid app hosted in a
  Power BI custom visual (import per report).

These are new items; the existing live models (`semantic-oge`, `semantic-main-import`),
the `Main Overview` report, the container app, and the capacity were **not** modified.

## Deploy wizard (`deploy.ps1`)
A new **`Phase-PowerBI`** (registered as the `powerbi` phase, runs after `oge`) redeploys
all three on any target tenant:
- Deploys `fabric/semanticmodel/semantic-main-personas` (rebinding the source
  workspace/lakehouse GUIDs to the target) and reframes it.
- Deploys `fabric/report/OneGrid_Personas` (rebinding the source model id + workspace name).
- Stages `fabric/powerbi-visual/OneGridApp.pbiviz` to the user's Downloads with import
  instructions.
The wizard UI (`deploy-ui/index.html`) shows the new **Power BI** step.

---

## Version 1 — Native Power BI report (mimics the app, filter-aware)
Genuine Power BI on the persona model, so Power BI slicers/filters/cross-filter work
natively. Add a `dim_asset[plant]` slicer to filter a page.

## Version 2 — The web app wrapped in a Power BI report (custom visual)
The **actual OneGrid React app** hosted inside a Power BI **custom visual**, rendering in
Power BI chrome and pulling **live data** from the deployed backend at runtime (no iframe;
works in the Power BI Service).
- `report-app/embed/onegrid-embed.jsx` builds the app into a self-contained IIFE bundle
  (CSS injected by JS) via `report-app/vite.embed.config.js`. It installs an in-memory
  `localStorage`/`sessionStorage` shim (the Service visual sandbox blocks storage).
- `pbi-visual/` is the pbiviz project that hosts that bundle, with a `WebAccess` privilege
  to the backend host and a scrollable container.
- Build → import the `.pbiviz` into a report → drop it full-page.

See `pbi-visual/README.md` for exact build/import steps.

### Known caveats (V2)
- The wrapped app is **self-fetching**, so it is not driven by Power BI slicers
  (use V1 for native filtering). Passing the Power BI selection into the app is a
  straightforward future enhancement.
- Live per-tag streaming uses a WebSocket; if the Service sandbox blocks it the Control
  Room live tags degrade gracefully while all polling-based views work.

## Isolated sandbox (for iteration)
- Workspace `OneGrid-PBI-Sandbox` (`74751d76-…`) on `ogestu`, with `semantic-main-sandbox`
  and a `Main Overview (Sandbox)` report — used to build/verify before shipping to live.
