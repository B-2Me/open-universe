#!/usr/bin/env node
/*
 * quench.mjs — quadrature budget probe for planck3.wasm.
 *
 * Tests the capacity-stealing claim C_max² = C_s² + C_i² : as a node's
 * spatial routing load r saturates, its thermal relaxation (BWF_LUT
 * cooling) is choked toward zero. If true, an identical heat deposit
 * decays slower inside a heavily-routed channel than in vacuum.
 *
 * Protocol per load level:
 *   1. Sustain a quanta channel along +x for WARM ticks so routing load
 *      reaches steady state (volume top-up every channel cell per tick,
 *      symmetric subtraction on the x=w-1 face).
 *   2. Paint +H0 heat onto two probe windows: A inside the beam
 *      channel, B displaced laterally off-beam (control).
 *   3. Measure per-tick mean heat in each window for MEAS ticks.
 *
 * Regime notes (planck3.c constants):
 *   - Cooling is (1 + ts²)·diss·BWF[routing], ts = h/200 — QUADRATIC.
 *     Keep h0 ≲ 400 or the deposit evaporates in a couple of ticks.
 *   - BWF[r] = 256·√(1 − (r/440)²): suppression only becomes visible
 *     as channel routing → 440. Weak beams show ~zero effect by design.
 *   - The beam generates its own friction heat; the deposit is measured
 *     as EXCESS over a baseline trajectory fitted from the warm phase.
 *
 * Prediction: A's decay flattens with injected load (milestones stretch);
 * B stays at the unloaded baseline in every run (internal control).
 *
 *   node script/quench.mjs --levels=0,4,16,64 --warm=100 --meas=300
 *   node script/quench.mjs --config=config/quench.json
 *
 * Config keys (CLI overrides): dims [w,h,d], warm, warm_max, meas, h0,
 * levels[], load ('buffer'|'beam'), beam_hw (channel half-width), gap
 * (control-window offset), diss/limit/mode, vtk_interval.
 *
 * load=beam (default): sustained quanta channel along +x through probe A
 *   (source zone x<w/4, sink at x=w-1). routing = incoming+mag+shunt+cb
 *   is fed by REAL arrivals — the honest spatial-transport load. Beams
 *   spread laterally (~deplete over 15+ cells) so probe A sits just
 *   downstream of the source zone where the channel is still dense.
 * load=buffer: probe-A cells get buffer topped to `level` each tick.
 *   NEGATIVE CONTROL — the kernel absorbs buffer→quanta, and parked
 *   quanta (spin=0) generate nq2·15 heat WITHOUT entering routing. So
 *   this is "energy-dense but unrouted": a hot probe whose BWF is NOT
 *   choked. If its deposit still decays at baseline speed while the
 *   beam case stalls, that isolates routing-load vs mere heat.
 *
 * Register layout (Node3, 6B): u8 quanta @0, u8 spin @1, u16le heat @2,
 * u8 buffer @4, u8 tension @5 — same as boost.mjs/collide.mjs.
 * Results → logs/quench-l<level>.json + logs/quench-results.json.
 * Heartbeat → logs/quench-status.json.
 */
import { createRequire } from 'node:module';
import { writeVtkFrame } from './vtk.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const arg = (k) => {
  const m = process.argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  return m ? (m.includes('=') ? m.split('=')[1] : true) : undefined;
};
const cfgPath = arg('config');
const CFG = cfgPath ? JSON.parse(readFileSync(resolve(ROOT, String(cfgPath)), 'utf8')) : {};
const opt = (k, d) => { const v = arg(k); return v !== undefined ? v : (CFG[k] !== undefined ? CFG[k] : d); };
const num = (k, d) => parseFloat(opt(k, d));

