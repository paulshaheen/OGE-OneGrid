# OneGrid in Power BI

Two complementary ways to present the OneGrid solution inside Power BI. All work
is **isolated** — a dedicated sandbox Fabric workspace and this feature branch;
nothing in the live workspace, the live semantic models, the container app, or the
capacity configuration is modified.

## Sandbox (isolated)
- **Workspace:** `OneGrid-PBI-Sandbox` (`74751d76-9981-45dd-90bd-6f394cca7c92`) on the
  `ogestu` F16 capacity.
- **Model clone:** `semantic-main-sandbox` (`c74c6867-…`) — a Direct Lake copy of the
  model, repointed to read the **live** lakehouse `lh_poc` **read-only** (no data copied).
  17 persona KPI measures were added on top.

---

## Version 1 — Native Power BI report (mimics the app)
A genuine Power BI report on the cloned model, so it *is* Power BI and Power BI
slicers/filters/cross-filter work natively.

- Report: **Main Overview (Sandbox)** (`0417e250-…`).
- Persona pages (dark "OneGridDark" theme): **Executive, Control Room, Maintenance,
  Governance**, each with a header, KPI cards, charts, and a table built on the
  persona KPI measures (`Fleet Health`, `Watchlist Items`, `Open Work Orders`,
  `Active Anomalies`, `Assets At Risk (4h)`, …).
- Add a **Plant slicer** (`dim_asset[plant]`) on a page to filter the whole page.

## Version 2 — The web app wrapped in a Power BI report (custom visual)
The **actual OneGrid React app** hosted inside a Power BI **custom visual**, rendering
inside Power BI chrome and pulling **live data** from the deployed backend at runtime
(no iframe; works in the Power BI Service).

- `report-app/embed/onegrid-embed.jsx` builds the app into a self-contained IIFE
  bundle (CSS injected by JS) via `report-app/vite.embed.config.js`.
- `pbi-visual/` is the Power BI custom-visual (pbiviz) project that hosts that bundle,
  with a `WebAccess` privilege to the backend host.
- Build → import the `.pbiviz` into a report → drop it full-page.

See `pbi-visual/README.md` for the exact build/import steps.

### Known caveats (V2)
- The wrapped app is **self-fetching**, so it is not driven by Power BI slicers
  (use V1 for native filtering). A hybrid (pass the Power BI selection into the app)
  is a straightforward future enhancement.
- Live per-tag streaming uses a WebSocket; the Service sandbox may block it, in which
  case the Control Room live tags degrade gracefully while all polling-based views
  (Executive/Maintenance/Ontology, KPIs, charts) work.
