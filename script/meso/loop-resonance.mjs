// loop-resonance: the bucket-brigade test. Seed a CLOSED polygon of
// channel hops (each hop lands on the next loop site — emitted quanta
// are auto-aimed), then watch Lz_mov over 400 ticks.
//
// Loop: the in-plane hexagon cycle E,NE,NW,W,SW,SE repeated m times
// per edge (m=2 -> 12-node ring). Every hop preserves live parity.
//
// Sweep: emission clock k (fricmode -k), friction cap, latency,
// drest on/off. Question: does ANY regime keep Lz_mov > 0 — a live
// circulation — or does everything still collapse to latent storage?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const wasm = await mod.exports();

const W = 72, H = 72, D = 36;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

// closed hexagonal channel loop, edges repeated m times
const EDGE = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
const buildLoop = m => {
  // start so the loop is centered: hexagon spans x[-2m,4m], y[0,4m]
  let x = CX - 2 * m, y = CY - 2 * m;
  // snap start to live parity
  if ((x + y + CZ) & 1) x++;
  const pts = [];
  for (const [dx, dy] of EDGE)
    for (let i = 0; i < m; i++) {
      pts.push([x, y]);
      x += dx; y += dy;
    }
  return pts;
};
const loopChan = CV.map((v, c) => [v[0], v[1]]);   // xy components

const seedLoop = m => {
  const pts = buildLoop(m);
  let placed = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % pts.length];
    const dx = nx - x, dy = ny - y;
    const c = loopChan.findIndex(v => v[0] === dx && v[1] === dy && !CV[loopChan.indexOf(v)]?.[2]);
    // safer: find channel whose vector equals (dx,dy,0)
    const ci = CV.findIndex(v => v[0] === dx && v[1] === dy && v[2] === 0);
    if (ci < 0) { console.log('no channel for hop', dx, dy); continue; }
    wasm._meso3i_set(x, y, CZ, ci, wasm._meso3i_get(x, y, CZ, ci) + 24);
    placed++;
  }
  return placed;
};

const ledgers = () => {
  let Lm = 0, flux = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let px = 0, py = 0, f = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_get(x, y, z, c);
      px += n * CV[c][0]; py += n * CV[c][1]; f += n;
    }
    Lm += (x - CX) * py - (y - CY) * px;
    flux += f;
  }
  return [Lm, flux];
};

console.log('verifying loop closure (m=2):');
const pts = buildLoop(2);
console.log('  ' + pts.map(p => `(${p[0] - CX},${p[1] - CY})`).join(' → '));

const RUNS = [
  { k: 4, fric: 8,  lat: 1, drest: 0, tag: 'scalar baseline' },
  { k: 4, fric: 8,  lat: 1, drest: 1, tag: 'drest canonical' },
  { k: 2, fric: 8,  lat: 1, drest: 1, tag: 'drest fast-emission' },
  { k: 4, fric: 4,  lat: 1, drest: 1, tag: 'drest low-friction' },
  { k: 4, fric: 16, lat: 1, drest: 1, tag: 'drest heavy-drag' },
  { k: 4, fric: 8,  lat: 4, drest: 1, tag: 'drest lat4' },
];

for (const r of RUNS) {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(r.fric);
  wasm._meso3i_fricmode(-r.k);
  wasm._meso3i_lat(r.lat);
  wasm._meso3i_drest(r.drest);
  const n = seedLoop(2);
  let line = `${r.tag.padEnd(20)} · ${n} sites seeded | `;
  for (let t = 0; t <= 400; t++) {
    if (t % 40 === 0) {
      const [Lm, F] = ledgers();
      line += `t${t}: Lz=${Lm} f=${F}  `;
    }
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  console.log(line);
}
