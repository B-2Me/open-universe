// m26.mjs — shared moore26 wasm loader + grid helpers (p3.mjs pattern).
// The mtnm glue adopts an injected Module object; we pre-set
// onRuntimeInitialized and await it — exports land as Module._moore26_*.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const DIR = join(process.cwd(), 'docs/public/wasm/cascade');

// moore26.js is the current build.sh output (MODULARIZE factory
// createMoore26 -> Promise<Module>); the *-stnm/-mt* variants are
// stale artifacts from an older non-modular build — do NOT load them
// (the recoil + phase_adv patches only exist in the current build).
export async function loadM26(file = 'moore26.js') {
  const require = createRequire(import.meta.url);
  const src = readFileSync(join(DIR, file), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', src)(
    mod, mod.exports, require, DIR, file);
  const factory = mod.exports.createMoore26 || mod.exports;
  return await factory({});
}

// moore26 neighborhood: 26 channels = 13 edge pairs (+/- per axis pair).
export const CH = 26;

export function rng(seed = 555) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff);
}

export function each3(N, fn) {
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) fn(x, y, z);
}

// whole-lattice channel sums — the same telemetry the native smoke test prints
export function totals(q, N) {
  let mass = 0, wind = 0, phot = 0, heat = 0;
  each3(N, (x, y, z) => {
    mass += Number(q._moore26_mass_get(x, y, z));
    heat += Number(q._moore26_heat_get(x, y, z));
    for (let c = 0; c < CH; c++) {
      wind += Number(q._moore26_winding_get(x, y, z, c));
      phot += Number(q._moore26_packet_get(x, y, z, c));
    }
  });
  return { mass, wind, phot, heat };
}

export function centroid(q, N, axis = 'x') {
  let num = 0, den = 0;
  each3(N, (x, y, z) => {
    const m = Number(q._moore26_mass_get(x, y, z));
    num += ({ x, y, z })[axis] * m;
    den += m;
  });
  return den > 0 ? num / den : -1;
}

// event counter shorthand — indices from the native harness:
// 3 conf  4 emit  5 arm  7 decayedE  9 annih  23 fuse
export const ev = (q, i) => Number(q._moore26_events(i));
