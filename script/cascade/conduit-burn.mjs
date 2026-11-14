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
