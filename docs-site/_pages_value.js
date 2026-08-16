module.exports = function(page, section) {
  const body = `

<style>
  .calc { background: var(--surface2); border:1px solid var(--border); border-radius:10px; padding:18px 20px; margin:18px 0; }
  .calc .calc-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .calc h4 { margin:0; color:var(--text); }
  .calc .hint { font-size:12px; color:var(--text-muted); }
  .calc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap:16px 22px; margin-top:16px; }
  .calc-group .grp-title { font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--accent); font-weight:700; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid var(--border); }
  .calc-field { display:flex; flex-direction:column; margin-bottom:9px; }
  .calc-field label { font-size:12px; color:var(--text-muted); margin-bottom:3px; }
  .calc-field input { background: var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:7px 9px; font-size:13px; font-family:inherit; }
  .calc-field input:focus { outline:none; border-color:var(--accent); }
  .reset-btn { background: rgba(88,166,255,0.12); color:var(--accent); border:1px solid var(--border); border-radius:6px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; }
  .reset-btn:hover { background: rgba(88,166,255,0.2); }
  td.val-cell { color: var(--accent2); font-weight:700; text-align:right; white-space:nowrap; }
  tr.total-row td { border-top:2px solid var(--accent); font-size:14px; }
</style>

<div class="hero">
  <h1>Business Value &amp; ROI</h1>
  <p>How the OneGrid solution creates measurable value for a utility or heavy-asset operator — the business impacts, an interactive ROI calculator, and a transparent explanation of how each figure is derived so it can be tailored to a specific fleet.</p>
</div>

<div class="callout"><strong>The opportunity.</strong> Unplanned equipment downtime is among the largest controllable costs in heavy-asset operations — lost generation, emergency repairs, safety exposure, and idle crews. This solution forecasts equipment failure <strong>hours to weeks in advance</strong> and unifies the entire reliability program on one governed platform.</div>

<h3>What it does</h3>
<div class="card-grid">
  <a class="card-link" href="ml-pipeline.html"><div class="card"><h4>⚡ Short-term risk</h4><p>Gradient-boosted models score 4-hour stop probability at ~0.90 ROC-AUC — imminent, actionable warnings on the most critical assets.</p></div></a>
  <a class="card-link" href="survival-models.html"><div class="card"><h4>📈 Long-term survival</h4><p>Cox models rank the fleet by remaining useful life with 7- and 14-day survival odds — the basis for outage planning and crew allocation.</p></div></a>
  <a class="card-link" href="anomaly-detection.html"><div class="card"><h4>🔍 Anomaly detection</h4><p>AAKR similarity modeling flags early deviation and <em>novel</em> failure modes legacy APM misses — with traceable, table-based advisories.</p></div></a>
  <a class="card-link" href="real-time.html"><div class="card"><h4>🎯 One unified watchlist</h4><p>Every model converges into a single operator watchlist, prioritized by model agreement — cutting false alarms and alarm fatigue.</p></div></a>
</div>

<h3>The ROI case</h3>
<p class="subtitle" style="border:none;padding-bottom:0;margin-bottom:8px">Illustrative value ranges. Use the calculator below to produce specific figures for a given fleet. Ranges, not guarantees.</p>
<table>
  <tr><th>Value lever</th><th>How value is created</th><th style="text-align:right">Illustrative annual impact</th></tr>
  <tr>
    <td><strong>Avoided unplanned downtime</strong></td>
    <td>Catch forced outages early so they become planned, controlled interventions instead of surprise trips. A single day of lost generation on a mid-size unit is worth roughly $500K–$1M+ in gross margin.</td>
    <td style="text-align:right;color:var(--accent);font-weight:600">$1M–$3M</td>
  </tr>
  <tr>
    <td><strong>Reduced maintenance cost</strong></td>
    <td>Shift emergency repairs to planned work; cut expedited parts and overtime. Predictive programs typically reduce maintenance spend 8–12%.</td>
    <td style="text-align:right;color:var(--accent);font-weight:600">$300K–$800K</td>
  </tr>
  <tr>
    <td><strong>Extended asset life</strong></td>
    <td>Address wear before it causes secondary damage, deferring premature capital replacement of major equipment.</td>
    <td style="text-align:right;color:var(--accent);font-weight:600">$200K–$500K</td>
  </tr>
  <tr>
    <td><strong>Labor productivity</strong></td>
    <td>Fewer false alarms and pre-staged work packages raise crew wrench time and reduce wasted trips.</td>
    <td style="text-align:right;color:var(--accent);font-weight:600">$150K–$400K</td>
  </tr>
  <tr>
    <td><strong>Platform consolidation</strong></td>
    <td>One governed lakehouse replaces duplicated data copies and legacy APM tooling and integration.</td>
    <td style="text-align:right;color:var(--accent);font-weight:600">$100K–$300K</td>
  </tr>
</table>

<h3>Interactive ROI calculator</h3>
<p>Every field is pre-filled with an <strong>industry baseline</strong> for a representative mid-size unit. Adjust any value to match your fleet and the estimated-value column in the table below updates instantly.</p>

<div class="calc">
  <div class="calc-head">
    <h4>Your fleet inputs</h4>
    <button type="button" class="reset-btn" id="calc-reset">↺ Reset to baseline</button>
  </div>
  <div class="calc-grid">
    <div class="calc-group">
      <div class="grp-title">Avoided downtime</div>
      <div class="calc-field"><label for="mw">Unit capacity (MW)</label><input type="number" id="mw" value="400" step="10" min="0"></div>
      <div class="calc-field"><label for="margin">Generation margin ($/MWh)</label><input type="number" id="margin" value="45" step="1" min="0"></div>
      <div class="calc-field"><label for="outageHours">Lost hours per averted outage</label><input type="number" id="outageHours" value="24" step="1" min="0"></div>
      <div class="calc-field"><label for="events">Forced outages averted / year</label><input type="number" id="events" value="3" step="1" min="0"></div>
    </div>
    <div class="calc-group">
      <div class="grp-title">Reduced maintenance</div>
      <div class="calc-field"><label for="maintBudget">Annual maintenance budget ($)</label><input type="number" id="maintBudget" value="4000000" step="100000" min="0"></div>
      <div class="calc-field"><label for="maintPct">Maintenance reduction (%)</label><input type="number" id="maintPct" value="12" step="1" min="0"></div>
    </div>
    <div class="calc-group">
      <div class="grp-title">Extended asset life</div>
      <div class="calc-field"><label for="replCost">Major asset replacement value ($)</label><input type="number" id="replCost" value="8000000" step="100000" min="0"></div>
      <div class="calc-field"><label for="deferPct">Annual replacement deferral (%)</label><input type="number" id="deferPct" value="4" step="1" min="0"></div>
    </div>
    <div class="calc-group">
      <div class="grp-title">Labor productivity</div>
      <div class="calc-field"><label for="crewCost">Annual loaded crew cost ($)</label><input type="number" id="crewCost" value="2000000" step="100000" min="0"></div>
      <div class="calc-field"><label for="wrenchPct">Wrench-time improvement (%)</label><input type="number" id="wrenchPct" value="12" step="1" min="0"></div>
    </div>
    <div class="calc-group">
      <div class="grp-title">Platform consolidation</div>
      <div class="calc-field"><label for="toolCost">Legacy APM + integration cost / yr ($)</label><input type="number" id="toolCost" value="400000" step="50000" min="0"></div>
      <div class="calc-field"><label for="avoidPct">Avoided share (%)</label><input type="number" id="avoidPct" value="50" step="5" min="0"></div>
    </div>
  </div>
</div>

<h3>How the ROI is calculated</h3>
<p>Transparency matters, so here is exactly how each figure is derived. Each lever is a simple <em>driver × rate</em> calculation using the inputs above; the estimated-value column reflects your current inputs. Defaults are credible order-of-magnitude estimates based on general power-industry benchmarks — replace them with actuals for a defensible, bottom-up business case.</p>
<table>
  <tr><th>Lever</th><th>How it was calculated</th><th>Basis / benchmark</th><th style="text-align:right">Estimated annual value</th></tr>
  <tr>
    <td><strong>Avoided downtime</strong></td>
    <td>Unit MW × margin ($/MWh) × lost hours × outages averted / year</td>
    <td>~$500K–$1M/day × 2–4 events</td>
    <td class="val-cell" id="val-downtime">—</td>
  </tr>
  <tr>
    <td><strong>Maintenance cost</strong></td>
    <td>Maintenance budget × reduction %</td>
    <td>Industry benchmark 8–12%+</td>
    <td class="val-cell" id="val-maintenance">—</td>
  </tr>
  <tr>
    <td><strong>Asset life</strong></td>
    <td>Replacement value × annual deferral %</td>
    <td>Order-of-magnitude</td>
    <td class="val-cell" id="val-assetlife">—</td>
  </tr>
  <tr>
    <td><strong>Labor productivity</strong></td>
    <td>Loaded crew cost × wrench-time improvement %</td>
    <td>~10–15% typical</td>
    <td class="val-cell" id="val-labor">—</td>
  </tr>
  <tr>
    <td><strong>Platform consolidation</strong></td>
    <td>Legacy APM + integration cost × avoided share %</td>
    <td>Estimated</td>
    <td class="val-cell" id="val-platform">—</td>
  </tr>
  <tr class="total-row">
    <td colspan="3" style="text-align:right"><strong>Total estimated annual value</strong></td>
    <td class="val-cell" id="val-total">—</td>
  </tr>
</table>

<div class="callout success"><strong>Estimated payback.</strong> Based on your inputs, the model estimates <strong id="payback-total">$2.54M</strong> of annual value. Against a typical implementation cost, a single prevented major outage often covers the investment — implying <strong>payback in well under 12 months</strong> and a <strong>3–5x+ first-year ROI</strong>.</div>

<h4>Principles behind the numbers</h4>
<ul>
  <li><strong>Conservative and adjustable</strong> — every figure is driven by an editable input, defaulted to a credible baseline.</li>
  <li><strong>Anchored to observable drivers</strong> — value ties to real levers (outage-days, maintenance spend, crew hours, tooling), not abstract percentages.</li>
  <li><strong>Capability-grounded</strong> — productivity and consolidation savings map to features the solution actually delivers (model-agreement watchlist, one lakehouse, legacy-APM replacement).</li>
  <li><strong>Ready to finalize</strong> — enter your unit MW, generation margin, forced-outage rate, maintenance budget, and current APM cost for a tailored model.</li>
</ul>

<h3>Why it's different</h3>
<div class="card-grid">
  <div class="card"><h4>Real-time + planning in one platform</h4><p>Live monitoring (15-min scoring) and long-range planning (daily) run on the same governed data — from raw ingest to the executive report.</p></div>
  <div class="card"><h4>Right model for every decision</h4><p>Imminent risk, outage planning, unknown failures, and sensor-level investigation each use the most reliable evidence available.</p></div>
  <div class="card"><h4>Unified data foundation</h4><p>Reliability history, sensor data, condition-monitoring, and outage records reconciled into one equipment hierarchy — no copies, no lock-in.</p></div>
  <div class="card"><h4>Gets smarter over time</h4><p>Every prediction is stored for retraining and auditable accuracy, so the models improve as the corpus grows.</p></div>
</div>

<div class="callout success" style="margin-top:20px"><strong>Bottom line.</strong> Higher availability and safety, materially lower maintenance and outage costs, and better-planned resources — with a clear, near-term payback on a single future-proof platform.</div>

<script>
(function(){
  var BASE = {
    mw:400, margin:45, outageHours:24, events:3,
    maintBudget:4000000, maintPct:12,
    replCost:8000000, deferPct:4,
    crewCost:2000000, wrenchPct:12,
    toolCost:400000, avoidPct:50
  };
  var IDS = Object.keys(BASE);
  function num(id){ var el=document.getElementById(id); if(!el) return 0; var v=parseFloat(el.value); return isNaN(v)?0:v; }
  function fmt(n){ return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmtM(n){ return '$' + (n/1000000).toFixed(2) + 'M'; }
  function setVal(id,v){ var el=document.getElementById(id); if(el) el.textContent=fmt(v); }
  function calc(){
    var downtime = num('mw')*num('margin')*num('outageHours')*num('events');
    var maintenance = num('maintBudget')*num('maintPct')/100;
    var assetlife = num('replCost')*num('deferPct')/100;
    var labor = num('crewCost')*num('wrenchPct')/100;
    var platform = num('toolCost')*num('avoidPct')/100;
    var total = downtime+maintenance+assetlife+labor+platform;
    setVal('val-downtime', downtime);
    setVal('val-maintenance', maintenance);
    setVal('val-assetlife', assetlife);
    setVal('val-labor', labor);
    setVal('val-platform', platform);
    setVal('val-total', total);
    var pt=document.getElementById('payback-total'); if(pt) pt.textContent=fmtM(total);
  }
  function attach(){
    IDS.forEach(function(id){
      var el=document.getElementById(id);
      if(el){ if(el.value==='' ) el.value=BASE[id]; el.addEventListener('input',calc); }
    });
    var rb=document.getElementById('calc-reset');
    if(rb){ rb.addEventListener('click',function(){
      IDS.forEach(function(id){ var el=document.getElementById(id); if(el) el.value=BASE[id]; });
      calc();
    }); }
    calc();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',attach); } else { attach(); }
})();
</script>

`;

  page("business-value.html", "Business Value", "Business impact and interactive ROI calculator for the OneGrid solution on Microsoft Fabric, with a transparent explanation of how the ROI figures are derived.", body);
};
