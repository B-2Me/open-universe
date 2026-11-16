// charge-circuit.mjs — does conducted charge obey circuit laws?
//
// qChargeFlow law under test: across a committed conduit the
// higher-potential side sends k=(qa-qb)>>shift of its signed charge
// record to the partner — charge diffuses odd->odd while the lattice
// (mass) stays home. ev60 = charge in transit (the ammeter).
// qChargeHeat: k>>shift of each transfer lands as receiver heat.
//
// Fixture: straight wire along x. Odd lattice cells (mass, no
// momentum) at x = 9, 11, ..., 9+2L — L committed even-cell
// conduits between them (wound 64 on all 12 edge channels).
//
//   source pin +V at x=9 (ideal battery, re-pinned each tick)
//   drain  pin  0 at x=9+2L (ideal ground, inflow = the current)
//
// THREE independent current measures (Kirchhoff cross-check):
//   I_drain  = charge arriving at the grounded cell per tick
//   I_source = charge leaving the pinned source per tick
//   I_ev60   = ev60 delta / L links (series: same I on every link)
//
// Prediction (linear diffusion): I = V / (L * 2^shift) — i.e.
// I ∝ V (Ohm), I ∝ 1/L (resistance ∝ length), profile linear.
//
// Modes:
//   --mode=ohm    V-sweep + L-sweep tables + interior profile
//   --mode=rc     no pins: seeded +Q decays toward flat, Σq audit
//   --mode=joule  qChargeHeat on: resistor warms ∝ current
//   --mode=broken mid-wire conduit removed: expect I=0
//   --mode=off    qChargeFlow=0 control: expect I=0
//
// Usage: node script/cascade/charge-circuit.mjs --mode=ohm --shift=4
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const MODE  = argv.mode ?? 'ohm';
const SHIFT = +(argv.shift ?? 4);
const HEAT  = +(argv.heat  ?? 0);
const MASS  = +(argv.mass  ?? 100);
const YZ    = [16, 16];

const q = await loadM26();

function reset(flowShift, heatShift) {
  q._moore26_init(32, 32, 32);
  q._moore26_momentum_set(255);
  q._moore26_charge_flow_set(flowShift);
  q._moore26_charge_heat_set(heatShift);
}
function wound(x, y, z) {
  for (let c = 6; c < 18; c++) q._moore26_winding_set(x, y, z, c, 64);
}
const S = L => [9, ...YZ];            // source odd cell
const D = L => [9 + 2 * L, ...YZ];    // drain odd cell

// seed L-link wire; skip = conduit index to omit (broken control)
function seedWire(L, skip = -1) {
  for (let i = 0; i <= L; i++)
    q._moore26_mass_set(9 + 2 * i, ...YZ, MASS);
  for (let i = 0; i < L; i++)
    if (i !== skip) wound(10 + 2 * i, ...YZ);
}
function profile(L) {
  const p = [];
  for (let i = 0; i <= L; i++)
    p.push(q._moore26_charge_get(9 + 2 * i, ...YZ));
  return p;
}
function sumQ(L) {
  return profile(L).reduce((a, b) => a + b, 0);
}

// steady-state run: pins held, returns {I_drain, I_source, I_ev60}
function runOhm(L, V, ticks) {
  const src = S(L), dst = D(L);
  let iD = 0, iS = 0, ev0 = Number(q._moore26_events(60)), n = 0;
  const warm = Math.min(ticks - 10, 4 * L + 6);
  for (let t = 0; t < ticks; t++) {
    q._moore26_tick();
    const inflow = q._moore26_charge_get(...dst);      // was 0 pre-tick
    const outflow = V - q._moore26_charge_get(...src); // was V pre-tick
    if (t >= warm) { iD += inflow; iS += outflow; n++; }
    q._moore26_charge_set(...src, V);   // ideal battery
    q._moore26_charge_set(...dst, 0);   // ideal ground
  }
  const ev = Number(q._moore26_events(60)) - ev0;
  return { iD: iD / n, iS: iS / n, iE: ev / (L * ticks), prof: profile(L) };
}

console.log(`charge-circuit: shift=${SHIFT} heat=${HEAT} mass=${MASS} mode=${MODE}`);

