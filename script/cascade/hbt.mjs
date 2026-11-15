/* hbt.mjs — two-particle correlation / femtoscopy of an extended
 * source (the fm-scale interferometry observable).
 *
 * In nature, HBT/femtoscopy measures the coincidence enhancement of
 * identical bosons vs relative momentum q: C(q) peaks at q->0 with
 * width ~1/R — the correlation width maps the SOURCE SIZE, and the
 * intercept (chaoticity) reads the source's phase coherence.
 *
 * Substrate analog:
 *   - "identical quanta": packets with the same nu on ch14.
 *   - "extended source": emitters at depths 1..D on the ch14 axis
 *     upstream of detector K — a co-emitted burst (all born=0).
 *   - packet from depth d arrives at K at t=d carrying phase
 *     op = nu*d mod 256 — arrival phase encodes emission depth.
 *   - "coincidence/bunching": the merge gate admits an offer iff its
 *     op lands within qMergeGate of a stored cloud phase — pair
 *     members correlate when their emission separation puts their
 *     phases inside the gate.
 *
 * Fixture notes (found empirically):
 *   - K must have site_level > 1 or the catch roll (~1/16) starves
 *     the cloud: committed winding on pairs e3..e6 (ch6-13) — NOT
 *     ch14/15, so probes still arm as incipients (gap for w=160 is
 *     40, away from probe nu — no stim pollution).
 *   - K carries mass=512 so armed incipients stand (on-shell line
 *     ~136 blocks settle for nu<=64 offers).
 *   - Deep emitters attenuate: packets can arm en route at bare
 *     cells (~6%/hop) — the admitted set is thinned at large d.
 *
 * Measured (this harness):
 *   - nu=64 coherent burst: admitted {2,6,14} — pairwise
 *     separations {4,8,12} all multiples of lambda=256/nu=4 —
 *     the two-particle correlation COMB at the quantum's wavelength.
 *   - chaotic source (random nu/emitter): admitted {2} — the comb
 *     dies — bunching is a COHERENCE property, not kinematics.
 *
 * Run: node script/cascade/hbt.mjs
 */
import { loadM26 } from '../lib/m26.mjs';

const SIZE = 32, T = 22;
const K = [16, 16, 16];
const SRC_AXIS = d => [16, 16 - d, 16 - d];   /* depth d on ch14 axis */
const CH = 14, D = 15;
const M = await loadM26();
const ev = i => Number(M._moore26_events(i));
const incipAt = () => { let s = 0; for (let c = 0; c < 26; c++) s += M._moore26_incipient_get(...K, c); return s; };

function burst(nuMap, { gate = 8, per = 10 } = {}) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_incip_ttl_set(249);
  M._moore26_merge_gate_set(gate);
  M._moore26_mass_set(...K, 512);
  for (const ch of [6, 7, 8, 9, 10, 11, 12, 13]) M._moore26_winding_set(...K, ch, 160);
  for (let d = 1; d <= D; d++) {
    M._moore26_packet_set(...SRC_AXIS(d), CH, per);
    M._moore26_packet_nu_set(...SRC_AXIS(d), CH, nuMap(d));
  }
  const admitted = [], declined = [];
  for (let t = 1; t <= T; t++) {
    const i0 = incipAt(), d0 = ev(50);
    M._moore26_tick();
    if (t <= D) {
      if (incipAt() > i0) admitted.push(t);
      else if (ev(50) > d0) declined.push(t);
    }
  }
  const seps = [];
  for (let i = 0; i < admitted.length; i++)
    for (let j = i + 1; j < admitted.length; j++) seps.push(admitted[j] - admitted[i]);
  return { admitted, declined, seps };
}

console.log('=== COHERENT BURST — correlation comb at lambda=256/nu ===');
for (const nu of [64, 32, 16]) {
  const r = burst(() => nu);
  console.log(`nu=${nu} (lambda=${256 / nu}) admitted={${r.admitted.join(',')}} seps={${r.seps.join(',')}} declined={${r.declined.join(',')}}`);
}

console.log('\n=== CHAOTIC SOURCE — random nu per emitter (contrast) ===');
for (let seed = 7; seed <= 9; seed++) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const r = burst(() => 16 + Math.floor(rnd() * 96));
  console.log(`seed=${seed} admitted={${r.admitted.join(',')}} seps={${r.seps.join(',')}}`);
}

console.log('\n=== GATE dependence at nu=64 ===');
for (const g of [4, 16, 48]) {
  const r = burst(() => 64, { gate: g });
  console.log(`gate=${g} admitted={${r.admitted.join(',')}} seps={${r.seps.join(',')}}`);
}
