// eos-thermalize: M46 closed-box equation of state. No drive, no
// drain (wrap = periodic on all axes). Seed a strongly anisotropic
// channel distribution, let pure collisions thermalize, and watch
// Pi_ij relax to the isotropic value P = (16/18) rho.
//
// Two starts: (a) +-x axials only (zero net momentum), (b) +x only
// (net drift — isotropizes modulo the conserved momentum).
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
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(0);      // pure gas — nothing parks
  wasm._meso3i_fricmode(0);      // rest channel collides like any other
  wasm._meso3i_drest(0);
};

// seed `q` quanta on channel `c` at every live site in a central slab
const seedChan = (match, q) => {
  for (let z = CZ - 6; z <= CZ + 6; z++) for (let y = CY - 12; y <= CY + 12; y++)
    for (let x = CX - 12; x <= CX + 12; x++) {
      if ((x + y + z) & 1) continue;
      for (let c = 0; c < NMOV; c++)
        if (match(CV[c]))
          wasm._meso3i_set(x, y, z, c, wasm._meso3i_get(x, y, z, c) + q);
    }
};

const measure = () => {
  let rho = 0, Pxx = 0, Pyy = 0, Pzz = 0, Pxy = 0, px = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_get(x, y, z, c);
      if (!n) continue;
      rho += n; px += n * CV[c][0];
      Pxx += n * CV[c][0] * CV[c][0]; Pyy += n * CV[c][1] * CV[c][1];
      Pzz += n * CV[c][2] * CV[c][2]; Pxy += n * CV[c][0] * CV[c][1];
    }
  }
  return { rho, Pxx, Pyy, Pzz, Pxy, px };
};

const run = (tag, seed) => {
  boot(); seed();
  console.log(`\n=== ${tag} ===`);
  for (let t = 0; t <= 200; t++) {
    if (t % 25 === 0) {
      const m = measure();
      const P = (m.Pxx + m.Pyy + m.Pzz) / 3;
      const iso = rho => 16 / 18;
      console.log(`t${String(t).padStart(3)}: ρ=${m.rho} px=${m.px} | ` +
        `Pxx=${m.Pxx} Pyy=${m.Pyy} Pzz=${m.Pzz} | ` +
        `anis=${((m.Pxx - P) / P).toFixed(3)} | P/ρ=${(P / m.rho).toFixed(3)} (iso ${iso().toFixed(3)})`);
    }
    wasm._meso3i_tick();          // NO drain — closed box (periodic)
  }
};

run('(a) +-x axials only (zero net p)', () =>
  seedChan(v => v[1] === 0 && v[2] === 0 && Math.abs(v[0]) === 2, 8));
run('(b) +x axial only (net drift)', () =>
  seedChan(v => v[0] === 2 && v[1] === 0 && v[2] === 0, 8));