if (MODE === 'ohm') {
  const V = +(argv.v ?? 1024), L = +(argv.l ?? 6), T = +(argv.ticks ?? 60);
  console.log('\n=== V-sweep (L=' + L + ' links) — expect I ∝ V ===');
  console.log('    V      I_drain  I_source  I_ev60/L   R=V/I_dr');
  for (const v of [V >> 2, V >> 1, V, V << 1]) {
    reset(SHIFT, HEAT); seedWire(L);
    const r = runOhm(L, v, T);
    console.log(`  ${String(v).padStart(5)}  ${r.iD.toFixed(2).padStart(8)}` +
      `  ${r.iS.toFixed(2).padStart(8)}  ${r.iE.toFixed(2).padStart(8)}` +
      `  ${(v / (r.iD || 1)).toFixed(1).padStart(8)}`);
  }
  console.log('\n=== L-sweep (V=' + V + ') — expect I ∝ 1/L ===');
  console.log('    L      I_drain  I_source  I_ev60/L   R=V/I_dr  R*I?');
  for (const l of [2, 4, 6, 8]) {
    reset(SHIFT, HEAT); seedWire(l);
    const r = runOhm(l, V, T);
    console.log(`  ${String(l).padStart(5)}  ${r.iD.toFixed(2).padStart(8)}` +
      `  ${r.iS.toFixed(2).padStart(8)}  ${r.iE.toFixed(2).padStart(8)}` +
      `  ${(V / (r.iD || 1)).toFixed(1).padStart(8)}`);
  }
  console.log('\n=== interior charge profile (L=6, V=' + V + ') — expect linear ramp ===');
  reset(SHIFT, HEAT); seedWire(6);
  runOhm(6, V, T);
  console.log('  q(x): ' + profile(6).join('  '));
  console.log('  ideal linear: ' +
    Array.from({ length: 7 }, (_, i) => Math.round(V * (1 - i / 6))).join('  '));
  process.exit(0);
}

if (MODE === 'rc') {
  const Q0 = +(argv.q ?? 1024), L = +(argv.l ?? 6), T = +(argv.ticks ?? 80);
  reset(SHIFT, HEAT); seedWire(L);
  const src = S(L);
  q._moore26_charge_set(...src, Q0);
  console.log(`\n=== RC discharge: +${Q0} seeded on x=9, no pins, L=${L} ===`);
  console.log('  expect: source decays to ~Q/(L+1), profile flattens, Σq conserved');
  for (let t = 0; t <= T; t++) {
    if (t % 10 === 0 || t === T) {
      const p = profile(L);
      console.log(`t=${String(t).padStart(3)}  q=[${p.join(',')}]  Σq=${p.reduce((a, b) => a + b)}`);
    }
    if (t < T) q._moore26_tick();
  }
  process.exit(0);
}

if (MODE === 'joule') {
  const V = +(argv.v ?? 1024), L = +(argv.l ?? 6), T = +(argv.ticks ?? 80);
  const HS = +(argv.heatshift ?? 3);
  console.log(`\n=== Joule heating: flow=${SHIFT} heat=${HS}, V=${V} L=${L} ===`);
  for (const hs of [0, HS]) {
    reset(SHIFT, hs); seedWire(L);
    const r = runOhm(L, V, T);
    let heat = [];
    for (let i = 1; i < L; i++)
      heat.push(q._moore26_heat_get(9 + 2 * i, ...YZ));
    console.log(`  heatshift=${hs}: I=${r.iD.toFixed(2)}  ` +
      `interior heat=[${heat.join(',')}]`);
  }
  console.log('  expect: heat>0 only when minted, ∝ current');
  process.exit(0);
}

if (MODE === 'broken' || MODE === 'off') {
  const V = +(argv.v ?? 1024), L = +(argv.l ?? 6), T = +(argv.ticks ?? 60);
  reset(MODE === 'off' ? 0 : SHIFT, HEAT);
  seedWire(L, MODE === 'broken' ? (L >> 1) : -1);
  const r = runOhm(L, V, T);
  console.log(`\n=== ${MODE}: V=${V} L=${L} ===`);
  console.log(`  I_drain=${r.iD.toFixed(2)} I_source=${r.iS.toFixed(2)} ` +
    `I_ev60/L=${r.iE.toFixed(2)}  (expect 0)`);
  console.log('  q(x): ' + r.prof.join('  '));
  process.exit(0);
}

console.log('unknown mode ' + MODE);
