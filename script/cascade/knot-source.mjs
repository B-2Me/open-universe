/* knot-source.mjs — cold sink vs living knot: does re-emission
 * make mass attract?
 *
 * Established: transactions pull upstream (source-pull.mjs) and a
 * pure absorber repels by eating the pull flux (depletion-gravity).
 * The gravity candidate: a LIVING knot recycles absorbed flux into
 * emission — the emission becomes a local source, and bodies pull
 * toward sources. If re-emission > depletion, mass attracts mass.
 *
 * Arms at A = B + 8*(1,1,0):
 *   control  — nothing
 *   cold     — 4 cells, mass=2048, no winding: pure sink, no emit
 *   living   — same mass + committed winding: site_unwind radiates;
 *              ch7-favored emissions travel -x-y back to the probe
 *   living+faint — half winding: emission-rate scaling check
 *
 * Read (trailing half): mean box momentum[3] (the kick ensemble),
 * probe mass + centroid. Predictions vs control mom3:
 *   cold   -> MORE negative (repel: eats ch7 pulls)
 *   living -> LESS negative / positive (attract: re-emission pull)
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 64);
const TICKS = +(argv.ticks ?? 500);
const HEAT  = +(argv.heat  ?? 4000);
const FLOOR = +(argv.floor ?? 64);
const RATE  = +(argv.rate  ?? 8);
const TOPUP = +(argv.topup ?? 4);
const BURN  = +(argv.burn  ?? 0.5);

const M = await loadM26();
const BX = 25, BY = 24, BZ = 32;               // probe (odd)
const AX = 33, AY = 32, AZ = 32;               // anchor (odd)
const ARMS = String(argv.arms ?? 'control,cold,living,living-faint').split(',');
/* 'starved' = pure net emitter: EVEN cells (they radiate directly
 * onto the arming graph — odd-cell emissions fly the odd sublattice
 * and can never arm), saturated winding, no mass — unwind outpaces
 * the thin catch a massless cell manages => net source.
 * Prediction vs control: mom3 goes POSITIVE (pull toward anchor). */

function seedBath() {
  for (let z = 0; z < SIZE; z++)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (x === 0 || y === 0 || z === 0 ||
            x === SIZE-1 || y === SIZE-1 || z === SIZE-1)
          M._moore26_heat_set(x, y, z, HEAT);
}
const CELLS = [[0,0],[2,0],[0,2],[2,2]];
/* even-parity emitter block — 4x4 saturated cells on the +8 diag.
 * Emission needs committed volume >512/site (ground-state floor:
 * a knot below the floor CANNOT unwind — meta-stable, dark). */
const ECELLS = [];
for (let dx = 0; dx <= 6; dx += 2)
  for (let dy = 0; dy <= 6; dy += 2) ECELLS.push([32+dx, 32+dy]);
function seedAnchor(kind) {
  if (kind === 'starved') {
    for (const [x, y] of ECELLS)
      for (const c of [6,7,8,9,10,11,12,13,14,15,16,17])
        M._moore26_winding_set(x, y, AZ, c, 400);
    return;
  }
  for (const [dx, dy] of CELLS) {
    const x = AX+dx, y = AY+dy, z = AZ;
    M._moore26_mass_set(x, y, z, 2048);
    if (kind === 'cold') continue;
    const s = kind === 'living' ? 1 : 0.5;
    /* committed structure — slight ch7 dominance so unwind emission
     * favors -x-y (back toward the probe); transverse pairs too */
    M._moore26_winding_set(x, y, z, 6, Math.round(150*s));
    M._moore26_winding_set(x, y, z, 7, Math.round(200*s));
    M._moore26_winding_set(x, y, z, 8, Math.round(120*s));
    M._moore26_winding_set(x, y, z, 9, Math.round(120*s));
  }
}
function probeStats() {
  let m = 0, cx = 0, cy = 0, mom = 0;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = BX+dx, y = BY+dy, z = BZ+dz;
        if (x < 0 || y < 0 || z < 0 || x >= SIZE || y >= SIZE || z >= SIZE) continue;
        const mm = M._moore26_mass_get(x, y, z);
        m += mm; cx += mm*x; cy += mm*y;
        mom += M._moore26_momentum_at_get(x, y, z, 3) || 0;
      }
  /* emission witness: ch7 flux parked on the conduit between A and B */
  const f7 = M._moore26_packet_get(BX+1, BY+1, BZ, 7) +
             M._moore26_packet_get(BX+2, BY+2, BZ, 7) +
             M._moore26_packet_get(BX+3, BY+3, BZ, 7);
  return { m, cx: m ? cx/m : 0, cy: m ? cy/m : 0, mom, f7,
           heat: M._moore26_heat_get(BX, BY, BZ) };
}

function run(kind) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_vac_floor_set(FLOOR);
  M._moore26_vac_rate_set(RATE);
  M._moore26_mass_set(BX, BY, BZ, 256);
  if (kind !== 'control') seedAnchor(kind);
  const t0 = Math.floor(TICKS*(1-BURN));
  let mom = 0, f7 = 0, n = 0;
  const s0 = probeStats();
  for (let t = 0; t < TICKS; t++) {
    if (t % TOPUP === 0) seedBath();
    M._moore26_tick();
    if (t >= t0) {
      const s = probeStats();
      mom += s.mom; f7 += s.f7; n++;
      if (t % 100 === 0 || t === TICKS-1)
        console.log(`    t=${t}  mom3=${s.mom}  f7=${s.f7} m=${s.m} ` +
                    `cx=${s.cx.toFixed(1)} cy=${s.cy.toFixed(1)}`);
    }
  }
  const s1 = probeStats();
  return { mom: mom/n, f7: f7/n, m0: s0.m, m1: s1.m,
           dx: s1.cx - s0.cx, dy: s1.cy - s0.cy };
}

console.log(`knot-source: bath ${HEAT}/${FLOOR}/${RATE}/top${TOPUP}, ${TICKS}t, anchor at +8 diag`);
for (const a of ARMS) {
  console.log(`arm ${a}:`);
  const r = run(a);
  console.log(`  => mom3=${r.mom.toFixed(2)}  f7=${r.f7.toFixed(2)} ` +
              `mass ${r.m0}->${r.m1}  drift=(${r.dx.toFixed(2)},${r.dy.toFixed(2)})\n`);
}
