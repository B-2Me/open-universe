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
const RANGE = +(argv.range ?? 0);            // qChargeRange BFS depth
const WIRE_B = [19, 16, 16];                 // far end of the wire fixture
// zigzag committed-even-cell wire along x: even cells hop even->even
// on {±1,±1,0} — the wire alternates y=16/15 so each pair links
const WIRE = [];
for (let x = 10; x <= 18; x++) WIRE.push([x, x % 2 ? 15 : 16, 16]);

function reset(kickShift, rangeDepth) {
  q._moore26_init(32, 32, 32);
  q._moore26_momentum_set(255);
  q._moore26_charge_kick_set(kickShift);
  q._moore26_charge_range_set(rangeDepth);
}
function wound(x, y, z) {
  for (let c = 6; c < 18; c++) q._moore26_winding_set(x, y, z, c, 64);
}

function seedPair(qa, qb) {
  reset(SHIFT, RANGE);
  wound(...COND);
  q._moore26_mass_set(...A, MASS);
  q._moore26_mass_set(...B, MASS);
  q._moore26_charge_set(...A, qa);
  q._moore26_charge_set(...B, qb);
}

// wire fixture: A at x=9, B at x=19, committed zigzag even-cell wire
// between them. --skip=N removes wire cell N (broken-wire control).
function seedWire(qa, qb, skip = -1) {
  reset(SHIFT, RANGE);
  WIRE.forEach(([x, y, z], i) => { if (i !== skip) wound(x, y, z); });
  q._moore26_mass_set(...A, MASS);
  q._moore26_mass_set(...WIRE_B, MASS);
  q._moore26_charge_set(...A, qa);
  q._moore26_charge_set(...WIRE_B, qb);
}

// charged odd chain: odd cells at x=9,11,13,15,17 + conduits between —
// the v1 composition test: adjacent repulsion should stretch the chain
function seedChain(qq) {
  reset(SHIFT, RANGE);
  const odd = [];
  for (let x = 9; x <= 17; x += 2) odd.push([x, 16, 16]);
  for (let x = 10; x <= 16; x += 2) wound(x, 16, 16);
  for (const [x, y, z] of odd) {
    q._moore26_mass_set(x, y, z, MASS);
    q._moore26_charge_set(x, y, z, qq);
  }
  return odd;
}

function massX(split = 10.5) {
  // x-centroid of the two seeded bodies: split the grid at `split`
  let xa = 0, ma = 0, xb = 0, mb = 0, xmax = 0, xmin = 99;
  for (let z = 0; z < 32; z++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const m = q._moore26_mass_get(x, y, z);
        if (m <= 10) continue;
        if (x > xmax) xmax = x;
        if (x < xmin) xmin = x;
        if (x < split) { xa += m * x; ma += m; }
        else { xb += m * x; mb += m; }
      }
  return {
    ca: ma ? xa / ma : NaN, cb: mb ? xb / mb : NaN,
    ma, mb, xmin, xmax,
    sep: ma && mb ? xb / mb - xa / ma : NaN,
  };
}

// every mass site's x — for the chain fixture
function massXs() {
  const xs = [];
  for (let z = 0; z < 32; z++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        if (q._moore26_mass_get(x, y, z) > 10) xs.push(x);
  return xs.sort((a, b) => a - b);
}

function run(name, qa, qb, kickOn, split = 10.5) {
  seedPair(qa, qb);
  if (!kickOn) q._moore26_charge_kick_set(0);
  console.log(`  seed charge: A=${q._moore26_charge_get(...A)} B=${q._moore26_charge_get(...B)}`);
  const rows = [];
  for (let t = 0; t <= TICKS; t++) {
    const s = massX(split);
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

// wire-at-range fixture runner
function runWire(name, qa, qb, skip = -1) {
  seedWire(qa, qb, skip);
  const rows = [];
  for (let t = 0; t <= TICKS; t++) {
    const s = massX(14.5);
    rows.push({ t, sep: s.sep.toFixed(2), ca: s.ca.toFixed(1), cb: s.cb.toFixed(1),
                ma: s.ma, mb: s.mb, xmax: s.xmax, xmin: s.xmin,
                ev58: Number(q._moore26_events(58)) });
    if (t < TICKS) q._moore26_tick();
  }
  console.log(`\n=== ${name} (qa=${qa} qb=${qb} range=${RANGE}${skip >= 0 ? ' BROKEN@' + skip : ''}) ===`);
  for (const r of rows.filter(r => r.t % 5 === 0 || r.t <= 3 || r.t === TICKS))
    console.log(`t=${String(r.t).padStart(3)}  cA=${r.ca.padStart(5)} cB=${r.cb.padStart(5)} ` +
      `sep=${r.sep.padStart(6)} [x${r.xmin}..x${r.xmax}] mA=${r.ma} mB=${r.mb}  ev58=${r.ev58}`);
  return rows;
}

// charged-chain runner: print all mass-site x positions
function runChain(name, qq, kickOn = true) {
  seedChain(qq);
  if (!kickOn) q._moore26_charge_kick_set(0);
  const rows = [];
  for (let t = 0; t <= TICKS; t++) {
    rows.push({ t, xs: massXs(), ev58: Number(q._moore26_events(58)) });
    if (t < TICKS) q._moore26_tick();
  }
  console.log(`\n=== ${name} (all q=${qq}, range=${RANGE}) ===`);
  for (const r of rows.filter(r => r.t % 5 === 0 || r.t <= 3 || r.t === TICKS))
    console.log(`t=${String(r.t).padStart(3)}  xs=[${r.xs.join(',')}]  ev58=${r.ev58}`);
  return rows;
}

console.log(`charge-kick: shift=${SHIFT} k=min|q|>>${SHIFT} ` +
  `(${Q} -> ${Q >> SHIFT}/pair x4 pairs), range=${RANGE}, ${TICKS} ticks`);

if (argv.mode === 'wire') {
  const rF = runWire('F: +/+ wire repel  ', +Q, +Q);
  const rG = runWire('G: +/- wire attract ', +Q, -Q);
  const rH = runWire('H: +/+ BROKEN wire  ', +Q, +Q, 4);
  console.log('\nVERDICT:');
  const last = r => r[r.length - 1];
  console.log(`  F sep ${rF[0].sep} -> ${last(rF).sep} ev58=${last(rF).ev58}`);
  console.log(`  G sep ${rG[0].sep} -> ${last(rG).sep} ev58=${last(rG).ev58}`);
  console.log(`  H sep ${rH[0].sep} -> ${last(rH).sep} ev58=${last(rH).ev58} (broken: expect 0)`);
  process.exit(0);
}
if (argv.mode === 'chain') {
  const rI = runChain('I: all-+ chain', +Q, true);
  const rJ = runChain('J: kick OFF ctrl', +Q, false);
  console.log('\nVERDICT: see xs spread above (repel -> chain expands)');
  process.exit(0);
}

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
