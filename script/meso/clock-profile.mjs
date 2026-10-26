// clock-profile (E3): does ambient congestion around a steady source fall
// as 1/r (diffusive, Laplace — matches GR's Phi~1/r) or 1/r^2 (ballistic)?
// A continuous central injector vs. boundary drain reaches a steady radial
// gradient; shell-averaged moving density vs r gives the exponent.
// Second sampleMoments: occupancy halo around a parked mass lump under the same
// ambient field — the profile a "clock" would actually sit inside.
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

const gridW = 56, gridH = 56, gridD = 56;
const centerX = gridW >> 1, centerY = gridH >> 1, centerZ = gridD >> 1;
if (wasm._meso3i_init(gridW, gridH, gridD, 1) !== 0) throw new Error('init failed');
const nChannels = wasm._meso3i_nch(), nMoving = nChannels - 1, restCh = nChannels - 1;
const chanVec = [];
for (let ch = 0; ch < nMoving; ch++)
  chanVec.push([wasm._meso3i_cvc(ch, 0), wasm._meso3i_cvc(ch, 1), wasm._meso3i_cvc(ch, 2)]);

const resetEngine = () => {
  wasm._meso3i_init(gridW, gridH, gridD, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(128);
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};

// central source: +1 quantum on every moving channel at the core each tick
// dense variant: pump the source to near-saturation so the field is
// collision-dominated — does the transport regime go diffusive (1/r)?
const RATE = +(process.argv[2] || 1);
const inject = () => {
  for (let ch = 0; ch < nMoving; ch++) {
    const vEff = wasm._meso3i_get(centerX, centerY, centerZ, ch);
    if (vEff < 240) wasm._meso3i_set(centerX, centerY, centerZ, ch, vEff + RATE);
  }
};

// shell-averaged density: mean occupancy per live site in [r, r+1)
const profile = (what) => {
  const RMAX = Math.min(centerX, centerY, centerZ) - 4;
  const shellSum = new Float64Array(RMAX), shellCount = new Float64Array(RMAX);
  for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - centerX, dy = y - centerY, dz = z - centerZ;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const sh = Math.floor(r);
    if (sh < 1 || sh >= RMAX) continue;
    let density = 0;
    if (what === 'moving') for (let ch = 0; ch < nMoving; ch++) density += wasm._meso3i_get(x, y, z, ch);
    else density = wasm._meso3i_get(x, y, z, restCh);
    shellSum[sh] += density; shellCount[sh]++;
  }
  const profileRows = [];
  for (let r = 1; r < RMAX; r++)
    if (shellCount[r] > 20) profileRows.push([r, shellSum[r] / shellCount[r]]);
  return profileRows;
};

// log-log slope over r in [r0, r1] via least squares
const slope = (profileRows, r0, r1) => {
  const fitPts = profileRows.filter(([r, shellDensity]) => r >= r0 && r <= r1 && shellDensity > 0);
  if (fitPts.length < 3) return NaN;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [r, shellDensity] of fitPts) {
    const lx = Math.log(r), ly = Math.log(shellDensity);
    sumX += lx; sumY += ly; sumXY += lx * ly; sumXX += lx * lx;
  }
  const siteCount = fitPts.length;
  return (siteCount * sumXY - sumX * sumY) / (siteCount * sumXX - sumX * sumX);
};

const SETTLE = 600;
console.log(`E3 — radial congestion profile (RATE=${RATE}): exponent of rho(r) ~ r^k`);
console.log('    k = -2.0 ballistic rays | k = -1.0 diffusive (Laplace, GR-like)\n');

// sampleMoments A: central flux source vs boundary drain
resetEngine();
for (let t = 0; t < SETTLE; t++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
const moving = profile('moving');
console.log('r   rho_mov/site');
for (const [r, shellDensity] of moving) console.log(`${String(r).padStart(3)} ${shellDensity.toFixed(3)}`);
for (const [r0, r1] of [[4, 12], [6, 20], [8, 24]])
  console.log(`  moving slope r[${r0}..${r1}] = ${slope(moving, r0, r1).toFixed(2)}`);

// sampleMoments B: same field but a parked mass lump instead of a bare source
resetEngine();
for (let z = 0; z < gridD; z++) for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
  if ((x + y + z) & 1) continue;
  const dx = x - centerX, dy = y - centerY, dz = z - centerZ;
  if (dx * dx + dy * dy + dz * dz <= 25) wasm._meso3i_set(x, y, z, restCh, 48);
}
for (let t = 0; t < SETTLE; t++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
const movingLump = profile('moving');
console.log('\nlump present — moving halo outside the body (r>6):');
for (const [r0, r1] of [[7, 14], [8, 24]])
  console.log(`  moving slope r[${r0}..${r1}] = ${slope(movingLump, r0, r1).toFixed(2)}`);
