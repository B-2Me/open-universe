// Engine test harness: faithful JS port of planck.c tick() for scenario
// design validation without an emcc build. quanta/spin/heat fields,
// deadlock, shunting, congestion gravity, Phase Lock, FLOW_CAP transport
// lag, bandwidth cycle-stealing, pre-dissipation unwinding.
// Usage: node engine-sim.mjs [mode] [variant] [dump N]
//   mode: default ('engine'/'cap') mirrors planck.c: FLOW_CAP + I/O-buffer
//         occupancy gravity + Phase Lock. Suffixes A/B-test features: '+res'
//         (old resistance gravity), '+persist' (mass persist), '+nocap',
//         '+nograv', '+nolock' to disable.
// If planck.c's tick() changes, mirror the change here or results drift.

const W = 400, H = 400, N = W * H;
const DEADLOCK = 200, HEAT_MAX = 65535;
const KINETIC_BASE = 1, KINETIC_ALIGNED = 5, KINETIC_ORTHOGONAL = 2;
const KINETIC_SHUNT = 5, KINETIC_HEADON = 10;
const QUANTA_HEAT_GEN = 15, TEMP_SCALAR_DIV = 200, HEAT_FLOOR = 2;
const GRAVITY_DIV = 4, DIFF_DIV = 9; // per-channel h/9 share — invariant across substrates
const NODE_BANDWIDTH_MAX = 220; // routing-load ceiling for bandwidth cycle-stealing
const FLOW_CAP = 160; // max quanta relayed per node per tick — residual accumulates
const KINETIC_BACKPRESSURE = 10; // heat blowoff when an input buffer overflows (backscatter)
const DIR_MAP = [[8,1,2],[7,0,3],[6,5,4]];
const INV_DIR = [0,5,6,7,8,1,2,3,4];
const SPIN_DX = [0,0,1,1,1,0,-1,-1,-1];
const SPIN_DY = [0,-1,-1,0,1,1,1,0,-1];
const OCTANT = [3,4,5,6,7,8,1,2];

