// clock-fizeau (E4b): does a moving medium drag a pulse?
// Corridor x in [14,52] filled with sustained moving flux at density=4 on +x or -x
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

const gridW = 72, gridH = 24, gridD = 24, centerY = gridH >> 1, centerZ = gridD >> 1;
const X0 = 14, X1 = 52, X2 = 58;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = []; let chPX = -1, chNX = -1, chDiagPX = -1, chDiagNX = -1;
for (let ch = 0; ch < nMoving; ch++) {
  const dir = [wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)];
  chanVec.push(dir);
  if (dir[0] > 0 && dir[1] === 0 && dir[2] === 0) chPX = ch;
  if (dir[0] > 0 && dir[1] !== 0 && dir[2] === 0) chDiagPX = chDiagPX < 0 ? ch : chDiagPX;
  if (dir[0] < 0 && dir[1] !== 0 && dir[2] === 0) chDiagNX = chDiagNX < 0 ? ch : chDiagNX;
  if (dir[0] < 0 && dir[1] === 0 && dir[2] === 0) chNX = ch;
}
const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(0);                     // no capture — pure coupling
  wasm._meso3i_friccurve(0); wasm._meso3i_drest(0); wasm._meso3i_reflect(0);
};
// sustained medium: re-seed the corridor's leading edge each tick so the
// flow keeps filling; direction set by channel
const feedMedium = ch => {
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((X0 + y + z) & 1) continue;
    const vEff = wasm._meso3i_get(X0, y, z, ch);
    if (vEff < 4) wasm._meso3i_set(X0, y, z, ch, 4);
  }
};
const zoneFlux = () => {
  let mass = 0;
  for (let x = X2; x <= X2 + 3; x++) for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) {
    if ((x + y + z) & 1) continue;
    mass += wasm._meso3i_get(x, y, z, chPX);   // axial sampleMoments channel only
  }
  return mass;
};
const run = (tag, mediumChan) => {
  resetEngine();
  let injectedMass = 0, tArrived = -1; const series = [];
  for (let t = 0; t < 200; t++) {
    if (mediumChan >= 0) feedMedium(mediumChan);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t === 10) {                        // medium steady by now — fire sampleMoments
      for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
        const x = 8, y = centerY + dy, z = centerZ + dz;
        if ((x + y + z) & 1) continue;
        wasm._meso3i_set(x, y, z, chPX, 48); injectedMass += 48;
      }
    }
    const mz = zoneFlux();
    if (t > 10 && tArrived < 0 && mz >= 12) tArrived = t - 10;
    if (t >= 10 && t <= 30 && t % 2 === 0) series.push(mz);
    if (tArrived > 0 && t > tArrived + 30) break;
  }
  console.log(`${tag.padEnd(18)} t=${tArrived > 0 ? tArrived : 'no arrival'}   vEff=${tArrived > 0 ? ((X2 - 10) / tArrived).toFixed(2) : '--'}  injected=${injectedMass}  zone-series=[${series.join(',')}]`);
};
console.log('clock-fizeau: sampleMoments +x transit through a moving medium (density=4)');
run('empty corridor', -1);
run('medium +x (tailwind)', chDiagPX);
run('medium -x (headwind)', chDiagNX);
