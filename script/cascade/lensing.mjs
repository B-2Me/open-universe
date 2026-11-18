/* lensing.mjs — ballistic deflection by the potential well
 *
 * The missing half of the force law: qAttract only acts on
 * declines (contact). qLens bends FREE flight — a packet crossing
 * the well's gradient may swap onto the forward-cone edge channel
 * whose target cell has the deepest well. Geodesic deviation.
 *
 * Fixture: mass M at C. The well is seasoned TAGE ticks first
 * (retarded — it needs ~R ticks to diffuse out). Then a beam on
 * ch8=(1,-1,0) is fired from x=X0 at impact parameter b = z0-CZ
 * (the straight line passes C at distance |b|). catch_gate high
 * so the beam stays ballistic; decay/heat records absorption.
 *
 * Measurements per b: mean transverse deflection Deltaz
 * (final z - z0; negative bends toward the mass plane), channel
 * distribution (bent onto which carrier), survival (shadowing),
 * and ev68 = total bends. theta ~ |Dz| / path length.
 *
 *   node script/cascade/lensing.mjs [--n=64 --m=4000 --lens=255
 *     --tage=80 --t=30 --bmax=12]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};

const N    = parseInt(arg('n', '64'));
const M    = parseInt(arg('m', '4000'));
const LENS = parseInt(arg('lens', '255'));
const TAGE = parseInt(arg('tage', '80'));
const T    = parseInt(arg('t', '30'));
const BMAX = parseInt(arg('bmax', '12'));
const NU   = parseInt(arg('nu', '64'));
const PER  = parseInt(arg('per', '8'));   /* packets per b — x-train */
const CNT  = parseInt(arg('cnt', '64'));  /* count per packet — a SWARM:
   * virgin-vacuum drip kills ~1/8 of a lone quantum per hop; a swarm
   * loses ~1 unit per hop and survives the baseline */

const CORE = parseInt(arg('core', '0'));  /* hard-core well threshold */
const WMODE = parseInt(arg('wmode', '0')); /* well kernel: 0=Jacobi, 1=eikonal cone */
const HOP  = parseInt(arg('hop', '2048')); /* eikonal hop cost (slope=force) */

const q = await loadM26();
initM26(q, N, N, N);
q._moore26_catch_gate_set(255);  /* ~ballistic beam (1/255 arm/hop) */
q._moore26_lens_set(LENS);
q._moore26_core_set(CORE);       /* excluded volume: well>=core repels */
if (WMODE) q._moore26_wellmode_set(WMODE, HOP);
q._moore26_attract_set(0);       /* isolate: free-flight bending only */

/* mass at C, on an even cell so its own offers work normally */
const CX = N >> 1, CY = 24, CZ = 16;
q._moore26_mass_set(CX, CY, CZ, M);

/* season the well — retarded propagation: ~1 cell/tick + settling */
for (let t = 0; t < TAGE; t++) q._moore26_tick();
const wellAt = (x, y, z) => Number(q._moore26_well_get(x, y, z));
console.log(`=== lensing N=${N} M=${M} lens=${LENS} core=${CORE} ` +
  `tage=${TAGE} t=${T} nu=${NU} ===`);
console.log(`well profile r=0..8: ` +
  [0, 1, 2, 4, 8].map(r =>
    `${r}:${wellAt(CX + r, CY, CZ)}`).join('  ') +
  `   (edge of field r=16: ${wellAt(CX + 16, CY, CZ)})`);

/* beam: ch8 = (1,-1,0). A packet from (X0,Y0,z0) passes x=CX after
 * CX-X0 hops at y=Y0-(CX-X0); choosing Y0=CY+(CX-X0) makes the
 * straight line thread the mass's xy position — closest approach
 * = |z0-CZ| = b exactly. Seed PER packets per b as an x-train for
 * independent rand rolls. */
const X0 = 4, Y0 = CY + (CX - X0), CH = 8;
const XSPC = parseInt(arg('xspc', '2'));  /* x spacing of the train;
   * >2 dilutes the swarm — a converged swarm self-thermalizes in
   * the focused shell (density tax) before reaching the core */
const seeds = [];
for (let b = -BMAX; b <= BMAX; b += 2) {
  const z0 = CZ + b;
  if (z0 < 0 || z0 >= N) continue;
  for (let k = 0; k < PER; k++) {
    const x = X0 + XSPC * k;
    if (((x + Y0 + z0) & 1) !== 0) continue;   /* even cells only */
    q._moore26_packet_set(x, Y0, z0, CH, CNT);
    q._moore26_packet_nu_set(x, Y0, z0, CH, NU);
    seeds.push({ x, z0, b });
  }
}
console.log(`seeded ${seeds.length} beam packets on ch${CH}`);

/* flight */
const V = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
  [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],
  [1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],
  [0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
  [1,1,1],[-1,-1,-1],[1,1,-1],[-1,-1,1],
  [1,-1,1],[-1,1,-1],[1,-1,-1],[-1,1,1]];
const ev68_0 = Number(q._moore26_events(68));
const ev69_0 = Number(q._moore26_events(69));
const ev70_0 = Number(q._moore26_events(70));
for (let t = 0; t < T; t++) q._moore26_tick();
console.log(`ev68 bends: ${Number(q._moore26_events(68)) - ev68_0}  ` +
  `ev69 core-defl: ${Number(q._moore26_events(69)) - ev69_0}  ` +
  `ev70 escapes: ${Number(q._moore26_events(70)) - ev70_0}`);

/* census: each surviving packet -> (b bin, Deltaz, channel) */
const rows = new Map();
for (const s of seeds) if (!rows.has(s.b)) rows.set(s.b, []);
let unaccounted = seeds.length;
for (let x = 0; x < N; x++) for (let y = 0; y < N; y++)
  for (let z = 0; z < N; z++)
    for (let c = 6; c < 18; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      if (!p) continue;
      for (let k = 0; k < p; k++) {
      /* attribute to the nearest seed z0 — packets can drift in z
       * after bending, so match by x-parity band of the x-train:
       * seed x = X0+2k moves (1,-1,0)+bends; use closest z0 */
      let best = null, bd = 1e9;
      for (const s of seeds) {
        const d = Math.abs(z - s.z0) + Math.abs(x - s.x - T) * 0.01;
        if (d < bd) { bd = d; best = s.b; }
      }
        rows.get(best).push({ z, c, chdz: V[c][2] });
      }
    }
console.log('\n  b | surv | <Dz> | -z chan | +z chan | straight | bends/hop');
for (const [b, list] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
  if (!list.length) { console.log(`  ${String(b).padStart(3)} |    0`); continue; }
  const mz = list.reduce((s, r) => s + (r.z - (CZ + b)), 0) / list.length;
  const neg = list.filter(r => r.chdz < 0).length;
  const pos = list.filter(r => r.chdz > 0).length;
  const str = list.filter(r => r.c === CH).length;
  console.log(`  ${String(b).padStart(3)} | ${String(list.length).padStart(4)} | ` +
    `${mz.toFixed(2).padStart(6)} | ${String(neg).padStart(7)} | ` +
    `${String(pos).padStart(7)} | ${String(str).padStart(8)} |`);
}
