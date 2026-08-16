module.exports = function(page, section) {
  const s1 = section("naming", "🏷️", "rgba(88,166,255,0.15)", "Naming Conventions", `

<ul>
  <li><code>gold.*</code> - conformed fact, dimension, and bridge tables used as authoritative modeling inputs.</li>
  <li><code>ml.*</code> - outputs produced by Fabric notebooks for labels, training sets, predictions, drivers, health, and watchlist advisories.</li>
  <li>Legacy prefixes such as <code>surv_*</code> and <code>anom_*</code> are historical documentation terms only; current persisted outputs are documented here under <code>ml.*</code>.</li>
</ul>

  `);

  const s2 = section("summary", "📋", "rgba(63,185,80,0.15)", "Schema Summary", `

<div class="stat-row">
  <div class="card"><div class="stat">11</div><p>Gold Tables</p></div>
  <div class="card"><div class="stat">19</div><p>ML Tables</p></div>
  <div class="card"><div class="stat">135M</div><p><code>gold.fact_pi</code> Rows</p></div>
  <div class="card"><div class="stat">3</div><p>Model Families</p></div>
</div>
<table>
  <tr><th>Layer</th><th>Purpose</th><th>Key examples</th></tr>
  <tr><td><code>gold.*</code></td><td>Curated business-ready facts, dimensions, and bridges used across short-term, survival, and anomaly notebooks.</td><td><code>gold.fact_pi</code>, <code>gold.fact_gads_event</code>, <code>gold.fact_cm_measurement</code>, <code>gold.bridge_pi_tag_to_asset</code>, <code>gold.dim_equipment</code>, <code>gold.dim_scope_asset</code></td></tr>
  <tr><td><code>ml.*</code></td><td>Persisted machine-learning products and diagnostics written by notebook runs.</td><td><code>ml.labels</code>, <code>ml.training_shortterm</code>, <code>ml.predictions_shortterm</code>, <code>ml.watchlist</code></td></tr>
</table>

  `);

  const s3 = section("gold", "⭐", "rgba(57,210,192,0.15)", "Key <code>gold.*</code> Tables", `

<p>The conformed layer contains 11 tables in total. The tables below are the most important inputs to the OneGrid notebooks.</p>
<table>
  <tr><th>Table</th><th>Grain</th><th>Description</th></tr>
  <tr><td><code>gold.fact_pi</code></td><td>Tag / asset / 15-minute bin</td><td>Primary process historian fact table; approximately 135M rows used for feature engineering and survival covariates.</td></tr>
  <tr><td><code>gold.fact_gads_event</code></td><td>One row per GADS event</td><td>Forced outage and derate event history used for labels and survival event observations.</td></tr>
  <tr><td><code>gold.fact_cm_measurement</code></td><td>Asset / observation</td><td>Condition-monitoring measurements and inspection context for downstream enrichment.</td></tr>
  <tr><td><code>gold.bridge_pi_tag_to_asset</code></td><td>Tag to scope asset</td><td>Canonical mapping between PI tags and the three modeling assets.</td></tr>
  <tr><td><code>gold.dim_equipment</code></td><td>Equipment</td><td>Engineering metadata, descriptors, and equipment hierarchy context.</td></tr>
  <tr><td><code>gold.dim_scope_asset</code></td><td>Scope asset</td><td>Defines the target asset population and modeling identifiers.</td></tr>
</table>
<div class="callout">Additional gold tables provide supporting dimensions and lookup structures, bringing the conformed layer to 11 total tables.</div>

  `);

  const s4 = section("ml", "🤖", "rgba(210,153,34,0.15)", "<code>ml.*</code> Inventory", `

<table>
  <tr><th>Table</th><th>Produced by</th><th>Description</th></tr>
  <tr><td><code>ml.labels</code></td><td>Phase1-Label-Construction</td><td>Binary 4 h / 8 h / 24 h forced-stop labels from GADS events.</td></tr>
  <tr><td><code>ml.selected_tags</code></td><td>Phase2-Feature-Engineering</td><td>Selected PI tags retained for short-term feature generation.</td></tr>
  <tr><td><code>ml.training_shortterm</code></td><td>Phase2-Feature-Engineering</td><td>15-minute feature matrix for short-term training.</td></tr>
  <tr><td><code>ml.predictions_shortterm</code></td><td>Phase4-Model-Scoring-Batch</td><td>Short-horizon prediction scores by asset and horizon.</td></tr>
  <tr><td><code>ml.drivers_shortterm</code></td><td>Phase4-Model-Scoring-Batch</td><td>Top driver features explaining each short-term score.</td></tr>
  <tr><td><code>ml.training_longterm</code></td><td>Phase-LongTerm-Survival</td><td>Daily survival panel for Cox modeling.</td></tr>
  <tr><td><code>ml.predictions_longterm</code></td><td>Phase-LongTerm-Cox</td><td>Long-horizon survival / hazard predictions.</td></tr>
  <tr><td><code>ml.drivers_longterm</code></td><td>Phase-LongTerm-Cox</td><td>Covariate contributions behind long-term risk.</td></tr>
  <tr><td><code>ml.degradation_longterm</code></td><td>Phase-LongTerm-Cox</td><td>Trend summaries describing long-run degradation.</td></tr>
  <tr><td><code>ml.watchlist</code></td><td>Cox, AAKR, Anomaly</td><td>Unified 20-column advisory table consumed by reporting and alerting.</td></tr>
  <tr><td><code>ml.aakr_memory</code></td><td>Similarity-Anomaly</td><td>AAKR memory matrix / reference library.</td></tr>
  <tr><td><code>ml.aakr_metadata</code></td><td>Similarity-Anomaly</td><td>AAKR model metadata such as selected tags and parameters.</td></tr>
  <tr><td><code>ml.aakr_scores</code></td><td>Similarity-Anomaly</td><td>Per-bin AAKR residual scores.</td></tr>
  <tr><td><code>ml.aakr_episodes</code></td><td>Similarity-Anomaly</td><td>AAKR episode-level summaries.</td></tr>
  <tr><td><code>ml.aakr_health</code></td><td>Similarity-Anomaly</td><td>Asset health rollups derived from AAKR behavior.</td></tr>
  <tr><td><code>ml.anomaly_advisories</code></td><td>Multivariate-Anomaly-Detection</td><td>Human-readable anomaly advisories and recommended actions.</td></tr>
  <tr><td><code>ml.anomaly_baselines</code></td><td>Multivariate-Anomaly-Detection</td><td>Baseline statistics and expected operating ranges.</td></tr>
  <tr><td><code>ml.anomaly_multivariate</code></td><td>Multivariate-Anomaly-Detection</td><td>Multivariate anomaly scores and covariance-break signals.</td></tr>
  <tr><td><code>ml.daily_narrative</code></td><td>Phase5-Daily-Narrative</td><td>HTML briefing with priority actions and per-sensor trends for Power BI.</td></tr>
</table>

  `);

  const s5 = section("mapping", "🔁", "rgba(188,140,255,0.15)", "Legacy to Current Mapping", `

<table>
  <tr><th>Legacy documentation term</th><th>Current table</th></tr>
  <tr><td><code>surv_panel_daily</code></td><td><code>ml.training_longterm</code></td></tr>
  <tr><td><code>surv_watchlist</code></td><td><code>ml.watchlist</code></td></tr>
  <tr><td><code>anom_aakr_scores</code></td><td><code>ml.aakr_scores</code></td></tr>
  <tr><td><code>anom_episodes</code></td><td><code>ml.aakr_episodes</code></td></tr>
  <tr><td><code>anom_health_score</code></td><td><code>ml.aakr_health</code></td></tr>
  <tr><td><code>anom_pca_residuals</code> / <code>anom_z_scores</code></td><td><code>ml.anomaly_multivariate</code> and <code>ml.anomaly_baselines</code> depending on content</td></tr>
</table>

  `);

  const s6 = section("meta", "📓", "rgba(248,81,73,0.15)", "Metadata &amp; Lineage", `

<p>Notebook runs are tracked in operational metadata tables with run identifiers, timestamps, row counts, and upstream / downstream lineage. The important documentation point is that the persisted analytical contract for modeling outputs is now the <code>ml.*</code> schema, not legacy <code>surv_*</code> or <code>anom_*</code> naming.</p>

  `);

  const s_eh = section("eventhouse", "🔥", "rgba(57,210,192,0.15)", "Eventhouse Tables", `

<table>
  <tr><th>Table</th><th>Source</th><th>Description</th></tr>
  <tr><td><code>PiEvents</code></td><td>PIFabricForwarder</td><td>Real-time PI tag samples (30-day hot tier).</td></tr>
  <tr><td><code>Legacy APMIncidentsRaw</code></td><td>legacy-APM SDK</td><td>Incident records with tag, priority, actual/expected/residual.</td></tr>
  <tr><td><code>Legacy APMDiagnosticsRaw</code></td><td>legacy-APM SDK</td><td>Contributing tag analysis per incident.</td></tr>
  <tr><td><code>Legacy APMObservationsRaw</code></td><td>legacy-APM SDK</td><td>Rule-firing observation events.</td></tr>
  <tr><td><code>CROWOutages</code></td><td>ISO outage portal</td><td>Unit-level outage records (OOS + derates) from the ISO/RTO.</td></tr>
</table>

  `);

  const body = `

<h1>Data Dictionary</h1>
<p class="subtitle">Reference inventory for the Riverton conformed <code>gold.*</code> layer and the downstream <code>ml.*</code> pipeline outputs.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

${s_eh}

`;

  page("data-dictionary.html", "Data Dictionary", "Reference inventory for conformed gold.* tables and ml.* pipeline outputs", body);
};
