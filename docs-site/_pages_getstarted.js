// Placeholder — swap for the public accelerator repo when ready.
const REPO_URL = 'https://github.com/paulshaheen/OGE-OneGrid';
// Live hosted report app (3D twin, simulation, ontology, chat) — stable, tied to the
// existing "OneGrid" Fabric workspace (163ba38c).
const APP_URL = 'https://pm-chatagent.bravesmoke-17eab9c6.eastus2.azurecontainerapps.io';

module.exports = function(page, section) {

  const s1 = section("what", "📦", "rgba(63,185,80,0.15)", "What You Deploy", `

<p>The accelerator provisions the <strong>entire solution into your own Fabric tenant</strong> — data platform, real-time lane, ML notebooks, the Direct Lake / Import semantic model, an Azure AI Foundry backend, and the interactive report app (3D digital twin, failure simulation, knowledge graph and the chat agent).</p>
<div class="card-grid">
  <div class="card"><h4>🗄️ Fabric workspace</h4><p>Lakehouse (<code>lh_poc</code>), Eventhouse + KQL DB, Eventstream, 27 notebooks, a pipeline, the Import semantic model and the report.</p></div>
  <div class="card"><h4>📈 Bundled data</h4><p>Full <code>PiEvents</code> history plus curated <code>gold</code> / <code>ml</code> / <code>dbo</code> tables — so the models and dashboards light up immediately.</p></div>
  <div class="card"><h4>🤖 Azure AI Foundry</h4><p>A Foundry account with model deployments powering the natural-language chat agent (unified inference + model selector).</p></div>
  <div class="card"><h4>⚡ Chat agent</h4><p>An Azure Container App with a managed identity that queries the Eventhouse (KQL) and semantic model (DAX) — no per-user secrets.</p></div>
</div>

  `);

  const s2 = section("prereq", "✅", "rgba(88,166,255,0.15)", "Prerequisites", `

<ul>
  <li><strong>Azure CLI</strong> signed in (<code>az login</code>) with rights to create resources and Fabric admin/member access.</li>
  <li><strong>An existing Microsoft Fabric capacity</strong> (F-SKU or Trial). A workspace can't be created without one, and a capacity can't be purchased from a script.</li>
  <li>Tenant setting <em>"Service principals can use Fabric / Power BI APIs"</em> enabled (for the chat agent's managed identity).</li>
  <li><strong>No local Node or Docker required</strong> — the container image builds in the cloud.</li>
</ul>

  `);

  const s3 = section("deploy", "🚀", "rgba(210,153,34,0.15)", "Two Ways to Deploy", `

<h3>Option A — Guided web wizard <span class="badge badge-green">recommended</span></h3>
<p>A local browser wizard discovers your subscriptions and Fabric capacities, runs a prerequisite check, writes <code>config.json</code> for you, and streams live deploy progress.</p>
<pre><code>node deploy-ui/server.js      # or: ./deploy-ui/launch.ps1  (also opens the browser)
# then open http://localhost:7333</code></pre>
<ol>
  <li><strong>Azure sign-in</strong> — confirms <code>az login</code>.</li>
  <li><strong>Choose targets</strong> — subscription, Fabric capacity, region, workspace name, chat-agent hosting, base names, default model.</li>
  <li><strong>Prerequisite checks</strong> — validates CLI, sign-in, the <code>containerapp</code> extension, Fabric API access, the <code>Microsoft.CognitiveServices</code> provider, and that the data bundle is materialized. Deploy unlocks only when every check passes.</li>
  <li><strong>Deploy</strong> — runs <code>deploy.ps1</code> with a live phase tracker and streaming log.</li>
</ol>

<h3>Option B — Config file + CLI</h3>
<pre><code>cp config.sample.json config.json
# edit: subscriptionId, location, fabric.capacityId, resource-group names
./deploy.ps1 -ConfigPath ./config.json</code></pre>
<p>Phases run in order: <code>workspace → core → artifacts → data → semantic → foundry → chatagent → permissions</code>. Run a subset with <code>-Only</code> (e.g. <code>-Only foundry,chatagent</code>) or provision everything but the data load with <code>-SkipData</code>. On completion the chat-agent URL and workspace link are printed.</p>

  `);

  const s4 = section("created", "🧱", "rgba(188,140,255,0.15)", "What Gets Created", `

<table>
  <tr><th>Layer</th><th>Items</th></tr>
  <tr><td><span class="badge badge-blue">Fabric</span></td><td>Workspace, Lakehouse, Eventhouse + KQL DB, Eventstream, 27 notebooks, pipeline, Import semantic model, report</td></tr>
  <tr><td><span class="badge badge-teal">Data</span></td><td>Full <code>PiEvents</code> history + all <code>gold</code>/<code>ml</code>/<code>dbo</code> curated tables + recent <code>fact_pi</code> / <code>fact_icare_measurement</code></td></tr>
  <tr><td><span class="badge badge-yellow">Azure</span></td><td>AI Foundry account + model deployments; Container App (chat agent) with a system-assigned identity</td></tr>
  <tr><td><span class="badge badge-purple">Grants</span></td><td>App identity → Eventhouse DB viewer, Power BI workspace member, Foundry <code>Cognitive Services User</code> + <code>Reader</code></td></tr>
</table>
<div class="callout success">Everything lands in <strong>your</strong> tenant and workspace — no data leaves your environment. When you're done, the wizard includes a one-click <strong>teardown</strong> to remove the workspace and Azure resources.</div>

  `);

  const body = `

<h1>Try It Now — Deploy the Accelerator</h1>
<p class="subtitle">Run this OneGrid solution in your own Microsoft Fabric + Azure AI Foundry environment. One script (or a guided wizard) provisions the full workspace, the historical data, the ML models, the semantic model, and the chat-enabled report app.</p>

<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:4px 0 24px">
  <a class="cta-btn" id="app-try" href="${APP_URL}" target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 22V12" stroke-linejoin="round"/></svg>
    Try the app first
  </a>
  <a class="cta-btn secondary" href="${REPO_URL}" target="_blank" rel="noopener">
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
    Get it on GitHub
  </a>
  <a class="cta-btn secondary" href="architecture.html">See the architecture →</a>
</div>

<div class="callout"><strong>No install required.</strong> "Try the app first" opens the <strong>live hosted report app</strong> — explore the interactive 3D digital twins, the failure simulation, the knowledge graph and the chat agent running on real Fabric data, before you deploy anything.</div>

<div class="modal-overlay" id="app-modal" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
  <div class="modal-card">
    <div class="modal-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h3 id="app-modal-title">Before you launch the live app</h3>
    <p>This is a shared demo tenant. <strong>Depending on the time of day, live streaming sensor data may be paused</strong> — the historian feed runs on a schedule to conserve capacity.</p>
    <p>Everything else stays fully interactive: the 3D digital twins, failure simulation, knowledge graph and chat all run on historical and modeled data at any time.</p>
    <p>Note: the <strong>AI chat assistant depends on shared model capacity, so responses are subject to availability</strong> and may be rate-limited during periods of heavy use.</p>
    <div class="modal-actions">
      <a class="cta-btn" id="app-launch" href="${APP_URL}" target="_blank" rel="noopener">Launch the app ↗</a>
      <button type="button" class="cta-btn secondary" id="app-cancel">Cancel</button>
    </div>
  </div>
</div>
<script>
(function(){
  var modal=document.getElementById('app-modal'),
      tryBtn=document.getElementById('app-try'),
      cancel=document.getElementById('app-cancel'),
      launch=document.getElementById('app-launch');
  if(!modal||!tryBtn) return;
  function open(e){ if(e){e.preventDefault();} modal.classList.add('open'); }
  function close(){ modal.classList.remove('open'); }
  tryBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  launch.addEventListener('click', function(){ setTimeout(close, 150); });
  modal.addEventListener('click', function(e){ if(e.target===modal){ close(); } });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ close(); } });
})();
</script>

<div class="callout"><strong>Proven, not just a demo.</strong> The same approach in this showcase has been deployed and run in production at a live generating station. The accelerator packages it so your team can stand it up end-to-end and adapt it to your assets.</div>

${s1}

${s2}

${s3}

${s4}

<div class="callout success"><strong>🧩 Bring your own data (optional).</strong> The accelerator ships with a synthetic real‑time seed so everything works immediately — but it also provisions an Eventstream <strong>custom endpoint</strong> ready for <em>your</em> data. The optional <strong>Data Plane</strong> bolt‑on streams your own historian/operational data (a production <strong>PI→Fabric forwarder</strong> is included, and the connector contract generalizes to other historians, OPC‑UA/MQTT and GADS/work‑order feeds) into the same landing zone — no schema or report changes. After deploying, run <code>./deploy.ps1 -DataPlane</code> or click <em>“Set up Data Plane”</em> in the wizard to generate a pre‑filled forwarder config for your workspace.</div>

<h3>Ready?</h3>
<p>Clone the repository, follow the README, and you'll have the full solution running in your tenant.</p>
<a class="cta-btn" href="${REPO_URL}" target="_blank" rel="noopener">
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
  Deploy the accelerator
</a>

<div class="callout" style="margin-top:28px"><strong>Questions before you start?</strong> Whether it's about fit for your specific use case or the underlying technology, we're happy to help — <a href="contact.html">get in touch</a>.</div>
<a class="cta-btn secondary" href="contact.html">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  Contact us
</a>

`;

  page("get-started.html", "Try It Now", "Deploy the OneGrid accelerator into your own Microsoft Fabric + Azure AI Foundry environment", body);
};
