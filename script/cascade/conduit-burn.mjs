/* conduit-burn.mjs — charge as a GRADED coupling constant.
 *
 * The arming gate gives charge only as a threshold (cap step). The
 * charged-conduit burn is different: a bondPar-handed odd cell facing
 * an oppositely-charged even conduit burns its mass into the conduit
 * winding at rate <= 4*|q|/tick, and the charge spends burn/4 — the
 * signal spends down as it conducts. A self-limiting cascade:
 *
 *   threshold   = sign mismatch (bondPar vs conduit charge)
 *   rate        = min(mass, 4|q|)  <- charge enters LINEARLY
 *   total burn  = 4|q|             <- charge is burn-capacity, not force
 *
 * If the measured mass-loss slope tracks |q|, the substrate has one
 * genuinely graded "force law": dE/dt ~ k|q| with k ~ 4 (authored —
 * measured here against mass history, not quoted).
 *
 * Controls: same-sign charge (no burn), q=0, bondPar=0.
 * Sweep: |q| in {2,4,8,16,32,64} -> rate per tick -> slope.
 *
 * Usage: node script/cascade/conduit-burn.mjs [--ticks=60] [--mass=4000]
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 64);
const TICKS = +(argv.ticks ?? 60);
const MASS  = +(argv.mass  ?? 4000);
const M = await loadM26();

/* post-cascade dispersal: the burn dumps 4|q| winding onto ONE conduit
 * channel in one tick — instantly crossing qSat. Does the energy stay
 * parked or shunt outward? Sweep qSat -> retention vs dispersal. */
function runDisperse(sat) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_sat_set(sat);
  const K = { x: 31, y: 32, z: 32 };
  const C = { x: 32, y: 32, z: 32 };
  M._moore26_mass_set(K.x, K.y, K.z, MASS);
  M._moore26_bondpar_set(K.x, K.y, K.z, 20);
  M._moore26_charge_set(C.x, C.y, C.z, -64);
  const hist = [];
  for (let t = 0; t < TICKS; t++) {
    M._moore26_tick();
    if (t % 10 === 0 || t === TICKS - 1) {
      let wc = 0, wRing = 0;
      for (let c = 0; c < 26; c++) wc += M._moore26_winding_get(C.x, C.y, C.z, c);
      /* the 8 face/edge cells around the conduit (same z plane) */
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
        for (let c = 0; c < 26; c++)
          wRing += M._moore26_winding_get(C.x+dx, C.y+dy, C.z, c);
      hist.push({ t, wc, wRing });
    }
  }
  return hist;
}

if (argv.disperse) {
  console.log(`post-burn dispersal: knot mass=${MASS} bondPar=+20, conduit q=-64, ${TICKS}t`);
  for (const sat of String(argv.sat ?? '64,128,192').split(',').map(Number)) {
    console.log(`sat=${sat}:`);
    for (const h of runDisperse(+sat))
      console.log(`   t=${String(h.t).padStart(3)}  conduitWind=${String(h.wc).padStart(6)}  ringWind=${h.wRing}`);
  }
  process.exit(0);
}

/* knot-vs-knot duel v3 — STATIC knots, charge delivered by flight.
 * MEASURED CONSTRAINT (v2): opposite-parity odd knots at distance 2
 * (sharing a conduit) annihilate unconditionally at t=0 — contact
 * annihilation is charge-free and fires before any charge cascade.
 * So conduit-mediated charge interaction is only reachable between
 * SAME-parity knots (annihilation can't fire) or non-adjacent ones.
 *
 * Geometry: K1=(31,32,32) — C=(32,32,32) — K2=(33,32,32)
 *   beams (sustained, re-seeded/tick; chargeFlight hops 1 edge/tick):
 *     UB=(31,31,32)/ch6 -> C   UA=(33,33,32)/ch7 -> C
 *     UL=(31,33,32)/ch7 -> (30,32,32) [K1's -x face]
 *     UR=(35,33,32)/ch7 -> (34,32,32) [K2's +x face]
 *
 * Same-parity pair (+20,+20) sharing C with -q: BOTH knots mismatch —
 * the burn spends charge in both buffers, so they compete serially
 * per tick (lower si first). Measurable: asymmetric capacity split. */
