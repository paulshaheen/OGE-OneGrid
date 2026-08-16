// ---------------------------------------------------------------------------
//  Local report backend: serves the data API + realtime WebSocket, and (in
//  production) the built SPA. Authenticates to Fabric via the signed-in az CLI.
//  Run: npm run server   (listens on :7700; Vite dev proxies to it)
// ---------------------------------------------------------------------------
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRealtime } from './realtime.js';
import { resolveTarget } from './target.js';
import { proxyChat, proxyModels, warmAgent } from './chat.js';
import * as api from './dataApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = process.env.REPORT_PORT || 7700;
const ONTOLOGY_FILE = path.resolve(__dirname, 'ontology.json');
let _ontologyCache = null;
function loadOntology() {
  if (_ontologyCache) return _ontologyCache;
  try { _ontologyCache = JSON.parse(fs.readFileSync(ONTOLOGY_FILE, 'utf8')); }
  catch { _ontologyCache = { error: 'ontology.json not found — run _gen-ontology.py', nodes: [], edges: [], categories: {} }; }
  return _ontologyCache;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.hdr': 'application/octet-stream', '.glb': 'model/gltf-binary' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, target: resolveTarget() });
    if (p === '/api/fleet-health') return json(res, 200, await api.fleetHealth());
    if (p === '/api/fleet-assets') return json(res, 200, await api.fleetAssets());
    if (p === '/api/facility-model') return json(res, 200, await api.facilityModel());
    if (p === '/api/watchlist') return json(res, 200, await api.watchlistTop(Number(url.searchParams.get('limit')) || 60));
    if (p === '/api/anomalies') return json(res, 200, await api.anomaliesTop(Number(url.searchParams.get('limit')) || 60));
    if (p === '/api/work-orders') return json(res, 200, await api.workOrders(Number(url.searchParams.get('limit')) || 80));
    if (p === '/api/work-orders-summary') return json(res, 200, await api.workOrdersSummary());
    if (p === '/api/outages') return json(res, 200, await api.outages());
    if (p === '/api/predictions') return json(res, 200, await api.predictionsDetail());
    if (p.startsWith('/api/asset-workorders/')) return json(res, 200, await api.assetWorkOrders(decodeURIComponent(p.split('/api/asset-workorders/')[1])));
    if (p === '/api/narrative') return json(res, 200, await api.narrative());
    if (p === '/api/ontology') return json(res, 200, loadOntology());
    if (p === '/api/realtime-pulse') return json(res, 200, await api.realtimePulse());
    if (p.startsWith('/api/asset/')) return json(res, 200, await api.assetDetail(decodeURIComponent(p.split('/api/asset/')[1])));
    if (p === '/api/tag-values') {
      const tags = (url.searchParams.get('tags') || '').split(',').map((s) => s.trim()).filter(Boolean);
      return json(res, 200, await api.tagValues(tags));
    }
    if (p === '/api/tag-trend') {
      const tag = url.searchParams.get('tag');
      return json(res, 200, await api.tagTrend(tag, Number(url.searchParams.get('hours')) || 24, Number(url.searchParams.get('bin')) || 15));
    }
    return json(res, 404, { error: 'unknown endpoint' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('build not found - run: npm run build'); }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Chat agent proxy (streamed SSE) — collect body then forward.
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => proxyChat(req, res, Buffer.concat(chunks)));
    return;
  }
  if (url.pathname === '/api/models' && req.method === 'GET') return proxyModels(req, res);
  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try {
        let body = Buffer.concat(chunks).toString('utf8');
        if (body.charCodeAt(0) === 0xFEFF) body = body.slice(1);
        const result = await api.submitFeedback(JSON.parse(body || '{}'));
        json(res, 200, result);
      } catch (e) { json(res, 500, { error: String(e.message || e) }); }
    });
    return;
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

attachRealtime(server);
warmAgent();
server.listen(PORT, () => {
  const t = resolveTarget();
  console.log(`\n  Report backend on http://localhost:${PORT}`);
  console.log(`  Target workspace: ${t.workspaceId || '(none)'}  dataset: ${t.datasetId || '(none)'}`);
  console.log(`  Eventhouse: ${t.kustoUri || '(none)'} / ${t.kqlDatabase}\n`);
});
