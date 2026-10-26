// clock-fizeau (E4b): does a moving medium drag a pulse?
// Corridor x in [14,52] filled with sustained mov flux at q=4 on +x or -x
// channel (the medium). Probe +x pulse launched at x=8, timed to x>=58.
// Empty corridor = control. Fresnel drag: v_eff shifts with medium's
// velocity; ballistic medium: no shift.
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

const W = 72, H = 24, D = 24, CY = H >> 1, CZ = D >> 1;
const X0 = 14, X1 = 52, X2 = 58;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1, XMX = -1, PDX = -1, MDX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
  if (v[0] > 0 && v[1] !== 0 && v[2] === 0) PDX = PDX < 0 ? c : PDX;
  if (v[0] < 0 && v[1] !== 0 && v[2] === 0) MDX = MDX < 0 ? c : MDX;
  if (v[0] < 0 && v[1] === 0 && v[2] === 0) XMX = c;
}
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(0);                     // no capture — pure coupling
  wasm._meso3i_friccurve(0); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
};
// sustained medium: re-seed the corridor's leading edge each tick so the
// flow keeps filling; direction set by channel
const feedMedium = ch => {
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((X0 + y + z) & 1) continue;
    const v = wasm._meso3i_get(X0, y, z, ch);
    if (v < 4) wasm._meso3i_set(X0, y, z, ch, 4);
  }
};
const movZone = () => {
  let m = 0;
  for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    m += wasm._meso3i_get(x, y, z, XPX);   // axial probe channel only
  }
  return m;
};
const run = (tag, mch) => {
  boot();
  let m0 = 0, tHit = -1; const series = [];
  for (let t = 0; t < 200; t++) {
    if (mch >= 0) feedMedium(mch);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t === 10) {                        // medium steady by now — fire probe
      for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
        const x = 8, y = CY + dy, z = CZ + dz;
        if ((x + y + z) & 1) continue;
        wasm._meso3i_set(x, y, z, XPX, 48); m0 += 48;
      }
    }
    const mz = movZone();
    if (t > 10 && tHit < 0 && mz >= 12) tHit = t - 10;
    if (t >= 10 && t <= 30 && t % 2 === 0) series.push(mz);
    if (tHit > 0 && t > tHit + 30) break;
  }
  console.log(`${tag.padEnd(18)} t=${tHit > 0 ? tHit : 'no arrival'}   v=${tHit > 0 ? ((X2 - 10) / tHit).toFixed(2) : '--'}  injected=${m0}  zone-series=[${series.join(',')}]`);
};
console.log('clock-fizeau: probe +x transit through a moving medium (q=4)');
run('empty corridor', -1);
run('medium +x (tailwind)', PDX);
run('medium -x (headwind)', MDX);
