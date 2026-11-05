/* moore26-harness — 0.1fm engine test rig.
 *
 * Seeds a macroscopic flux tube (two mass cores + a saturated
 * winding tube on the +/-X channel pair) and ticks, logging the
 * structural telemetry that exercises the 0.1fm mechanics:
 *   - winding conservation + emission drain
 *   - mass SPIKE at the tick the string breaks (Phase 7 pair
 *     production at the tube endpoints)
 *   - left/right mass centroids — do the fragments separate?
 *
 * Optional --oct paints an octupolar phase background (an 8-fold
 * angular phase twist over the central region — a rotating
 * magnetic-wake analog).
 *
 * NOTE: 128^3 default — NodeState is ~220B x N x 2 buffers, so
 * 256^3 (~7.4GB) exceeds wasm32 memory. 256^3 needs a MEMORY64
 * build. A 16-node string fits comfortably at 128^3.
 *
 * Usage: node script/moore26-harness.mjs [--ticks=1000] [--w=128]
 *        [--oct] [--str=16] [--winding=128]
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const arg = (k, d) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const flag = k => process.argv.includes(`--${k}`);

// --- load the cascade module (MODULARIZE factory, glue-eval) ---
const gluePath = resolve(ROOT, 'docs/public/wasm/cascade/moore26.js');
if (!existsSync(gluePath)) { console.error(`wasm glue not found: ${gluePath} — run src/build.sh first`); process.exit(1); }
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  readFileSync(gluePath, 'utf8'))(mod, mod.exports, createRequire(gluePath), dirname(gluePath), gluePath);
const M = await mod.exports();

const W = parseInt(arg('w', '128')), TICKS = parseInt(arg('ticks', '1000'));
const STR = parseInt(arg('str', '16'));          // string length in nodes
const TUBE_W = parseInt(arg('winding', '128'));  // saturated tube winding
const SCEN = arg('scen', 'string');              // string | hexbuckle
M._moore26_init(W, W, W);

const c0 = W >> 1;
const x0 = c0 - (STR >> 1), x1 = c0 + (STR >> 1);   // core positions

/* channel nearest a direction (dx,dy,dz) — for painting tubes along
 * a curve: pick the vec whose direction best matches the tangent. */
const pickChan = (dx, dy, dz) => {
  /* edges only — faces/corners are dead registers under FCC */
  let best = 6, bs = -1;
  for (let c = 6; c < 18; c++) {
    const v = M._moore26_channel_count() >= 26 ?
      [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
       [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],
       [0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],[1,1,1],[-1,-1,-1],[1,1,-1],[-1,-1,1],
       [1,-1,1],[-1,1,-1],[1,-1,-1],[-1,1,1]][c] : [0,0,0];
    const s = v[0]*dx + v[1]*dy + v[2]*dz;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
};

if (SCEN === 'hexbuckle') {
  /* flexoelectricity analog: a U-shaped buckled tube between two
   * anchored cores. Curvature is the strain; the measurement is
   * whether the bend polarizes the winding (net directedness along
   * the bend axis — the substrate's induced dipole). */
  const A = W / 8, D = parseInt(arg('dip', String(W / 4)));  // half-width, dip depth
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.02) {
    pts.push([Math.round(c0 + A * (2 * t - 1)),
              Math.round(c0 - D / 2 + D * (4 * t * (1 - t))), c0]);
  }
  M._moore26_mass_set(pts[0][0], pts[0][1], c0, 512);
  M._moore26_mass_set(pts[pts.length-1][0], pts[pts.length-1][1], c0, 512);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y, z] = pts[i], [nx, ny] = pts[i + 1];
    const c = pickChan(nx - x, ny - y, 0);
    M._moore26_winding_set(x, y, z, c, TUBE_W);
    M._moore26_winding_set(x, y, z, c ^ 1, TUBE_W);
  }
  console.log(`hexbuckle: U-tube ${pts.length} nodes, span A=${A}, dip D=${D}, winding=${TUBE_W}`);
} else if (SCEN === 'flat') {
  /* symmetric control: a straight tube BELOW the 12-node break
   * threshold (default --str=10) at the same bombardment height —
   * the flat-edge analog that should absorb the probe uniformly. */
  const fh = STR >> 1;
  M._moore26_mass_set(c0 - fh, c0 + 16 - fh, c0, 512);
  M._moore26_mass_set(c0 + fh, c0 + 16 + fh, c0, 512);
  for (let i = -fh; i <= fh; i++) {
    M._moore26_winding_set(c0 + i, c0 + 16 + i, c0, 6, TUBE_W);   // {1,1,0} edge pair
    M._moore26_winding_set(c0 + i, c0 + 16 + i, c0, 7, TUBE_W);   // — faces dead under FCC
  }
  console.log(`flat: {1,1,0} tube diag c0±${fh} @ y=${c0+16}, winding=${TUBE_W}`);
}

// --- octupolar background: 8-fold phase twist around the z-axis
// over the central region (the rotating magnetic-wake analog) ---
if (flag('oct')) {
  const R = W / 6;
  for (let z = c0 - 8; z < c0 + 8; z++)
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const dx = x - c0, dy = y - c0;
      const r2 = dx * dx + dy * dy;
      if (r2 > R * R || r2 < 4) continue;
      const ang = Math.atan2(dy, dx);                    // -pi..pi
      const ph = Math.floor(((ang / (2 * Math.PI)) * 8 % 1 + 1) % 1 * 511);
      M._moore26_phase_set(x, y, z, ph);
    }
  console.log(`octupolar background painted (R=${R.toFixed(0)})`);
}

