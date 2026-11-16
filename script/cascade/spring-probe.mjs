/* spring-probe — elastic strain calibration: the wall as battery.
 *
 * One massive odd cell kicked (+x, momentum pair 3) at a pre-worn
 * conduit whose stall gate permanently denies the hop. Denied
 * momentum transfers carrier->conduit into fluxV (paid, 1:1);
 * qFieldReact spends it back onto the touching cell at
 * fluxV>>react per tick (debit 4t). A full charge/hold/discharge
 * cycle with per-tick momentum ledger: carrier p, wall fluxV,
 * ev27 press-delivered, cell centroid.
 *
 * Questions: does the ledger close (p_lost = fluxV_gained,
 * fluxV_spent = p_returned)? Does the cell BOUNCE (elastic) or
 * STICK (inelastic)? Is react the spring constant?
 *
 * Usage: node script/cascade/spring-probe.mjs
 *        [--p=3200] [--react=0,1,4] [--wear=200] [--stall=4]
 *        [--ticks=40] [--creep=0]
 */
import { loadM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 32, MASS = 256;
const P = parseInt(arg('p', '3200'));
const RXS = arg('react', '0,1,4').split(',').map(Number);
const WEAR = parseInt(arg('wear', '200'));
const STALL = parseInt(arg('stall', '4'));
const CY = parseInt(arg('creep', '0'));
const TICKS = parseInt(arg('ticks', '40'));

/* odd cell at (11,16,16): 11+16+16=43 odd. The +x hop crosses even
 * conduit (12,16,16) which we pre-wear to lock instantly. */
const CELL = [11, 16, 16], WALL = [12, 16, 16];

const cellX = () => {
  let num = 0, den = 0;
  for (let z = 8; z < 24; z++) for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) {
    const m = q._moore26_mass_get(x, y, z); num += x * m; den += m;
  }
  return den > 0 ? num / den : -1;
};
const cellP = () => {
  let t = 0;
  for (let e = 0; e < 13; e++) t += q._moore26_momentum_at_get(...CELL, e);
  return t;
};
const wallV = () =>
  q._moore26_fluxv_get(...WALL, 0) + q._moore26_fluxv_get(...WALL, 1) + q._moore26_fluxv_get(...WALL, 2);

for (const RX of RXS) {
  q._moore26_init(W, W, W);
  q._moore26_mag_kick_set(0);
  q._moore26_wall_press_set(1);
  q._moore26_wall_stall_set(STALL);
  q._moore26_field_react_set(RX);
  q._moore26_creep_yield_set(CY);
  /* the wall: wear the crossing conduit's channel pair 6/7 so
   * ws+1>=stall from tick 0 — every hop denied */
  q._moore26_winding_set(...WALL, 6, WEAR);
  q._moore26_winding_set(...WALL, 7, WEAR);
  /* the projectile: mass + momentum pair 3 (+x) */
  q._moore26_mass_set(...CELL, MASS);
  q._moore26_momentum_at_set(...CELL, 3, P);
  q._moore26_momentum_set(255);

  console.log(`\n=== spring: p=${P} react=${RX} stall=${STALL} wear=${WEAR} creep=${CY} ===`);
  console.log(`   t   cell_p  fluxV   ev27    x     (ledger: p+fluxV)`);
  let peakV = 0, e0 = q._moore26_events(27);
  for (let t = 0; t <= TICKS; t++) {
    const p = cellP(), fv = wallV(), e27 = q._moore26_events(27) - e0, x = cellX();
    if (fv > peakV) peakV = fv;
    if (t <= 8 || t % 5 === 0)
      console.log(`  ${String(t).padStart(3)}  ${String(p).padStart(6)}  ${String(fv).padStart(6)}  ${String(e27).padStart(6)}  ${x.toFixed(2)}  ${p + fv}`);
    if (t < TICKS) q._moore26_tick();
  }
  const p = cellP(), fv = wallV(), e27 = q._moore26_events(27) - e0;
  console.log(`  -> peak_fluxV=${peakV}  final_p=${p}  residual_fluxV=${fv}  press_total=${e27}  disp=${(cellX() - 11).toFixed(2)}`);
}
