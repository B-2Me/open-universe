/* force-probe.mjs — does offer-density asymmetry write net force?
 *
 * Confirmed offers kick momentum[pair]: +x-travel channels (even)
 * decrement, -x-travel channels (odd) increment. A plate under two
 * opposed controlled streams should show net momentum accumulation
 * ~ (confirms_odd - confirms_even) — the substrate's F=dp/dt made
 * legible, and the kinetic branch of the Casimir question: if any
 * plate/bath geometry produces a sustained arrival asymmetry, this
 * is the force it writes.
 *
 * Plate: 3x3 mass at X=20,y/z=15..17 (even parity: 20+16+16=52).
 * +x stream: inject G hops upstream on channels {6,8,10,12}
 * -x stream: inject G hops upstream on channels {7,9,11,13}
 * Per stream, inject for each plate node & channel, rate = prob.
 *
 * Sweep: --ra/--rb injection probabilities per stream.
 * Readout: signed momentum sum over pairs 3..6 on plate+neighbors.
 *
 * Usage: node script/cascade/force-probe.mjs --ra=0.5 --rb=0 --ticks=300
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 300);
const RA    = +(argv.ra    ?? 0.5);   // +x stream injection prob/tick/node/ch
const RB    = +(argv.rb    ?? 0);     // -x stream
const NU    = +(argv.nu    ?? 32);
const GAP   = +(argv.gap   ?? 8);     // upstream injection distance
const MASS  = +(argv.mass  ?? 10);
const CATCH = +(argv.catch ?? 2);
const SEED  = +(argv.seed  ?? 12345);
const REFL  = +(argv.reflect ?? 0);    // declined offers bounce back

const M = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const PLUSX  = [6, 8, 10, 12];       // +x travel channels
const MINUSX = [7, 9, 11, 13];       // -x travel channels
const PX = 20, PY = 16, PZ = 16;

let s = SEED;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const plate = [];
for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
  plate.push([PX, PY + dy, PZ + dz]);

function inject(channels, rate) {
  for (const c of channels) {
    const v = CV[c];
    for (const [px, py, pz] of plate) {
      if (rnd() >= rate) continue;
      const x = px - v[0] * GAP, y = py - v[1] * GAP, z = pz - v[2] * GAP;
      M._moore26_packet_set(x, y, z, c, 2);
      M._moore26_packet_nu_set(x, y, z, c, NU);
    }
  }
}
function momentum() {
  let s = 0;
  for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (let e = 3; e <= 6; e++)
        s += M._moore26_momentum_at_get(PX + dx, PY + dy, PZ + dz, e);
  return s;
}

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_catch_gate_set(CATCH);
M._moore26_reflect_set(REFL);
for (const [x, y, z] of plate) M._moore26_mass_set(x, y, z, MASS);

console.log(`force-probe: plate 3x3@(${PX},${PY},${PZ}) mass=${MASS} ` +
            `+x rate=${RA} -x rate=${RB} gap=${GAP} nu=${NU} catch=1/${CATCH} reflect=${REFL}`);
console.log('t  netMom(+x trav -> -)   pk_total');
for (let t = 0; t <= TICKS; t++) {
  if (t % 25 === 0)
    console.log(`${t}  ${momentum()}  ${M._moore26_packet_total()}`);
  if (t < TICKS) {
    inject(PLUSX, RA); inject(MINUSX, RB);
    M._moore26_tick();
  }
}