// --- the test subject: two mass cores + a saturated winding tube ---
/* FCC fix: channels 0/1 are the ±x FACE pair — dead registers under
 * the transport gate. The tube runs the {1,1,0} diagonal on edge
 * pair 6/7 so its axis is a live transport direction. */
if (SCEN !== 'hexbuckle') {
  const h = STR >> 1;
  M._moore26_mass_set(c0 - h, c0 - h, c0, 512);
  M._moore26_mass_set(c0 + h, c0 + h, c0, 512);
  for (let i = -h; i <= h; i++) {
    M._moore26_winding_set(c0 + i, c0 + i, c0, 6, TUBE_W);   // +{1,1,0} edge
    M._moore26_winding_set(c0 + i, c0 + i, c0, 7, TUBE_W);   // -{1,1,0} edge
  }
}
console.log(`moore26 harness: ${W}^3, ${TICKS} ticks, scen=${SCEN}` +
  (SCEN === 'string' ? `, string x=${x0}..${x1} (${STR + 1} nodes @ winding=${TUBE_W})` : ''));

const totals = () => {
  let mass = 0, wind = 0, phot = 0, fly = 0, pol = 0, polx = 0, chpol = 0;
  let massL = 0, massR = 0, cxL = 0, cxR = 0, fx = 0;
  for (let z = 0; z < W; z++) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const m = M._moore26_mass_get(x, y, z);
    mass += m;
    if (x < c0) { massL += m; cxL += x * m; } else { massR += m; cxR += x * m; }
    /* the flexoelectric observable: the CHARGE dipole — probe flux
     * displacing signed charge along the bend. */
    chpol += (x - c0) * M._moore26_charge_get(x, y, z);
    for (let c = 0; c < 26; c++) {
      wind += M._moore26_winding_get(x, y, z, c);
      phot += M._moore26_photon_get(x, y, z, c);
      const f = M._moore26_massflight_get(x, y, z, c);
      fly += f; fx += x * f;
    }
    /* polarization: net directedness weighted by distance from the
     * center — under FCC the directed channels are EDGES, not faces.
     * pol = axial dipole on the string axis {1,1,0} (6/7); polx =
     * LATERAL dipole on the transverse {1,-1,0} axis (8/9). The
     * flexoelectric signal is polx: the bend shunting probe pressure
     * sideways. */
    const dy = M._moore26_winding_get(x, y, z, 6) - M._moore26_winding_get(x, y, z, 7);
    pol += (y - c0) * dy;
    const dx = M._moore26_winding_get(x, y, z, 8) - M._moore26_winding_get(x, y, z, 9);
    polx += (x - c0) * dx;
  }
  return { mass, wind, phot, fly, massL, massR, pol, polx, chpol,
           cxL: massL ? cxL / massL : 0, cxR: massR ? cxR / massR : 0,
           cxf: fly ? fx / fly : 0 };
};

const t0 = totals();
console.log(`t=0    mass=${t0.mass} (L:${t0.cxL.toFixed(1)} R:${t0.cxR.toFixed(1)}) wind=${t0.wind} phot=${t0.phot}`);

/* driven probe: continuous -Y photon stream aimed at the apex
 * (hexbuckle) or flat midpoint (flat) — nu=128 < 256 fusion wall
 * so pressure without pair production. --probe=N bounds the
 * bombardment ticks (default: the whole run). */
const PROBE = parseInt(arg('probe', TICKS.toString()));
const SRC_Y = c0 + 36, SRC_HALF = 3;      // source row & half-width
const PROBE_NU = 128;

const tStart = Date.now();
for (let t = 1; t <= TICKS; t++) {
  /* probe under the FCC gate: -y is a dead face register — the probe
   * rides the four -y edge channels {7,8,15,17}, a zigzag corridor. */
  if ((SCEN === 'hexbuckle' || SCEN === 'flat') && t <= PROBE)
    for (let x = c0 - SRC_HALF; x <= c0 + SRC_HALF; x++) {
      const sz = ((x + SRC_Y + c0) & 1) ? c0 + 1 : c0;  /* even-sublattice snap */
      for (const c of [7, 8, 15, 17]) {
        M._moore26_photon_set(x, SRC_Y, sz, c, 8);
        M._moore26_photon_nu_set(x, SRC_Y, sz, c, PROBE_NU);
      }
    }
  M._moore26_tick();
  if (t % 20 === 0) {
    const s = totals();
    console.log(`t=${String(t).padEnd(4)} mass=${s.mass} (L:${s.cxL.toFixed(1)} R:${s.cxR.toFixed(1)}) fly=${s.fly}@${s.cxf.toFixed(1)} pol=${s.pol} polx=${s.polx} chpol=${s.chpol} wind=${s.wind} phot=${s.phot} ` +
      `emit=${M._moore26_events(4)} fuse=${M._moore26_events(23)} break=${M._moore26_events(6)} annih=${M._moore26_events(9)}`);
  }
}
console.log(`${((Date.now() - tStart) / TICKS).toFixed(1)} ms/tick (wasm, ${W}^3)`);
