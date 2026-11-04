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

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
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
M._moore26_init(W, W, W);

const c0 = W >> 1;
const x0 = c0 - (STR >> 1), x1 = c0 + (STR >> 1);   // core positions

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
M._moore26_mass_set(x0, c0, c0, 512);
M._moore26_mass_set(x1, c0, c0, 512);
for (let x = x0; x <= x1; x++) {
  M._moore26_winding_set(x, c0, c0, 0, TUBE_W);   // +X of edge 0
  M._moore26_winding_set(x, c0, c0, 1, TUBE_W);   // -X of edge 0
}
console.log(`moore26 harness: ${W}^3, ${TICKS} ticks, string x=${x0}..${x1} (${STR + 1} nodes @ winding=${TUBE_W})`);

const totals = () => {
  let mass = 0, wind = 0, phot = 0, massL = 0, massR = 0, cxL = 0, cxR = 0;
  for (let z = 0; z < W; z++) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const m = M._moore26_mass_get(x, y, z);
    mass += m;
    if (x < c0) { massL += m; cxL += x * m; } else { massR += m; cxR += x * m; }
    for (let c = 0; c < 26; c++) {
      wind += M._moore26_winding_get(x, y, z, c);
      phot += M._moore26_photon_get(x, y, z, c);
    }
  }
  return { mass, wind, phot, massL, massR,
           cxL: massL ? cxL / massL : 0, cxR: massR ? cxR / massR : 0 };
};

const t0 = totals();
console.log(`t=0    mass=${t0.mass} (L:${t0.cxL.toFixed(1)} R:${t0.cxR.toFixed(1)}) wind=${t0.wind} phot=${t0.phot}`);
const tStart = Date.now();
for (let t = 1; t <= TICKS; t++) {
  M._moore26_tick();
  if (t % 50 === 0 || M._moore26_events(6) !== (t === 1 ? 0 : undefined)) {
    const s = totals();
    console.log(`t=${String(t).padEnd(4)} mass=${s.mass} (L:${s.cxL.toFixed(1)} R:${s.cxR.toFixed(1)}) wind=${s.wind} phot=${s.phot} ` +
      `emit=${M._moore26_events(4)} fuse=${M._moore26_events(23)} break=${M._moore26_events(6)} annih=${M._moore26_events(9)}`);
  }
}
console.log(`${((Date.now() - tStart) / TICKS).toFixed(1)} ms/tick (wasm, ${W}^3)`);
