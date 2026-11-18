// pair.mjs — does the substrate have an inter-object force at all?
// Two settled composites at contact distance exchange their own
// line photons. Every known channel pushes AWAY: absorption books
// radiation pressure (momentum kick + massFlight along arrival),
// emission recoils opposite the photon. No attractive mass-mass
// coupling exists — mass doesn't feel the packet well.
// Prediction under current mechanics: net REPULSION or nothing.
// Measure: center-of-mass separation drift over 400 ticks.
// A measured repulsion = the mechanism behind the fusion null.
// Run: node script/cascade/pair.mjs [--gap=4] [--ticks=400]
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = 32, AX = 14, AY = 16, AZ = 16;
const GAP = num('gap', 4) | 0;
const TICKS = num('ticks', 400) | 0;
const M = num('m', 200) | 0;
const SETTLE = 45;

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
q._moore26_recoil_law_set(num('recoil', 0) | 0);

const BX = AX + GAP;   // second object GAP cells along +x
for (const [x0] of [[AX], [BX]]) {
  q._moore26_mass_set(x0, AY, AZ, M);
  const wq = Math.max(160, Math.round(M * 0.8));
  for (const [e, w] of [[3, wq], [4, Math.round(wq * 1.5)], [5, wq * 2]]) {
    q._moore26_winding_set(x0, AY, AZ, 2 * e, w);
    q._moore26_winding_set(x0, AY, AZ, 2 * e + 1, w);
  }
}

const heap = () => new Uint8Array(q.wasmMemory.buffer, q._moore26_state_pointer());
const IDX = (x, y, z) => (z * N * N + y * N + x) * NS;

// mass-weighted centroid of each object's neighborhood — the
// drift observable. Radiating composites keep their mass cell;
// net force accumulates as momentum -> massFlight -> drift.
function com(x0) {
  const h = heap();
  let sx = 0, sw = 0, sm = 0, sf = 0, sxF = 0;
  for (let x = x0 - 3; x <= x0 + 3; x++)
    for (let y = AY - 3; y <= AY + 3; y++)
      for (let z = AZ - 3; z <= AZ + 3; z++) {
        if (x < 0 || x >= N || y < 0 || y >= N || z < 0 || z >= N) continue;
        const i = IDX(x, y, z);
        const m = h[i + OFF.mass] | (h[i + OFF.mass + 1] << 8);
        sm += m; sx += m * x;
        let f = 0;
        for (let c = 6; c < 18; c++) f += h[i + OFF.massFlight + c] | (h[i + OFF.massFlight + c + 1] << 8);
        sf += f; sxF += f * x;
      }
  // the mass cell's signed momentum per pair — the pre-flight
  // force register. Report whichever pairs carry nonzero impulse.
  const im = IDX(x0, AY, AZ);
  const hd = new DataView(q.wasmMemory.buffer, q._moore26_state_pointer());
  const pv = [];
  for (let e = 0; e < 13; e++) {
    const p = hd.getInt32(im + OFF.momentum + 4 * e, true);
    if (p) pv.push(`${e}:${p}`);
  }
  return { x: sm ? sx / sm : x0, m: sm, f: sf, xF: sf ? sxF / sf : x0, pv: pv.join(' ') };
}

for (let t = 0; t < SETTLE; t++) q._moore26_tick();
console.log(`pair: A@(${AX},${AY},${AZ}) B@(${BX},${AY},${AZ}) gap=${GAP} M=${M} recoil_law=${num('recoil', 0) | 0}`);
console.log(`settled: gapA=${q._moore26_geo_gap(AX, AY, AZ)} gapB=${q._moore26_geo_gap(BX, AY, AZ)}`);
const a0 = com(AX), b0 = com(BX);
console.log(`t=0: A.com.x=${a0.x.toFixed(2)} (m=${a0.m},flight=${a0.f})  B.com.x=${b0.x.toFixed(2)} (m=${b0.m},flight=${b0.f})`);

for (let t = 0; t < TICKS; t++) {
  q._moore26_tick();
  if ((t + 1) % 50 === 0) {
    const a = com(AX), b = com(BX);
    console.log(`t=${t + 1}: A.com.x=${a.x.toFixed(2)} (m=${a.m},f=${a.f},p=${a.pv})  B.com.x=${b.x.toFixed(2)} (m=${b.m},f=${b.f},p=${b.pv})  sep=${(b.x - a.x).toFixed(2)}`);
  }
}
console.log(`ev4(emit)=${ev(q, 4)} ev16(absorb E)=${ev(q, 16)} ev7(tax)=${ev(q, 7)} ev62(recoil)=${ev(q, 62)}`);
