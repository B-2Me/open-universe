// detect.mjs — fm-scale measurement the way physicists actually do it.
// Nobody watches the vertex: detectors sit far from the interaction
// and record RATES — what species, what energy, what angle, WHEN.
// All interaction reconstruction is inference on asymptotic products.
//
// Apparatus:
//   beam   — single probes on ch6 at irregular intervals (jittered
//            launch ticks decorrelate the deterministic rand_site)
//   target — M=200 composite settled into its radiating band
//   DETECTOR — spherical shell at r=[8,10] around the target; every
//            tick, a packet appearing in a shell cell that wasn't
//            occupied last tick is a HIT: {tick, angle, nu, count}.
//            Angle = direction from target vs beam axis (deg).
//
// Deliverables (detector language, not simulator registers):
//   - transmission: forward-hit rate vs beam rate (sigma proxy)
//   - spectrum: nu histogram of what the detector sees, by region
//   - angular distribution: forward / side / backward hit counts
//   - TIME STRUCTURE: prompt hits during beam transit vs delayed
//     tail = de-excitation lifetime — how physicists see metastable
//     states, no microscope required
//   - missing energy: beam energy in vs detected energy out
//
// Arms: --blank (vacuum), default (object), --lens (object +
//       eikonal well + hard core: the FORCED target — does a
//       mass-sourced field change what the detector measures?)
// Run: node script/cascade/detect.mjs [--lens] [--blank] [--probes=30]
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = 32, TX = 10, TY = 16, TZ = 16;
const M = num('m', 200) | 0;
const SETTLE = num('settle', 45) | 0;
const NPROBES = num('probes', 24) | 0;
const PERIOD = 9;                    // mean probe spacing (ticks)
const NU = num('nu', 34) | 0;
const BLANK = opt('blank'), LENS = opt('lens');
const R0 = 8, R1 = 10;               // detector shell radii
const BX = 1, BY = 1, BZ = 0;        // beam axis (ch6 direction)
const BL = Math.hypot(BX, BY, BZ);

const q = await loadM26();
const OFF = nodeOff(q);
let NS = 0;
const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), NS * N * N * N);
const IDX = (x, y, z) => (z * N * N + y * N + x) * NS;

initM26(q, N, N, N);
NS = q._moore26_node_size();
q._moore26_reflect_set(255);
q._moore26_res_emit_set(1);
q._moore26_vac_rate_set(0);
q._moore26_rung_shift_set(1);
q._moore26_incip_ttl_set(120);
q._moore26_mode_ledger_set(1);
if (!BLANK) {
  q._moore26_mass_set(TX, TY, TZ, M);
  // winding scaled to the mass band: lw = 2*sum(w) in (4M, 8M)
  const wq = Math.max(160, Math.round(M * 0.8));
  for (const [e, w] of [[3, wq], [4, Math.round(wq * 1.5)], [5, wq * 2]]) {
    q._moore26_winding_set(TX, TY, TZ, 2 * e, w);
    q._moore26_winding_set(TX, TY, TZ, 2 * e + 1, w);
  }
  if (LENS) {
    // hop sets the field range ~ mass/hop cells — for M=200, hop=32
    // gives a ~6-cell reach; the core floor excludes nothing unless
    // the well exceeds it (M=200 never does at these hops — bare
    // attraction only, no hard core).
    q._moore26_wellmode_set(1, num('hop', 32) | 0);
    q._moore26_lens_set(num('lensv', 255) | 0);
    if (num('core', 0)) q._moore26_core_set(num('core', 0) | 0);
  }
}
for (let t = 0; t < SETTLE + (LENS ? 30 : 0); t++) q._moore26_tick();
if (LENS) {
  let prof = [];
  for (const r of [0, 2, 4, 6, 8]) prof.push(`${r}:${q._moore26_well_get(TX + r, TY, TZ)}`);
  console.log(`well profile (r:well): ${prof.join(' ')}`);
}

