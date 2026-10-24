// drest-test: THE directional-rest experiment. Inject the canonical
// vortex ring, then track Lz over 200 ticks in three ledgers:
//   Lz_mov   — circulation still in flight (moving channels)
//   Lz_park  — directional momentum stored in rest[c] bins (IDREST)
//   Lz_tot   — the sum: the quantity that scalar rest destroys
//
// If rest[18] works, the parked population keeps its channel
// imbalance → Lz_tot plateaus instead of crashing to ~0 by t=40.
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

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = drest => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(drest);
};

const tang = (dx, dy) => {
  const l = Math.hypot(dx, dy) || 1, tx = -dy / l, ty = dx / l;
  let best = -1, bd = -Infinity;
  for (let c = 0; c < NMOV; c++) {
    if (CV[c][2] !== 0) continue;
    const dot = CV[c][0] * tx + CV[c][1] * ty;
    if (dot > bd) { bd = dot; best = c; }
  }
  return best;
};
const ring = () => {
  let placed = 0;
  for (const r of [5, 4]) {
    const steps = Math.ceil(2 * Math.PI * r) + 1;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * 2 * Math.PI;
      const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
      if (((x + y + CZ) & 1) !== 0) continue;
      const c = tang(x - CX, y - CY);
      if (c < 0) continue;
      wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
      placed++;
    }
  }
  return placed;
};

// Lz about center; reads moving channels AND (if nonzero) the parked
// directional bins — the sum is the honest angular momentum ledger
const ledgers = useR => {
  let Lm = 0, Lr = 0, flux = 0, prk = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let px = 0, py = 0, f = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_get(x, y, z, c);
      if (!n) continue;
      px += n * CV[c][0]; py += n * CV[c][1]; f += n;
    }
    Lm += (x - CX) * py - (y - CY) * px;
    flux += f;
    if (useR) {
      let rx = 0, ry = 0, rr = 0;
      for (let c = 0; c < NMOV; c++) {
        const n = wasm._meso3i_rget(x, y, z, c);
        if (!n) continue;
        rx += n * CV[c][0]; ry += n * CV[c][1]; rr += n;
      }
      Lr += (x - CX) * ry - (y - CY) * rx;
      prk += rr;
    }
  }
  return [Lm, Lr, flux, prk];
};

console.log(' d |   t | Lz_mov | Lz_park | Lz_tot | flux | parked | rest');
for (const drest of [0, 1]) {
  boot(drest);
  ring();
  for (let t = 0; t <= 200; t++) {
    if (t % 20 === 0) {
      const [Lm, Lr, F, P] = ledgers(drest);
      wasm._meso3i_rg_refresh();
      console.log(` ${drest} | ${String(t).padStart(3)} | ${String(Lm).padStart(6)} | ${String(Lr).padStart(7)} | ${String(Lm + Lr).padStart(6)} | ${String(F).padStart(4)} | ${String(P).padStart(6)} | ${wasm._meso3i_rest_mass()}`);
    }
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
}