// --- Hex topology (6-fold): odd-r offset rows. Each cell has 6 edge
// neighbors; diagonal offsets alternate by row parity. Spins 1-6 =
// E, SE, SW, W, NW, NE — screen angles (s-1)*60°. Triangular-cell 3-fold
// is the dual description of the same symmetry, so this covers both.
const HOFF = [
  [[0,0],[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]], // even rows
  [[0,0],[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]]    // odd rows
];
const HINV = [0,4,5,6,1,2,3]; // E↔W, SE↔NW, SW↔NE (parity-invariant)
const hexDir = (mx, my) => {
  if (mx === 0 && my === 0) return 0;
  const a = Math.atan2(my, mx);
  return ((Math.floor((a + Math.PI / 6) / (Math.PI / 3)) % 6) + 6) % 6 + 1;
};
// Odd-r offset → axial hex distance between two cells.
const hexDist = (x, y, cx, cy) => {
  const dq = (x - Math.floor(y / 2)) - (cx - Math.floor(cy / 2));
  const dr = y - cy;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

function tickHex() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const cq = q[i], cs = s[i], ch = h[i];
    const par = y & 1, off = HOFF[par];
    let deadlocked = 0;
    if (cs !== 0) {
      const tx = (x + off[cs][0] + W) % W, ty = (y + off[cs][1] + H) % H;
      const ti = ty * W + tx;
      // The port refuses on occupancy (resident + in-flight), not
      // resident mass alone — a pressurized buffer is already a wall.
      if (q[ti] + b[ti] > DEADLOCK) deadlocked = 1;
    }
    let heatSum = 0, kin = 0, maxCong = 0, congSpin = cs, incoming = 0, mx = 0, my = 0;
    for (let d = 1; d <= 6; d++) {
      const nx = (x + off[d][0] + W) % W, ny = (y + off[d][1] + H) % H;
      const ni = ny * W + nx;
      const nq = q[ni], ns = s[ni], nh = h[ni];
      heatSum += Math.floor(nh / DIFF_DIV);
      const nOcc = nq + b[ni];
      if (nq > 0 && ns === HINV[d]) { // neighbor's spin points back at us
        const sent = FLOW_CAP_ON ? Math.min(nq, FLOW_CAP) : nq;
        kin += sent * KINETIC_BASE;
        if (cq > 0 && cs !== 0) {
          if (ns === cs) kin += sent * KINETIC_ALIGNED;
          else if (ns === HINV[cs]) kin += 0;
          else kin += sent * KINETIC_ORTHOGONAL;
        }
        if (cq + b[i] <= DEADLOCK) {
          incoming += sent;
          const a = (d - 1) * Math.PI / 3; // screen angle of direction d
          mx -= Math.cos(a) * sent; my -= Math.sin(a) * sent;
        }
      }
      if (nOcc > maxCong && nOcc <= DEADLOCK) { maxCong = nOcc; congSpin = d; }
    }
    let nq2 = cq, shunt = 0;
    if (cq > 0 && cs !== 0) {
      if (!deadlocked) nq2 = FLOW_CAP_ON ? cq - Math.min(cq, FLOW_CAP) : 0;
      else { shunt = 1; kin += cq * KINETIC_SHUNT; }
    }
    // Arrivals stage in the input buffer and integrate only up to free
    // capacity — overflow is backscatter heat, not silent mass loss.
    let nb2 = b[i] + incoming;
    if (nb2 > 255) { kin += (nb2 - 255) * KINETIC_BACKPRESSURE; nb2 = 255; }
    const take = Math.min(nb2, 255 - nq2);
    nq2 += take; nb2 -= take;
    let dom = incoming > 0 ? hexDir(mx, my) : 0;
    if (incoming > 0 && dom === 0) kin += incoming * KINETIC_HEADON;

    let routing = incoming + Math.abs(mx) + Math.abs(my) + (shunt ? cq : 0) + b[i];
    if (routing > NODE_BANDWIDTH_MAX) routing = NODE_BANDWIDTH_MAX;
    const bwf = Math.max(0, 1 - routing / NODE_BANDWIDTH_MAX);

    // Retain what the 6 channels cannot send: h - 6*(h/9).
    let nh2 = ch - 6 * Math.floor(ch / DIFF_DIV) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
      nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0; // buffered flux unwinds with the knot
    } else {
      const ts = Math.floor(nh2 / TEMP_SCALAR_DIV);
      nh2 -= Math.floor((1 + ts * ts) * KNOB_DISS * bwf);
      if (nh2 < HEAT_FLOOR) nh2 = 1 + Math.floor(Math.random() * 3);
    }

    let ns2 = dom !== 0 ? dom : cs;
    if (shunt) {
      const ls = cs - 1 < 1 ? 6 : cs - 1, rs = cs + 1 > 6 ? 1 : cs + 1;
      const lx = (x + off[ls][0] + W) % W, ly = (y + off[ls][1] + H) % H;
      const rx = (x + off[rs][0] + W) % W, ry = (y + off[rs][1] + H) % H;
      const hl = h[ly * W + lx], hr = h[ry * W + rx];
      ns2 = hl < hr ? ls : hr < hl ? rs : ((x + y) % 2 === 0 ? ls : rs);
    } else if (GRAV_MODE === 'cong' && maxCong > FLOW_CAP && nq2 > 0) {
      ns2 = congSpin;
    } else if (LOCK_ON && cs !== 0) {
      if (dom === 0) ns2 = (cq === 0 || PERSIST_MASS) ? cs : 0;
      else {
        const dd = Math.abs(cs - dom);
        ns2 = dd <= 1 || dd === 5 ? cs : dom; // 6-fold wrap adjacency
      }
    } else ns2 = dom;

    q2[i] = nq2; s2[i] = ns2; h2[i] = nh2; b2[i] = nb2;
  }
  for (let i = 0; i < N; i++) { q[i] = q2[i]; s[i] = s2[i]; h[i] = h2[i]; b[i] = b2[i]; }
}

let KNOB_DISS = 15, KNOB_LIMIT = 50000;
let FLOW_CAP_ON = true, LOCK_ON = true, PERSIST_MASS = false, GRAV_MODE = 'res'; // 'res'|'cong'|'off'

const q = new Uint8Array(N), s = new Uint8Array(N), h = new Uint16Array(N);
const q2 = new Uint8Array(N), s2 = new Uint8Array(N), h2 = new Uint16Array(N);
const b = new Uint8Array(N), b2 = new Uint8Array(N); // staged in-flight arrivals

