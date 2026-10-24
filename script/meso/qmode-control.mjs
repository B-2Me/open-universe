// qmode-control: sanity — does Q condensation fire at all under dense
// antipodal traffic? Pump a head-on beam pair through a site with
// IQMODE=1 (condense-only) and check iQ accumulates.
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
wasm._meso3i_clear();
wasm._meso3i_collmode(0);
wasm._meso3i_friction(0);          // no parking — pure collision regime
wasm._meso3i_fricmode(0);          // rest collides too
wasm._meso3i_qmode(1);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const cp = CV.findIndex(v => v[0] === 2 && !v[1] && !v[2]);
const cm = CV.findIndex(v => v[0] === -2 && !v[1] && !v[2]);
console.log(`head-on pair: ch${cp}=[+2,0,0] vs ch${cm}=[-2,0,0]`);

const qtot = () => {
  let q = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    q += wasm._meso3i_qget(x, y, z);
  return q;
};
for (let t = 0; t <= 200; t++) {
  if (t % 20 === 0) {
    wasm._meso3i_rg_refresh();
    console.log(`t${String(t).padStart(3)}: Q_total=${qtot()} flux=${wasm._meso3i_mov_mass()} rest=${wasm._meso3i_rest_mass()}`);
  }
  // sustained head-on injection toward center — guaranteed {c,-c} traffic
  wasm._meso3i_set(CX - 6, CY, CZ, cp, wasm._meso3i_get(CX - 6, CY, CZ, cp) + 8);
  wasm._meso3i_set(CX + 6, CY, CZ, cm, wasm._meso3i_get(CX + 6, CY, CZ, cm) + 8);
  wasm._meso3i_drain_edge(3);
  wasm._meso3i_tick();
}