// beam schedule: probe k fires at k*PERIOD + jitter(k) — irregular
// spacing decorrelates rand_site without a seeded RNG
const fired = new Set();
for (let k = 0; k < NPROBES; k++) fired.add(k * PERIOD + (k * 7 % 5));
const T_END = NPROBES * PERIOD + 40;   // + tail for delayed products

// detector hit log
const hits = [];                     // {t, phi, nu, n}
let prev = new Map();                // "x,y,z,c" -> packet count
const beamE_in = NPROBES * NU;
let detE = 0;

for (let t = 0; t < T_END; t++) {
  if (fired.has(t)) {
    q._moore26_packet_set(6, 12, TZ, 6, 1);
    q._moore26_packet_nu_set(6, 12, TZ, 6, NU);
  }
  q._moore26_tick();
  const h = heap();
  const cur = new Map();
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    const dx = x - TX, dy = y - TY, dz = z - TZ;
    const r = Math.hypot(dx, dy, dz);
    if (r < R0 || r > R1) continue;
    const i = IDX(x, y, z);
    for (let c = 6; c < 18; c++) {
      const p = h[i + OFF.packet + c];
      if (!p) continue;
      const k = `${x},${y},${z},${c}`;
      cur.set(k, p);
      if (prev.get(k) === p) continue;   // same packet still crossing
      const nu = h[i + OFF.packetNu + c] || 1;
      const cos = (dx * BX + dy * BY + dz * BZ) / (r * BL);
      const phi = Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
      hits.push({ t, phi, nu, n: p });
      detE += p * nu;
    }
  }
  prev = cur;
}

// ---- report, detector language ----
const region = phi => phi < 60 ? 'fwd' : phi < 120 ? 'side' : 'back';
const lastFire = Math.max(...fired);
const probeT = t => t <= lastFire + 30;   // delayed = hits after the
                                         // last probe's transit+dwell
const sum = sel => hits.filter(sel).reduce((s, h) => s + h.n, 0);
const sumE = sel => hits.filter(sel).reduce((s, h) => s + h.n * h.nu, 0);
const rate = n => (n / (T_END / PERIOD)).toFixed(2);   // per probe fired

console.log(`detect: ${BLANK ? 'VACUUM' : LENS ? 'OBJECT+LENS' : 'OBJECT'} M=${M} probes=${NPROBES}@nu=${NU}`);
console.log(`hits=${hits.length}  detE=${detE} vs beamE=${beamE_in}  missingE=${beamE_in - detE}`);
console.log(`fwd hits=${sum(h => region(h.phi) === 'fwd')} (E=${sumE(h => region(h.phi) === 'fwd')})` +
  `  side=${sum(h => region(h.phi) === 'side')} (E=${sumE(h => region(h.phi) === 'side')})` +
  `  back=${sum(h => region(h.phi) === 'back')} (E=${sumE(h => region(h.phi) === 'back')})`);
console.log(`prompt hits=${sum(h => probeT(h.t))}  delayed hits=${sum(h => !probeT(h.t))}  delayed-rate=${rate(sum(h => !probeT(h.t)))}/probe`);
// nu spectrum of detected products (beam nu excluded for clarity)
const sp = {};
for (const h of hits) if (Math.abs(h.nu - NU) > NU * 0.4) sp[h.nu] = (sp[h.nu] || 0) + h.n;
const spk = Object.keys(sp).map(Number).sort((a, b) => a - b);
console.log(`off-beam-nu spectrum: ${spk.filter(k => sp[k] >= 2).map(k => `${k}:${sp[k]}`).join(' ') || '(none)'}`);
// delayed-emission time series in 10-tick bins (the de-excitation tail)
const tail = {};
for (const h of hits) if (h.t >= 30) tail[Math.floor(h.t / 10) * 10] = (tail[Math.floor(h.t / 10) * 10] || 0) + h.n;
console.log(`hits per 10t bin: ${Object.keys(tail).sort((a, b) => a - b).map(k => `${k}:${tail[k]}`).join(' ')}`);
console.log(`ev68(lens bends)=${ev(q, 68)} ev7(tax)=${ev(q, 7)} ev51(minted)=${ev(q, 51)}`);
