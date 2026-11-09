// circulation.mjs — volumetric circulation: the missing observable.
// Every prior probe read NODE registers. Circulation lives on
// PLAQUETTES — the signed sum of flux around each elementary
// 3-edge triangle of the FCC lattice (discrete curl). A vortex
// shows nonzero curl density; a jam shows none.
//
// Flux per channel: F[c] = packet[c] + massFlight[c]  (in-flight)
//                Fw[c] = winding[c]                  (committed —
//                "frozen flux": a static vortex prints here)
//
// Triangles: all ordered triples (c1,c2,c3) of edge channels with
// CV[c1]+CV[c2]+CV[c3]=0. Plaquette at node n: edges (n, n+d1,
// n+d1+d2). Grouped by plane normal (the 4 {111} orientations).
//
// Controls: ring = rail triangle (positive, known circulation);
//           vac  = empty lattice (negative).
import { loadM26 } from '../lib/m26.mjs';

const MODE = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=knot').split('=')[1];
const TICKS = parseInt((process.argv.find(a => a.startsWith('--ticks=')) || '--ticks=600').split('=')[1]);
const BATH = parseFloat((process.argv.find(a => a.startsWith('--bath=')) || '--bath=0').split('=')[1]);

const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const EDGE = []; for (let c = 6; c <= 17; c++) EDGE[c] = CV[c];

// ---- enumerate all triangular plaquette orientations ----
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const orients = new Map();   // normal key -> {normal, tris:[[c1,c2,c3]...]}
for (let a = 6; a <= 17; a++) for (let b = a + 1; b <= 17; b++) for (let d = 6; d <= 17; d++) {
  if (a === d || b === d) continue;
  const s = [EDGE[a][0] + EDGE[b][0] + EDGE[d][0], EDGE[a][1] + EDGE[b][1] + EDGE[d][1], EDGE[a][2] + EDGE[b][2] + EDGE[d][2]];
  if (s[0] || s[1] || s[2]) continue;
  // dedupe: same unordered edge set counted once
  const set = [a, b, d].sort((x, y) => x - y).join(',');
  if (orients._sets?.has(set)) continue;
  const n = cross(EDGE[a], EDGE[b]);
  const key = n.map(v => Math.sign(v)).join(',');
  (orients._sets ??= new Set()).add(set);
  if (!orients.has(key)) orients.set(key, { normal: n, tris: [] });
  orients.get(key).tris.push([a, b, d]);
}
delete orients._sets;
console.log(`plaquette orientations found: ${orients.size}`);
for (const [k, o] of orients) console.log(`  normal ${k}: ${o.tris.length} triangle types`);

// ---- scene setup ----
if (MODE === 'knot') {
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
    q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
    q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
  }
  const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
  globalThis.feed = () => { for (const [c, ox, oz] of spokes) {
    let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
    if ((sx + sy + sz) & 1) sz++;
    q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };
} else if (MODE === 'ring') {
  q._moore26_rail_gate_set(64);
  const RING = [
    { p: [16, 16, 16], pair: [8, 9], w: [200, 100] },
    { p: [17, 15, 16], pair: [16, 17], w: [200, 100] },
    { p: [17, 16, 15], pair: [12, 13], w: [100, 200] },
  ];
  for (const r of RING) {
    q._moore26_winding_set(r.p[0], r.p[1], r.p[2], r.pair[0], r.w[0]);
    q._moore26_winding_set(r.p[0], r.p[1], r.p[2], r.pair[1], r.w[1]);
    q._moore26_mass_set(r.p[0], r.p[1], r.p[2], 10);
  }
  q._moore26_packet_set(16, 16, 16, 8, 4); q._moore26_packet_nu_set(16, 16, 16, 8, 200);
  globalThis.feed = () => {};
} else { globalThis.feed = () => {}; }

let s = 777;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const bath = () => { if (!BATH) return;
  for (let k = 0; k < 16; k++) {
    const x = 8 + ((rnd() * 17) | 0), y = 8 + ((rnd() * 17) | 0), z = 8 + ((rnd() * 17) | 0);
    if (((x + y + z) & 1) === 0 && rnd() < BATH) {
      const c = [6, 8, 10, 12, 14, 16][(rnd() * 6) | 0];
      q._moore26_packet_set(x, y, z, c, 1); q._moore26_packet_nu_set(x, y, z, c, 64);
    } } };

// ---- the circulation integral over the probe box ----
const BOX = MODE === 'ring' ? [14, 19] : [10, 22];
function scan() {
  const out = new Map([...orients.keys()].map(k => [k, { flux: 0, wind: 0, aflux: 0, awind: 0, top: [] }]));
  for (let x = BOX[0]; x <= BOX[1]; x++) for (let y = BOX[0]; y <= BOX[1]; y++) for (let z = BOX[0]; z <= BOX[1]; z++) {
    if (((x + y + z) & 1) !== 0) continue;
    for (const [key, o] of orients) {
      let cf = 0, cw = 0;
      for (const [c1, c2, c3] of o.tris) {
        // plaquette: n -> n+d1 -> n+d1+d2 -> n (d3 closes)
        const n2 = [(x + EDGE[c1][0]) & 31, (y + EDGE[c1][1]) & 31, (z + EDGE[c1][2]) & 31];
        const n3 = [(n2[0] + EDGE[c2][0]) & 31, (n2[1] + EDGE[c2][1]) & 31, (n2[2] + EDGE[c2][2]) & 31];
        cf += (Number(q._moore26_packet_get(x, y, z, c1)) + Number(q._moore26_massflight_get(x, y, z, c1)))
            + (Number(q._moore26_packet_get(...n2, c2)) + Number(q._moore26_massflight_get(...n2, c2)))
            + (Number(q._moore26_packet_get(...n3, c3)) + Number(q._moore26_massflight_get(...n3, c3)));
        cw += Number(q._moore26_winding_get(x, y, z, c1))
            + Number(q._moore26_winding_get(...n2, c2))
            + Number(q._moore26_winding_get(...n3, c3));
      }
      const r = out.get(key);
      r.flux += cf; r.wind += cw; r.aflux += Math.abs(cf); r.awind += Math.abs(cw);
      if (cf || cw) r.top.push(`(${x},${y},${z}) F=${cf} W=${cw}`);
    }
  }
  return out;
}

console.log(`circulation: mode=${MODE} bath=${BATH} ticks=${TICKS} box=${BOX}`);
for (let t = 0; t <= TICKS; t += 100) {
  const r = scan();
  let line = `t=${t}`;
  for (const [k, o] of r) line += ` | n${k}: F=${o.flux} |F|=${o.aflux} W=${o.wind} |W|=${o.awind}`;
  console.log(line);
  for (let i = 0; i < 100 && t < TICKS; i++) { feed(); bath(); q._moore26_tick(); }
}
