/* modecloud.mjs — is the bound state volumetric?
 *
 * Every structure we've ever bound has been graph-like: committed
 * edges -> knots, rails, rings — 1D curves. The hypothesis under
 * test: the REAL bound object is the standing-offer (mode) cloud a
 * mass gathers around itself — incip[c] = occupation, incipNu[c] =
 * frequency — and whether that cloud fills a VOLUME or collapses
 * onto the feeding lanes is the difference between an orbital and
 * a knot.
 *
 * Fixture: one massive cell at the center of a lattice, kept hot
 * (heat reseeded -> mints isotropically on the 12 edge channels).
 * The mint is isotropic BY CONSTRUCTION — so any anisotropy in the
 * cloud comes from the substrate's own transport/arming rules, not
 * the source. Packets roam (gate=8 -> ~12% arm/tick), arm into
 * standing modes, cascade down rungs, radiate, recapture — a live
 * transaction cloud.
 *
 * Census per shell r (Euclidean): mode occupation + energy, packet
 * occupation + energy, cell filling fraction (occupied/total in
 * shell), committed-structure cells. Ray test: each occupied cell
 * is classified on-ray (lies on one of the 12 edge rays from the
 * center) or off-ray — a lane-collapsed cloud has filling ~0 with
 * occupancy only on rays.
 *
 *   node script/cascade/modecloud.mjs [--n=32 --t=400 --m=200
 *     --h=2000 --modes=1 --ttl=120 --rung=1 --gate=8]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => {
  const a = process.argv.find(s => s.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};

const N     = parseInt(arg('n', '32'));
const T     = parseInt(arg('t', '400'));
const M0    = parseInt(arg('m', '200'));
const H0    = parseInt(arg('h', '2000'));
const MODES = parseInt(arg('modes', '1'));
const TTL   = parseInt(arg('ttl', '120'));
const RUNG  = parseInt(arg('rung', '1'));
const GATE  = parseInt(arg('gate', '8'));
const C     = N >> 1;

const q = await loadM26();
initM26(q, N, N, N);
q._moore26_catch_gate_set(GATE);
q._moore26_mode_ledger_set(MODES);
q._moore26_incip_ttl_set(TTL);
q._moore26_rung_shift_set(RUNG);
q._moore26_reflect_set(255);
q._moore26_vac_rate_set(parseInt(arg('vrate', '64')));   /* mint odds 1/vrate
   * per hot node/tick — default 64 starves the cloud; 1 = every tick */
q._moore26_attract_set(parseInt(arg('attract', '0')));    /* declined
   * packets steer toward the densest edge-neighbor — gravity test */

/* one hot mass at the center */
q._moore26_mass_set(C, C, C, M0);

/* --floor=m: seed every cell with mass m so line>1 everywhere —
 * control experiment: if empty-cell instant-confirm (line=1) is the
 * cloud-killer, a floor makes offers stand off-shell everywhere and
 * a volumetric mode cloud should appear. */
const FLOOR = parseInt(arg('floor', '0'));
if (FLOOR > 0)
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++)
    for (let z = 0; z < N; z++)
      if (!(x === C && y === C && z === C))
        q._moore26_mass_set(x, y, z, FLOOR);

const r2 = (x, y, z) =>
  (x - C) * (x - C) + (y - C) * (y - C) + (z - C) * (z - C);

/* is (dx,dy,dz) on one of the 12 edge rays? edge rays have exactly
 * one zero component and the other two equal in magnitude. */
const onRay = (dx, dy, dz) => {
  const a = Math.abs(dx), b = Math.abs(dy), c = Math.abs(dz);
  const zeros = (a === 0) + (b === 0) + (c === 0);
  return zeros === 1 && (a === b || b === c || a === c);
};