function runDuel({ bp1 = 20, bp2 = 20, k2x = 33,
                  beams = [] }) {
  M._moore26_init(SIZE, SIZE, SIZE);
  const K1 = { x: 31, y: 32, z: 32 }, K2 = { x: k2x, y: 32, z: 32 };
  M._moore26_mass_set(K1.x, K1.y, K1.z, MASS);
  M._moore26_mass_set(K2.x, K2.y, K2.z, MASS);
  if (bp1) M._moore26_bondpar_set(K1.x, K1.y, K1.z, bp1);
  if (bp2) M._moore26_bondpar_set(K2.x, K2.y, K2.z, bp2);
  const watch = { C: { x: 32, y: 32, z: 32 }, L: { x: 30, y: 32, z: 32 },
                  R: { x: k2x - 1, y: 32, z: 32 } };
  const hist = [];
  let tBurn1 = -1, tBurn2 = -1;
  for (let t = 0; t < TICKS; t++) {
    for (const b of beams) {
      M._moore26_massflight_set(b.x, b.y, b.z, b.ch, 50);
      M._moore26_chargeflight_set(b.x, b.y, b.z, b.ch, b.q);
    }
    M._moore26_tick();
    const m1 = M._moore26_mass_get(K1.x, K1.y, K1.z);
    const m2 = M._moore26_mass_get(K2.x, K2.y, K2.z);
    if (tBurn1 < 0 && m1 < MASS) tBurn1 = t;
    if (tBurn2 < 0 && m2 < MASS) tBurn2 = t;
    if (t < 8 || t % 20 === 0 || t === TICKS - 1)
      hist.push({ t, m1, m2,
        cq: M._moore26_charge_get(watch.C.x, watch.C.y, watch.C.z),
        cL: M._moore26_charge_get(watch.L.x, watch.L.y, watch.L.z),
        cR: M._moore26_charge_get(watch.R.x, watch.R.y, watch.R.z) });
  }
  return { hist, tBurn1, tBurn2,
    totMass: +M._moore26_sum(0), totWind: +M._moore26_sum(1),
    totHeat: +M._moore26_sum(3) };
}
/* beam sources: ch6=(+1,+1,0), ch7=(-1,-1,0) */
const B = {
  toC_a:   { x: 31, y: 31, z: 32, ch: 6 },   /* +q lands on C */
  toC_b:   { x: 33, y: 33, z: 32, ch: 7 },   /* -q lands on C */
  toL:     { x: 31, y: 33, z: 32, ch: 7 },   /* lands K1's -x face (30,32,32) */
  toR_35:  { x: 35, y: 33, z: 32, ch: 7 },   /* lands (34,32,32): K2@35 -x face */
};

if (argv.duel) {
  console.log(`duel v3: K1/K2 mass=${MASS} static, flight-delivered conduit charge, ${TICKS}t`);
  console.log(`  (harness-delivered transport — mediation measured, not knot-generated)`);
  for (const [arm, tag] of [
      [{ beams: [{ ...B.toC_b, q: -16 }] },
        'same-bp pair sharing C, -16: serial competition for one charge'],
      [{ beams: [{ ...B.toL, q: -16 }, { ...B.toR_35, q: -16 }], k2x: 35 },
        'same-bp pair, PRIVATE conduits -16 each: independent burn control'],
      [{ beams: [{ ...B.toC_a, q: 16 }, { ...B.toC_b, q: -16 }] },
        'same-bp pair sharing C, +/-16: net-0 cancellation -> no burn'],
      [{ beams: [{ ...B.toR_35, q: 16 }], bp2: -20, k2x: 35 },
        'opp-bp at distance 4, +16 on K2 face: K2 burns, K1 untouched'],
      [{}, 'control: no charge']]) {
    const r = runDuel(arm);
    console.log(`\n[${tag}]  k2x=${arm.k2x ?? 33} bp=${arm.bp1 ?? 20}/${arm.bp2 ?? 20}  ` +
      `onset: K1@${r.tBurn1} K2@${r.tBurn2}  ` +
      `end: mass=${r.totMass} wind=${r.totWind} heat=${r.totHeat}`);
    console.log(`   t     m1     m2    cq(C)   cq(L)   cq(R)`);
    for (const h of r.hist)
      console.log(`   ${String(h.t).padStart(3)} ${String(h.m1).padStart(6)} ${String(h.m2).padStart(6)} ` +
        `${String(h.cq).padStart(7)} ${String(h.cL).padStart(7)} ${String(h.cR).padStart(7)}`);
  }
  process.exit(0);
}

/* remote trigger: charge rides chargeFlight one hop to the conduit's
 * face cell, THEN the knot's burn ignites — a cascade triggered at
 * range. The signal (charge) precedes any matter contact. */
