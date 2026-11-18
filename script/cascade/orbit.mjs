/* orbit.mjs — bound-trajectory characterization around a hard-cored well
 *
 * Fixture: mass M at C. qWellMode=1 (eikonal cone V = m - hop*r,
 * retarded at 1 cell/tick). qCore = hard-core threshold (well>=core
 * is excluded volume -> tangential skim, the nucleon hard core).
 * qLens bends free flight down -grad(well).
 *
 * A ring of tangent packets is parked at radius R and reseeded for
 * TSEED ticks to pave the lane; then we watch the cloud: total
 * population (attrition), azimuth histogram (ring structure and
 * precession), radial histogram, channel census, and the number of
 * connected packet clumps (constituent count).
 *
 *   node script/cascade/orbit.mjs [--n=64 --m=60000 --hop=2048
 *     --core=60000 --r=6 --tseed=15 --t=150 --cnt=120 --nu=64]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};

const N     = parseInt(arg('n', '64'));
const M     = parseInt(arg('m', '60000'));
const HOP   = parseInt(arg('hop', '2048'));
const CORE  = parseInt(arg('core', '60000'));
const LENS  = parseInt(arg('lens', '255'));
const TAGE  = parseInt(arg('tage', '80'));
const TSEED = parseInt(arg('tseed', '15'));
const T     = parseInt(arg('t', '150'));
const CNT   = parseInt(arg('cnt', '120'));
const NU    = parseInt(arg('nu', '64'));
const R     = parseInt(arg('r', '6'));

const q = await loadM26();
initM26(q, N, N, N);
q._moore26_catch_gate_set(255);
q._moore26_lens_set(LENS);
q._moore26_wellmode_set(1, HOP);
q._moore26_welltune_set(52, 12);
q._moore26_core_set(CORE);
const CX = N >> 1, CY = 24, CZ = 16;
q._moore26_mass_set(CX, CY, CZ, M);
for (let t = 0; t < TAGE; t++) q._moore26_tick();
const wellAt = (r) => Number(q._moore26_well_get(CX + r, CY, CZ));
console.log(`=== orbit N=${N} M=${M} hop=${HOP} core=${CORE} lens=${LENS} ` +
  `R=${R} cnt=${CNT} nu=${NU} ===`);
console.log(`well: ` + [0, 2, 4, 6, 8, 12, 16, 20].map(r => `${r}:${wellAt(r)}`).join(' '));

/* tangent parks: positions on a circle at radius R, each seeded with
 * the edge channel closest to the local tangent direction. */
const V = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
  [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],
  [1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],
  [0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
  [1,1,1],[-1,-1,-1],[1,1,-1],[-1,-1,1],
  [1,-1,1],[-1,1,-1],[1,-1,-1],[-1,1,1]];
const parks = [];
for (let k = 0; k < 16; k++) {
  const th = (k / 16) * 2 * Math.PI;
  const x = Math.round(CX + R * Math.cos(th));
  const y = Math.round(CY + R * Math.sin(th));
  const z = CZ;
  if (((x + y + z) & 1) !== 0) continue;   /* even sublattice only */
  /* tangent = (-sin th, cos th, 0) — pick closest edge channel */
  const tx = -Math.sin(th), ty = Math.cos(th);
  let bc = -1, bd = -2;
  for (let c = 6; c < 18; c++) {
    const d = (tx * V[c][0] + ty * V[c][1]) / Math.hypot(V[c][0], V[c][1], V[c][2]);
    if (d > bd) { bd = d; bc = c; }
  }
  parks.push({ x, y, z, c: bc });
}
const seed = () => {
  for (const p of parks) {
    q._moore26_packet_set(p.x, p.y, p.z, p.c, CNT);
    q._moore26_packet_nu_set(p.x, p.y, p.z, p.c, NU);
  }
};
console.log(`parked ${parks.length} tangent sites at R=${R}: ` +
  parks.map(p => `(${p.x - CX},${p.y - CY},${p.z - CZ})/${p.c}`).join(' '));
seed();
for (let t = 0; t < TSEED; t++) { q._moore26_tick(); seed(); }

/* census: cloud inside r<14 — population, azimuth histogram (16 bins),
 * radial histogram, channel census, clump count (flood fill over
 * packet-bearing even cells, 26-neighbor connectivity) */
const census = () => {
  const az = new Array(16).fill(0), rh = new Array(12).fill(0);
  const chan = {}; const cells = new Map();
  let tot = 0;
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
    for (let c = 6; c < 18; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      if (!p) continue;
      const dx = x - CX, dy = y - CY, dz = z - CZ;
      const r = Math.hypot(dx, dy, dz);
      if (r > 14) continue;
      tot += p;
      az[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 16) % 16] += p;
      rh[Math.min(11, Math.floor(r))] += p;
      chan[c] = (chan[c] || 0) + p;
      const key = x * 4096 + y * 64 + z;
      cells.set(key, (cells.get(key) || 0) + p);
    }
  /* clump count — BFS over occupied cells */
  const seen = new Set(); let clumps = 0; const clumpSz = [];
  for (const key of cells.keys()) {
    if (seen.has(key)) continue;
    clumps++;
    let sz = 0; const stack = [key];
    while (stack.length) {
      const k = stack.pop();
      if (seen.has(k)) continue;
      seen.add(k); sz += cells.get(k);
      const x = (k / 4096) | 0, y = ((k / 64) | 0) % 64, z = k % 64;
      for (const [vx, vy, vz] of V) {
        const nk = (x + vx) * 4096 + (y + vy) * 64 + (z + vz);
        if (cells.has(nk) && !seen.has(nk)) stack.push(nk);
      }
    }
    clumpSz.push(sz);
  }
  return { tot, az, rh, chan, clumps, clumpSz: clumpSz.sort((a, b) => b - a).slice(0, 8) };
};

console.log('\n  t | tot | clumps(sz) | azimuth hist (16 bins) | radial hist');
for (let t = TSEED + 1; t <= TSEED + T; t++) {
  q._moore26_tick();
  const dt = t - TSEED;
  if (dt % 10 && dt !== 1) continue;
  const c = census();
  console.log(`  ${String(t).padStart(3)} | ${String(c.tot).padStart(5)} | ` +
    `${c.clumps} (${c.clumpSz.slice(0, 4).join(',')}) | ` +
    `${c.az.join(' ')} | ${c.rh.join(' ')}`);
}
