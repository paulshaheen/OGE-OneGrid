module.exports = function(page, section) {
  const s1 = section("why", "❓", "rgba(88,166,255,0.15)", "Why Survival, Not Short-Horizon Classification", `

<p>The short-term classifier is optimized for imminent stop prediction. When the planning question becomes days-to-weeks instead of hours, the better formulation is time-to-event under censoring. Survival analysis models whether an asset is drifting into an elevated-risk regime rather than asking for a single near-term yes / no label.</p>
<ul>
  <li>Uses all observed operating history, including censored periods where the asset never failed during the window.</li>
  <li>Produces interpretable hazard ratios that operations and reliability teams can rank.</li>
  <li>Publishes a standardized long-horizon advisory into <code>ml.watchlist</code> alongside anomaly and AAKR signals.</li>
</ul>

  `);

  const s2 = section("flow", "🛤️", "rgba(63,185,80,0.15)", "Notebook Flow", `

<table>
  <tr><th>Notebook</th><th>Reads</th><th>Writes</th><th>Purpose</th></tr>
  <tr><td><code>Phase-LongTerm-Survival</code></td><td><code>gold.fact_pi</code> + <code>gold.fact_gads_event</code></td><td><code>ml.training_longterm</code></td><td>Creates the long-term survival panel from conformed process history and outage events.</td></tr>
  <tr><td><code>Phase-LongTerm-Cox</code></td><td><code>ml.training_longterm</code> + <code>gold.bridge_pi_tag_to_asset</code></td><td><code>ml.predictions_longterm</code> + <code>ml.drivers_longterm</code> + <code>ml.degradation_longterm</code> + <code>ml.watchlist</code></td><td>Fits and scores a Cox Proportional Hazards model, decomposes top drivers, and publishes maintenance-oriented watchlist rows.</td></tr>
</table>
<div class="callout">This track runs in parallel with Phase 1-4 short-term scoring. Its only required upstream dependency is curated <code>gold.*</code> input data.</div>

  `);

  const s3 = section("training", "📅", "rgba(57,210,192,0.15)", "<code>ml.training_longterm</code> Survival Panel", `

<p><code>Phase-LongTerm-Survival</code> reshapes conformed PI and GADS history into a daily panel suitable for Cox modeling. Each row represents an asset-day with time-varying covariates and an event indicator.</p>
<table>
  <tr><th>Column</th><th>Description</th></tr>
  <tr><td><code>asset_id</code></td><td>Target asset identifier such as <code>RV2_U2_Boiler</code>.</td></tr>
  <tr><td><code>observation_date</code></td><td>Daily grain for long-horizon modeling.</td></tr>
  <tr><td><code>duration_days</code></td><td>Days since last failure / reset point.</td></tr>
  <tr><td><code>event_observed</code></td><td>1 when a forced outage event occurs on that day, else 0.</td></tr>
  <tr><td><code>covariate_*</code></td><td>Aggregated PI-derived stress indicators and regime descriptors used by the Cox model.</td></tr>
</table>
<p>The long-term training set is intentionally separate from <code>ml.training_shortterm</code> because it solves a different prediction problem and uses daily rather than 15-minute grain.</p>

  `);

  const s4 = section("cox", "📐", "rgba(210,153,34,0.15)", "Cox Proportional Hazards Outputs", `

<pre><code>from lifelines import CoxPHFitter
cph = CoxPHFitter(penalizer=0.01, l1_ratio=0.0)
cph.fit(training_longterm,
        duration_col='duration_days',
        event_col='event_observed')</code></pre>
<table>
  <tr><th>Output table</th><th>Meaning</th></tr>
  <tr><td><code>ml.predictions_longterm</code></td><td>Per-asset long-horizon risk scores and survival estimates from the latest Cox scoring run.</td></tr>
  <tr><td><code>ml.drivers_longterm</code></td><td>Driver decomposition showing which covariates contributed most to elevated hazard.</td></tr>
  <tr><td><code>ml.degradation_longterm</code></td><td>Trend-oriented deterioration summaries used for condition-based planning.</td></tr>
  <tr><td><code>ml.watchlist</code></td><td>Standardized actionable rows for Power BI and alerting, written with the same 20-column contract used by anomaly tracks.</td></tr>
</table>
<p><strong>C-index on hold-out: 0.68.</strong> The model is intended for relative risk ranking and maintenance prioritization, not exact failure-time prediction.</p>

  `);

  const s5 = section("watchlist", "👁️", "rgba(188,140,255,0.15)", "Watchlist Integration", `

<p>The Cox track publishes planning-oriented advisories to <code>ml.watchlist</code>. Typical long-term rows include the asset, dominant driver feature, current covariate value, contribution to risk, slope direction, and recommended maintenance action.</p>
<table>
  <tr><th>Rank band</th><th>Planning action</th></tr>
  <tr><td><span class="badge badge-red">Highest risk</span></td><td>Immediate engineering review and outage-readiness planning.</td></tr>
  <tr><td><span class="badge badge-yellow">Elevated</span></td><td>Near-term inspection, trend review, and work package preparation.</td></tr>
  <tr><td><span class="badge badge-blue">Monitor</span></td><td>Continue surveillance and compare with anomaly / AAKR evidence.</td></tr>
  <tr><td><span class="badge badge-green">Stable</span></td><td>No long-horizon action required.</td></tr>
</table>
<div class="callout success">Because the watchlist schema is shared, a Cox advisory for <code>RV3_U3_Boiler_Feed_Pump_East</code> can be displayed next to AAKR and anomaly advisories without any downstream schema branching.</div>

  `);

  const s6 = section("scope", "🎯", "rgba(248,81,73,0.15)", "Assets in Scope", `

<div class="card-grid">
  <div class="card"><h4>RV2_U2_Boiler</h4><p>Boiler process stressors and outage history support long-horizon boiler health ranking.</p></div>
  <div class="card"><h4>RV3_U3_Steam_Turbine</h4><p>Thermal and vibration covariates contribute to turbine hazard estimation.</p></div>
  <div class="card"><h4>RV3_U3_Boiler_Feed_Pump_East</h4><p>Electrical and vibration covariates make this asset a strong candidate for degradation tracking.</p></div>
</div>

  `);

  const body = `

<h1>Long-Term Survival Models</h1>
<p class="subtitle">The long-horizon track is a two-notebook chain: <code>Phase-LongTerm-Survival</code> prepares <code>ml.training_longterm</code>, then <code>Phase-LongTerm-Cox</code> scores Cox risk into <code>ml.predictions_longterm</code>, driver tables, degradation summaries, and the shared <code>ml.watchlist</code>.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

`;

  page("survival-models.html", "Survival Models", "Cox PH survival analysis and Kaplan-Meier baselines", body);
};
