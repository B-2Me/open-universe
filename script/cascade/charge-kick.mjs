// charge-kick.mjs — does conducted charge produce a signed force?
//
// qChargeKick law under test: two charged odd cells sharing a
// committed conduit push along the bond axis, signed by the charge
// product — like repels, unlike attracts. k = min|q|>>shift spread
// across the face axis's 4 transport pairs (AXP). AUTHORED work —
// ev58 counts delivered impulse.
//
// Fixture (mirrors seedWalker): odd mass cells at (9,16,16) and
// (11,16,16) — relay-lattice parity — linked by the even conduit
// (10,16,16) wound on all 12 edge channels (committed, mn=64>32).
//
// Fixtures:
//   A: +q/+q   — expect separation growth (repel)
//   B: +q/-q   — expect separation collapse (attract)
//   C: 0/+q    — control: no partner charge, no force
//   D: +q/+q knob OFF — control: charge present, law disabled
//   E: +2q/+2q — force magnitude scales with charge product
//
// Usage: node script/cascade/charge-kick.mjs --shift=4 --ticks=30
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const TICKS = +(argv.ticks ?? 30);
const SHIFT = +(argv.shift ?? 4);
const MASS  = +(argv.mass  ?? 500);
const Q     = +(argv.q     ?? 1000);

const q = await loadM26();
q._moore26_init(32, 32, 32);

const A = [9, 16, 16], B = [11, 16, 16], COND = [10, 16, 16];

function seedPair(qa, qb) {
  for (const fn of ['_moore26_mass_set', '_moore26_winding_set', '_moore26_charge_set']) {}
  // fresh grid per fixture is simplest: re-init
  q._moore26_init(32, 32, 32);
  q._moore26_momentum_set(255);
  q._moore26_charge_kick_set(SHIFT);
  for (let c = 6; c < 18; c++)
    q._moore26_winding_set(COND[0], COND[1], COND[2], c, 64);
  q._moore26_mass_set(A[0], A[1], A[2], MASS);
  q._moore26_mass_set(B[0], B[1], B[2], MASS);
  q._moore26_charge_set(A[0], A[1], A[2], qa);
  q._moore26_charge_set(B[0], B[1], B[2], qb);
}

function massX() {
  // x-centroid of the two seeded bodies: split the grid at x=10.5
  let xa = 0, ma = 0, xb = 0, mb = 0, xmax = 0, xmin = 99;
  for (let z = 0; z < 32; z++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const m = q._moore26_mass_get(x, y, z);
        if (m <= 10) continue;
        if (x > xmax) xmax = x;
        if (x < xmin) xmin = x;
        if (x <= 10) { xa += m * x; ma += m; }
        else { xb += m * x; mb += m; }
      }
  return {
    ca: ma ? xa / ma : NaN, cb: mb ? xb / mb : NaN,
    ma, mb, xmin, xmax,
    sep: ma && mb ? xb / mb - xa / ma : NaN,
  };
}

function run(name, qa, qb, kickOn) {
  seedPair(qa, qb);
  if (!kickOn) q._moore26_charge_kick_set(0);
  console.log(`  seed charge: A=${q._moore26_charge_get(...A)} B=${q._moore26_charge_get(...B)}`);
  const rows = [];
  for (let t = 0; t <= TICKS; t++) {
    const s = massX();
    rows.push({ t, sep: s.sep.toFixed(2), ca: s.ca.toFixed(1), cb: s.cb.toFixed(1),
                ma: s.ma, mb: s.mb, xmax: s.xmax, xmin: s.xmin,
                ev58: Number(q._moore26_events(58)) });
    if (t < TICKS) q._moore26_tick();
  }
  console.log(`\n=== ${name} (qa=${qa} qb=${qb} kick=${kickOn ? SHIFT : 'off'}) ===`);
  for (const r of rows.filter(r => r.t % 5 === 0 || r.t <= 3 || r.t === TICKS))
    console.log(`t=${String(r.t).padStart(3)}  cA=${r.ca.padStart(5)} cB=${r.cb.padStart(5)} ` +
      `sep=${r.sep.padStart(6)} [x${r.xmin}..x${r.xmax}] mA=${r.ma} mB=${r.mb}  ev58=${r.ev58}`);
  return rows;
}

console.log(`charge-kick: shift=${SHIFT} k=min|q|>>${SHIFT} ` +
  `(${Q} -> ${Q >> SHIFT}/pair x4 pairs), ${TICKS} ticks`);

const rA = run('A: +/+  repel?  ', +Q, +Q, true);
const rB = run('B: +/-  attract?', +Q, -Q, true);
const rC = run('C: 0/+  control ', 0, +Q, true);
const rD = run('D: +/+  knob OFF', +Q, +Q, false);
const rE = run('E: +2q  magnitude', 2 * Q, 2 * Q, true);

console.log('\nVERDICT:');
const last = r => r[r.length - 1];
console.log(`  A sep ${rA[0].sep} -> ${last(rA).sep} ` +
  `(${+last(rA).sep > +rA[0].sep ? 'REPELLED' : 'no separation'})`);
console.log(`  B sep ${rB[0].sep} -> ${last(rB).sep} ` +
  `(${+last(rB).sep < +rB[0].sep ? 'ATTRACTED' : 'no approach'})`);
console.log(`  C sep ${rC[0].sep} -> ${last(rC).sep} (should be ~static)`);
console.log(`  D sep ${rD[0].sep} -> ${last(rD).sep} (should be ~static)`);
console.log(`  E ev58=${last(rE).ev58} vs A ev58=${last(rA).ev58} ` +
  `(impulse should scale ~4x at 2x charge)`);
