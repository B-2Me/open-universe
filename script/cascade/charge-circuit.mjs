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
//   --mode=diode     polarized conduit (bondPar!=0): one-way flow?
//   --mode=ampere    qMagKick: two parallel wires — does current
//                    direction change the force between them?
//   --mode=beam      a flux-carrying probe cell near the wire:
//                    force on a current element (substrate Lorentz)
//   --mode=magrange  qMagRange: Ampere force at range along the wire
//   --mode=faraday   qMagInd: changing flux drives EMF (transformer)
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
  const POL = argv.polarized ? 1 : 0;
  reset(SHIFT, HEAT);
  q._moore26_heat_pump_set(RATE);
  q._moore26_diode_set(POL);
  for (const [x, y] of ring) q._moore26_mass_set(x, y, 16, MASS);
  for (const [x, y] of links) wound(x, y, 16);
  q._moore26_bondpar_set(...PUMP, 16, +1);
  q._moore26_heat_set(...PUMP, 16, H);
  if (POL) {   // diode the pump's flanking conduits: block back-flow
    q._moore26_bondpar_set(10, 16, 16, +1);
    q._moore26_bondpar_set(12, 16, 16, +1);
  }
  console.log(`\n=== funded EMF ring: heat=${H} rate=${RATE} shift=${SHIFT}` +
    `${POL ? ' DIODE-flanked pump' : ''} ===`);
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

if (MODE === 'diode') {
  // Polarized conduit = one-way junction. 4-link wire; the middle
  // conduit (14,16) gets bondPar=+1 -> passes only +x flow.
  // Forward: pin +V left, 0 right -> current should pass.
  // Reverse: pin +V right, 0 left -> junction should block it.
  const V = +(argv.v ?? 1024), T = +(argv.ticks ?? 120);
  function seedDiode(on) {
    reset(SHIFT, HEAT);
    q._moore26_diode_set(on ? 1 : 0);
    for (let i = 0; i <= 4; i++) q._moore26_mass_set(9 + 2 * i, 16, 16, MASS);
    for (let i = 0; i < 4; i++) wound(10 + 2 * i, 16, 16);
    q._moore26_bondpar_set(14, 16, 16, +1);   // polarize mid conduit +x
  }
  function runDiode(vs, vd, on) {
    seedDiode(on);
    const src = [vs > 0 ? 9 : 17, 16, 16], dst = [vs > 0 ? 17 : 9, 16, 16];
    let iD = 0, n = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      if (t >= T - 20) { iD += q._moore26_charge_get(...dst); n++; }
      q._moore26_charge_set(...src, Math.abs(vs - vd));
      q._moore26_charge_set(...dst, 0);
    }
    return iD / n;
  }
  const If = runDiode(V, 0, true), Ir = runDiode(0, V, true), I0 = runDiode(0, V, false);
  console.log(`\n=== diode: mid-conduit bondPar=+1 (passes +x only), V=${V} ===`);
  console.log(`  forward (+x drive): I=${If.toFixed(2)}`);
  console.log(`  reverse (-x drive): I=${Ir.toFixed(2)}  (blocked if < ~1%)`);
  console.log(`  reverse, qDiode OFF: I=${I0.toFixed(2)}  (control: conducts)`);
  process.exit(0);
}

if (MODE === 'ampere') {
  // Two parallel x-wires (y=16, y=18), coupled by committed y-links
  // at (x,17) for odd x. qMagKick reads the cells' flux registers:
  // parallel currents should ATTRACT the wires (dot>0), antiparallel
  // should REPEL — the antisymmetric part of the y-impulse on wire2
  // is the magnetic signature (electrostatics are reversal-symmetric).
  const V = +(argv.v ?? 1024), T = +(argv.ticks ?? 40);
  const MK = +(argv.mag ?? 10), KICK = +(argv.kick ?? 0);
  const w1 = [], w2 = [];
  for (let i = 0; i <= 6; i++) { w1.push([9 + 2 * i, 16]); w2.push([9 + 2 * i, 18]); }
  const links = [[11, 17], [13, 17], [15, 17], [17, 17], [19, 17]];
  function seedAmp() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    q._moore26_charge_kick_set(KICK);
    for (const [x, y] of w1) q._moore26_mass_set(x, y, 16, MASS);
    for (const [x, y] of w2) q._moore26_mass_set(x, y, 16, MASS);
    for (let i = 0; i < 6; i++) {
      wound(10 + 2 * i, 16, 16);   // wire1 x-links
      wound(10 + 2 * i, 18, 16);   // wire2 x-links
    }
    for (const [x, y] of links) wound(x, y, 16);  // coupling links
  }
  // wire2 is a GHOST wire: charge pinned 0 on every cell (no
  // leakage possible) and its current is a pinned flux[0] — a
  // lattice of pure current elements. Only the Ampère law can
  // push it (kick=0 here -> electrostatics excluded by design).
  function pinAmp(f2) {
    q._moore26_charge_set(9, 16, 16, V);
    q._moore26_charge_set(21, 16, 16, 0);
    for (const [x, y] of w1) {
      q._moore26_mass_set(x, y, 16, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(x, y, 16, e, 0);
    }
    for (const [x, y] of w2) {
      q._moore26_charge_set(x, y, 16, 0);
      q._moore26_flux_set(x, y, 16, 0, f2);
      q._moore26_mass_set(x, y, 16, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(x, y, 16, e, 0);
    }
  }
  function runAmp(f2) {
    seedAmp();
    for (let t = 0; t < 50; t++) { q._moore26_tick(); pinAmp(f2); }
    let fy = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (const [x, y] of w2)
        for (const e of [3, 4, 7, 8])   // y-axis pairs (AXP[1])
          fy += q._moore26_momentum_at_get(x, y, 16, e);
      pinAmp(f2);
    }
    return { fy: fy / T, f1: q._moore26_flux_get(15, 16, 16, 0) };
  }
  const F2 = +(argv.f2 ?? 200);
  console.log(`\n=== ampere: V=${V} mag=${MK} kick=${KICK} ghost-wire flux=${F2} ===`);
  // label by MEASURED flux direction — a wire's charge record can
  // go negative (provenance), so 'current' flows where flux says
  const rp = runAmp(+F2), ra = runAmp(-F2), r0 = runAmp(0);
  const s1 = Math.sign(rp.f1) || 1;
  const par = s1 * F2 > 0 ? rp : ra, ant = s1 * F2 > 0 ? ra : rp;
  console.log(`  wire1 flux_x=${rp.f1}  (negative => record conduction runs -x)`);
  console.log(`  parallel   : F_y=${par.fy.toFixed(1)}/tick  ${par.fy < 0 ? 'TOWARD' : 'AWAY'}`);
  console.log(`  antiparallel: F_y=${ant.fy.toFixed(1)}/tick  ${ant.fy < 0 ? 'TOWARD' : 'AWAY'}`);
  console.log(`  no current : F_y=${r0.fy.toFixed(1)}/tick  (gravity baseline)`);
  console.log(`  magnetic term = (par - ant)/2 = ${((par.fy - ant.fy) / 2).toFixed(1)}` +
    `  ${par.fy < ant.fy ? 'AMPERE: parallel attracts' : 'INVERTED'}`);
  process.exit(0);
}

