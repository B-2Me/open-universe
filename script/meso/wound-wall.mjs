// wound-wall: the IREFL x IDREST cell that the iR fix unlocked.
// Before the fix, the refusal wall was blind to directional rest — a wound
// lump at any density never triggered IREFL. Post-fix the wall sees wound
// mass for the first time. Question: what does a spin-storing lump do
// behind a refusal crust? Does the crust itself hold directional spin?
// Does the wall protect Lz_park under beam ablation?
//
// Same seeded-fossil protocol as drift-replicate (mass-matched by
// construction): R5 lump, scalar rest 48 + wound directional bins (M45's
// winding), settle 60t, +x beam 800t. Telemetry: parked Lz summed in
// Chebyshev shells r0..r7 — crust-localized spin shows as shell growth.
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

const W = 44, H = 44, D = 44;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = refl => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(1);          // the wound regime
  wasm._meso3i_fricp(128);
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(refl);
};

// M45's winding: scalar rest Q + directional bins spun about z, sign s
const woundLump = (R = 5, Q = 48, s = 1) => {
  let m0 = 0, lz0 = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    wasm._meso3i_set(x, y, z, REST, Q); m0 += Q;
    const vx = -s * dy, vy = s * dx;
    for (let c = 0; c < NMOV; c++) {
      const d = vx * CV[c][0] + vy * CV[c][1];
      if (d > 0) {
        const n = Math.min(255, Math.round(d * 8));
        wasm._meso3i_rset(x, y, z, c, n);
        m0 += n; lz0 += dx * n * CV[c][1] - dy * n * CV[c][0];
      }
    }
  }
  return [m0, lz0];
};

const beam = sign => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    if (vx * sign <= 0) continue;
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};

// parked Lz + parked mass + scalar rest, summed per Chebyshev shell
const shells = () => {
  const L = new Array(8).fill(0), pk = new Array(8).fill(0), sc = new Array(8).fill(0);
  let cmx = 0, mtot = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.max(Math.abs(x - CX), Math.abs(y - CY), Math.abs(z - CZ));
    if (r > 7) continue;
    sc[r] += wasm._meso3i_get(x, y, z, REST);
    let rx = 0, ry = 0, m = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_rget(x, y, z, c);
      rx += n * CV[c][0]; ry += n * CV[c][1]; pk[r] += n; m += n;
    }
    L[r] += (x - CX) * ry - (y - CY) * rx;
    cmx += x * (m + wasm._meso3i_get(x, y, z, REST));
    mtot += m + wasm._meso3i_get(x, y, z, REST);
  }
  return [L, pk, sc, mtot ? cmx / mtot : CX];
};

const SETTLE = 60, BEAM_T = 800;
const run = (refl, sign, tag) => {
  boot(refl);
  wasm._meso3i_ev_reset();
  const [m0, lz0] = woundLump();
  console.log(`\n=== ${tag} (seeded mass ${m0}, seeded Lz ${lz0}) ===`);
  for (let t = 0; t <= SETTLE + BEAM_T; t++) {
    if (t > SETTLE && sign) beam(sign);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t % 200 === 0 || t === SETTLE || t === SETTLE + BEAM_T) {
      const [L, pk, sc, cmx] = shells();
      const lz = L.reduce((a, b) => a + b, 0), pkT = pk.reduce((a, b) => a + b, 0),
            scT = sc.reduce((a, b) => a + b, 0);
      console.log(`  t${String(t).padStart(4)}: Lz_park=${String(lz).padStart(7)} cm_x=${cmx.toFixed(3)}` +
        ` pk=${pkT} sc=${scT} park=${wasm._meso3i_ev(0)} refl=${wasm._meso3i_ev(6)}`);
      console.log(`        Lz by shell r0..r7: ${L.map(v => String(v).padStart(6)).join(' ')}`);
      console.log(`        pk by shell r0..r7: ${pk.map(v => String(v).padStart(6)).join(' ')}`);
    }
  }
};

run(0, 0, 'IDREST IREFL=0  no-beam (wound fossil at rest)');
run(0, +1, 'IDREST IREFL=0  +x beam');
run(32, 0, 'IDREST IREFL=32 no-beam (wall sees wound mass?)');
run(32, +1, 'IDREST IREFL=32 +x beam (wound lump behind crust)');
