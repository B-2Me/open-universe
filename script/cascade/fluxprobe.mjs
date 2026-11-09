// fluxprobe.mjs — the flux probe probe.mjs missed.
// probe.mjs sampled state registers (winding/dd/phase/mass) and found
// the knot flat. But NodeState also carries the FLUX registers:
//   packet[26]  in-flight offers (hop 1 node/tick, Phase 1)
//   incip[26]   armed negotiations (Phase 2 offer->confirm handshake)
//   ack[26]     returning confirms (round-trip completions)
//   massFlight  in-flight mass quanta
//   chargeFlight charge riding the mass flight
// Flux through the surface would move THESE while leaving the state
// registers flat. This harness bulk-reads NodeState via
// moore26_state_pointer() (no per-getter call overhead) and records
// per-site flux time series + a global transaction ledger.
//
// Phases: warm 600t fed -> FED probe 256t -> UNFED probe 256t.
// ACF on the flux series: a periodic peak = a real circulation clock;
// flat/zero = no flux at that site at all.
import { loadM26, rng } from '../lib/m26.mjs';

const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);

// ---- NodeState field offsets (src/moore26.c typedef, little-endian) --
const OFF = {
  winding: 0, massFlight: 52,          // u16[26] each
  packet: 104, packetNu: 130, incip: 156, incipNu: 182,
  incipBorn: 208, packetBorn: 234, packetPar: 260, incipPar: 286,
  ack: 312, ackTtl: 338, ackRtt: 364, bondDist: 390,
  chargeFlight: 403,                    // i8[26]
  phase: 432, mass: 436, charge: 438, heat: 440, localDensity: 442,
};
const nodeSize = q._moore26_node_size();
if (nodeSize < 444) { console.error(`node_size=${nodeSize} < expected 444 — struct layout drifted`); process.exit(1); }

const idx = (x, y, z) => (z * N * N + y * N + x);
const state8 = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer(), nodeSize * N * N * N);
const dv = (x, y, z) => {
  const b = state8(), i = idx(x, y, z) * nodeSize;
  return {
    u16: (o) => b[i + o] | (b[i + o + 1] << 8),
    u8: (o) => b[i + o],
    i8: (o) => (b[i + o] << 24) >> 24,
    u32: (o) => (b[i + o] | (b[i + o + 1] << 8) | (b[i + o + 2] << 16) | (b[i + o + 3] << 24)) >>> 0,
    i16: (o) => (b[i + o] | (b[i + o + 1] << 8)) << 16 >> 16,
  };
};
// self-check: bulk reads must agree with the C getters
{
  const d = dv(16, 16, 16);
  const okM = d.u16(OFF.mass) === Number(q._moore26_mass_get(16, 16, 16));
  const okP = d.u32(OFF.phase) === Number(q._moore26_phase_get(16, 16, 16));
  const okPk = d.u8(OFF.packet + 6) === Number(q._moore26_packet_get(16, 16, 16, 6));
  const okW = d.u16(OFF.winding + 12) === Number(q._moore26_winding_get(16, 16, 16, 6));
  if (!(okM && okP && okPk && okW)) {
    console.error(`struct offset self-check FAILED m=${okM} ph=${okP} pk=${okPk} w=${okW}`);
    process.exit(1);
  }
}

// ---- same knot seed as probe.mjs ----
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
  q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
  q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
}
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };

// ---- probe sites: 13..19^3 even parity (7^3 -> ~171 sites) ----
const sites = [];
for (let x = 13; x <= 19; x++) for (let y = 13; y <= 19; y++) for (let z = 13; z <= 19; z++)
  if (((x + y + z) & 1) === 0) sites.push([x, y, z]);

// per-site flux series: [pkt, incip, ack, fly(massFlight), w] per tick
const FLUX = () => sites.map(() => []);
const series = FLUX();
const ledger = [];   // global sums per tick

function sample() {
  sites.forEach(([x, y, z], i) => {
    const d = dv(x, y, z);
    let pkt = 0, inc = 0, ack = 0, fly = 0, w = 0;
    for (let c = 0; c < 26; c++) {
      pkt += d.u8(OFF.packet + c);
      inc += d.u8(OFF.incip + c);
      ack += d.u8(OFF.ack + c);
      fly += d.u16(OFF.massFlight + 2 * c);
      w += d.u16(OFF.winding + 2 * c);
    }
    series[i].push([pkt, inc, ack, fly, w]);
  });
  ledger.push([
    Number(q._moore26_sum(2)),   // total packets
    Number(q._moore26_sum(5)),   // incipient energy
    Number(q._moore26_sum(6)),   // massFlight total
    Number(q._moore26_sum(8)),   // packet*nu (flux energy)
    Number(q._moore26_events(4)),// emissions
    Number(q._moore26_events(43)),// evaporations
    Number(q._moore26_events(28)),// congestion refusals
    Number(q._moore26_events(14)),// bondDist/RTT updates
  ]);
}

const acf = (s) => {
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  const v = s.reduce((a, b) => a + (b - m) ** 2, 0);
  if (!v) return null;
  const out = [];
  for (let k = 1; k <= 16; k++) {
    let c = 0;
    for (let i = 0; i < s.length - k; i++) c += (s[i] - m) * (s[i + k] - m);
    out.push((c / v).toFixed(2));
  }
  return { var: (v / s.length).toFixed(2), acf: out.slice(0, 8).join(' ') };
};

function report(tag, t0) {
  console.log(`\n=== ${tag} (ticks ${t0}..${t0 + series[0].length}) ===`);
  // global ledger summary: first/last + deltas of event counters
  const L = ledger.slice(-series[0].length);
  const f = L[0], l = L[L.length - 1];
  console.log(`ledger pkt ${f[0]}->${l[0]} | incE ${f[1]}->${l[1]} | fly ${f[2]}->${l[2]} | pktE ${f[3]}->${l[3]}`);
  console.log(`events  emit +${l[4] - f[4]} | evap +${l[5] - f[5]} | refuse +${l[6] - f[6]} | rtt +${l[7] - f[7]}`);
  // per-site activity: any flux register with variance
  let act = 0, rows = [];
  sites.forEach(([x, y, z], i) => {
    const cols = [0, 1, 2, 3, 4].map(k => acf(series[i].map(r => r[k])));
    const anyVar = cols.some(c => c && +c.var > 0.5);
    const anyNz = series[i].some(r => r[0] + r[1] + r[2] + r[3] > 0);
    if (anyVar || anyNz) {
      act++;
      rows.push({ x, y, z, cols });
    }
  });
  console.log(`sites with flux activity: ${act} / ${sites.length}`);
  rows.slice(0, 15).forEach(r => {
    const f = (c, k) => c ? `${c.var}[${c.acf}]` : 'flat';
    console.log(` (${r.x},${r.y},${r.z}) pkt=${f(r.cols[0])} inc=${f(r.cols[1])} ack=${f(r.cols[2])} fly=${f(r.cols[3])} w=${f(r.cols[4])}`);
  });
}

// ---- run: warm fed, then fed probe, then unfed probe ----
const WARM = 600, PROBE = 256;
console.log(`fluxprobe: ${N}^3 knot seed, warm ${WARM}t fed`);
for (let t = 0; t < WARM; t++) { feed(); q._moore26_tick(); }
for (let t = 0; t < PROBE; t++) { feed(); q._moore26_tick(); sample(); }
report('FED', WARM);
for (let t = 0; t < PROBE; t++) { q._moore26_tick(); sample(); }
report('UNFED', WARM + PROBE);
