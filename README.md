# OGE OneGrid on Microsoft Fabric

An end-to-end **OneGrid solution accelerator** built on **Microsoft Fabric**
and **Azure AI Foundry**. The **accelerator** — the thing you clone and deploy — has three parts:

1. **The accelerator** — a complete Fabric solution (lakehouse, real-time eventhouse, ML
   models, semantic model, reports) plus the historical data, that deploys into *your* tenant.
2. **The web app** — an interactive React dashboard: **3D digital twins**, a **failure
   simulation**, a **knowledge graph / ontology**, and **chat-with-your-data**.
3. **A one-click localhost deploy wizard** — a local browser tool that provisions the whole
   solution into your Fabric capacity and streams live progress.

> **Also versioned in this repo — for source control only (NOT part of the accelerator):**
> the public **documentation site** (`docs-site/`) and its **trailer video**. They are kept
> here so they're version-controlled and auto-deploy on change, but they are **not deployed by,
> or required to run, the accelerator** — ignore them when cloning to deploy.

> **Try it first:** the live app and docs site let you explore before deploying anything.
> Then run the wizard to stand the whole solution up in your own tenant.

---

## ⚡ Quick start — clone from GitHub & run the wizard

```powershell
# 1. Install Git LFS once (pulls the bundled data), then clone
git lfs install
git clone https://github.com/paulshaheen/OGE-OneGrid.git
cd OGE-OneGrid

# 2. Sign in to Azure (an account with rights to create resources + Fabric admin/member)
az login

# 3. Launch the deploy wizard, then open the browser
node deploy-ui/server.js          # or:  ./deploy-ui/launch.ps1  (also opens the browser)
#    → http://localhost:7333
```

The wizard walks you through **sign-in → choose targets → prerequisite checks → deploy**, with
a live progress tracker. It writes `config.json` and runs `deploy.ps1` for you. When it finishes
you get a **🖥️ Launch Web App** button.

