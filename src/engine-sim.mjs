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
const KINETIC_BASE = 1, KINETIC_SHUNT = 5;
const QUANTA_HEAT_GEN = 15, TEMP_SCALAR_DIV = 200, HEAT_FLOOR = 2;
const GRAVITY_DIV = 4, DIFF_DIV = 9; // per-channel h/9 share — invariant across substrates
const NODE_BANDWIDTH_MAX = 220; // routing-load ceiling for bandwidth cycle-stealing
const FLOW_CAP = 160; // max quanta relayed per node per tick — residual accumulates
const KINETIC_BACKPRESSURE = 10; // heat blowoff when an input buffer overflows (backscatter)
// Turn-friction kernel τ(1-cosΔθ), τ=4, tabulated by wrapped spin separation
// (index = sextant/octant distance). math.md §4: least-friction traversal.
const TURN_COST_HEX = [0, 2, 6, 8];      // 0° 60° 120° 180°
const TURN_COST_OCT = [0, 1, 4, 7, 8];   // 0° 45° 90° 135° 180°
// Integer-momentum path (+intmom): ×256 fixed-point hex direction weights
// (sin60°=0.8660→222, +0.13%; cos60°=0.5→128 exact) and a baked quadrature
// budget LUT. Momentum is a per-tick local, so fixed-point error cannot
// drift. Dominant spin resolves by argmax dot-product — the nearest
// direction vector to the momentum — replacing atan2 entirely.
const HEX_MX256 = [0, 256, 128, -128, -256, -128, 128];
const HEX_MY256 = [0, 0, 222, 222, 0, -222, -222];
const BWF_LUT = Uint8Array.from({ length: NODE_BANDWIDTH_MAX + 1 }, (_, r) =>
  Math.round(256 * Math.sqrt(1 - (r / NODE_BANDWIDTH_MAX) ** 2)));
const hexDirInt = (mx, my) => {
  if (mx === 0 && my === 0) return 0;
  let bd = 1, bdot = -Infinity;
  for (let d = 1; d <= 6; d++) {
    const dot = mx * HEX_MX256[d] + my * HEX_MY256[d];
    if (dot > bdot) { bdot = dot; bd = d; }
  }
  return bd;
};
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

