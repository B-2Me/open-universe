// blackbody (E18): radiative cooling of a hot lump — the substrate's
// declared analog. Honest label: free-space emission into an open
// drained box, not cavity equilibrium. A hot lump's photon output vs
// its remaining excitation. IFRICM>0 = unconditional
// emit ~1/(4k) per quantum; IPHOT=4 makes the emit gate output photons.
// Measure photon-production rate vs parked mass as the lump cools —
// linear-in-mass (exponential) or a different law?
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
const run = (k, bath) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(0);
  wasm._meso3i_fricmode(k);          // k>0 = unconditional blackbody emit
  wasm._meso3i_drest(0); wasm._meso3i_reflect(0); wasm._meso3i_phot(4);
  // hot lump: rest=128 in r<=4
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 16) wasm._meso3i_set(x, y, z, REST, 128);
  }
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  const series = [];
  const reseed = () => {              // sustained reservoir — NOT ambient equilibrium
    if (!bath) return;
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((x + y + z) & 1) continue;
      const dx = x - CX, dy = y - CY, dz = z - CZ;
      if (dx * dx + dy * dy + dz * dz <= 16) continue;
      if ((x * 3 + y * 5 + z * 7) % 11 === 0) {
        const ch = (x + 2 * y + 3 * z) % NMOV;
        const v = wasm._meso3i_get(x, y, z, ch);
        if (v < 4) wasm._meso3i_set(x, y, z, ch, 4);
      }
    }
  };
  for (let t = 0; t < 400; t++) {
    reseed();
    wasm._meso3i_ev_reset();           // per-tick emit count = photon rate
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 20 === 0) {
      wasm._meso3i_rg_refresh();
      series.push(`t${t}:r${wasm._meso3i_rest_mass()}`);
    }
  }
  wasm._meso3i_ev_reset();
  for (let t = 0; t < 40; t++) { reseed(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  const rate = wasm._meso3i_ev(2) / 40;
  wasm._meso3i_rg_refresh();
  console.log(`k=${k} bath=${bath}  rest ${r0} -> ${wasm._meso3i_rest_mass()}  emit_rate=${rate.toFixed(1)}/t  [${series.join(' ')}]`);
};
console.log('E18b — hot lump under SUSTAINED flux drive (infinite reservoir)');
for (const k of [4, 16]) { run(k, false); run(k, true); }

// E18c — the honest "earth surface": a FINITE parked bath that can
// equilibrate with the lump (no reseed — shared reservoir).
const runEq = (k, bathQ) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-k);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_phot(4);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 <= 16) wasm._meso3i_set(x, y, z, REST, 128);       // hot lump
    else if (r2 <= 196) wasm._meso3i_set(x, y, z, REST, bathQ); // finite parked bath shell
  }
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  const series = [];
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 40 === 0) { wasm._meso3i_rg_refresh(); series.push(`t${t}:r${wasm._meso3i_rest_mass()}`); }
  }
  // lump-vs-bath split at end
  wasm._meso3i_rg_refresh();
  let inLump = 0, inBath = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r2 = dx * dx + dy * dy + dz * dz;
    const m = wasm._meso3i_get(x, y, z, REST);
    if (r2 <= 16) inLump += m; else if (r2 <= 196) inBath += m;
  }
  console.log(`k=${k} bathQ=${bathQ}  total ${r0}->${wasm._meso3i_rest_mass()}  lump=${inLump} bath=${inBath}  [${series.join(' ')}]`);
};
console.log('E18c — finite parked bath: does the lump equilibrate or keep accreting?');
runEq(4, 4); runEq(4, 16);

// E18d — finite MOVING bath: carriers that can exchange AND deplete.
// Seed a one-shot shell of dilute flux around the lump — the honest
// equilibration question: lump cools into the bath, bath drains away.
const runEqMov = (k, bathQ) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-k);
  wasm._meso3i_fricp(128); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
  wasm._meso3i_phot(4);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 <= 16) wasm._meso3i_set(x, y, z, REST, 128);
    else if (r2 <= 196 && (x * 3 + y * 5 + z * 7) % 3 === 0)
      wasm._meso3i_set(x, y, z, (x + 2 * y + 3 * z) % NMOV, bathQ);
  }
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  const series = [];
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 40 === 0) {
      wasm._meso3i_rg_refresh();
      let inLump = 0;
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        const dx = x - CX, dy = y - CY, dz = z - CZ;
        if (dx * dx + dy * dy + dz * dz <= 16) inLump += wasm._meso3i_get(x, y, z, REST);
      }
      series.push(`t${t}:L${inLump}T${wasm._meso3i_rest_mass()}`);
    }
  }
  console.log(`k=${k} bathQ=${bathQ}  [${series.join(' ')}]`);
};
console.log('E18d — finite moving bath: lump-vs-bath equilibration');
runEqMov(4, 4); runEqMov(4, 16);
