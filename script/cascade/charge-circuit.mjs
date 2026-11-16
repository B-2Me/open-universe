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
//   --mode=parallel  two branches share the pins: I_AB = I_A + I_B?
//   --mode=induct    probe: does a current-carrying wire exert any
//                    force a static wire doesn't? (magnetic test)
//   --mode=pump      funded EMF: heat-paid charge pump drives a
//                    closed ring until the battery dies
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

if (MODE === 'parallel') {
  // Two branches share source S(9,16,16) and drain D(21,16,16):
  //   A: straight along y=16 — 6 links
  //   B: detour along y=18 — 8 links
  // Kirchhoff: I_AB should equal I_A + I_B (conductances add).
  const V = +(argv.v ?? 1024), T = +(argv.ticks ?? 200);
  const cellsA = [[11,16],[13,16],[15,16],[17,16],[19,16]];
  const linksA = [[10,16],[12,16],[14,16],[16,16],[18,16],[20,16]];
  const cellsB = [[9,18],[11,18],[13,18],[15,18],[17,18],[19,18],[21,18]];
  const linksB = [[9,17],[10,18],[12,18],[14,18],[16,18],[18,18],[20,18],[21,17]];
  function seedPar(withA, withB) {
    reset(SHIFT, HEAT);
    q._moore26_mass_set(9, 16, 16, MASS);
    q._moore26_mass_set(21, 16, 16, MASS);
    if (withA) {
      for (const [x, y] of cellsA) q._moore26_mass_set(x, y, 16, MASS);
      for (const [x, y] of linksA) wound(x, y, 16);
    }
    if (withB) {
      for (const [x, y] of cellsB) q._moore26_mass_set(x, y, 16, MASS);
      for (const [x, y] of linksB) wound(x, y, 16);
    }
  }
  function runPar(withA, withB) {
    seedPar(withA, withB);
    const src = [9, 16, 16], dst = [21, 16, 16];
    let iD = 0, n = 0; const warm = Math.min(T - 10, 60);
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      if (t >= warm) { iD += q._moore26_charge_get(...dst); n++; }
      q._moore26_charge_set(...src, V);
      q._moore26_charge_set(...dst, 0);
    }
    return iD / n;
  }
  const IA = runPar(true, false), IB = runPar(false, true), IAB = runPar(true, true);
  console.log(`\n=== parallel: V=${V} (branch A=6 links, B=8 links) ===`);
  console.log(`  I_A=${IA.toFixed(2)}  I_B=${IB.toFixed(2)}  ` +
    `I_A+I_B=${(IA + IB).toFixed(2)}  I_AB=${IAB.toFixed(2)}`);
  console.log(`  Kirchhoff ${Math.abs(IAB - IA - IB) < 0.05 * (IA + IB) ?
    'HOLDS (<5% deviation)' : 'deviation ' + (IAB - IA - IB).toFixed(2)}`);
  process.exit(0);
}

