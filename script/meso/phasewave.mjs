// phasewave (E6): IQMODE 6 gives every site a 2-bit beat phase iPH.
// CORRECTED: phset is the PHOTON setter — the first version's ramp calls
// wrote photons, not phases. pset is now exported (build.sh) so the
// ramp test below is the REAL spatial-relay measurement.
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

const W = 64, H = 16, D = 16, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), REST = NCH - 1;

const run = (tag, ramp) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_qmode(6);
  // Q-filled slab x in [8,52], all at q=4
  for (let x = 8; x <= 52; x++) for (let z = 4; z < D - 4; z++) for (let y = 4; y < H - 4; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, 4);
    wasm._meso3i_pset(x, y, z, ramp === 'x' ? (x >> 1) & 3 : ramp === 'sum' ? ((x + y + z) >> 1) & 3 : 0);
  }
  // mean x of emission sites per tick (Q drop = emitted)
  const emits = [];
  for (let t = 0; t < 12; t++) {
    let sx = 0, n = 0, tot = 0;
    for (let x = 8; x <= 52; x++) for (let z = 4; z < D - 4; z++) for (let y = 4; y < H - 4; y++) {
      if ((x + y + z) & 1) continue;
      const q = wasm._meso3i_qget(x, y, z);
      tot += q;
      if (q < 4) { sx += x; n++; }
    }
    emits.push(`t${t}:${n > 0 ? (sx / n).toFixed(1) : '--'}(${n})`);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  console.log(`${tag.padEnd(6)} emit-x: ${emits.join(' ')}`);
};
console.log('E6 — phased-beat relay: mean-x of Q-emission sites per tick');
run('flat', 0);       // iPH=0 everywhere — synchronous
run('x', 'x');        // iPH = x/2 mod 4 — ramped bucket brigade
run('sum', 'sum');    // iPH = (x+y+z)/2 mod 4 — diagonal wave