if (MODE === 'beam') {
  // A current element, not a body: probe cell (15,14) carries a
  // pinned flux[0] (its q*v analog), linked to wire cell (15,16)
  // carrying the wire's +x current. qMagKick: parallel fluxes
  // attract -> probe pushed +y; antiparallel -> repelled.
  const V = +(argv.v ?? 1024), FB = +(argv.fb ?? 200), T = +(argv.ticks ?? 40);
  const MK = +(argv.mag ?? 10);
  const TB = [15, 14, 16];
  function seedBeam() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    q._moore26_diode_set(1);
    seedWire(6);
    wound(15, 15, 16);
    // probe link is committed but charge-BLOCKED (bondPar<0 passes
    // only -y; the probe is always the higher side so nothing
    // flows) — isolates the flux coupling from link leakage
    q._moore26_bondpar_set(15, 15, 16, -1);
    q._moore26_mass_set(...TB, MASS);
  }
  function pinBeam(vs, vd, fb) {
    q._moore26_charge_set(9, 16, 16, vs);
    q._moore26_charge_set(21, 16, 16, vd);
    q._moore26_flux_set(...TB, 0, fb);
    q._moore26_mass_set(...TB, MASS);
    for (let i = 0; i <= 6; i++) {
      q._moore26_mass_set(9 + 2 * i, 16, 16, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(9 + 2 * i, 16, 16, e, 0);
    }
    for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(...TB, e, 0);
  }
  function runBeam(vs, vd, fb, label) {
    seedBeam();
    for (let t = 0; t < 50; t++) { q._moore26_tick(); pinBeam(vs, vd, fb); }
    let fy = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (const e of [3, 4, 7, 8])   // y-axis pairs (AXP[1])
        fy += q._moore26_momentum_at_get(...TB, e);
      pinBeam(vs, vd, fb);
    }
    const fw = q._moore26_flux_get(15, 16, 16, 0);
    console.log(`  ${label}: probe F_y=${(fy / T).toFixed(1)}/tick` +
      `  (wire flux_x=${fw})  ${fy > 0 ? 'TOWARD wire' : fy < 0 ? 'AWAY' : 'none'}`);
    return fy / T;
  }
  console.log(`\n=== beam probe: V=${V} probe flux=${FB} mag=${MK} ===`);
  runBeam(V, 0, +FB, 'probe +x, wire +x ');
  runBeam(V, 0, -FB, 'probe -x, wire +x ');
  runBeam(V, 0, 0,   'probe static      ');
  runBeam(0, 0, +FB, 'no wire current   ');
  console.log('  expect: parallel -> attract (+y), antiparallel -> repel');
  process.exit(0);
}

if (MODE === 'magrange') {
  // Ampère AT RANGE: the force walks a committed zigzag even-cell
  // wire (even->even hops on {±1,±1,0}) to a flux-bearing terminus.
  // Both termini are GHOST cells: charge pinned 0, flux[0] pinned —
  // pure current elements, no conduction, no Coulomb, only the
  // ranged Ampère law can deliver force.
  const MK = +(argv.mag ?? 10), MR = +(argv.range ?? 8), F = +(argv.f ?? 200);
  const T_ = [9, 16, 16], W_ = [19, 16, 16], T = +(argv.ticks ?? 30);
  const WIRE = [];
  for (let x = 10; x <= 18; x++) WIRE.push([x, x % 2 ? 15 : 16, 16]);
  function seedMR(skip = -1) {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    q._moore26_mag_range_set(MR);
    WIRE.forEach(([x, y, z], i) => { if (i !== skip) wound(x, y, z); });
    q._moore26_mass_set(...T_, MASS);
    q._moore26_mass_set(...W_, MASS);
  }
  function pinMR(ft, fw) {
    for (const c of [T_, W_]) {
      q._moore26_charge_set(...c, 0);
      q._moore26_mass_set(...c, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(...c, e, 0);
    }
    q._moore26_flux_set(...T_, 0, ft);
    q._moore26_flux_set(...W_, 0, fw);
  }
  function runMR(ft, fw, skip = -1) {
    seedMR(skip);
    for (let t = 0; t < 20; t++) { q._moore26_tick(); pinMR(ft, fw); }
    let fx = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (const e of [3, 4, 5, 6])   // x-axis pairs (AXP[0])
        fx += q._moore26_momentum_at_get(...T_, e);
      pinMR(ft, fw);
    }
    return { fx: fx / T, ev22: Number(q._moore26_events(22)) };
  }
  console.log(`\n=== magrange: T ghost at x=9, W ghost at x=19, 9-cell wire, ` +
    `flux=${F} mag=${MK} range=${MR} ===`);
  const rp = runMR(+F, +F), ra = runMR(+F, -F), r0 = runMR(+F, 0);
  const rt0 = runMR(0, +F), rb = runMR(+F, +F, 4);
  console.log(`  parallel   (+,+): F_x=${rp.fx.toFixed(1)}/tick  ${rp.fx > 0 ? 'TOWARD' : 'AWAY'}  ev22=${rp.ev22}`);
  console.log(`  antiparallel(+,-): F_x=${ra.fx.toFixed(1)}/tick  ${ra.fx < 0 ? 'AWAY' : 'TOWARD'}  ev22=${ra.ev22}`);
  console.log(`  dead end   (+,0): F_x=${r0.fx.toFixed(1)}/tick  (no flux terminus -> dead)  ev22=${r0.ev22}`);
  console.log(`  passive T  (0,+): F_x=${rt0.fx.toFixed(1)}/tick  (no local current -> dead)  ev22=${rt0.ev22}`);
  console.log(`  broken wire     : F_x=${rb.fx.toFixed(1)}/tick  (force IS the wire)  ev22=${rb.ev22}`);
  console.log(`  antisymmetric term = ${((rp.fx - ra.fx) / 2).toFixed(1)}` +
    `  ${rp.fx > ra.fx ? 'AMPERE AT RANGE: parallel attracts' : 'INVERTED'}`);
  process.exit(0);
}

if (MODE === 'faraday') {
  // TRANSFORMER: primary ghost P (x-flux driven by harness) linked
  // by a committed y-conduit to secondary cell B, whose x-wire runs
  // C-B-D. Only CHANGING P flux should drive B's charge along x —
  // ramp => Lenz-signed EMF, steady DC => silence, release =>
  // reverse spike. ev24 = induced charge.
  const MI = +(argv.ind ?? 3), RATE = +(argv.rate ?? 64), FMAX = +(argv.fmax ?? 2560);
  const P = [15, 18, 16], B = [15, 16, 16], C = [13, 16, 16], D = [17, 16, 16];
  function seedInd() {
    reset(SHIFT, HEAT);
    q._moore26_mag_ind_set(MI);
    wound(15, 17, 16);   // P-B coupling conduit
    wound(14, 16, 16);   // C-B conduit
    wound(16, 16, 16);   // B-D conduit
    for (const c of [P, B, C, D]) q._moore26_mass_set(...c, MASS);
    q._moore26_charge_set(...B, 512);
  }
  const pf = t => t < 40 ? Math.min(FMAX, t * RATE)
                       : t < 80 ? FMAX : 0;   // ramp 40, hold 40, release
  seedInd();
  console.log(`\n=== faraday: P flux x ramped ${RATE}/tick to ${FMAX}, held, ` +
    `released; secondary wire C-B-D along x, B charge=512, ind=${MI} ===`);
  console.log('   t   P.flux  B.q  C.q  D.q   B.flux_x  ev24');
  for (let t = 0; t < 100; t++) {
    q._moore26_tick();
    q._moore26_flux_set(...P, 0, pf(t));
    if (t % 5 === 0 || (t >= 78 && t <= 84))
      console.log(`  ${String(t).padStart(3)}  ${String(q._moore26_flux_get(...P, 0)).padStart(6)}` +
        `  ${String(q._moore26_charge_get(...B)).padStart(4)}` +
        ` ${String(q._moore26_charge_get(...C)).padStart(4)}` +
        ` ${String(q._moore26_charge_get(...D)).padStart(4)}` +
        `   ${String(q._moore26_flux_get(...B, 0)).padStart(7)}` +
        `  ${String(Number(q._moore26_events(24))).padStart(6)}`);
  }
  console.log('  expect: ev24 ticking during ramp (Lenz -x), SILENT at' +
    ' DC hold, one reverse spike at release');
  process.exit(0);
}

