/* strain-relay — force transmitted THROUGH the medium.
 * (Newton's cradle, substrate edition)
 *
 * The full causal chain, end to end:
 *   carrier A is denied at a stall wall (link 0 of a committed
 *   {1,1,0} wire) -> its paid momentum lands in the wall's fluxV
 *   -> the qVacPol wave layer propagates the strain down the wire
 *   -> when the front reaches a LATE link, a touching receiver
 *   cell R gets the reaction press (qFieldReact) — pushed by a
 *   collision it never saw, through a medium that remembered it.
 *
 * Two receivers: near (touching link 4) and far (touching link 8).
 * If this is really wave transmission, the far receiver's press
 * arrives ~4 links x 2.3t later than the near one's — the force
 * takes TIME to cross the medium. Controls: --vs=0 (no medium,
 * charge stays home, nobody pushed); --nomed (wire uncommitted —
 * deg=0 cells freeze the wave at the source).
 *
 * Usage: node script/cascade/strain-relay.mjs
 *        [--vs=3|0] [--nomed] [--react=2] [--p=3200] [--ticks=60]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const NOMED = process.argv.includes('--nomed');
const RX = parseInt(arg('react', '2'));
const P = parseInt(arg('p', '3200'));
const TICKS = parseInt(arg('ticks', '60'));
const MASS = 256;

/* wire: committed {1,1,0} conduits (8+i,8+i,16), i=0..11.
 * link 0 is ALSO the stall wall (wear=200 — committed either way).
 * A at (7,8,16) odd, kicked pair 3 -> its {1,1,0} hop crosses
 * conduit (8,8,16), gets denied, deposits pd into fluxV[0].
 * R_near at (13,12,16) touches ONLY link 4 (12,12,16).
 * R_far  at (17,16,16) touches ONLY link 8 (16,16,16). */
const wire = [];
for (let i = 0; i < 12; i++) wire.push([8 + i, 8 + i, 16]);
const A = [7, 8, 16], RN = [13, 12, 16], RF = [17, 16, 16];

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
q._moore26_wall_press_set(1);
q._moore26_wall_stall_set(4);
q._moore26_field_react_set(RX);
for (const c of wire) {
  q._moore26_winding_set(...c, 6, NOMED ? 0 : 64);
  q._moore26_winding_set(...c, 7, NOMED ? 0 : 64);
}
q._moore26_winding_set(...wire[0], 6, 200);   /* the wall — stalled AND committed */
q._moore26_winding_set(...wire[0], 7, 200);
q._moore26_mass_set(...A, MASS);
q._moore26_momentum_at_set(...A, 3, P);
q._moore26_momentum_set(255);
q._moore26_mass_set(...RN, MASS);
q._moore26_mass_set(...RF, MASS);

const pOf = (c) => { let t = 0; for (let e = 0; e < 13; e++) t += q._moore26_momentum_at_get(...c, e); return t; };
const vOf = (c) => q._moore26_fluxv_get(...c, 0);
const xOf = (lo, hi) => {
  let num = 0, den = 0;
  for (let z = 12; z < 21; z++) for (let y = 10; y < 21; y++) for (let x = lo; x <= hi; x++) {
    const m = q._moore26_mass_get(x, y, z); num += x * m; den += m;
  }
  return den > 0 ? num / den : -1;
};

console.log(`=== strain-relay: vs=${VS} nomed=${NOMED} react=${RX} p=${P} ===`);
console.log(`   t | wallV   vL4    vL8   |  pA      pRN      pRF    |  xA     xRN    xRF`);
const e0 = q._moore26_events(27);
let tN = -1, tF = -1;
for (let t = 0; t <= TICKS; t++) {
  const pa = pOf(A), prn = pOf(RN), prf = pOf(RF);
  if (prn !== 0 && tN < 0) tN = t;
  if (prf !== 0 && tF < 0) tF = t;
  if (t <= 6 || t % 4 === 0)
    console.log(`  ${String(t).padStart(3)} | ${String(vOf(wire[0])).padStart(5)}  ${String(vOf(wire[4])).padStart(5)}  ${String(vOf(wire[8])).padStart(5)}  | ${String(pa).padStart(6)}  ${String(prn).padStart(6)}  ${String(prf).padStart(6)}  |  ${xOf(5,9).toFixed(1)}   ${xOf(10,14).toFixed(1)}   ${xOf(15,19).toFixed(1)}`);
  if (t < TICKS) q._moore26_tick();
}
console.log(`  -> first press: near t=${tN}  far t=${tF}  delay=${tF > 0 && tN > 0 ? tF - tN : '-'}t  ev27=${q._moore26_events(27) - e0}`);
