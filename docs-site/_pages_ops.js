module.exports = function(page, section) {
  const s1 = section("cli", "⌨️", "rgba(88,166,255,0.15)", "fabric-cli.js", `

<p>Node.js wrapper around <code>az rest</code> for repeatable Fabric REST operations. Lives in <code>C:\\solution\\Tools\\fabric-cli.js</code>.</p>
<table>
  <tr><th>Command</th><th>Purpose</th></tr>
  <tr><td><code>node fabric-cli.js ws list</code></td><td>List workspaces visible to current az login.</td></tr>
  <tr><td><code>node fabric-cli.js item list --ws &lt;wsId&gt;</code></td><td>List items in a workspace.</td></tr>
  <tr><td><code>node fabric-cli.js nb deploy --ws &lt;wsId&gt; --file &lt;path.ipynb&gt;</code></td><td>Create or update a notebook from local file.</td></tr>
  <tr><td><code>node fabric-cli.js nb run --ws &lt;wsId&gt; --id &lt;nbId&gt;</code></td><td>Trigger on-demand run; polls until terminal state.</td></tr>
  <tr><td><code>node fabric-cli.js kql exec --eh &lt;cluster&gt; --db PM_Hot --query &lt;text&gt;</code></td><td>Run KQL via Kusto data-plane.</td></tr>
  <tr><td><code>node fabric-cli.js eh ingest --csv path.csv --table T</code></td><td>Push a CSV into an Eventhouse table.</td></tr>
</table>

  `);

  const s2 = section("scripts", "📜", "rgba(63,185,80,0.15)", "Supporting Scripts", `

<table>
  <tr><th>Script</th><th>Purpose</th></tr>
  <tr><td><code>C:\\solution\\Tools\\deploy-notebooks.ps1</code></td><td>Iterates a directory of <code>.ipynb</code> files and pushes each via fabric-cli.</td></tr>
  <tr><td><code>C:\\solution\\Tools\\deploy-kql.ps1</code></td><td>Applies <code>.kql</code> control-command files to the Eventhouse in order.</td></tr>
  <tr><td><code>C:\\solution\\Tools\\refresh-semantic.ps1</code></td><td>Triggers a DirectLake framing refresh of the semantic model.</td></tr>
  <tr><td><code>C:\\solution\\Tools\\smoke-rt.ps1</code></td><td>End-to-end probe: writes a synthetic sample through the forwarder, asserts it appears in PI_Tag_Stream within 60 s.</td></tr>
</table>

  `);

  const s3 = section("sdk", "🛰️", "rgba(57,210,192,0.15)", "legacy-APM SDK Scripts", `

<p>Located in <code>C:\\solution\\legacy APMSDK\\</code>. Used to export incidents/diagnostics/observations from GE legacy APM to local CSV for ingestion into Eventhouse.</p>
<table>
  <tr><th>Script</th><th>Purpose</th></tr>
  <tr><td><code>export-incidents.py</code></td><td>Pull incident headers via legacy APM REST API for date range.</td></tr>
  <tr><td><code>export-diagnostics.py</code></td><td>Per incident, pull the diagnostic narrative.</td></tr>
  <tr><td><code>export-observations.py</code></td><td>Per incident, pull per-tag residual observations.</td></tr>
  <tr><td><code>kql/01-anomaly-tables.kql</code></td><td>DDL for the three Eventhouse target tables.</td></tr>
  <tr><td><code>kql/02-anomaly-mappings.kql</code></td><td>JSON ingestion mappings.</td></tr>
  <tr><td><code>load-csv-to-eh.ps1</code></td><td>Bulk-loads exported CSVs via Kusto ingest.</td></tr>
</table>

  `);

  const s_crow = section("outage", "🏛️", "rgba(88,166,255,0.15)", "ISO outage portal Extraction", `

<p>Automated extraction of unit-level outage data from the ISO/RTO's ISO outage system portal via mTLS. Runs on the PI Server machine alongside legacy APM scripts.</p>
<table>
  <tr><th>Script</th><th>Purpose</th></tr>
  <tr><td><code>C:\\solution\\the ISO/RTO\\Get-CROWOutages.ps1</code></td><td>Downloads ISO outage system Operations Report via mTLS, parses RTF, ingests to Eventhouse <code>CROWOutages</code> table.</td></tr>
</table>
<h3>Parameters</h3>
<table>
  <tr><th>Param</th><th>Default</th><th>Description</th></tr>
  <tr><td><code>-Station</code></td><td>RVTON</td><td>the ISO/RTO station code</td></tr>
  <tr><td><code>-DaysBack</code></td><td>30</td><td>Rolling lookback window</td></tr>
  <tr><td><code>-CertPath</code></td><td>cert\\svc-forwarder.p12</td><td>.p12 certificate</td></tr>
  <tr><td><code>-SkipIngest</code></td><td>false</td><td>Parse only, don't push to Eventhouse</td></tr>
</table>
<h3>Schedule</h3>
<p>Deploy to PI Server machine. Schedule via Windows Task Scheduler: daily at 6:00 AM CT with <code>-DaysBack 30</code> for a rolling 30-day idempotent refresh.</p>

  `);

  const s4 = section("deploy", "🚀", "rgba(210,153,34,0.15)", "Deployment Flow", `

<ol>
  <li>Branch off <code>main</code>, edit notebooks locally in VS Code (Jupyter extension).</li>
  <li><code>.\\Tools\\deploy-notebooks.ps1 -Path .\\notebooks\\ -Workspace PredictiveMaintenance</code></li>
  <li>Run <code>node fabric-cli.js nb run --ws … --id …</code> to smoke test.</li>
  <li>Apply KQL changes: <code>.\\Tools\\deploy-kql.ps1 -Cluster &lt;url&gt; -Db PM_Hot -Path .\\legacy APMSDK\\kql\\</code></li>
  <li>Refresh semantic model: <code>.\\Tools\\refresh-semantic.ps1</code></li>
  <li>Commit; PR; squash-merge with co-author trailer.</li>
</ol>

  `);

  const s_pipeline = section("pipeline", "⏱️", "rgba(63,185,80,0.15)", "Automated ML Pipeline", `

<p>The ML pipeline runs on a scheduled cadence via Fabric Pipeline orchestration. Historical predictions are captured in append-mode Delta tables for future model retraining.</p>
<table>
  <tr><th>Component</th><th>Cadence</th><th>Notes</th></tr>
  <tr><td>PI-Gold-Delta incremental load</td><td>Every 15 minutes</td><td>Eventhouse → <code>gold.fact_pi</code></td></tr>
  <tr><td>Phase 4 batch scoring</td><td>Every 15 minutes</td><td>Scores latest features, writes <code>ml.predictions_shortterm</code></td></tr>
  <tr><td>Phase-LongTerm-Cox</td><td>Daily</td><td>Cox survival scoring + watchlist update</td></tr>
  <tr><td>Similarity-Anomaly (AAKR)</td><td>Daily</td><td>AAKR scoring + health rollup</td></tr>
  <tr><td>Multivariate-Anomaly-Detection</td><td>Daily</td><td>Baseline scoring + advisory generation</td></tr>
  <tr><td>Phase5-Daily-Narrative</td><td>Daily (after models)</td><td>Generates HTML briefing for Power BI</td></tr>
  <tr><td>Phase5-RealTime-Report</td><td>Daily (after models)</td><td>Pushes <code>WatchTags()</code> and <code>WatchAssets()</code> KQL functions to Eventhouse for dashboard</td></tr>
  <tr><td>legacy-APM SDK extraction</td><td>Daily at 6 AM CT</td><td>Runs on PI Server machine</td></tr>
  <tr><td>ISO outage system outage extraction</td><td>Daily at 6 AM CT</td><td>Runs on PI Server machine</td></tr>
</table>
<h3>Historical data capture</h3>
<p>Key prediction tables (<code>ml.predictions_shortterm</code>, <code>ml.predictions_longterm</code>, <code>ml.watchlist</code>) use append mode with <code>model_run_timestamp</code> to preserve historical predictions. This enables future model retraining on a growing corpus of scored data and retrospective accuracy analysis.</p>

  `);

  const s5 = section("runbooks", "📒", "rgba(188,140,255,0.15)", "Runbooks", `

<h3>Forwarder unhealthy</h3>
<ol>
  <li>RDP to forwarder host.</li>
  <li><code>Get-Service PIFabricForwarder</code> — verify Running.</li>
  <li>Tail log: <code>Get-Content C:\\ProgramData\\PIFabricForwarder\\logs\\current.log -Tail 200 -Wait</code></li>
  <li>Check SQLite queue depth: <code>sqlite3 queue.db "SELECT COUNT(*) FROM outbox WHERE sent_ts IS NULL;"</code></li>
  <li>If queue is growing, verify Eventstream endpoint reachable: <code>Test-NetConnection &lt;ehNamespace&gt;.servicebus.windows.net -Port 5671</code></li>
</ol>
<h3>Model retrain</h3>
<ol>
  <li>Open <code>nb_train_shortterm</code>, set <code>END_DT</code> to today.</li>
  <li>Run all cells; new model auto-registers to MLflow under candidate alias.</li>
  <li>Compare hold-out metrics against current production via the metrics tab.</li>
  <li>Promote with <code>mlflow.MlflowClient().set_registered_model_alias(name, 'production', new_version)</code>.</li>
</ol>
<h3>Eventhouse partition saturation</h3>
<ol>
  <li><code>.show table PI_Tag_Stream details</code></li>
  <li>If <code>HotExtentCount</code> &gt; 50 K, increase <code>MaxPartitionCount</code> on partitioning policy.</li>
</ol>

  `);

  const s6 = section("health", "🩺", "rgba(57,210,192,0.15)", "Daily Health Check", `

<pre><code># 5-min morning check
.\\Tools\\smoke-rt.ps1                                # E2E probe
node fabric-cli.js item list --ws PredictiveMaintenance | findstr /i "failed"
node fabric-cli.js kql exec --db PM_Hot --query \`
   "PI_Tag_Stream | where ts &gt; ago(15m) | summarize n=count() by host"
# Expected: both hosts &gt;= 50K rows in last 15m
node fabric-cli.js kql exec --db PM_Hot --query \`
   "anom_episodes | where start_ts &gt; ago(24h) | summarize n=count() by asset"</code></pre>

  `);

  const s7 = section("gotchas", "⚠️", "rgba(248,81,73,0.15)", "Gotchas &amp; Workarounds", `

<table>
  <tr><th>#</th><th>Symptom</th><th>Cause</th><th>Fix</th></tr>
  <tr><td>1</td><td>Oracle connect fails on Fabric Spark</td><td>oracledb defaults to thick mode requiring Instant Client</td><td>Force thin mode: <code>oracledb.init_oracle_client = lambda *_: None</code></td></tr>
  <tr><td>2</td><td>Arrow parse error on Bronze→Silver</td><td>GADS uses <code>0001-01-01</code> for open-ended events; Spark date parser rejects</td><td>Coalesce to NULL during ingestion</td></tr>
  <tr><td>3</td><td>Delta write fails: "Cannot serialize Infinity"</td><td>Cox <code>predict_median_survival_time</code> returns ∞ for never-failing assets</td><td>Substitute sentinel <code>999.0</code> + boolean flag</td></tr>
  <tr><td>4</td><td>Cox coefficients explode</td><td>Too few events per covariate</td><td>Maintain ≥ 3 events per covariate; prune feature list</td></tr>
  <tr><td>5</td><td><code>%pip install</code> resets kernel state</td><td>Documented Fabric behaviour</td><td>Place <code>%pip</code> in first cell only; re-import everything afterward</td></tr>
  <tr><td>6</td><td>Long PI uploads from laptop die mid-stream</td><td>CrowdStrike Falcon kills long-running network sessions</td><td>Run extractions on Fabric capacity, not local Spark</td></tr>
  <tr><td>7</td><td>Short-term ROC drops sharply 4 h → 24 h</td><td>Inherent — leading-indicator signal decays</td><td>Use Cox survival for &gt; 8 h horizons</td></tr>
  <tr><td>8</td><td>DirectLake measures return empty</td><td>Framing refresh not triggered after Gold rebuild</td><td><code>.\\Tools\\refresh-semantic.ps1</code> at end of Gold pipeline</td></tr>
  <tr><td>9</td><td>Kerberos to PI fails from forwarder</td><td>SPN missing or clock skew &gt; 5 min</td><td><code>setspn -L svc_pifabric</code>; sync clock against domain controller</td></tr>
  <tr><td>10</td><td>KQL update policy not de-duping</td><td>Update policy ran but downstream table not queried</td><td>Always query <code>PI_Tag_Clean</code> for dashboards, not raw <code>PI_Tag_Stream</code></td></tr>
  <tr><td>11</td><td>Eventhouse ingestion latency spikes</td><td>Single tag column hashed into too few partitions</td><td>Raise <code>MaxPartitionCount</code> to 256 or higher</td></tr>
  <tr><td>12</td><td>Diagrams not rendering in a restricted browser</td><td>N/A — diagrams are inline SVG and need no scripts or CDNs</td><td>No action required; pages are fully self-contained and render offline.</td></tr>
</table>

  `);

  const s8 = section("sharepoint", "☁️", "rgba(88,166,255,0.15)", "SharePoint Hosting Notes", `

<p>Each file is fully self-contained — CSS, JavaScript, and all diagrams (inline SVG) are embedded, with <strong>no external CDN or network dependencies</strong>. Drop the HTML files into a SharePoint document library. Users open them with the browser; navigate via the sidebar links.</p>
<ul>
  <li>If <code>&lt;script&gt;</code> is stripped, collapsible sections still work via inline <code>onclick</code> handlers.</li>
  <li>Diagrams are static inline SVG, so they render even when script execution or third-party domains are blocked.</li>
  <li>For URL stability, host all files in the same folder so inter-page links resolve.</li>
</ul>

  `);

  const body = `

<h1>Operations</h1>
<p class="subtitle">CLIs, deployment scripts, runbooks, gotchas, and a daily health-check routine.</p>

${s1}

${s2}

${s3}

${s_crow}

${s4}

${s_pipeline}

${s5}

${s6}

${s7}

${s8}

`;

  page("operations.html", "Operations", "CLIs, deployment scripts, runbooks, gotchas, and daily health check", body);
};
