// latency-test: can a dwell-time gate separate transient flux from
// sustained carriers? Two probes:
//   SPARSE    — a flux pulse rides through the lump once every 20
//               ticks. ILAT=1 opens the gate every pulse (slow leak);
//               ILAT>20 keeps the lump frozen (transit never dwells).
//   SUSTAINED — the 18-spoke drive transits every tick. Any ILAT is
//               eventually breached: the lump must still ablate.
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

const W = 72, H = 72, D = 36;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const cPX = CV.findIndex(v => v[0] === 2 && v[1] === 0 && v[2] === 0);

const boot = lat => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4); wasm._meso3i_phot(0); wasm._meso3i_pair(0);
  wasm._meso3i_lat(lat);
};
const seedLump = () => {
  for (let dz = -5; dz <= 5; dz++)
  for (let dy = -5; dy <= 5; dy++)
  for (let dx = -5; dx <= 5; dx++) {
    if (dx*dx + dy*dy + dz*dz > 25) continue;
    const x = CX+dx, y = CY+dy, z = CZ+dz;
    if (((x+y+z)&1) !== 0 || x<0||x>=W||y<0||y>=H||z<0||z>=D) continue;
    wasm._meso3i_set(x, y, z, REST, 96);
  }
};
const led = () => { wasm._meso3i_rg_refresh(); return wasm._meso3i_rest_mass(); };
const step = () => { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); };

// --- SPARSE: one +x flux pulse every 20 ticks, fired at the lump's row ---
console.log('SPARSE pulse every 20t (transit present ~1t in 20):');
for (const lat of [1, 8, 24]) {
  boot(lat); seedLump();
  const r0 = led();
  for (let t = 0; t < 400; t++) {
    if (t % 20 === 0) {  // a short pulse: 8 quanta injected at x=4 on beam channel
      for (let u = 0; u < 8; u++)
        wasm._meso3i_set(4, CY, CZ, cPX, wasm._meso3i_get(4, CY, CZ, cPX) + 1);
    }
    step();
  }
  console.log(`  ILAT=${String(lat).padEnd(2)}: rest ${r0} -> ${led()}`);
}

// --- SUSTAINED: the drive transits the lump every tick -------------------
console.log('SUSTAINED drive (transit every tick):');
const spokes = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    const sx = CX - 3*vx, sy = CY - 3*vy, sz = CZ - 3*vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};
for (const lat of [1, 8, 24]) {
  boot(lat); seedLump();
  const r0 = led();
  for (let t = 0; t < 300; t++) { spokes(); step(); }
  console.log(`  ILAT=${String(lat).padEnd(2)}: rest ${r0} -> ${led()}`);
}

// --- WIND under latency: standing pair collision + IPAIR ----------------
console.log('WIND standing pair-collision (IPAIR on):');
const cMX = CV.findIndex(v => v[0] === -2 && v[1] === 0 && v[2] === 0);
for (const lat of [1, 8]) {
  boot(lat); wasm._meso3i_pair(1);
  for (let t = 0; t < 300; t++) {
    for (let u = 0; u < 4; u++) {
      wasm._meso3i_set(CX-2, CY, CZ, cPX, wasm._meso3i_get(CX-2, CY, CZ, cPX) + 1);
      wasm._meso3i_set(CX+2, CY, CZ, cMX, wasm._meso3i_get(CX+2, CY, CZ, cMX) + 1);
    }
    step();
  }
  console.log(`  ILAT=${lat}: rest at node=${wasm._meso3i_get(CX, CY, CZ, REST)} · total ${led()}`);
}
