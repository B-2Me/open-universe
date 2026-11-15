// devage.mjs — deviation-age spectrum: histogram bondTick/workAge over
// wound cells, comparing GROWN structure (flux-fed accretion writes real
// birthdays + stratigraphy) vs AUTHORED structure (winding_set writes
// circulation with no birthday — ageless). The histogram differentiates
// formation history that winding magnitude alone hides.
import { loadM26 } from '../lib/m26.mjs';

const M = await loadM26();
const SIZE = 32, K = [16, 16, 16], CH = 14;

// census all wound cells -> per-node deviation-age record
function census(label) {
  const ages = {}, works = {}, winds = {};
  let nwound = 0, authored = 0, grown = 0;
  for (let x = 8; x < 25; x++) for (let y = 8; y < 25; y++) for (let z = 8; z < 25; z++) {
    let w = 0;
    for (const ch of [6,7,8,9,10,11,12,13,14,15,16,17]) w += M._moore26_winding_get(x, y, z, ch);
    if (!w) continue;
    nwound++;
    const bt = M._moore26_bondtick_get(x, y, z);
    const wa = M._moore26_workage_get(x, y, z);
    if (!bt) authored++; else grown++;
    const a = bt ? `t${bt}` : 'ageless';
    ages[a] = (ages[a] || 0) + 1;
    const wb = wa ? (wa > 1000 ? '>1k' : wa > 100 ? '>100' : '<=100') : '0';
    works[wb] = (works[wb] || 0) + 1;
    const wm = w > 400 ? '>400' : w > 200 ? '>200' : '<=200';
    winds[wm] = (winds[wm] || 0) + 1;
  }
  console.log(`${label}: ${nwound} wound cells (grown=${grown} authored=${authored})`);
  console.log(`  bondTick: ${JSON.stringify(ages)}`);
  console.log(`  workAge:  ${JSON.stringify(works)}`);
  console.log(`  winding:  ${JSON.stringify(winds)}`);
}

// GROWN: feed K sustained flux on ch14, accretion deposits real bonds
M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_wear_decay_set(0);
M._moore26_incip_ttl_set(249);
M._moore26_mass_set(...K, 512);
for (let t = 0; t < 300; t++) {
  for (let k = 0; k < 8; k++) {
    M._moore26_packet_set(16, 15, 15, CH, 4);
    M._moore26_packet_nu_set(16, 15, 15, CH, 32);
  }
  M._moore26_tick();
}
census('GROWN (300t feed)');

// AUTHORED: same winding magnitude via winding_set — no history
M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_wear_decay_set(0);
M._moore26_incip_ttl_set(249);
M._moore26_mass_set(...K, 512);
for (const ch of [6,7,8,9,10,11,12,13,14,15,16,17]) M._moore26_winding_set(...K, ch, 96);
for (let t = 0; t < 60; t++) M._moore26_tick();
census('AUTHORED (12x96, 60t idle)');

// GROWN+DECAYED: feed then let it radiate — does stratigraphy survive?
M._moore26_init(SIZE, SIZE, SIZE);
M._moore26_wear_decay_set(0);
M._moore26_incip_ttl_set(249);
M._moore26_res_emit_set(1);
M._moore26_mass_set(...K, 512);
for (let t = 0; t < 200; t++) {
  for (let k = 0; k < 8; k++) {
    M._moore26_packet_set(16, 15, 15, CH, 4);
    M._moore26_packet_nu_set(16, 15, 15, CH, 32);
  }
  M._moore26_tick();
}
for (let t = 0; t < 150; t++) M._moore26_tick(); // decay window
census('GROWN+DECAYED (200t feed, 150t decay)');