if (MODE === 'pinch') {
  // Z-PINCH: a single driven link's own transfer writes PARALLEL
  // flux on both endpoints -> the junction self-attracts.
  // Signatures vs the two-wire Ampere force:
  //   * reversal-INVARIANT (both fluxes flip, dot stays +)
  //   * force ~ I^2 (Bennett relation — pinch pressure ~ I^2)
  // Fixture: A(9) -e- B(11) committed x-link; A pinned +V,
  // B pinned 0 -> steady I = V>>shift. Lattice pinned, impulse read.
  const MK = +(argv.mag ?? 8), T = +(argv.ticks ?? 30);
  const A = [9, 16, 16], B = [11, 16, 16];
  function seedP() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    wound(10, 16, 16);
    q._moore26_mass_set(...A, MASS);
    q._moore26_mass_set(...B, MASS);
  }
  function runPinch(vs, vd) {
    seedP();
    const pin = () => {
      q._moore26_charge_set(...A, vs);
      q._moore26_charge_set(...B, vd);
      for (const c of [A, B]) {
        q._moore26_mass_set(...c, MASS);
        for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(...c, e, 0);
      }
    };
    for (let t = 0; t < 30; t++) { q._moore26_tick(); pin(); }
    let fx = 0, fl = 0;
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (const e of [3, 4, 5, 6]) fx += q._moore26_momentum_at_get(...B, e);
      fl += q._moore26_flux_get(...A, 0);
      pin();
    }
    return { fx: fx / T, I: Math.abs(fl / T) };
  }
  console.log(`\n=== pinch: driven A-B link, force on B, mag=${MK} shift=${SHIFT} ===`);
  const base = runPinch(0, 0);
  console.log(`  baseline (I=0)     : F_x=${base.fx.toFixed(1)}/tick  (gravity)`);
  const rows = [];
  for (const V of [256, 512, 1024, 2048, 4096]) {
    const r = runPinch(V, 0);
    rows.push({ V, I: r.I, f: r.fx - base.fx });
    console.log(`  V=${String(V).padStart(4)}  I=${r.I.toFixed(1).padStart(7)}` +
      `  pinch F=${(r.fx - base.fx).toFixed(1).padStart(9)}/tick` +
      `  ${r.fx - base.fx < 0 ? 'TOWARD A (pinched)' : 'AWAY'}`);
  }
  const rev = runPinch(0, 1024);
  console.log(`  REVERSED V=1024  : I=${rev.I.toFixed(1)}` +
    `  pinch F=${(rev.fx - base.fx).toFixed(1)}/tick` +
    `  ${(rev.fx - base.fx) < 0 ? 'STILL TOWARD — reversal-invariant' : 'REVERSED?'}`);
  // log-log slope of pinch vs I (expect ~2 = Bennett I^2 law)
  const lg = rows.map(r => [Math.log(r.I), Math.log(-r.f)]).filter(p => isFinite(p[1]));
  const n = lg.length, sx = lg.reduce((a, p) => a + p[0], 0), sy = lg.reduce((a, p) => a + p[1], 0);
  const sxx = lg.reduce((a, p) => a + p[0] * p[0], 0), sxy = lg.reduce((a, p) => a + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  console.log(`  pinch-vs-I log-log slope = ${slope.toFixed(2)}  (Bennett predicts ~2)`);
  process.exit(0);
}

if (MODE === 'wave') {
  // CONDUCTED WAVE: a chain of induction-coupled cells. Cell0's
  // flux is driven +F for K ticks then released — a square current
  // pulse. Each cell's induced EMF writes REAL flux on its
  // neighbor, whose CHANGE then induces the next cell: the
  // disturbance should self-propagate at ~1 hop/tick with
  // alternating sign, attenuating on the ~1/32 flux decay.
  // Vacuum caveat: EMF needs charge carriers — this is a
  // transmission-line wave, not light-in-vacuum.
  const MI = +(argv.ind ?? 3), F = +(argv.f ?? 1024), K = +(argv.k ?? 4);
  const T = +(argv.ticks ?? 40), NC = 9;
  const XS = []; for (let x = 9; x <= 25; x += 2) XS.push(x);
  function seedWave() {
    reset(SHIFT, HEAT);
    q._moore26_mag_ind_set(MI);
    for (let i = 0; i < NC - 1; i++) wound(XS[i] + 1, 16, 16);
    for (const x of XS) {
      q._moore26_mass_set(x, 16, 16, MASS);
      q._moore26_charge_set(x, 16, 16, 200);
    }
    q._moore26_charge_set(XS[0], 16, 16, 0);  // drive head is a ghost
  }
  seedWave();
  console.log(`\n=== wave: ${NC}-cell induction chain, drive flux=${F} for K=${K} ticks, ind=${MI} ===`);
  console.log('  cell x:      ' + XS.map(x => String(x).padStart(5)).join(''));
  const rows = [];
  for (let t = 0; t <= T; t++) {
    if (t) q._moore26_tick();
    // drive the head's flux register: square pulse, +F then 0
    q._moore26_flux_set(XS[0], 16, 16, 0, t <= K ? F : 0);
    const fl = XS.map(x => q._moore26_flux_get(x, 16, 16, 0));
    rows.push(fl);
    if (t <= 30)
      console.log(`  t=${String(t).padStart(2)}      ` +
        fl.map(f => (f > 0 ? '+' : '') + Math.round(f / 10)).join('  ').padStart(5));
  }
  // crossing times: first tick each cell's |flux| > 8 -> speed
  let prev = 0, first = null, speed = [];
  for (let i = 0; i < NC; i++) {
    const tc = rows.findIndex(r => Math.abs(r[i]) > 8);
    if (tc >= 0) { speed.push(tc - prev); prev = tc; first ??= tc; }
    else speed.push(null);
  }
  console.log('  first |flux|>8 per cell (ticks after predecessor):');
  console.log('   ' + XS.map((x, i) => `${x}:${speed[i] === null ? 'x' : speed[i]}`).join('  '));
  console.log('  expect: ~1/hop if the disturbance self-propagates at causal speed');
  process.exit(0);
}

