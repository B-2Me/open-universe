/* ring-spectro.mjs — cavity spectroscopy v2.
 *
 * v1 failed (ev50=0): burst injection every 8t meant the standing
 * cloud never coexisted — same-path offers always phase-agree.
 * The CFT paper's method: WEAK CONTINUOUS modulation + tight catch.
 * Tight catch (gate=8) makes most packets lap multiple times before
 * arming — age diversity => the standing cloud's ops spread, and
 * only ring-resonant nu (nu*C ~= 0 mod 256) stays self-consistent.
 *
 * Two selection mechanisms coexist (like boundary CFT data):
 *   merge gate  — phase:  nu*C ~ 0 (mod 256) keeps the cloud aligned
 *   on-shell    — level:  nu % line == 0, line=(mass+winding/4)/4
 * The deposited spectrum = resonant AND on-shell — boundary mass
 * detunes the line, shifting the admitted ladder (the test-4 knob).
 *
 * Arms (--arm=):
 *   det-m<N>   detector mass N -> line ~N/4 (default 10 -> 2)
 *   open       no detector mass — open end, kills the cavity
 *   rail       detector carries a saturated rail — closed loop,
 *              arrivals re-channel past it (no absorber)
 *   gate-off   merge gate 0 — no phase selection (control)
 *
 * Usage: node script/cascade/ring-spectro.mjs --arm=det-m10,det-m24,open
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 700);
const GATE  = +(argv.gate  ?? 48);
const MMIN  = +(argv.mmin  ?? 0);
const CATCH = +(argv.catch ?? 8);      // tight: forces multi-lap arrivals
const TTL   = +(argv.ttl   ?? 80);     // > 2 laps
const CC    = +(argv.c     ?? 24);
const INJEV = +(argv.injev ?? 1);      // continuous weak drive
const NUS   = String(argv.nu ?? '8,16,24,32,40,48,56,64,80,96,112').split(',').map(Number);

const M = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
            [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const PAIR = c => {
  const lo = c & ~1;
  return c & 1 ? { ch: [lo, lo+1], w: [100, 200] }
               : { ch: [lo, lo+1], w: [200, 100] };
};

function buildRing(r, cx, cy, z) {
  const side = [6, 8, 7, 9];
  const nodes = [];
  let x = cx - r, y = cy;
  for (let s = 0; s < 4; s++) {
    const c = side[s], v = CV[c];
    for (let i = 0; i < r; i++) { nodes.push({ x, y, z, c }); x += v[0]; y += v[1]; z += v[2]; }
  }
  return nodes;
}

function run(arm, nu) {
  const r = CC / 4;
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_merge_gate_set(arm === 'gate-off' ? 0 : GATE);
  M._moore26_merge_min_set(MMIN);
  M._moore26_rail_gate_set(64);
  M._moore26_catch_gate_set(CATCH);
  M._moore26_incip_ttl_set(TTL);
  const ring = buildRing(r, 16, 16, 16);
  for (let k = 0; k < ring.length; k++) {
    const n = ring[k];
    if (k === 0) {
      if (arm === 'open') continue;                  // bare open end
      if (arm === 'rail') {                          // closed loop, no absorber
        M._moore26_winding_set(n.x, n.y, n.z, 8, 200);
        M._moore26_winding_set(n.x, n.y, n.z, 9, 200);
        continue;
      }
      const mm = arm.startsWith('det-m') ? +(arm.slice(5)) : 10;
      M._moore26_mass_set(n.x, n.y, n.z, mm);
      continue;
    }
    const { ch, w } = PAIR(n.c);
    M._moore26_winding_set(n.x, n.y, n.z, ch[0], w[0]);
    M._moore26_winding_set(n.x, n.y, n.z, ch[1], w[1]);
  }
  const inj = ring[1], det = ring[0];
  const w0 = M._moore26_winding_get(det.x, det.y, det.z, 0) +
             M._moore26_winding_get(det.x, det.y, det.z, 1);
  let incipPeak = 0;
  for (let t = 0; t < TICKS; t++) {
    if (t % INJEV === 0) {
      M._moore26_packet_set(inj.x, inj.y, inj.z, inj.c, 1);
      M._moore26_packet_nu_set(inj.x, inj.y, inj.z, inj.c, nu);
    }
    M._moore26_tick();
    let ic = 0;
    for (const n of ring) for (let c = 6; c <= 17; c++)
      ic += M._moore26_incipient_get(n.x, n.y, n.z, c) || 0;
    if (ic > incipPeak) incipPeak = ic;
  }
  let detWind = 0, detInc = 0;
  for (let c = 0; c < 26; c++) {
    detWind += M._moore26_winding_get(det.x, det.y, det.z, c) || 0;
    detInc  += M._moore26_incipient_get(det.x, det.y, det.z, c) || 0;
  }
  return { detWind, detInc, incipPeak,
           detMass: M._moore26_mass_get(det.x, det.y, det.z),
           detHeat: M._moore26_heat_get(det.x, det.y, det.z),
           ev5: M._moore26_events(5), ev50: M._moore26_events(50),
           ev52: M._moore26_events(52) };
}

function circd(nu, C) {
  let d = (nu * C) % 256; if (d > 128) d = 256 - d; return d;
}

const ARMS = String(argv.arm ?? 'det-m10').split(',');
console.log(`ring-spectro: C=${CC} catch=${CATCH} ttl=${TTL} injevery=${INJEV} gate=${GATE} ${TICKS}t`);
for (const arm of ARMS) {
  console.log(`\n== arm ${arm} ==`);
  console.log(`  nu   d(nuC)  detWind  detInc  incipPk  detMass detHeat  ev5  ev50`);
  for (const nu of NUS) {
    const r = run(arm, nu);
    const d = circd(nu, CC);
    console.log(`  ${String(nu).padStart(3)}  ${String(d).padStart(5)}  ` +
      `${String(r.detWind).padStart(7)}  ${String(r.detInc).padStart(6)}  ` +
      `${String(r.incipPeak).padStart(7)}  ${String(r.detMass).padStart(7)} ` +
      `${String(r.detHeat).padStart(7)}  ${String(r.ev5).padStart(5)} ${String(r.ev50).padStart(5)}`);
  }
}
