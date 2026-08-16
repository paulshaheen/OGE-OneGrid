module.exports = function(page, section) {
  const s1 = section("summary", "📋", "rgba(88,166,255,0.15)", "Executive Summary", `

<p>The Riverton OneGrid solution unifies three historically siloed data domains into a single Fabric lakehouse:</p>
<ul>
  <li><strong>GADS</strong> — NERC-mandated outage event history sourced from an on-prem Oracle database, going back roughly 30 years.</li>
  <li><strong>condition-monitoring</strong> — Ironhart Energy's condition-monitoring repository (SQL Server) of inspection findings, vibration routes, oil analysis, and thermography.</li>
  <li><strong>PI Server</strong> — OSIsoft PI historian streaming ~645 process tags at 1-second to 1-minute cadence from the DCS and field instrumentation.</li>
</ul>
<p>The resulting Gold layer powers three analytic surfaces: a short-term XGBoost classifier (4 h / 8 h / 24 h failure probability), a long-term Cox proportional-hazards survival model with a fleet-rank watchlist, and a real-time anomaly engine that compares three scorers (robust Z, PCA residual, AAKR) to GE legacy APM as a benchmark.</p>

  `);

  const s2 = section("infra", "🏗️", "rgba(188,140,255,0.15)", "Fabric Infrastructure Inventory", `

<table>
  <tr><th>Component</th><th>Type</th><th>Purpose</th></tr>
  <tr><td><code>PredictiveMaintenance</code></td><td>Fabric Workspace</td><td>Top-level container for all solution artefacts.</td></tr>
  <tr><td><code>PM_Bronze</code></td><td>Lakehouse</td><td>Raw landings from Oracle, SQL Server, PI extraction notebooks.</td></tr>
  <tr><td><code>PM_Silver</code></td><td>Lakehouse</td><td>Cleansed, deduped, harmonised entities.</td></tr>
  <tr><td><code>PM_Gold</code></td><td>Lakehouse</td><td>Star schema + ML-ready aggregates.</td></tr>
  <tr><td><code>PI_Gold_Delta</code></td><td>Lakehouse</td><td>PI tag samples written by real-time forwarders.</td></tr>
  <tr><td><code>PM_Hot</code></td><td>Eventhouse</td><td>30-day hot tier (KQL). Cluster: <code>trd-733z…z9.kusto.fabric.microsoft.com</code>.</td></tr>
  <tr><td><code>PM_Stream</code></td><td>Eventstream</td><td>Routes forwarder events to Eventhouse + Lakehouse fan-out.</td></tr>
  <tr><td><code>PM_SemanticModel</code></td><td>Power BI dataset</td><td>DirectLake over Gold for Power BI / dashboards.</td></tr>
</table>

  `);

  const s3 = section("sources", "🔌", "rgba(63,185,80,0.15)", "Source Systems", `

<div class="card-grid">
  <div class="card"><h4>Oracle (GADS)</h4><p><code>oracle.ironhart.com:1521/GADSPROD</code> via <code>oracledb</code> thin mode. Tables: <code>GADS_EVENT</code>, <code>GADS_EQUIPMENT</code>, <code>GADS_CAUSE_CODE</code>.</p></div>
  <div class="card"><h4>SQL Server (condition-monitoring)</h4><p><code>cmsql01\\\\CM</code> with Kerberos. Tables: <code>Inspection</code>, <code>Finding</code>, <code>AssetHierarchy</code>, <code>VibrationRoute</code>.</p></div>
  <div class="card"><h4>PI Server</h4><p><code>PIHIST01\\\\PIDATA01</code> via AF SDK 2.10. ~645 tags, 1 s–1 min cadence, retrieved via interpolated values at 1-min grid.</p></div>
</div>
<p>See <a href="data-sources.html" style="color:var(--accent)">Data Sources</a> for full tag lists and extraction notebooks.</p>

  `);

  const s4 = section("dataflow", "🔄", "rgba(57,210,192,0.15)", "End-to-End Dataflow", `

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="arch-dataflow.svg" alt="On-prem sources feed forwarders and a Bronze-Silver-Gold lakehouse; Eventhouse serves the hot path to dashboards." style="width:100%;max-width:1100px;height:auto"/></div>

  `);

  const s5 = section("shortterm", "⚡", "rgba(210,153,34,0.15)", "Short-Term Model Architecture", `

<p>The short-term path is a Phase 1-4 notebook chain: <code>Phase1-Label-Construction</code> builds <code>ml.labels</code> from <code>gold.fact_gads_event</code> + <code>gold.dim_scope_asset</code>; <code>Phase2-Feature-Engineering</code> joins <code>gold.fact_pi</code> + <code>gold.bridge_pi_tag_to_asset</code> to write <code>ml.selected_tags</code> and <code>ml.training_shortterm</code>; <code>Phase3-Predictive-Model</code> logs RandomForest and GradientBoosting models to MLflow; <code>Phase4-Model-Scoring-Batch</code> writes <code>ml.predictions_shortterm</code> and <code>ml.drivers_shortterm</code>.</p>
<table>
  <tr><th>Horizon</th><th>ROC-AUC (hold-out)</th><th>PR-AUC</th><th>Notes</th></tr>
  <tr><td>4 h</td><td><span class="badge badge-green">0.902</span></td><td>0.41</td><td>Strong leading indicators in vibration and drum pressure deltas.</td></tr>
  <tr><td>8 h</td><td><span class="badge badge-yellow">0.575</span></td><td>0.14</td><td>Significant drop — signal-to-noise degrades.</td></tr>
  <tr><td>24 h</td><td><span class="badge badge-red">0.336</span></td><td>0.06</td><td>Effectively random; long horizon needs survival model.</td></tr>
</table>
<p>Full pipeline detail: <a href="ml-pipeline.html" style="color:var(--accent)">ML Pipeline</a>.</p>

  `);

  const s6 = section("longterm", "📈", "rgba(188,140,255,0.15)", "Long-Term Survival Architecture", `

<p><code>Phase-LongTerm-Survival</code> builds <code>ml.training_longterm</code> from <code>gold.fact_pi</code> + <code>gold.fact_gads_event</code>. <code>Phase-LongTerm-Cox</code> applies <code>lifelines.CoxPHFitter</code> and writes <code>ml.predictions_longterm</code>, <code>ml.drivers_longterm</code>, <code>ml.degradation_longterm</code>, and shared <code>ml.watchlist</code> rows for maintenance planning.</p>
<p>C-index on hold-out: <strong>0.68</strong>. Notable hazard ratios: drum pressure 4 h delta HR=1.42 (p&lt;0.01), vibration p95 HR=1.31, boiler feed water flow std HR=0.86. See <a href="survival-models.html" style="color:var(--accent)">Survival Models</a>.</p>

  `);

  const s7 = section("dimensions", "🌐", "rgba(63,185,80,0.15)", "Conformed Dimensions", `

<table>
  <tr><th>Dimension</th><th>Grain</th><th>Notes</th></tr>
  <tr><td><code>dim_asset</code></td><td>One row per equipment piece</td><td>Hierarchy: Site → Unit → System → Equipment. Includes condition-monitoring ID, GADS equipment ID, PI tag prefix.</td></tr>
  <tr><td><code>dim_tag</code></td><td>One row per PI tag</td><td>Engineering units, span, asset FK, signal class (process / vibration / thermal).</td></tr>
  <tr><td><code>dim_date</code></td><td>Daily</td><td>Standard calendar + outage season flags.</td></tr>
  <tr><td><code>dim_time_of_day</code></td><td>15-min bins</td><td>96 rows; supports load profile joins.</td></tr>
  <tr><td><code>dim_cause_code</code></td><td>GADS cause code</td><td>NERC standard taxonomy.</td></tr>
</table>

  `);

  const s8 = section("semantic", "🧩", "rgba(57,210,192,0.15)", "Semantic Model", `

<p>DirectLake semantic model over Gold. Measures: <em>MTBF</em>, <em>Forced Outage Hours</em>, <em>EAF</em>, <em>Anomaly Episode Count</em>, <em>Watchlist Hazard Score</em>. Refreshes are framing-only — no data movement.</p>

  `);

  const s9 = section("goldschema", "⭐", "rgba(88,166,255,0.15)", "Gold Star Schema", `

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="arch-er.svg" alt="Entity relationships between gold facts, ML tables, and the scope-asset and equipment dimensions." style="width:100%;max-width:1160px;height:auto"/></div>

  `);

  const s10 = section("lessons", "💡", "rgba(210,153,34,0.15)", "Architecture Lessons Learned", `

<ul>
  <li>Oracle <code>thick</code> mode requires Oracle Instant Client on the Spark driver — switching to <code>thin</code> mode removed the dependency and worked on Fabric serverless.</li>
  <li>Spark's date parser balks at <code>0001-01-01</code> (GADS uses it as "open ended"). Replaced with NULL on Bronze→Silver to avoid Arrow errors.</li>
  <li>Delta cannot persist <code>Infinity</code>; Cox <code>predict_median_survival_time</code> returns ∞ when survival curve never crosses 0.5. Substitute sentinel <code>999.0</code> days.</li>
  <li>Cox needs roughly 3 events per covariate; we had to prune from 32 candidate features to 11 to maintain stability.</li>
  <li>CrowdStrike Falcon on developer laptops kills long PI uploads — schedule extraction notebooks on Fabric capacity, not local Spark.</li>
</ul>

  `);

  const s11 = section("sizing", "📏", "rgba(248,81,73,0.15)", "Capacity Sizing", `

<p>Steady-state load:</p>
<ul>
  <li><strong>Bronze writes:</strong> ~50 MB/day from forwarders (compressed Delta), ~5 GB on initial PI backfill.</li>
  <li><strong>Silver scan:</strong> 200 MB/day incremental.</li>
  <li><strong>Gold rebuild:</strong> 12 min nightly on F64 capacity for full asset coverage.</li>
  <li><strong>Eventhouse retention:</strong> 30 days hot, 365 days cold via update policy to Lakehouse.</li>
</ul>

  `);

  const body = `

<h1>Architecture</h1>
<p class="subtitle">Medallion lakehouse on Microsoft Fabric. Bronze raw → Silver harmonised → Gold star schema + ML features → Semantic model + Real-Time Dashboard.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

${s7}

${s8}

${s9}

${s10}

${s11}

`;

  page("architecture.html", "Architecture", "Medallion lakehouse architecture for the Riverton OneGrid solution", body);
};