function runRemote(cf) {
  M._moore26_init(SIZE, SIZE, SIZE);
  const K = { x: 31, y: 32, z: 32 };          // odd knot
  const C = { x: 32, y: 32, z: 32 };          // face conduit (target)
  const S = { x: 33, y: 33, z: 32 };          // source: ch7=(-1,-1,0)
  M._moore26_mass_set(K.x, K.y, K.z, MASS);
  M._moore26_bondpar_set(K.x, K.y, K.z, 20);
  M._moore26_massflight_set(S.x, S.y, S.z, 7, 50);
  M._moore26_chargeflight_set(S.x, S.y, S.z, 7, cf);
  const hist = [];
  let tSignal = -1, tBurn = -1;
  for (let t = 0; t < TICKS; t++) {
    M._moore26_tick();
    const cq = M._moore26_charge_get(C.x, C.y, C.z);
    const m = M._moore26_mass_get(K.x, K.y, K.z);
    let w = 0;
    for (let c = 0; c < 26; c++) w += M._moore26_winding_get(C.x, C.y, C.z, c);
    if (tSignal < 0 && cq !== 0) tSignal = t;
    if (tBurn < 0 && m < MASS) tBurn = t;
    if (t < 12 || t % 20 === 0) hist.push({ t, m, cq, w });
  }
  return { hist, tSignal, tBurn };
}

if (argv.remote) {
  const CFS = String(argv.cf ?? '-4,-8,-16').split(',').map(Number);
  console.log(`remote-burn: knot mass=${MASS} bondPar=+20, chargeFlight -> conduit, ${TICKS}t`);
  for (const cf of CFS) {
    const r = runRemote(cf);
    console.log(`cf=${cf}: signal landed t=${r.tSignal}, burn onset t=${r.tBurn}`);
    for (const h of r.hist)
      console.log(`   t=${String(h.t).padStart(3)}  mass=${String(h.m).padStart(6)}  ` +
        `conduitQ=${String(h.cq).padStart(4)}  conduitWind=${h.w}`);
  }
  process.exit(0);
}

function run(q, bondpar) {
  M._moore26_init(SIZE, SIZE, SIZE);
  const K = { x: 31, y: 32, z: 32 };          // odd cell (31+32+32=95)
  const C = argv.diag
    ? { x: 33, y: 33, z: 32 }                 // diagonal even (98) — NOT a
    /* face conduit: burn should not fire — the trigger is contact-local */
    : { x: 32, y: 32, z: 32 };                // even conduit (96)
  M._moore26_mass_set(K.x, K.y, K.z, MASS);
  if (bondpar) M._moore26_bondpar_set(K.x, K.y, K.z, bondpar);
  if (q) M._moore26_charge_set(C.x, C.y, C.z, q);
  const hist = [];
  for (let t = 0; t < TICKS; t++) {
    M._moore26_tick();
    if (argv.pin) M._moore26_charge_set(C.x, C.y, C.z, q);  /* sustained:
     * the cascade can't exhaust — burn rate = min(mass,4|q|)/tick */
    if (t % 10 === 0 || t === TICKS - 1) {
      const m = M._moore26_mass_get(K.x, K.y, K.z);
      const cq = M._moore26_charge_get(C.x, C.y, C.z);
      let w = 0;
      for (let c = 0; c < 26; c++) w += M._moore26_winding_get(C.x, C.y, C.z, c);
      hist.push({ t, m, cq, w });
    }
  }
  const mEnd = M._moore26_mass_get(K.x, K.y, K.z);
  return { hist, burned: MASS - mEnd, cqEnd: M._moore26_charge_get(C.x, C.y, C.z) };
}

console.log(`conduit-burn: knot mass=${MASS} bondPar=+20, adjacent conduit charge=q, ${TICKS}t`);
console.log(`  authored law: burn=min(mass,4|q|)/t, charge spends burn/4 -> total 4|q|`);
console.log(`   q   bondPar  burned   qEnd    rate/t (approx)`);
const ARMS = argv.diag ? [[-64, 20]]
  : argv.pin
  ? [[-2,20],[-4,20],[-8,20],[-16,20],[-32,20],[-64,20]]
  : [[0, 20], [4, 20], [-4, 20], [8, 20], [-8, 20], [-16, 20],
    [-32, 20], [-64, 20], [-32, -20], [-32, 0]];
for (const [q, bp] of ARMS) {
  const r = run(q, bp);
  const rate = r.burned / TICKS;
  console.log(`  ${String(q).padStart(4)}  ${String(bp).padStart(6)}  ${String(r.burned).padStart(6)} ` +
    `${String(r.cqEnd).padStart(5)}   ${rate.toFixed(2)}`);
}

/* deep-dive on one arm: full time series */
console.log(`\nq=-32 series (burn -> conduit winding):`);
const r = run(-32, 20);
for (const h of r.hist)
  console.log(`  t=${String(h.t).padStart(3)}  mass=${String(h.m).padStart(6)}  ` +
    `conduitQ=${String(h.cq).padStart(5)}  conduitWind=${h.w}`);