let curTick = 0; // tension duty-cycle hashing needs a time base
function tickHex() {
  curTick++;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const cq = q[i], cs = s[i], ch = h[i], tn0 = tn[i];
    const par = y & 1, off = HOFF[par];
    let deadlocked = 0;
    if (cs !== 0) {
      const tx = (x + off[cs][0] + W) % W, ty = (y + off[cs][1] + H) % H;
      const ti = ty * W + tx;
      // The port refuses on occupancy (resident + in-flight), not
      // resident mass alone — a pressurized buffer is already a wall.
      if (q[ti] + b[ti] > DEADLOCK) deadlocked = 1;
    }
    let heatSum = 0, kin = 0, maxCong = 0, congSpin = cs, incoming = 0, mx = 0, my = 0, pmx = 0, pmy = 0;
    let tSum = 0, gx = 0, gy = 0, gNi = -1, gMaxD = 0;
    // Only actualized matter in motion feels the tension gradient —
    // the knot itself and empty vacuum stay inert (a source can't
    // self-propel).
    const feelsTension = cq > 0 && cs !== 0;
    for (let d = 1; d <= 6; d++) {
      const nx = (x + off[d][0] + W) % W, ny = (y + off[d][1] + H) % H;
      const ni = ny * W + nx;
      const nq = q[ni], ns = s[ni], nh = h[ni];
      heatSum += Math.floor(nh / DIFF_DIV);
      const nOcc = nq + b[ni];
      if (TENS_ON) {
        tSum += tn[ni] >> T_SHARE;
        // Track the steepest up-gradient neighbor that can carry flux —
        // arrivals deflect toward it (refraction) without touching spin.
        // Shear into a spinless cell stalls and accretes, so s≠0 only.
        const gd = tn[ni] - tn0;
        if (gd > gMaxD && ns !== 0) { gMaxD = gd; gNi = ni; }
        if (feelsTension) {
          if (INTMOM_ON) { gx += HEX_MX256[d] * gd; gy += HEX_MY256[d] * gd; }
          else { const a = (d - 1) * Math.PI / 3; gx += Math.cos(a) * gd; gy += Math.sin(a) * gd; }
        }
      }
      if (PRESS_ON && nOcc > PRESS_MIN) {
        // Asymmetric pressure gradient (stateless Stage-3a): occupancy
        // biases the momentum sum toward the dense side. Pressure rides
        // the dominant-spin channel only — it never enters `routing`,
        // so dissipation budgets stay clean.
        const pn = PRESS_SIGN * (nOcc >> PRESS_SHIFT);
        if (INTMOM_ON) { pmx += HEX_MX256[d] * pn; pmy += HEX_MY256[d] * pn; }
        else { const a = (d - 1) * Math.PI / 3; pmx += Math.cos(a) * pn; pmy += Math.sin(a) * pn; }
      }
      if (nq > 0 && ns === HINV[d]) { // neighbor's spin points back at us
        const sent = FLOW_CAP_ON ? Math.min(nq, FLOW_CAP) : nq;
        kin += sent * KINETIC_BASE;
        if (cq > 0 && cs !== 0) {
          // Continuous turn friction: straight-through free, reversal 2τ.
          const dd = Math.min(Math.abs(ns - cs), 6 - Math.abs(ns - cs));
          kin += sent * TURN_COST_HEX[dd];
        }
        if (cq + b[i] <= DEADLOCK) {
          incoming += sent;
          if (HALVE_ON && cs === d) {
            // Conflict-scoped halving wave (Todd's averaging horizon):
            // our spin points back at a head-on sender — the colliding
            // momentum splits ½ opposing + ¼+¼ into the lateral channels,
            // so the conflict resolves as a dampened acoustic deflection
            // rather than argmax winner-take-all.
            const half = sent >> 1, quar = sent >> 2;
            const dl = d === 1 ? 6 : d - 1, dr = d === 6 ? 1 : d + 1;
            if (INTMOM_ON) {
              mx -= HEX_MX256[d] * half + (HEX_MX256[dl] + HEX_MX256[dr]) * quar;
              my -= HEX_MY256[d] * half + (HEX_MY256[dl] + HEX_MY256[dr]) * quar;
            } else {
              const a = (d - 1) * Math.PI / 3, al = (dl - 1) * Math.PI / 3, ar = (dr - 1) * Math.PI / 3;
              mx -= Math.cos(a) * half + (Math.cos(al) + Math.cos(ar)) * quar;
              my -= Math.sin(a) * half + (Math.sin(al) + Math.sin(ar)) * quar;
            }
          }
          else if (INTMOM_ON) { mx -= HEX_MX256[d] * sent; my -= HEX_MY256[d] * sent; }
          else { const a = (d - 1) * Math.PI / 3; mx -= Math.cos(a) * sent; my -= Math.sin(a) * sent; }
        } else if (SEEP_ON) {
          // Porous barrier: a fixed fraction bleeds through the saturated
          // port — wall thickness compounds the cost, no hard-coded decay.
          const leak = Math.max(1, sent >> SEEP_SHIFT);
          const absorbed = SEEP_ABS_ON ? (leak >> SEEP_ABS) : 0;
          incoming += leak - absorbed; seepQ += leak - absorbed;
          kin += absorbed; // per-stage attenuation: flux thermalizes, not relays
          if (INTMOM_ON) { mx -= HEX_MX256[d] * (leak - absorbed); my -= HEX_MY256[d] * (leak - absorbed); }
          else { const a = (d - 1) * Math.PI / 3; mx -= Math.cos(a) * (leak - absorbed); my -= Math.sin(a) * (leak - absorbed); }
        }
      }
      if (nOcc > maxCong && nOcc <= DEADLOCK) { maxCong = nOcc; congSpin = d; }
    }
    let nq2 = cq, shunt = 0;
    if (cq > 0 && cs !== 0) {
      if (!deadlocked) nq2 = FLOW_CAP_ON ? cq - Math.min(cq, FLOW_CAP) : 0;
      else {
        let dv = 0;
        if (ZSHUNT_ON) {
          // Sender-side diversion: the saturated port doesn't reflect the
          // flux — it escapes through the extra channel, spinless.
          // Gravity as pressure release: routing failure goes vertical.
          const sendable = FLOW_CAP_ON ? Math.min(cq, FLOW_CAP) : cq;
          dv = zDivert(i, sendable);
          nq2 = cq - dv;
        }
        if (dv === 0 && SEEP_ON) {
          // Release the seeped fraction — the receiver accepts it, so the
          // sender must deduct it or mass duplicates across the port.
          const sendable = FLOW_CAP_ON ? Math.min(cq, FLOW_CAP) : cq;
          const leak = Math.max(1, sendable >> SEEP_SHIFT);
          // Full leak leaves the sender; the absorbed fraction thermalizes
          // mid-hop and simply never arrives — mass becomes wall heat.
          nq2 = cq - leak;
        }
        if (dv === 0) { shunt = 1; kin += cq * KINETIC_SHUNT; }
      }
    }
    // Tension shear: a share of arriving flux is deflected mid-hop into
    // the up-gradient neighbor's buffer — refraction, not spin-capture.
    // Mass conserves; the stream drifts gradient-ward each hop without
    // its heading being rewritten. (spray's direct b[ni] mutation is the
    // established convention for same-tick cross-cell pushes.)
    if (TENS_ON && gNi >= 0 && incoming > 0 && T_DIVERT < 16) {
      const room = 255 - b[gNi];
      const push = Math.min(incoming >> T_DIVERT, room);
      incoming -= push; b[gNi] += push;
    }
    // Arrivals stage in the input buffer and integrate only up to free
    // capacity — overflow is backscatter heat, not silent mass loss.
    let nb2 = b[i] + incoming;
    if (nb2 > 255) {
      let excess = nb2 - 255; nb2 = 255;
      if (ZS_ON && excess > 0) {
        // Adjacency expansion: buffer pressure overflows into the extra
        // channel instead of thermalizing. The flux lands spinless —
        // phase is an actualized property; it entrains on integration,
        // matching planar buffer semantics.
        excess -= zDivert(i, excess);
      }
      if (excess > 0) kin += excess * KINETIC_BACKPRESSURE;
    }
    if (SEEP_ABS_ON && cq + b[i] > DEADLOCK) {
      // Absorptive barrier medium: a deadlocked node thermalizes a
      // fraction of its staged flux per tick — in-transit mass decays
      // with dwell time, so attenuation compounds with wall thickness.
      const burn = nb2 >> 2; nb2 -= burn; kin += burn;
    }
    const take = Math.min(nb2, 255 - nq2);
    nq2 += take; nb2 -= take;
    if (SPRAY_ON && nb2 > 0) {
      // Radiation has a finite lifetime: only potential that FAILED to
      // resolve decoheres into ambient heat. In-transit flux actualizes
      // and pays nothing; a standing radiation bath drains. (hexcycle:
      // spray pooled in the halo at ~3.5k quanta and severed the loop.)
      const bleed = nb2 >> BUFDECAY; nb2 -= bleed; kin += bleed;
    }
    // Tension field bookkeeping: keeps what the 6 channels don't send,
    // gains neighbors' shares, sources from own occupancy, decoheres.
    if (TENS_ON) {
      let ntn = tn0 - 6 * (tn0 >> T_SHARE) + tSum
              - (tn0 >> T_DECAY)
              + ((cq + b[i]) > T_EMIT_MIN ? ((cq + b[i]) >> T_EMIT) : 0);
      tn2[i] = ntn < 0 ? 0 : (ntn > 255 ? 255 : ntn);
      // T_PULL is a gain exponent (gx << T_PULL) scaling the gradient's pull
      // against transport momentum in the dom argmax; T_RATE duty-cycles
      // the response — quantized 60° turns become an average fractional
      // force, so a stream can bend instead of only "hold or capture".
      if (((i * 2654435761 + curTick * 40503) >>> 0 & 255) < T_RATE) {
        gx <<= T_PULL; gy <<= T_PULL;
      } else { gx = 0; gy = 0; }
    } else {
      tn2[i] = tn0;
    }

    // Pressure and tension merge into the dominant-spin resolver only —
    // transport routing load (mag) stays on raw inflow momentum.
    const dmx = mx + pmx + gx, dmy = my + pmy + gy;
    let dom = (incoming > 0 || pmx !== 0 || pmy !== 0 || gx !== 0 || gy !== 0)
      ? (INTMOM_ON && INTMOM_DOM ? hexDirInt(dmx, dmy) : hexDir(dmx, dmy)) : 0;
    // Head-on arrivals are priced by the turn kernel (Δθ=180° → 2τ);
    // no separate cancellation tax.

    // ×256 momentum reads back to unit scale for the routing-load sum.
    const mag = INTMOM_ON ? (Math.abs(mx) + Math.abs(my)) >> 8 : Math.abs(mx) + Math.abs(my);
    let routing = incoming + mag + (shunt ? cq : 0) + b[i];
    if (routing > NODE_BANDWIDTH_MAX) routing = NODE_BANDWIDTH_MAX;
    // Quadrature vector budget (math.md §3): C_i = sqrt(C_max² - C_s²).
    const frac6 = Math.min(1, routing / NODE_BANDWIDTH_MAX);
    const bwf = Math.sqrt(1 - frac6 * frac6);

    // Retain what the 6 channels cannot send: h - 6*(h/9).
    let nh2 = ch - 6 * Math.floor(ch / DIFF_DIV) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
      if (SPRAY_ON) {
        // Unwinding = E=mc²: the knot's mass unspools as un-actualized
        // radiation — sprayed into neighbor buffers, not deleted.
        const share = ((nq2 + nb2) / 6) | 0;
        for (let d = 1; d <= 6; d++) {
          const nx = (x + off[d][0] + W) % W, ny = (y + off[d][1] + H) % H;
          const ni = ny * W + nx;
          b[ni] = Math.min(255, b[ni] + share);
        }
        sprayQ += nq2 + nb2;
      }
      nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0;
    } else {
      const ts = Math.floor(nh2 / TEMP_SCALAR_DIV);
      nh2 -= INTMOM_ON ? ((1 + ts * ts) * KNOB_DISS * BWF_LUT[routing]) >> 8
        : Math.floor((1 + ts * ts) * KNOB_DISS * bwf);
      if (nh2 < HEAT_FLOOR) nh2 = 1 + Math.floor(Math.random() * 3);
    }

    let ns2 = dom !== 0 ? dom : cs;
    if (shunt) {
      // Relational repulsion: the saturated port bounces the flux
      // straight back — deadlock walls are mirrors (Pauli exclusion).
      ns2 = HINV[cs];
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
  for (let i = 0; i < N; i++) { q[i] = q2[i]; s[i] = s2[i]; h[i] = h2[i]; b[i] = b2[i]; tn[i] = tn2[i]; }
}

