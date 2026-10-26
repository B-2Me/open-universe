// clock-capacity (E12): capacity-stealing as a clock channel.
// A Q-emitter node (IQMODE 6, iPH phase clock) fires on (ITICK+iPH)&3==0.
// The beat is ITICK-locked so timing cannot dilate — but under sustained
// transit flux, does the emitter's OUTPUT per beat drop (bandwidth spent
// processing traffic) or does capture refill Q (the opposite effect)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const wasm = await mod.exports();
const W = 48, H = 24, D = 24, CX = 24, CY = 12, CZ = 12;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1;
let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const run = (wind) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_qmode(6);
  // Q-emitter cluster at center, all phase 0
  for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = CX + 2 * dx, y = CY + 2 * dy, z = CZ + 2 * dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, 8); wasm._meso3i_pset(x, y, z, 0);
  }
  let emit = 0, series = [];
  for (let t = 0; t < 200; t++) {
    // sustained transverse +x wind sheet upstream of the emitter
    if (wind) for (let z = 2; z < D - 2; z++) for (let y = 2; y < H - 2; y++) {
      if ((4 + y + z) & 1) continue;
      const v = wasm._meso3i_get(4, y, z, XPX);
      if (v < 240) wasm._meso3i_set(4, y, z, XPX, v + wind);
    }
    wasm._meso3i_ev_reset();
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    emit += wasm._meso3i_ev(2);
    if (t % 40 === 0) {
      let q = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++)
        q += wasm._meso3i_qget(CX + dx, CY + dy, CZ + dz);
      series.push(`t${t}:Q${q} ph${wasm._meso3i_pget(CX, CY, CZ)}`);
    }
  }
  console.log(`wind=${String(wind).padStart(2)}  emitted=${emit.toFixed(0)}  [${series.join(' ')}]`);
};
console.log('E12 — capacity-stealing: Q-emitter output vs transit flux');
for (const w of [0, 2, 8, 32]) run(w);
