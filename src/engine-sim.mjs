// Engine test harness: faithful JS port of planck.c tick() for scenario
// design validation without an emcc build. quanta/spin/heat fields,
// deadlock, shunting, congestion gravity, Phase Lock, FLOW_CAP transport
// lag, bandwidth cycle-stealing, pre-dissipation unwinding.
// Usage: node engine-sim.mjs [mode] [variant] [dump N]
//   mode: default ('engine'/'cap') mirrors planck.c: FLOW_CAP + congestion
//         gravity + Phase Lock. Suffixes A/B-test features: '+res' (old
//         resistance gravity), '+persist' (mass persist), '+nocap',
//         '+nograv', '+nolock' to disable.
// If planck.c's tick() changes, mirror the change here or results drift.

const W = 400, H = 400, N = W * H;
const DEADLOCK = 200, HEAT_MAX = 65535;
const KINETIC_BASE = 1, KINETIC_ALIGNED = 5, KINETIC_ORTHOGONAL = 2;
const KINETIC_SHUNT = 5, KINETIC_HEADON = 10;
const QUANTA_HEAT_GEN = 15, TEMP_SCALAR_DIV = 200, HEAT_FLOOR = 2;
const GRAVITY_DIV = 4, DIFF_DIV = 9, KEEP = 8;
const NODE_BANDWIDTH_MAX = 220; // routing-load ceiling for bandwidth cycle-stealing
const FLOW_CAP = 160; // max quanta relayed per node per tick — residual accumulates
const DIR_MAP = [[8,1,2],[7,0,3],[6,5,4]];
const INV_DIR = [0,5,6,7,8,1,2,3,4];
const SPIN_DX = [0,0,1,1,1,0,-1,-1,-1];
const SPIN_DY = [0,-1,-1,0,1,1,1,0,-1];
const OCTANT = [3,4,5,6,7,8,1,2];

let KNOB_DISS = 15, KNOB_LIMIT = 50000;
let FLOW_CAP_ON = true, LOCK_ON = true, PERSIST_MASS = false, GRAV_MODE = 'res'; // 'res'|'cong'|'off'

const q = new Uint8Array(N), s = new Uint8Array(N), h = new Uint16Array(N);
const q2 = new Uint8Array(N), s2 = new Uint8Array(N), h2 = new Uint16Array(N);