if (MODE === 'pring') {
  // RING PINCH — the spheromak question: does a driven current ring
  // constrict or hold? 16x16 square ring (32 cells) with a
  // diode-flanked heat pump driving circulation (heat repinned =
  // sustained battery). qMagKick pinches every current-carrying
  // link: same-side links compress (parallel flux), corner links
  // see opposite-side flux (antiparallel -> repel).
  //   pinned phase: net radial impulse/cell/tick (inward = pinch)
  //   free phase  : mean radius of the ring's mass vs time —
  //                 constrict, hold, or disassemble?
  const MK = +(argv.mag ?? 10), RATE = +(argv.rate ?? 8);
  const HP = +(argv.heat ?? 10000), T = +(argv.ticks ?? 150);
  const QC = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],
    [0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
  const RING = [], LINK = [];
  for (let x = 9; x <= 25; x += 2) { RING.push([x, 8]); RING.push([x, 24]); }
  for (let y = 10; y <= 22; y += 2) { RING.push([9, y]); RING.push([25, y]); }
  for (let x = 10; x <= 24; x += 2) { LINK.push([x, 8]); LINK.push([x, 24]); }
  for (let y = 11; y <= 23; y += 2) { LINK.push([9, y]); LINK.push([25, y]); }
  const PUMP = [11, 8], CTR = [17, 16];
  function seedRing(mk, drive) {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(mk);
    q._moore26_heat_pump_set(RATE);
    q._moore26_diode_set(1);
    for (const [x, y] of RING) q._moore26_mass_set(x, y, 16, MASS);
    for (const [x, y] of LINK) wound(x, y, 16);
    if (drive) {
      q._moore26_bondpar_set(...PUMP, 16, +1);
      q._moore26_bondpar_set(10, 8, 16, +1);
      q._moore26_bondpar_set(12, 8, 16, +1);
    }
  }
  const force3 = (x, y) => {
    const F = [0, 0, 0];
    for (let e = 3; e <= 8; e++) {
      const p = q._moore26_momentum_at_get(x, y, 16, e);
      for (let a = 0; a < 3; a++) F[a] += p * QC[2 * e][a];
    }
    return F;
  };
  // PINNED: radial impulse per ring cell per tick
  function radialImpulse(mk, drive) {
    seedRing(mk, drive);
    let fr = 0;
    for (let t = 0; t < 40; t++) {
      q._moore26_tick();
      if (t >= 20)
        for (const [x, y] of RING) {
          const F = force3(x, y);
          const rx = x - CTR[0], ry = y - CTR[1], r = Math.hypot(rx, ry) || 1;
          fr += (F[0] * rx + F[1] * ry) / r;
        }
      q._moore26_heat_set(...PUMP, 16, drive ? HP : 0);
      for (const [x, y] of RING)
        for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(x, y, 16, e, 0);
    }
    return fr / (20 * RING.length);
  }
  console.log(`\n=== pring: 32-cell ring, pump rate=${RATE} mag=${MK} ===`);
  const fDD = radialImpulse(MK, true), fDN = radialImpulse(MK, false);
  const fND = radialImpulse(0, true),  fNN = radialImpulse(0, false);
  console.log(`  radial impulse/cell/tick (negative = INWARD = pinch):`);
  console.log(`    drive+pinch : ${fDD.toFixed(1)}`);
  console.log(`    pinch, dead : ${fDN.toFixed(1)}   (no current -> no pinch)`);
  console.log(`    drive, no mk: ${fND.toFixed(1)}   (conduction without mag force)`);
  console.log(`    neither     : ${fNN.toFixed(1)}   (baseline)`);
  // FREE: ring radius trajectory, drive+pinch vs drive-only
  function freeRing(mk, drive, label) {
    seedRing(mk, drive);
    console.log(`  ${label}:`);
    for (let t = 0; t <= T; t++) {
      if (t % 25 === 0) {
        let n = 0, rs = 0;
        for (let z = 0; z < 32; z++) for (let y = 0; y < 32; y++)
          for (let x = 0; x < 32; x++) {
            const m = q._moore26_mass_get(x, y, z);
            if (m > 10) { n++; rs += Math.hypot(x - CTR[0], y - CTR[1]); }
          }
        const fl = RING.slice(0, 8).map(([x, y]) => Math.round(q._moore26_flux_get(x, y, 16, 0) / 10));
        console.log(`    t=${String(t).padStart(3)}  cells=${n}  meanR=${(rs / (n || 1)).toFixed(2)}` +
          `  bot.flux_x=[${fl.join(',')}]`);
      }
      q._moore26_heat_set(...PUMP, 16, drive ? HP : 0);
      q._moore26_tick();
    }
  }
  freeRing(MK, true, 'free drive+pinch');
  freeRing(0,  true, 'free drive only ');
  process.exit(0);
}

if (MODE === 'tload') {
  // TRANSFORMER LOADING — does the funded EMF make the primary pay?
  // Primary wire A-P-A' along x, terminals pinned with V RAMPING
  // (sustained dI/dt). Secondary B y-linked to P with charge and a
  // committed conduit to C. Conditions:
  //   ind=0      : no induction at all
  //   ind=2 load=0: free EMF (authored work)
  //   ind=2 load=1: funded — P.flux should SAG vs the free run
  const MI = +(argv.ind ?? 2), R = +(argv.ramp ?? 16), VMAX = +(argv.vmax ?? 2048);
  const T = +(argv.ticks ?? 90);
  const A = [9, 16], P = [11, 16], AP = [13, 16];
  const B = [11, 18], C = [9, 18];
  function seedT() {
    reset(SHIFT, HEAT);
    q._moore26_mag_ind_set(MI);
    wound(10, 16, 16); wound(12, 16, 16);   // A-P, P-A' primary conduits
    wound(11, 17, 16);                      // P-B coupling
    wound(10, 18, 16);                      // B-C conduit
    for (const c of [A, P, AP, B, C]) q._moore26_mass_set(...c, 16, MASS);
    q._moore26_charge_set(...B, 16, 400);
  }
  function runT(ind, load) {
    seedT();
    q._moore26_mag_ind_set(ind);
    q._moore26_ind_load_set(load);
    const out = [];
    for (let t = 0; t <= T; t++) {
      const V = Math.min(VMAX, t * R);
      q._moore26_tick();
      q._moore26_charge_set(...A, 16, V);
      q._moore26_charge_set(...AP, 16, 0);
      if (t % 10 === 0)
        out.push(`    t=${String(t).padStart(3)} V=${String(V).padStart(4)}` +
          `  P.flux=${String(q._moore26_flux_get(...P, 16, 0)).padStart(6)}` +
          `  B.flux=${String(q._moore26_flux_get(...B, 16, 0)).padStart(6)}` +
          `  B.q=${String(q._moore26_charge_get(...B, 16)).padStart(5)}` +
          `  C.q=${String(q._moore26_charge_get(...C, 16)).padStart(5)}` +
          `  ev24=${Number(q._moore26_events(24))}`);
    }
    return out;
  }
  console.log(`\n=== tload: primary V ramps ${R}/tick->${VMAX}, ` +
    `secondary B-C, ind=${MI} ===`);
  console.log('  -- ind=0 (no coupling):');
  runT(0, 0).forEach(r => console.log(r));
  console.log(`  -- ind=${MI}, FREE EMF:`);
  runT(MI, 0).forEach(r => console.log(r));
  console.log(`  -- ind=${MI}, FUNDED (primary pays):`);
  runT(MI, 1).forEach(r => console.log(r));
  console.log('  expect: P.flux sags in the funded run while B/C still get current');
  process.exit(0);
}

