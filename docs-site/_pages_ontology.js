module.exports = function(page, section) {

  const s1 = section("what", "🕸️", "rgba(88,166,255,0.15)", "A Governed Ontology of the Whole Solution", `

<p>The knowledge graph is a living map of <strong>every entity in the OneGrid data model and how they relate</strong> — assets, sensor tags, telemetry, ML scoring, advisories, outages and work. It is generated directly from the Fabric <strong>Direct Lake semantic model</strong>, so it can never drift out of sync with the data it describes.</p>
<div class="stat-row">
  <div class="card"><div class="stat">17</div><p>Entities</p></div>
  <div class="card"><div class="stat">26</div><p>Relationships</p></div>
  <div class="card"><div class="stat">7</div><p>Categories</p></div>
  <div class="card"><div class="stat">1</div><p>Semantic Model</p></div>
</div>
<div class="figure">
  <img src="ontology-graph.svg" alt="Force-directed knowledge graph of the OneGrid data model: the Asset dimension and the Tag-to-Asset bridge act as hubs, connecting telemetry, ML scoring, advisory, event and narrative entities." style="width:100%;max-width:1120px;height:auto"/>
</div>
<div class="callout">The graph is rendered as an interactive, force-directed view inside the report application (<em>Ontology</em> tab): pan, zoom, search entities and columns, highlight a node's neighbourhood, and open any entity's columns and relationships.</div>

  `);

  const s2 = section("categories", "🎨", "rgba(63,185,80,0.15)", "Entity Categories", `

<p>Every entity is classified into one of seven semantic categories, so the model reads as a story rather than a table list.</p>
<table>
  <tr><th>Category</th><th>What it holds</th><th>Entities</th></tr>
  <tr><td><span class="badge badge-blue">Dimension</span></td><td>Master data — the things we monitor</td><td><code>dim_asset</code>, <code>dim_equipment</code>, <code>dim_date</code></td></tr>
  <tr><td><span class="badge badge-purple">Bridge</span></td><td>Maps sensors to the equipment they measure</td><td><code>bridge_pi_tag_to_asset</code>, <code>selected_tags</code></td></tr>
  <tr><td><span class="badge badge-teal">Telemetry</span></td><td>Raw + modeled sensor readings</td><td><code>fact_pi</code>, <code>fact_icare_measurement</code>, <code>aakr_scores</code>, <code>aakr_health</code></td></tr>
  <tr><td><span class="badge badge-yellow">Events</span></td><td>Outages, condition rounds &amp; work</td><td><code>fact_gads_event</code>, <code>fact_work_requests</code></td></tr>
  <tr><td><span class="badge badge-red">ML Scoring</span></td><td>Predictive model outputs</td><td><code>predictions_longterm</code>, <code>predictions_shortterm</code></td></tr>
  <tr><td><span class="badge badge-red">Advisory</span></td><td>Alerts, watch signals &amp; diagnoses</td><td><code>anomaly_advisories</code>, <code>watchlist</code>, <code>root_cause</code></td></tr>
  <tr><td><span class="badge badge-gray">Narrative</span></td><td>Generated analyst summaries</td><td><code>daily_narrative</code></td></tr>
</table>
<p>Two entities act as <strong>hubs</strong>: <code>dim_asset</code> (every score, event and advisory hangs off an asset) and <code>bridge_pi_tag_to_asset</code> (the join that turns cryptic PI tags into asset context).</p>

  `);

  const s3 = section("relationships", "🔗", "rgba(57,210,192,0.15)", "How Entities Connect", `

<p>Relationships come in three kinds so the graph is honest about what is physically modeled versus inferred:</p>
<table>
  <tr><th>Edge kind</th><th>Meaning</th><th>Example</th></tr>
  <tr><td><span class="badge badge-green">Physical</span></td><td>A relationship defined in the semantic model</td><td><code>predictions_longterm</code> → <code>dim_asset</code> ("long-term survival for")</td></tr>
  <tr><td><span class="badge badge-blue">Logical</span></td><td>Inferred from a shared key where no relationship is modeled</td><td><code>root_cause</code> → <code>dim_asset</code> ("diagnoses")</td></tr>
  <tr><td><span class="badge badge-gray">Temporal</span></td><td>Date-bearing tables joined to the date spine</td><td><code>watchlist</code> → <code>dim_date</code> ("dated by")</td></tr>
</table>
<p>Representative relationships:</p>
<ul>
  <li><code>fact_pi</code> — <em>telemetry on tag</em> → <code>bridge_pi_tag_to_asset</code> — <em>maps tag to</em> → <code>dim_equipment</code> — <em>describes</em> → <code>dim_asset</code></li>
  <li><code>anomaly_advisories</code> / <code>aakr_scores</code> — <em>anomaly / residual on tag</em> → <code>bridge_pi_tag_to_asset</code></li>
  <li><code>predictions_shortterm</code> / <code>predictions_longterm</code> / <code>watchlist</code> / <code>root_cause</code> — score &amp; diagnose → <code>dim_asset</code></li>
  <li><code>fact_work_requests</code> — <em>work on</em> → <code>dim_equipment</code></li>
</ul>

  `);

  const s4 = section("generate", "⚙️", "rgba(210,153,34,0.15)", "Generated in Fabric — and Locally", `

<p>The ontology is built from a single source of truth and materialized in two places so it is always deployable:</p>
<table>
  <tr><th>Target</th><th>Artifact</th><th>How</th></tr>
  <tr><td><strong>Fabric</strong></td><td><code>gold.ontology_nodes</code> + <code>gold.ontology_edges</code> (Delta)</td><td>The <code>Ontology-Knowledge-Graph</code> notebook reads the live gold schemas and writes the nodes/edges tables.</td></tr>
  <tr><td><strong>Application</strong></td><td><code>ontology.json</code></td><td>A generator parses the semantic-model TMDL (tables, columns, relationships) into the graph the app serves at <code>/api/ontology</code>.</td></tr>
</table>
<div class="callout success">Because both are derived from the same semantic model, the in-app graph and the Fabric Delta tables describe an identical ontology — one that stays correct as the model evolves.</div>

  `);

  const s5 = section("ask", "💬", "rgba(188,140,255,0.15)", "Ask the Graph", `

<p>The graph is not just documentation — it is a launchpad for questions. From any entity, a single context-aware <strong>Ask AI</strong> action opens the natural-language assistant pre-loaded with that entity's grain, key columns and relationships, grounded in the Fabric workspace.</p>
<blockquote>"Explain the <strong>Watchlist</strong> entity. Grain: one row per watched signal. It relates to Asset. What business questions can I answer by joining it with related entities?"</blockquote>
<p>This turns the ontology into a self-service way for analysts to understand the model and immediately query it — no schema spelunking required.</p>

  `);

  const body = `

<h1>Knowledge Graph</h1>
<p class="subtitle">A governed, force-directed ontology of the OneGrid data model — 17 entities and 26 relationships generated straight from the Fabric semantic model, explorable in the app and materialized as Delta tables in the lakehouse.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

`;

  page("knowledge-graph.html", "Knowledge Graph", "An interactive ontology of the OneGrid data model, generated from the Fabric semantic model", body);
};