let KNOB_DISS = 15, KNOB_LIMIT = 50000;
let FLOW_CAP_ON = true, LOCK_ON = true, PERSIST_MASS = false, GRAV_MODE = 'res'; // 'res'|'cong'|'off'
let ZS_ON = false; // adjacency expansion — the Open Frontier prototype
let ZSHUNT_ON = false; // sender-side vertical diversion on port deadlock
let ZOPEN_ON = false; // bounded depth: slab0/slabD-1 are hard surfaces
let ZSEED_ON = false; // paint the variant on slab1 too — seeded mid-jam
let SEEP_ON = false; // porous barriers: saturated ports leak a fixed fraction
let SEEP_ABS_ON = false; // seeped flux pays a per-hop absorption tax
let SPRAY_ON = false; // unwinding sprays mass as radiation instead of deleting it
let BUFDECAY = parseInt(process.env.BUFDECAY || '4'); // radiation decoherence: buffer >> 4 (~6%/tick) thermalizes
let INTMOM_ON = false; // integer momentum + LUT quadrature — no floats in the tick
let HALVE_ON = false; // conflict-scoped halving wave on head-on arrivals
let PRESS_ON = false; // stateless asymmetric pressure gradient (Stage 3a)
let PRESS_SHIFT = parseInt(process.env.PRESS_SHIFT || '4'); // occupancy >> shift → momentum bias
let PRESS_SIGN = parseInt(process.env.PRESS_SIGN || '1');   // +1 attract toward density, -1 repel
let PRESS_MIN = parseInt(process.env.PRESS_MIN || '0');     // occupancy floor — only real knots pull
let LENS_B = parseInt(process.env.LENS_B || '50');          // hexlens impact parameter
// Stage 3b (Todd's causal mechanics): a propagating tension field.
// Occupancy emits a scalar potential; it diffuses at channel-share rate
// (finite propagation speed — the field IS latency), decoheres slowly
// (finite range), and its gradient steers moving mass. The pad byte in
// PlanckNode is its physical home — this needs no layout change in C.
let TENS_ON = false;
let T_EMIT = parseInt(process.env.T_EMIT || '3');   // occupancy >> 3 → tension source
let T_EMIT_MIN = parseInt(process.env.T_EMIT_MIN || '0'); // only occupancy above this emits — knots source the field, dilute flux doesn't
let T_SHARE = parseInt(process.env.T_SHARE || '5'); // per-channel share tn>>5 (~3%/hop)
let T_DECAY = parseInt(process.env.T_DECAY || '5'); // tn >> 5 decoheres (~3%/tick)
let T_PULL = parseInt(process.env.T_PULL || '4');   // gradient << 4 → momentum bias (gain)
let T_RATE = parseInt(process.env.T_RATE || '255'); // pull duty cycle /256 — fractional steering
let T_DIVERT = parseInt(process.env.T_DIVERT || '5'); // arrivals >> 5 shear up-gradient (16 = off)
// Stage 1 latency probe (Todd's causal mechanics): inject an overdensity
// pulse into a running scenario and measure when the excess reaches a
// detector gate — control/pulse differencing isolates the wave's
// transit time from ambient flow. Distance = propagation latency.
let LAT_ON = false;
let PULSE_T = parseInt(process.env.PULSE_T || '60');   // injection tick
let PULSE_Q = parseInt(process.env.PULSE_Q || '60');   // quanta added per cell
let JAM_GAP = parseInt(process.env.JAM_GAP || '50');   // hexjam throat half-width
let PROBE_SRC = null, PROBE_DST = null;                // gate rectangles per variant
const INTMOM_DOM = process.env.INTMOM_DOM !== '0'; // diagnostic: 0 = keep atan2 resolver, isolate LUT cause
let sprayQ = 0, sprayLast = 0; // cumulative unspooled quanta (windowed in stats)
const SEEP_SHIFT = 6; // leak = sendable >> 6 ≈ 1.6% per port per tick
const SEEP_ABS = 1; // seepabs: absorbed = leak >> 1 (half thermalizes per hop)
let seepQ = 0, seepLast = 0; // cumulative seeped quanta (windowed in stats)
let SEEP_TRACK = false, SEEP_T = 1; // wall-transmission probe

