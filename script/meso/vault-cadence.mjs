// vault-cadence (E1 v4a): find the vault's tickable internal cycle.
// Read the directional-rest field (rget) and emit candidate order
// parameters — whichever advances steadily is the clock phase:
//   C   = circulation  (sum of parked momentum dot tangential-hat)
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

const W = 48, H = 48, D = 48, CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
wasm._meso3i_drest(1); wasm._meso3i_reflect(32);

// seedWound R5 Q48 (app-faithful)
for (let dz = -5; dz <= 5; dz++) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
  if (dx * dx + dy * dy + dz * dz > 25) continue;
  const x = CX + dx, y = CY + dy, z = CZ + dz;
  if ((x + y + z) & 1) continue;
  wasm._meso3i_set(x, y, z, REST, 48);
  const vx = -dy, vy = dx;
  for (let c = 0; c < NMOV; c++) {
    const d = vx * CV[c][0] + vy * CV[c][1];
    if (d > 0) wasm._meso3i_rset(x, y, z, c, Math.min(255, Math.round(d * 8)));
  }
}

const probe = () => {
  let C = 0, A2 = [0, 0], Em = [0, 0], tot = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r < 1 || r > 9) continue;
    let px = 0, py = 0;
    for (let c = 0; c < NMOV; c++) {
      const rb = wasm._meso3i_rget ? wasm._meso3i_rget(x, y, z, c) : 0;
      px += rb * CV[c][0]; py += rb * CV[c][1];
    }
    const th = Math.atan2(dy, dx);
    C += (px * -Math.sin(th) + py * Math.cos(th));          // circulation
    const p2 = px * px + py * py;
    if (p2 > 0) {                                          // 2nd-harmonic axis
      const a = Math.atan2(py, px);
      A2[0] += Math.cos(2 * a) * p2; A2[1] += Math.sin(2 * a) * p2;
    }
    tot += Math.sqrt(p2);
    if (r > 5.5 && r <= 9) {                               // shell flux azimuth
      let mx = 0, my = 0;
      for (let c = 0; c < NMOV; c++) {
        const q = wasm._meso3i_get(x, y, z, c);
        mx += q * CV[c][0]; my += q * CV[c][1];
      }
      Em[0] += dx * (Math.abs(mx) + Math.abs(my));
      Em[1] += dy * (Math.abs(mx) + Math.abs(my));
    }
  }
  return {
    C: C / Math.max(1, tot),
    phi2: Math.atan2(A2[1], A2[0]) / 2,
    pem: Math.atan2(Em[1], Em[0]),
    tot,
  };
};

console.log('vault-cadence: candidate clock phases vs t (static wound vault)');
for (let t = 0; t <= 2000; t++) {
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  if (t % 100 === 0) {
    const p = probe();
    console.log(`t${String(t).padStart(4)}  C=${p.C.toFixed(3)}  phi2=${p.phi2.toFixed(3)}  pem=${p.pem.toFixed(3)}  tot=${p.tot.toFixed(0)}`);
  }
}
