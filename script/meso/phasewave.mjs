// phasewave (E6): IQMODE 6 gives every site a 2-bit beat phase iPH.
// CORRECTED: phset is the PHOTON setter â€” the first version's rampMode calls
// wrote photons, not phases. pset is now exported (build.sh) so the
// rampMode test below is the REAL spatial-relay measurement.
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

const gridW = 64, gridH = 16, gridD = 16, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), restCh = nChannels - 1;

const run = (tag, rampMode) => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0); wasm._meso3i_drest(0);
  wasm._meso3i_reflect(0); wasm._meso3i_qmode(6);
  // Q-filled slab x in [8,52], all at density=4
  for (let x = 8; x <= 52; x++) for (let z = 4; z < gridD - 4; z++) for (let y = 4; y < gridH - 4; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_qset(x, y, z, 4);
    wasm._meso3i_pset(x, y, z, rampMode === 'x' ? (x >> 1) & 3 : rampMode === 'sum' ? ((x + y + z) >> 1) & 3 : 0);
  }
  // mean x of emission sites per tick (Q drop = emitted)
  const emitLog = [];
  for (let t = 0; t < 12; t++) {
    let sx = 0, siteCount = 0, tot = 0;
    for (let x = 8; x <= 52; x++) for (let z = 4; z < gridD - 4; z++) for (let y = 4; y < gridH - 4; y++) {
      if ((x + y + z) & 1) continue;
      const density = wasm._meso3i_qget(x, y, z);
      tot += density;
      if (density < 4) { sx += x; siteCount++; }
    }
    emitLog.push(`t${t}:${siteCount > 0 ? (sx / siteCount).toFixed(1) : '--'}(${siteCount})`);
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  console.log(`${tag.padEnd(6)} emit-x: ${emitLog.join(' ')}`);
};
console.log('E6 â€” phased-beat relay: mean-x of Q-emission sites per tick');
run('flat', 0);       // iPH=0 everywhere â€” synchronous
run('x', 'x');        // iPH = x/2 mod 4 â€” ramped bucket brigade
run('sum', 'sum');    // iPH = (x+y+z)/2 mod 4 â€” diagonal wave
