// transactions: the irreversible contact ledger (meso3i_ev).
//   ev[0] drag-park  ev[1] pair-bind  ev[2] emit  ev[3] qcap
//   ev[4] drain      ev[5] photon-eject          ev[6] reflect
// Scenarios: (a) driven ember — sustained transactions;
//            (b) wound fossil in vacuum — should go ~silent;
//            (c) free pulse, no friction — near-zero until drain.
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

const NAMES = ['park', 'bind', 'emit', 'qcap', 'drain', 'peject', 'reflect'];
const ev = () => NAMES.map((_, k) => wasm._meso3i_ev(k));
const report = (tag, t, prev) => {
  const cur = ev();
  const d = cur.map((v, k) => Math.round(v - prev[k]));
  wasm._meso3i_rg_refresh();
  console.log(`  ${tag} t=${String(t).padStart(3)}: ` +
    NAMES.map((n, k) => `${n}=${d[k]}`).join(' ') +
    `  | rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`);
  return cur;
};

const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c,
      wasm._meso3i_get(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c) + 4);
  }
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
  for (const r of [5, 4]) {
    const steps = Math.ceil(2 * Math.PI * r) + 1;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * 2 * Math.PI;
      const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
      if (((x + y + CZ) & 1) !== 0) continue;
      const c = tang(x - CX, y - CY);
      if (c >= 0)
        wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
    }
  }
};
const pulse = () => {
  for (let c = 0; c < NMOV; c++)
    wasm._meso3i_set(CX, CY, CZ, c, wasm._meso3i_get(CX, CY, CZ, c) + 2);
};

// (a) driven ember: sustained accretion machinery
console.log('(a) driven ember — per-window deltas (20t windows)');
wasm._meso3i_clear();
wasm._meso3i_collmode(0); wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4); wasm._meso3i_lat(1); wasm._meso3i_drest(1);
let prev = ev();
for (let t = 0; t <= 200; t++) {
  if (t && t % 20 === 0) prev = report('a', t, prev);
  drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
}

// (b) wound fossil, then vacuum silence — same seed, drive cut at t=80
console.log('(b) wound lump — drive on 0-80, then vacuum (20t windows)');
wasm._meso3i_clear();
wasm._meso3i_collmode(0); wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4); wasm._meso3i_lat(1); wasm._meso3i_drest(1);
ring();
prev = ev();
for (let t = 0; t <= 220; t++) {
  if (t && t % 20 === 0) prev = report('b', t, prev);
  if (t < 80) drive();
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
}

// (c) free pulse in empty space, friction on but nothing to congest
console.log('(c) free pulse — near-empty box (10t windows)');
wasm._meso3i_clear();
wasm._meso3i_collmode(0); wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4); wasm._meso3i_lat(1); wasm._meso3i_drest(1);
pulse();
prev = ev();
for (let t = 0; t <= 40; t++) {
  if (t && t % 10 === 0) prev = report('c', t, prev);
  wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
}