const DIMS = String(opt('dims', '100,100,40')).split(',').map(Number);
const WARM = num('warm', 100), WARM_MAX = num('warm_max', num('warm-max', 4 * WARM));
const MEAS = num('meas', 300);
const H0 = num('h0', 300);                  // keep ≲400: ts=h/200, cooling ∝1+ts²
const LEVELS = String(opt('levels', '0,128,240')).split(',').map(Number);
const LOAD = String(opt('load', 'beam'));
const BEAM_HW = num('beam_hw', 4);            // half-width → (2hw+1)² cross-section
const GAP = num('gap', 24);                   // control window offset in +y
const DISS = num('diss', 15), LIMIT = num('limit', 50000), MODE = num('mode', 0);
const VTK_EVERY = num('vtk-interval', num('vtk_interval', 0));
const WASM_JS = resolve(ROOT, String(opt('wasm', 'docs/public/wasm/loom/planck3.js')));

const [w, h, d] = DIMS, n = w * h * d;
const cx = w >> 1, cy = h >> 1, cz = d >> 1;

// ---------- load engine ----------
if (!existsSync(WASM_JS)) { console.error(`wasm glue not found: ${WASM_JS} — run src/build.sh first`); process.exit(1); }
const glueSrc = readFileSync(WASM_JS, 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  glueSrc)(mod, mod.exports, createRequire(WASM_JS), resolve(WASM_JS, '..'), WASM_JS);
const createPlanck3 = mod.exports;
if (typeof createPlanck3 !== 'function') { console.error('glue did not export createPlanck3'); process.exit(1); }
const wasm = await createPlanck3();
const heap8 = () => new Uint8Array(wasm.wasmMemory.buffer);

const LOGDIR = resolve(ROOT, 'logs');
mkdirSync(LOGDIR, { recursive: true });
const hb = (extra) => writeFileSync(join(LOGDIR, 'quench-status.json'), JSON.stringify({
  ts: Date.now(), ...extra,
}, null, 2));

// ---------- geometry ----------
const idx = (x, y, z) => (z * h + y) * w + x;
// Beam mode: force only a SOURCE ZONE at the channel's head (x < SRC_LEN),
// flow the rest unforced — a volume source along the whole channel
// can't equilibrate (every cell gains upstream flow + its own level →
// monotone saturation). Self-limited by FLOW_CAP=160, the downstream
// channel settles at flux ≈ level → routing ≈ 2·level. Probe A sits
// mid-channel inside the unforced flow; sink cells at x=w-1 absorb.
const SRC_LEN = Math.max(4, w >> 2);
const srcZone = [], sinkWall = [];
if (LOAD === 'beam')
  for (let z = cz - BEAM_HW; z <= cz + BEAM_HW; z++)
    for (let y = cy - BEAM_HW; y <= cy + BEAM_HW; y++) {
      for (let x = 0; x < SRC_LEN; x++) srcZone.push(idx(x, y, z));
      sinkWall.push(idx(w - 1, y, z));
    }

// Probe windows: A inside the channel just downstream of the source
// zone (beam is still collimated there), B offset +GAP in y (control).
const PX = Math.min(w - 8, Math.max(SRC_LEN + 2, num('px', SRC_LEN + 6)));
const probe = (yc) => {
  const cells = [];
  for (let z = cz - BEAM_HW; z <= cz + BEAM_HW; z++)
    for (let y = yc - BEAM_HW; y <= yc + BEAM_HW; y++)
      for (let x = PX - 5; x <= PX + 5; x++) cells.push(idx(x, y, z));
  return cells;
};
const probeA = probe(cy), probeB = probe(cy + GAP);
if (cy + GAP + BEAM_HW >= h) { console.error(`control window out of bounds (h=${h}, need ${cy + GAP + BEAM_HW})`); process.exit(1); }
const inBeam = new Uint8Array(n);
for (const i of probeA) inBeam[i] = 1;

const resultsPath = join(LOGDIR, 'quench-results.json');
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];

