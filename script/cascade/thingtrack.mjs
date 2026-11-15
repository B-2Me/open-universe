// thingtrack.mjs — is "the knot" a thing, or a pattern in local state?
// A bare odd-cell mass with a momentum kick relays odd->odd through the
// even conduit at 1 cell/tick (complete handoff). Tracking shows:
//   - the leading mass relocates wholesale each tick — no persistence
//   - every vacated site writes a fresh bondTick (birthday = the tick
//     the confirm landed) and an m=1 residue — a timestamped trail
//   - the trail is invisible without history: w=0, m=1 residue only
// The substrate has no thing-table — identity is a pattern we infer
// from the local deviation record; bondTick is what makes it legible.
import { loadM26 } from '../lib/m26.mjs';

const M = await loadM26();
const SIZE = 32, K = [17, 16, 16];   // odd cell — matter lattice
const EDGE = [6,7,8,9,10,11,12,13,14,15,16,17];
const PAIR = 7, KICK = 32768;        // pair7 -> hop +y+z (ch14 dir)

M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_wear_decay_set(0);
M._moore26_incip_ttl_set(249);
M._moore26_mass_set(...K, 512);
M._moore26_momentum_at_set(...K, PAIR, KICK);

const trail = [];
for (let t = 0; t <= 12; t++) {
  const sites = [];
  for (let x = 10; x < 27; x++) for (let y = 10; y < 27; y++) for (let z = 10; z < 27; z++) {
    const m = M._moore26_mass_get(x, y, z);
    if (!m) continue;
    let w = 0; for (const ch of EDGE) w += M._moore26_winding_get(x, y, z, ch);
    const bt = M._moore26_bondtick_get(x, y, z);
    sites.push({ p: [x, y, z], m, w, bt });
  }
  const lead = sites.filter(c => c.m > 10)[0];
  const fresh = sites.filter(c => c.bt === t);
  console.log(`t=${t} lead=${lead ? lead.p.join(',') + ' m' + lead.m : 'gone'} trail=${sites.map(c => c.p.join(',') + '(m' + c.m + ',bt' + (c.bt || '-') + ')').join(' ')}`);
  for (const c of sites) trail.push({ t, ...c });
  M._moore26_tick();
}
console.log('--- deviation-age trail ---');
const seen = {};
for (const c of trail) {
  const key = c.p.join(',');
  if (!c.bt || seen[key]) continue;
  seen[key] = 1;
  console.log(`  ${key}: born t=${c.bt} (residue m=${c.m}, w=${c.w})`);
}
