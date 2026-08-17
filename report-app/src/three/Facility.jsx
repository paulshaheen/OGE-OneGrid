import { useMemo, useRef, useState, useEffect, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, Html, OrbitControls, Line } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { statusOf } from '../lib/format.js';
import { EquipmentGeometry, equipmentType } from './Equipment.jsx';
import { NATION, STATES } from './usaGeo.js';

const worstOf = (units = []) => units.reduce((s, u) => (u.status === 'critical' ? 'critical' : s === 'critical' ? 'critical' : u.status === 'watch' ? 'watch' : s), 'ok');

class SafeBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}
function SafeEnvironment({ preset, files, background = false, blur = 0, intensity = 1 }) {
  return <SafeBoundary fallback={null}><Suspense fallback={null}><Environment preset={preset} files={files} background={background} backgroundBlurriness={blur} environmentIntensity={intensity} /></Suspense></SafeBoundary>;
}

// ── Geographic placement of each plant on the US map (lon/lat) ──────────────
const PLANT_GEO = {
  Ashford: { lon: -122.0, lat: 46.9, city: 'WA' },
  Riverton: { lon: -108.4, lat: 43.0, city: 'WY' },
  Fairview: { lon: -96.6, lat: 33.1, city: 'TX' },
  Deepwater: { lon: -75.48, lat: 39.68, city: 'NJ' },
  Eastport: { lon: -67.0, lat: 44.9, city: 'ME' },
  'Harbor Point': { lon: -87.6, lat: 41.8, city: 'IL' },
  Brookline: { lon: -71.12, lat: 42.33, city: 'MA' },
  'Cedar Falls': { lon: -92.44, lat: 42.53, city: 'IA' },
  Glenwood: { lon: -95.39, lat: 45.65, city: 'MN' },
};
// equirectangular projection (lon/lat → world X/Z), aspect-corrected at ~lat38
const LON0 = -95.5, LAT0 = 38.0, K = 2.8, COSLAT = Math.cos((38 * Math.PI) / 180);
function project(lon, lat) { return [(lon - LON0) * K * COSLAT, -(lat - LAT0) * K]; }
let _geoIdx = 0;
function geoFor(name) {
  if (PLANT_GEO[name]) return PLANT_GEO[name];
  const g = [[-115, 39], [-100, 47], [-83, 35], [-78, 44]][(_geoIdx++) % 4];
  return { lon: g[0], lat: g[1], city: '' };
}

// ── Level-2 interior: each unit is its own connected operating train ─────────
const ORDER = { pump: 0, boiler: 1, turbine: 2, generator: 3, skid: 4 };
const CONNECT_LABEL = { 'pump-boiler': 'feedwater', 'boiler-turbine': 'steam', 'turbine-generator': 'shaft', 'pump-turbine': 'feedwater' };
// Canonical operating train + friendly names for modeled (not-instrumented) fill-ins.
const TRAIN = ['pump', 'boiler', 'turbine', 'generator'];
const GHOST_NAME = { pump: 'Boiler Feed Pump', boiler: 'Boiler', turbine: 'Steam Turbine', generator: 'Generator' };
const GHOST = '#64748b';

// The generator net-load (MW) PI tag follows "<unit>:GEJU<n>NLOAD.AG" (the unit code is
// also the PI tag prefix, e.g. RV3 → RV3:GEJU3NLOAD.AG).
export function deriveMwTag(unit) {
  const prefix = String(unit || '').trim();
  if (!prefix) return null;
  const n = (prefix.match(/(\d+)/) || [])[1] || '';
  return `${prefix}:GEJU${n}NLOAD.AG`;
}
export function plantGenTags(plant) {
  return (plant?.unitList || []).map((u) => deriveMwTag(u.name)).filter(Boolean);
}

function Connector({ from, to, kind, ghost }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const dir = b.clone().sub(a).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const isShaft = kind === 'turbine-generator';
  const color = ghost ? GHOST : kind === 'boiler-turbine' ? '#d16a4f' : isShaft ? '#c3cedd' : '#7f8aa0';
  return (
    <group position={mid.toArray()} quaternion={quat.toArray()}>
      <mesh castShadow={!ghost}><cylinderGeometry args={[isShaft ? 0.18 : 0.28, isShaft ? 0.18 : 0.28, len, 16]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.4} transparent opacity={ghost ? 0.32 : 1} emissive={!ghost && kind === 'boiler-turbine' ? '#d16a4f' : '#000'} emissiveIntensity={!ghost && kind === 'boiler-turbine' ? 0.25 : 0} /></mesh>
    </group>
  );
}