function tick() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const cq = q[i], cs = s[i], ch = h[i];
    let deadlocked = 0;
    if (cs !== 0) {
      const tx = (x + SPIN_DX[cs] + W) % W, ty = (y + SPIN_DY[cs] + H) % H;
      const ti = ty * W + tx;
      if (q[ti] + b[ti] > DEADLOCK) deadlocked = 1;
    }
    let heatSum = 0, kin = 0, minRes = 1e9, gravSpin = cs, maxCong = 0, congSpin = cs, incoming = 0, mx = 0, my = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
      const ni = ny * W + nx;
      const nq = q[ni], ns = s[ni], nh = h[ni];
      const nDir = DIR_MAP[dy + 1][dx + 1], req = INV_DIR[nDir];
      const nOcc = nq + b[ni];
      heatSum += Math.floor(nh / DIFF_DIV);
      if (nq > 0 && ns === req) {
        const sent = FLOW_CAP_ON ? Math.min(nq, FLOW_CAP) : nq;
        kin += sent * KINETIC_BASE;
        if (cq > 0 && cs !== 0) {
          if (ns === cs) kin += sent * KINETIC_ALIGNED;
          else if (ns === INV_DIR[cs]) kin += 0;
          else kin += sent * KINETIC_ORTHOGONAL;
        }
        if (cq + b[i] <= DEADLOCK) { incoming += sent; mx -= dx * sent; my -= dy * sent; }
      }
      // Entropic gravity sink: flux deflects toward the steepest drop in
      // thermodynamic resistance (cold, dense mass absorbs).
      const res = nh / (nq + 1);
      if (res < minRes) { minRes = res; gravSpin = nDir; }
      // Congestion gravity: densest neighbor that can still absorb flux —
      // occupancy is resident + in-flight quanta.
      if (nOcc > maxCong && nOcc <= DEADLOCK) { maxCong = nOcc; congSpin = nDir; }
    }
    let nq2 = cq, shunt = 0;
    if (cq > 0 && cs !== 0) {
      if (!deadlocked) nq2 = FLOW_CAP_ON ? cq - Math.min(cq, FLOW_CAP) : 0;
      else { shunt = 1; kin += cq * KINETIC_SHUNT; }
    }
    let nb2 = b[i] + incoming;
    if (nb2 > 255) { kin += (nb2 - 255) * KINETIC_BACKPRESSURE; nb2 = 255; }
    const take = Math.min(nb2, 255 - nq2);
    nq2 += take; nb2 -= take;
    const xd = Math.sign(mx), yd = Math.sign(my);
    let dom = DIR_MAP[yd + 1][xd + 1];
    if (incoming > 0 && dom === 0) kin += incoming * KINETIC_HEADON;

    // Bandwidth limit & cycle-stealing: spatial I/O load starves internal
    // dissipation (time dilation lag). Buffered backlog is routing load too.
    let routing = incoming + Math.abs(mx) + Math.abs(my) + (shunt ? cq : 0) + b[i];
    if (routing > NODE_BANDWIDTH_MAX) routing = NODE_BANDWIDTH_MAX;
    const bwf = Math.max(0, 1 - routing / NODE_BANDWIDTH_MAX);

    // Retain what the 8 channels cannot send: h - 8*(h/9).
    let nh2 = ch - 8 * Math.floor(ch / DIFF_DIV) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
      nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0; // buffered flux unwinds with the knot
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

    q2[i] = nq2; s2[i] = ns2; h2[i] = nh2; b2[i] = nb2;
  }
  for (let i = 0; i < N; i++) { q[i] = q2[i]; s[i] = s2[i]; h[i] = h2[i]; b[i] = b2[i]; }
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

function paintElectron({ shellQ = 100, shellMin = 21, shellMax = 80, foamP = 0.05, dither = 0, ringMode = null, oct = null, outwardFoam = false } = {}) {
  q.fill(0); s.fill(0); h.fill(1); b.fill(0);
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
      if (!painted && Math.random() < foamP) {
        q[i] = 5;
        s[i] = outwardFoam === 'out'
          ? OCTANT[Math.floor((Math.atan2(dy, dx) + Math.PI * 2 + Math.PI / 8) / (Math.PI / 4)) % 8]
          : outwardFoam === 'co'
          ? vortexSpin(dx, dy)
          : 1 + Math.floor(Math.random() * 8);
      } // quantum foam — matches scenarios.js
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

// Neutral isotropy probes shared by both topologies.
function paintBlobStream(variant) {
  q.fill(0); s.fill(0); h.fill(1); b.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (variant === 'blob') {
      const dx = x - 200, dy = y - 200;
      if (Math.hypot(dx, dy) <= 25) {
        // radial burst: outward-quantized spins — measures how anisotropically
        // the topology carries a circular front
        const a = Math.atan2(dy, dx);
        s[i] = OCTANT[Math.floor((a + Math.PI * 2 + Math.PI / 8) / (Math.PI / 4)) % 8];
        q[i] = 150; h[i] = 500;
      }
    } else if (variant === 'stream') {
      if (y >= 195 && y <= 205 && x >= 40 && x <= 360) { q[i] = 80; s[i] = 3; h[i] = 500; }
    }
  }
}

