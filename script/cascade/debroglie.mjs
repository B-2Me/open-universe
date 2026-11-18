/* debroglie — the two-action consistency probe.
 *
 * The packet sector has a measured action: op = nu*age mod 256, so
 * a packet's phase advances nu units per tick (h_sub = 256 nu*ticks,
 * hbar = 40.7). The mass sector has a knob-parametrized clock:
 * localTime += free_*qPhaseAdv per tick where free_ = cap-armed-work,
 * cap = mass*qMassCap>>4 — so an idle mass-m cell's phase accrues at
 * r = m*qMassCap*qPhaseAdv/16 phase-units per tick. IF mass and nu
 * are the same energy (c=1), a mass-m cell should behave like a
 * nu=m packet internally: same rate law, same phase arbitration.
 *
 * The phase gate (qPhaseGate) is the arbiter: a packet offer with
 * op = nu*age settles on cell S only when |phase_S - op| <= g.
 * So the cell's internal clock literally arbitrates absorption —
 * if the mass clock is real, the cell is a resonant absorber at
 * its own Compton frequency.
 *
 * FIXTURE: the phase-sync relaxation pulls every live cell toward
 * its neighbors' phases — a lone cell gets dragged to dead-
 * neighbor 0. So arms A/C/D fill the 16^3 torus with uniform mass:
 * every cell live, all accruing the same phase, pull cancels —
 * a coherently oscillating Compton lattice. S = even probe cell.
 *
 *   --mode=rate    d(localTime)/dt and d(phase)/dt vs mass
 *   --mode=gate    phase_set S to phi, sweep probe nu -> the
 *                  acceptance window should be exactly |phi-nu|<=g
 *   --mode=chirp   probe nu_t = (s*t)&255, sweep s -> settles only
 *                  when s == r: the mass clock read out in packet-
 *                  frequency units
 *   --mode=tax     leave incipients standing -> armed work dilates
 *                  the clock: measured d(tau) loss per armed unit
 *
 *   node script/cascade/debroglie.mjs --mode=rate [--m=16..256]
 *   node script/cascade/debroglie.mjs --mode=gate [--phi=100] [--g=4]
 *   node script/cascade/debroglie.mjs --mode=chirp [--m=16] [--s=1..64]
 *   node script/cascade/debroglie.mjs --mode=tax [--m=32]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };

const MODE = arg('mode', 'rate');
const N = 16;
const S = [8, 8, 8];               /* even parity probe cell */
const G = parseInt(arg('g', '4'));
const CAP = parseInt(arg('cap', '16'));
const ADV = parseInt(arg('adv', '1'));
const T = parseInt(arg('t', '300'));
const M = parseInt(arg('m', '16'));

const q = await loadM26();
const setup = () => {
  q._moore26_init(N, N, N);
  if (!q._moore26_grid_ready()) { console.error('init failed'); process.exit(1); }
  q._moore26_vac_rate_set(0);
  q._moore26_catch_gate_set(1);    /* deterministic catch: rand%1=0 < lvl always */
  q._moore26_phase_gate_set(G);
  q._moore26_phase_adv_set(ADV);
  q._moore26_mass_cap_set(CAP);
};
const fill = (m) => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++)
    q._moore26_mass_set(x, y, z, m);
};
const phase = () => q._moore26_phase_get(S[0], S[1], S[2]);
const tau = () => q._moore26_localtime_get(S[0], S[1], S[2]);
const U = [7, 7, 8];               /* upstream: channel 6 {+1,+1,0} hops onto S */
const settle = () => q._moore26_incipient_get(S[0], S[1], S[2], 6) > 0;
const drop = (nu) => {             /* lands on S during phase-1 flight, age=1 */
  q._moore26_packet_set(U[0], U[1], U[2], 6, 1);
  q._moore26_packet_nu_set(U[0], U[1], U[2], 6, nu);
};
const clearIncips = () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if ((x + y + z) & 1) continue;
    for (let c = 6; c < 18; c++) {
      if (q._moore26_incipient_get(x, y, z, c)) q._moore26_incipient_set(x, y, z, c, 0);
      if (q._moore26_packet_get(x, y, z, c)) q._moore26_packet_set(x, y, z, c, 0);
    }
  }
};

