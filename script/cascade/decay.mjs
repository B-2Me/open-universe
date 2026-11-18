// decay.mjs — the metastable-state measurement: does anything in the
// substrate STORE excitation and release it later? At 0.1-10fm a
// lifetime is THE discriminator — physicists classify states by how
// long they hold energy (resonance widths, isomer lifetimes).
//
// Protocol:
//   1. settle an M=200 composite (line ~= 34, measured live)
//   2. BASELINE window: record the object's spontaneous line rate
//   3. EXCITE: a burst of probes — --nu sets them OFF-shell
//      (nu != line => armed modes must cascade rung-by-rung) or
//      --resonant fires AT the line (stimulated-emission channel:
//      1 in -> 2 out if the laser bookkeeping funds it)
//   4. CUT: beam off; detector shell logs every crossing for the
//      tail — species, angle, tick. A delayed nu=line tail decaying
//      over ticks IS a measured lifetime.
//
// Report: spontaneous rate, in-window counts, post-beam tail binned
// per 10t with a fitted decay constant, armed-mode census.
// Run: node script/cascade/decay.mjs [--nu=90] [--resonant] [--probes=24]
import { loadM26, initM26, nodeOff, ev } from '../lib/m26.mjs';
import { opts, loadConfig } from '../lib/p3.mjs';
const { opt, num } = opts(loadConfig());
const N = 32, TX = 10, TY = 16, TZ = 16;
const M = num('m', 200) | 0;
const SETTLE = num('settle', 45) | 0;
const NPROBES = num('probes', 24) | 0;
const RES = opt('resonant');
const R0 = 8, R1 = 10;
const BX = 1, BY = 1, BZ = 0;
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
q._moore26_rung_shift_set(num('rung', 1) | 0);
q._moore26_incip_ttl_set(120);
q._moore26_mode_ledger_set(opt('nomodes') ? 0 : 1);
q._moore26_recoil_law_set(num('recoil', 4) | 0);

q._moore26_mass_set(TX, TY, TZ, M);
const wq = Math.max(160, Math.round(M * 0.8));
for (const [e, w] of [[3, wq], [4, Math.round(wq * 1.5)], [5, wq * 2]]) {
  q._moore26_winding_set(TX, TY, TZ, 2 * e, w);
  q._moore26_winding_set(TX, TY, TZ, 2 * e + 1, w);
}
for (let t = 0; t < SETTLE; t++) q._moore26_tick();
const LINE = q._moore26_geo_gap(TX, TY, TZ);
const NU = RES ? LINE : (num('nu', 90) | 0);

// --seed=N: bypass the beam entirely — write N armed off-shell modes
// onto odd cells of the object's surface (incip + incipNu via raw
// registers). The metastable population is authored; the detector
// then measures what the substrate DOES with stored excitation.
const SEED = num('seed', 0) | 0;
if (SEED) {
  const h = heap();
  let placed = 0;
  const RMIN = num('rmin', 0) | 0, RMAX = num('rmax', 2) | 0;
  for (let dx = -RMAX; dx <= RMAX && placed < SEED; dx++)
    for (let dy = -RMAX; dy <= RMAX && placed < SEED; dy++)
      for (let dz = -RMAX; dz <= RMAX && placed < SEED; dz++) {
        const rr = Math.hypot(dx, dy, dz);
        if (rr < RMIN || rr > RMAX) continue;
        const x = TX + dx, y = TY + dy, z = TZ + dz;
        // --even seeds on the transport sublattice: radiated decay
        // products are born on cells that MOVE packets. Odd-cell
        // modes radiate stillborn packets that sit until pulled —
        // the self-shielding may be parity-structural, not opacity.
        const par = ((x + y + z) & 1) === (opt('even') ? 0 : 1);
        if (!par || !dx && !dy && !dz) continue;
        const i = IDX(x, y, z);
        const c = 6 + (((placed * 5 + dx * 3 + dy * 7) % 12) + 12) % 12;
        // a winding stub makes the mode OFF-SHELL: local line =
        // (mass + winding>>2)>>2 = 4, and 90%4=2 — the confirm gate
        // refuses it, so the mode must stand, cascade, or expire.
        h[i + OFF.winding + 2 * c] = 64;
        h[i + OFF.winding + 2 * (c ^ 1)] = 64;
        h[i + OFF.incip + c] = 120;          // stand ~TTL
        h[i + OFF.incipNu + c] = NU;
        h[i + OFF.incipBorn + c] = 0;
        placed++;
      }
  console.log(`seeded ${placed} off-shell modes at nu=${NU} (local line=${LINE})`);
  // readback sanity — first seeded cell
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    const x = TX + dx, y = TY + dy, z = TZ + dz;
    if (((x + y + z) & 1) !== (opt('even') ? 0 : 1) || (!dx && !dy && !dz)) continue;
    const i = IDX(x, y, z);
    let s = 0;
    for (let c = 6; c < 18; c++) s += h[i + OFF.incip + c];
    console.log(`  readback (${x},${y},${z}): incip total=${s}`);
    dx = 9; dy = 9; dz = 9;
  }
  // the tick's per-node base copy (grid_next = grid_current) carries
  // the seed forward — no second-arena write needed.
}