function paintHex(variant) {
  q.fill(0); s.fill(0); h.fill(1); b.fill(0);
  const cx = 200, cy = 200;
  const SEXT = (a) => ((Math.floor((a + Math.PI * 2 + Math.PI / 6) / (Math.PI / 3)) % 6) + 6) % 6 + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const d = hexDist(x, y, cx, cy);
    if (variant === 'hexblob') {
      if (d <= 25) {
        const a = Math.atan2(y - cy, x - cx);
        s[i] = ((Math.floor((a + Math.PI * 2 + Math.PI / 6) / (Math.PI / 3)) % 6) + 6) % 6 + 1;
        q[i] = 150; h[i] = 500;
      }
    } else if (variant === 'hexstream') {
      // E is a same-row direction — straight-through exists on hex.
      if (y >= 195 && y <= 205 && x >= 40 && x <= 360) { q[i] = 80; s[i] = 1; h[i] = 500; }
    } else if (variant.startsWith('hexcycle') || variant === 'hexring' || variant === 'hexringthin') {
      if (d <= 8) { q[i] = 255; s[i] = 0; h[i] = 1; }
      else if (d <= 25) { s[i] = 0; }
      else if (d <= 90) {
        const a = Math.atan2(y - cy, x - cx) + Math.PI / 2; // tangent
        s[i] = SEXT(a);
        if (variant.startsWith('hexcycle') && d === 50) {
          // Exact discrete circulation: spin = the counterclockwise-next
          // ring cell on the cell graph — the hex-native closed loop.
          const par = y & 1, off = HOFF[par];
          const aCur = Math.atan2(y - cy, x - cx);
          let best = 0, bestA = Infinity;
          for (let dd = 1; dd <= 6; dd++) {
            const nx = (x + off[dd][0] + W) % W, ny = (y + off[dd][1] + H) % H;
            if (hexDist(nx, ny, cx, cy) !== 50) continue;
            let da = Math.atan2(ny - cy, nx - cx) - aCur;
            while (da <= 0) da += Math.PI * 2;
            if (da < bestA) { bestA = da; best = dd; }
          }
          if (best) s[i] = best;
          q[i] = 120; h[i] = 500;
        } else if (variant === 'hexring' && d >= 45 && d <= 55) {
          q[i] = 70; h[i] = 500;
        } else if (variant === 'hexringthin' && d >= 48 && d <= 52) {
          q[i] = 140; h[i] = 500;
        }
      }
      // Bombardment tests — mirror the electron's killers:
      //   hexcyclef: ambient quantum foam (5%, random spins)
      //   hexcycleb: a single aimed projectile in clean vacuum (re-lock test)
      //   hexcyclep: projectile + foam
      else if ((variant === 'hexcyclef' || variant === 'hexcyclep') && Math.random() < 0.05) {
        q[i] = 5; s[i] = 1 + Math.floor(Math.random() * 6); h[i] = 100;
      }
      if (variant === 'hexcyclep' || variant === 'hexcycleb') {
        const pd = hexDist(x, y, cx - 120, cy - 60);
        if (pd <= 12) { q[i] = 150; s[i] = SEXT(Math.atan2(cy - y, cx - x)); h[i] = 500; }
      }
    } else if (variant === 'hexsnow') {
      // Crystal accretion: a deadlock seed in a convergent inflow — spins
      // quantized toward center ride the six native spokes and deposit on
      // the seed. A bubble chamber for snowflake growth.
      if (d <= 4) { q[i] = 255; s[i] = 0; h[i] = 1; }
      else if (Math.random() < 0.08) {
        q[i] = 40;
        s[i] = SEXT(Math.atan2(cy - y, cx - x) + Math.PI / 6); // spiral infall
        h[i] = 100;
      }
    } else if (variant === 'hexbraid') {
      // Two streams crossing at the native 60° — how do flows negotiate
      // on three-exit channels?
      if (y >= 190 && y <= 200 && x >= 30 && x <= 300) { q[i] = 80; s[i] = 1; h[i] = 500; }
      const perp = Math.abs((x - cx) * Math.sin(Math.PI / 3) - (y - cy) * Math.cos(Math.PI / 3));
      if (perp <= 6 && x > cx && x < 390) { q[i] = 80; s[i] = 2; h[i] = 500; }
    } else if (variant === 'hexjam') {
      // A wide stream forced through a bottleneck — congestion gravity's
      // home turf.
      const wall = y === 200 && (x < 150 || x > 250);
      if (wall) { q[i] = 255; s[i] = 0; h[i] = 1; }
      else if (y >= 60 && y <= 195) { q[i] = 60; s[i] = 2; h[i] = 500; } // SE flow into the wall
    }
  }
}