// The field is a flat 1D array of slabs; "depth" is one extra routing
// channel per node — its counterpart at z^1. Not a sheet, a wider table.
const makeSlab = () => ({
  q: new Uint8Array(N), s: new Uint8Array(N), h: new Uint16Array(N),
  q2: new Uint8Array(N), s2: new Uint8Array(N), h2: new Uint16Array(N),
  b: new Uint8Array(N), b2: new Uint8Array(N),
  tn: new Uint8Array(N), tn2: new Uint8Array(N),
});
const slabs = [makeSlab(), makeSlab()];
// Active-slab bindings — tick() reads/writes these.
let q, s, h, q2, s2, h2, b, b2, tn, tn2;
// Vertical adjacency: counterpart buffers at z-1 and z+1 in the depth
// ring. zMoved tracks signed ring flux for the oscillation test.
let zbM, zbP, zMoved = 0, zSign = 1, zLastMoved = 0, DEPTH = 2;
function bindSlab(z) {
  ({ q, s, h, q2, s2, h2, b, b2, tn, tn2 } = slabs[z]);
  if (ZOPEN_ON && DEPTH > 2) {
    // Bounded depth: surfaces have a single vertical neighbor — no wrap.
    // (At D=2 open and ring are identical — one neighbor either way.)
    zbM = z > 0 ? slabs[z - 1].b : null;
    zbP = z < DEPTH - 1 ? slabs[z + 1].b : null;
  } else {
    zbM = slabs[(z + DEPTH - 1) % DEPTH].b;
    zbP = DEPTH === 2 ? zbM : slabs[(z + 1) % DEPTH].b;
  }
  zSign = z === 0 ? 1 : -1;
}
// Route overflow to the vertical neighbor with the most free buffer —
// the steepest drop in routing impedance (path of least resistance).
// A null neighbor is a surface boundary; a full one is a wall. If both
// sides refuse, the flux falls back to planar fate (bounce/backscatter).
function zDivert(i, amount) {
  if (DEPTH === 2) {
    const dv = Math.min(amount, 255 - zbM[i]);
    zbM[i] += dv; zMoved += zSign * dv;
    return dv;
  }
  const rM = zbM ? 255 - zbM[i] : -1;
  const rP = zbP ? 255 - zbP[i] : -1;
  const useP = rP > rM;
  const room = useP ? rP : rM;
  if (room <= 0) return 0;
  const dv = Math.min(amount, room);
  (useP ? zbP : zbM)[i] += dv;
  zMoved += (useP ? 1 : -1) * dv;
  return dv;
}
bindSlab(0);

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
          const dd = Math.min(Math.abs(ns - cs), 8 - Math.abs(ns - cs));
          kin += sent * TURN_COST_OCT[dd];
        }
        if (cq + b[i] <= DEADLOCK) { incoming += sent; mx -= dx * sent; my -= dy * sent; }
        else if (SEEP_ON) {
          // Porous barrier: a fixed fraction bleeds through the saturated port.
          const leak = Math.max(1, sent >> SEEP_SHIFT);
          const absorbed = SEEP_ABS_ON ? (leak >> SEEP_ABS) : 0;
          incoming += leak - absorbed; seepQ += leak - absorbed;
          kin += absorbed; // per-stage attenuation: flux thermalizes, not relays
          mx -= dx * (leak - absorbed); my -= dy * (leak - absorbed);
        }
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
      else {
        let dv = 0;
        if (ZSHUNT_ON) {
          // Sender-side diversion: the saturated port doesn't reflect the
          // flux — it escapes through the extra channel, spinless.
          // Gravity as pressure release: routing failure goes vertical.
          const sendable = FLOW_CAP_ON ? Math.min(cq, FLOW_CAP) : cq;
          dv = zDivert(i, sendable);
          nq2 = cq - dv;
        }
        if (dv === 0 && SEEP_ON) {
          // Release the seeped fraction — the receiver accepts it, so the
          // sender must deduct it or mass duplicates across the port.
          const sendable = FLOW_CAP_ON ? Math.min(cq, FLOW_CAP) : cq;
          const leak = Math.max(1, sendable >> SEEP_SHIFT);
          // Full leak leaves the sender; the absorbed fraction thermalizes
          // mid-hop and simply never arrives — mass becomes wall heat.
          nq2 = cq - leak;
        }
        if (dv === 0) { shunt = 1; kin += cq * KINETIC_SHUNT; }
      }
    }
    let nb2 = b[i] + incoming;
    if (nb2 > 255) {
      let excess = nb2 - 255; nb2 = 255;
      if (ZS_ON && excess > 0) {
        // Adjacency expansion: buffer pressure overflows into the extra
        // channel instead of thermalizing. The flux lands spinless —
        // phase is an actualized property; it entrains on integration,
        // matching planar buffer semantics.
        excess -= zDivert(i, excess);
      }
      if (excess > 0) kin += excess * KINETIC_BACKPRESSURE;
    }
    if (SEEP_ABS_ON && cq + b[i] > DEADLOCK) {
      // Absorptive barrier medium: a deadlocked node thermalizes a
      // fraction of its staged flux per tick — in-transit mass decays
      // with dwell time, so attenuation compounds with wall thickness.
      const burn = nb2 >> 2; nb2 -= burn; kin += burn;
    }
    const take = Math.min(nb2, 255 - nq2);
    nq2 += take; nb2 -= take;
    if (SPRAY_ON && nb2 > 0) {
      // Radiation has a finite lifetime: only potential that FAILED to
      // resolve decoheres into ambient heat. In-transit flux actualizes
      // and pays nothing; a standing radiation bath drains.
      const bleed = nb2 >> BUFDECAY; nb2 -= bleed; kin += bleed;
    }
    const xd = Math.sign(mx), yd = Math.sign(my);
    let dom = DIR_MAP[yd + 1][xd + 1];

    // Bandwidth limit & cycle-stealing: spatial I/O load starves internal
    // dissipation (time dilation lag). Quadrature budget (math.md §3):
    // C_max² = C_s² + C_i². Buffered backlog is routing load too.
    let routing = incoming + Math.abs(mx) + Math.abs(my) + (shunt ? cq : 0) + b[i];
    if (routing > NODE_BANDWIDTH_MAX) routing = NODE_BANDWIDTH_MAX;
    const frac8 = Math.min(1, routing / NODE_BANDWIDTH_MAX);
    const bwf = Math.sqrt(1 - frac8 * frac8);

    // Retain what the 8 channels cannot send: h - 8*(h/9).
    let nh2 = ch - 8 * Math.floor(ch / DIFF_DIV) + heatSum + kin + nq2 * QUANTA_HEAT_GEN;
    if (nh2 > KNOB_LIMIT && nq2 > 0) {
      if (SPRAY_ON) {
        // Unwinding = E=mc²: the knot's mass unspools as un-actualized
        // radiation — sprayed into neighbor buffers, not deleted.
        const share = ((nq2 + nb2) / 8) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ni = ((y + dy + H) % H) * W + ((x + dx + W) % W);
          b[ni] = Math.min(255, b[ni] + share);
        }
        sprayQ += nq2 + nb2;
      }
      nh2 = HEAT_MAX; nq2 = 0; dom = 0; shunt = 1; nb2 = 0;
    } else {
      const ts = Math.floor(nh2 / TEMP_SCALAR_DIV);
      nh2 -= INTMOM_ON ? ((1 + ts * ts) * KNOB_DISS * BWF_LUT[routing]) >> 8
        : Math.floor((1 + ts * ts) * KNOB_DISS * bwf);
      if (nh2 < HEAT_FLOOR) nh2 = 1 + Math.floor(Math.random() * 3);
    }

    // Phase is structural state: silence holds spin; flux rewrites it.
    let ns2 = dom !== 0 ? dom : cs;
    if (shunt) {
      ns2 = INV_DIR[cs]; // relational repulsion — deadlock reflects flux
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
  q.fill(0); s.fill(0); h.fill(1); b.fill(0); tn.fill(0);
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
  q.fill(0); s.fill(0); h.fill(1); b.fill(0); tn.fill(0);
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
  q.fill(0); s.fill(0); h.fill(1); b.fill(0); tn.fill(0);
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
          q[i] = parseInt(process.env.RING_Q || '90'); h[i] = 500; // 90: under-220-routing margin — v3.0 integer physics runs hotter than the float-era fixed point
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
    } else if (variant === 'hexlens') {
      // Gravitational lensing probe: a bare anchor knot at center, and a
      // probe stream (s=E) aimed past it at impact parameter LENS_B.
      // Without a force the stream holds its lane; a real field must
      // curve it measurably — deflection should grow as LENS_B shrinks.
      // Result so far: every steering coupling tried shows a binary
      // cliff — invisible below threshold, accretion above it. Streams
      // are sticky mass flows, not rays: they get eaten, not bent.
      if (d <= 8) { q[i] = 255; s[i] = 0; h[i] = 1; }
      else if (d <= 25) { s[i] = 0; } // moat — isolate the knot
      const sy = cy - LENS_B;
      if (y >= sy - 3 && y <= sy + 3 && x >= 30 && x <= 370) { q[i] = 80; s[i] = 1; h[i] = 500; }
    } else if (variant === 'hexcollide') {
      // Head-on collision front: two dense streams aimed 180° apart
      // meeting on the same row band — the conflict-scoped halving
      // wave's home turf. A/B vs canonical measures whether the
      // conflict resolves as acoustic ripples or thermal blowoff.
      if (y >= 195 && y <= 205) {
        if (x >= 30 && x < 200) { q[i] = 80; s[i] = 1; h[i] = 500; }  // E stream
        else if (x >= 200 && x <= 370) { q[i] = 80; s[i] = 4; h[i] = 500; } // W stream
      }
    } else if (variant === 'hexbraid') {
      // Two streams crossing at the native 60° — how do flows negotiate
      // on three-exit channels?
      if (y >= 190 && y <= 200 && x >= 30 && x <= 300) { q[i] = 80; s[i] = 1; h[i] = 500; }
      const perp = Math.abs((x - cx) * Math.sin(Math.PI / 3) - (y - cy) * Math.cos(Math.PI / 3));
      if (perp <= 6 && x > cx && x < 390) { q[i] = 80; s[i] = 2; h[i] = 500; }
    } else if (variant === 'hexjam') {
      // A wide stream forced through a bottleneck — congestion gravity's
      // home turf. JAM_GAP sets the throat half-width (50 = shipped paint).
      const wall = y === 200 && (x < 200 - JAM_GAP || x > 200 + JAM_GAP);
      if (wall) { q[i] = 255; s[i] = 0; h[i] = 1; }
      else if (y >= 60 && y <= 195) { q[i] = 60; s[i] = 2; h[i] = 500; } // SE flow into the wall
    }
  }
}