function tick() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const cq = q[i], cs = s[i], ch = h[i];
    let deadlocked = 0;
    if (cs !== 0) {
      const tx = (x + SPIN_DX[cs] + W) % W, ty = (y + SPIN_DY[cs] + H) % H;
      if (q[ty * W + tx] > DEADLOCK) deadlocked = 1;
    }
    let heatSum = 0, kin = 0, minRes = 1e9, gravSpin = cs, maxCong = 0, congSpin = cs, incoming = 0, mx = 0, my = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
      const ni = ny * W + nx;
      const nq = q[ni], ns = s[ni], nh = h[ni];
      const nDir = DIR_MAP[dy + 1][dx + 1], req = INV_DIR[nDir];
      heatSum += Math.floor(nh / DIFF_DIV);
      if (nq > 0 && ns === req) {
        const sent = FLOW_CAP_ON ? Math.min(nq, FLOW_CAP) : nq;
        kin += sent * KINETIC_BASE;
        if (cq > 0 && cs !== 0) {
          if (ns === cs) kin += sent * KINETIC_ALIGNED;
          else if (ns === INV_DIR[cs]) kin += 0;
          else kin += sent * KINETIC_ORTHOGONAL;
        }
        if (cq <= DEADLOCK) { incoming += sent; mx -= dx * sent; my -= dy * sent; }
      }
      // Entropic gravity sink: flux deflects toward the steepest drop in
      // thermodynamic resistance (cold, dense mass absorbs).
      const res = nh / (nq + 1);
      if (res < minRes) { minRes = res; gravSpin = nDir; }
      // Congestion gravity: densest neighbor that can still absorb flux.
      if (nq > maxCong && nq <= DEADLOCK) { maxCong = nq; congSpin = nDir; }
    }
    let nq2 = cq, shunt = 0;
    if (cq > 0 && cs !== 0) {
      if (!deadlocked) nq2 = FLOW_CAP_ON ? cq - Math.min(cq, FLOW_CAP) : 0;
      else { shunt = 1; kin += cq * KINETIC_SHUNT; }
    }
    nq2 += incoming; if (nq2 > 255) nq2 = 255;
    const xd = Math.sign(mx), yd = Math.sign(my);
    let dom = DIR_MAP[yd + 1][xd + 1];
    if (incoming > 0 && dom === 0) kin += incoming * KINETIC_HEADON;

    // Bandwidth limit & cycle-stealing: spatial I/O load starves internal
    // dissipation (time dilation lag).
    let routing = incoming + Math.abs(mx) + Math.abs(my) + (shunt ? cq : 0);
    if (routing > NODE_BANDWIDTH_MAX) routing = NODE_BANDWIDTH_MAX;
    const bwf = Math.max(0, 1 - routing / NODE_BANDWIDTH_MAX);

    let nh2 = ch - KEEP * Math.floor(ch / DIFF_DIV) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
      nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1;
    } else {
      const ts = Math.floor(nh2 / TEMP_SCALAR_DIV);
      nh2 -= Math.floor((1 + ts * ts) * KNOB_DISS * bwf);
      if (nh2 < HEAT_FLOOR) nh2 = 1 + Math.floor(Math.random() * 3);
    }

    // Phase is structural state: silence holds spin; flux rewrites it.
    let ns2 = dom !== 0 ? dom : cs;
    if (shunt) {
      const ls = cs - 1 < 1 ? 8 : cs - 1, rs = cs + 1 > 8 ? 1 : cs + 1;
      const lx = (x + SPIN_DX[ls] + W) % W, ly = (y + SPIN_DY[ls] + H) % H;
      const rx = (x + SPIN_DX[rs] + W) % W, ry = (y + SPIN_DY[rs] + H) % H;
      const hl = h[ly * W + lx], hr = h[ry * W + rx];
      ns2 = hl < hr ? ls : hr < hl ? rs : ((x + y) % 2 === 0 ? ls : rs);
    } else if (GRAV_MODE === 'res' && minRes < KNOB_LIMIT / GRAVITY_DIV && nq2 > 0) {
      ns2 = gravSpin;
    } else if (GRAV_MODE === 'cong' && maxCong > FLOW_CAP && nq2 > 0) {
      ns2 = congSpin; // bend toward densest absorbing neighbor — routing impedance
    } else if (LOCK_ON && cs !== 0) {
      // Phase Lock: laminar inflow keeps established phase; stalled mass
      // (dom==0, quanta>0) goes inert unless PERSIST_MASS; waveguides persist.
      if (dom === 0) ns2 = (cq === 0 || PERSIST_MASS) ? cs : 0;
      else {
        const dd = Math.abs(cs - dom);
        ns2 = dd <= 1 || dd === 7 ? cs : dom;
      }
    } else ns2 = dom;

    q2[i] = nq2; s2[i] = ns2; h2[i] = nh2;
  }
  for (let i = 0; i < N; i++) { q[i] = q2[i]; s[i] = s2[i]; h[i] = h2[i]; }
}

const vortexSpin = (dx, dy, c = 1) => {
  if (!dx && !dy) return 0;
  const tx = -dy * c, ty = dx * c;
  let a = Math.atan2(ty, tx); if (a < 0) a += 2 * Math.PI;
  return OCTANT[Math.floor((a + Math.PI / 8) / (Math.PI / 4)) % 8];
};

// Octagon ring: substrate-native closed streamline. Boundary = octagon norm
// r_oct = max(|dx|,|dy|,|dx+dy|/√2,|dx-dy|/√2); each edge is perpendicular to
// one of the 8 axes so its tangent is an exact spin. Mass flows laminar along
// edges and turns at vertices — zero radial error by construction.
const SQ2 = Math.SQRT1_2;
function octSpin(dx, dy, c = 1) {
  const comps = [dx, dy, (dx + dy) * SQ2, (dx - dy) * SQ2];
  const axes = [[1, 0], [0, 1], [SQ2, SQ2], [SQ2, -SQ2]];
  let bi = 0;
  for (let k = 1; k < 4; k++) if (Math.abs(comps[k]) > Math.abs(comps[bi])) bi = k;
  const sg = Math.sign(comps[bi]) || 1;
  const nx = axes[bi][0] * sg, ny = axes[bi][1] * sg;
  const tx = -ny * c, ty = nx * c; // +90° (CCW in math coords)
  return DIR_MAP[Math.sign(Math.round(ty)) + 1][Math.sign(Math.round(tx)) + 1];
}

