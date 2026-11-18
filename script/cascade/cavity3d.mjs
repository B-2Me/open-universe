/* cavity3d.mjs — the missing volumetric apparatus.
 *
 * Every bound-state fixture so far has been a 1D circuit (rings,
 * knots, tubes — graph-binding). This harness builds a closed 3D
 * specular cavity: wall cells carry armed-saturating incipients so
 * every arriving offer declines into REFLECT on the mirror channel
 * (qCatchGate=1 makes every packet attempt arming every tick —
 * nothing tunnels). A ballistic photon gas trapped in a mirror box
 * is the substrate's first VOLUMETRIC bound state.
 *
 * Measurements:
 *   fill     — packet population inside vs outside (leak audit)
 *   modes    — in-cavity nu spectrum (does the box develop a
 *              thermalized occupation via rung cascades?)
 *   pressure — wall momentum accumulated per reflection / cavity
 *              energy density  -> P vs u=E/V, the photon-gas EOS.
 *              Nature's value: P = u/3 (measured constant!).
 *
 *   node script/cascade/cavity3d.mjs [--r=4] [--nu=64] [--n=200]
 *        [--t=600] [--modes=1] [--ttl=120] [--rung=1] [--reflect=200]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const N = 24;
const R = parseInt(arg('r', '4'));          /* cavity half-size (interior = (2R-1)^3 even cells approx) */
const NU = parseInt(arg('nu', '64'));
const SEED = parseInt(arg('n', '200'));     /* seeded photons per interior cell */
const T = parseInt(arg('t', '600'));
const MODES = parseInt(arg('modes', '1'));
const TTL = parseInt(arg('ttl', '120'));
const RUNG = parseInt(arg('rung', '1'));
const REFL = parseInt(arg('reflect', '255')); /* qReflect /255 —
   * 255 = every decline reflects; below that the
   * deflect path leaks through the wall */
const CX = N >> 1, CY = N >> 1, CZ = N >> 1;

const q = await loadM26();
initM26(q, N, N, N);
const GATE = parseInt(arg('gate', '8'));
q._moore26_catch_gate_set(GATE);   /* interior arms ~1/8 per tick —
   * a real gas lifetime; walls get committed winding so site_level
   * saturates the gate and every wall-arrival attempts arming */
q._moore26_reflect_set(REFL);
q._moore26_mode_ledger_set(MODES);
if (TTL) q._moore26_incip_ttl_set(TTL);
if (RUNG) q._moore26_rung_shift_set(RUNG);

const inBox = (x, y, z) =>
  Math.abs(x - CX) <= R && Math.abs(y - CY) <= R && Math.abs(z - CZ) <= R;
const onWall = (x, y, z) => {
  const dx = Math.abs(x - CX), dy = Math.abs(y - CY), dz = Math.abs(z - CZ);
  return Math.max(dx, dy, dz) === R;             /* shell, not face-axis only */
};

/* wall: the boundary shell of the R-box — every channel armed so
 * armed>=cap (qCapBase=13) -> every offer declines -> REFLECT */
let wallCells = 0;
const seedWalls = () => {
  for (let x = CX - R; x <= CX + R; x++)
    for (let y = CY - R; y <= CY + R; y++)
      for (let z = CZ - R; z <= CZ + R; z++) {
        if (!onWall(x, y, z)) continue;
        wallCells++;
        /* committed winding (80/ch) -> vol>896 -> site_level=8,
         * saturating gate=8: EVERY wall-arrival attempts arming ->
         * armed>=cap -> decline -> REFLECT. mass=64 -> line=16 ->
         * the seeded nu=1 incipients are OFF-SHELL: they stand
         * instead of confirming, keeping armed>=cap up for the TTL.
         * A specular mirror built from the substrate's own rules. */
        q._moore26_mass_set(x, y, z, 64);
        for (let c = 0; c < 26; c++)
          q._moore26_winding_set(x, y, z, c, 80);
        for (let c = 6; c < 18; c++)
          q._moore26_incipient_set(x, y, z, c, 13);
      }
};
seedWalls();
/* walls dissolve two ways: incipients CONFIRM (mass=0 -> line=1 ->
 * all on-shell -> deposits) and TTL clears the rest. Re-saturate
 * periodically — the mirror must never open. */
const WALL_REFRESH = parseInt(arg('refresh', '60'));

/* interior mass floor: line=(m+w/4)/4 needs m>0 for standing modes
 * to exist (empty cells have line=1 -> everything settles). */
const MFLOOR = parseInt(arg('mfloor', '8'));
for (let x = CX - R + 1; x < CX + R; x++)
  for (let y = CY - R + 1; y < CY + R; y++)
    for (let z = CZ - R + 1; z < CZ + R; z++)
      q._moore26_mass_set(x, y, z, MFLOOR);

/* wall seasoning: let the wound walls age so qBondAge refusal
 * suppresses their phase-6 emission BEFORE the gas is injected. A
 * wall that glows isn't a boundary condition — it's a source. */
