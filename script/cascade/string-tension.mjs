/* string-tension.mjs — the confining potential of a saturated tube.
 *
 *   A(13,16,16) - filament of L cells along (1,1,0) - B(13+L+1,16+L+1,16)
 *
 * The bond's reach is measured by ACK round-trips; stretching banks
 * qString*(reach-slack) strain energy (ev56), and while stretched the
 * bend cells take min(qString,bank) kicks toward each other per
 * confirmed transaction (ev55) — a CONSTANT force until the bank
 * drains: confinement funded as elastic energy, kinetic return capped
 * by stored potential.
 *
 * Measurements:
 *   1) E(d): banked strain vs kick separation — linear => sigma slope
 *   2) F(d): ev55 kicks and their drain rate vs separation — flat
 *      force is the confining signature
 *   3) pull-back: light cores (m=64) kicked apart, sep(t) contraction
 *   4) breaking: where the tube fractures and mints endpoint mass
 *
 * Run: node script/cascade/string-tension.mjs [--size=32]
 */
import { loadM26 } from '../lib/m26.mjs';

const SIZE = 32;
const M = await loadM26();
let s = 777;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const A = [13, 16, 16];
const fil = L => Array.from({ length: L }, (_, k) => [13 + k + 1, 16 + k + 1, 16]);
const Bof = L => [13 + L + 1, 16 + L + 1, 16];

function build(L, qString, mass, kick) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_catch_gate_set(2);
  M._moore26_string_set(qString);
  M._moore26_slack_set(2);
  for (const [x, y, z] of fil(L)) {
    M._moore26_winding_set(x, y, z, 6, 128);
    M._moore26_winding_set(x, y, z, 7, 128);
  }
  M._moore26_mass_set(...A, mass);
  M._moore26_mass_set(...Bof(L), mass);
  if (kick) {                                   /* separation kick along the bond */
    M._moore26_momentum_at_set(...A, 3, -kick);
    M._moore26_momentum_at_set(...Bof(L), 3, +kick);
  }
}
function feed(L) {
  for (const [x, y, z] of fil(L)) {
    if (rnd() < 0.9) {
      M._moore26_packet_set(x, y, z, 6, 2);
      M._moore26_packet_nu_set(x, y, z, 6, 32);
    }
  }
}
function census() {
  let d1 = 0, n1 = 0, d2 = 0, n2 = 0;
  for (let z = 0; z < SIZE; z++) for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const m = M._moore26_mass_get(x, y, z);
      if (!m) continue;
      const s = x + y;
      if (s < 36) { d1 += s * m; n1 += m; } else { d2 += s * m; n2 += m; }
    }
  return { sep: n1 && n2 ? d2 / n2 - d1 / n1 : NaN, tot: n1 + n2 };
}
const ev = i => Number(M._moore26_events(i));

/* ---- 1) E(d): banked strain vs separation kick ---- */
console.log('=== stored potential vs stretch (qString=16, m=512, L=9) ===');
console.log('kick   peakBank   ev55kicks   minted');
for (const kick of [0, 50, 100, 200, 400]) {
  build(9, 16, 512, kick);
  const e55 = ev(55), e56 = ev(56);
  let peak = 0;
  for (let t = 0; t < 60; t++) {
    feed(9); M._moore26_tick();
    const b = ev(56) - ev(57);
    if (b > peak) peak = b;
  }
  console.log(`${kick}   ${peak}   +${ev(55) - e55}   ${census().tot - 1024}`);
}

/* ---- 2) F: kick magnitude is min(qString,bank) — count rate ---- */
console.log('\n=== pull rate vs qString (m=64 light cores, L=9, kick=100) ===');
for (const q of [4, 8, 16, 32]) {
  build(9, q, 64, 100);
  const c0 = census().sep;
  for (let t = 0; t < 60; t++) { feed(9); M._moore26_tick(); }
  console.log(`qString=${q}: sep ${c0.toFixed(1)} -> ${census().sep.toFixed(1)}  bank=${ev(56) - ev(57)} minted=${census().tot - 128}`);
}

/* ---- 3) sep(t) trajectory under qString=32 ---- */
console.log('\n=== contraction trajectory (qString=32, m=64, kick=100) ===');
build(9, 32, 64, 100);
const tr = [];
for (let t = 0; t <= 80; t++) {
  if (t % 10 === 0) tr.push(`t${t}:${census().sep.toFixed(1)}`);
  feed(9); M._moore26_tick();
}
console.log(tr.join(' '));

/* ---- 4) breaking sweep ---- */
console.log('\n=== break threshold (qString=32, m=512, kick=200) ===');
for (const L of [6, 8, 10, 11, 12, 13, 14]) {
  build(L, 32, 512, 200);
  for (let t = 0; t < 60; t++) { feed(L); M._moore26_tick(); }
  const c = census();
  console.log(`L=${L}: totMass=${c.tot} (${c.tot > 1024 ? '+' + (c.tot - 1024) + ' MINTED' : 'held'}) sep=${c.sep.toFixed(1)}`);
}
