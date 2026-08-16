module.exports = function(page, section) {
  const body = `

<div class="hero-video" id="demo-hero">
  <video id="demo-video" playsinline preload="none" controls controlslist="nodownload" poster="media/trailer-poster.jpg" style="display:none">
    <source src="media/OneGrid_Trailer.mp4" type="video/mp4">
  </video>
  <div class="hero-poster" id="demo-poster" style="background-image:url('media/trailer-poster.jpg')">
    <button class="watch-demo-btn" id="demo-play" aria-label="Watch the demo trailer"><span class="play-ico">▶</span> Watch the Demo</button>
    <div class="hero-caption">OneGrid on Microsoft Fabric — 3-minute trailer</div>
  </div>
</div>
<script>
(function(){
  var poster=document.getElementById('demo-poster'), v=document.getElementById('demo-video'), b=document.getElementById('demo-play');
  if(!poster||!v||!b) return;
  function fsEl(){ return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement; }
  function exitFs(){ try { (document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen).call(document); } catch(e){} }
  function reset(){ try { v.pause(); } catch(e){} try { v.currentTime=0; } catch(e){} v.style.display='none'; poster.style.display='flex'; }
  b.addEventListener('click', function(){
    poster.style.display='none'; v.style.display='block';
    try { var p=v.play(); if(p&&p.catch) p.catch(function(){}); } catch(e){}
    var req = v.requestFullscreen || v.webkitRequestFullscreen || v.msRequestFullscreen;
    if (req) { try { var r=req.call(v); if(r&&r.catch) r.catch(function(){}); } catch(e){} }
    else if (v.webkitEnterFullscreen) { // iOS Safari: only works once playing
      var go = function(){ try { v.webkitEnterFullscreen(); } catch(e){} v.removeEventListener('playing', go); };
      v.addEventListener('playing', go);
    }
  });
  // When the video ends, leave fullscreen and return to the hero (don't strand the user
  // on the poster inside a fullscreen view).
  v.addEventListener('ended', function(){ if (fsEl()) exitFs(); else reset(); });
  // Leaving fullscreen by ANY means (end, Esc, the native X) returns to the poster + button.
  function onFsChange(){ if (!fsEl()) reset(); }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  v.addEventListener('webkitendfullscreen', reset); // iOS
})();
</script>

<div class="hero">
  <h1>OneGrid on Microsoft Fabric</h1>
  <p>A capabilities showcase for utilities and heavy-asset operators. It illustrates how Microsoft Fabric and Azure AI Foundry unify decades of reliability history, high-frequency historian tags, and condition-monitoring data on one platform — then layer machine-learning models that forecast equipment failure hours-to-weeks in advance. The examples use a mix of synthetic and representative operating data for <strong>Ironhart Energy's Riverton Station</strong>, but the approach behind it has been <strong>deployed and proven in production at a live generating station</strong>.</p>
</div>

<div class="callout"><strong>What this site is.</strong> A tour of platform and modeling <em>capabilities</em> — how the data foundation, real-time path, and ML models work — not a fixed deliverable. Use it to see what an end-to-end OneGrid solution on Fabric looks like.</div>

<h3>Why Microsoft Fabric</h3>
<div class="card-grid">
  <div class="card"><h4>🗄️ One copy of data</h4><p>OneLake + Delta hold Bronze→Silver→Gold in open format. Historian, reliability, condition-monitoring, and work-management data land side by side — no copies, no lock-in.</p></div>
  <div class="card"><h4>📡 Real-time + batch together</h4><p>Eventstream and Eventhouse (KQL) serve the hot path for live tags while Spark and Warehouse serve curated analytics — one governed workspace.</p></div>
  <div class="card"><h4>⚡ ML where the data lives</h4><p>Spark notebooks, MLflow tracking, and Direct Lake semantic models mean features, training, scoring, and reporting share the same lakehouse with no data movement.</p></div>
  <div class="card"><h4>🔒 Governed by default</h4><p>Workspace roles, lineage, and a single security model span every workload — from raw ingest to the executive report.</p></div>
</div>

<h3>What the models do</h3>
<div class="card-grid">
  <a class="card-link" href="ml-pipeline.html"><div class="card"><h4>⚡ Short-Term Failure Risk</h4><p>Gradient-boosted classifiers score 4 h / 8 h / 24 h stop probability from engineered historian features, with per-prediction driver explanations.</p></div></a>
  <a class="card-link" href="survival-models.html"><div class="card"><h4>📈 Long-Term Survival</h4><p>Cox Proportional Hazards and Kaplan-Meier estimate remaining useful life and rank the fleet by risk for maintenance planning.</p></div></a>
  <a class="card-link" href="anomaly-detection.html"><div class="card"><h4>🔍 Anomaly Detection</h4><p>AAKR similarity modeling plus statistical and multivariate scorers flag early deviation from normal — a modern replacement for legacy APM engines.</p></div></a>
  <a class="card-link" href="model-comparison.html"><div class="card"><h4>📊 Model Comparison</h4><p>Where each technique wins: lead time, interpretability, data needs, and how they converge into one operator watchlist.</p></div></a>
</div>

<h3>The application experience</h3>
<div class="card-grid">
  <a class="card-link" href="knowledge-graph.html"><div class="card"><h4>🕸️ Knowledge Graph</h4><p>A governed, interactive ontology of the whole data model — 17 entities, 26 relationships — generated from the semantic model and queryable in natural language.</p></div></a>
  <a class="card-link" href="digital-twin.html"><div class="card"><h4>🧊 3D Digital Twin</h4><p>Live 3D models of each asset that stream historian values and pin faults to the exact physical zone where they occur.</p></div></a>
  <a class="card-link" href="simulation.html"><div class="card"><h4>🔮 Failure Simulation</h4><p>Fast-forward an asset 14 days, watch it trip on the twin, and see the root cause and recommended action for each predicted failure.</p></div></a>
</div>

<h3>How the platform is layered</h3>
<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px 16px;margin:16px 0;overflow-x:auto;text-align:center">
  <img src="platform-diagram.svg" alt="Platform architecture on Microsoft Fabric: historian, reliability, condition-monitoring and work-management sources land in a Bronze-Silver-Gold lakehouse in OneLake, feed ML notebooks that publish a unified watchlist to Power BI Direct Lake, while a real-time lane streams historian data through Eventstream and Eventhouse to live dashboards and back into the models." style="width:100%;max-width:1120px;height:auto"/>
</div>

<h3>Explore the capabilities</h3>
<div class="card-grid">
  <a class="card-link" href="architecture.html"><div class="card"><h4>🏗️ Architecture</h4><p>Medallion layout, workspace inventory, dataflow, and the Direct Lake semantic model.</p></div></a>
  <a class="card-link" href="data-sources.html"><div class="card"><h4>🗄️ Data Foundation</h4><p>The industrial data types a predictive program integrates and how they are ingested.</p></div></a>
  <a class="card-link" href="real-time.html"><div class="card"><h4>📡 Real-Time Intelligence</h4><p>Forwarders → Eventstream → Eventhouse → live KQL dashboards.</p></div></a>
  <a class="card-link" href="data-dictionary.html"><div class="card"><h4>📖 Data Dictionary</h4><p>The conformed gold facts, dimensions, bridges, and ML output tables.</p></div></a>
  <a class="card-link" href="operations.html"><div class="card"><h4>🛠️ Operations</h4><p>Deployment, orchestration, MLOps, and the run model behind the scenes.</p></div></a>
</div>

<h3>Representative model performance</h3>
<p class="subtitle" style="border:none;padding-bottom:0;margin-bottom:8px">Illustrative results on the Riverton Station dataset — indicative of what the techniques achieve in production, not a benchmark or guarantee.</p>
<div class="stat-row">
  <div class="card"><div class="stat">4h–4wk</div><p>Forecast Horizons</p></div>
  <div class="card"><div class="stat">0.90</div><p>Short-Term ROC-AUC</p></div>
  <div class="card"><div class="stat">0.68</div><p>Cox C-Index</p></div>
  <div class="card"><div class="stat">3</div><p>Model Families</p></div>
  <div class="card"><div class="stat">1</div><p>Unified Watchlist</p></div>
</div>

<h3>Example assets in scope</h3>
<div class="card-grid">
  <div class="card"><h4>Unit 2 Boiler</h4><p>Drum pressure, feedwater flow, steam temperatures, fuel/air ratios — high-value process signals for short-term risk.</p></div>
  <div class="card"><h4>Unit 3 Steam Turbine</h4><p>Bearing vibration, lube-oil temperatures, thrust position, governor valve %, hood temperatures.</p></div>
  <div class="card"><h4>Unit 3 Boiler Feed Pump</h4><p>Discharge pressure, suction temperature, vibration, motor current, and seal-water flow signatures.</p></div>
</div>

<h3>Technology stack</h3>
<ul>
  <li><strong>Lakehouse:</strong> Microsoft Fabric (OneLake + Delta), Spark notebooks, Warehouse SQL endpoints.</li>
  <li><strong>Real-Time Intelligence:</strong> Eventstream, Eventhouse (KQL), Real-Time Dashboards.</li>
  <li><strong>ML:</strong> Gradient boosting, lifelines (Cox PH, Kaplan-Meier), scikit-learn (PCA, scalers, AAKR), MLflow tracking.</li>
  <li><strong>Serving:</strong> Direct Lake semantic model + Power BI, and a natural-language chat agent over KQL and DAX.</li>
  <li><strong>Ingestion:</strong> Lightweight forwarders on-prem stream historian and operational data to the cloud hot path.</li>
</ul>

`;

  page("index.html", "Home", "OneGrid capabilities on Microsoft Fabric — data foundation, real-time intelligence, and ML models", body);
};