**You need:** an existing **Microsoft Fabric capacity** (F-SKU or Trial), **Node.js**, the
**Azure CLI**, and **Git LFS**. No local Docker — the app image builds in the cloud.
Prefer the command line? See [Option B — Config file + CLI](#option-b--config-file--cli).

---

## 📁 Repository structure (the sections)

**The accelerator** (what you clone & deploy):

| Section | Path(s) | What it is |
|---|---|---|
| 🚀 **Accelerator** | `fabric/`, `data/`, `PowerBI/`, `infra/` | Fabric item definitions (notebooks, semantic model, eventhouse, pipeline…), the bundled historical **data** (Git LFS), the Power BI add-on, and IaC. |
| 🖥️ **Web app** | `report-app/`, `chatagent/`, `Dockerfile` | The React dashboard + Node data API + realtime WebSocket, which spawns the **chat agent**. Built into one container image. |
| 🧭 **Deploy tool** | `deploy-ui/`, `deploy.ps1`, `config.sample.json` | The localhost **wizard** and the underlying phase-based deploy script. |
| 🧩 **Data plane** *(optional bolt-on)* | `bolt-ons/data-plane/` | Bring‑your‑own‑data layer: stream **your** historian/operational data into the accelerator's Eventstream custom endpoint instead of the synthetic seed. Ships a production PI→Fabric forwarder + connector contract (see [Data plane](#-data-plane--bring-your-own-data-optional-bolt-on)). |

**Source-control only** (versioned here, but **not part of the accelerator** — you don't need
these to clone, deploy, or run the solution; they're the public marketing/docs assets and
auto-deploy on change):

| Item | Path(s) | What it is |
|---|---|---|
| 📚 **Documentation site** | `docs-site/` | Zero-dependency static-site generator (`_build.js`) → the public capabilities site on Azure Static Web Apps. Has its own [README](docs-site/README.md). |
| 📹 **Trailer video** | `docs-site/media/OneGrid_Trailer.mp4` | The intro video — **stored in Git (LFS)** so it's version-controlled. Change it here and CI redeploys the site (see [Changing the video](#-changing-the-trailer-video)). |

```
OGE-OneGrid/
├── deploy.ps1                 # phase-based deploy orchestrator (workspace→…→chatagent)
├── deploy-ui/                 # local web wizard (server.js, index.html, launch.ps1)
├── config.sample.json         # copy → config.json and fill in (git-ignored)
├── Dockerfile                 # builds the web-app image (report-app SPA + chat agent)
├── fabric/                    # exported Fabric item definitions
│   ├── notebooks/             #   Spark notebooks (ingest, ML, scoring, ontology…)
│   ├── semanticmodel/         #   Import + Direct Lake models
│   ├── eventhouse/            #   KQL schema, mappings, functions
│   ├── pipelines/ eventstream/ report/ kqldashboards/
├── data/                      # bundled historical parquet (Git LFS)
├── report-app/                # React dashboard + Node backend (data API + realtime WS)
├── chatagent/                 # natural-language chat agent (spawned by the report server)
├── infra/                     # foundry.bicep (Entra-only AI Foundry account)
├── bolt-ons/                  # optional add-ons (not required to run the accelerator)
│   └── data-plane/            #   bring-your-own-data
│       ├── core/              #     Forwarder.Core — shared durable-queue + publisher
│       └── connectors/        #     pi-forwarder (PI) + db-forwarder (SQL Server/Oracle)
├── docs-site/                 # docs site + media/ trailer video (source-control only — not part of the accelerator)
└── .github/workflows/         # CI: auto-deploy the docs site on push
```

---

## 🚀 Section 1 — The accelerator

`deploy.ps1` provisions the **entire** solution into your own tenant:

```
   deploy.ps1 → ┌──────────────────────────────────────────────────────────┐
                │  Fabric workspace                                        │
                │   • Lakehouse (lh_poc)   • Eventhouse + KQL DB           │
                │   • Eventstream          • Spark notebooks + pipeline    │
                │   • Import semantic model + Power BI report              │
                │   + bundled historical data (PiEvents + gold/ml tables)  │
                └──────────────────────────────────────────────────────────┘
                ┌──────────────────────────────────────────────────────────┐
                │  Azure AI Foundry account (+ model deployments)          │
                │  Azure Container App: the web app (managed identity)     │
                └──────────────────────────────────────────────────────────┘
```

The web app reasons with **Azure AI Foundry** (unified inference + model selector), queries
**real-time** sensor data from the **Eventhouse (KQL)** and **curated** data from the
**Import semantic model (DAX)** — no per-user secrets.

### What gets created

| Layer | Items |
|---|---|
| **Fabric** | Workspace, Lakehouse, Eventhouse + KQL DB, Eventstream, notebooks, pipeline, Import semantic model, report |
| **Data** | Full `PiEvents` history + all `gold`/`ml`/`dbo` curated tables + a 30-day window of the fact tables |
| **Azure** | AI Foundry account + model deployments; Container App (the web app) with a system-assigned identity |
| **Grants** | App identity → Eventhouse DB viewer, Power BI workspace member, Foundry `Cognitive Services User` + `Reader` |

---

## 🧭 Section 2 — Deploy it

### Prerequisites
1. **Azure CLI** logged in (`az login`) with rights to create resources and Fabric admin/member access.
2. **An existing Microsoft Fabric capacity** (F-SKU or Trial) — a workspace can't be created without one.
3. Tenant setting **"Service principals can use Fabric / Power BI APIs"** enabled.
4. **Node** to run the wizard. **No local Docker** — the container image builds in the cloud (ACR).
5. **Git LFS** so the bundled data materializes: `git lfs install` before cloning.

### Option A — Guided web wizard (recommended)
A local browser wizard discovers your subscriptions/capacities, runs a **prerequisite check**,
writes `config.json`, and streams live deploy progress. Every deploy gets **unique resource
names** (resource group, workspace, Foundry account) so runs never collide.

```powershell
node deploy-ui/server.js      # or: ./deploy-ui/launch.ps1  (also opens the browser)
# then open http://localhost:7333
```
Steps: **Azure sign-in → Choose targets → Prerequisite checks → Deploy** (live phase tracker +
log). On success it shows a **🖥️ Launch Web App** button plus Power BI / real-time / demo links.

### Option B — Config file + CLI
```powershell
cp config.sample.json config.json      # then edit: subscriptionId, location, fabric.capacityId, names
./deploy.ps1 -ConfigPath ./config.json
```
Run a subset of phases with `-Only`, or skip the slow data load with `-SkipData`:
```powershell
./deploy.ps1 -ConfigPath ./config.json -Only workspace,core,semantic,foundry,chatagent,permissions
./deploy.ps1 -ConfigPath ./config.json -SkipData
```
Phases (in order): `workspace → core → artifacts → data → semantic → foundry → chatagent → permissions`.
On completion the web-app URL + workspace link are printed and written to `last-deploy-state.json`.

### Tear down
The wizard has a teardown picker; or `./deploy.ps1 -ConfigPath ./config.json -Teardown`.
It removes the created Fabric workspace + Azure resource groups. **Your Fabric capacity is left untouched.**

---

## 🖥️ Section 3 — The web app

`report-app/` is a **React + Three.js** dashboard served by a Node backend
(`report-app/server`) that also spawns the `chatagent/` as a child process. The
repo-root **`Dockerfile`** bundles both into one always-on Container App.

Highlights:
- **3D digital twins** of each asset that stream live historian values and pin faults to physical zones.
- A **failure simulation** that fast-forwards an asset up to 14 days, drives a real breakdown from
  the short-term stop + long-term survival models, and shows root cause + feedback.
- A **knowledge graph** (ontology) of the whole data model, generated from the semantic model.
- **Chat-with-your-data** grounded in the Eventhouse (KQL) and semantic model (DAX) via Foundry.

Run locally against a deployed workspace:
```powershell
cd report-app
npm install
npm run build
node server/index.js          # serves the SPA + API + WS on http://localhost:7700
```
Connection targets resolve from env (`PBI_WORKSPACE`, `PBI_DATASET`, `KUSTO_CLUSTER`,
`KUSTO_DATABASE`) → `last-deploy-state.json` → `server/target.json` (local dev fallback).

---

## 📚 Appendix — The documentation site & trailer video *(source control only)*

> These live in the repo purely so they're **version-controlled** and **auto-deploy on change**.
> They are **not** part of the accelerator — you don't clone, deploy, or run them to stand up
> the solution. Skip this section if you're just deploying the accelerator.

`docs-site/` is a **zero-dependency static-site generator**: content lives in `_pages_*.js`
modules, `_build.js` holds the shared CSS/JS/nav and emits self-contained HTML. It's deployed
to **Azure Static Web Apps**.

```powershell
cd docs-site
node _serve.js                 # local preview at http://localhost:8099
node _build.js                 # regenerate all pages after edits
```
Full build/deploy details are in **[docs-site/README.md](docs-site/README.md)**.

### 📹 Changing the trailer video
The intro video lives in the repo at **`docs-site/media/OneGrid_Trailer.mp4`** (Git LFS).
To change it, replace that file (and the poster) and push — the **GitHub Actions workflow**
(`.github/workflows/deploy-docs.yml`) rebuilds and **redeploys the site automatically** on any
push under `docs-site/**`. So *updating the video = updating the repo.*

To re-encode a new source to the web-optimized format used here:
```powershell
ffmpeg -i <source>.mp4 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
  -vf "scale=1920:-2:flags=lanczos,unsharp=5:5:0.45:5:5:0.0" `
  -c:a aac -b:a 160k -movflags +faststart docs-site/media/OneGrid_Trailer.mp4
ffmpeg -ss 2 -i docs-site/media/OneGrid_Trailer.mp4 -frames:v 1 -q:v 2 docs-site/media/trailer-poster.jpg
```

> **CI secret:** the workflow needs the SWA deployment token stored as the repo secret
> `AZURE_STATIC_WEB_APPS_API_TOKEN` (set once with `gh secret set`).

---

## 📦 The historical-data bundle (Git LFS)

The bundled parquet under `data/` travels **with the repo** via Git LFS (`.gitattributes`
tracks `*.parquet`, `data/**`, and the trailer `*.mp4`). A customer just clones and
deploys — no external storage:
```powershell
git lfs install
git clone <repo-url>
cd OGE-OneGrid
./deploy.ps1 -ConfigPath ./config.json
```
`deploy.ps1` (phase `data`) uploads `data/lakehouse/**` and `data/eventhouse/**` to the new
Lakehouse via OneLake and runs `_load_data` to rebuild the Delta tables. Set `fabric.siteCount`
(0–12) in `config.json` to fan the reference site out into extra synthetic sites.

> Authoring/refreshing the bundle: run `fabric/notebooks/_export_data` in the source workspace,
> download to `data/lakehouse/`, export the Eventhouse with `fabric/eventhouse/_export_eventhouse.kql`
> into `data/eventhouse/`, then commit (LFS stores the binaries).

---

## 🧩 Data plane — Bring your own data (optional bolt-on)

The accelerator runs on bundled synthetic data out of the box. The **data plane** is an
optional, additive module that streams a customer's **own** operational data into the *same*
Fabric landing zone the accelerator already provisions — so the models, dashboards and 3D
twins light up on real data with **no schema or report changes**.

**Why it's nearly free:** the deploy already creates an Eventstream with a **Custom Endpoint
source** (`PIForwarderEndpoint`) that lands events in `PiEventsRaw` → (update policy) →
`PiEvents`. The synthetic seed and any data-plane connector are just interchangeable producers
into that endpoint. Turning it on = point a connector at that endpoint.

- **Connector contract** — emit the canonical `PiEventsRaw` JSON shape to the custom endpoint
  (Event Hub–compatible / AMQP). Match it and everything downstream works. Full spec:
  [`bolt-ons/data-plane/README.md`](bolt-ons/data-plane/README.md).
- **Shared core** — `bolt-ons/data-plane/core/Forwarder.Core/` is the source-agnostic
  reliability core (durable SQLite outbox, AMQP publisher + cert auth, drain/heartbeat loops)
  reused by every connector; a connector adds only a source-read loop.
- **PI connector** — `bolt-ons/data-plane/connectors/pi-forwarder/` streams **OSIsoft/AVEVA
  PI** data (WebSocket + poll).
- **SQL Server + Oracle connector** — `bolt-ons/data-plane/connectors/db-forwarder/` streams
  either relational database via watermark polling (durable per-source high-watermark;
  narrow or wide/unpivot shapes; DB creds from env, not the repo).
- **Extensible** — the same pattern generalizes to other historians, OPC-UA/MQTT, and
  GADS/work-order feeds (see the connector contract).

**Wire it up after a deploy** (opt-in — never part of the default deploy path):
```powershell
./deploy.ps1 -ConfigPath ./config.json -DataPlane          # after a full deploy
./deploy.ps1 -ConfigPath ./config.json -Only dataplane     # standalone (workspace already exists)
```
…or click **“Set up Data Plane (optional)”** on the wizard's launch screen. This resolves the
deployed custom-endpoint namespace and writes a pre-filled
`bolt-ons/data-plane/connectors/pi-forwarder/appsettings.generated.json` (tenant + FQDN + stream
filled; you supply the Entra app, client certificate, and PI host). The base accelerator keeps
running on synthetic data regardless.

---

## OGE Power BI add-on module

A self-contained Power BI module is layered onto the accelerator lakehouse: 8 tables in a new
`oge` schema inside `lh_poc` and a Direct Lake `semantic-oge` model. Build reports directly
against the `semantic-oge` model in the Fabric service.
```powershell
./deploy.ps1 -ConfigPath ./config.json -Only core,data,oge   # or a full run
# then build OGE reports against the 'semantic-oge' model in the Fabric service
```

---

## Notes & limits
- **Parameterization:** exported artifacts contain source workspace/lakehouse/SQL/Kusto IDs
  that are **string-replaced** with the new target IDs during deploy (`$SRC` + `BuildDefinition`
  in `deploy.ps1`). Re-export with `_export-artifacts.ps1`.
- **Eventstream / dataflow / KQL-dashboard** external bindings may need a one-time reconnect in
  the portal after deploy.
- **Adding models** (Claude / GPT-5 / Llama…): deploy them to the Foundry account and they appear
  in the chat agent's model selector automatically.
- **Secrets:** `config.json`, `last-deploy-state.json` and deploy logs are **git-ignored** — never
  commit them. Use `config.sample.json` as the template.