let SECTORS = 8; // set to 6 for hex runs — measure in the substrate's symmetry
let CYCLE_TRACK = false; // hexcycle* variants report loop integrity
let LENS_TRACK = false;  // hexlens reports downstream centroid deflection

// Seepwall: a closed ring barrier of thickness t (deadlocked disk shell
// at radius ~60) with randomized interior flux — a boxed particle. Any
// mass measured outside the ring is seeped transmission; a column wall
// on a torus can't isolate regions, so the barrier must be closed.
function paintSeepwall(t) {
  h.fill(1); tn.fill(0);
  const cx = 200, cy = 200;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    const i = y * W + x;
    if (d >= 58 && d < 58 + t) { q[i] = 220; s[i] = 0; }
    else if (d < 55) { q[i] = 40; s[i] = 1 + (Math.random() * 8 | 0); } // sub-critical density — seepage is the dominant drain, not unwinding
  }
}

// --- Stage 1 latency probe ---
// Tagged pulse = overdensity injected into a source gate at t=PULSE_T.
// A control run without the pulse gives the baseline; the detector
// gate's excess mass over control is the wave's arrival. Since the
// lattice propagates ≤1 cell/tick, transit ticks ≈ operational
// distance — congestion lengthens it.
const PROBE_GATES = {
  // hexjam: source rides the SE stream upstream of the throat.
  // 'mid' sits in the congestion field at the throat mouth (upstream
  // of the wall); 'exit' sits below the gap in the outflow fan. The
  // mid→exit leg is the congested transit being priced.
  hexjam:    { src: { x0: 60, x1: 79, y0: 110, y1: 129 },
               dst: [{ name: 'mid',  x0: 140, x1: 240, y0: 170, y1: 195 },
                     { name: 'exit', x0: 160, x1: 240, y0: 210, y1: 230 }] },
  // hexstream: free corridor control — same mechanism, no congestion.
  hexstream: { src: { x0: 50, x1: 69, y0: 195, y1: 205 },
               dst: [{ name: 'mid',  x0: 180, x1: 200, y0: 190, y1: 210 },
                     { name: 'exit', x0: 330, x1: 350, y0: 190, y1: 210 }] },
};