if (MODE === 'pwire') {
  // WIRE PINCH (sausage analog): a straight current-carrying wire
  // of FREE cells. Interior cells feel balanced link pinch; END
  // cells feel only inward pull -> the wire should contract toward
  // its center. Measure wire extent (mass xmin..xmax) vs time,
  // pinch on vs off. Terminals pinned +V/0 drive the current.
  const MK = +(argv.mag ?? 10), V = +(argv.v ?? 1024), T = +(argv.ticks ?? 200);
  const L = +(argv.l ?? 8);
  function seedW() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    seedWire(L);
    q._moore26_charge_set(9, ...YZ, V);
    q._moore26_charge_set(9 + 2 * L, ...YZ, 0);
  }
  const extent = () => {
    let lo = 99, hi = 0, n = 0;
    for (let x = 0; x < 32; x++)
      if (q._moore26_mass_get(x, 16, 16) > 10) { n++; if (x < lo) lo = x; if (x > hi) hi = x; }
    return { lo, hi, n };
  };
  console.log(`\n=== pwire: ${L + 1}-cell free wire, V=${V} mag=${MK} shift=${SHIFT} ===`);
  for (const mk of [MK, 0]) {
    seedW();
    q._moore26_mag_kick_set(mk);
    console.log(`  -- magKick=${mk}:`);
    for (let t = 0; t <= T; t++) {
      if (t % 25 === 0) {
        const e = extent();
        const fl = [9, 13, 17, 21].map(x => Math.round(q._moore26_flux_get(x, ...YZ, 0) / 10));
        console.log(`    t=${String(t).padStart(3)}  cells=${e.n}  extent=x${e.lo}..x${e.hi}` +
          `  span=${e.hi - e.lo}  flux=[${fl.join(',')}]`);
      }
      if (t < T) {
        q._moore26_tick();
        q._moore26_charge_set(9, ...YZ, V);
        q._moore26_charge_set(9 + 2 * L, ...YZ, 0);
      }
    }
  }
  process.exit(0);
}

if (MODE === 'pwire2') {
  // TRACKING ELECTRODES — the "plasma carries its circuit" test:
  // instead of fixed pins, the +V/0 terminals follow the wire's
  // surviving ends each tick. When the pinch pulls an end cell
  // off the lattice, the drive doesn't die with the first break —
  // it re-pins on the next surviving terminus and keeps pushing
  // current through the shrinking arc. Question: does the wire
  // erode cell-by-cell all the way down (sequential pinch eating
  // its own ends) or reach a stable current-carrying remnant?
  const MK = +(argv.mag ?? 12), V = +(argv.v ?? 256), T = +(argv.ticks ?? 250);
  const L = +(argv.l ?? 8);
  function seedW() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    seedWire(L);
  }
  // wire termini = extreme-x mass cells still sitting on the
  // committed conduit path (y=16 row): min and max x with mass
  const termini = () => {
    let lo = -1, hi = -1;
    for (let x = 0; x < 32; x++)
      if (q._moore26_mass_get(x, 16, 16) > 10) { if (lo < 0) lo = x; hi = x; }
    return { lo, hi };
  };
  console.log(`\n=== pwire2: free wire + tracking electrodes, V=${V} mag=${MK} ===`);
  for (const mk of [MK, 0]) {
    seedW();
    q._moore26_mag_kick_set(mk);
    console.log(`  -- magKick=${mk}:`);
    for (let t = 0; t <= T; t++) {
      if (t % 25 === 0 || t === T) {
        const e = termini();
        const live = e.lo >= 0 ? q._moore26_flux_get((e.lo + e.hi) >> 1 | 1, ...YZ, 0) : 0;
        console.log(`    t=${String(t).padStart(3)}  ends=x${e.lo}..x${e.hi}` +
          `  span=${e.hi - e.lo}  mid.flux_x=${Math.round(live / 10)}`);
      }
      if (t < T) {
        q._moore26_tick();
        const e = termini();
        if (e.lo >= 0 && e.hi > e.lo) {
          q._moore26_charge_set(e.lo, ...YZ, V);   // electrode tracks
          q._moore26_charge_set(e.hi, ...YZ, 0);   // the moving ends
        }
      }
    }
  }
  process.exit(0);
}

if (MODE === 'wmerge') {
  // WIRE MERGE — two free parallel wires carrying current attract
  // (the Ampere term is much bigger than self-pinch). y-wires at
  // y=16/y=18 with coupling links at (x,17), both driven +x.
  // Plasma filaments merge this way; do ours? Track the mean
  // y-separation of the two wires' mass centroids vs time.
  // Cases: same-direction current (attract), opposite (repel),
  // mag=0 (dead). The catch recorded in findings: cells hopping
  // off their lanes break their links — capture may kill the
  // current, leaving a statically-bound clump.
  const MK = +(argv.mag ?? 8), V = +(argv.v ?? 512), T = +(argv.ticks ?? 120);
  const wA = [], wB = [], links = [];
  for (let i = 0; i <= 6; i++) { wA.push([9 + 2 * i, 16]); wB.push([9 + 2 * i, 18]); }
  for (let x = 11; x <= 19; x += 2) links.push([x, 17]);
  const RX = +(argv.react ?? 0);       // qFieldReact: strain reservoir
  function seedMerge() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    q._moore26_field_react_set(RX);
    for (const [x, y] of wA.concat(wB)) q._moore26_mass_set(x, y, 16, MASS);
    for (let i = 0; i < 6; i++) { wound(10 + 2 * i, 16, 16); wound(10 + 2 * i, 18, 16); }
    for (const [x, y] of links) wound(x, y, 16);
  }
  const centroidY = (y0, y1) => {
    let ys = 0, n = 0;
    for (let x = 0; x < 32; x++)
      for (let y = y0; y <= y1; y++)
        if (q._moore26_mass_get(x, y, 16) > 10) { ys += y; n++; }
    return n ? ys / n : NaN;
  };
  // drive ends + pin the TERMINAL cells (mass+momentum) so the
  // current survives end-erosion; interior cells x=11..19 stay
  // FREE — they're what the attraction gets to move
  const TERM = [[9, 16], [21, 16], [9, 18], [21, 18]];
  const STROBE = +(argv.strobe ?? 0);    // 0=DC; N=drive 1 tick in N — pulsed creep
  const drive = (par, t) => {
    const on = !STROBE || t % STROBE === 0;
    q._moore26_charge_set(9, 16, 16, on ? V : 0);
    q._moore26_charge_set(21, 16, 16, 0);
    q._moore26_charge_set(9, 18, 16, on && par ? V : 0);
    q._moore26_charge_set(21, 18, 16, on && !par ? V : 0);
    for (const [x, y] of TERM) {
      q._moore26_mass_set(x, y, 16, MASS);
      for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(x, y, 16, e, 0);
    }
  };
  function runMerge(par, label, mk = MK) {
    seedMerge();
    q._moore26_mag_kick_set(mk);
    console.log(`  -- ${label}:`);
    for (let t = 0; t <= T; t++) {
      if (t % 15 === 0) {
        const ca = centroidY(14, 16), cb = centroidY(17, 19);
        let n = 0;
        for (let x = 0; x < 32; x++) for (let y = 13; y <= 21; y++)
          if (q._moore26_mass_get(x, y, 16) > 10) n++;
        console.log(`    t=${String(t).padStart(3)}  cA_y=${ca.toFixed(2)} cB_y=${cb.toFixed(2)}` +
          `  sep=${(cb - ca).toFixed(2)}  cells=${n}`);
      }
      if (t < T) { q._moore26_tick(); drive(par, t); }
    }
  }
  console.log(`\n=== wmerge: two free parallel wires, V=${V} mag=${MK} strobe=${STROBE || 'DC'} react=${RX} ===`);
  runMerge(1, 'parallel currents   (expect ATTRACT -> sep shrinks)');
  runMerge(0, 'antiparallel currents (expect REPEL -> sep grows)');
  runMerge(1, 'mag=0 control        (expect static)', 0);
  process.exit(0);
}