// ---------- run each load level ----------
for (const level of LEVELS) {
  if (wasm._planck3_init_dims(w, h, d) !== 0) { console.error('init_dims rejected'); continue; }
  wasm._planck3_set_dissipation(DISS);
  wasm._planck3_set_thermal_limit(LIMIT);
  wasm._planck3_set_mode(MODE);
  wasm._planck3_reset_stats();

  // Empty-vacuum load: P3ST blob with zeroed channels (no seed needed —
  // the beam paints its own channel; probes paint heat at t=WARM).
  const buf = new Uint8Array(16 + n * 6);
  const dv = new DataView(buf.buffer);
  buf.set([0x50, 0x33, 0x53, 0x54]);
  dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, d, true);
  hb({ phase: 'loading', level });
  const loadPtr = wasm._planck3_load_pointer();
  heap8().set(buf, loadPtr);
  if (wasm._planck3_load_commit() !== 0) { console.error('load_commit rejected'); continue; }
  wasm._planck3_prepare();
  // IMPORTANT: g_rd/g_wr swap every tick — the pointer alternates between
  // two fixed buffers. It MUST be re-fetched after each _planck3_tick(),
  // else inject() writes land in the write buffer half the time (silently
  // eaten) and census() reads a stale pre-tick frame on alternate ticks.
  let statePtr = wasm._planck3_state_pointer();

  const inject = () => {
    if (!level) return;
    const mem = heap8();
    if (LOAD === 'buffer') {
      // Top up probe-A buffer → routing load. Re-set (not +=) so the
      // bleed/transfer dynamics don't ratchet it to 255.
      for (const i of probeA) mem[statePtr + i * 6 + 4] = level;
      return;
    }
    for (const i of srcZone) {
      mem[statePtr + i * 6] = Math.min(255, mem[statePtr + i * 6] + level);
      mem[statePtr + i * 6 + 1] = 1;                 // spin → +x port
    }
    for (const i of sinkWall) {
      mem[statePtr + i * 6] = Math.max(0, mem[statePtr + i * 6] - level);
      mem[statePtr + i * 6 + 1] = 0;
    }
  };

  const paintProbe = () => {
    const mem = heap8(), pdv = new DataView(mem.buffer);
    for (const i of [...probeA, ...probeB]) {
      const cur = pdv.getUint16(statePtr + i * 6 + 2, true);
      pdv.setUint16(statePtr + i * 6 + 2, Math.min(60000, cur + H0), true);
    }
  };

  const census = () => {
    const mem = heap8(), pdv = new DataView(mem.buffer);
    let hA = 0, hB = 0, qA = 0, bA = 0;
    for (const i of probeA) {
      hA += pdv.getUint16(statePtr + i * 6 + 2, true);
      qA += mem[statePtr + i * 6];
      bA += mem[statePtr + i * 6 + 4];
    }
    for (const i of probeB) hB += pdv.getUint16(statePtr + i * 6 + 2, true);
    return {
      hA: +(hA / probeA.length).toFixed(1),
      hB: +(hB / probeB.length).toFixed(1),
      qA: +(qA / probeA.length).toFixed(1),
      bA: +(bA / probeA.length).toFixed(1),
    };
  };

  console.log(`\nquench: level=${level} ${w}x${h}x${d} warm=${WARM} meas=${MEAS} h0=${H0} ` +
    `srcZone ${srcZone.length}+${sinkWall.length} cells, probes ${probeA.length}+${probeB.length}`);

  const series = [];
  const t0ms = Date.now();
  const VTK_DIR = VTK_EVERY ? join(LOGDIR, 'vtk', `quench-l${level}`) : null;
  if (VTK_DIR) mkdirSync(VTK_DIR, { recursive: true });

  const warm = [];
  // Adaptive warm: keep ticking (min WARM, max WARM_MAX) until the probe
  // baseline slope flattens — the beam's friction heat thermalizes slowly,
  // and painting onto a still-rising baseline masquerades as choked decay.
  let warmTicks = 0, converged = false;
  for (let t = 0; t < WARM_MAX; t++) {
    inject();
    wasm._planck3_tick();
    statePtr = wasm._planck3_state_pointer();   // buffer swap — see above
    const c = census();
    warm.push({ t, ...c });
    warmTicks = t + 1;
    if (t >= WARM - 1 && warm.length >= 12) {
      const tail = warm.slice(-10);
      const slope = (tail[tail.length - 1].hA - tail[0].hA) / (tail.length - 1);
      if (Math.abs(slope) < Math.max(1, 0.005 * c.hA)) { converged = true; break; }
    }
    hb({ level, phase: 'warm', t });
  }

  paintProbe();
  for (let t = 0; t < MEAS; t++) {
    if (VTK_DIR && t % VTK_EVERY === 0)
      writeVtkFrame({
        file: join(VTK_DIR, `frame_${String(t).padStart(5, '0')}.vtk`),
        w, h, d, statePtr, heap8, masks: { a: inBeam, b: null }, tick: t,
        title: `quench level ${level} t${t}`,
      });
    inject();
    wasm._planck3_tick();
    statePtr = wasm._planck3_state_pointer();   // buffer swap — see above
    const c = census();
    series.push({ t, ...c });
    if (t % 50 === 0 || t === MEAS - 1)
      console.log(`  t${t}: hA=${c.hA} hB=${c.hB} (qA=${c.qA} bufA=${c.bA})`);
    hb({ level, phase: 'measuring', t });
  }

  // Baseline trajectory per probe: linear fit over the LAST half of the
  // converged warm samples (near-steady-state), extrapolated into meas.
  const linfit = (key) => {
    const pts = warm.slice(Math.floor(warm.length / 2)).map(p => ({ t: p.t, v: p[key] }));
    const n = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) { sx += p.t; sy += p.v; sxx += p.t * p.t; sxy += p.t * p.v; }
    const den = n * sxx - sx * sx;
    const b = den !== 0 ? (n * sxy - sx * sy) / den : 0;
    const a = sy / n - b * (sx / n) + b * warmTicks;   // shift origin to meas t=0
    return { a, b };
  };
  const blA = linfit('hA'), blB = linfit('hB');
  if (!converged) console.log(`  WARN: baseline did not converge in ${WARM_MAX} ticks — baseline fit may underestimate`);

  // Deposit decay = heat EXCESS over the extrapolated beam baseline.
  // Cooling in this engine is (1+ts²)·diss — front-like, not exponential —
  // so the metric is ticks-to-milestone: first t where the excess falls
  // below 50/25/10% of its painted peak. Shape-agnostic and directly
  // comparable across load levels and vs the control window.
  const decay = (key, bl) => {
    const ex = series.map(s => Math.max(0, s[key] - (bl.a + bl.b * s.t)));
    const peak = Math.max(...ex);
    if (peak < 1) return null;
    const cross = (f) => {
      const i = ex.findIndex(e => e < peak * f);
      return i < 0 ? null : i;                     // index == t (1/tick series)
    };
    const end = ex[ex.length - 1];
    return {
      peak: +peak.toFixed(1), end: +end.toFixed(1),
      retained: +(end / peak).toFixed(3),          // 0=fully cooled, 1=nothing drained
      t50: cross(0.5), t25: cross(0.25), t10: cross(0.1),
    };
  };
  const fitA = decay('hA', blA), fitB = decay('hB', blB);

  // Equilibrium probe-A heat during warm tail: at steady state
  // gen = drain·BWF[r], so hA_eq is itself a BWF readout — a choked
  // channel piles heat up to where drain catches generation.
  const warmTail = warm.slice(-10);
  const hEq = +(warmTail.reduce((s, p) => s + p.hA, 0) / warmTail.length).toFixed(1);

  console.log(`  RESULT level=${level}: A(in-beam) retain=${fitA?.retained} t50/25/10=${fitA?.t50}/${fitA?.t25}/${fitA?.t10} · ` +
    `B(control) retain=${fitB?.retained} ${fitB?.t50}/${fitB?.t25}/${fitB?.t10} · hA_eq=${hEq}`);

  const out = {
    level, dims: DIMS, warmTicks, converged, meas: MEAS, h0: H0,
    beam_hw: BEAM_HW, gap: GAP, diss: DISS, limit: LIMIT,
    probes: { a: probeA.length, b: probeB.length },
    baseline: { a: blA, b: blB }, hEq, load: LOAD, fitA, fitB, ms: Date.now() - t0ms, warm, series,
  };
  writeFileSync(join(LOGDIR, `quench-l${level}.json`), JSON.stringify(out, null, 2));
  results.push({ level, load: LOAD, retainA: fitA?.retained, retainB: fitB?.retained, hEq, converged, warmTicks });
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  hb({ level, phase: 'done', fitA, fitB });
}
console.log(`\n${results.length} levels → ${resultsPath}`);