function probeDetMass(g) {
  let m = 0;
  for (let y = g.y0; y <= g.y1; y++)
    for (let x = g.x0; x <= g.x1; x++) {
      const i = y * W + x;
      m += q[i] + b[i];
    }
  return m;
}

function probeInject() {
  let total = 0;
  for (let y = PROBE_SRC.y0; y <= PROBE_SRC.y1; y++)
    for (let x = PROBE_SRC.x0; x <= PROBE_SRC.x1; x++) {
      const i = y * W + x;
      const add = Math.min(PULSE_Q, 255 - q[i]);
      q[i] += add; total += add;
    }
  return total;
}

function runLatProbe(tickFn, maxT) {
  const dets = PROBE_DST;
  const runSeries = (withPulse) => {
    paintVariant();
    let injected = 0;
    const series = dets.map(() => new Float64Array(maxT + 1));
    for (let t = 1; t <= maxT; t++) {
      tickFn();
      if (withPulse && t === PULSE_T) injected = probeInject();
      if (t >= PULSE_T) for (let g = 0; g < dets.length; g++) series[g][t] = probeDetMass(dets[g]);
    }
    return { series, injected };
  };

  const ctrl = runSeries(false);
  const puls = runSeries(true);
  const scx = (PROBE_SRC.x0 + PROBE_SRC.x1) / 2, scy = (PROBE_SRC.y0 + PROBE_SRC.y1) / 2;
  const thresh = Math.max(200, puls.injected * 0.02); // 2% of injected mass

  console.log(`LATPROBE: injected=${puls.injected} thresh=${Math.round(thresh)}`);
  for (let g = 0; g < dets.length; g++) {
    const d = dets[g];
    const dcx = (d.x0 + d.x1) / 2, dcy = (d.y0 + d.y1) / 2;
    const geomD = Math.round(hexDist(scx, scy, dcx, dcy));
    let firstT = 0, peakT = 0, peak = 0;
    for (let t = PULSE_T; t <= maxT; t++) {
      const diff = puls.series[g][t] - ctrl.series[g][t];
      if (diff > peak) { peak = diff; peakT = t; }
      if (!firstT && diff >= thresh) firstT = t;
    }
    console.log(`  [${d.name}] ctrl/pulse/diff per 20t:`);
    for (let t = PULSE_T; t <= maxT; t += 20)
      console.log(`    ${t}: ${Math.round(ctrl.series[g][t])} ${Math.round(puls.series[g][t])} ${Math.round(puls.series[g][t] - ctrl.series[g][t])}`);
    if (firstT) {
      const transit = firstT - PULSE_T;
      console.log(`  [${d.name}] ARRIVAL t=${firstT} → transit=${transit} ticks over ${geomD} cells ≈ ${(transit / geomD).toFixed(2)} ticks/cell`);
    } else {
      console.log(`  [${d.name}] ARRIVAL: no tagged excess ≥ threshold in window (captured upstream)`);
    }
    console.log(`  [${d.name}] peak excess ${Math.round(peak)} @ t=${peakT}`);
  }
}