function paintElectron({ shellQ = 100, shellMin = 21, shellMax = 80, foamP = 0.05, dither = 0, ringMode = null, oct = null } = {}) {
  q.fill(0); s.fill(0); h.fill(1);
  const cx = 200, cy = 200;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), i = y * W + x;
    if (d <= 8) { q[i] = 255; s[i] = oct && oct.core === 'vortex' ? vortexSpin(dx, dy) : 0; h[i] = 1; }
    else if (d <= 20) { if (!oct) { q[i] = 4; } s[i] = 0; h[i] = 1; }
    else if (oct) {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const rOct = oct.metric === 'approx'
        ? Math.max(adx, ady) + 0.414 * Math.min(adx, ady)
        : Math.max(adx, ady, Math.abs(dx + dy) * SQ2, Math.abs(dx - dy) * SQ2);
      const tangent = oct.tangent === 'vortex' ? vortexSpin(dx, dy) : octSpin(dx, dy);
      let painted = false;
      for (const ring of oct.rings) {
        if (rOct >= ring.lo && rOct <= ring.hi) { q[i] = ring.q; h[i] = 500; painted = true; }
      }
      if (rOct > 25 && rOct <= 90) { s[i] = tangent; painted = true; } // spin-only halo waveguide
      if (painted) h[i] = 500;
    }
    else if (ringMode) {
      // thin octagon-like rings at specified radii, e.g. [{r:45,q:120},{r:60,q:80}]
      for (const ring of ringMode) {
        if (Math.abs(d - ring.r) <= 1.5) { q[i] = ring.q; s[i] = vortexSpin(dx, dy); h[i] = 500; }
      }
    }
    else if (d <= shellMax) {
      let sp = vortexSpin(dx, dy);
      if (dither > 0) {
        // near an octant boundary, randomly pick the sector on either side
        const ang = Math.atan2(dy, dx) + Math.PI;
        const seamDist = Math.abs(((ang % (Math.PI / 4)) - Math.PI / 8)) * d;
        if (seamDist < dither && Math.random() < 0.5) {
          sp = vortexSpin(dx, dy, Math.random() < 0.5 ? 1 : 1);
          sp = Math.random() < 0.5 ? (sp - 1 < 1 ? 8 : sp - 1) : (sp + 1 > 8 ? 1 : sp + 1);
        }
      }
      q[i] = shellQ; s[i] = sp; h[i] = 500;
    }
    else if (Math.random() < foamP) { q[i] = 5; s[i] = 1 + Math.floor(Math.random() * 8); h[i] = 500; }
  }
}

function stats(label) {
  let shellMass = 0, foamMass = 0, dead = 0, totQ = 0, totH = 0;
  const cx = 200, cy = 200;
  const sectorMass = new Array(8).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = Math.hypot(x - cx, y - cy);
    totQ += q[i]; totH += h[i];
    if (q[i] > DEADLOCK) dead++;
    if (d > 8 && d <= 80) {
      shellMass += q[i];
      let a = Math.atan2(y - cy, x - cx); if (a < 0) a += 2 * Math.PI;
      sectorMass[Math.floor(a / (Math.PI / 4))] += q[i];
    } else if (d > 80) foamMass += q[i];
  }
  const min = Math.min(...sectorMass), max = Math.max(...sectorMass);
  console.log(`${label}: shellQ=${shellMass} foamQ=${foamMass} deadlocked=${dead} sectorMin/Max=${(min / (max || 1)).toFixed(2)} sectors=[${sectorMass.map(v => (v / 1000 | 0) + 'k').join(',')}]`);
}

// --- run ---
// modes: 'engine' = faithful to current planck.c (flow cap off until engine gains it)
// 'cap' adds FLOW_CAP transport lag; '+nocap'+nograv'+nolock' toggle features off.
const args = process.argv.slice(2);
const mode = args[0] || 'engine';
const variant = args[1] || 'solid';
FLOW_CAP_ON = !mode.includes('nocap');
GRAV_MODE = mode.includes('res') ? 'res' : mode.includes('nograv') ? 'off' : 'cong';
PERSIST_MASS = mode.includes('persist');
LOCK_ON = !mode.includes('nolock');
console.log(`=== mode=${mode} variant=${variant} ===`);
if (variant === 'oct') paintElectron({ oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'oct' } });
else if (variant === 'octvc') paintElectron({ oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'oct', core: 'vortex' } });
else if (variant === 'octapprox') paintElectron({ oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'approx', tangent: 'vortex' } });
else if (variant === 'octmix') paintElectron({ oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } });
else if (variant === 'rings') paintElectron({ ringMode: [{ r: 40, q: 130 }, { r: 60, q: 90 }] });
else if (variant === 'thin') paintElectron({ shellMin: 40, shellMax: 55, shellQ: 110 });
else if (variant.startsWith('dither')) paintElectron({ dither: parseFloat(variant.slice(6)) || 2 });
else paintElectron();
stats('tick 0');
for (let t = 1; t <= 150; t++) {
  tick();
  if (t % 25 === 0) stats('tick ' + t);
  if (args[2] === 'dump' && t === parseInt(args[3] || 40)) {
    for (let y = 165; y <= 235; y += 2) {
      let row = '';
      for (let x = 140; x <= 260; x += 2) {
        const v = q[y * W + x];
        row += v === 0 ? ' ' : v < 30 ? '.' : v < 100 ? '+' : v <= 200 ? '#' : '@';
      }
      console.log(row);
    }
  }
}
