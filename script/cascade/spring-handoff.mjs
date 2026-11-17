/* spring-handoff — is stored strain FUNGIBLE? (the battery's
 * second customer). spring-probe left residual fluxV locked in a
 * stall conduit when the carrier broke contact. Here we charge the
 * wall to capacity at react=0 (perfect hold), then:
 *
 *   swap : delete carrier A, spawn fresh cell B on the FAR side of
 *          the same conduit, then flip react on. Does B receive the
 *          stored impulse? In which direction?
 *   duel : keep A parked on the near side AND add B on the far
 *          side — two customers, one reservoir. Scan order decides
 *          who drinks each tick; measure the split.
 *
 * Prediction (press law): any massive odd cell touching a committed
 * conduit draws fluxV[a]>>react per axis per tick, conduit debited
 * 4t. The charge is face-agnostic — B should get the same press A
 * would have. In duel, the lower-indexed si wins each tick.
 *
 * Usage: node script/cascade/spring-handoff.mjs
 *        [--mode=swap|duel] [--p=3200] [--react=2] [--charge=10]
 *        [--wear=200] [--stall=4] [--ticks=40]
 */
import { loadM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 32, MASS = 256;
const MODE = arg('mode', 'swap');
const P = parseInt(arg('p', '3200'));
const RX = parseInt(arg('react', '2'));
const CHARGE = parseInt(arg('charge', '10'));
const WEAR = parseInt(arg('wear', '200'));
const STALL = parseInt(arg('stall', '4'));
const TICKS = parseInt(arg('ticks', '40'));

/* conduit (12,16,16) even; A at (11,16,16) odd — the original
 * customer on the -x face. B at (13,16,16) odd — the second
 * customer on the +x face. A's stored impulse is +x (denied +x
 * hop): the press pushes any customer +x regardless of side. */
const A = [11, 16, 16], B = [13, 16, 16], WALL = [12, 16, 16];

const siteP = (c) => { let t = 0; for (let e = 0; e < 13; e++) t += q._moore26_momentum_at_get(...c, e); return t; };
const siteM = (c) => q._moore26_mass_get(...c);
const wallV = () =>
  q._moore26_fluxv_get(...WALL, 0) + q._moore26_fluxv_get(...WALL, 1) + q._moore26_fluxv_get(...WALL, 2);
/* A/B may shed cells when pressed — centroid over the half of the
 * probe box containing each site tracks the body, not a point. */
const halfX = (lo, hi) => {
  let num = 0, den = 0;
  for (let z = 8; z < 24; z++) for (let y = 8; y < 24; y++) for (let x = lo; x <= hi; x++) {
    const m = q._moore26_mass_get(x, y, z); num += x * m; den += m;
  }
  return den > 0 ? num / den : -1;
};

q._moore26_init(W, W, W);
q._moore26_mag_kick_set(0);
q._moore26_wall_press_set(1);
q._moore26_wall_stall_set(STALL);
q._moore26_field_react_set(0);
q._moore26_winding_set(...WALL, 6, WEAR);
q._moore26_winding_set(...WALL, 7, WEAR);
q._moore26_mass_set(...A, MASS);
q._moore26_momentum_at_set(...A, 3, P);
q._moore26_momentum_set(255);

console.log(`=== handoff mode=${MODE} p=${P} charge=${CHARGE}t then react=${RX} stall=${STALL} wear=${WEAR} ===`);
console.log(`   t   wallV    pA    mA    xA   |   pB    mB    xB   | ev27  ledger`);

const e0 = q._moore26_events(27);
const row = (t) => {
  const fv = wallV(), pa = siteP(A), ma = siteM(A), pb = siteP(B), mb = siteM(B);
  const xa = halfX(8, 11), xb = halfX(13, 24);
  const led = fv + pa + pb;
  console.log(`  ${String(t).padStart(3)}  ${String(fv).padStart(6)}  ${String(pa).padStart(5)}  ${String(ma).padStart(4)}  ${xa < 0 ? '  -  ' : xa.toFixed(2)} | ${String(pb).padStart(5)}  ${String(mb).padStart(4)}  ${xb < 0 ? '  -  ' : xb.toFixed(2)} | ${String(q._moore26_events(27) - e0).padStart(6)}  ${led}`);
};

/* phase 1: charge — A's hop is denied, p -> wall fluxV, react=0 holds */
for (let t = 0; t <= CHARGE; t++) { if (t % 5 === 0 || t === CHARGE) row(t); q._moore26_tick(); }

/* phase 2: the swap — remove A (mass + momentum cleared), seat B */
if (MODE === 'swap') {
  q._moore26_mass_set(...A, 0);
  for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(...A, e, 0);
}
q._moore26_mass_set(...B, MASS);
console.log(`  --- ${MODE === 'swap' ? 'A removed,' : 'A held,'} B seated at (13,16,16), react ${RX} on ---`);
q._moore26_field_react_set(RX);

/* phase 3: discharge — who drinks? */
for (let t = 0; t <= TICKS; t++) {
  if (t <= 8 || t % 5 === 0) row(CHARGE + 1 + t);
  if (t < TICKS) q._moore26_tick();
}
const fv = wallV(), pa = siteP(A), pb = siteP(B);
console.log(`  -> residual_fluxV=${fv}  pA=${pa}  pB=${pb}  delivered=${q._moore26_events(27) - e0}`);
