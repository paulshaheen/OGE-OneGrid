module.exports = function(page, section) {

  const s1 = section("what", "🧊", "rgba(88,166,255,0.15)", "A Live 3D Twin of Every Asset", `

<p>Each monitored asset is rendered as an interactive <strong>3D model</strong> — turbine, boiler, pump or generator — that runs in real time and lights up exactly where the data says something is wrong. It turns an abstract watchlist into a machine an operator can recognise and reason about.</p>
<div class="card-grid">
  <div class="card"><h4>🌀 It runs</h4><p>Rotors, fans, couplings and burner/steam effects animate so the twin visibly behaves like the live machine.</p></div>
  <div class="card"><h4>📍 It localises faults</h4><p>Anomaly, root-cause and watchlist signals are pinned to physical zones — HP casing, steam drum, motor bearing, seal — as pulsing hotspots.</p></div>
  <div class="card"><h4>🟢 It streams live</h4><p>Per-second values flow from the Eventhouse hot path onto the model, with a <span class="badge badge-green">Live</span> badge when telemetry is active.</p></div>
</div>

  `);

  const s2 = section("geometry", "🏗️", "rgba(63,185,80,0.15)", "Equipment Geometry & Zones", `

<p>Purpose-built geometry is generated per equipment type, each with named <strong>anchor zones</strong> that map sensor signals to physical locations.</p>
<table>
  <tr><th>Equipment</th><th>Anchor zones</th></tr>
  <tr><td><span class="badge badge-blue">Turbine</span></td><td>HP casing, IP section, LP exhaust, front bearing, generator bearing, rotor / speed</td></tr>
  <tr><td><span class="badge badge-red">Boiler</span></td><td>Steam drum, furnace, superheater, economizer, air preheater</td></tr>
  <tr><td><span class="badge badge-teal">Pump</span></td><td>Motor, motor bearing, mechanical seal, volute, suction, pump bearing</td></tr>
  <tr><td><span class="badge badge-purple">Generator</span></td><td>Stator, exciter, bearing</td></tr>
</table>
<p>Each incoming signal is matched to the most relevant zone by keyword hints (for example a "thrust bearing vibration" tag binds to the turbine's front-bearing zone), so alerts appear where a reliability engineer would expect them.</p>

  `);

  const s3 = section("live", "📡", "rgba(57,210,192,0.15)", "Live Telemetry on the Model", `

<p>The twin is fed by the same real-time lane that powers the control room:</p>
<ul>
  <li><strong>Hot path:</strong> historian tags stream through Eventstream into the Eventhouse (<code>PiEvents</code>) KQL table.</li>
  <li><strong>Push to the browser:</strong> the report backend subscribes to an asset's tags and pushes per-second values over a WebSocket; each zone shows its current value and updates continuously.</li>
  <li><strong>Fleet pulse:</strong> the same channel carries an events-per-minute and last-data heartbeat, with an explicit ~1-minute latency notation so "live" is honest.</li>
</ul>
<div class="callout">Open an asset from the control-room map or list and the 3D model streams immediately — click any zone to inspect its 24-hour trend pulled from the Eventhouse.</div>

  `);

  const s4 = section("alerts", "🚨", "rgba(248,81,73,0.15)", "Alert Hotspots", `

<p>Zones are coloured by severity, blending three independent evidence streams so the twin agrees with the rest of the solution:</p>
<table>
  <tr><th>State</th><th>Driven by</th></tr>
  <tr><td><span class="badge badge-red">Critical</span></td><td>Critical root-cause priority, or an anomaly with high severity / large peak z-score on a bound tag.</td></tr>
  <tr><td><span class="badge badge-yellow">Watch</span></td><td>Elevated watchlist / anomaly evidence that has not reached critical.</td></tr>
  <tr><td><span class="badge badge-green">Healthy</span></td><td>No open advisory on the zone's signals.</td></tr>
</table>
<p>Exploded call-out labels connect each zone to a floating card with its live value and units, so the model stays readable even with several active alerts.</p>

  `);

  const s5 = section("navigate", "🗺️", "rgba(210,153,34,0.15)", "From Fleet Map to Machine", `

<p>The 3D experience is layered for fast navigation:</p>
<div class="timeline">
  <div class="timeline-item"><div class="when">Level 1</div><h4>Fleet map</h4><p>A geographic view of every station across the fleet, sized and coloured by risk.</p></div>
  <div class="timeline-item"><div class="when">Level 2</div><h4>Equipment train</h4><p>Drill into a station to see its connected pump → boiler → turbine → generator train on a realistic ground plane, with live generation and transmission tags.</p></div>
  <div class="timeline-item"><div class="when">Level 3</div><h4>Asset detail</h4><p>Open a single asset's full 3D model with hotspots, live values, root cause, watchlist, anomalies, predictions and the simulation.</p></div>
</div>

  `);

  const s6 = section("stack", "🛠️", "rgba(188,140,255,0.15)", "How It's Built", `

<ul>
  <li><strong>Rendering:</strong> React Three Fiber + drei (WebGL), with post-processing for ambient occlusion and bloom.</li>
  <li><strong>Data:</strong> Eventhouse (KQL) for live values and 24-hour trends; the semantic model / gold tables for advisories and asset context.</li>
  <li><strong>Transport:</strong> a lightweight WebSocket channel for per-second values and the fleet pulse.</li>
</ul>
<div class="callout success">Everything renders client-side in the browser — no game engine, plugin or streaming server — so it deploys as part of the same container as the rest of the report app.</div>

  `);

  const body = `

<h1>3D Digital Twin</h1>
<p class="subtitle">Interactive 3D models of every asset that run in real time, stream live historian values onto the geometry, and pin anomaly / root-cause / watchlist signals to the exact physical zone where they occur.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

`;

  page("digital-twin.html", "3D Digital Twin", "Interactive, live-streaming 3D models of each asset with fault hotspots mapped to physical zones", body);
};