if (MODE === 'fwire') {
  // FIELD-GLUED WIRE — the bottle test: ghost-pole the wire's own
  // conduits so their field pushes carriers AWAY from the structure
  // (anti-aligned to the wire current). Interior cells see balanced
  // ±x pressure; the END cell's single conduit pushes it outward —
  // countering the pinch's inward necking. Question: does the wire
  // survive the pinch erosion that killed the unpoled wire?
  // The field is lattice-resident: erosion can't kill the confiner.
  const MK = +(argv.mag ?? 16), V = +(argv.v ?? 128), T = +(argv.ticks ?? 200);
  const L = +(argv.l ?? 8), B = +(argv.field ?? 512);
  const CX = [];                            // interior conduit x's (even only)
  for (let x = 10; x < 9 + 2 * L; x += 2) CX.push(x);
  const CAPS = [8, 10 + 2 * L];             // mirror caps past the ends
  function seedW(caps) {
    reset(SHIFT, HEAT);
    seedWire(L);
    if (caps) for (const x of CAPS) wound(x, 16, 16);
  }
  const extent = () => {
    let lo = 99, hi = 0, n = 0;
    for (let x = 0; x < 32; x++)
      if (q._moore26_mass_get(x, 16, 16) > 10) { n++; if (x < lo) lo = x; if (x > hi) hi = x; }
    return { lo, hi, n };
  };
  function runW(mk, pole, caps, capPole, label) {
    seedW(caps);
    q._moore26_mag_kick_set(mk);
    console.log(`  -- ${label}:`);
    for (let t = 0; t <= T; t++) {
      if (t % 25 === 0) {
        const e = extent();
        const fl = [9, 13, 17, 21, 25].map(x => Math.round(q._moore26_flux_get(x, ...YZ, 0) / 10));
        console.log(`    t=${String(t).padStart(3)}  cells=${e.n}  extent=x${e.lo}..x${e.hi}` +
          `  span=${e.hi - e.lo}  flux=[${fl.join(',')}]`);
      }
      if (t < T) {
        q._moore26_tick();
        q._moore26_charge_set(9, ...YZ, V);
        q._moore26_charge_set(9 + 2 * L, ...YZ, 0);
        for (const x of CX) q._moore26_flux_set(x, 16, 16, 0, pole);    // ghost field walls
        if (caps) for (const x of CAPS) q._moore26_flux_set(x, 16, 16, 0, capPole);
      }
    }
  }
  console.log(`\n=== fwire: free wire + poled conduits, V=${V} mag=${MK} B=${B} ===`);
  runW(MK, -B, 1, +B, 'mirror: interior anti + caps aligned (expect best hold)');
  runW(MK, -B, 0, 0,  'anti-poled walls (interior bottle)');
  runW(MK, +B, 0, 0,  'aligned poles  (added necking)');
  runW(MK, 0,  0, 0,  'unpoled        (baseline erosion)');
  runW(0,  -B, 1, +B, 'no pinch       (drive only baseline)');
  process.exit(0);
}

