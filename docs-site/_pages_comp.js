module.exports = function(page, section) {
  const s1 = section("comparison", "📊", "rgba(88,166,255,0.15)", "Side-by-Side Comparison", `
    <table>
      <tr>
        <th>Aspect</th>
        <th><span class="badge badge-blue">Short-Term ML</span></th>
        <th><span class="badge badge-purple">Cox Survival</span></th>
        <th><span class="badge badge-teal">AAKR</span></th>
        <th><span class="badge badge-green">Legacy APM Anomaly</span></th>
      </tr>
      <tr>
        <td><strong>Question Answered</strong></td>
        <td>Will a forced stop or derate happen in the next 4h / 8h / 24h?</td>
        <td>How many days until the next forced outage?</td>
        <td>Is this sensor behaving abnormally compared to its learned normal pattern?</td>
        <td>Are legacy APM residuals indicating emerging equipment degradation?</td>
      </tr>
      <tr>
        <td><strong>Method</strong></td>
        <td>Supervised ML — RandomForest, GBM, XGBoost with class weighting</td>
        <td>Semi-parametric — Cox PH model with Kaplan-Meier baseline</td>
        <td>Unsupervised — Auto-Associative Kernel Regression</td>
        <td>Empirical — Similarity-based AAKR (vendor implementation) with z-score overlay</td>
      </tr>
      <tr>
        <td><strong>Data Sources</strong></td>
        <td><code>gold.fact_gads_event</code> → labels<br><code>gold.fact_pi</code> → features</td>
        <td><code>gold.fact_gads_event</code> directly<br><code>gold.fact_pi</code> → daily features</td>
        <td><code>PiEvents</code> from Eventhouse<br>GADS for running gates only</td>
        <td>Legacy APM residuals from Eventhouse</td>
      </tr>
      <tr>
        <td><strong>Uses GADS Labels?</strong></td>
        <td>✅ Yes — Phase 1 builds binary 15-min labels</td>
        <td>❌ No — reads raw events for survival intervals</td>
        <td>⚠️ Only for running-state gates (on/off)</td>
        <td>❌ No</td>
      </tr>
      <tr>
        <td><strong>Output Tables</strong></td>
        <td><code>ml.predictions_shortterm</code><br><code>ml.shap_explanations</code></td>
        <td><code>ml.predictions_longterm</code><br><code>ml.watchlist</code></td>
        <td><code>ml.watchlist</code><br><code>ml.aakr_episodes</code></td>
        <td><code>ml.watchlist</code></td>
      </tr>
      <tr>
        <td><strong>Granularity</strong></td>
        <td>Asset-level, 15-minute bins</td>
        <td>Asset-level, daily resolution</td>
        <td>Sensor-level, per scoring window</td>
        <td>Sensor-level, per scoring window</td>
      </tr>
      <tr>
        <td><strong>Time Horizon</strong></td>
        <td>4h, 8h, 24h (two tracks: stop + derate)</td>
        <td>Days to weeks (14-day censoring)</td>
        <td>Current state</td>
        <td>Current state</td>
      </tr>
      <tr>
        <td><strong>Target Assets</strong></td>
        <td>RV2_U2_Boiler, LG3_U3 (merged)</td>
        <td>RV2_U2_Boiler, RV3_U3_Steam_Turbine, LG3_U3_BFP_East</td>
        <td>Same as Cox</td>
        <td>Same as Cox</td>
      </tr>
      <tr>
        <td><strong>Running-State Gate</strong></td>
        <td>Not needed (training data only)</td>
        <td>✅ Eventhouse check — skips stopped assets</td>
        <td>✅ Eventhouse check — skips stopped assets</td>
        <td>❌ Not implemented</td>
      </tr>
      <tr>
        <td><strong>Key Strengths</strong></td>
        <td>Direct failure probability, SHAP explainability, fast 15-min scoring</td>
        <td>Long-range forecasting, interpretable hazard ratios, no class imbalance</td>
        <td>No labels needed, catches novel failure modes, sensor-specific diagnostics</td>
        <td>Vendor-validated models, low false positives when tuned</td>
      </tr>
      <tr>
        <td><strong>Key Limitations</strong></td>
        <td>Requires labeled history, class imbalance (~0.3–0.5%), 8h/24h temporal shift</td>
        <td>Proportional hazards assumption, ~50 feature max, needs sufficient events</td>
        <td>Can false-alarm on process changes, requires "normal" history</td>
        <td>Binary anomaly (no probability), dependent on legacy APM model quality</td>
      </tr>
      <tr>
        <td><strong>Refresh Cadence</strong></td>
        <td>Every 15 minutes (Phase 4 real-time)</td>
        <td>Daily</td>
        <td>On-demand / scheduled</td>
        <td>On-demand / scheduled</td>
      </tr>
    </table>
  `);

  const s2 = section("data-flow", "🔀", "rgba(188,140,255,0.15)", "Data Flow Diagram", `
    <p>Each model track reads from different sources and produces different outputs. Only the Short-Term ML pipeline (Phase 1→4) uses Phase 1 labels. All other tracks read raw data directly.</p>
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="comp-tracks.svg" alt="Sources feed the short-term chain, Cox survival, and anomaly detectors; all model families converge into shared outputs and the watchlist." style="width:100%;max-width:1180px;height:auto"/></div>
    <div class="callout">
      <strong>Key insight:</strong> The <code>ml.watchlist</code> table is the convergence point — Cox, AAKR, and Anomaly all write to it using the same 20-column schema. The <code>model_name</code> column distinguishes the source.
    </div>
  `);

  const s3 = section("roles", "🛡️", "rgba(63,185,80,0.15)", "Complementary Roles — Defense in Depth", `
    <p>The four model tracks form a layered defense system. No single model provides complete coverage — together they address different time horizons, failure modes, and granularity levels.</p>
    <div class="card-grid">
      <div class="card">
        <h4>⚡ Short-Term ML</h4>
        <p><strong>"Something bad is coming in hours"</strong></p>
        <p>Early warning system. Provides probability of forced stop or derate within 4/8/24 hours. SHAP values explain which sensors are driving the prediction.</p>
        <p style="margin-top:8px"><span class="badge badge-blue">EARLY WARNING</span></p>
      </div>
      <div class="card">
        <h4>📈 Cox Survival</h4>
        <p><strong>"How many days until the next outage"</strong></p>
        <p>Maintenance planning horizon. Estimates time-to-event for each asset with hazard ratios showing which factors accelerate or delay failures.</p>
        <p style="margin-top:8px"><span class="badge badge-purple">PLANNING</span></p>
      </div>
      <div class="card">
        <h4>🔬 AAKR</h4>
        <p><strong>"This specific sensor is behaving abnormally"</strong></p>
        <p>Root cause identification. Learns normal multi-sensor patterns and flags individual sensors whose readings deviate from expected values.</p>
        <p style="margin-top:8px"><span class="badge badge-teal">ROOT CAUSE</span></p>
      </div>
      <div class="card">
        <h4>🔍 legacy APM Anomaly</h4>
        <p><strong>"Vendor model confirms degradation pattern"</strong></p>
        <p>Independent validation. Uses GE legacy APM's empirical (data-driven AAKR) residuals to confirm or corroborate anomalies detected by other models.</p>
        <p style="margin-top:8px"><span class="badge badge-green">VALIDATION</span></p>
      </div>
    </div>
    <div class="callout success">
      <strong>Operational scenario:</strong> Short-Term ML raises a 4h alert (78% stop probability) → Cox confirms the asset's 7-day survival is declining → AAKR watchlist identifies the specific bearing temperature driving the anomaly → legacy APM residuals confirm the same sensor is abnormal. All four converge on the same problem from different angles.
    </div>
  `);

  const s4 = section("schemas", "📋", "rgba(57,210,192,0.15)", "Output Schema Comparison", `
    <h3>ml.predictions_shortterm <span class="badge badge-blue">Phase 4</span></h3>
    <table>
      <tr><th>Column</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>asset_id</code></td><td>string</td><td>Target asset identifier</td></tr>
      <tr><td><code>timestamp</code></td><td>timestamp</td><td>Scoring timestamp</td></tr>
      <tr><td><code>horizon</code></td><td>string</td><td>Prediction window: 4h, 8h, 24h</td></tr>
      <tr><td><code>label_type</code></td><td>string</td><td><code>stop</code> or <code>derate</code></td></tr>
      <tr><td><code>probability</code></td><td>double</td><td>Predicted probability of event</td></tr>
      <tr><td><code>model_name</code></td><td>string</td><td>Algorithm used (RF, GBM, XGB)</td></tr>
    </table>

    <h3>ml.predictions_longterm <span class="badge badge-purple">Cox</span></h3>
    <table>
      <tr><th>Column</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>asset_id</code></td><td>string</td><td>Target asset identifier</td></tr>
      <tr><td><code>scoring_date</code></td><td>date</td><td>Date of scoring</td></tr>
      <tr><td><code>risk_score</code></td><td>double</td><td>Partial hazard (higher = more risk)</td></tr>
      <tr><td><code>survival_probability_7d</code></td><td>double</td><td>Probability of surviving 7 days</td></tr>
      <tr><td><code>survival_probability_14d</code></td><td>double</td><td>Probability of surviving 14 days</td></tr>
      <tr><td><code>predicted_median_survival_days</code></td><td>double</td><td>Median days to event (999 = never)</td></tr>
      <tr><td><code>risk_level</code></td><td>string</td><td>CRITICAL / HIGH / MEDIUM / LOW</td></tr>
    </table>

    <h3>ml.watchlist <span class="badge badge-teal">Unified — 20 columns</span></h3>
    <p>Shared by Cox, AAKR, and Anomaly. The <code>model_name</code> column distinguishes the source.</p>
    <table>
      <tr><th>Column</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>model_name</code></td><td>string</td><td>CoxPH_LongTerm, AAKR_legacy APM, legacy APM_Anomaly</td></tr>
      <tr><td><code>scoring_date</code></td><td>string</td><td>Date of analysis</td></tr>
      <tr><td><code>asset_id</code></td><td>string</td><td>Target asset</td></tr>
      <tr><td><code>feature</code></td><td>string</td><td>Feature name (sanitized)</td></tr>
      <tr><td><code>tag_name</code></td><td>string</td><td>Original PI tag name</td></tr>
      <tr><td><code>descriptor</code></td><td>string</td><td>Human-readable tag description</td></tr>
      <tr><td><code>engineering_units</code></td><td>string</td><td>Units (Deg F, PSI, etc.)</td></tr>
      <tr><td><code>current_value</code></td><td>double</td><td>Latest sensor reading</td></tr>
      <tr><td><code>baseline_mean</code></td><td>double</td><td>30-day baseline average</td></tr>
      <tr><td><code>baseline_std</code></td><td>double</td><td>30-day baseline std deviation</td></tr>
      <tr><td><code>normal_range_low</code></td><td>double</td><td>5th percentile (normal)</td></tr>
      <tr><td><code>normal_range_high</code></td><td>double</td><td>95th percentile (normal)</td></tr>
      <tr><td><code>risk_contribution</code></td><td>double</td><td>How much this sensor drives risk</td></tr>
      <tr><td><code>trend_direction</code></td><td>string</td><td>RISING / FALLING / STABLE</td></tr>
      <tr><td><code>trend_slope_per_day</code></td><td>double</td><td>Rate of change per day</td></tr>
      <tr><td><code>recommended_action</code></td><td>string</td><td>INVESTIGATE / MONITOR / WATCH / LOW</td></tr>
      <tr><td><code>recommendation_text</code></td><td>string</td><td>Human-readable recommendation</td></tr>
      <tr><td><code>watch_horizon_days</code></td><td>int</td><td>Monitoring window (days)</td></tr>
      <tr><td><code>model_run_timestamp</code></td><td>timestamp</td><td>When the model was executed</td></tr>
      <tr><td><code>notebook_run_id</code></td><td>string</td><td>UUID for this notebook execution</td></tr>
    </table>

    <h3>ml.shap_explanations <span class="badge badge-blue">Phase 4</span></h3>
    <table>
      <tr><th>Column</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>scoring_ts</code></td><td>timestamp</td><td>Scoring timestamp</td></tr>
      <tr><td><code>asset_id</code></td><td>string</td><td>Target asset</td></tr>
      <tr><td><code>horizon</code></td><td>string</td><td>4h, 8h, 24h</td></tr>
      <tr><td><code>feature</code></td><td>string</td><td>Feature name</td></tr>
      <tr><td><code>shap_value</code></td><td>double</td><td>SHAP contribution to prediction</td></tr>
    </table>
  `);

  const s5 = section("decision-guide", "🎯", "rgba(210,153,34,0.15)", "When to Trust Which Model", `
    <div class="callout success">
      <strong>4-hour horizon, high confidence:</strong> Use the <strong>Short-Term ML stop model</strong>. It has a test ROC-AUC of 0.902 — the most reliable production model for imminent failure prediction.
    </div>
    <div class="callout">
      <strong>Planning maintenance windows:</strong> Use <strong>Cox Survival</strong>. It provides days-ahead forecasting with 7-day and 14-day survival probabilities, ideal for scheduling outages and allocating crews.
    </div>
    <div class="callout">
      <strong>Investigating specific sensors:</strong> Use <strong>AAKR + Anomaly watchlist</strong>. Both provide sensor-level alerts with current values, baselines, and recommended actions. AAKR catches novel patterns; Anomaly validates against legacy APM.
    </div>
    <div class="callout warn">
      <strong>8h/24h predictions:</strong> Use with caution. These horizons show significant temporal distribution shift (CV-to-test ROC gap). The 4h model remains the reliable choice for operational decisions.
    </div>
    <div class="callout">
      <strong>Novel or unknown failure modes:</strong> Trust <strong>AAKR</strong> — it's unsupervised and can detect patterns never seen in training data. Supervised models (Short-Term ML, Cox) can only predict failure modes present in their training history.
    </div>
  `);

  const s6 = section("cadence", "⏱️", "rgba(248,81,73,0.15)", "Operational Cadence", `
    <table>
      <tr>
        <th>Model</th>
        <th>Notebook</th>
        <th>Refresh</th>
        <th>Compute</th>
        <th>Dependencies</th>
      </tr>
      <tr>
        <td><span class="badge badge-blue">Phase 4 Scoring</span></td>
        <td><code>Phase4-Model-Scoring-Batch</code></td>
        <td>Every 15 minutes</td>
        <td>~2 min per run</td>
        <td>Requires Phase 3 trained models + Eventhouse live data</td>
      </tr>
      <tr>
        <td><span class="badge badge-blue">Phase 3 Training</span></td>
        <td><code>Phase3-Predictive-Model</code></td>
        <td>Weekly / on data change</td>
        <td>~15–30 min</td>
        <td>Requires Phase 2 training dataset</td>
      </tr>
      <tr>
        <td><span class="badge badge-purple">Cox Survival</span></td>
        <td><code>Phase-LongTerm-Cox</code></td>
        <td>Daily</td>
        <td>~10 min</td>
        <td>gold.fact_gads_event + gold.fact_pi</td>
      </tr>
      <tr>
        <td><span class="badge badge-teal">AAKR</span></td>
        <td><code>AAKR-Similarity-Anomaly</code></td>
        <td>On-demand / scheduled</td>
        <td>~5–10 min</td>
        <td>Eventhouse PiEvents + running-state gate</td>
      </tr>
      <tr>
        <td><span class="badge badge-green">Legacy APM Anomaly</span></td>
        <td><code>Multivariate-Anomaly-Detection</code></td>
        <td>On-demand / scheduled</td>
        <td>~3–5 min</td>
        <td>Eventhouse legacy APM residuals</td>
      </tr>
    </table>
    <div class="callout">
      <strong>Pipeline order:</strong> Phase 1 → Phase 2 → Phase 3 → Phase 4 (sequential). Cox, AAKR, and Anomaly run independently and can execute in parallel with the Phase pipeline.
    </div>
  `);

  const body = `

<h1>Model Comparison</h1>
<p class="subtitle">Side-by-side comparison of all four predictive model tracks — how they differ, what they share, and when to use each one.</p>

<!-- Section 1: Side-by-Side Comparison -->
${s1}

<!-- Section 2: Data Flow -->
${s2}

<!-- Section 3: Complementary Roles -->
${s3}

<!-- Section 4: Output Schema -->
${s4}

<!-- Section 5: When to Trust Which Model -->
${s5}

<!-- Section 6: Operational Cadence -->
${s6}

`;

  page("model-comparison.html", "Model Comparison", "Side-by-side comparison of all predictive model tracks: Short-Term ML, Cox Survival, AAKR, and legacy APM Anomaly", body);
};
