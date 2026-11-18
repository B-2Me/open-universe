// spectro.mjs — emission spectroscopy on authored bound structures.
// The fm-scale question: can the substrate read a bound object's
// internal state from its emitted spectrum? Engine law (Phase 6):
//   a site with committed volume >=128 sheds rungs of its weakest
//   committed edge; with qResEmit the packet nu = geo_gap(node)
//   = (min_committed_winding>>2) * 2 / L^2, where L^2 = bondDist^2
//   or the lattice edgeLen2. For edge pairs (channels 6-17, len^2=2)
//   that reduces to line = min_w>>2 — an authored winding w emits at
//   nu = w/4. This harness seeds KNOWN committed structure, predicts
//   the line from raw registers, and checks the emitted spectrum —
//   a structure->spectrum prediction test, then species
//   discrimination (two sources, two lines) and rung-walking
//   (line evolution as the structure unwinds).
// Run: node script/cascade/spectro.mjs [--n=32] [--w1=256] [--w2=0]
//      [--m1=4000] [--m2=4000] [--h=0] [--t=240] [--two] [--walk]
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = num('n', 32) | 0, CX = N >> 1;
const W1 = num('w1', 256) | 0, W2 = num('w2', 0) | 0;   // seeded pair windings
const M1 = num('m1', 4000) | 0, M2 = num('m2', 4000) | 0;
const H = num('h', 0) | 0;                            // optional heat bath
const T = num('t', 240) | 0, SAMPLE = num('s', 20) | 0;
const TWO = opt('two'), WALK = opt('walk');

const q = await loadM26();
initM26(q, N, N, N);
const OFF = nodeOff(q), NS = q._moore26_node_size();
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), NS * N * N * N);
const idx = (x, y, z) => (z * N * N + y * N + x);
const bondDist = (x, y, z, e) => heap()[idx(x, y, z) * NS + OFF.bondDist + e];
q._moore26_reflect_set(255);
q._moore26_res_emit_set(1);          // emitted nu = the emitter's geo_gap
q._moore26_vac_rate_set(0);          // no thermal re-mint — pure structure emission

// edge channel vectors for flight census + edgeLen2 for the L2 fallback
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const EL2 = c => CV[c] ? 2 : (c < 6 ? 1 : 3);

// authored source: mass + committed winding pairs at (x,y,z)
const seed = (x, y, z, mass, windings) => {
  q._moore26_mass_set(x, y, z, mass);
  for (const [e, w] of windings) {       // e = edge index 0..12
    q._moore26_winding_set(x, y, z, 2 * e, w);
    q._moore26_winding_set(x, y, z, 2 * e + 1, w);
  }
};
// geo_gap prediction straight from live registers — the same law the
// engine applies: weakest committed edge, (m>>2)*2/L^2.
const predictGap = (x, y, z) => {
  let bm = 0, be = -1;
  for (let e = 0; e < 13; e++) {
    const a = Number(q._moore26_winding_get(x, y, z, 2 * e));
    const b = Number(q._moore26_winding_get(x, y, z, 2 * e + 1));
    const m = Math.min(a, b);
    if (m >= 32 && (be < 0 || m < bm)) { bm = m; be = e; }
  }
  if (be < 0) return { line: 0, be: -1, bm: 0 };
  const bd = bondDist(x, y, z, be);
  const L2 = bd ? bd * bd : EL2(2 * be);
  return { line: Math.max(1, Math.min(255, ((bm >> 2) * 2 / L2) | 0)), be, bm, L2 };
};

// seeded structures: source A at CX-6, source B at CX+6 (or A alone)
seed(CX - 6, CX, CX, M1, [[3, W1], [4, W1 + 96], [5, W1 + 192]]);
if (TWO) seed(CX + 6, CX, CX, M2, [[3, W2 || 512], [4, (W2 || 512) + 96], [5, (W2 || 512) + 192]]);
const sources = [[CX - 6], ...(TWO ? [[CX + 6]] : [])];

// emitted-spectrum census: packets in flight on edge channels, r>=3
// from each source — they escaped the emitter. Emitted packets are
// PHOTONS: energy lives in packetNu, packet[] is a count — weight by
// count*nu. Emission is sparse (~0.1/tick) so sample every tick.
const emitted = {}, emittedQ = {};
const census = () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    let rmin = 1e9;
    for (const [sx] of sources) {
      const r = Math.hypot(x - sx, y - CX, z - CX);
      if (r < rmin) rmin = r;
    }
    if (rmin < 3) continue;
    for (let c = 6; c < 18; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      const nu = Number(q._moore26_packet_nu_get(x, y, z, c));
      if (p > 0 && nu > 0) { emitted[nu] = (emitted[nu] || 0) + p; emittedQ[nu] = (emittedQ[nu] || 0) + p * nu; }
    }
  }
};

const pred = s => {
  const p = predictGap(s[0], CX, CX);
  return `line=${p.line}(w=${p.bm},e=${p.be},L2=${p.L2})`;
};
console.log(`spectro: N=${N} w1=${W1} ${TWO ? 'w2=' + (W2 || 512) : ''} res_emit=1`);
console.log(`t=0 pred-A ${pred(sources[0])}${TWO ? ' pred-B ' + pred(sources[1]) : ''}`);

for (let t = 0; t < T; t++) {
  for (const [sx] of sources) q._moore26_heat_set(sx, CX, CX, H);
  q._moore26_tick();
  census();
  if (WALK && t % 40 === 39) {
    // per-window fresh spectrum — the line at emission time
    const win = {};
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
      let rmin = 1e9;
      for (const [sx] of sources) rmin = Math.min(rmin, Math.hypot(x - sx, y - CX, z - CX));
      if (rmin < 3) continue;
      for (let c = 6; c < 18; c++) {
        const p = Number(q._moore26_packet_get(x, y, z, c));
        const nu = Number(q._moore26_packet_nu_get(x, y, z, c));
        if (p > 0 && nu > 0) win[nu] = (win[nu] || 0) + p;
      }
    }
    const wh = Object.keys(win).sort((a, b) => a - b).map(k => `${k}:${win[k]}`).join(' ');
    console.log(`t=${t + 1} pred-A ${pred(sources[0])}${TWO ? ' pred-B ' + pred(sources[1]) : ''}  in-flight-now: ${wh || '(none)'}`);
  }
}
if (!WALK) {
  const keys = Object.keys(emitted).map(Number).sort((a, b) => a - b);
  const hist = keys.filter(k => emitted[k] >= 3).map(k => `${k}:${emitted[k]}(E${emittedQ[k]})`).join(' ');
  console.log(`final pred-A ${pred(sources[0])}${TWO ? ' pred-B ' + pred(sources[1]) : ''}`);
  console.log(`emitted spectrum (count:E-by-nu): ${hist || '(empty)'}`);
} else {
  const keys = Object.keys(emitted).map(Number).sort((a, b) => emitted[b] - emitted[a]);
  console.log(`emitted top: ${keys.slice(0, 8).map(k => `${k}:${emitted[k]}`).join(' ')}`);
}
console.log(`ledger: packets=${q._moore26_packet_total()} incip=${q._moore26_incip_total()} ` +
  `ev28(density-refuse)=${ev(q, 28)} ev29(condense)=${ev(q, 29)} ev42(evap-wind)=${ev(q, 42)} ` +
  `ev43(mass-evap)=${ev(q, 43)} ev51(minted-nu)=${ev(q, 51)} ev52(heat)=${ev(q, 52)}`);
