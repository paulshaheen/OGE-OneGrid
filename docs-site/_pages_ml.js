module.exports = function(page, section) {
  const s1 = section("overview", "🧭", "rgba(88,166,255,0.15)", "Pipeline Overview", `

<p>The OneGrid stack separates conformed source data in <code>gold.*</code> from notebook outputs in <code>ml.*</code>. The recurring short-term prediction path is Phase 1 → 4; survival, AAKR, and anomaly tracks run alongside it and converge in the shared watchlist.</p>
<div class="stat-row">
  <div class="card"><div class="stat">3</div><p>Target Assets</p></div>
  <div class="card"><div class="stat">11</div><p>Gold Tables</p></div>
  <div class="card"><div class="stat">18</div><p>ML Tables</p></div>
  <div class="card"><div class="stat">320</div><p>Features / 15-min Bin</p></div>
</div>
<div class="callout warn"><strong>Phase 0 is diagnostic only.</strong> The archaeology notebooks are exploratory checks used to decide whether the asset scope is model-ready. They are not part of the regular production run.</div>
<div class="card-grid">
  <div class="card"><h4>RV2_U2_Boiler</h4><p>High-volume boiler process tags and forced-outage history. Major consumer of Phase 1-4 short-term scoring.</p></div>
  <div class="card"><h4>RV3_U3_Steam_Turbine</h4><p>Vibration, lube-oil, and thermal tags feed both short-term classifiers and long-term Cox risk ranking.</p></div>
  <div class="card"><h4>RV3_U3_Boiler_Feed_Pump_East</h4><p>Motor current, flow, and vibration signatures are used by short-term, survival, AAKR, and anomaly tracks.</p></div>
</div>

  `);

  const s2 = section("phase0", "🧪", "rgba(63,185,80,0.15)", "Phase 0 - Data Archaeology", `

<table>
  <tr><th>Notebook</th><th>Role</th><th>Checks / Outputs</th></tr>
  <tr><td><code>Phase0-Data-Archaeology</code></td><td>Diagnostic gate before modeling</td><td>Validates PI tag coverage, running indicators, GADS event alignment, and sensor density per asset. Produces a go / no-go verdict for Phase 1.</td></tr>
  <tr><td><code>Phase0b-Pipeline-Diagnostics</code></td><td>Root-cause investigation</td><td>Drills into blockers surfaced by Phase 0 such as missing tags, NULL timestamps, or missing running indicators so the data foundation can be repaired before training.</td></tr>
</table>
<p>These notebooks are used during scope validation and troubleshooting only. They are not scheduled as part of the daily or hourly production chain.</p>

  `);

  const s3 = section("shortterm", "⚡", "rgba(57,210,192,0.15)", "Phase 1-4 Short-Term Prediction Track", `

<p>The recurring batch pipeline is a four-step dependency chain. Each notebook has a single clear contract: read curated inputs, write governed <code>ml.*</code> outputs, and hand off to the next phase.</p>
<table>
  <tr><th>Phase</th><th>Notebook</th><th>Reads</th><th>Writes</th><th>Purpose</th></tr>
  <tr><td><span class="badge badge-green">Phase 1</span></td><td><code>Phase1-Label-Construction</code></td><td><code>gold.fact_gads_event</code> + <code>gold.dim_scope_asset</code></td><td><code>ml.labels</code></td><td>Builds binary stop labels at 4 h / 8 h / 24 h horizons from GADS forced-outage events using 15-minute bins. Planned events (<code>PO</code>, <code>RS</code>) are excluded.</td></tr>
  <tr><td><span class="badge badge-teal">Phase 2</span></td><td><code>Phase2-Feature-Engineering</code></td><td><code>ml.labels</code> + <code>gold.fact_pi</code> + <code>gold.bridge_pi_tag_to_asset</code></td><td><code>ml.selected_tags</code> + <code>ml.training_shortterm</code></td><td>Selects the most informative PI tags, engineers per-tag rolling features, and assembles the 15-minute training matrix.</td></tr>
  <tr><td><span class="badge badge-yellow">Phase 3</span></td><td><code>Phase3-Predictive-Model</code></td><td><code>ml.training_shortterm</code></td><td>MLflow models (RandomForest, GradientBoosting)</td><td>Trains short-term prediction models for each horizon and logs them to MLflow for reproducible promotion and scoring.</td></tr>
  <tr><td><span class="badge badge-purple">Phase 4</span></td><td><code>Phase4-Model-Scoring-Batch</code></td><td>MLflow models + Eventhouse real-time data</td><td><code>ml.predictions_shortterm</code> + <code>ml.drivers_shortterm</code></td><td>Loads models by <code>params.horizon</code> and <code>params.n_features</code>, scores the latest real-time feature state, and records both probability and top drivers.</td></tr>
</table>

<h3>Per-tag feature derivations</h3>
<table>
  <tr><th>Suffix</th><th>Meaning</th></tr>
  <tr><td><code>__v</code></td><td>Current 15-minute value.</td></tr>
  <tr><td><code>__avg1h</code></td><td>Trailing 1-hour average.</td></tr>
  <tr><td><code>__delta1h</code></td><td>Change versus 1 hour earlier.</td></tr>
  <tr><td><code>__avg4h</code></td><td>Trailing 4-hour average.</td></tr>
  <tr><td><code>__delta4h</code></td><td>Change versus 4 hours earlier.</td></tr>
  <tr><td><code>__avg8h</code></td><td>Trailing 8-hour average.</td></tr>
  <tr><td><code>__delta8h</code></td><td>Change versus 8 hours earlier.</td></tr>
  <tr><td><code>__std1h</code></td><td>Trailing 1-hour standard deviation.</td></tr>
</table>
<p>Each selected PI tag expands into these eight derivations. With roughly forty retained signals across the three target assets, <code>Phase2-Feature-Engineering</code> emits about <strong>320 engineered features per 15-minute bin</strong>.</p>

  `);

  const s4 = section("parallel", "🛤️", "rgba(210,153,34,0.15)", "Parallel Long-Term and legacy APM Tracks", `

<p>Three additional notebook families operate independently of the short-term chain. They can be run in parallel because they read the same curated conformed data but do not depend on Phase 1-4 outputs unless explicitly noted below.</p>
<table>
  <tr><th>Track</th><th>Notebook</th><th>Reads</th><th>Writes</th><th>Notes</th></tr>
  <tr><td>Long-term survival</td><td><code>Phase-LongTerm-Survival</code></td><td><code>gold.fact_pi</code> + <code>gold.fact_gads_event</code></td><td><code>ml.training_longterm</code></td><td>Builds the daily survival training panel for remaining-useful-life style modeling.</td></tr>
  <tr><td>Long-term survival</td><td><code>Phase-LongTerm-Cox</code></td><td><code>ml.training_longterm</code> + <code>gold.bridge_pi_tag_to_asset</code></td><td><code>ml.predictions_longterm</code> + <code>ml.drivers_longterm</code> + <code>ml.degradation_longterm</code> + <code>ml.watchlist</code></td><td>Fits / scores a Cox Proportional Hazards model to estimate long-term remaining useful life and fleet ranking.</td></tr>
  <tr><td>Legacy APM replacement</td><td><code>Similarity-Anomaly</code></td><td>Eventhouse + <code>gold.bridge_pi_tag_to_asset</code></td><td><code>ml.aakr_memory</code> + <code>ml.aakr_metadata</code> + <code>ml.aakr_scores</code> + <code>ml.aakr_episodes</code> + <code>ml.aakr_health</code> + <code>ml.watchlist</code></td><td>AAKR-based replacement for legacy APM-style similarity modeling and asset health scoring.</td></tr>
  <tr><td>Legacy APM analytics</td><td><code>Multivariate-Anomaly-Detection</code></td><td>Eventhouse + <code>gold.bridge_pi_tag_to_asset</code></td><td><code>ml.anomaly_advisories</code> + <code>ml.anomaly_baselines</code> + <code>ml.anomaly_multivariate</code> + <code>ml.watchlist</code></td><td>Produces baseline-aware anomaly advisories and multivariate drift signals that complement AAKR.</td></tr>
</table>

  `);

  const s5 = section("dependencies", "🔗", "rgba(188,140,255,0.15)", "Run Order &amp; Dependencies", `

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="ml-dag.svg" alt="The four-phase short-term chain plus parallel survival, AAKR, and anomaly tracks converge on the unified watchlist." style="width:100%;max-width:980px;height:auto"/></div>
<div class="callout success">Tracks 1-4, Survival, AAKR, and Anomaly are independent and can run in parallel. Only the sequential chains inside each track must preserve order.</div>

  `);

  const s6 = section("schema", "🗃️", "rgba(248,81,73,0.15)", "Schema: gold vs ml", `

<table>
  <tr><th>Layer</th><th>Count</th><th>Role</th><th>Examples</th></tr>
  <tr><td><code>gold.*</code></td><td>11 tables</td><td>Conformed facts, dimensions, and bridges used as authoritative modeling inputs.</td><td><code>gold.fact_pi</code>, <code>gold.fact_gads_event</code>, <code>gold.fact_cm_measurement</code>, <code>gold.bridge_pi_tag_to_asset</code>, <code>gold.dim_equipment</code>, <code>gold.dim_scope_asset</code></td></tr>
  <tr><td><code>ml.*</code></td><td>18 tables</td><td>Notebook outputs for labels, training sets, predictions, driver explanations, health scores, and watchlist records.</td><td><code>ml.labels</code>, <code>ml.training_shortterm</code>, <code>ml.predictions_shortterm</code>, <code>ml.watchlist</code></td></tr>
</table>

<h3>Key gold tables</h3>
<table>
  <tr><th>Table</th><th>Purpose</th></tr>
  <tr><td><code>gold.fact_pi</code></td><td>Primary conformed PI fact table at modeling grain; approximately 135M rows.</td></tr>
  <tr><td><code>gold.fact_gads_event</code></td><td>Forced outage / derate history used to build labels and long-term event observations.</td></tr>
  <tr><td><code>gold.fact_cm_measurement</code></td><td>Condition-monitoring measurements used for asset context and later enrichment.</td></tr>
  <tr><td><code>gold.bridge_pi_tag_to_asset</code></td><td>Canonical mapping from PI tag names to target assets.</td></tr>
  <tr><td><code>gold.dim_equipment</code></td><td>Equipment metadata and engineering descriptors.</td></tr>
  <tr><td><code>gold.dim_scope_asset</code></td><td>Explicit in-scope asset list for labeling and model targeting.</td></tr>
</table>

<h3>Most referenced ML outputs</h3>
<table>
  <tr><th>Table</th><th>Role</th></tr>
  <tr><td><code>ml.labels</code></td><td>Binary 4 h / 8 h / 24 h stop labels from GADS forced outage events.</td></tr>
  <tr><td><code>ml.training_shortterm</code></td><td>Feature-engineered 15-minute training matrix for short-term models.</td></tr>
  <tr><td><code>ml.predictions_shortterm</code></td><td>Batch-scored short-horizon probabilities by asset and model horizon.</td></tr>
  <tr><td><code>ml.watchlist</code></td><td>Unified action table consumed by reporting and alerting across model families.</td></tr>
</table>

  `);

  const s7 = section("watchlist", "👁️", "rgba(88,166,255,0.15)", "Unified Watchlist", `

<p>All three model families - Cox, AAKR, and anomaly detection - write standardized rows to <code>ml.watchlist</code>. This gives Power BI, downstream alerting, and operator triage one schema to consume regardless of which notebook produced the advisory.</p>
<pre><code>model_name, scoring_date, asset_id, feature, tag_name, descriptor, engineering_units,
current_value, baseline_mean, baseline_std, normal_range_low, normal_range_high,
risk_contribution, trend_direction, trend_slope_per_day, recommended_action,
recommendation_text, watch_horizon_days, model_run_timestamp, notebook_run_id</code></pre>
<ul>
  <li><strong>Cox:</strong> long-horizon fleet-risk rows for maintenance planning.</li>
  <li><strong>AAKR:</strong> residual-driven health and episode rows for legacy APM-style monitoring.</li>
  <li><strong>Anomaly:</strong> advisory rows describing baseline breaks or multivariate drift.</li>
</ul>

  `);

  const body = `

<h1>OneGrid ML Pipeline</h1>
<p class="subtitle">Fabric notebook reference for the Riverton solution: one-time data archaeology, Phase 1-4 short-term prediction, and parallel long-term survival plus legacy APM analytics tracks.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

${s7}

`;

  page("ml-pipeline.html", "ML Pipeline", "Fabric notebook pipeline for labels, features, short-term scoring, survival, and anomaly analytics", body);
};