// schedule: baseline 0..29, beam 30..30+NPROBES*4 (dense burst),
// tail after lastFire. jitter inside the burst decorrelates rolls.
const T_BEAM0 = 30, fired = new Set();
for (let k = 0; k < NPROBES; k++) fired.add(T_BEAM0 + k * 4 + (k * 7 % 3));
const lastFire = fired.size ? Math.max(...fired) : T_BEAM0;
const T_END = lastFire + num('tail', 160) | 0;

const hits = [];
let prev = new Map();
const armedSeries = [];          // per-tick near-zone stored excitation
for (let t = 0; t < T_END; t++) {
  if (fired.has(t)) {
    q._moore26_packet_set(6, 12, TZ, 6, 1);
    q._moore26_packet_nu_set(6, 12, TZ, 6, NU);
  }
  q._moore26_tick();
  const h = heap();
  // stored-excitation census in the near zone — modes standing on
  // channels, the candidate metastable register. Small scan, per tick.
  {
    let am = 0, ae = 0;
    for (let x = TX - 5; x <= TX + 5; x++) for (let y = TY - 5; y <= TY + 5; y++) for (let z = TZ - 5; z <= TZ + 5; z++) {
      if (x < 0 || x >= N || y < 0 || y >= N || z < 0 || z >= N) continue;
      const i = IDX(x, y, z);
      for (let c = 6; c < 18; c++) {
        const ic = h[i + OFF.incip + c];
        if (ic) { am += ic; ae += ic * (h[i + OFF.incipNu + c] & 0x7f || 1); }
      }
    }
    armedSeries.push({ t, am, ae });
  }
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
      if (prev.get(k) === p) continue;
      const nu = h[i + OFF.packetNu + c] || 1;
      const cos = (dx * BX + dy * BY + dz * BZ) / (r * BL);
      const phi = Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
      hits.push({ t, phi, nu, n: p });
    }
  }
  prev = cur;
}

// stored-excitation trajectory: peak, then decay — if modes stand
// past the beam, their run-down IS the lifetime curve
const peak = armedSeries.reduce((a, s) => s.am > a.am ? s : a, { am: 0 });
console.log(`stored excitation: peak ${peak.am} modes (E~${peak.ae}) at t=${peak.t}`);
const post = armedSeries.filter(s => s.t > lastFire + 5);
const decayBins = {};
for (const s of post) decayBins[Math.floor((s.t - lastFire) / 10) * 10] = (decayBins[Math.floor((s.t - lastFire) / 10) * 10] || 0) + s.am;
const nb = Object.keys(decayBins).length;
if (nb) console.log(`  modes standing per 10t after beam: ${Object.keys(decayBins).sort((a, b) => a - b).map(k => `+${k}:${(decayBins[k] / 10).toFixed(1)}`).join(' ')}`);

// ---- report ----
const onLine = h => Math.abs(h.nu - LINE) <= 2;
const base = hits.filter(h => h.t < T_BEAM0 && onLine(h));
const inBeam = hits.filter(h => h.t >= T_BEAM0 && h.t <= lastFire + 10 && onLine(h));
const tail = hits.filter(h => h.t > lastFire + 10 && onLine(h));
const baseRate = (base.reduce((s, h) => s + h.n, 0) / T_BEAM0).toFixed(2);
console.log(`decay: M=${M} line=${LINE} probe nu=${NU}${RES ? ' (RESONANT)' : ''} mode_ledger=${opt('nomodes') ? 0 : 1} rung=1/${1 << (num('rung', 1) | 0)}`);
console.log(`spontaneous line rate (baseline): ${baseRate} quanta/tick (${base.reduce((s, h) => s + h.n, 0)} in ${T_BEAM0}t)`);
console.log(`beam-window line hits: ${inBeam.reduce((s, h) => s + h.n, 0)}   armed modes end-state`);
const bins = {};
for (const h of tail) bins[Math.floor((h.t - lastFire) / 10) * 10] = (bins[Math.floor((h.t - lastFire) / 10) * 10] || 0) + h.n;
console.log(`post-beam line tail (quanta per 10t after lastFire):`);
console.log(`  ${Object.keys(bins).sort((a, b) => a - b).map(k => `+${k}:${bins[k]}`).join(' ') || '(none)'}`);
// expected baseline in the same window: excess = stored energy released late
const tailT = T_END - lastFire - 10;
const expected = baseRate * tailT;
const excess = tail.reduce((s, h) => s + h.n, 0) - expected;
console.log(`tail total=${tail.reduce((s, h) => s + h.n, 0)} vs spontaneous expectation ${expected.toFixed(0)} -> excess ${excess.toFixed(0)} (stored energy released late)`);
// off-line delayed products (cascade intermediates escaping)
const off = {};
for (const h of hits) if (h.t > lastFire + 10 && !onLine(h)) off[h.nu] = (off[h.nu] || 0) + h.n;
console.log(`off-line delayed spectrum: ${Object.keys(off).sort((a, b) => a - b).map(k => `${k}:${off[k]}`).join(' ') || '(none)'}`);
console.log(`ev66(rung-shed E)=${ev(q, 66)} ev61(shed)=${ev(q, 61)} ev4(emit)=${ev(q, 4)} ev7(tax)=${ev(q, 7)}`);
