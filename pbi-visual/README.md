# OneGrid Power BI custom visual (`pbi-visual/`)

Hosts the **real OneGrid app UI** inside a Power BI custom visual so it renders in a
report (Power BI Service compatible) and fetches live data from the deployed backend.

## How it works
- `src/onegrid-embed.js` is the OneGrid app compiled to a single self-contained IIFE
  bundle (JS + CSS injected by JS). It is generated from `report-app/embed/` by the
  app's Vite build:
  ```powershell
  cd report-app
  npm install
  npx vite build --config vite.embed.config.js
  # -> report-app/embed-dist/onegrid-embed.js
  copy report-app\embed-dist\onegrid-embed.js pbi-visual\src\onegrid-embed.js
  ```
- `src/visual.ts` imports that bundle (which sets `window.OneGridEmbed`) and calls
  `mount(el, { apiBase })`, pointing the app at the deployed backend. It hosts the app
  in a scrollable, min-height container.
- `capabilities.json` declares a `WebAccess` privilege for the backend host (required
  for the sandboxed visual to `fetch` it). The backend already returns
  `Access-Control-Allow-Origin: *`.

## Build the `.pbiviz`
```powershell
npm install -g powerbi-visuals-tools    # provides `pbiviz`
cd pbi-visual
pbiviz package
# -> dist/*.pbiviz
```

## Import into a report (Power BI Service or Desktop)
1. Open a report in the sandbox workspace → **Edit**.
2. Visualizations pane → **⋯ → Import a visual from a file** → select the `.pbiviz`.
   (Not "Get data" — a `.pbiviz` is a visual, not a data source.)
3. Drop the **OneGrid** visual on the canvas and resize it to fill the page.
   It fetches live data and renders the app; no field wells needed.

## Notes
- `BASE` in `src/visual.ts` is the deployed backend URL; update it if the app moves.
- To render only one persona instead of the full app, change `report-app/embed/onegrid-embed.jsx`
  to import/render that persona and rebuild.
