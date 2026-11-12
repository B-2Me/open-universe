/* shadow-probe.mjs - depletion / Le Sage force: a probe in the
 * geometric shadow of an absorber under a directed external stream.
 *
 * With absorption-funded flux-drag the plate EATS the beam - the
 * probe behind it sees only wrapped/scattered arrivals traveling -x.
 * Prediction: control (plate OFF) -> pushed away (-, radiation sign);
 * plate ON -> drift flips + toward the plate (shadow subtraction).
 * The absorber itself should go - (it takes the beam's momentum).
 *
 * Beam: +x channels {6,8,10,12} aimed at probe face 5x5@(QX,14..18),
 * injected GAP hops upstream (x ~= QX-GAP). Absorber 3x3@(16,15..17)
 * sits mid-path and eats the on-axis core.
 *
 * Usage: node script/cascade/shadow-probe.mjs --plate=0|1 --ra=0.6
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 400);
const RA    = +(argv.ra    ?? 0.6);
const RB    = +(argv.rb    ?? 0);      // -x counter-beam behind probe
const NU    = +(argv.nu    ?? 32);
const GAP   = +(argv.gap   ?? 12);
const PLATE = +(argv.plate ?? 1);
const PMASS = +(argv.pmass ?? 60);
const QMASS = +(argv.qmass ?? 10);
const CATCH = +(argv.catch ?? 2);
const SEED  = +(argv.seed  ?? 12345);
const VFLOOR = +(argv.vfloor ?? 128);   // raise past plate heat => absorber
                                        // can never re-emit (true sink)

const M = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const PLUSX = [6, 8, 10, 12];
const MINUSX = [7, 9, 11, 13];
/* ODD sublattice only: even cells take no relay path -
 * mass/drag/motion machinery never fires there */
const AX = 17, CY = 16, CZ = 16;
const QX = +(argv.qx ?? 21);

let s = SEED;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const FW = +(argv.fw ?? 1);   // beam face half-width (match plate size)
/* beam A (+x) aims at the PLATE face - the converged core is fully
 * intercepted; the probe sits behind in its geometric shadow.
 * beam B (-x) aims at the PROBE face = the ambient counter-flux. */
const PSIZE = +(argv.psize ?? 1);   // plate half-width: 1 => 3x3
const plate = [];
for (let dy = -PSIZE; dy <= PSIZE; dy++) for (let dz = -PSIZE; dz <= PSIZE; dz++)
  plate.push([AX, CY + dy, CZ + dz]);
const probeFace = [];
for (let dy = -FW; dy <= FW; dy++) for (let dz = -FW; dz <= FW; dz++)
  probeFace.push([QX, CY + dy, CZ + dz]);

function inject(channels, rate, face) {
  for (const c of channels) {
    const v = CV[c];
    for (const [px, py, pz] of face) {
      if (rnd() >= rate) continue;
      const x = px - v[0] * GAP, y = py - v[1] * GAP, z = pz - v[2] * GAP;
      M._moore26_packet_set(x, y, z, c, 2);
      M._moore26_packet_nu_set(x, y, z, c, NU);
    }
  }
}
/* probe reads ONLY its own 9 nodes - the advancing absorber must not
 * contaminate the box (plate gets pushed +x and can reach x~19) */
function probeMom() {
  let s = 0;
  for (const [x, y, z] of probe)
    for (let e = 3; e <= 6; e++) s += M._moore26_momentum_at_get(x, y, z, e);
  return s;
}
/* flux asymmetry in the probe slab: + means more -x travelers
 * (the shadow signature) than +x travelers */
function fluxAsym() {
  let a = 0;
  for (let x = QX - 2; x <= QX + 2; x++)
    for (let y = CY - 2; y <= CY + 2; y++)
      for (let z = CZ - 2; z <= CZ + 2; z++) {
        for (const c of PLUSX) a -= M._moore26_packet_get(x, y, z, c);
        for (const c of MINUSX) a += M._moore26_packet_get(x, y, z, c);
      }
  return a;
}
function plateCX() {   // plate mass centroid x (tracks its march)
  let num = 0, den = 0;
  for (let x = AX - 4; x <= AX + 5; x++)
    for (let y = CY - 3; y <= CY + 3; y++)
      for (let z = CZ - 3; z <= CZ + 3; z++) {
        const m = M._moore26_mass_get(x, y, z);
        num += x * m; den += m;
      }
  return den ? (num / den).toFixed(2) : 'nan';
}
/* +x-channel packets in the slab just upstream of the probe:
 * with the absorber eating the beam, nonzero here = plate shed */
function shedCensus() {
  let n = 0;
  for (let y = CY - 3; y <= CY + 3; y++)
    for (let z = CZ - 3; z <= CZ + 3; z++)
      for (const c of PLUSX) n += M._moore26_packet_get(AX + 1, y, z, c);
  return n;
}
function probeCX() {   // probe mass centroid x — actual displacement,
                       // immune to momentum-field contamination
  let num = 0, den = 0;
  for (const [x, y, z] of probe) {
    const m = M._moore26_mass_get(x, y, z);
    num += x * m; den += m;
  }
  return den ? (num / den).toFixed(2) : 'nan';
}
function momAt(cx, span) {
  let s = 0;
  for (let dz = -span; dz <= span; dz++) for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++)
      for (let e = 3; e <= 6; e++)
        s += M._moore26_momentum_at_get(cx + dx, CY + dy, CZ + dz, e);
  return s;
}

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_catch_gate_set(CATCH);
M._moore26_vac_floor_set(VFLOOR);
if (PLATE) for (const [x, y, z] of plate) M._moore26_mass_set(x, y, z, PMASS);
const probe = [];
for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
  probe.push([QX, CY + dy, CZ + dz]);
for (const [x, y, z] of probe) M._moore26_mass_set(x, y, z, QMASS);

console.log(`shadow-probe: plate=${PLATE ? `${2*PSIZE+1}x${2*PSIZE+1}@${AX} mass=${PMASS}` : 'OFF'} ` +
            `probe 3x3@${QX}(odd) mass=${QMASS} ra=${RA} rb=${RB} gap=${GAP} nu=${NU} vfloor=${VFLOOR}`);
function plateHeat() {
  let h = 0;
  for (const [x, y, z] of plate) h += M._moore26_heat_get(x, y, z);
  return h;
}
console.log('t  probeMom  probeCX(<21 => toward plate)  fluxAsym  plateCX  pk_total');
for (let t = 0; t <= TICKS; t++) {
  if (t % 25 === 0)
    console.log(`${t}  ${probeMom()}  ${probeCX()}  ${fluxAsym()}  ${plateCX()}  ${M._moore26_packet_total()}`);
  if (t < TICKS) { inject(PLUSX, RA, plate); inject(MINUSX, RB, probeFace); M._moore26_tick(); }
}
