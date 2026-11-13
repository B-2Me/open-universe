/* cohesion.mjs - does funded tension bind? Two mass knots linked by
 * a winding filament; packets ride the rail and confirm at the ends,
 * so ACKs measure the A-B reach each transaction. Kick both knots
 * APART and watch whether the bond pulls them back.
 *
 *   A(13,16,16) - filament(1,1,0) - B(19,22,16)   all odd cells
 *
 * Arms: --string/--tension/--slack sweep. Readout: |A-B| centroid
 * separation, probeCX-style.
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
const TENS  = +(argv.tension ?? 0);
const STR   = +(argv.string  ?? 0);
const SLACK = +(argv.slack   ?? 2);
const KICK  = +(argv.kick    ?? 300);   // separation kick on each knot
const FLUX  = +(argv.flux    ?? 1.0);   // rail feed rate
const CATCH = +(argv.catch   ?? 2);

const M = await loadM26();
const A = [13, 16, 16], B = [19, 22, 16];
const FIL = [];
for (let k = 1; k <= 5; k++) FIL.push([13 + k, 16 + k, 16]);

let s = 777;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_catch_gate_set(CATCH);
M._moore26_tension_set(TENS);
M._moore26_string_set(STR);
M._moore26_slack_set(SLACK);
/* durable pair: heavy cores + bidirectional saturated tube (the
 * moore26-harness pattern — bare mass evaporates, structure holds) */
for (const [x, y, z] of FIL) {
  M._moore26_winding_set(x, y, z, 6, 128);
  M._moore26_winding_set(x, y, z, 7, 128);
}
M._moore26_mass_set(...A, 512); M._moore26_mass_set(...B, 512);
/* separation kicks: A pushed -(1,1,0), B pushed +(1,1,0) on pair 3 */
M._moore26_momentum_at_set(...A, 3, -KICK);
M._moore26_momentum_at_set(...B, 3, +KICK);

/* whole-grid two-cluster census: split at the filament midpoint on
 * the x+y axis, centroid each side (mass can't hide from this) */
const MID = (A[0] + A[1] + B[0] + B[1]) / 2;
function clusters() {
  let nA = 0, dA = 0, nB = 0, dB = 0;
  for (let z = 0; z < SIZE; z++) for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const m = M._moore26_mass_get(x, y, z);
      if (!m) continue;
      const s = x + y;
      if (s < MID) { nA += s * m; dA += m; }
      else         { nB += s * m; dB += m; }
    }
  return { a: dA ? nA / dA : NaN, b: dB ? nB / dB : NaN, mA: dA, mB: dB };
}
function sep() {
  const c = clusters();
  return isNaN(c.a) || isNaN(c.b) ? NaN : (c.b - c.a).toFixed(2);
}
function knotMass(cx) {
  const c = clusters();
  return cx === A ? c.mA : c.mB;
}
function feed() {
  for (const [x, y, z] of FIL) {
    if (rnd() >= FLUX) continue;
    M._moore26_packet_set(x, y, z, 6, 2);
    M._moore26_packet_nu_set(x, y, z, 6, 32);
  }
}

console.log(`cohesion: tension=${TENS} string=${STR} slack=${SLACK} kick=+/-${KICK} flux=${FLUX}`);
console.log('t  sep(x+y)  mA mB  stored  ev55');
for (let t = 0; t <= TICKS; t++) {
  if (t % 25 === 0)
    console.log(`${t}  ${sep()}  mA=${knotMass(A)} mB=${knotMass(B)}  ${M._moore26_events(56) - M._moore26_events(57)}  ${M._moore26_events(55)}`);
  if (t < TICKS) { feed(); M._moore26_tick(); }
}
