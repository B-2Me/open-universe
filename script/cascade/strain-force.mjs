/* strain-force — the medium's force LAW: delivered impulse vs
 * receiver distance along a committed wire.
 *
 * strain-relay showed a wall-caught impulse propagates down a
 * committed wire and presses remote receivers (delay ~1t/link).
 * This maps the LAW: identical impulse, receiver touching link
 * D only (isolated trial per D — receivers on one wire would
 * compete, draining the wave for the farther ones).
 *
 * For each D: first-press tick (should be ~D links x ~1t) and
 * total momentum the receiver exits with. The decay F(D) is the
 * substrate's interaction potential through the wave channel:
 * is delivered impulse ~1/D (amplitude decay), ~const (rail
 * delivery), or exponential (lossy medium)?
 *
 * Receiver sits face-adjacent to link D: link D is (8+D,8+D,16),
 * odd cell touching it face-on: (8+D, 8+D-1, 16)? Face-adjacent =
 * face channels {±1,0,0}: the press pushes the touching odd cell
 * out along the pair directions — relay used (13,12,16) for
 * link 4 = (12,12,16): offset (+1,0,0)-ish face adjacency.
 *
 * Usage: node script/cascade/strain-force.mjs
 *        [--vs=3] [--react=2] [--p=3200] [--ds=2,4,6,8,10,12]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const RX = parseInt(arg('react', '2'));
const P = parseInt(arg('p', '3200'));
const TICKS = parseInt(arg('ticks', '80'));
const MASS = 256;
const DS = arg('ds', '2,4,6,8,10,12').split(',').map(Number);

console.log(`=== strain-force: vs=${VS} react=${RX} p=${P} — impulse vs distance ===`);
console.log(`  D | tPress | pRecv | exit drift (cells)`);
for (const D of DS) {
  initM26(q, W, W, W);
  q._moore26_vac_pol_set(VS);
  q._moore26_wall_press_set(1);
  q._moore26_wall_stall_set(4);
  q._moore26_field_react_set(RX);
  const wire = [];
  for (let i = 0; i <= D + 2; i++) wire.push([8 + i, 8 + i, 16]);
  for (const c of wire) { q._moore26_winding_set(...c, 6, 64); q._moore26_winding_set(...c, 7, 64); }
  q._moore26_winding_set(...wire[0], 6, 200);
  q._moore26_winding_set(...wire[0], 7, 200);
  const A = [7, 8, 16];
  /* receiver face-adjacent to link D: link D = (8+D,8+D,16);
   * relay used link+ (+1,0,0)-adjacent odd cell — mirror it: */
  const R = [8 + D + 1, 8 + D, 16];
  q._moore26_mass_set(...A, MASS);
  q._moore26_momentum_at_set(...A, 3, P);
  q._moore26_momentum_set(255);
  q._moore26_mass_set(...R, MASS);

  const pOf = (c) => { let t = 0; for (let e = 0; e < 13; e++) t += q._moore26_momentum_at_get(...c, e); return t; };
  let tP = -1, pMax = 0, pTot = 0;
  let rx = R[0], ry = R[1];
  for (let t = 0; t <= TICKS; t++) {
    const p = pOf(R);
    if (p !== 0 && tP < 0) tP = t;
    if (p > pMax) pMax = p;
    /* receiver may hop off R — track wherever its mass sits:
     * mass may move to an adjacent odd cell; scan small region */
    if (t % 4 === 0) {
      let best = 0, bc = null;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const m = q._moore26_mass_get(R[0] + dx, R[1] + dy, R[2] + dz);
        if (m > best) { best = m; bc = [R[0] + dx, R[1] + dy, R[2] + dz]; }
      }
      if (bc) { rx = bc[0]; ry = bc[1]; pTot = Math.max(pTot, pOf(bc)); }
    }
    if (t < TICKS) q._moore26_tick();
  }
  const drift = Math.abs(rx - R[0]) + Math.abs(ry - R[1]);
  console.log(`  ${String(D).padStart(2)} |   ${String(tP).padStart(3)}  | ${String(pTot).padStart(5)} | ${drift}`);
}
