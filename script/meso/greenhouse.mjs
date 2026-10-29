// greenhouse (E20): radiative trapping — a hot lump inside a photon-
// absorbing bath, closed box (no drain). Under IPHOT=5 the bath can
// STORE the lump's radiation as excitation n and re-emit — a thermal
// blanket. Compare lump cooling vs vacuum (IPHOT=4 control + open).
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
const W = 48, H = 48, D = 48, CX = 24, CY = 24, CZ = 24;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const run = (phot, bathQ, drain) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(0);
  wasm._meso3i_fricmode(16); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  if (wasm._meso3i_scatter) wasm._meso3i_scatter(Number(process.env.SCATTER || 0));
  wasm._meso3i_phot(phot);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 <= 16) wasm._meso3i_set(x, y, z, REST, 128);
    else if (r2 <= 324) wasm._meso3i_set(x, y, z, REST, bathQ); // parked bath shell
  }
  const series = [];
  for (let t = 0; t < 400; t++) {
    if (drain) wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t % 50 === 0) {
      let lr = 0, ln = 0, bn = 0;
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        const dx = x - CX, dy = y - CY, dz = z - CZ;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 <= 16) { lr += wasm._meso3i_get(x, y, z, REST); ln += wasm._meso3i_eget(x, y, z); }
        else if (r2 <= 324) bn += wasm._meso3i_eget(x, y, z);
      }
      series.push(`t${t}:r${lr}n${ln}b${bn}`);
    }
  }
  console.log(`phot=${phot} bathQ=${bathQ} drain=${drain}  [${series.join(' ')}]`);
};
console.log('E20 — greenhouse: can the bath trap the lump\'s radiation?');
run(5, 8, 0);   // photon-absorbing bath, closed box — the earth-surface analog
run(5, 0, 0);   // no bath — lump radiating into closed vacuum
run(5, 8, 1);   // bath + drained — radiation escapes at the walls
