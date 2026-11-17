/* heat-engine — the substrate's Carnot apparatus, a CLOSED cycle:
 *
 *   HOT BATH (pinned T_h) --conduction(qHeatFlow)--> PUMP cell
 *     --qHeatPump: 1 heat -> 1 charge unit moved--> RING current
 *     --qChargeHeat: Joule mint at each link--> heat lands on ring
 *     --conduction + ambient h>>7 drain--> COLD BATH (pinned T_c)
 *
 * The pump is the working engine; the ring is its load (a real
 * circuit — current circulates, Joule-heating the cold side); the
 * two baths are reservoirs held isothermal by re-pinning, and the
 * harness books exactly what each pin costs.
 *
 * Books kept per tick:
 *   Q_h   = heat fed into the hot bath to hold T_h   (reservoir out)
 *   Q_c   = heat fed into the cold bath to hold T_c  (negative = absorbed)
 *   W     = ev61 = charge pumped = heat the engine spent, 1:1
 *   drain = ev44 (h>>7 everywhere — ambient entropy export)
 *   Joule = closed by arithmetic: dH = inj - drain - pumpSpend + J
 * eta_measured = W/Q_h vs the Carnot bound eta_max = 1 - T_c/T_h.
 *
 * Controls: --pump=0 (pure conduction leak — the engine off),
 * --flow=0 (pump starves after its seed heat burns).
 *
 * Usage: node script/cascade/heat-engine.mjs --th=40000 --tc=4000
 *          --flow=5 --rate=32 --shift=4 --joule=3 --ticks=300
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const TH    = +(argv.th    ?? 40000);
const TC    = +(argv.tc    ?? 4000);
const FLOW  = +(argv.flow  ?? 5);      /* conduction shift */
const RATE  = +(argv.rate  ?? 32);     /* pump charge units/tick */
const SHIFT = +(argv.shift ?? 4);      /* charge-flow shift */
const JOULE = +(argv.joule ?? 3);      /* Joule mint shift, 0=off */
const T     = +(argv.ticks ?? 300);
const PUMP  = argv.pump === '0' ? 0 : RATE;

const q = await loadM26();
q._moore26_init(32, 32, 32);
q._moore26_momentum_set(255);
q._moore26_vac_rate_set(0);          /* no re-emission — pure baths */
q._moore26_heat_flow_set(FLOW);
q._moore26_heat_pump_set(PUMP);
q._moore26_charge_flow_set(SHIFT);
q._moore26_charge_heat_set(JOULE);

const wound = (x, y, z) => { for (let c = 6; c < 18; c++) q._moore26_winding_set(x, y, z, c, 64); };
/* the pump-mode ring: odd mass cells, even committed conduits */
const ring = [[9,16],[11,16],[13,16],[15,16],[17,16],[19,16],
              [19,18],[17,18],[15,18],[13,18],[11,18],[9,18]];
const links = [[10,16],[12,16],[14,16],[16,16],[18,16],[19,17],
               [18,18],[16,18],[14,18],[12,18],[10,18],[9,17]];
for (const [x, y] of ring) q._moore26_mass_set(x, y, 16, 100);
for (const [x, y] of links) wound(x, y, 16);
const PC = [11, 16, 16];              /* pump sits mid-gradient z=16 */
q._moore26_bondpar_set(...PC, +1);
q._moore26_heat_set(...PC, 2000);     /* seed heat to start pumping */

/* isothermal baths: plates 3 cells above/below the pump plane */
const HOT = [], COLD = [];
for (let x = 9; x <= 13; x++) for (let y = 14; y <= 18; y++) {
  HOT.push([x, y, 13]); COLD.push([x, y, 19]);
}
const pin = (cells, T) => {
  let cost = 0;
  for (const [x, y, z] of cells) {
    cost += T - Number(q._moore26_heat_get(x, y, z));
    q._moore26_heat_set(x, y, z, T);
  }
  return cost;                        /* + = we fed it; - = absorbed */
};

const carnot = 1 - TC / TH;
console.log(`\n=== heat engine: Th=${TH} Tc=${TC} Carnot=${(100 * carnot).toFixed(0)}%` +
  `  flow=${FLOW} pump=${PUMP}/t cf=>>${SHIFT} joule=>>${JOULE} ===`);
console.log('  eta = ev61/Q_h — pump converts heat->charge 1:1, so eta' +
  ' measures TRANSPORT (how much bath heat reaches the engine)');

let Qh = 0, Qc = 0, ev61p = 0, ev44p = 0, ev60p = 0;
for (let t = 0; t <= T; t++) {
  Qh += pin(HOT, TH); Qc += pin(COLD, TC);
  if (t % 50 === 0 || t === T) {
    const ev61 = Number(q._moore26_events(61)),
          ev44 = Number(q._moore26_events(44)),
          ev60 = Number(q._moore26_events(60));
    const dt = 50, w = (ev61 - ev61p) / dt, qh = Qh / dt, qc = Qc / dt;
    const Tp = q._moore26_heat_get(...PC);
    console.log(`t=${String(t).padStart(3)}  W/t=${w.toFixed(1)}  Qh/t=${qh.toFixed(0)}` +
      `  Qc/t=${qc.toFixed(0)}  I=${((ev60 - ev60p) / (12 * dt)).toFixed(1)}` +
      `  drain/t=${((ev44 - ev44p) / dt).toFixed(0)}  T_pump=${Tp}` +
      `  eta=${qh > 0 ? (100 * w / qh).toFixed(1) + '%' : '—'}`);
    ev61p = ev61; ev44p = ev44; ev60p = ev60; Qh = 0; Qc = 0;
  }
  if (t < T) q._moore26_tick();
}
console.log(`  Carnot bound for Th=${TH},Tc=${TC}: ${(100 * carnot).toFixed(0)}%` +
  ' — eta above it means transport wins, not a violated 2nd law');
