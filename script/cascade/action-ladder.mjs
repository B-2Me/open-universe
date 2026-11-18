/* action-ladder.mjs — the dynamical readout of h_sub.
 *
 * The packet action (op = nu*age mod 256, h_sub = 256 nu*ticks) is
 * authored into the offer phase. The two-action question asks for
 * a SECOND sector where 256 appears un-authored. The ring cavity
 * provides it: a packet lapping a rail ring of circumference C
 * returns with op += nu*C each lap. Only modes with nu*C = 0 mod
 * 256 are self-consistent — a Fabry-Perot ladder with spacing
 * dnu = 256/C. The absorber reads the ladder DYNAMICALLY:
 *
 *   - on-ladder nu (nu*C ~ 0): op is the SAME every lap — either
 *     absorbed at first catch (op in window) or PHASE-LOCKED
 *     forever (bound mode — the cavity keeps it)
 *   - off-ladder nu: op precesses nu*C/lap -> eventually hits the
 *     window -> absorbed with structured latency
 *
 * So survival(nu) should comb at nu*C ~ 0, and the comb spacing
 * reads h_sub/C — an action measurement from survival statistics,
 * not from the gate's arithmetic.
 *
 *   node script/cascade/action-ladder.mjs [--c=24] [--g=8]
 *        [--catch=4] [--nu=4..64] [--t=400] [--reps=8]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };

const C = parseInt(arg('c', '24'));
const G = parseInt(arg('g', '8'));
const CATCH = parseInt(arg('catch', '4'));
const T = parseInt(arg('t', '400'));
const REPS = parseInt(arg('reps', '8'));
const MASS = parseInt(arg('m', '10'));
const SIZE = 32;
const q = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
            [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const PAIR = c => {
  const lo = c & ~1;
  return c & 1 ? { ch: [lo, lo+1], w: [100, 200] }
               : { ch: [lo, lo+1], w: [200, 100] };
};
function buildRing(r, cx, cy, z) {
  const side = [6, 8, 7, 9];
  const nodes = [];
  let x = cx - r, y = cy;
  for (let s = 0; s < 4; s++) {
    const c = side[s], v = CV[c];
    for (let i = 0; i < r; i++) { nodes.push({ x, y, z, c }); x += v[0]; y += v[1]; z += v[2]; }
  }
  return nodes;
}

const ring = buildRing(C / 4, 16, 16, 16);
const det = ring[0], inj = ring[1];

function run(nu) {
  initM26(q, SIZE, SIZE, SIZE);
  q._moore26_rail_gate_set(64);
  q._moore26_catch_gate_set(CATCH);
  q._moore26_phase_gate_set(G);
  for (let k = 0; k < ring.length; k++) {
    const n = ring[k];
    if (k === 0) { q._moore26_mass_set(n.x, n.y, n.z, MASS); continue; }
    const { ch, w } = PAIR(n.c);
    q._moore26_winding_set(n.x, n.y, n.z, ch[0], w[0]);
    q._moore26_winding_set(n.x, n.y, n.z, ch[1], w[1]);
  }
  /* continuous train: born offsets sweep all residues uniformly,
   * so the absorbed fraction = fraction of the packet's op-orbit
   * landing in the detector's phase window */
  for (let t = 0; t < T; t++) {
    q._moore26_packet_set(inj.x, inj.y, inj.z, inj.c, 1);
    q._moore26_packet_nu_set(inj.x, inj.y, inj.z, inj.c, nu);
    q._moore26_tick();
  }
  /* ledger: ev5 arms (absorbed offers), packet energy still on the
   * ring (orbiting), and det deposits */
  let orbiting = 0;
  for (const n of ring) for (let c = 6; c < 18; c++)
    orbiting += q._moore26_packet_get(n.x, n.y, n.z, c);
  let detInc = 0, detWind = 0;
  for (let c = 0; c < 26; c++) {
    detInc += q._moore26_incipient_get(det.x, det.y, det.z, c);
    detWind += q._moore26_winding_get(det.x, det.y, det.z, c);
  }
  return { ev5: q._moore26_events(5), orbiting, detInc, detWind };
}

console.log(`=== action-ladder: C=${C} g=${G} catch=${CATCH} m=${MASS} t=${T} ===`);
console.log(`  predicted absorption comb: absorbed fraction ~ gcd(nu*C,256) structure`);
console.log(`  nu   d(nuC)  gcd   arms  orbiting  detWind  detInc`);
const NUS = String(arg('nu', '4,8,11,12,16,20,21,24,32,40,43,48,56,64,80,96,128')).split(',').map(Number);
const gcd = (a, b) => b ? gcd(b, a % b) : a;
for (const nu of NUS) {
  let d = (nu * C) % 256; if (d > 128) d = 256 - d;
  const r = run(nu);
  console.log(`  ${String(nu).padStart(3)}  ${String(d).padStart(5)}  ${String(gcd(nu * C, 256)).padStart(3)}  ` +
    `${String(r.ev5).padStart(5)}  ${String(r.orbiting).padStart(8)}  ${String(r.detWind).padStart(8)}  ${r.detInc}`);
}