function Pylon({ x, z = 0, h = 7 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.12, 0.28, h, 8]} /><meshStandardMaterial color="#6b7688" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, h - 0.6, 0]}><boxGeometry args={[3.2, 0.18, 0.18]} /><meshStandardMaterial color="#6b7688" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, h - 1.6, 0]}><boxGeometry args={[2.4, 0.16, 0.16]} /><meshStandardMaterial color="#6b7688" metalness={0.6} roughness={0.5} /></mesh>
    </group>
  );
}
function wireSag(a, b, sag = 1.1, seg = 12) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t]); }
  return pts;
}
// Transmission lines carrying the generator's live net output (MW) off-site.
function Transmission({ mw, live, accent }) {
  const spans = [10, 21, 32];
  const headY = 6.4, pyH = 7;
  const attach = [[2, 4.6, 0], ...spans.map((x) => [x, pyH - 0.6, 0])];
  const phaseZ = [-0.9, 0, 0.9];
  return (
    <group>
      {spans.map((x) => <Pylon key={x} x={x} h={pyH} />)}
      {attach.slice(0, -1).map((a, i) => {
        const b = attach[i + 1];
        return phaseZ.map((pz, j) => (
          <Line key={`${i}-${j}`} points={wireSag([a[0], a[1], pz], [b[0], b[1], pz])} color="#9fb0c6" lineWidth={1} transparent opacity={0.7} />
        ));
      })}
      <Html position={[16, 9.2, 0]} center distanceFactor={30} zIndexRange={[20, 0]}>
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
          style={{ background: 'rgba(8,12,20,.88)', color: '#eaf2fb', border: `1px solid ${accent}66`, boxShadow: `0 0 14px ${accent}44` }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill={accent}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
          {mw != null ? `${mw.toFixed(1)} MW` : '— MW'}
          {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
      </Html>
    </group>
  );
}

function InteriorAsset({ node, theme, selected, hovered, onSelect, onHover, values }) {
  const ref = useRef();
  const ghost = node.ghost;
  const s = ghost ? { color: GHOST, glow: GHOST } : statusOf(node.status);
  const isSel = selected === node.id;
  const isHot = !ghost && node.status !== 'ok';
  const clickable = !ghost && !node.synthetic;
  const type = node.type || equipmentType(node.asset || node);
  const liveMw = node.isGen && node.mwTag ? values?.[node.mwTag]?.value : undefined;
  const mw = node.isGen ? (liveMw != null ? liveMw : Math.round(((node.health ?? 92) / 100) * 260)) : undefined;
  const baseScale = ghost ? 0.46 : 0.52;
  useFrame(() => { if (ref.current) { const target = isSel ? 0.62 : hovered === node.id ? 0.58 : baseScale; ref.current.scale.setScalar(THREE.MathUtils.lerp(ref.current.scale.x, target, 0.15)); } });
  return (
    <group position={node.pos}>
      <mesh position={[0, 2, 0]} visible={false}
        onPointerOver={(e) => { if (!clickable) return; e.stopPropagation(); onHover(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'auto'; }}
        onClick={(e) => { if (!clickable) return; e.stopPropagation(); onSelect(node); }}>
        <boxGeometry args={[7, 5, 5]} />
      </mesh>
      <group ref={ref} scale={baseScale}><EquipmentGeometry type={type} accent={s.color} running={!ghost} detail={false} /></group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}><ringGeometry args={[3.6, 4.0, 48]} /><meshBasicMaterial color={s.color} transparent opacity={ghost ? 0.22 : isHot ? 0.8 : 0.4} toneMapped={false} /></mesh>
      {isHot && <mesh position={[0, 5.4, 0]}><sphereGeometry args={[0.22, 16, 16]} /><meshBasicMaterial color={s.color} toneMapped={false} /></mesh>}
      {node.isGen && <Transmission mw={mw} live={liveMw != null} accent={theme.accent} />}
      <Html position={[0, isSel || hovered === node.id ? 6.0 : 5.2, 0]} center distanceFactor={26} zIndexRange={[20, 0]}>
        <div className="px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap"
          style={{ background: 'rgba(8,12,20,.82)', color: ghost ? '#9aa7b8' : isSel || hovered === node.id ? s.color : '#cdd8e6', border: `1px solid ${s.color}${isSel ? 'aa' : ghost ? '33' : '44'}`, boxShadow: isSel ? `0 0 16px ${s.glow}` : 'none', borderStyle: ghost ? 'dashed' : 'solid', opacity: ghost ? 0.9 : 1 }}>
          {node.name}{ghost ? '' : node.synthetic ? '' : node.health != null ? ` · ${Math.round(node.health)}%` : ''}
          {ghost ? <span className="opacity-70 font-normal italic"> · modeled</span> : node.unit ? <span className="opacity-60 font-normal"> · {node.unit}</span> : null}
        </div>
      </Html>
    </group>
  );
}

// Each UNIT is a separate operating train. The data only instruments some equipment per
// unit, so missing slots are filled with "modeled" (ghost) placeholders — dimmed and
// non-interactive — so the full pump → boiler → turbine → generator stack still reads
// end-to-end. Real assets stay full-colour, clickable and live.
function interiorLayout(plant) {
  const units = plant?.unitList || [];
  const rows = [], connectors = [], labels = [], pads = [];
  const rowGap = 30;
  units.forEach((u, ui) => {
    const z = (ui - (units.length - 1) / 2) * rowGap;
    const byType = {};
    (u.assets || []).forEach((a) => { byType[equipmentType(a)] = a; });
    const nodes = TRAIN.map((type) => {
      const a = byType[type];
      if (a) return { kind: 'asset', id: a.asset_id, asset_id: a.asset_id, name: a.name, plant: plant.name, unit: u.name, status: a.status, health: a.health, category: a.category, tags: a.tags || [], running_tag: a.running_tag, asset: a, type, real: true };
      const isGen = type === 'generator';
      return { kind: 'ghost', ghost: true, isGen, id: `${u.name}_${type}`, name: `${u.name} ${GHOST_NAME[type]}`, plant: plant.name, unit: u.name, status: 'modeled', type, mwTag: isGen ? deriveMwTag(u.name) : null };
    });
    const gap = 12, n = nodes.length;
    nodes.forEach((nd, i) => { nd.pos = [(i - (n - 1) / 2) * gap, 0, z]; });
    rows.push(...nodes);
    for (let i = 0; i < nodes.length - 1; i++) {
      const k = `${nodes[i].type}-${nodes[i + 1].type}`;
      const ghost = nodes[i].ghost || nodes[i + 1].ghost;
      connectors.push({ from: [nodes[i].pos[0] + 2.4, 1.6, z], to: [nodes[i + 1].pos[0] - 2.4, 1.6, z], kind: k, id: `${u.name}-c${i}`, ghost });
      const lbl = CONNECT_LABEL[k];
      if (lbl) labels.push({ id: `${u.name}-l${i}`, pos: [(nodes[i].pos[0] + nodes[i + 1].pos[0]) / 2, 3.2, z], text: lbl, ghost });
    }
    const xs = nodes.map((nd) => nd.pos[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    pads.push({ id: u.name, z, x0: minX - 7, x1: maxX + 34, status: u.status });
    labels.push({ id: `${u.name}-unit`, pos: [minX - 8.5, 0.4, z], text: u.name, unit: true, status: u.status });
  });
  return { rows, connectors, labels, pads };
}

// ── Camera rig: eases to a goal only right after a transition, then hands the
// camera back to OrbitControls so manual zoom/orbit is never yanked back. ────
function CameraRig({ mode, focus }) {
  const controls = useRef();
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 2, 0));
  const goal = useRef(new THREE.Vector3(0, 150, 118));
  const settling = useRef(true);
  const settleUntil = useRef(0);
  useEffect(() => {
    if (mode === 'sites') { target.current.set(0, 0, 2); goal.current.set(6, 95, 150); }
    else if (focus) { target.current.set(focus[0], 2, focus[2]); goal.current.set(focus[0] + 2, 14, focus[2] + 20); }
    else { target.current.set(0, 2, 0); goal.current.set(0, 22, 44); }
    settling.current = true;
    settleUntil.current = performance.now() + 1400; // hard stop so it can never lerp forever
  }, [mode, focus]);
  // The instant the user grabs the camera, stop auto-centering for good (until the next
  // explicit mode/focus transition). This is what prevents the "snaps back to center on
  // release" behaviour.
  useEffect(() => {
    const c = controls.current; if (!c) return;
    const onStart = () => { settling.current = false; };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, []);
  useFrame(() => {
    const c = controls.current; if (!c) return;
    if (settling.current) {
      camera.position.lerp(goal.current, 0.08);
      c.target.lerp(target.current, 0.1);
      if ((camera.position.distanceTo(goal.current) < 0.8 && c.target.distanceTo(target.current) < 0.5) || performance.now() > settleUntil.current) settling.current = false;
    }
    c.update();
  });
  const sites = mode === 'sites';
  return <OrbitControls ref={controls} makeDefault enablePan={sites} minDistance={sites ? 40 : 8} maxDistance={sites ? 340 : 130} maxPolarAngle={Math.PI / 2.05} enableDamping dampingFactor={0.08} />;
}

// ── Level-1: US map with a glowing status pin per plant ─────────────────────
function MapMarker({ site, theme, hovered, onHover, onEnter }) {
  const g = useRef();
  const s = statusOf(site.status);
  const hot = site.status !== 'ok';
  const isHover = hovered === site.name;
  useFrame(() => { if (g.current) { const t = isHover ? 1.14 : 1; g.current.scale.setScalar(THREE.MathUtils.lerp(g.current.scale.x, t, 0.14)); } });
  return (
    <group position={site.pos}>
      <mesh position={[0, 3, 0]} visible={false}
        onPointerOver={(e) => { e.stopPropagation(); onHover(site.name); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'auto'; }}
        onClick={(e) => { e.stopPropagation(); onEnter(site.name); }}>
        <boxGeometry args={[7, 8, 7]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.12, 0]}><ringGeometry args={[2.0, 2.6, 40]} /><meshBasicMaterial color={s.color} transparent opacity={hot ? 0.85 : 0.5} toneMapped={false} /></mesh>
      <group ref={g}>
        <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.16, 0.16, 4, 12]} /><meshStandardMaterial color="#5a6678" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 4.4, 0]}><sphereGeometry args={[0.85, 20, 20]} /><meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={hot ? 1.4 : 0.6} toneMapped={false} /></mesh>
        {hot && <pointLight position={[0, 4.4, 0]} color={s.color} intensity={7} distance={26} />}
      </group>
      <Html position={[0, 6.4, 0]} center distanceFactor={110} zIndexRange={[20, 0]}>
        <button onClick={() => onEnter(site.name)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'rgba(8,12,20,.88)', color: isHover ? s.color : '#e6eef8', border: `1.5px solid ${s.color}${isHover ? 'cc' : '55'}`, boxShadow: hot ? `0 0 16px ${s.glow}` : 'none' }}>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hot ? 'animate-pulse' : ''}`} style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            {site.name}<span className="opacity-50 font-medium">· {site.city}</span>
          </div>
          <div className="text-[9px] font-medium opacity-80 mt-0.5">{site.critical ? `${site.critical} critical` : `${site.assetCount} healthy`} · enter →</div>
        </button>
      </Html>
    </group>
  );
}

// point-in-polygon (ray cast) for clipping terrain/lights to the US outline
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}
const CITY_METROS = [[-74,40.7,10],[-118.2,34,9],[-87.6,41.8,8],[-95.4,29.8,6],[-96.8,32.8,6],[-112,33.4,5],[-75.2,40,5],[-122.4,37.8,6],[-122.3,47.6,5],[-80.2,25.8,5],[-84.4,33.7,5],[-71.1,42.4,5],[-77,38.9,5],[-105,39.7,4],[-93.3,45,4],[-83,42.3,4],[-115.1,36.2,3],[-122.7,45.5,3],[-111.9,40.8,3],[-90.2,38.6,3],[-94.6,39.1,3],[-86.8,36.2,3],[-80.8,35.2,3],[-81.4,28.5,3],[-98.5,29.4,3],[-97.5,35.5,3],[-90.1,29.95,3],[-76.6,39.3,3],[-82.4,27.9,3]];
const GLOW_TEX = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,244,214,0.6)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();

function CityLights({ points }) {
  const ref = useRef();
  useFrame((st) => { if (ref.current) ref.current.material.size = 0.6 * (0.82 + 0.22 * Math.sin(st.clock.elapsedTime * 3.2)); });
  return <primitive ref={ref} object={points} />;
}

function SceneMap({ plants, theme, hovered, onHover, onEnter }) {
  // Build the 3D night map once: terrain heightfield clipped to the US, city lights,
  // draped neon borders, and a height sampler for placing markers on the terrain.
  const map = useMemo(() => {
    const poly = (NATION[0] || []).map(([lon, lat]) => { const [x, z] = project(lon, lat); return [x, z]; });
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    poly.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });
    const w = maxX - minX + 8, d = maxZ - minZ + 8, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const simplex = new SimplexNoise(); const seaY = -1.6, HS = 3.6;
    const heightAt = (wx, wz) => {
      if (!pointInPoly(wx, wz, poly)) return seaY;
      const n = simplex.noise(wx * 0.02, wz * 0.02) * 0.5 + simplex.noise(wx * 0.055, wz * 0.055) * 0.3 + simplex.noise(wx * 0.14, wz * 0.14) * 0.2;
      return Math.max(0.06, (n + 0.5)) * HS;
    };
    // terrain
    const NX = 220, NZ = Math.round(NX * d / w);
    const geo = new THREE.PlaneGeometry(w, d, NX, NZ); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const cols = [];
    const cLow = new THREE.Color('#0c2b46'), cMid = new THREE.Color('#12463a'), cHi = new THREE.Color('#3f5238'), cPeak = new THREE.Color('#6b6f63');
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx, wz = pos.getZ(i) + cz; const h = heightAt(wx, wz); pos.setY(i, h);
      let c; if (h <= seaY + 0.01) c = cLow; else { const e = h / HS; c = e < 0.4 ? cMid.clone().lerp(cHi, e / 0.4) : cHi.clone().lerp(cPeak, (e - 0.4) / 0.6); }
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.92, envMapIntensity: 0.4 }));
    terrain.position.set(cx, 0, cz); terrain.receiveShadow = true;
    // city lights
    const lp = [], lc = []; const warm = new THREE.Color('#ffe6b0'), cool = new THREE.Color('#bcd8ff');
    const addLight = (x, z) => { const c = warm.clone().lerp(cool, Math.random() * 0.5); const b = 0.6 + Math.random() * 0.7; lp.push(x, heightAt(x, z) + 0.28, z); lc.push(c.r * b, c.g * b, c.b * b); };
    CITY_METROS.forEach(([lon, lat, wt]) => { const [mx, mz] = project(lon, lat); const n = Math.round(wt * 16);
      for (let k = 0; k < n; k++) { const r = (Math.random() ** 1.6) * wt * 0.9, a = Math.random() * Math.PI * 2, x = mx + Math.cos(a) * r, z = mz + Math.sin(a) * r; if (pointInPoly(x, z, poly)) addLight(x, z); } });
    let tries = 0, added = 0; while (added < 650 && tries < 6000) { tries++; const x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ); if (pointInPoly(x, z, poly)) { addLight(x, z); added++; } }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    const cityLights = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.6, map: GLOW_TEX, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false }));
    // draped borders
    const drape = (ring, off) => ring.map(([lon, lat]) => { const [x, z] = project(lon, lat); return [x, heightAt(x, z) + off, z]; });
    const nationLine = drape(NATION[0], 0.25);
    const stateLines = STATES.map((r) => drape(r, 0.15));
    return { terrain, cityLights, nationLine, stateLines, heightAt };
  }, []);

  const sites = useMemo(() => plants.map((p) => {
    const geo = geoFor(p.name); const [x, z] = project(geo.lon, geo.lat);
    return { name: p.name, city: geo.city, status: worstOf(p.unitList), pos: [x, map.heightAt(x, z), z],
      assetCount: (p.unitList || []).reduce((s, u) => s + (u.assets || []).length, 0),
      critical: (p.unitList || []).reduce((s, u) => s + (u.assets || []).filter((a) => a.status === 'critical').length, 0) };
  }), [plants, map]);

  return (
    <>
      <color attach="background" args={['#02040a']} />
      <fog attach="fog" args={['#02040a', 150, 470]} />
      <hemisphereLight intensity={0.05} groundColor={'#0a0f18'} color={'#33405a'} />
      <directionalLight position={[40, 120, 60]} intensity={0.28} color={'#5f79b8'} />
      <primitive object={map.terrain} />
      <CityLights points={map.cityLights} />
      <Line points={map.nationLine} color={theme.accent} lineWidth={2.4} transparent opacity={0.95} />
      {map.stateLines.map((pts, i) => <Line key={i} points={pts} color="#1f6f9c" lineWidth={1.1} transparent opacity={0.5} />)}
      {sites.map((s) => <MapMarker key={s.name} site={s} theme={theme} hovered={hovered} onHover={onHover} onEnter={onEnter} />)}
      <CameraRig mode="sites" />
      <EffectComposer disableNormalPass>
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.0} luminanceSmoothing={0.2} />
      </EffectComposer>
    </>
  );
}

function SceneInterior({ plant, theme, selected, onSelect, values }) {
  const t = theme.three;
  const { rows, connectors, labels, pads } = useMemo(() => interiorLayout(plant), [plant]);
  const [hovered, setHovered] = useState(null);
  const focus = useMemo(() => rows.find((r) => r.id === selected)?.pos || null, [selected, rows]);
  return (
    <>
      <color attach="background" args={[t.bg]} />
      <fog attach="fog" args={[t.fog[0], 70, 260]} />
      <hemisphereLight intensity={0.6} color={'#eaf1ff'} groundColor="#2b3524" />
      <directionalLight position={[24, 40, 18]} intensity={2.2} color={'#fff4e6'} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-bias={-0.0002} />
      <directionalLight position={[-20, 14, -10]} intensity={0.7} color={'#9db8ff'} />
      <SafeEnvironment files="/hdri/spruit_sunrise_1k.hdr" background blur={0.06} intensity={1.1} />
      {/* terrain: grassy ground so the plant sits on land, not a neon grid */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[600, 600]} /><meshStandardMaterial color="#33402a" metalness={0.05} roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow><circleGeometry args={[120, 48]} /><meshStandardMaterial color="#3a4630" metalness={0.05} roughness={1} /></mesh>
      {/* concrete pad per unit */}
      {pads.map((p) => {
        const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
        return (
          <group key={p.id} position={[cx, 0, p.z]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow><planeGeometry args={[w, 22]} /><meshStandardMaterial color="#4a4e57" metalness={0.15} roughness={0.9} /></mesh>
          </group>
        );
      })}

      {connectors.map((c) => <Connector key={c.id} from={c.from} to={c.to} kind={c.kind} ghost={c.ghost} />)}
      {labels.map((l) => (
        <Html key={l.id} position={l.pos} center distanceFactor={l.unit ? 34 : 22} zIndexRange={[15, 0]}>
          {l.unit
            ? <div className="px-2 py-0.5 rounded text-[11px] font-bold tracking-widest uppercase" style={{ background: 'rgba(8,12,20,.72)', color: statusOf(l.status).color, border: `1px solid ${statusOf(l.status).color}55` }}>{l.text}</div>
            : <div className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(8,12,20,.7)', color: l.ghost ? '#6b7789' : '#8ea3bd', border: '1px solid rgba(255,255,255,.08)', opacity: l.ghost ? 0.7 : 1 }}>{l.text}</div>}
        </Html>
      ))}
      {rows.map((n) => <InteriorAsset key={n.id} node={n} theme={theme} selected={selected} hovered={hovered} onSelect={onSelect} onHover={setHovered} values={values} />)}

      <ContactShadows position={[0, 0.05, 0]} opacity={0.5} scale={220} blur={2.4} far={36} />
      <CameraRig mode="interior" focus={focus} />
      <EffectComposer disableNormalPass>
        <Bloom mipmapBlur intensity={t.bloom} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
        <Vignette eskil={false} offset={0.2} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

export function Facility({ model, theme, selected, onSelect, activePlant, onEnterPlant, values }) {
  const [hovered, setHovered] = useState(null);
  const plant = useMemo(() => (model?.plants || []).find((p) => p.name === activePlant) || null, [model, activePlant]);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 150, 118], fov: 40 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.0; }}>
      {plant
        ? <SceneInterior plant={plant} theme={theme} selected={selected} onSelect={onSelect} values={values} />
        : <SceneMap plants={model?.plants || []} theme={theme} hovered={hovered} onHover={setHovered} onEnter={onEnterPlant} />}
    </Canvas>
  );
}
