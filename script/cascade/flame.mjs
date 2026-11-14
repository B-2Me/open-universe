// flame.mjs — maintenance-dependent persistence probe.
// Fixture: wound composite (mass + committed winding pair, site_level>=2)
// in an isotropic 12-direction edge-channel bath. qEvapShift = mass tax.
// Measures: ignition (plateau under feed), extinction (decay after cut),
// blowout (condensation/dispersal at high feed).
// Run: node script/cascade/flame.mjs
const { loadM26 } = await import('../lib/m26.mjs');
const M = await loadM26();

const KX=31, KY=32, KZ=32;           // odd knot site
// isotropic bath: 6 edge-pairs aimed at the knot's six face conduits
const SOURCES = [
  [28,28,32,6],[34,36,32,7],   // ch6/ch7 xy diagonal pair
  [26,36,32,8],[35,29,32,9],   // ch8/ch9 anti-xy pair
  [28,32,30,10],[35,32,35,11], // ch10/11 xz-ish pair
  [28,32,34,12],[35,32,29,13], // ch12/13 anti-xz pair
  [31,29,30,14],[31,36,35,15], // ch14/15 yz pair
  [31,29,34,16],[31,35,30,17], // ch16/17 anti-yz pair
];
const tot = () => { let t=0;
  for(let z=0;z<64;z++)for(let y=0;y<64;y++)for(let x=0;x<64;x++)
    t+=M._moore26_mass_get(x,y,z); return t; };
const wind = () => { let w=0;
  for(let c=0;c<26;c++)w+=M._moore26_winding_get(KX,KY,KZ,c); return w; };

for (const rate of [0, 4, 16, 60]) {
  M._moore26_init(64,64,64);
  M._moore26_recoil_law_set(4); M._moore26_wear_decay_set(0);
  M._moore26_evap_shift_set(3);
  M._moore26_mass_set(KX,KY,KZ,500); M._moore26_bondpar_set(KX,KY,KZ,20);
  M._moore26_winding_set(KX,KY,KZ,6,200); M._moore26_winding_set(KX,KY,KZ,7,200);
  const out=[];
  for (let t=0;t<300;t++) {
    if (t<120) for (const [sx,sy,sz,c] of SOURCES) {
      M._moore26_packet_set(sx,sy,sz,c,rate); M._moore26_packet_nu_set(sx,sy,sz,c,96);
    }
    M._moore26_tick();
    if (t%30===29) out.push(tot()+'/'+wind()+'/'+M._moore26_heat_get(KX,KY,KZ));
  }
  console.log('rate='+rate+'  M/W/H (t30..300):  '+out.join('  '));
}
