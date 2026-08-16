module.exports = function(page, section) {

  const s1 = section("what", "🔮", "rgba(88,166,255,0.15)", "Fast-Forward the Twin 14 Days", `

<p>The simulation takes a live asset and <strong>runs it forward in time</strong> — up to 14 days — projecting how its sensors drift, flagging where it will break, and playing the failure out on the 3D twin. It converts model scores into a story an operator can watch, pause and act on.</p>
<div class="card-grid">
  <div class="card"><h4>▶️ Play &amp; scrub</h4><p>A time bar from now to +14 days with 1× / 2× / 4× playback; drag to any point and the twin, sensors and health readout update.</p></div>
  <div class="card"><h4>💥 It actually breaks</h4><p>At the predicted trip the twin stresses, then visibly trips — rotation stops, red glow, failing zone flagged.</p></div>
  <div class="card"><h4>👍 Human in the loop</h4><p>It pauses at each predicted failure with a why, a recommended action and thumbs up / down feedback, then continues.</p></div>
</div>

  `);

  const s2 = section("forecast", "🧮", "rgba(63,185,80,0.15)", "How the Forecast Is Built", `

<p>The trip is driven by the solution's real model outputs — not a random animation. Two horizons are combined into one hazard curve:</p>
<table>
  <tr><th>Input</th><th>Source</th><th>Role</th></tr>
  <tr><td>Stop probability (4h / 8h / 24h)</td><td><code>predictions_shortterm</code></td><td>Near-term trip likelihood + alert level — sets how soon the machine breaks.</td></tr>
  <tr><td>Survival 7d / 14d, risk score</td><td><code>predictions_longterm</code></td><td>Long-horizon hazard — sets the baseline degradation slope.</td></tr>
  <tr><td>Watch signals &amp; ranges</td><td><code>watchlist</code></td><td>Descriptor, normal range and trend per degrading sensor.</td></tr>
  <tr><td>Anomaly episodes</td><td><code>anomaly_advisories</code></td><td>Direction (high / low), baseline and peak z for the failing tags.</td></tr>
</table>
<p>A higher stop probability produces an earlier <strong>predicted trip day</strong>; the combined survival curve gives a monotonic "health now" readout and remaining-useful-life estimate that stay consistent as you scrub.</p>
<div class="callout">A critical asset with a high stop probability now shows a genuine in-window breakdown — instead of the earlier behaviour where it could read as "no failures predicted".</div>

  `);

  const s3 = section("twin", "🧊", "rgba(57,210,192,0.15)", "The Twin Trips — and Recovers", `

<p>As the playhead approaches the predicted failure, the 3D twin escalates: its accent shifts from healthy → amber → red, a heat light builds, and the machine begins to tremor. At the trip day it <strong>breaks down</strong> — rotation halts, a red overlay marks a predicted trip, and the failing component pulses as a hotspot.</p>
<p>When multiple failures are predicted, the twin <strong>resets between trips</strong>: stress rebuilds segment-by-segment from the previous event toward the next, so each predicted failure is its own fresh breakdown rather than the machine staying broken.</p>

  `);

  const s4 = section("sensors", "📉", "rgba(210,153,34,0.15)", "Projected Sensor Trajectories", `

<p>The degrading signals are charted with friendly descriptors (no raw PI tags) and projected toward their operating limits:</p>
<ul>
  <li>Trajectories are grounded in each signal's <strong>normal range and trend</strong> where available, or synthesized from the trip timing when not.</li>
  <li>A shaded failure zone and limit line show when a sensor crosses its threshold; a playhead tracks the live projected value.</li>
  <li>Failure flags on the time bar mark exactly when each signal is expected to breach.</li>
</ul>

  `);

  const s5 = section("rootcause", "🧭", "rgba(248,81,73,0.15)", "Root Cause, Alongside", `

<p>Beside the twin, a live <strong>root-cause panel</strong> explains the failure in focus using the diagnosis model:</p>
<table>
  <tr><th>Field</th><th>From <code>root_cause</code></th></tr>
  <tr><td>Failure mechanism</td><td>e.g. "Level-control valve hunting", "Governor / rotational instability"</td></tr>
  <tr><td>Confidence</td><td>Model confidence in the diagnosis</td></tr>
  <tr><td>Likely cause</td><td>Plain-language narrative of the driving condition</td></tr>
  <tr><td>Recommended action</td><td>The concrete next step for the crew</td></tr>
</table>
<p>The panel updates to whichever trip is in focus, so operators always see <em>what</em> will fail, <em>why</em>, and <em>what to do</em> together.</p>

  `);

  const s6 = section("feedback", "🔁", "rgba(188,140,255,0.15)", "A Closed Feedback Loop", `

<p>At every predicted failure the simulation pauses and asks whether the prediction looks right. Thumbs up / down responses are written to the <code>MLFeedback</code> store, feeding the same human-in-the-loop signal used elsewhere in the solution to tune and validate the models.</p>
<div class="callout success">The result is a decision aid, not a black box: operators can rehearse a failure, judge the model, and capture that judgement in one place.</div>

  `);

  const body = `

<h1>Failure Simulation</h1>
<p class="subtitle">A digital-twin simulation that fast-forwards an asset up to 14 days, drives a real breakdown from the short-term stop and long-term survival models, projects the degrading sensors, and pauses at each predicted failure with its root cause and a feedback prompt.</p>

${s1}

${s2}

${s3}

${s4}

${s5}

${s6}

`;

  page("simulation.html", "Failure Simulation", "Fast-forward digital-twin simulation that predicts and plays out equipment failure with root cause and feedback", body);
};
