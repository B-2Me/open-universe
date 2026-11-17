// m26.mjs — shared moore26 wasm loader + grid helpers (p3.mjs pattern).
// The mtnm glue adopts an injected Module object; we pre-set
// onRuntimeInitialized and await it — exports land as Module._moore26_*.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const DIR = join(process.cwd(), 'docs/public/wasm/cascade');

// moore26.js is the current build.sh output (MODULARIZE factory
// createMoore26 -> Promise<Module>). Stale-artifact guard: the wasm
// must be NEWER than src/moore26.c — a harness that silently runs an
// old engine produces garbage results (this actually happened:
// moore26-stnm.js predated the recoil + phase_adv patches and every
// harness loaded it). Opt out with M26_STALE_OK=1 for old artifacts.
export async function loadM26(file = 'moore26.js') {
  const require = createRequire(import.meta.url);
  const wasmPath = join(DIR, file);
  const cPath = join(process.cwd(), 'src/moore26.c');
  let stale = false;
  try {
    stale = statSync(wasmPath).mtimeMs < statSync(cPath).mtimeMs;
  } catch { /* missing files handled by readFileSync below */ }
  if (stale) {
    const msg = `${file} is OLDER than src/moore26.c — stale build. ` +
      `Rebuild via src/build.sh (or M26_STALE_OK=1 to force)`;
    if (!process.env.M26_STALE_OK) throw new Error(msg);
    console.warn(`M26_STALE_OK: ${msg}`);
  }
  const src = readFileSync(wasmPath, 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', src)(
    mod, mod.exports, require, DIR, file);
  const factory = mod.exports.createMoore26 || mod.exports;
  const Module = await factory({});
  if (typeof Module._moore26_gitrev === 'function')
    console.log(`[m26] loaded ${file} rev=${Module.ccall('moore26_gitrev', 'string', [], [])}`);
  return Module;
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

// NodeState field-name -> byte offset, resolved LIVE from the engine
// via moore26_node_off — NEVER hardcode these: the struct grows, and
// stale tables read the wrong registers silently (seven harnesses
// broke this way when incipOp/strainBank/chargeFlight/creep landed).
const NODE_FIELDS = ['winding','massFlight','packet','packetNu','incip',
  'incipNu','incipBorn','incipOp','packetBorn','packetPar','incipPar',
  'ack','ackTtl','ackRtt','bondDist','strainBank','chargeFlight','phase',
  'mass','charge','flux','fluxP','fluxV','scarPar','heat','localDensity',
  'txnWork','bondTick','workAge','localTime','bondPar','momentum','creep'];
export function nodeOff(q) {
  const o = {};
  for (let i = 0; i < NODE_FIELDS.length; i++)
    o[NODE_FIELDS[i]] = q._moore26_node_off(i);
  return o;
}

// init + liveness check — a failed calloc leaves the dead-but-safe
// engine where every getter returns 0 and the run LOOKS fine while
// measuring nothing (moore26-harness silently ticked a NULL grid
// 1000 ticks at 128^3 after NodeState grew to 568B). Always init
// through this.
export function initM26(q, w, h, d) {
  q._moore26_init(w, h, d);
  if (!q._moore26_grid_ready()) {
    console.error(`init ${w}x${h}x${d} FAILED — NodeState*2 buffers exceed the wasm heap (max ~64^3 at 568B/node)`);
    process.exit(1);
  }
}