function stats(label) {
  let shellMass = 0, foamMass = 0, dead = 0, totQ = 0, totH = 0, bufQ = 0, hMax = 0, hMaxX = 0, hMaxY = 0;
  let cycleOcc = 0, cycleQ = 0, cycleTotal = 0;
  const cx = 200, cy = 200;
  const sectorMass = new Array(SECTORS).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = Math.hypot(x - cx, y - cy);
    totQ += q[i]; totH += h[i]; bufQ += b[i];
    if (h[i] > hMax) { hMax = h[i]; hMaxX = x; hMaxY = y; }
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
  let zstr = '';
  if (ZS_ON) {
    const qs = [], bs = [];
    for (let z = 1; z < DEPTH; z++) {
      let tq = 0, tb = 0;
      for (let i = 0; i < N; i++) { tq += slabs[z].q[i]; tb += slabs[z].b[i]; }
      qs.push(tq); bs.push(tb);
    }
    const zFlow = zMoved - zLastMoved; zLastMoved = zMoved;
    zstr = ` zQ=[${qs}] zbufQ=[${bs}] zNet=${zMoved} zFlw=${zFlow}`;
  }
  if (SEEP_ON) {
    const sWin = seepQ - seepLast; seepLast = seepQ;
    zstr += ` seep=${sWin}`;
  }
  if (SPRAY_ON) {
    const sWin = sprayQ - sprayLast; sprayLast = sprayQ;
    zstr += ` spray=${sWin}`;
  }
  if (TENS_ON) {
    let tMax = 0;
    for (let i = 0; i < N; i++) if (tn[i] > tMax) tMax = tn[i];
    // Radial profile along the upward ray through the knot — shows
    // whether the well has spatial extent or saturates at contact.
    const prof = [10, 25, 40, 50, 70, 100].map(r => tn[(cy - r) * W + cx]);
    zstr += ` tenMax=${tMax} ten@[${prof.join(',')}]`;
  }
  if (LENS_TRACK) {
    // Downstream centroid of the probe stream (x ∈ [300,360]) minus its
    // initial row — positive = deflected toward the knot (attraction).
    let num = 0, den = 0;
    for (let x = 300; x <= 360; x++) for (let y = 0; y < H; y++) {
      const qq = q[y * W + x]; num += qq * y; den += qq;
    }
    const cyL = den > 0 ? num / den : cy - LENS_B;
    // Capture accounting: mass + knotted cells inside the well (r ≤ 35).
    // Stream transiting the region inflates capQ transiently — the
    // meaningful signal is what REMAINS after passage, and stalls
    // (capD) since captured flux can't leave on its own.
    let capQ = 0, capD = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (hexDist(x, y, cx, cy) <= 35) {
        const i = y * W + x;
        capQ += q[i] + b[i];
        if (q[i] + b[i] > DEADLOCK) capD++;
      }
    }
    zstr += ` lensY=${(cyL - (cy - LENS_B)).toFixed(1)} capQ=${capQ} capD=${capD}`;
  }
  if (SEEP_TRACK) {
    let tq = 0, iq = 0;
    const r2 = (62 + SEEP_T) * (62 + SEEP_T);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - 200, dy = y - 200, d2 = dx * dx + dy * dy;
      if (d2 > r2) tq += q[y * W + x] + b[y * W + x];
      else if (d2 < 55 * 55) iq += q[y * W + x] + b[y * W + x]; // interior retention — the true barrier-integrity metric
    }
    zstr += ` transQ=${tq} intQ=${iq}`;
  }
  console.log(`${label}: shellQ=${shellMass} foamQ=${foamMass} deadlocked=${dead} hMax=${hMax}@(${hMaxX},${hMaxY})${cyc}${buf}${zstr} sectorMin/Max=${(min / (max || 1)).toFixed(2)} sectors=[${sectorMass.map(v => (v / 1000 | 0) + 'k').join(',')}]`);
}

