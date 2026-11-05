/* vacuum-isotropy — the substrate baseline: a single volumetric
 * photon source in cold vacuum, all 12 edge channels armed at the
 * center. Under the FCC gate (edges equidistant at sqrt(2)) the front
 * must expand isotropically — equal reach in every direction at equal
 * tick. Starburst/anisotropy would read as per-direction skew. */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };

import { createRequire } from 'module';
const gluePath = resolve(ROOT, 'docs/public/wasm/cascade/moore26.js');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  readFileSync(gluePath, 'utf8'))(mod, mod.exports, createRequire(gluePath), dirname(gluePath), gluePath);
const M = await mod.exports();

const W = parseInt(arg('w', '64')), T = parseInt(arg('t', '20'));
const c0 = W >> 1;
M._moore26_init(W, W, W);

/* point source: one tick of photons on every edge channel at center */
for (let c = 6; c < 18; c++) {
  M._moore26_photon_set(c0, c0, c0, c, 200);
  M._moore26_photon_nu_set(c0, c0, c0, c, 96);
}
/* then propagate — no re-injection, just the front */
for (let t = 0; t < T; t++) M._moore26_tick();

/* measure reach along each edge direction: farthest live cell's
 * projection on that channel's vector. Isotropy => all ~equal. */
const reach = {};
for (let c = 6; c < 18; c++) {
  const vx = M._moore26_cvc(c, 0), vy = M._moore26_cvc(c, 1), vz = M._moore26_cvc(c, 2);
  let best = 0, tot = 0;
  for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) for (let z = 0; z < W; z++) {
    if (M._moore26_photon_get(x, y, z, c) > 0) {
      tot++;
      const d = (x - c0) * vx + (y - c0) * vy + (z - c0) * vz;
      if (d > best) best = d;
    }
  }
  reach[c] = { dir: `(${vx},${vy},${vz})`, reach: best, cells: tot };
}
const rs = Object.values(reach).map(r => r.reach);
const mean = rs.reduce((a, b) => a + b) / rs.length;
const spread = Math.max(...rs) - Math.min(...rs);
console.log(`vacuum isotropy @ ${W}^3, t=${T}:`);
for (const [c, r] of Object.entries(reach))
  console.log(`  ch${c} ${r.dir}: reach=${r.reach} cells=${r.cells}`);
console.log(`mean reach=${mean.toFixed(1)}  spread=${spread} ${spread === 0 ? 'ISOTROPIC' : 'ANISOTROPIC'}`);
/* a perfectly isotropic front has spread==0 (every edge direction
 * covers the same count of hops in the same ticks). */
