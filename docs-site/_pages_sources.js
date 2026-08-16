module.exports = function(page, section) {
  const s1 = section("gads", "🗄️", "rgba(88,166,255,0.15)", "GADS — NERC Outage History", `

<p>NERC's <em>Generating Availability Data System</em>. Mandatory event reporting for every generation asset above 10 MW. Stored in an Ironhart Energy-hosted Oracle database with ~30 years of history.</p>
<h3>Connection</h3>
<pre><code>import oracledb
oracledb.init_oracle_client = lambda *_: None  # force thin mode
conn = oracledb.connect(user=u, password=p, dsn='oracle.ironhart.com:1521/GADSPROD')</code></pre>
<h3>Core tables</h3>
<table>
  <tr><th>Table</th><th>Rows (~)</th><th>Grain</th><th>Key columns</th></tr>
  <tr><td><code>GADS_EVENT</code></td><td>180 K</td><td>Event</td><td>EVENT_ID, EQUIP_ID, START_DT, END_DT, CAUSE_CODE, EVENT_TYPE</td></tr>
  <tr><td><code>GADS_EQUIPMENT</code></td><td>1.2 K</td><td>Asset</td><td>EQUIP_ID, UNIT_ID, COMPONENT, MFG, MODEL</td></tr>
  <tr><td><code>GADS_CAUSE_CODE</code></td><td>4 K</td><td>Code</td><td>CAUSE_CODE, CATEGORY, DESCRIPTION</td></tr>
  <tr><td><code>GADS_UNIT</code></td><td>250</td><td>Unit</td><td>UNIT_ID, NAME, NET_CAP_MW, COMM_DT</td></tr>
</table>
<h3>Event type taxonomy</h3>
<ul>
  <li><strong>U1 / U2 / U3</strong> — Forced outage (immediate / next-shift / next-24-h).</li>
  <li><strong>MO</strong> — Maintenance outage (planned but not annual).</li>
  <li><strong>PO</strong> — Planned outage (annual overhaul).</li>
  <li><strong>SF</strong> — Startup failure.</li>
  <li><strong>D1–D4</strong> — Forced derating (partial output loss).</li>
</ul>
<p>The classifier label is <em>any</em> of {U1, U2, U3, D1, D2, D3, D4} occurring within the horizon.</p>

  `);

  const s2 = section("cm", "🩺", "rgba(63,185,80,0.15)", "Condition Monitoring", `

<p>Ironhart Energy's enterprise condition-monitoring system, SQL Server backed. Captures inspection routes (vibration, oil, thermography, ultrasound), findings, work-order links, and a curated asset hierarchy.</p>
<h3>Connection</h3>
<pre><code>jdbc:sqlserver://cmsql01\\\\CM;databaseName=CMPROD;integratedSecurity=true</code></pre>
<h3>Hierarchy</h3>
<pre><code>Site (Riverton)
└── Unit (U2 / U3)
    └── System (Boiler / Steam Turbine / BFP)
        └── Equipment (named asset)
            └── Measurement Point (bearing #1, drum N2, etc.)</code></pre>
<h3>Key tables</h3>
<table>
  <tr><th>Table</th><th>Purpose</th></tr>
  <tr><td><code>AssetHierarchy</code></td><td>Tree closure table; each row carries parent + level.</td></tr>
  <tr><td><code>Inspection</code></td><td>Header per route execution (date, technician, route ID).</td></tr>
  <tr><td><code>Finding</code></td><td>One row per anomaly noted; severity 1–5, finding type, narrative.</td></tr>
  <tr><td><code>VibrationReading</code></td><td>Spectral + overall values keyed to measurement point.</td></tr>
  <tr><td><code>WorkOrder</code></td><td>Links findings to CMMS work orders.</td></tr>
</table>

  `);

  const s3 = section("pi", "📊", "rgba(57,210,192,0.15)", "PI Server — Process Historian", `

<p>OSIsoft PI 2018 SP3. Hostname <code>PIHIST01\\\\PIDATA01</code>. ~645 tags in scope across the three target assets, spanning process variables, vibration overalls, lube oil temps, motor currents.</p>
<h3>Tag naming convention</h3>
<p>Most tags follow <code>LGn:&lt;system&gt;&lt;tagcode&gt;.&lt;unit&gt;</code> where <code>n</code> = unit number.</p>
<table>
  <tr><th>Example tag</th><th>Asset</th><th>Description</th></tr>
  <tr><td><code>RV2:BTPU2BPDRUM.AG</code></td><td>U2 Boiler</td><td>Boiler drum pressure (psig).</td></tr>
  <tr><td><code>RV3:FWFU3WF20X.AG</code></td><td>U3 BFP East</td><td>Feedwater flow (klb/hr).</td></tr>
  <tr><td><code>RV3:TBPU3HPVB1.AG</code></td><td>U3 Steam Turbine</td><td>HP turbine bearing #1 vibration (mil pp).</td></tr>
  <tr><td><code>RV3:LOTU3MNJB.AG</code></td><td>U3 Steam Turbine</td><td>Main journal bearing lube oil temp (°F).</td></tr>
  <tr><td><code>RV2:GENU2MWNET.AG</code></td><td>U2 Generator</td><td>Net generation (MW).</td></tr>
</table>
<h3>Sampling</h3>
<p>Raw cadence varies (1 s to 1 min). Historical backfill uses PI Web API's <code>/streams/{webId}/recorded</code> endpoint with <code>boundaryType=Inside</code> to pull archived values in resumable, chunked windows. Recorded values preserve the original timestamps and exception-deviation compression — no interpolation is applied at extraction. The 15-minute binning (mean / p95 / std / count) happens downstream in Silver.</p>
<pre><code># Historical extraction via PI Web API (PowerShell)
# Save-PIRecordedValues.ps1 — chunked, resumable pulls
$url = "$BaseUrl/streams/$WebId/recorded?startTime=$start&amp;endTime=$end&amp;boundaryType=Inside&amp;maxCount=150000"
$resp = Invoke-PIWebApi -Url $url -Credential $cred</code></pre>

  `);

  const s3b = section("forwarder", "🔌", "rgba(63,185,80,0.15)", "PIFabricForwarder — Real-Time Bridge to Fabric", `

<p>A .NET 8 Windows Service that streams PI tag values into Fabric Eventstream in real time. It replaces the batch <code>nb_extract_pi_incremental</code> notebook for the hot path, reducing end-to-end latency from ~1 hour to seconds.</p>

<h3>Architecture</h3>
<p>The service runs four concurrent <code>BackgroundService</code> loops, coordinated through a shared SQLite WAL queue that acts as a durable outbox:</p>
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="sources-forwarder.svg" alt="The forwarder splits into hot-path and poll-path readers buffering to a durable SQLite queue, drained to Eventstream, with a health heartbeat." style="width:100%;max-width:1120px;height:auto"/></div>

<h3>The Four Loops</h3>
<table>
  <tr><th>Loop</th><th>Class</th><th>What It Does</th></tr>
  <tr>
    <td><strong>HotPath</strong></td>
    <td><code>HotPathLoop</code></td>
    <td>Opens persistent WebSocket connections to PI Web API's <code>/streamsets/channel</code> endpoint. Tags are split into groups of up to 250 (configurable via <code>ChannelGroupSize</code>). Each group gets its own <code>PiChannelSubscriber</code> running an independent WebSocket with exponential backoff reconnect (1s → 60s max). As PI pushes new archive events, the subscriber parses the JSON envelope, extracts timestamp/value/quality, and enqueues into SQLite.</td>
  </tr>
  <tr>
    <td><strong>PollPath</strong></td>
    <td><code>PollPathLoop</code></td>
    <td>Fallback for tags that don't work well with channels (e.g., digital states, slow-update tags). Polls PI Web API's <code>/streamsets/value</code> REST endpoint at a configurable interval (default 5s). Uses <code>PiStreamSetsPoller</code> to batch-GET current values and enqueue changes to SQLite.</td>
  </tr>
  <tr>
    <td><strong>Publisher</strong></td>
    <td><code>PublisherLoop</code></td>
    <td>Drains the SQLite queue into Fabric Eventstream. Peeks a batch (up to 1000 events / 256 KB), sends via <code>EventHubProducerClient</code> (AMQP 1.0), then deletes from SQLite only after broker acknowledgment (delete-after-ack). Exponential backoff on failures (500ms → 30s). Idle polls at <code>FlushIntervalMs</code> (50ms default).</td>
  </tr>
  <tr>
    <td><strong>Health</strong></td>
    <td><code>HealthLoop</code></td>
    <td>Emits a heartbeat event every 30s directly to Eventstream (bypasses queue). Payload includes queue depth, queue bytes, active WebSocket channel count, publish rate/sec, and failure count. A Fabric Reflex/Activator rule monitors for missing heartbeats.</td>
  </tr>
</table>

<h3>SQLite WAL Queue — Durable Outbox</h3>
<p>The queue is the critical resilience mechanism. If Fabric is down, events accumulate in SQLite (up to 20 GB / 500K rows before backpressure stops ingestion). When connectivity resumes, the publisher drains the backlog automatically. Key design choices:</p>
<ul>
  <li><strong>WAL journal mode</strong> — concurrent reads (publisher peeks) and writes (HotPath/PollPath enqueue) without blocking</li>
  <li><strong>Delete-after-ack</strong> — rows stay in <code>pending</code> table until the AMQP broker confirms receipt</li>
  <li><strong>Backpressure</strong> — warns at 50K rows, stops ingestion at 500K to prevent disk exhaustion</li>
  <li>Queue path: <code>C:\\ProgramData\\PIFabricForwarder\\queue.db</code></li>
</ul>

<h3>Tag Registry</h3>
<p>Tags are loaded at startup from <code>tags.json</code>. Each tag entry specifies the PI Web API <code>webId</code>, tag name, plant code, and ingestion mode (<code>Channel</code>, <code>Poll</code>, or <code>Skip</code>). Changes require a service restart (hot reload is planned). Tags are de-duplicated by webId at load time.</p>

<h3>Authentication &amp; Transport</h3>
<table>
  <tr><th>Connection</th><th>Auth Method</th><th>Transport</th></tr>
  <tr><td>PI Web API</td><td>Windows Integrated (Kerberos via <code>UseDefaultCredentials</code>)</td><td>WSS (WebSocket) + HTTPS (REST)</td></tr>
  <tr><td>Fabric Eventstream</td><td>Entra ID certificate-based (<code>ClientCertificateCredential</code>) or connection string for testing</td><td>AMQP 1.0 over WebSockets</td></tr>
</table>

<h3>Configuration</h3>
<pre><code>// appsettings.json — key settings
{
  "PiWebApi": {
    "BaseUrl": "https://pireporting-gms.ironhart.com/piwebapi",
    "DataServer": "RVPIHIST01",
    "PollIntervalSeconds": 5,
    "ChannelGroupSize": 250
  },
  "Fabric": {
    "FabricNamespaceFqdn": "....servicebus.fabric.microsoft.com",
    "StreamName": "pi-events-stream",
    "MaxBatchEvents": 1000,
    "MaxBatchBytes": 262144,
    "FlushIntervalMs": 50,
    "UseAmqpWebSockets": true
  },
  "Queue": {
    "Path": "C:\\\\ProgramData\\\\PIFabricForwarder\\\\queue.db",
    "MaxSizeMB": 20480,
    "BackpressureWarnDepth": 50000,
    "BackpressureStopDepth": 500000
  },
  "Health": { "HeartbeatIntervalSeconds": 30 }
}</code></pre>

<h3>Event Schema</h3>
<p>Each event published to Eventstream is a JSON object:</p>
<pre><code>{
  "webId": "P0...",
  "tag": "RV2:BTPU2BPDRUM.AG",
  "plant": "RV2",
  "source": "channel",       // or "poll"
  "ts": "2026-06-10T12:00:01-05:00",
  "value": 1482.3,
  "questionable": false,
  "substituted": false,
  "valueType": "PSIG"
}</code></pre>

<h3>Deployment</h3>
<p>Published as a self-contained .NET 8 executable, installed as Windows Service <code>PIFabricForwarder</code> on the plant data server. Runs under a service account with PI read permissions and access to the Entra app registration certificate.</p>

  `);

  const s4 = section("extract", "⚙️", "rgba(210,153,34,0.15)", "Extraction Notebooks", `

<table>
  <tr><th>Notebook</th><th>Source</th><th>Cadence</th></tr>
  <tr><td><code>nb_extract_gads_full</code></td><td>Oracle GADS</td><td>One-time backfill + daily incremental on EVENT.MOD_DT</td></tr>
  <tr><td><code>nb_extract_cm_full</code></td><td>condition-monitoring SQL</td><td>Daily CDC watermark on Finding.CreatedDt</td></tr>
  <tr><td><code>nb_extract_pi_backfill</code></td><td>PI Web API</td><td>One-time for historical via <code>/recorded</code>, chunked 30 days at a time</td></tr>
  <tr><td><code>nb_extract_pi_incremental</code></td><td>PI Web API</td><td>Hourly via <code>/recorded</code>, watermark on snapshot timestamp</td></tr>
</table>
<p>The real-time path supersedes <code>nb_extract_pi_incremental</code> via PIFabricForwarder — see <a href="real-time.html" style="color:var(--accent)">Real-Time</a>.</p>

  `);

  const s5 = section("quality", "✅", "rgba(188,140,255,0.15)", "Data Quality Rules", `

<ul>
  <li><strong>GADS:</strong> reject events with END_DT &lt; START_DT (data entry error); coalesce <code>0001-01-01</code> open-ended events to NULL.</li>
  <li><strong>condition-monitoring:</strong> dedupe Findings on (AssetID, FindingDt, FindingType) — multiple technicians sometimes log the same observation.</li>
  <li><strong>PI:</strong> drop samples flagged with PI <code>Bad</code> or <code>I/O Timeout</code> status; forward-fill gaps &lt; 5 minutes in Silver.</li>
</ul>

  `);

  const s6 = section("iso-outage", "🏛️", "rgba(88,166,255,0.15)", "ISO outage portal — Outage Coordination", `

<p>the ISO/RTO's <em>Control Room Operations Window</em> provides unit-level outage records for Ironhart Energy's generating fleet. Accessed via automated mTLS (client certificate) against the ISO outage system web portal.</p>
<h3>Connection</h3>
<pre><code>Host: apps.midwestiso.org
Auth: X.509 client certificate (SSL.com, CN=svc-forwarder)
Protocol: mTLS + ASP.NET WebForms POST
Script: C:\\solution\\the ISO/RTO\\Get-CROWOutages.ps1</code></pre>
<h3>Data extracted</h3>
<table>
  <tr><th>Field</th><th>Example</th><th>Description</th></tr>
  <tr><td><code>outage_id</code></td><td>1-27502722</td><td>ISO outage system outage tracking number</td></tr>
  <tr><td><code>station</code></td><td>RVTON</td><td>the ISO/RTO station code for Riverton</td></tr>
  <tr><td><code>unit</code></td><td>G2 / G3</td><td>Generation unit</td></tr>
  <tr><td><code>priority</code></td><td>Forced / Planned / Urgent</td><td>Outage classification</td></tr>
  <tr><td><code>equipment</code></td><td>RVTON G2 22 Derated to: 385 MW</td><td>Equipment and derate level</td></tr>
  <tr><td><code>start_date / end_date</code></td><td>04/28/2025 – 04/30/2025</td><td>Outage window</td></tr>
</table>
<h3>Coverage</h3>
<p>47 outage records (Apr 2025 – Jun 2026): 28 for Unit 2 (G2), 19 for Unit 3 (G3). Includes 25 full OOS events and 22 derates with specific MW caps. Data lands in Eventhouse <code>CROWOutages</code> table for cross-referencing with model predictions.</p>

  `);

  const s7 = section("anomaly", "🛰️", "rgba(57,210,192,0.15)", "Legacy APM engine — Anomaly Benchmark", `

<p>GE Digital's legacy APM system provides the production benchmark for anomaly detection. The solution extracts incidents, diagnostics, and observations via the legacy APM .NET SDK running against the engine server.</p>
<h3>Connection</h3>
<pre><code>Server: FOSWLS1P
Auth: WCF service (SecurityMode=None, user/password)
SDK: .NET Framework legacy APM.Client assemblies via PowerShell reflection
Script: C:\\solution\\legacy APMSDK\\Get-legacy APMData.ps1</code></pre>
<h3>Extraction scripts</h3>
<table>
  <tr><th>Script</th><th>Purpose</th><th>Cadence</th></tr>
  <tr><td><code>Get-legacy APMData.ps1</code></td><td>Active incidents + diagnostics + observations</td><td>Scheduled (daily)</td></tr>
  <tr><td><code>Get-legacy APMHistorical.ps1</code></td><td>2-year historical backfill</td><td>One-time</td></tr>
  <tr><td><code>Get-legacy APMObservations.ps1</code></td><td>Advisory observation detail with rule-tag rows</td><td>On-demand</td></tr>
</table>
<h3>Eventhouse tables</h3>
<table>
  <tr><th>Table</th><th>Description</th></tr>
  <tr><td><code>Legacy APMIncidentsRaw</code></td><td>Incident records with tag, priority, actual/expected/residual values</td></tr>
  <tr><td><code>Legacy APMDiagnosticsRaw</code></td><td>Contributing tag analysis per incident</td></tr>
  <tr><td><code>Legacy APMObservationsRaw</code></td><td>Rule-firing observation events with timestamps</td></tr>
</table>

  `);

  const s8 = section("equipmap", "🔗", "rgba(63,185,80,0.15)", "Equipment Mapping — Unified Cross-System Dimension", `

<p>Three source systems, three different equipment vocabularies. The <strong>DimensionMapping-Discovery</strong> notebook (<a href="#" target="_blank" style="color:var(--accent)">open in Fabric</a>) builds a unified <code>dim_equipment</code> dimension that maps PI tags, GADS events, and condition-monitoring measurements to a single equipment hierarchy.</p>

<h3>The problem</h3>
<p>Each source system identifies equipment differently. Without a cross-reference, you can't correlate a PI vibration reading with the condition-monitoring inspection that flagged the same bearing, or the GADS forced outage that resulted.</p>
<table>
  <tr><th>System</th><th>Equipment identifier</th><th>Example</th></tr>
  <tr><td>PI</td><td>Tag name prefix (convention-based)</td><td><code>RV2:BFP</code>U2BPA.AG → prefix <code>BFP</code></td></tr>
  <tr><td>condition-monitoring</td><td>Hierarchical asset tree (MongoDB ObjectId)</td><td><code>5e14fa24...</code> → "Boiler Feed Pump A"</td></tr>
  <tr><td>GADS</td><td>Free-text equipment mentions in cause narratives</td><td>"BFP tripped due to low suction pressure"</td></tr>
</table>

<h3>Pipeline overview</h3>
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center"><img src="sources-dimmap.svg" alt="A nine-step pipeline that loads mapping tables, extracts and matches identifiers, then builds the unified equipment dimension and bridge tables." style="width:100%;max-width:560px;height:auto"/></div>

<h3>Step 1 — Manual input tables</h3>
<p>Two CSV files seeded by SMEs provide the foundation. Stored in <code>Files/DimensionMapping/</code> and persisted as Delta tables.</p>
<table>
  <tr><th>File</th><th>Delta table</th><th>Purpose</th></tr>
  <tr><td><code>unit_mapping.csv</code></td><td><code>dim_unit_mapping</code></td><td>Unit-level cross-reference: canonical unit code (RV2, RV3) → PI server prefix, GADS UNIT_ID, condition-monitoring root asset IDs (turbine, boiler, electrical, wcm subtrees).</td></tr>
  <tr><td><code>acronym_dictionary.csv</code></td><td><code>dim_acronym_dictionary</code></td><td>Editable abbreviation lookup. Maps plant shorthand (BFP, CWP, FWF, etc.) to full equipment names and categories (equipment, component, system). Used for bidirectional fuzzy matching.</td></tr>
</table>

<h3>Step 2 — PI tag prefix extraction</h3>
<p>PI tags follow naming conventions like <code>RV2:BFPU2BPA.AG</code>. The notebook extracts an <strong>equipment prefix</strong> using three cascading regex patterns:</p>
<pre><code># Pattern 1: Letters before U2/U3 — e.g., BATU2BT05 → "BAT"
equip_prefix_v1 = regexp_extract(tag_body, r"^([A-Z]+?)U[23]", 1)
# Pattern 2: 2+ letters before first digit — e.g., BFPP02A → "BFP"
equip_prefix_v2 = regexp_extract(tag_body, r"^([A-Z]{2,})\d", 1)
# Pattern 3: 2+ leading letters — e.g., GENU2MWNET → "GEN"
equip_prefix_v3 = regexp_extract(tag_body, r"^([A-Z]{2,})", 1)</code></pre>
<p>Result: each tag gets an <code>equip_prefix</code> (e.g., BFP, GEN, BAT) that groups PI tags by the equipment they monitor.</p>

<h3>Step 3 — condition-monitoring hierarchy walk</h3>
<p>The condition-monitoring asset tree is traversed via <strong>BFS from the Riverton plant root</strong> with depth tracking. Each node is assigned a level:</p>
<table>
  <tr><th>Level</th><th>Meaning</th><th>Example</th></tr>
  <tr><td>0</td><td>Plant root</td><td>Riverton</td></tr>
  <tr><td>1</td><td>Functional area</td><td>Steam Turbine, Boiler, Electrical</td></tr>
  <tr><td>2</td><td>Unit / group</td><td>Unit 2 Steam Turbine, Unit 3 Boiler</td></tr>
  <tr><td>3</td><td>Equipment</td><td>Boiler Feed Pump A, HP Turbine Bearing #1</td></tr>
  <tr><td>4+</td><td>Sub-components</td><td>Bearing, Seal, Motor</td></tr>
</table>
<p>Unit attribution uses the <code>unit_mapping.csv</code> subtree roots: each condition-monitoring node is traced up its parent chain to determine whether it belongs to RV2 or RV3. Fallback patterns match on name substrings (e.g., "U2", "Unit 3").</p>

<h3>Step 4 — Fuzzy keyword matching (PI ↔ condition-monitoring)</h3>
<p>The core matching engine uses <strong>bidirectional acronym expansion</strong> and <strong>Jaccard similarity scoring</strong>:</p>
<ol>
  <li><strong>Tokenize</strong> — Each PI prefix group's descriptors and each condition-monitoring equipment name are tokenized. Known acronyms are expanded (BFP → {boiler, feed, pump}) and known phrases are collapsed ("boiler feed pump" → BFP).</li>
  <li><strong>Score</strong> — Jaccard similarity = |shared tokens| / |union of tokens|. Unit-aware: a PI RV2 prefix only matches condition-monitoring nodes in the RV2 subtree.</li>
  <li><strong>Tier</strong> — Matches are classified by confidence:
    <ul>
      <li><span class="badge badge-green">High</span> — Jaccard ≥ 0.50 or ≥ 7 shared tokens</li>
      <li><span class="badge badge-yellow">Medium</span> — Jaccard ≥ 0.30 or ≥ 5 shared tokens</li>
      <li><span class="badge badge-red">Low</span> — Jaccard ≥ 0.20 or ≥ 4 shared tokens</li>
    </ul>
  </li>
  <li><strong>Rank</strong> — Top-3 condition-monitoring matches per PI prefix are kept. Rank-1 (best) becomes the primary mapping.</li>
</ol>
<p>Output: <code>dim_pi_to_cm_map</code> (primary mappings) and <code>dim_pi_to_cm_candidates</code> (ranked alternatives).</p>

<h3>Step 5 — GADS cause-text mining</h3>
<p>GADS <code>EQUIPMENT_DESC</code> is mostly empty (3/2246 events). Instead, the notebook mines <strong>CAUSE_OF_EVENT free-text narratives</strong> for equipment references:</p>
<ul>
  <li>For each GADS event, scan the combined <code>CAUSE_OF_EVENT + EQUIPMENT_DESC</code> text for known equipment acronyms (whole-word boundary match) or their full expansions.</li>
  <li>A stable <code>event_uid</code> is computed as SHA-256 of business key columns to avoid duplicates.</li>
  <li>Matched acronyms are cross-referenced to the <code>gads_equip_type</code> catalog via fuzzy LIKE joins.</li>
  <li>Unmatched events are persisted to <code>dim_gads_unmatched_events</code> for SME review.</li>
</ul>
<p>Output: <code>dim_gads_event_equipment</code> (event → equipment mapping) and <code>dim_gads_event_equipment_xref</code> (with GADS equipment catalog links).</p>

<h3>Step 6 — Unified <code>dim_equipment</code> table</h3>
<p>The final output is a <strong>canonical hierarchical equipment dimension</strong> — one row per condition-monitoring node under Riverton, enriched with PI and GADS cross-references.</p>
<table>
  <tr><th>Column group</th><th>Key columns</th><th>Purpose</th></tr>
  <tr><td>Identity</td><td><code>cm_id</code>, <code>equipment_name</code>, <code>parent_cm_id</code></td><td>Natural key + self-referencing tree edge</td></tr>
  <tr><td>Hierarchy</td><td><code>level</code>, <code>level0_name</code>…<code>level5_name</code>, <code>full_path</code></td><td>Materialized ancestor names for drill-down slicers. E.g., "Riverton &gt; RV2 &gt; Boiler &gt; BFP A"</td></tr>
  <tr><td>Plant</td><td><code>plant</code></td><td>RV2 / RV3 / null (shared)</td></tr>
  <tr><td>Structural</td><td><code>child_count</code>, <code>descendant_count</code>, <code>is_leaf</code></td><td>Rollup helpers for aggregation</td></tr>
  <tr><td>PI coverage</td><td><code>pi_prefixes_direct</code>, <code>pi_tag_count_direct</code>, <code>pi_prefixes_rollup</code>, <code>pi_tag_count_rollup</code></td><td>Direct = tags mapped to this exact node. Rollup = including all descendants.</td></tr>
  <tr><td>GADS coverage</td><td><code>gads_acronyms_direct</code>, <code>gads_event_count_direct</code>, <code>gads_acronyms_rollup</code>, <code>gads_event_count_rollup</code></td><td>Equipment acronyms matched strictly (literal word boundary or multi-word phrase) + event counts</td></tr>
  <tr><td>Match quality</td><td><code>best_pi_match_confidence</code>, <code>best_pi_match_jaccard</code></td><td>Confidence tier and Jaccard score of the best PI link</td></tr>
</table>

<h3>Bridge tables for fact joins</h3>
<p>Two bridge tables enable star-schema joins from fact tables to <code>dim_equipment</code>:</p>
<table>
  <tr><th>Bridge table</th><th>Join path</th></tr>
  <tr><td><code>bridge_pi_tag_to_equipment</code></td><td><code>fact_pi_value.Tag → bridge.Tag → bridge.cm_id → dim_equipment</code></td></tr>
  <tr><td><code>dim_gads_event_equipment</code></td><td><code>fact_gads_events.event_uid → dim_gads.event_uid → dim_gads.cm_id → dim_equipment</code></td></tr>
  <tr><td>(direct)</td><td><code>fact_cm.AssetId → dim_equipment.cm_id</code></td></tr>
</table>

<h3>GADS acronym resolution</h3>
<p>After building <code>dim_equipment</code>, the notebook resolves each GADS match to a specific condition-monitoring equipment node. When multiple nodes carry the same acronym in the same plant, it picks the <strong>most specific node</strong> (highest hierarchy level, smallest descendant count) using a windowed rank.</p>

<h3>Key design decisions</h3>
<ul>
  <li><strong>condition-monitoring as the spine</strong> — condition-monitoring has the richest equipment hierarchy, so it serves as the backbone. PI and GADS are mapped <em>onto</em> condition-monitoring nodes.</li>
  <li><strong>Strict GADS attribution</strong> — Each node's own name (not parent context) is matched. Single-word expansions (e.g., "pump") never match by expansion alone — only if the abbreviation (e.g., "BFP") appears as a whole word in the name. Prevents false cascading matches.</li>
  <li><strong>Direct vs. rollup</strong> — Direct mappings show exactly which node a PI tag or GADS event maps to. Rollup aggregates up the tree, so a unit-level node shows total PI tags and GADS events across all its sub-equipment.</li>
  <li><strong>Human-in-the-loop</strong> — Low-confidence matches and unmatched GADS events are persisted for SME review. The acronym dictionary is editable CSV, not hardcoded.</li>
</ul>

  `);

  const body = `

<h1>Data Sources</h1>
<p class="subtitle">Three primary source systems plus enrichments. Each ingestion path is idempotent and watermarked.</p>

${s1}

${s2}

${s3}

${s3b}

${s8}

${s4}

${s5}

${s6}

${s7}

`;

  page("data-sources.html", "Data Sources", "GADS, condition-monitoring, and PI Server source system inventory and extraction", body);
};