if (MODE === 'induct') {
  // Magnetic probe: does charge in MOTION differ from charge at
  // REST for the conducted force? Wire at y=16 carries current
  // (or not); probe body T at (15,14,16) links to the mid-wire
  // cell (15,16,16) — the profile-symmetric point. KICK=4.
  // The lattice is PINNED: each tick we read the delivered impulse
  // on T (and the wire), then zero all momenta + restore masses —
  // otherwise the wire's mutual repulsion disassembles the fixture.
  // If T's per-tick impulse is the same under +x / -x / no current
  // at matched local wire charge -> the force sees only the charge
  // record: no magnetic analog.
  const V = +(argv.v ?? 1024), QT = +(argv.qt ?? 500), T = +(argv.ticks ?? 30);
  const L = 6, TB = [15, 14, 16];
  const wireCells = []; for (let i = 0; i <= L; i++) wireCells.push([9 + 2 * i, 16]);
  function seedInd() {
    reset(SHIFT, HEAT);
    q._moore26_charge_kick_set(+(argv.kick ?? 4));
    seedWire(L);
    wound(15, 15, 16);                     // T's link to the wire
    q._moore26_mass_set(...TB, MASS);
    q._moore26_charge_set(...TB, QT);
  }
  function pinAll(vs, vd) {
    q._moore26_charge_set(9, 16, 16, vs);
    q._moore26_charge_set(21, 16, 16, vd);
    q._moore26_charge_set(...TB, QT);
    q._moore26_mass_set(...TB, MASS);
    for (const [x, y] of wireCells) {
      q._moore26_mass_set(x, y, 16, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(x, y, 16, e, 0);
    }
  }
  function runInd(vs, vd, label) {
    seedInd();
    for (let t = 0; t < 40; t++) { q._moore26_tick(); pinAll(vs, vd); }
    let pT = 0, pW = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (let e = 0; e < 13; e++)
        pT += Math.abs(q._moore26_momentum_at_get(...TB, e));
      for (const [x, y] of wireCells)
        for (let e = 0; e < 13; e++)
          pW += Math.abs(q._moore26_momentum_at_get(x, y, 16, e));
      pinAll(vs, vd);   // absorb the impulse; nothing is allowed to hop
    }
    const qw = q._moore26_charge_get(15, 16, 16);
    console.log(`  ${label}: wire_q=${qw}  T |p|/tick=${(pT / T).toFixed(1)}` +
      `  wire |p|/tick=${(pW / T).toFixed(1)}`);
    return pT / T;
  }
  console.log(`\n=== induction probe: V=${V} QT=${QT} kick=${argv.kick ?? 4} ===`);
  runInd(V, 0, 'I flows +x ');
  runInd(0, V, 'I flows -x ');
  runInd(0, 0, 'no current ');
  console.log('  T impulse identical under reversal => statics only (no magnetism)');
  process.exit(0);
}

if (MODE === 'pump') {
  // Funded EMF: a closed 12-cell ring (y=16 bottom, y=18 top,
  // verticals at x=9,19). Pump cell (11,16) with heat H + bondPar
  // pushes charge -x -> +x each tick, paying 1 heat/unit. The ring
  // carries the current around — a DC circuit with a real battery.
  const H = +(argv.h ?? 3000), RATE = +(argv.rate ?? 8), T = +(argv.ticks ?? 400);
  const ring = [[9,16],[11,16],[13,16],[15,16],[17,16],[19,16],
                [19,18],[17,18],[15,18],[13,18],[11,18],[9,18]];
  const links = [[10,16],[12,16],[14,16],[16,16],[18,16],[19,17],
                 [18,18],[16,18],[14,18],[12,18],[10,18],[9,17]];
  const PUMP = [11, 16];
  reset(SHIFT, HEAT);
  q._moore26_heat_pump_set(RATE);
  for (const [x, y] of ring) q._moore26_mass_set(x, y, 16, MASS);
  for (const [x, y] of links) wound(x, y, 16);
  q._moore26_bondpar_set(...PUMP, 16, +1);
  q._moore26_heat_set(...PUMP, 16, H);
  console.log(`\n=== funded EMF ring: heat=${H} rate=${RATE} shift=${SHIFT} ===`);
  console.log('  I_ring = ev60/12 per tick; ev61 = charge pumped; ' +
    'battery dies when heat runs out');
  let ev60p = 0, tp = 0;
  for (let t = 0; t <= T; t++) {
    const ev60 = Number(q._moore26_events(60)), ev61 = Number(q._moore26_events(61));
    if (t % 40 === 0 || t === T) {
      const heat = q._moore26_heat_get(...PUMP, 16);
      const prof = ring.map(([x, y]) => q._moore26_charge_get(x, y, 16));
      const dt = t - tp || 1;
      console.log(`t=${String(t).padStart(3)}  I_ring=${((ev60 - ev60p) / (12 * dt)).toFixed(1)}` +
        `  ev61_tot=${ev61}  pump_heat=${heat}  q=[${prof.join(',')}]`);
      ev60p = ev60; tp = t;
    }
    if (t < T) q._moore26_tick();
  }
  console.log('  audit: charge moved (ev61) vs heat spent — 1:1 funding');
  process.exit(0);
}

console.log('unknown mode ' + MODE);
