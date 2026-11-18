// push.mjs — the inertia measurement: does volumetric momentum
// transport work end-to-end?
//
// Chain: absorbed quantum kicks momentum[pair] on the CATCH cell ->
// bond-share (conserved, 1 committed bond/tick) pools the impulse
// across the object's web -> the march relay moves mass toward the
// frontier AND hands the momentum forward (impulse rides the body).
//
// Without bond-share, a surface kick stays on the (massless) halo
// cell that caught it: the bulk never hears — the object can be hit
// forever without moving. That is the "momentum doesn't move at
// volume" bug: transport exists, defaults off, never validated.
//
// Observable: a sustained beam pushes ONE settled object. We log
// mass-centroid drift and the pooled-momentum field. If the chain
// works: centroid translates downstream, momentum spreads off the
// catch cells into the body, and v = p_delivered / M_eff lets us
// READ AN INERTIAL MASS — then compare M_eff to the mass register.
//
// Arms: --share=N (bond-shift), --recoil=N (funded kick nu>>N),
//       --drive=nu, --beam=count, --m=mass
// Run: node script/cascade/push.mjs --share=4 --recoil=4
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = 32, TX = 10, TY = 16, TZ = 16;
const M = num('m', 200) | 0;
const SETTLE = 45;
const NU = num('drive', 34) | 0;
const NBEAM = num('beam', 120) | 0;
const T_END = num('ticks', 500) | 0;

const q = await loadM26();
const OFF = nodeOff(q);
initM26(q, N, N, N);
const NS = q._moore26_node_size();
q._moore26_reflect_set(255);
q._moore26_res_emit_set(1);
q._moore26_vac_rate_set(0);
q._moore26_rung_shift_set(1);
q._moore26_incip_ttl_set(120);
q._moore26_mode_ledger_set(1);
q._moore26_recoil_law_set(num('recoil', 4) | 0);
q._moore26_bond_share_set(num('share', 4) | 0);
q._moore26_momentum_set(num('mom', 255) | 0);

q._moore26_mass_set(TX, TY, TZ, M);
const wq = Math.max(160, Math.round(M * 0.8));
for (const [e, w] of [[3, wq], [4, Math.round(wq * 1.5)], [5, wq * 2]]) {
  q._moore26_winding_set(TX, TY, TZ, 2 * e, w);
  q._moore26_winding_set(TX, TY, TZ, 2 * e + 1, w);
}
for (let t = 0; t < SETTLE; t++) q._moore26_tick();

const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer());
const IDX = (x, y, z) => (z * N * N + y * N + x) * NS;
const hd = () => new DataView(q.wasmMemory.buffer, q._moore26_state_pointer());

// object census: mass centroid, total mass, and the pooled-momentum
// map — how many body cells carry nonzero p, and the net vector.
function census() {
  const h = heap(), d = hd();
  let sm = 0, sx = 0, np = 0, net = [0, 0, 0];
  for (let x = TX - 6; x <= TX + 14; x++)
    for (let y = TY - 6; y <= TY + 6; y++)
      for (let z = TZ - 6; z <= TZ + 6; z++) {
        if (x < 0 || x >= N || y < 0 || y >= N || z < 0 || z >= N) continue;
        const i = IDX(x, y, z);
        const m = h[i + OFF.mass] | (h[i + OFF.mass + 1] << 8);
        sm += m; sx += m * x;
        // net momentum: project each pair's signed p onto its axis set
        let any = 0;
        for (let e = 0; e < 13; e++) {
          const p = d.getInt32(i + OFF.momentum + 4 * e, true);
          if (p) any = 1;
          // pair e axis = QChannelVec[2e] direction vector
          const v = CVEC[2 * e];
          net[0] += p * v[0]; net[1] += p * v[1]; net[2] += p * v[2];
        }
        np += any;
      }
  return { x: sm ? sx / sm : TX, m: sm, np, net };
}
// FCC channel vectors mirrored from the engine for the p projection
const CVEC = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 0, 1], [-1, 0, -1],
  [1, 0, -1], [-1, 0, 1], [0, 1, 1], [0, -1, -1], [0, 1, -1], [0, -1, 1],
  [1, 1, 1], [-1, -1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, -1],
  [1, -1, -1], [-1, 1, 1],
];

// beam: fire along ch6 (1,1,0) from (6,12,16) — reaches (10,16,16)
// after ~5-6 hops. Jittered schedule for decorrelated rolls.
const fired = new Set();
for (let k = 0; k < NBEAM; k++) fired.add(10 + k * 3 + (k * 7 % 3));
const lastFire = Math.max(...fired);

console.log(`push: M=${M} object, beam=${NBEAM}@nu=${NU} on ch6, share=1/${1 << (num('share', 4) | 0)}, recoil_law=${num('recoil', 4) | 0}`);
const c0 = census();
console.log(`t=0: com.x=${c0.x.toFixed(2)} mass=${c0.m} p-cells=${c0.np}`);

let kicks = 0;
for (let t = 0; t < T_END; t++) {
  if (fired.has(t)) {
    q._moore26_packet_set(6, 12, TZ, 6, 1);
    q._moore26_packet_nu_set(6, 12, TZ, 6, NU);
    kicks += Math.max(1, NU >> (num('recoil', 4) | 0));
  }
  q._moore26_tick();
  if ((t + 1) % 50 === 0) {
    const c = census();
    console.log(`t=${t + 1}: com.x=${c.x.toFixed(2)} mass=${c.m} p-cells=${c.np} netP=(${c.net.map(v => v | 0)})`);
  }
}
const cf = census();
const pIn = kicks;                       // booked impulse units in
const drift = cf.x - c0.x;
const vEst = drift / T_END;
console.log(`injected impulse ~${pIn} (beam-quantum kicks, funded)`);
console.log(`drift=${drift.toFixed(2)} links over ${T_END}t -> v=${vEst.toExponential(2)} links/tick`);
if (vEst > 0) console.log(`M_eff ~ p/v = ${(pIn / vEst).toFixed(0)} vs mass register ${cf.m}`);
console.log(`ev16(abs E)=${ev(q, 16)} ev7(tax)=${ev(q, 7)} ev62=${ev(q, 62)} ev58=${ev(q, 58)}`);