const census = () => {
  const shells = new Map();  /* r -> {tot, occ, incN, incE, pkN, pkE, mass, committed, onray} */
  const put = (r) => {
    if (!shells.has(r)) shells.set(r,
      { tot: 0, occ: 0, incN: 0, incE: 0, pkN: 0, pkE: 0,
        mass: 0, committed: 0, onray: 0, well: 0 });
    return shells.get(r);
  };
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++)
    for (let z = 0; z < N; z++) {
      const d2 = r2(x, y, z);
      const r = Math.round(Math.sqrt(d2));
      const s = put(r);
      s.tot++;
      let incN = 0, incE = 0, pkN = 0, pkE = 0;
      for (let c = 0; c < 26; c++) {
        const ic = Number(q._moore26_incipient_get(x, y, z, c));
        const nu = Number(q._moore26_incipient_nu_get(x, y, z, c));
        if (ic > 0 && nu > 0) { incN += ic; incE += ic * nu; }
        const pk = Number(q._moore26_packet_get(x, y, z, c));
        const pn = Number(q._moore26_packet_nu_get(x, y, z, c));
        if (pk > 0) { pkN += pk; pkE += pk * pn; }
      }
      if (incN > 0 || pkN > 0) {
        s.occ++;
        if (onRay(x - C, y - C, z - C)) s.onray++;
      }
      s.incN += incN; s.incE += incE; s.pkN += pkN; s.pkE += pkE;
      s.mass += Number(q._moore26_mass_get(x, y, z));
      s.well += Number(q._moore26_well_get(x, y, z));
      let com = 0;
      for (let e = 0; e < 13; e++) {
        const a = Number(q._moore26_winding_get(x, y, z, 2 * e));
        const b = Number(q._moore26_winding_get(x, y, z, 2 * e + 1));
        if (Math.min(a, b) >= 32) com++;
      }
      if (com) s.committed++;
    }
  return shells;
};

console.log(`=== modecloud N=${N} m0=${M0} h=${H0} t=${T} modes=${MODES} ` +
  `ttl=${TTL} rung=${RUNG} gate=${GATE} ===`);
console.log('  r | cells | occ% | modes n | mode E | pk n | pk E | ' +
  'on-ray% | mass | committed | Σwell');

let lastLine = (q._moore26_mass_get(C, C, C) +
  (Number(q._moore26_winding_get(C, C, C, 0)) >> 2)) >> 2;

for (let t = 0; t <= T; t++) {
  /* thermostat: keep the center hot — reseed BEFORE census so the
   * drain can't freeze it */
  if (t > 0) {
    const CUT = parseInt(arg('cut', '0'));   /* source-off test: stop
       * reseeding at t=cut — does the cloud persist (self-bound
       * recirculation) or evaporate (driven fountain)? */
    if (!CUT || t < CUT) q._moore26_heat_set(C, C, C, H0);
    q._moore26_tick();
  }
  if (t % (T / 4) !== 0 && t !== T) continue;
  const sh = census();
  const center = sh.get(0) || { incN: 0, incE: 0, mass: 0 };
  const line = (Number(q._moore26_mass_get(C, C, C)) +
    (Number(q._moore26_winding_get(C, C, C, 0)) >> 2)) >> 2;
  console.log(`--- t=${t}  line=${line}  h=${Number(q._moore26_heat_get(C, C, C))} ` +
    `incip_total=${q._moore26_incip_total()}  packet_total=${q._moore26_packet_total()}`);
  const rs = [...sh.keys()].sort((a, b) => a - b);
  for (const r of rs) {
    const s = sh.get(r);
    if (s.occ === 0 && r > 2) continue;
    console.log(`  ${String(r).padStart(2)} | ${String(s.tot).padStart(5)} | ` +
      `${(100 * s.occ / s.tot).toFixed(1).padStart(5)} | ` +
      `${String(s.incN).padStart(7)} | ${String(s.incE).padStart(8)} | ` +
      `${String(s.pkN).padStart(5)} | ${String(s.pkE).padStart(7)} | ` +
      `${(s.occ ? 100 * s.onray / s.occ : 0).toFixed(0).padStart(7)} | ` +
      `${String(s.mass).padStart(7)} | ${s.committed} | ${s.well}`);
  }
}