if (MODE === 'fsheath') {
  // SELF-POLED SHEATH — the pressure-vessel test: commit the 4
  // transverse evens (±y, ±z) around every wire cell — a sheath of
  // committed conduit wrapping the wire. Under qVacPol the wire's
  // own Δflux poles the sheath automatically (the circuit writes
  // its own walls). Field force then acts transversely: anti-poled
  // sheath squeezes cells toward the axis (bottle), aligned pulls
  // outward. With qFieldReact, erosion kicks deposit strain into
  // the walls and the walls press back — self-hardening vessel.
  const MK = +(argv.mag ?? 16), V = +(argv.v ?? 128), T = +(argv.ticks ?? 200);
  const L = +(argv.l ?? 8), B = +(argv.field ?? 512), VP = +(argv.vacpol ?? 3);
  const RX = +(argv.react ?? 0), NOCAPS = +(argv.nocaps ?? 0);
  const SH = [];                              // sheath evens (±y,±z per cell)
  for (let i = 0; i <= L; i++) {
    const x = 9 + 2 * i;
    SH.push([x, 15, 16], [x, 17, 16], [x, 16, 15], [x, 16, 17]);
  }
  const CAPS = [[8, 16, 16], [10 + 2 * L, 16, 16]];   // end-cap evens (the vessel's 5th/6th faces)
  function seedS(sheath) {
    reset(SHIFT, HEAT);
    seedWire(L);
    if (sheath) { for (const [x, y, z] of SH) wound(x, y, z);
                  if (!NOCAPS) for (const [x, y, z] of CAPS) wound(x, y, z); }
  }
  const extent = () => {
    let lo = 99, hi = 0, n = 0;
    for (let x = 0; x < 32; x++)
      if (q._moore26_mass_get(x, 16, 16) > 10) { n++; if (x < lo) lo = x; if (x > hi) hi = x; }
    return { lo, hi, n };
  };
  const cellsNear = () => {
    let n = 0;
    for (let x = 0; x < 32; x++) for (let y = 13; y <= 19; y++)
      if (q._moore26_mass_get(x, y, 16) > 10) n++;
    return n;
  };
  function runS(mk, vp, rx, pole, sheath, label, pp, wp, ws, cy) {
    seedS(sheath);
    q._moore26_mag_kick_set(mk);
    q._moore26_vac_pol_set(vp);
    q._moore26_field_react_set(rx);
    q._moore26_pol_prop_set(pp ?? 0);
    q._moore26_wall_press_set(wp ?? 0);
    q._moore26_wall_stall_set(ws ?? 0);
    q._moore26_creep_yield_set(cy ?? 0);
    console.log(`  -- ${label}:`);
    const e25 = Number(q._moore26_events(25)), e27 = Number(q._moore26_events(27)), e64 = Number(q._moore26_events(64));
    for (let t = 0; t <= T; t++) {
      if (t % 25 === 0) {
        const e = extent();
        const fl = [11, 15, 19, 23].map(x => Math.round(q._moore26_flux_get(x, ...YZ, 0) / 10));
        const sp = sheath ? Math.round(q._moore26_flux_get(15, 17, 16, 0) / 10) : 0;
        console.log(`    t=${String(t).padStart(3)}  cells=${e.n}(${cellsNear()})  extent=x${e.lo}..x${e.hi}` +
          `  span=${e.hi - e.lo}  flux=[${fl.join(',')}]  sheath_flux=${sp}`);
      }
      if (t < T) {
        q._moore26_tick();
        q._moore26_charge_set(9, ...YZ, V);
        q._moore26_charge_set(9 + 2 * L, ...YZ, 0);
        if (pole) {
          for (const [x, y, z] of SH) q._moore26_flux_set(x, y, z, 0, pole);
          for (const [x, y, z] of CAPS) q._moore26_flux_set(x, y, z, 0, -pole);
        }
      }
    }
    console.log(`    ev25(pol)=${Number(q._moore26_events(25)) - e25}  ev27(press)=${Number(q._moore26_events(27)) - e27}  ev64(yield)=${Number(q._moore26_events(64)) - e64}`);
  }
  console.log(`\n=== fsheath: wire + conduit vessel, V=${V} mag=${MK} B=${B} ===`);
  runS(MK, VP, 0, 0, 1, `self-poled vessel (vacpol=${VP}, resistive)`);
  runS(MK, -Math.abs(VP), 0, 0, 1, `self-poled DIAMAGNETIC (vacpol=${-Math.abs(VP)}: sheath writes anti)${NOCAPS ? ', NO CAPS' : ''}`);
  const PP = +(argv.polprop ?? 0);
  if (PP) {
    runS(MK, 0, 0, 0, 1, `PROP-poled anti-sheath (polprop=${-PP}: field ~ -I live)`, -Math.abs(PP));
    runS(MK, 0, 0, 0, 1, `PROP-poled aligned (polprop=+${PP}: control)`, Math.abs(PP));
  }
  const WP = +(argv.wall ?? 0), WS = +(argv.stall ?? 0);
  if (WP) {
    runS(MK, 0, 0, 0, 1, `bare vessel + wall=${WP} (incident-momentum brake)`, 0, WP);
    runS(MK, 0, 0, -B, 1, `ghost vessel + wall=${WP} (does it beat 8?)`, 0, WP);
    if (WS) {
      runS(MK, 0, 0, 0, 1, `bare vessel + wall=${WP} stall=${WS} (self-hardening)`, 0, WP, WS);
      runS(MK, 0, 0, 0, 0, `NO vessel + wall=${WP} stall=${WS} (transit-tax baseline)`, 0, WP, WS);
      const CY = +(argv.creep ?? 0);
      if (CY) {
        runS(MK, 0, 0, 0, 1, `bare vessel + stall=${WS} creep=${CY} (rupture rate)`, 0, WP, WS, CY);
        runS(MK, 0, 0, 0, 0, `NO vessel + stall=${WS} creep=${CY} (rupture rate)`, 0, WP, WS, CY);
      }
      const RW = +(argv.wallreact ?? 0);
      if (RW) {
        runS(MK, 0, RW, 0, 1, `bare vessel + stall=${WS} + react=${RW} (loaded wall presses back)`, 0, WP, WS);
        runS(MK, 0, RW, 0, 0, `NO vessel + stall=${WS} + react=${RW} (loaded wall presses back)`, 0, WP, WS);
      }
    }
  }
  runS(MK, VP, +(argv.react2 ?? 4), 0, 1, `self-poled + react=${+(argv.react2 ?? 4)} (strain-hardened)`);
  runS(MK, 0, 0, -B, 1, `ghost vessel: sheath anti ${-B}, caps aligned ${B} (ideal bottle)`);
  runS(MK, 0, 0, +B, 1, `ghost vessel INVERTED: sheath aligned, caps anti (expect worse)`);
  runS(MK, 0, 0, 0, 0, `no vessel (baseline pinch)`);
  runS(0, 0, 0, 0, 1, `no pinch + bare vessel (drive control)`);
  process.exit(0);
}

if (MODE === 'fpush') {
  // FIELD FORCE calibration — the conduit as a mechanical terminus.
  // Ghost current element A (flux pinned, charge=0, no conduction)
  // faces a single committed conduit E carrying a ghost-pinned
  // poling flux[0]=B. qMagKick's Ampère law with en as terminus:
  // aligned -> pulled toward the structure, anti-aligned -> pushed
  // off. Controls: B=0, static A, perpendicular field axis.
  const MK = +(argv.mag ?? 10), F = +(argv.f ?? 200), T = +(argv.ticks ?? 50);
  const A_ = [15, 16, 16], E_ = [16, 16, 16];
  function seedF() {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    wound(...E_);
    q._moore26_mass_set(...A_, MASS);
  }
  function pinF(fa, ba) {          // ba: [axis, value] ghost field on E
    q._moore26_charge_set(...A_, 0);
    for (let a = 0; a < 3; a++) q._moore26_flux_set(...A_, a, a === 0 ? fa : 0);
    for (let a = 0; a < 3; a++) q._moore26_flux_set(...E_, a, a === ba[0] ? ba[1] : 0);
    q._moore26_mass_set(...A_, MASS);
    for (let e = 0; e < 13; e++) q._moore26_momentum_at_set(...A_, e, 0);
  }
  function runF(fa, ba, label) {
    seedF();
    for (let t = 0; t < 40; t++) { q._moore26_tick(); pinF(fa, ba); }
    let fx = 0, e26 = Number(q._moore26_events(26));
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      for (const e of [0, 1, 2, 5])   // x-axis pairs (AXP[0])
        fx += q._moore26_momentum_at_get(...A_, e);
      pinF(fa, ba);
    }
    const dE = Number(q._moore26_events(26)) - e26;
    console.log(`  ${label}: F_x=${(fx / T).toFixed(1)}/tick  ev26=${dE}` +
      `  ${fx > 0 ? 'TOWARD E' : fx < 0 ? 'AWAY' : 'none'}`);
    return fx / T;
  }
  console.log(`\n=== fpush: A ghost flux=${F} vs conduit ghost field, mag=${MK} ===`);
  runF(+F, [0, +400], 'aligned   (+f,+B)');
  runF(-F, [0, +400], 'anti      (-f,+B)');
  runF(+F, [0, -400], 'anti      (+f,-B)');
  runF(+F, [0, 0],    'no field  (+f, 0)');
  runF(0,  [0, +400], 'static A  ( 0,+B)');
  runF(+F, [1, +400], 'perp field(+f,B_y)');
  console.log('  expect: aligned -> +x toward conduit, anti -> -x away, all controls 0');
  process.exit(0);
}

