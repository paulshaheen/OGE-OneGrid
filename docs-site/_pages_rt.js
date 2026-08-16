module.exports = function(page, section) {
  const s1 = section("topology", "🗺️", "rgba(88,166,255,0.15)", "End-to-End Topology", `

<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="rt-hotpath.svg" alt="Historian and ops data stream through forwarders and Eventstream into Eventhouse and Delta, feeding dashboards, scoring, and gold." style="width:100%;max-width:1120px;height:auto"/></div>

  `);

  const s2 = section("pifwd", "📡", "rgba(63,185,80,0.15)", "PIFabricForwarder", `

<p>.NET 8 Windows service running on a jump host with line-of-sight to the PI Server. Uses PI AF SDK 2.10 (<code>OSIsoft.AFSDK</code>) to subscribe to a configured tag list.</p>
<h3>Key design points</h3>
<ul>
  <li><strong>Kerberos auth</strong> to PI (service account <code>IRONHART\\\\svc_pifabric</code>, SPN registered).</li>
  <li><strong>Snapshot subscription</strong> via <code>PIDataPipe</code> — push-based, no polling.</li>
  <li><strong>Local SQLite WAL queue</strong> for at-least-once delivery if Eventstream is unreachable. Capacity ≈ 48 h at steady load.</li>
  <li><strong>EventHub binding</strong> via Eventstream's custom-endpoint source (AMQP).</li>
  <li><strong>Batching:</strong> up to 500 events or 200 ms whichever fires first.</li>
  <li><strong>Idempotency:</strong> message key = (tag, ts) so duplicates are deduped downstream by KQL update policy.</li>
</ul>
<h3>Wire format</h3>
<pre><code>{
  "tag": "RV2:BTPU2BPDRUM.AG",
  "ts":  "2025-01-15T18:42:03.000Z",
  "value": 1824.7,
  "status": "Good",
  "host": "PIHIST01",
  "fwd_version": "1.4.2"
}</code></pre>

  `);

  const s3 = section("opfwd", "📝", "rgba(57,210,192,0.15)", "OpDataForwarder", `

<p>Companion service that polls OpData SQL for operator log entries, alarm acknowledgements, and mode changes. Watermarked on <code>OpEvent.ChangeSeq</code> (a monotonically increasing sequence column maintained by OpData triggers).</p>
<pre><code>SELECT TOP (5000) ChangeSeq, EventTs, AssetId, EventType, Severity, Detail
FROM dbo.OpEvent
WHERE ChangeSeq &gt; @lastSeq
ORDER BY ChangeSeq;</code></pre>
<p>Poll interval: 15 s. Same SQLite WAL queue pattern as PIFabricForwarder.</p>

  `);

  const s4 = section("stream", "🌊", "rgba(210,153,34,0.15)", "Fabric Eventstream", `

<p>Single Eventstream artefact <code>PM_Stream</code> with one custom-endpoint source and two destinations.</p>
<table>
  <tr><th>Node</th><th>Type</th><th>Details</th></tr>
  <tr><td><code>src_forwarders</code></td><td>Custom endpoint (AMQP)</td><td>Single endpoint shared by both forwarders; <code>source</code> field distinguishes streams.</td></tr>
  <tr><td><code>op_filter_pi</code></td><td>Filter</td><td><code>source == 'pi'</code></td></tr>
  <tr><td><code>op_filter_op</code></td><td>Filter</td><td><code>source == 'opdata'</code></td></tr>
  <tr><td><code>dst_eh_pi</code></td><td>Eventhouse</td><td>Table <code>PI_Tag_Stream</code></td></tr>
  <tr><td><code>dst_eh_op</code></td><td>Eventhouse</td><td>Table <code>OpData_Events</code></td></tr>
  <tr><td><code>dst_lh_pi</code></td><td>Lakehouse</td><td>Delta table <code>PI_Gold_Delta.pi_raw_samples</code>, hourly micro-batches</td></tr>
</table>

  `);

  const s5 = section("eh", "🔥", "rgba(188,140,255,0.15)", "Eventhouse Tables &amp; Policies", `

<p>Cluster URL: <code>trd-733z…z9.kusto.fabric.microsoft.com</code>. Database <code>PM_Hot</code>.</p>
<h3>PI_Tag_Stream</h3>
<pre><code>.create table PI_Tag_Stream (
    tag: string, ts: datetime, value: real,
    status: string, host: string, fwd_version: string
)
.create-or-alter table PI_Tag_Stream ingestion json mapping 'pi_map'
    '[{"column":"tag","path":"$.tag"},{"column":"ts","path":"$.ts"},'
    '{"column":"value","path":"$.value"},{"column":"status","path":"$.status"},'
    '{"column":"host","path":"$.host"},{"column":"fwd_version","path":"$.fwd_version"}]'

.alter-merge table PI_Tag_Stream policy retention softdelete = 30d recoverability = disabled
.alter table PI_Tag_Stream policy caching hot = 7d
.alter table PI_Tag_Stream policy partitioning '{"PartitionKeys":[{"ColumnName":"tag","Kind":"Hash","Properties":{"Function":"XxHash64","MaxPartitionCount":256}}]}'</code></pre>
<h3>Update policy to dedupe</h3>
<pre><code>.create-or-alter function dedupe_pi_stream() {
    PI_Tag_Stream
    | summarize arg_max(ingestion_time(), *) by tag, ts
}
.alter table PI_Tag_Clean policy update
    @'[{"Source":"PI_Tag_Stream","Query":"dedupe_pi_stream()","IsEnabled":true,"IsTransactional":true}]'</code></pre>

  `);

  const s6 = section("tiers", "🧊", "rgba(248,81,73,0.15)", "Hot / Warm / Cold Tiering", `

<table>
  <tr><th>Tier</th><th>Store</th><th>Retention</th><th>Latency</th><th>Use</th></tr>
  <tr><td>Hot</td><td>Eventhouse memory + SSD cache</td><td>7 days</td><td>&lt; 1 s KQL</td><td>Dashboards, online scoring</td></tr>
  <tr><td>Warm</td><td>Eventhouse cold storage</td><td>30 days</td><td>1–10 s KQL</td><td>Trailing-month analytics</td></tr>
  <tr><td>Cold</td><td>Lakehouse Delta</td><td>Indefinite</td><td>Seconds–minutes Spark</td><td>Long-term training, audit</td></tr>
</table>
<p>Transition from Hot → Warm is automatic via Eventhouse caching policy. Warm → Cold is a daily KQL <code>.export</code> + delete pattern that materialises 30+-day-old data into Delta.</p>

  `);

  const s_dash = section("dashboard", "📊", "rgba(63,185,80,0.15)", "Real-Time Dashboard", `

<p>A Fabric Real-Time Dashboard (<code>Critical-Tag-Monitor</code>) renders live KQL queries against the Eventhouse hot tier. All tiles are driven by two KQL functions — <code>WatchTags()</code> and <code>WatchAssets()</code> — that are updated daily by the <code>Phase5-RealTime-Report</code> notebook. The dashboard definition never changes; only which tags are watched changes.</p>
<h3>Dashboard tiles (8 tiles)</h3>
<table>
  <tr><th>Tile</th><th>Visual Type</th><th>Refresh</th><th>Description</th></tr>
  <tr><td>Equipment Status</td><td>Multi Stat</td><td>10 s</td><td>Running/stopped state per asset from live PiEvents.</td></tr>
  <tr><td>Asset Risk — 14d Survival %</td><td>Multi Stat</td><td>5 min</td><td>Cox 14-day survival probability per asset from <code>WatchAssets()</code>. Conditional formatting: red=CRITICAL, yellow=HIGH/MEDIUM, green=LOW.</td></tr>
  <tr><td>Critical &amp; High Sensors — 24h</td><td>Line Chart</td><td>30 s</td><td>Time series for tags flagged CRITICAL or HIGH by <code>WatchTags()</code>. Uses tag descriptions as series labels.</td></tr>
  <tr><td>Tags per Asset by Priority</td><td>Column Chart</td><td>5 min</td><td>Stacked count of watched tags per asset by priority level.</td></tr>
  <tr><td>Watch Tags — Current Values</td><td>Table</td><td>15 s</td><td>Current sensor readings with descriptor, priority, signal sources, model agreement count, and recommended action.</td></tr>
  <tr><td>Top Risk Drivers</td><td>Bar Chart</td><td>5 min</td><td>Top 15 risk-driving sensors ranked by composite risk score with human-readable descriptions.</td></tr>
  <tr><td>Z-Score Trend — 7 Days</td><td>Line Chart</td><td>5 min</td><td>Daily Z-scores for CRITICAL/HIGH tags against 30-day baselines. Reference lines at ±3σ.</td></tr>
  <tr><td>Data Feed Health</td><td>Multi Stat</td><td>10 s</td><td>Feed status (LIVE / DELAYED / STALE), reading count, active tag count, and lag seconds.</td></tr>
</table>

  `);

  const s_nb = section("notebook", "📓", "rgba(210,153,34,0.15)", "Phase5-RealTime-Report Notebook", `

<p>Scheduled daily after Cox and Anomaly notebooks complete. Reads ML tables from the lakehouse, synthesizes a unified tag-level watchlist, and pushes <code>WatchTags()</code> and <code>WatchAssets()</code> KQL functions to Eventhouse via the Kusto management API.</p>
<h3>Data flow</h3>
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="rt-report.svg" alt="ML tables and the tag bridge feed the real-time report notebook, which publishes KQL functions driving the live dashboard alongside PiEvents." style="width:100%;max-width:1120px;height:auto"/></div>
<h3>Notebook cells</h3>
<table>
  <tr><th>Cell</th><th>Purpose</th></tr>
  <tr><td>0</td><td>Config: Eventhouse cluster URL, database, run ID</td></tr>
  <tr><td>1</td><td>Read latest run from 7 ML tables (watchlist, predictions, drivers, anomaly, AAKR)</td></tr>
  <tr><td>2</td><td>Normalize tag names, enrich descriptors from <code>gold.bridge_pi_tag_to_asset</code>, extract signals from all 4 model families</td></tr>
  <tr><td>3</td><td>Score composite watch priority (CRITICAL/HIGH/MEDIUM/LOW) based on model agreement</td></tr>
  <tr><td>4</td><td>Build asset-level summary (Cox survival + short-term stop probability)</td></tr>
  <tr><td>5</td><td>Push <code>WatchTags()</code> and <code>WatchAssets()</code> functions to Eventhouse via management API</td></tr>
  <tr><td>6</td><td>Summary output with example KQL</td></tr>
</table>
<div class="callout success"><strong>Key design:</strong> The dashboard definition is static — tiles reference <code>WatchTags()</code> and <code>WatchAssets()</code> which are swapped daily by the notebook. This keeps the dashboard truly real-time (KQL queries every 10–30 seconds against live Eventhouse data) while the <em>selection</em> of which tags to watch is driven by the latest ML model outputs.</div>

  `);

  const s7 = section("kql", "🔍", "rgba(57,210,192,0.15)", "KQL Functions &amp; Example Queries", `

<h3>WatchTags() — ML-driven tag watchlist</h3>
<p>Updated daily by <code>Phase5-RealTime-Report</code> notebook. Reads <code>ml.watchlist</code>, <code>ml.drivers_longterm</code>, <code>ml.drivers_shortterm</code>, <code>ml.anomaly_advisories</code>, and <code>ml.aakr_episodes</code> from the lakehouse, scores composite priority based on model agreement, enriches tag descriptions from <code>gold.bridge_pi_tag_to_asset</code>, and pushes the result as a KQL function.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Description</th></tr>
  <tr><td><code>tag</code></td><td>string</td><td>PI tag identifier (e.g. <code>RV2:BATU2BT26.AG</code>)</td></tr>
  <tr><td><code>asset_id</code></td><td>string</td><td>Target asset</td></tr>
  <tr><td><code>descriptor</code></td><td>string</td><td>Human-readable sensor name (from bridge table)</td></tr>
  <tr><td><code>engineering_units</code></td><td>string</td><td>Units (°F, PSI, etc.)</td></tr>
  <tr><td><code>watch_priority</code></td><td>string</td><td>CRITICAL / HIGH / MEDIUM / LOW</td></tr>
  <tr><td><code>signal_sources</code></td><td>string</td><td>Comma-separated model names (Cox, GBM, AAKR, Anomaly)</td></tr>
  <tr><td><code>risk_score</code></td><td>real</td><td>Composite risk score</td></tr>
  <tr><td><code>hazard_ratio</code></td><td>real</td><td>Cox hazard ratio (if applicable)</td></tr>
  <tr><td><code>model_agreement_count</code></td><td>int</td><td>Number of models flagging this tag (1–4)</td></tr>
  <tr><td><code>recommended_action</code></td><td>string</td><td>INVESTIGATE or MONITOR</td></tr>
</table>

<h4>Priority scoring logic</h4>
<ul>
  <li><strong>CRITICAL:</strong> ≥3 models agree, or risk &gt; 50 with ≥2 models</li>
  <li><strong>HIGH:</strong> ≥2 models agree, or risk &gt; 10</li>
  <li><strong>MEDIUM:</strong> Risk &gt; 3 or any INVESTIGATE action</li>
  <li><strong>LOW:</strong> Present in drivers but below thresholds</li>
</ul>

<h3>WatchAssets() — Asset-level risk summary</h3>
<table>
  <tr><th>Column</th><th>Type</th><th>Description</th></tr>
  <tr><td><code>asset_id</code></td><td>string</td><td>Target asset</td></tr>
  <tr><td><code>risk_level</code></td><td>string</td><td>Cox risk level (CRITICAL / HIGH / MEDIUM / LOW)</td></tr>
  <tr><td><code>cox_survival_7d</code></td><td>real</td><td>7-day survival probability</td></tr>
  <tr><td><code>cox_survival_14d</code></td><td>real</td><td>14-day survival probability</td></tr>
  <tr><td><code>short_term_stop_prob_4h</code></td><td>real</td><td>4-hour stop probability from GBM</td></tr>
  <tr><td><code>short_term_alert</code></td><td>string</td><td>Short-term alert level</td></tr>
  <tr><td><code>scored_at</code></td><td>datetime</td><td>When the function was last updated</td></tr>
</table>

<h3>Example dashboard KQL</h3>
<h4>Critical/high tag trend with descriptions</h4>
<pre><code>PiEvents
| where Ts &gt; ago(24h) and not(Questionable)
| where Tag in (WatchTags() | where watch_priority in ("CRITICAL","HIGH") | project tag)
| lookup (WatchTags() | project tag, descriptor) on $left.Tag == $right.tag
| summarize Value=avg(toreal(Value)) by bin(Ts, 5m), descriptor
| render timechart</code></pre>

<h4>Current values with sensor descriptions</h4>
<pre><code>let wt = WatchTags();
let current = PiEvents
| where Ts &gt; ago(1h) and not(Questionable)
| where Tag in (wt | project tag)
| summarize CurrentValue=round(avg(toreal(Value)),2), LastReading=max(Ts) by Tag;
current
| join kind=inner wt on $left.Tag == $right.tag
| project Sensor=descriptor, CurrentValue, Units=engineering_units,
          Priority=watch_priority, Sources=signal_sources, Action=recommended_action
| order by Priority asc</code></pre>

<h4>Asset risk overview</h4>
<pre><code>WatchAssets()
| project asset_id, risk_level,
          Survival7d=round(cox_survival_7d*100,1),
          Survival14d=round(cox_survival_14d*100,1),
          StopProb4h=round(short_term_stop_prob_4h*100,1)</code></pre>

  `);

  const body = `

<h1>Real-Time Architecture</h1>
<p class="subtitle">On-prem forwarders push PI tag samples and OpData events to Fabric Eventstream, which fans out to Eventhouse (KQL hot tier) and Lakehouse Delta (warm/cold).</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s_dash}

${s_nb}

${s6}

${s7}

`;

  page("real-time.html", "Real-Time", "Forwarder, Eventstream, and Eventhouse hot-path architecture", body);
};