let SECTORS = 8; // set to 6 for hex runs — measure in the substrate's symmetry
let CYCLE_TRACK = false; // hexcycle* variants report loop integrity

function stats(label) {
  let shellMass = 0, foamMass = 0, dead = 0, totQ = 0, totH = 0, bufQ = 0;
  let cycleOcc = 0, cycleQ = 0, cycleTotal = 0;
  const cx = 200, cy = 200;
  const sectorMass = new Array(SECTORS).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = Math.hypot(x - cx, y - cy);
    totQ += q[i]; totH += h[i]; bufQ += b[i];
    if (q[i] > DEADLOCK) dead++;
    if (CYCLE_TRACK && hexDist(x, y, cx, cy) === 50) {
      cycleTotal++;
      if (q[i] > 0) { cycleOcc++; cycleQ += q[i]; }
    }
    if (d > 8 && d <= 80) {
      shellMass += q[i];
      let a = Math.atan2(y - cy, x - cx); if (a < 0) a += 2 * Math.PI;
      sectorMass[Math.floor(a / (Math.PI * 2 / SECTORS))] += q[i];
    } else if (d > 80) foamMass += q[i];
  }
  const min = Math.min(...sectorMass), max = Math.max(...sectorMass);
  const cyc = CYCLE_TRACK ? ` cycle=${cycleOcc}/${cycleTotal} cycleQ=${cycleQ}` : '';
  const buf = ` bufQ=${bufQ}`;
  console.log(`${label}: shellQ=${shellMass} foamQ=${foamMass} deadlocked=${dead}${cyc}${buf} sectorMin/Max=${(min / (max || 1)).toFixed(2)} sectors=[${sectorMass.map(v => (v / 1000 | 0) + 'k').join(',')}]`);
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
else if (variant === 'octmix') paintElectron({ foamP: 0, oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } }); // shipped paint: clean vacuum
else if (variant === 'octmixrf') paintElectron({ oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } }); // 5% random foam — kills by ~t150
else if (variant === 'octmixof') paintElectron({ outwardFoam: 'out', oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } });
else if (variant === 'octmixcf') paintElectron({ outwardFoam: 'co', oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } });
else if (variant === 'octmixlf') paintElectron({ foamP: 0.01, oct: { rings: [{ lo: 45, hi: 55, q: 70 }], metric: 'exact', tangent: 'vortex' } });
else if (variant === 'rings') paintElectron({ ringMode: [{ r: 40, q: 130 }, { r: 60, q: 90 }] });
else if (variant === 'thin') paintElectron({ shellMin: 40, shellMax: 55, shellQ: 110 });
else if (variant === 'blob' || variant === 'stream') paintBlobStream(variant);
else if (variant.startsWith('hex')) paintHex(variant);
else if (variant.startsWith('dither')) paintElectron({ dither: parseFloat(variant.slice(6)) || 2 });
else paintElectron();
const TICK = variant.startsWith('hex') ? tickHex : tick;
if (TICK === tickHex) SECTORS = 6;
CYCLE_TRACK = variant.startsWith('hexcycle');
stats('tick 0');
for (let t = 1; t <= 400; t++) {
  TICK();
  if (t % 50 === 0) stats('tick ' + t);
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
