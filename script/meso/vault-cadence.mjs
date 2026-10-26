// vault-cadence (E1 v4a): find the vault's tickable internal cycle.
// Read the directional-rest field (rget) and emit candidate order
// parameters — whichever advances steadily is the clock phase:
//   C   = circulation  (shellSum of parked momentum dot tangential-hat)
//   phi2 = stripe-axis phase (second-harmonic anisotropy of parked dir)
//   pem  = emission azimuth (angle of flux in the shell just outside)
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

const gridW = 48, gridH = 48, gridD = 48, centerX = gridW >> 1, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = [];
for (let ch = 0; ch < nMoving; ch++)
  chanVec.push([wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)]);

wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
wasm._meso3i_drest(1); wasm._meso3i_reflect(32);

// seedWound R5 Q48 (app-faithful)
for (let dz = -5; dz <= 5; dz++) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
  if (dx * dx + dy * dy + dz * dz > 25) continue;
  const x = centerX + dx, y = centerY + dy, z = centerZ + dz;
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, restCh, 48);
  const vx = -dy, vy = dx;
  for (let ch = 0; ch < nMoving; ch++) {
    const winding = vx * chanVec[ch][0] + vy * chanVec[ch][1];
    if (winding > 0) wasm._meso3i_rset(x, y, z, ch, Math.min(255, Math.round(winding * 8)));
  }
}

const sampleMoments = () => {
  let C = 0, A2 = [0, 0], Em = [0, 0], binTotal = 0;
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - centerX, dy = y - centerY, dz = z - centerZ;
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (radius < 1 || radius > 9) continue;
    let px = 0, py = 0;
    for (let ch = 0; ch < nMoving; ch++) {
      const rb = wasm._meso3i_rget ? wasm._meso3i_rget(x, y, z, ch) : 0;
      px += rb * chanVec[ch][0]; py += rb * chanVec[ch][1];
    }
    const th = Math.atan2(dy, dx);
    C += (px * -Math.sin(th) + py * Math.cos(th));          // circulation
    const p2 = px * px + py * py;
    if (p2 > 0) {                                          // 2nd-harmonic axis
      const a = Math.atan2(py, px);
      A2[0] += Math.cos(2 * a) * p2; A2[1] += Math.sin(2 * a) * p2;
    }
    binTotal += Math.sqrt(p2);
    if (radius > 5.5 && radius <= 9) {                               // shell flux azimuth
      let mx = 0, my = 0;
      for (let ch = 0; ch < nMoving; ch++) {
        const density = wasm._meso3i_get(x, y, z, ch);
        mx += density * chanVec[ch][0]; my += density * chanVec[ch][1];
      }
      Em[0] += dx * (Math.abs(mx) + Math.abs(my));
      Em[1] += dy * (Math.abs(mx) + Math.abs(my));
    }
  }
  return {
    C: C / Math.max(1, binTotal),
    phi2: Math.atan2(A2[1], A2[0]) / 2,
    pem: Math.atan2(Em[1], Em[0]),
    binTotal,
  };
};

console.log('vault-cadence: candidate clock phases vs t (static wound vault)');
for (let t = 0; t <= 2000; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  if (t % 100 === 0) {
    const sample = sampleMoments();
    console.log(`t${String(t).padStart(4)}  C=${sample.C.toFixed(3)}  phi2=${sample.phi2.toFixed(3)}  pem=${sample.pem.toFixed(3)}  binTotal=${sample.binTotal.toFixed(0)}`);
  }
}
