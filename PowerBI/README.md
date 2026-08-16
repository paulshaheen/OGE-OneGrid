# OGE Power BI report (local)

`OGE_Report.pbix` is a **thin/live** Power BI report (no embedded data). It is opened
locally in **Power BI Desktop** and connects live to the **`semantic-oge`** Direct Lake
semantic model that `deploy.ps1` provisions into your Fabric workspace (reading the `oge`
schema of the `lh_poc` lakehouse).

## Use it

1. Run the deploy (creates the `oge` tables + `semantic-oge`, and rebinds this report):
   ```powershell
   ./deploy.ps1 -ConfigPath ./config.json            # full run
   # or just this module (requires an existing lakehouse):
   ./deploy.ps1 -ConfigPath ./config.json -Only core,data,oge
   ```
2. Open `OGE_Report.pbix` in Power BI Desktop, signed in to the same tenant. It will load
   live from `semantic-oge`.

## Rebinding

The report stores the target dataset id in its `Connections` part. `deploy.ps1` (phase
`oge`) rewrites it to the freshly-created `semantic-oge` dataset id automatically. To
rebind manually, edit `Connections` inside the `.pbix` (it is a zip) and replace the
`Initial Catalog` / `PbiModelDatabaseName` GUID with your dataset id.

## Notes

- The customer logo has been replaced with a generic wordmark.
- Tables come from the `oge` schema (`fact_oilreports`, `fact_workrequests`,
  `fact_smartsignals`, `fact_icare`, `fact_bfpperf`, `dim_equipment`, `fact_gads`,
  `calendar`).