const AGE = parseInt(arg('age', '0'));
if (AGE > 0) {
  q._moore26_bond_age_set(parseInt(arg('bondage', '255')));
  for (let t = 0; t < AGE; t++) q._moore26_tick();
  /* flush the warm-up radiation field and zero wall momentum so the
   * t=0 ledger is clean; re-arm the walls (seeded incips TTL'd out) */
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++)
    for (let z = 0; z < N; z++)
      for (let c = 0; c < 26; c++)
        if (q._moore26_packet_get(x, y, z, c))
          q._moore26_packet_set(x, y, z, c, 0);
  for (let x = CX - R; x <= CX + R; x++)
    for (let y = CY - R; y <= CY + R; y++)
      for (let z = CZ - R; z <= CZ + R; z++) {
        if (!onWall(x, y, z)) continue;
        for (let c = 0; c < 26; c++)
          q._moore26_momentum_at_set(x, y, z, c, 0);
      }
  seedWalls();
}

/* seed the interior even cells with photons at NU on a random edge
 * each — an incoherent seed gas; born spread across phases */
let seeded = 0, seedE = 0;
for (let x = CX - R + 1; x < CX + R; x++)
  for (let y = CY - R + 1; y < CY + R; y++)
    for (let z = CZ - R + 1; z < CZ + R; z++) {
      if ((x + y + z) & 1) continue;      /* packets live on even cells */
      const c = 6 + ((x * 7 + y * 3 + z * 5) % 12);
      q._moore26_packet_set(x, y, z, c, SEED);
      q._moore26_packet_nu_set(x, y, z, c, NU);
      seeded += SEED; seedE += SEED * NU;
    }

const census = () => {
  let pkIn = 0, eIn = 0, pkOut = 0, eOut = 0;
  let wallMom = 0, moN = 0, moE = 0, hIn = 0, mIn = 0, wIn = 0;
  const hist = {};
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    for (let c = 0; c < 26; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      const nu = p ? (Number(q._moore26_packet_nu_get(x, y, z, c)) || 1) : 0;
      if (inBox(x, y, z) && !onWall(x, y, z)) {
        hIn += Number(q._moore26_heat_get(x, y, z));
        mIn += Number(q._moore26_mass_get(x, y, z));
        pkIn += p; eIn += p * nu;
        if (p) hist[nu] = (hist[nu] || 0) + p;
      } else if (!inBox(x, y, z)) { pkOut += p; eOut += p * nu; }
      if (onWall(x, y, z)) {
        for (let e = 0; e < 13; e++)
          wallMom += Math.abs(Number(q._moore26_momentum_at_get(x, y, z, e)) || 0);
      }
      if (inBox(x, y, z) && !onWall(x, y, z))
        wIn += Number(q._moore26_winding_get(x, y, z, c));
      if (inBox(x, y, z) && !onWall(x, y, z)) {
        const ic = Number(q._moore26_incipient_get(x, y, z, c));
        if (ic) {
          const inu = Number(q._moore26_incipient_nu_get(x, y, z, c)) & 255 || 1;
          moN += ic; moE += ic * inu;
        }
      }
    }
  }
  return { pkIn, eIn, pkOut, eOut, wallMom, moN, moE, hIn, mIn, wIn, hist };
};

/* interior volume (even cells) for the energy density */
let volCells = 0;
for (let x = CX - R + 1; x < CX + R; x++)
  for (let y = CY - R + 1; y < CY + R; y++)
    for (let z = CZ - R + 1; z < CZ + R; z++)
      if (!((x + y + z) & 1)) volCells++;

console.log(`=== cavity3d: box R=${R} (${volCells} interior even cells, ${wallCells} wall cells) ` +
  `nu=${NU} seed=${SEED}/cell t=${T} modes=${MODES} ttl=${TTL} rung=${RUNG} reflect=${REFL}/255 ===`);
console.log(`  seeded ${seeded} photons, E0=${seedE}`);
const ev53_0 = Number(q._moore26_events(53));
let wallMomPrev = 0;
for (let t = 0; t <= T; t++) {
  if (t % 100 === 0 || t === T) {
    const s = census();
    const ev53 = Number(q._moore26_events(53)) - ev53_0;
    const u = s.eIn / volCells;
    const top = Object.entries(s.hist).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nu, n]) => `${nu}:${n}`).join(' ');
    console.log(`t=${String(t).padStart(4)}  pkIn=${s.pkIn} eIn=${s.eIn} ` +
      `pkOut=${s.pkOut}(leak)  u=${u.toFixed(1)}/cell  ` +
      `modes n=${s.moN} E=${s.moE}  wallMom=${s.wallMom}  refl=${ev53}` +
      `  P/u=${u > 0 ? (s.wallMom / u).toFixed(2) : '-'}\n      top: ${top}`);
  }
  q._moore26_tick();
  if (WALL_REFRESH && t % WALL_REFRESH === WALL_REFRESH - 1) seedWalls();
}
const s = census();
const keys = Object.keys(s.hist).map(Number).sort((a, b) => a - b);
console.log(`\n--- in-cavity PACKET histogram ---`);
for (const nu of keys) console.log(`${nu}\t${s.hist[nu]}\t${nu * s.hist[nu]}`);
