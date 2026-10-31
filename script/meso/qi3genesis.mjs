// qi3 spontaneous-structure census: inject photon noise into vacuum,
// run the cycle, census what self-organizes — lumps, winding, levels.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N = 32;
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);

// noise bath: random photons at random sites/channels, nu 100-255
let rng = 12345;
const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff);
for (let i = 0; i < 60000; i++) {
  const x = rnd() % N, y = rnd() % N, z = rnd() % N, c = rnd() % 18;
  q._qi3_photon_set(x, y, z, c, 20 + rnd() % 60);
  q._qi3_photon_nu_set(x, y, z, c, 100 + rnd() % 156);
}

// run the cycle
const t0 = Date.now();
for (let t = 0; t < 200; t++) q._qi3_tick();

// census: massive sites, their charge/winding/levels
let lumps = 0, chargeTot = 0, windTot = 0, levelHist = {};
const sites = [];
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const m = q._qi3_mass_get(x, y, z);
  if (!m) continue;
  lumps++;
  chargeTot += q._qi3_charge_get(x, y, z);
  let w = 0;
  for (let c = 0; c < 18; c++) w += q._qi3_winding_get(x, y, z, c);
  windTot += w;
  const lv = 1 + Math.floor(w / 256);
  levelHist[Math.min(lv, 8)] = (levelHist[Math.min(lv, 8)] || 0) + 1;
  if (sites.length < 8) sites.push(`(${x},${y},${z}) m=${m} chg=${q._qi3_charge_get(x,y,z)} wind=${w} lvl=${Math.min(lv,8)}`);
}
console.log(`--- qi3 genesis census (${Date.now()-t0}ms for 200 ticks) ---`);
console.log(`nucleated massive sites: ${lumps} / ${N**3}`);
console.log(`total bound charge: ${chargeTot}   total winding: ${windTot}`);
console.log(`level histogram (n -> count):`, JSON.stringify(levelHist));
console.log(`fusion events: ${Number(q._qi3_event(23))}  annih events: ${Number(q._qi3_event(5))}`);
console.log(`absorbs: ${Number(q._qi3_event(3))}  emits: ${Number(q._qi3_event(4))}  stims: ${Number(q._qi3_event(17))}`);
console.log('sample lumps:', sites.join(' | '));