if (MODE === 'rate') {
  const masses = arg('m', '8,16,32,64,128').split(',').map(Number);
  console.log(`=== debroglie/rate: uniform mass lattice, cap=${CAP} adv=${ADV} ===`);
  console.log(`  predicted r = m*cap*adv/16 = m*${CAP * ADV / 16}`);
  for (const m of masses) {
    setup(); fill(m);
    let dtSum = 0, dpSum = 0, lastTau = tau(), lastPhi = phase();
    for (let t = 0; t < T; t++) {
      q._moore26_tick();
      const ta = tau(), ph = phase();
      dtSum += ta - lastTau; lastTau = ta;
      let d = ph - lastPhi; if (d > 255) d -= 511; else if (d < -255) d += 511;
      dpSum += d; lastPhi = ph;
    }
    console.log(`  m=${String(m).padStart(3)}  dTau/tick=${(dtSum / T).toFixed(3)}  ` +
      `dPhase/tick=${(dpSum / T).toFixed(3)}  r/m=${(dtSum / T / m).toFixed(4)}  ` +
      `(predicted ${(CAP * ADV / 16).toFixed(4)})`);
  }
} else if (MODE === 'gate') {
  const PHI = parseInt(arg('phi', '100'));
  setup(); fill(M);               /* uniform lattice for a stable phase base */
  console.log(`=== debroglie/gate: phi=${PHI} g=${G} — window should be nu in ` +
    `[${PHI - G},${PHI + G}] ===`);
  const res = [];
  for (let nu = 0; nu < 256; nu++) {
    q._moore26_phase_set(S[0], S[1], S[2], PHI);
    drop(nu); q._moore26_tick();
    if (settle()) res.push(nu);
    clearIncips();
  }
  console.log(`  settled nu: ${res.join(',')}`);
  console.log(`  count=${res.length}  (predicted ~${2 * G + 1} centered at ${PHI})`);
} else if (MODE === 'chirp') {
  console.log(`=== debroglie/chirp: m=${M} cap=${CAP} adv=${ADV} g=${G} ===`);
  console.log(`  predicted r = ${M * CAP * ADV / 16} -> resonance at s=${(M * CAP * ADV / 16) % 256}`);
  for (let s = 0; s <= parseInt(arg('smax', '64')); s++) {
    setup(); fill(M);
    let hits = 0;
    for (let t = 0; t < T; t++) {
      drop((s * t) & 255);
      q._moore26_tick();
      if (settle()) hits++;
      clearIncips();
    }
    const frac = hits / T;
    console.log(`  s=${String(s).padStart(3)}  settle=${(frac * 100).toFixed(1)}%` +
      `${frac > 0.5 ? '  <== RESONANCE' : ''}`);
  }
} else if (MODE === 'trace') {
  const s = parseInt(arg('s', '16'));
  setup(); fill(M);
  const r = M * CAP * ADV / 16;
  console.log(`=== debroglie/trace: m=${M} s=${s} r=${r} ===`);
  for (let t = 0; t < parseInt(arg('t', '40')); t++) {
    const ph = phase();
    drop((s * t) & 255 || 1);
    q._moore26_tick();
    const st = settle() ? 'SETTLE' : '  --  ';
    let armed = 0;
    for (let c = 0; c < 26; c++) armed += q._moore26_incipient_get(S[0], S[1], S[2], c);
    console.log(`t=${String(t).padStart(3)} phi=${String(ph).padStart(4)} nu=${String((s * t) & 255).padStart(4)} ` +
      `d=${Math.abs(ph - ((s * t) & 255))}  ${st} armed=${armed}`);
    clearIncips();
  }
} else if (MODE === 'tax') {
  setup(); fill(M);
  const REF = [4, 4, 4];           /* a quiet reference cell, same lattice */
  const r = M * CAP * ADV / 16;
  console.log(`=== debroglie/tax: m=${M} r=${r} — standing incipients dilate the clock ===`);
  console.log(`t   tau_S  tau_ref  armed_S  armed_ref  phi_S  phi_ref`);
  for (let t = 0; t <= T; t++) {
    if (t % 10 === 0) {
      let armed = 0, armedR = 0;
      for (let c = 0; c < 26; c++) {
        armed += q._moore26_incipient_get(S[0], S[1], S[2], c);
        armedR += q._moore26_incipient_get(REF[0], REF[1], REF[2], c);
      }
      console.log(`${String(t).padStart(3)}  ${String(tau()).padStart(6)}  ` +
        `${String(q._moore26_localtime_get(REF[0], REF[1], REF[2])).padStart(7)}  ` +
        `${String(armed).padStart(6)}  ${String(armedR).padStart(8)}  ` +
        `${String(phase()).padStart(5)}  ${q._moore26_phase_get(REF[0], REF[1], REF[2])}`);
    }
    /* resonant probe every tick — nu tracks the predicted phase so
     * every offer lands in-window and piles onto the armed cloud */
    drop((r * t) & 255 || 1);
    q._moore26_tick();
  }
}
