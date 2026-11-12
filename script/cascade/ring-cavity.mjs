/* ring-cavity.mjs — the substrate's Casimir cavity.
 *
 * A closed rail ring of circumference C is a cavity: a packet that
 * laps it returns with op = nu*C mod 256 and meets the standing
 * cloud its own history armed. The merge gate admits only carriers
 * with circdist(nu*C mod 256, 0) <= GATE — a geometry-selected mode
 * ladder. Off-ladder carriers phase-decline -> heat.
 *
 * Geometry: diamond loop in the xy-plane, r hops/side (C = 4r),
 * channels 6(+x+y) 8(+x-y) 7(-x-y) 9(-x+y). Each node: mass + a
 * winding pair biased toward that side's channel (rail paving).
 *
 * Per (C, nu) run: inject a train of same-nu packets at node 0,
 * run, census retained packet energy on the ring + ring heat.
 * Prediction: retention peaks exactly on the admitted ladder.
 *
 * Usage: node script/cascade/ring-cavity.mjs --c=24 --nu=32,8 --ticks=400
 *        node script/cascade/ring-cavity.mjs --matrix=1
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 400);
const GATE  = +(argv.gate  ?? 48);
const MMIN  = +(argv.mmin  ?? 8);
const INJ   = +(argv.inj   ?? 40);     // packets injected
const INJEV = +(argv.injev ?? 8);      // every N ticks
const CNT   = +(argv.count ?? 3);      // packets per injection
const CATCH = +(argv.catch ?? 2);      // detector catch gate
const TTL   = +(argv.ttl   ?? 40);     // incipient standing window (>= lap)

const M = await loadM26();
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
/* winding on the edge pair [c&~1, (c&~1)+1], biased toward THIS
 * hop's channel — the rail follows the dominant member, so odd
 * channels need w=[100,200] not [200,100] (backwards otherwise). */
const PAIR = c => {
  const lo = c & ~1;
  return c & 1 ? { ch: [lo, lo + 1], w: [100, 200] }
               : { ch: [lo, lo + 1], w: [200, 100] };
};

// diamond loop, r hops per side, centered at (cx,cy) plane z
function buildRing(r, cx, cy, z) {
  const side = [6, 8, 7, 9];
  const nodes = [];
  let x = cx - r, y = cy;
  for (let s = 0; s < 4; s++) {
    const c = side[s], v = CV[c];
    for (let i = 0; i < r; i++) {
      nodes.push({ x, y, z, c });
      x += v[0]; y += v[1]; z += v[2];
    }
  }
  return nodes;   // nodes[k] emits along nodes[k].c to nodes[k+1]
}

function run(C, nu) {
  const r = C / 4;
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_merge_gate_set(GATE);
  M._moore26_merge_min_set(MMIN);
  M._moore26_rail_gate_set(64);
  M._moore26_catch_gate_set(CATCH);
  M._moore26_incip_ttl_set(TTL);
  const ring = buildRing(r, 16, 16, 16);
  for (let k = 0; k < ring.length; k++) {
    const n = ring[k];
    if (k === 0) {
      M._moore26_mass_set(n.x, n.y, n.z, 10);   // detector: no rail
      continue;                                // -> arrivals arm here
    }
    const { ch, w } = PAIR(n.c);
    M._moore26_winding_set(n.x, n.y, n.z, ch[0], w[0]);
    M._moore26_winding_set(n.x, n.y, n.z, ch[1], w[1]);
  }
  /* inject one node downstream of the detector: packets must lap
   * the ring (arriving on the last side's channel, ch9) before
   * they can arm at the detector — each lap adds nu*C to op. */
  const inj = ring[1 % ring.length], det = ring[0];
  let injected = 0;
  for (let t = 0; t < TICKS; t++) {
    if (t % INJEV === 0 && injected < INJ) {
      M._moore26_packet_set(inj.x, inj.y, inj.z, inj.c, CNT);
      M._moore26_packet_nu_set(inj.x, inj.y, inj.z, inj.c, nu);
      injected += CNT;
    }
    M._moore26_tick();
  }
  // census: ring survivors + detector bookkeeping. Confirmed offers
  // deposit into WINDING (not mass); phase declines book ev50+heat.
  let pkE = 0, pkN = 0;
  const nuH = {};
  for (const n of ring) {
    for (let c = 6; c <= 17; c++) {
      const p = M._moore26_packet_get(n.x, n.y, n.z, c) || 0;
      const pv = M._moore26_packet_nu_get(n.x, n.y, n.z, c) || 0;
      pkN += p; pkE += p * pv;
      if (p) nuH[pv] = (nuH[pv] || 0) + p;
    }
  }
  let detWind = 0, detInc = 0;
  for (let c = 0; c < 26; c++) {
    detWind += M._moore26_winding_get(det.x, det.y, det.z, c) || 0;
    detInc += M._moore26_incipient_get(det.x, det.y, det.z, c) || 0;
  }
  return { pkE, pkN, detWind, detInc,
           detMass: M._moore26_mass_get(det.x, det.y, det.z),
           detHeat: M._moore26_heat_get(det.x, det.y, det.z),
           nuH, ev50: M._moore26_events(50) };
}

function ladder(C) {   // predicted admitted nu in scan set
  const out = [];
  for (let nu = 4; nu <= 255; nu += 4) {
    let d = (nu * C) % 256; if (d > 128) d = 256 - d;
    if (d <= GATE) out.push(nu);
  }
  return out;
}

if (argv.matrix) {
  const CS = [8, 16, 24, 32], NUS = [4, 8, 16, 24, 32, 48, 64];
  console.log(`ring-cavity matrix: gate=${GATE} mmin=${MMIN} inj=${INJ}x${CNT} every ${INJEV}t, ${TICKS}t`);
  for (const C of CS) {
    console.log(`C=${C}: predicted ladder {${ladder(C).join(',')}}`);
    for (const nu of NUS) {
      const r = run(C, nu);
      let d = (nu * C) % 256; if (d > 128) d = 256 - d;
      const adm = d <= GATE ? 'ADMIT' : 'refuse';
      console.log(`  nu=${nu}\t(${adm}, d=${d})  pkE=${r.pkE} pkN=${r.pkN} ` +
                  `detWind=${r.detWind} detInc=${r.detInc} ` +
                  `detHeat=${r.detHeat} ev50=${r.ev50}`);
    }
  }
} else {
  const CS = String(argv.c ?? '24').split(',').map(Number);
  const NUS = String(argv.nu ?? '32').split(',').map(Number);
  for (const C of CS) for (const nu of NUS) {
    const r = run(C, nu);
    let d = (nu * C) % 256; if (d > 128) d = 256 - d;
    console.log(`C=${C} nu=${nu} (d=${d})  pkE=${r.pkE} pkN=${r.pkN} ` +
                `detMass=${r.detMass} detHeat=${r.detHeat} detIncip=${r.detIncip} ` +
                `ev50=${r.ev50}  nuH=${JSON.stringify(r.nuH)}`);
  }
}