if (MODE === 'rfill') {
  // RESERVOIR FILL / TAIL-WORK — the asymmetric-fill test. A single
  // ghost current element A faces committed conduit E pinned at
  // field B (aligned -> A pulled toward E). Every field-force kick
  // deposits the counter-impulse into E.fluxV — ONE-SIDED by
  // construction (the authored field has no partner cell, so no
  // symmetric cancellation). At t=HOLD the field is killed. With
  // react=0 the force stops dead; with react>0 the stored strain
  // keeps pressing A backward until the reservoir drains — delayed
  // work paid out of the medium, and the integrated tail measures
  // what was stored.
  const MK = +(argv.mag ?? 10), F = +(argv.f ?? 200), B = +(argv.b ?? 400);
  const HOLD = +(argv.hold ?? 40), T = +(argv.ticks ?? 120);
  const A_ = [15, 16, 16], E_ = [16, 16, 16];
  function runR(rx, label) {
    reset(SHIFT, HEAT);
    q._moore26_mag_kick_set(MK);
    q._moore26_field_react_set(rx);
    wound(...E_);
    const P_ = [17, 16, 16];          // probe electrode, E's far side
    let e26h = 0, e27h = 0, e27t = 0, tailMom = 0;
    const e26_0 = Number(q._moore26_events(26)), e27_0 = Number(q._moore26_events(27));
    console.log(`  -- ${label}:`);
    for (let t = 0; t <= T; t++) {
      const hold = t <= HOLD;
      if (hold) {
        q._moore26_charge_set(...A_, 0);
        q._moore26_flux_set(...A_, 0, F);
        for (let a = 0; a < 3; a++) q._moore26_flux_set(...E_, a, a === 0 ? B : 0);
        q._moore26_mass_set(...A_, MASS);
      } else {
        for (let a = 0; a < 3; a++) q._moore26_flux_set(...E_, a, 0);
        q._moore26_mass_set(...P_, MASS);      // measurement electrode:
        for (let a = 0; a < 3; a++) q._moore26_flux_set(...P_, a, 0);
      }
      q._moore26_tick();
      const d26 = Number(q._moore26_events(26)) - e26_0;
      const d27 = Number(q._moore26_events(27)) - e27_0;
      if (hold) { e26h = d26; e27h = d27; }
      else {
        e27t = d27 - e27h;
        let pm = 0;
        for (const e of [0, 1, 2, 5]) pm += q._moore26_momentum_at_get(...P_, e);
        tailMom += pm;
      }
      if (t % 10 === 0 || t === HOLD + 1 || t === HOLD + 5)
        console.log(`    t=${String(t).padStart(3)}  E.fluxV_x=${q._moore26_fluxv_get(...E_, 0)}` +
          `  ev26=${d26}  ev27=${d27}`);
    }
    console.log(`    hold: ev26=${e26h} ev27=${e27h}   |   TAIL (field dead): ev27=+${e27t}` +
      `  probe momentum sum=${tailMom}   |   stranded fluxV=${q._moore26_fluxv_get(...E_, 0)}`);
  }
  console.log(`\n=== rfill: B=${B} held ${HOLD}t then killed, F=${F} mag=${MK} ===`);
  runR(0,               'react=0 (control: force dies with field)');
  runR(+(argv.react ?? 4), `react=${+(argv.react ?? 4)} (reservoir)`);
  runR(+(argv.react2 ?? 1), `react=${+(argv.react2 ?? 1)} (tight coupling)`);
  process.exit(0);
}

if (MODE === 'wavevac') {
  // EMPTY-CONDUIT VACUUM POLARIZATION — "light" as a propagating
  // local state-change on bare committed structure. A zigzag line
  // of committed even cells (x=10..30, y alternating 16/15 — every
  // consecutive pair edge-adjacent) carries flux[] as field
  // orientation, driven by the discrete Laplacian + fluxV momentum
  // (qVacPol). NO mass or charge anywhere on the line.
  //   pure: drive the head even's flux directly (ghost field) —
  //         does polarization propagate through EMPTY structure?
  //   end2end: antenna odd cell (9,16)Δflux poles the head even;
  //         detector odd cell (31,16)+target (29,16) reads the
  //         arriving wave through the FIELD->CARRIER EMF (qMagInd
  //         on the conduit's own delta) — induced charge + flux.
  // controls: --skip=i unwinds interior even i (dead beyond),
  //           --vacpol=0 (no wave), --ind=0 (wave yes, detector no)
  const VP  = +(argv.vacpol ?? 3), MI2 = +(argv.ind ?? 4);
  const F   = +(argv.flux ?? 2000), K = +(argv.drive ?? 8);
  const T   = +(argv.ticks ?? 45), skip = +(argv.skip ?? -1);
  const NE = 21;                                   // evens x=10..30
  const EX = i => 10 + i, EY = i => 16 - (i & 1);
  function seedVac(pure) {
    reset(SHIFT, HEAT);
    q._moore26_vac_pol_set(VP);
    q._moore26_mag_ind_set(MI2);
    for (let i = 0; i < NE; i++) if (i !== skip) wound(EX(i), EY(i), 16);
    if (!pure) {
      q._moore26_mass_set(9, 16, 16, MASS);        // antenna (ghost: flux-driven)
      q._moore26_mass_set(31, 16, 16, MASS);       // detector
      q._moore26_charge_set(31, 16, 16, 200);
      q._moore26_mass_set(29, 16, 16, MASS);       // EMF push target
    }
  }
  const drive = (pure, t) => {                      // bipolar square pulse on axis 0
    const v = t < K ? F : (t < 2 * K ? -F : 0);
    if (pure) q._moore26_flux_set(10, 16, 16, 0, v);
    else      q._moore26_flux_set(9, 16, 16, 0, v);
  };
  function runVac(pure, label) {
    seedVac(pure);
    const e0 = Number(q._moore26_events(24)), e5 = Number(q._moore26_events(25));
    console.log(`  -- ${label}:`);
    console.log('    even x:   ' + Array.from({length: NE}, (_, i) => String(EX(i)).padStart(5)).join(''));
    const rows = [], det = [];
    for (let t = 0; t <= T; t++) {
      if (t) q._moore26_tick();
      drive(pure, t);
      rows.push(Array.from({length: NE}, (_, i) => q._moore26_flux_get(EX(i), EY(i), 16, 0)));
      det.push(pure ? 0 : q._moore26_charge_get(29, 16, 16));
      if (t <= 24 || t % 5 === 0)
        console.log(`    t=${String(t).padStart(2)}  ` +
          rows[t].map(f => String(Math.round(f / 100)).padStart(4)).join(' ') +
          (pure ? '' : `  det_q=${det[t]}`));
    }
    // crossing times: first tick each even's |flux| > 50 -> speed
    const cross = rows[0].map((_, i) => rows.findIndex(r => Math.abs(r[i]) > 50));
    let prev = null;
    const steps = cross.map(c => { const s = c >= 0 && prev !== null ? c - prev : null; if (c >= 0) prev = c; return s; });
    console.log('    first |flux|>50 (ticks after predecessor): ' +
      steps.map(s => s === null ? ' x' : String(s).padStart(2)).join(''));
    console.log(`    ev24(EMF)=${Number(q._moore26_events(24)) - e0}  ev25(pol)=${Number(q._moore26_events(25)) - e5}` +
      (pure ? '' : `  det charge end=${det[T]}  det flux end=${q._moore26_flux_get(31, 16, 16, 0)}`));
    return rows;
  }
  console.log(`\n=== wavevac: 21-even bare conduit line, vacpol=${VP} ind=${MI2} F=${F} pulse=${K}t skip=${skip} ===`);
  runVac(true, 'PURE: no mass anywhere — ghost field drive on head even');
  if (!MI2) console.log('    (ind=0: end-to-end detector is silent by construction)');
  else runVac(false, 'END-TO-END: antenna Δflux -> wave -> detector EMF');
  process.exit(0);
}

console.log('unknown mode ' + MODE);
