module.exports = function(page, section) {
  const s1 = section("strategy", "🧭", "rgba(88,166,255,0.15)", "Detection Strategy", `

<p>Single-method anomaly detection is brittle. The Riverton solution keeps the legacy APM-style AAKR replacement separate from the broader anomaly notebook so each track can specialize, retrain independently, and still publish to the same downstream watchlist.</p>
<table>
  <tr><th>Track</th><th>Notebook</th><th>Primary purpose</th></tr>
  <tr><td>AAKR replacement</td><td><code>Similarity-Anomaly</code></td><td>Nearest-neighbor reconstruction and health scoring that mimics legacy APM's similarity-based monitoring style.</td></tr>
  <tr><td>Anomaly advisories</td><td><code>Multivariate-Anomaly-Detection</code></td><td>Baseline-aware univariate and multivariate drift detection with advisory narratives and standardized actions.</td></tr>
</table>

  `);

  const s2 = section("aakr", "🧠", "rgba(63,185,80,0.15)", "<code>Similarity-Anomaly</code> (AAKR)", `

<p>The AAKR notebook reads Eventhouse telemetry plus <code>gold.bridge_pi_tag_to_asset</code> so every live PI tag is mapped to the correct scope asset before similarity modeling.</p>
<pre><code>def aakr_predict(X_query, X_ref, bandwidth):
    sq = ((X_query[:, None, :] - X_ref[None, :, :]) ** 2).sum(axis=2)
    w = np.exp(-sq / (2 * bandwidth ** 2))
    w /= w.sum(axis=1, keepdims=True)
    return w @ X_ref</code></pre>
<table>
  <tr><th>Output table</th><th>Description</th></tr>
  <tr><td><code>ml.aakr_memory</code></td><td>Reference memory matrix used for similarity lookups and reconstruction.</td></tr>
  <tr><td><code>ml.aakr_metadata</code></td><td>Model metadata such as selected tags, bandwidth, and refresh parameters.</td></tr>
  <tr><td><code>ml.aakr_scores</code></td><td>Per-bin reconstruction residuals and top contributing tags.</td></tr>
  <tr><td><code>ml.aakr_episodes</code></td><td>Run-length encoded anomaly episodes with start / end windows and narratives.</td></tr>
  <tr><td><code>ml.aakr_health</code></td><td>Asset health rollup derived from AAKR residual behavior.</td></tr>
  <tr><td><code>ml.watchlist</code></td><td>Shared advisory rows for operator-facing action.</td></tr>
</table>

  `);

  const s3 = section("anomaly", "🔍", "rgba(57,210,192,0.15)", "<code>Multivariate-Anomaly-Detection</code>", `

<p>This notebook also reads Eventhouse telemetry and <code>gold.bridge_pi_tag_to_asset</code>, but its focus is advisory generation rather than AAKR reconstruction. It maintains load-conditioned baselines and multivariate drift signals that can trigger watchlist entries even when the AAKR residual is quiet.</p>
<table>
  <tr><th>Output table</th><th>Description</th></tr>
  <tr><td><code>ml.anomaly_baselines</code></td><td>Per-asset and per-tag baseline statistics such as expected mean, standard deviation, and normal ranges.</td></tr>
  <tr><td><code>ml.anomaly_multivariate</code></td><td>Per-bin multivariate anomaly scores capturing covariance breaks and cross-tag drift.</td></tr>
  <tr><td><code>ml.anomaly_advisories</code></td><td>Human-readable advisories with recommended action, feature/tag context, and severity.</td></tr>
  <tr><td><code>ml.watchlist</code></td><td>Standardized anomaly rows emitted to the shared operator queue.</td></tr>
</table>
<div class="callout">Think of <code>ml.anomaly_baselines</code> as the reference layer, <code>ml.anomaly_multivariate</code> as the scoring layer, and <code>ml.anomaly_advisories</code> as the action layer.</div>

  `);

  const s4 = section("benchmark", "🆚", "rgba(210,153,34,0.15)", "Benchmark vs legacy APM", `

<p>Ironhart Energy's production benchmark remains GE legacy APM. The solution exports legacy APM incidents, diagnostics, and observations to Eventhouse for side-by-side evaluation against the Fabric-native AAKR and anomaly notebooks.</p>
<table>
  <tr><th>Aspect</th><th>Legacy APM</th><th>Fabric implementation</th></tr>
  <tr><td>Similarity model</td><td>SBM / proprietary reference matrices</td><td><code>Similarity-Anomaly</code> using AAKR and <code>ml.aakr_*</code> outputs</td></tr>
  <tr><td>Advisories</td><td>Legacy APM incident narratives</td><td><code>Multivariate-Anomaly-Detection</code> writing <code>ml.anomaly_advisories</code></td></tr>
  <tr><td>Operational surface</td><td>Separate product workflow</td><td>Unified <code>ml.watchlist</code> alongside Cox risk rows</td></tr>
</table>
<p>Legacy APM remains the benchmark for operational maturity, but the Fabric-native implementation gains traceable table outputs, common watchlist routing, and direct lineage to curated <code>gold.*</code> assets.</p>

  `);

  const s5 = section("watchlist", "👁️", "rgba(188,140,255,0.15)", "Shared Watchlist Contract", `

<p>Both anomaly tracks write standardized rows to <code>ml.watchlist</code>. Typical anomaly fields include <code>feature</code>, <code>tag_name</code>, <code>current_value</code>, baseline statistics, directional trend, and recommended action text. This keeps anomaly evidence aligned with Cox long-term risk rows.</p>
<div class="card-grid">
  <div class="card"><h4>AAKR watchlist rows</h4><p>Episode-driven residual advisories, top tags, and health degradation summaries.</p></div>
  <div class="card"><h4>Anomaly watchlist rows</h4><p>Baseline breaks, multivariate drift, and operator-friendly recommendation text.</p></div>
  <div class="card"><h4>Common consumer</h4><p>Power BI and downstream triage logic read a single <code>ml.watchlist</code> table.</p></div>
</div>

  `);

  const s6 = section("scope", "🎯", "rgba(248,81,73,0.15)", "Assets in Scope", `

<ul>
  <li><code>RV2_U2_Boiler</code></li>
  <li><code>RV3_U3_Steam_Turbine</code></li>
  <li><code>RV3_U3_Boiler_Feed_Pump_East</code></li>
</ul>

  `);

  const body = `

<h1>Anomaly Detection</h1>
<p class="subtitle">Legacy APM-inspired analytics run in two parallel notebooks: <code>Similarity-Anomaly</code> for AAKR-based similarity modeling and <code>Multivariate-Anomaly-Detection</code> for baseline-aware anomaly advisories. Both publish <code>ml.*</code> outputs and feed the shared <code>ml.watchlist</code>.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

`;

  page("anomaly-detection.html", "Anomaly Detection", "Legacy APM-inspired AAKR and anomaly notebooks writing standardized ml.* outputs", body);
};