// --- run ---
// modes: 'engine' = faithful to current planck.c (flow cap off until engine gains it)
// 'cap' adds FLOW_CAP transport lag; '+nocap'+nograv'+nolock' toggle features off.
// '+zshadow' = receiver-side buffer overflow spills to the depth^1 slab;
// '+zshunt' = sender-side deadlock diverts vertically instead of bouncing.
const args = process.argv.slice(2);
const mode = args[0] || 'engine';
const variant = args[1] || 'solid';
FLOW_CAP_ON = !mode.includes('nocap');
GRAV_MODE = mode.includes('res') ? 'res' : mode.includes('nograv') ? 'off' : 'cong';
PERSIST_MASS = mode.includes('persist');
LOCK_ON = !mode.includes('nolock');
ZSHUNT_ON = mode.includes('zshunt');
ZOPEN_ON = mode.includes('zopen');
ZSEED_ON = mode.includes('zseed');
SEEP_ON = mode.includes('seep');
SEEP_ABS_ON = mode.includes('seepabs');
SPRAY_ON = mode.includes('spray');
INTMOM_ON = mode.includes('intmom');
HALVE_ON = mode.includes('halve');
LAT_ON = mode.includes('latprobe');
PRESS_ON = mode.includes('press');
TENS_ON = mode.includes('tension');
ZS_ON = mode.includes('zshadow') || ZSHUNT_ON || ZSEED_ON; // adjacency expansion (Open Frontier)
if (ZS_ON) {
  const zd = mode.match(/z(\d)/); // '+z4' sets the depth ring
  if (zd) DEPTH = Math.max(2, parseInt(zd[1]));
  while (slabs.length < DEPTH) slabs.push(makeSlab());
  for (let z = 1; z < DEPTH; z++) slabs[z].h.fill(1); // deeper slabs start as cold vacuum
}
console.log(`=== mode=${mode} variant=${variant} ===`);
const paintVariant = () => {
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
  else if (variant.startsWith('seep')) { SEEP_T = parseInt(variant.slice(4)) || 1; SEEP_TRACK = true; paintSeepwall(SEEP_T); }
  else if (variant.startsWith('hex')) paintHex(variant);
  else if (variant.startsWith('dither')) paintElectron({ dither: parseFloat(variant.slice(6)) || 2 });
  else paintElectron();
};
bindSlab(0); paintVariant();
if (ZSEED_ON && DEPTH > 1) { bindSlab(1); paintVariant(); bindSlab(0); } // seed the sink slab with its own jam
const TICK = variant.startsWith('hex') ? tickHex : tick;
if (TICK === tickHex) SECTORS = 6;
CYCLE_TRACK = variant.startsWith('hexcycle');
LENS_TRACK = variant === 'hexlens';
if (LAT_ON) {
  const gates = PROBE_GATES[variant];
  if (!gates) { console.log('latprobe: no gates defined for ' + variant); process.exit(1); }
  PROBE_SRC = gates.src; PROBE_DST = gates.dst;
  const MAXT = parseInt(process.env.TICKS || '400');
  runLatProbe(TICK, MAXT);
  process.exit(0);
}
stats('tick 0');
if (process.env.KNOB_LIMIT) KNOB_LIMIT = parseInt(process.env.KNOB_LIMIT);
if (process.env.KNOB_DISS) KNOB_DISS = parseInt(process.env.KNOB_DISS);
const MAXT = parseInt(process.env.TICKS || '400');
for (let t = 1; t <= MAXT; t++) {
  bindSlab(0); TICK();
  if (ZS_ON) { for (let z = 1; z < DEPTH; z++) { bindSlab(z); TICK(); } bindSlab(0); }
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
