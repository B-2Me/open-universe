---
title: Moore26 Constants
audio: /audio/moore26-constants.mp3
---

<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Moore26 Constants Catalog

The measured constants of the substrate — every number below comes
from a headless harness against `src/moore26.c`, not from analogy.
Entries are organized by sector with the conditions under which they
were measured and the harness that produced them. Values marked
"authored" are law parameters we wrote; everything else is what the
lattice produced. Distances in cells, times in ticks. Nature-vocabulary
translations live in [Nature → Substrate](/nature-translation).

## Transport & reach

| constant | value | conditions | harness |
|---|---|---|---|
| virgin lane mean depth | 6.22 | single quanta, no history | pair-cone (warm-path A/B) |
| carved lane mean depth | 8.53 (saturating 13-cap) | lane pre-streamed ~100t | pair-cone |
| packet half-life, warm lane | ~35 ticks | afterglow decay, closed ring | vacuum census |
| afterglow extinction | ~100–120 ticks | driven stream off → 0/0 | vacuum census |
| closed-ring persistence | bounded by drip floor only | toroidal lanes | vacuum census |
| ballistic speed | 1 hop/tick exactly | all packets, no dilation | pulse/interferometer |

## Vacuum & halo

| constant | value | conditions | harness |
|---|---|---|---|
| spontaneous fluctuation | **0** packets / 0 incipients | quiet vacuum, 100+ ticks | vacuum census |
| bare-mass emission | **0** | mass=40, unwound, 200 ticks | vacuum census |
| sidescatter halo fraction | **42%** of stream flux | 39 lane vs 29 in-plane stray | halo census |
| halo channel retention | 26/29 keep ch6 | phase-preserving shear flow | halo census |
| halo out-of-plane leak | ~1/30 | stays in the emission plane | halo census |
| wanderer admit rate | ~96/256 ≈ 37% | random op lands in gate window | knee map |

## Phase & arbitration

| constant | value | conditions | harness |
|---|---|---|---|
| offer phase law | `op = nu·age mod 256` | measured Δop = nu·ΔL exactly | interferometer pulse |
| offer wavelength | λ = 256/nu hops | spatial period of phase | interferometer |
| merge knee (authored) | circular dist ≤48 | qMergeGate — binary step | — |
| knee sharpness (measured) | ≤16 phase units (one ΔL=2-hop step at nu=8) | joint 0.55→0.00 | knee-map |
| admit plateau joint occupancy | ≈ min(PA,PB) ~0.55–0.68 | in-phase, merge on | knee-map |
| exclusion floor (strict) | **0.00–0.03** nominal-arm P | anti-phase band | knee-map |
| bistable edge | PA≈0.33, PB≈0.46, joint≡0 | dist≈64 | knee-map |
| relational control | B-solo admits 0.65, 0 declines | same stream, no cross cloud | interferometer cw |
| absorber arbitration threshold | mass ≥ qMergeMin | authored (D=40 vs lane≈0) | — |

## Noise spectrum (off-lane halo arrivals)

| constant | value | conditions | harness |
|---|---|---|---|
| Fano factor | 1.06 → 6.2 (W=1→64) | diverges under integration | noise-spectrum |
| autocorrelation | ρ₁=+0.48, oscillatory | default TTL=6 | noise-spectrum |
| spectral mode | ~16-tick period | TTL 6–12 (unattributed) | noise-spectrum |
| noise color vs TTL | white (4) / resonant (6–12) / red (24) | memory-kernel coupling | noise-spectrum |
| skew/kurtosis trend | → symmetric platykurtic | shape Gaussian-ward, process colored | noise-spectrum |

## Products, chirality & gates

| constant | value | conditions | harness |
|---|---|---|---|
| transverse-pair refusal | 0/20 settles | scar cone, solo probes | pair-cone |
| containing-pair acceptance | 19/20 settles | scar cone, Δ≈81 vs wear 6 | pair-cone |
| drift selectivity | head-on ≈3–5× trailing | mirrored at A/B by momentum sign | pair-cone |
| charge suppression | ~10× acceptance drop | same-sign repulsion on fed node | pair-cone |
| same-sign decline ratio | ev45 = 331 vs 35 baseline | +104 target | charge law |
| attraction asymmetry | −q declines +par ~12% less | opposite-sign cap 13−|q|>>3 vs 4 | charge law |
| repolarization | −q node flips + under sustained +flux | dynamic charge register | charge law |
| bondPar saturation | ±127 | confirmed-bond chirality record | engine |
| scar parity record | non-conducting (scarPar) | dedicated register fix | engine |
| skeleton mint cost | funded from mass share | ledger audit, ~12% bug fixed | pair production |

## Clock & history stack

| constant | value | conditions | harness |
|---|---|---|---|
| drumbeat (qTick) | exact rail-ring period 3 | bath-immune, ballistic | ring control |
| proper time divergence | twins diverge 22× | targeted congestion on localTime | twin experiment |
| mass-scaled tick rate | τ ∝ k·m: 14400/72000/288000 | mass 10/40/160, qMassCap | Compton ansatz |
| vacuum proper time | mass=0 → cap=0 → no τ | mass-scaled bandwidth | isolated nodes |
| depth-graded freezing | core max, shell crawls | bound knot, congestion tax | knot census |

## Structure & knots

| constant | value | conditions | harness |
|---|---|---|---|
| rest-mass plateau | ~40–42k (supply-bound) | closed box, shift 3/4/5 → 41k/39k/39k | mass spectrum |
| open-box spectrum | M ≈ flux×2^shift: 467/906/1244 | sustained flux, shift 3/4/5 | mass spectrum |
| bend luminosity | 326→1787 (rate 2→8), saturates 1853 | washout at rate 16 | radiation |
| overdrive response | volume +100%, knot survives | no break under max drive | radiation |
| dd interior opacity | surface-pinned 3520/0/0 over 300t | pulse never propagates interior | holographic probe |
| interior conduction | chain_share relays: 9→173 pk, dd −4.8k→+76.7k | offers forward through knot wall | holographic probe |
| packing penalty | 8 knots retain 1.028× volume | no density cost measured | density probe |
| slipstream capacity | exactly 2 counter-rotating lanes | 150/30 holds; 150/150→62/62; 3rd refused | geometric Pauli |
| shed fraction, 2 streams | ~59% to heat | annihilation-shed analog | geometric Pauli |
| Meissner lock floor | tubes park ~143 (was draining 200→68) | frozen t50=t400=1572 | Meissner lock |
| scalar-field vortex lifetime | unwinds in ~50t | no topological protection in scalar phase | phantom audit |
| phase_sync contribution | 0.09% (noise) — pure overhead | sync=0 vs on | phantom audit |

## Interactions at range

| constant | value | conditions | harness |
|---|---|---|---|
| linear force | **null** — no centroid drift | sep=12/16, 1500–3000t | torque transfer |
| angular (torque) transfer | ddL +1→+23, ddR +5→−15 / 2000t | sep=12, counter-rotating gears | torque transfer |
| mediation | grazing emission → flank deposition | YORP mechanism on conserved engine | torque transfer |
| conducted charge force | +/+ repels, +/− converges at bond; impulse ∝ min\|q\| (ev58 992@q=1k vs 2000@2k) | committed conduit, `qChargeKick` shift=4, k=min\|q\|>>4 | charge-kick |
| charge-force range | exactly one bond — kick stops the tick the link breaks | no cast-across-gap mode exists | charge-kick |
| wire force at range | +/+ sep 10→31, +/− converge at midpoint, broken wire dead | 9-cell committed wire, `qChargeRange` BFS | charge-kick --mode=wire |
| chain composition | 5-cell +q chain: ends fly, interior cancels, ev58=8×248 | adjacent kicks compose, no new code | charge-kick --mode=chain |
| conduction (Ohm's law) | I ∝ V to <0.5% (R=12.1 const over 8×V); I ∝ 1/L (R=2L exact at shift=1) | pinned ± terminals, L-link wire, `qChargeFlow` | charge-circuit --mode=ohm |
| series uniformity | I_drain = I_source = ev60/L within 0.5% | steady state, same L6 wire | charge-circuit --mode=ohm |
| wire profile | q(x) linear to ±1 (1024,853,682,511,341,170,0) | V=1024 L=6 steady state | charge-circuit --mode=ohm |
| RC discharge | Σq conserved exactly (1024); settles flat ~Q/(L+1) | unpinned +Q seed | charge-circuit --mode=rc |
| broken wire | I_drain=0; stub charges to ~source potential | mid-link conduit removed | charge-circuit --mode=broken |
| Joule heating | interior heat ~1100–1400 @ I≈85, k>>3 mint | `qChargeHeat` shift=3 | charge-circuit --mode=joule |
| Kirchhoff junction | I_AB = 148.82 = I_A+I_B exactly (85.0+63.8) | 6-link + 8-link parallel branches, V=1024 | charge-circuit --mode=parallel |
| magnetism probe | T impulse 72.8/72.4/74.8 under +x/−x/no current — NULL | pinned probe, matched local charge | charge-circuit --mode=induct |
| funded EMF | ring current ~2/tick sustained til battery death; heat:charge 1:1 exact | `qHeatPump` rate=8, heat=3000, 12-cell ring | charge-circuit --mode=pump |
| pump EMF | sawtooth ±14 terminal differential held constant | same ring | charge-circuit --mode=pump |
| battery internal short | ~3/4 pumped charge back-flows through pump cell | pump links ~7/tick vs ring ~2 | charge-circuit --mode=pump |
| diode junction | forward I=128.0, reverse I=0.00 — one-way conduit | mid-conduit bondPar=+1, `qDiode` | charge-circuit --mode=diode |
| Ampère force | parallel currents attract, antiparallel repel; antisymmetric term −15.3k/tick vs gravity baseline | `qMagKick`=10, ghost-wire flux=200 | charge-circuit --mode=ampere |
| substrate Lorentz | current element: ±~1800/tick attract/repel by flux direction; static probe ≈0, no current =0 | probe flux=200 linked to wire, diode-blocked link | charge-circuit --mode=beam |
| diode-fixed battery | ring I 2.0→6.7 (3.3×), EMF ±14→±80, funding still 1:1 | polarized flanking conduits | charge-circuit --mode=pump --polarized |
| Ampère at range | ±156.0/tick attract/repel on 9-cell wire; dead for no-terminus, passive T, broken wire | `qMagKick`=10 `qMagRange`=16, ghost flux=200 | charge-circuit --mode=magrange --range=16 |
| induction EMF | k=Δflux≫ind exactly: 8/tick during 64/tick ramp, silent at DC, +320 spike at release (Lenz-signed) | `qMagInd`=3, fluxP register | charge-circuit --mode=faraday |
| junction pinch | self-attraction of a driven link: reversal-invariant, log-log slope **2.00** = I² (Bennett relation) | `qMagKick`=6, single A–B link | charge-circuit --mode=pinch --shift=1 |
| conducted wave | disturbance propagates ~1 hop/tick; `ind=2` under-damped ringing, `ind=1` saturated period-2 limit cycle, `ind=3` dies in 2 hops | 9-cell induction chain, carrier +200 | charge-circuit --mode=wave --ind=2 |
| transformer loading | funded EMF sags primary flux −8.4% (1695→1552); induced charge feedback −10% — reflected impedance | `qIndLoad`=1, ramping primary | charge-circuit --mode=tload |
| ring pinch | −0.6/cell/tick inward radial bias (pinned); free ring opens at a corner → stable arc | 32-cell ring, sustained pump | charge-circuit --mode=pring |
| wire pinch confinement | fails: interior pinch cancels, ends erode — column necks at ends (sausage-instability analog), self-limits | free 9-cell wire | charge-circuit --mode=pwire --shift=1 |
| vacuum-polarization wave | propagates 21-even bare conduit line at ~0.4 even/tick (2–3 ticks/link), zero mass/charge anywhere; reflection + ringing at a break; persistent DC remnant at driven head | `qVacPol`=3, `fluxV` conjugate, Laplacian coupling | charge-circuit --mode=wavevac --shift=0 |
| field→carrier detection | detector charge responds only after wave arrival (t≈55 for 20-link packet): ev24=77, det_q −21, Lenz-signed det flux +26 vs arriving −flux | `qMagInd`=4 read on conduit Δ | charge-circuit --mode=wavevac --shift=0 |
| pulsed-drive creep | null at strobe 4–8, mag 6–16: barrier is a per-tick momentum threshold, not an integral — pulses don't accumulate | wmerge --strobe | charge-circuit --mode=wmerge --strobe=8 --mag=6 |
| field force | ±78.0/tick on a ghost current element vs poled conduit (200·400≫10=78); exact 0 for no-field, static cell, ⊥ field | `qMagKick` conduit terminus, ev26 | charge-circuit --mode=fpush --shift=0 |
| field-wall confinement | interior stabilized: 8 contiguous cells vs 7 gapped (B=512≈pinch); B=2048 walls erode ends; mirror caps can't catch transverse escape — uniaxial | free wire, poled conduits | charge-circuit --mode=fwire --shift=1 |
| conduit vessel | anti-sheath + aligned-caps: 8 contiguous cells stable 200t vs 7 gapped baseline; inverted polarity → 6 cells (signature); holds at B=512/1024 | full cage: 4 transverse evens/cell + end caps | charge-circuit --mode=fsheath --shift=1 |
| self-poled vessel | runaway — write rule poles aligned (wrong sign); erosion writes −Δ → death spiral; even-flux decay >>6 halves growth, doubles survival | `qVacPol` + resistive loss | charge-circuit --mode=fsheath --vacpol=6 |
| strain reservoir | press delivered (ev27); symmetric internal kicks deposit canceling strain → zero net reservoir (wmerge); pinch erosion = rare threshold kicks (ev21≈8) below press floor | `qFieldReact` | wmerge --react / fsheath |
| tail-work | react=4: fluxV→−408 fill, net force 78→33, ev27 +396 after field death, drains to −12 floor; react=1: fluxV≡0, ev27=ev26 exactly (perfect elastic reflector) | rfill, B=400 40t hold | charge-circuit --mode=rfill |
| react conservation fix | uncapped shift<2 minted momentum (4t>|v| → ±312 limit cycle); debit now capped 4t≤|v| | rfill | — |
| proportional poling | field ∝ live current: −4→sheath −117 benign (7 cells=baseline); −2→−34/site spread (6); Δ-write both signs runaway | `qPolProp` | fsheath --polprop |
| self-confinement gap | working vessel needs ~500 field/site vs self-write cap ~live current (~50-100): ~10× amplification needed | fsheath | — |

## Confinement & reaction constants

| constant | value | conditions | harness |
|---|---|---|---|
| string potential | E = qString·(reach−slack), linear | saturated tube, funded kicks | string-tension |
| bank saturation | qString·(reach_max−slack) e.g. 128 = 16·8 | L=9 tube, kicks 50–400 | string-tension |
| break minting slope | +127 mass per cell of tube length | L≥12 fractures | string-tension |
| relativistic escape | any 1-hop/tick separation is unrecoverable | qString ≤32, m=512 | string-tension |
| pair-production barrier | scar ≥64, hard gate | face-channel conduit scar | reaction states |
| production yield | ~62.5–64% of scar → mass (rest → skeleton) | scar 64–400 | reaction states |
| charge-burn stoichiometry | exactly 4 mass per |q|, no threshold | q=−1…−400 | reaction states |
| production branching | linear per channel — x=1, x+y=2, x+y+z=3 pairs | multi-face scars | reaction states |
| beam-beam crossing | ~97–136% survival — transparent | perpendicular worn rails, crossing cell | crossing |
| packet phase | op = nu·age mod 256, exact (frozen ops verified) | qMergeGate armed cloud | fringes |
| fringe visibility | ~80–90% (declines 10 vs ~1) | d=4 path diff, nu sweep, gate=32 | fringes |
| fringe width | = qMergeGate window (±32 phase units) | same | fringes |

## Conservation

| constant | value | conditions | harness |
|---|---|---|---|
| emission balance | nu = shed/2, recapture restores | closed-box audit | conservation test |
| declined energy | → node heat (sealed) | merge/refusal paths all thermalize | merge/knee maps |
| incipient merge remainder | → heat | weighted-nu mixing | engine |
| string-break payout | +128 mass per endpoint | ≥12-node saturated tubes | harness |

## Thermal vacuum (flux-aware ledger)

| constant | value | conditions | harness |
|---|---|---|---|
| re-emission floor | 128 heat (authored default, `vac_floor`) | `h>floor` gates boiling | seeded bath |
| re-emission rate | 1/64 per hot node·tick (authored, `vac_rate`) | defaults = legacy hardcode | seeded bath |
| minted nu | `h>>3` (≤255) per emission | heat debited exactly nu | seeded bath |
| emission channel | random edge 6..17 only | face/corner never minted | engine |
| seeded-bath flux | ~4.3 emissions/tick, ~37 nu avg | 16-node × heat=4000 patch, floor=64 rate=8 | seeded bath |
| heat-ledger closure | **exactly 0** residual | Δheat = ev51+ev44−ev7−ev52, 200t | seeded bath |
| `ev51` | heat→packet minted nu | bath energy flux | counter |
| `ev52` | all reabsorbed nu→heat (19 sites) | caps/declines/remainders/TTL/annih/recoil | counter |
| heat saturation | >65535 clamps silently | caveat: extreme drives only | engine |

## Force from density (offer->momentum)

| constant | value | conditions | harness |
|---|---|---|---|
| momentum kick | ±1 per confirmed offer | signed by travel channel parity | force-probe |
| linear force | ~rate-scaled drift | ra 0.4->-3, 0.6->-10 (300t, 3x3 plate) | force-probe |
| thrust onset | ~ra 0.8 intermittent, 1.0 sustained | bursts to ±500-1000, sign-flipping | force-probe |
| balanced streams | ~0 in linear regime; runaway above onset | ra=rb=0.5 ~flat; ra=rb=1 -> +349 | force-probe |

## qRecoilLaw funded-impulse constants (law=4 unless noted)

| constant | value | conditions | harness |
|---|---|---|---|
| confirm kick | nu>>N (nu=96,N=4 -> -6) | funded: deposit = nu-kick | inline node |
| sub-quantum landing | kick=0 for nu<2^N | soft landing threshold | inline node |
| photoevaporation | node mass -1 per confirm (64->63) | debited from node mass; massless can't eject | inline node |
| spectral impedance | line~mass>>2; mass=1000 -> line~252 > nu_max 127 | heavy structure reflects ordinary quanta | inline node |
| hop wear | winding+1 on transit member per hop | 31 worn channels per 60t coast | inline node |
| launch debit | pay=min(k,|p|) on launch axis | never binds: k~p>>2<p, winding path unreachable | inline node |
| beam shadow | ~6% downstream attenuation (203/217) | nu=140 beam, 4000-mass knot, 50t | inline node |
| surf speed | ~1 cell/tick, knot rides beam front | radiation sailing, mass conserved | inline node |
| wake shielding | downstream knot 100% shadowed -> sweep-merge (m=8000) | two knots in series on beam | inline node |

## Wear decay + rail dynamics (qWearDecay)

| constant | value | conditions | harness |
|---|---|---|---|
| rail half-life | ~2^N ticks (stochastic floor for w<2^N) | even-cell winding only; odd structure untouched | inline node |
| rail runaway | W: 989->6421 over ~600t at N=0 | sustained traffic monotonically deepens rails -> opacity | inline node |
| decay vs load | N=6 retards ~7x but still saturates under traffic | forgetting wins only when traffic stops | inline node |
| odd-cell heat | permanent fossil (no drain, no re-emission) | ev44/ev51 live in even-cell phase | inline node |
| superheat precipitation | heat 65535 -> ~66000 mass appeared | rate=60 opposed-beam site | inline node |
| flame extinction floor | ~89 remnant (asymptotic, untaxed when quiescent) | unfed wound knot, qEvapShift=3 | flame.mjs |
| flame plateau | ~1050 (r=4) / ~1890 (r=16) | feed-rate-dependent sustained mass | flame.mjs |
| motion dilation | none for bare mass (tau=32/tick at v=c) | localTime site-bound | twin probe |
| internal-work dilation | ~0.5% (wound knot 31.85 vs bare 32.0/tick) | shed cycles tax own clock | wound-twin |
| wound mobility | zero: winding is site-bound, hopping strips structure | mass moves, being stays | wound-twin |
| bare-mass immortality | mass tax exempt: 4000 for 300t at shift=3 | qEvapShift only runs in composite-shed path | inline node |

## Emission constants

| constant | value | conditions | harness |
|---|---|---|---|
| geo_gap line | nu=(bm>>2)*2/L2 exact | weakest committed pair bm, L2=bondDist^2 or edgeLen2 | resonance.mjs |
| stim resonance | delta at nu==geo_gap only | 0 at +-1 nu; stim=36/80 probes at line | resonance.mjs |
| line vs structure | w->gap: 96->24,128->32,160->40,192->48 | 6 pumped pairs; spectrum tracks exactly | resonance.mjs |
| stim clone | nu=line (true clone), born=stimulator's incipBorn, stimulator's channel | collimated coherent pair (transmit+clone) | resonance.mjs |
| stim gain | downstream flux 104 vs 36 baseline (~3x) at nu=32 | pumped 6-pair fixture; off-line unchanged | resonance.mjs |
| transition release | dW/stim=32.3 = line winding | unpumped, funded exactly by shed | inline node |
| stim floor | committed volume must exceed 512 | tv=512 refuses unwind (flag still sets) | resonance.mjs |
| stim rate | ~36-45% of resonant probes | pumped 6-pair fixture | resonance.mjs |
| qResEmit spectrum | emitted nu = line, drifts 32->26 as state decays | spontaneous emission, unpumped | inline node |
| ensemble linewidth | response nu=26:10, 30:4, 32:3 (comb, red-skewed, ~20% of line) | unpumped decay, stim histogram over full life | inline node |
| correlation comb | admitted-depth separations all mult. of lambda=256/nu | co-emitted depth burst, merge gate | hbt.mjs |
| chaoticity contrast | comb dies entirely for random-nu sources | random-nu burst vs coherent | hbt.mjs |

## Nulls on record

| claim tested | result |
|---|---|
| ordinary two-arm interference without merge law | **null** — independent channels never compare phases |
| qOfferTorque clock coherence | **null** — identical with law on/off at tested strength |
| Le Sage drift from mutual shadow (1-node bodies, fog bath) | **below noise** at 400t — real per-quantum but ~100x diluted isotropically; needs scale |
| knot hop-rate on its own worn rail | **null** — identical trajectory virgin vs pre-worn; rail selectivity acts on flux spectrum only |
| standing flame from a directional feed | **negative** — fed knots surf or disperse; the persistent locus is the collision SITE (heat spot), not a knot |
| launch shortfall (drive-reservoir starvation) | **vacuous** — p-driven launch self-funds (k<p always); winding-driven path unreachable under current gates |
| Casimir-like effect | **null x2** — inert vacuum (unseeded); seeded bath shows no gap depletion in shadowing OR long-lambda regimes (d=4-12, <=0.5% vs noise) — mechanism diagnosed: volumetric sources + radiative equilibrium + ballistic packets = no boundary-shaped spectrum |

| wall strain-stall (breach-counter order) | **null at this scale** — record-only deposits correct/conserving (no charge-jam, flux identical to baseline) but stall=16 never bites: ~5 escaper transits across ~80 conduit faces can't charge any wall to threshold before the wire stabilizes at 7 cells |
| wall strain-stall (fuse order, unpaid fluxV) | **8 contiguous cells incl. drive-end x9 terminal, 200t** — beats ghost bottle (8 at x11); stall=8 catches escaper dep~8-12 — but deposits were unpaid records in a spendable register (minting hole) |
| lane-fatigue stall (winding wear + paid pd absorption) | **9/9 cells held 200t, flux = no-pinch control [53,50,50,50]** — stall=4, traffic-induced rigidity; ev27=4324 paid absorptions; strictly conserving |
| creep rupture threshold | creep=4: baseline erosion (walls leak); creep=50: wall holds ~50t then discrete yields peel cells 9->3; ev64 counts ruptures | stall=4 wall, 200t | fsheath --creep |
| elastic wall response | stall=4+react=4: 9/9 held, ev27 4324->32544 — denied momentum stored in fluxV then pressed back onto pressers; mass denied, momentum returned | 200t closed loop | fsheath --wallreact |
| stall threshold invariance | stall=2,3,8,16 all hold 9/9, ev27=1924 identical @100t — threshold sets lock latency, total absorption is conserved | 100t sweep | fsheath --stall |
| wall radiation damping | stall=4+wave=3 no-vessel: ev27 1924->116559 (60x) — wall sheds absorbed strain as field waves; dissipation, still 9/9 held | 100t | fsheath --wallwave |
| wmerge creep barrier | creep=8: sep=2.00 flat, ev64=0 — barrier is upstream of relay (no denied hops exist); creep can't integrate absent pressure | 120t null | wmerge --creep |
| strain battery charge efficiency | denied momentum -> fluxV exactly 1:1, linear (3200->3200, 1600->1600); react=0 holds indefinitely, zero self-discharge over 30t | spring probe | spring-probe |
| strain discharge rate | contact-bound press: min(|v|>>react, |v|>>2) per tick, 4-channel spread; react<=2 single-tick dump, react=4 ~25%/tick | spring stiffness = react | spring-probe |
| strain residual lock | leftover fluxV stays in the wall when contact breaks (1128/3200 at react=4) — discharge requires a staying customer | react=4 run | spring-probe |
| strain charge fungibility | second customer on far face receives FULL stored reservoir in one tick (3200 -> B); duel: si-order customer wins per tick | spring-handoff swap/duel | spring-handoff |
| strain discharge exit lane | press spreads impulse over all 4 FCC axis pairs -> customer exits least-worn DIAGONAL, never back through the stalled lane | duel mass track (1,-1,0)/(1,1,0) | spring-handoff |
| carve-load tear law | conduit incipient load: <16 baseline src>>3, 16-31 carved src>>2 (2.0x), >=32 stall-denied | single-hop response curve | carve-lane |
| stress-wave speed | fluxV impulse on committed wire propagates as polarization wave: ~2.3 ticks/link (0.43 link/tick) sustained front at vs=3 | strain-wave | strain-wave |
| stress-wave damping | vs=6 front dies at link 7 (self-extinguishing below lap threshold); amplitude piles ~6x injection at source when coupling weak | strain-wave vs sweep | strain-wave |
| battery radiation channel | stored strain's ONLY self-discharge path is radiation into committed structure — absent without vacpol coupling | vs=0 control | strain-wave |
| strain relay (remote press) | denied momentum -> wall fluxV -> wave -> distant cell pressed: near t=7, far t=11 (~1t/link press arrival) | strain-relay | strain-relay |
| strain relay controls | vs=0 and uncommitted-wire arms: receivers get exactly 0 while A still bounces — transmission needs BOTH wave law and committed medium | 2 clean nulls | strain-relay |
| strain superposition | anti-polarity pulses cross mid-wire and pass through (neg packet ends LEFT at t=28+); E dips->rebuilds — destructive interference transient, not absorption | strain-interfere | strain-interfere |
| strain constructive node | same-polarity pulses: center flux 9805 vs 5251 lone (~2x) | strain-interfere same | strain-interfere |
| wall momentum toll (either sign) | **negative** — debiting carrier momentum at wall sites jams charge into fewer cells (flux 48-74 vs 3-13), flux^2 feedback accelerates erosion; yield is binary so sub-threshold tolls can only jam, never brake |
| wave Y-split ratio | deg=3 junction splits transmission exactly 50/50 between mirror arms; per-arm amplitude 0.66 of deg=2 thru case — matches Kirchhoff t=2/3 | strain-split arms=2 vs 1 | strain-split |
| wave dead-end pile-up | deg=1 junction flux 7415 vs 3420 thru (2.2x) — fixed-end standing-wave pile-up; reflections superpose positively (flux is DC-offset) | strain-split arms=0 | strain-split |
| wave speed vs coupling | c ~ 2^(-vs/2) below the causal ceiling: vs=1 ~1.0, vs=2 ~0.55, vs=3 ~0.43, vs=4 ~0.30 link/tick — discrete wave-equation scaling, capped at 1 link/tick | vs sweep, amp=2000 | strain-wave |
| wave speed vs amplitude | independent — amp 500/2000/8000 arrival times differ <=1-2t/link (threshold artifact on the leading edge, not speed) | amp sweep, vs=3 | strain-wave |
| wave extinction distance | weak coupling self-extinguishes: vs=4 dies L11, vs=5 L9, vs=6 L7 — lap falls below 2^vs as the pulse spreads, truncation kills it | vs sweep | strain-wave |
| cavity round-trip period | scales as 2L/c: LEN 8/12/16/24 -> envelope returns at t~40/57/74/108 vs predicted 37/56/74/112 — a true standing-wave mode | ringdown, vs=3 | strain-cavity |
| medium exchange clock | fast flux<->fluxV oscillation ~11t spacing at midpoint, INDEPENDENT of wire length — local restoring clock set by vs, not the cavity mode | ringdown len sweep | strain-cavity |
| stub resonator | 4-link dead-end branch stores MORE field than the thru arm: stub peak 6120 vs armA 5561, E_stub ~96M vs ~52M late — amplitude grows toward the free end (quarter-wave mode), a field-side strain capacitor | strain-stub slen=4 | strain-stub |
| anisotropy continuum limit | aniso peaks ~1.39 at ~6 cells then DECAYS to ~1.03 at 20+ cells — long-wavelength fronts circularize, the grain hides in the far field (detection problem: inside observers measuring at long wavelength see a smooth isotropic medium) | membrane half=16, 80t | strain-membrane |
| membrane anisotropy | 2-D committed sheet (deg=4): wavefront is a diamond-leaning square — axis dirs ~1.5t/cell, diagonal ~1.7t/cell (15-17% slower); slower than circular-isotropic, faster than pure Manhattan (superposition fills corners); per-edge-step ~2.3t matches wire speed | strain-membrane vs=3 | strain-membrane |
| membrane amplitude decay | peak flux vs distance ~ 1/dist^0.9 (1279@k1 -> 141@k11); after 1/64-bleed correction ~1/dist^0.7 — steeper than lossless 2-D 1/sqrt(r): bleed+truncation compound the spreading; edge reflections raise peaks at k>=12 | membrane half=14 | inline scan |
| Cherenkov wake (Mach cone) | source hopping 1 link/tick on a deg=4 sheet (c=0.43): iso-arrival contours form a V, half-angle ~30 deg vs arcsin(0.43)=25.5 predicted (lattice grain + threshold front inflate ~18%); speed=3 control (v=0.33< c): compact track-hugging wake, NO cone | strain-cherenkov | strain-cherenkov |
| weakest-edge tie-break (bug fix) | geo_gap + site_unwind picked axis 0 on symmetric winding -> anisotropic emission/erosion; rotated by rand_site(si,72/73)%13 -> symmetric knot per-axis loss now uniform ~480 across all 13 axes | symmetric knot 120t | inline scan |
| wall fatigue boundary | sustained 1-denial/tick pressure vs wearDecay healing: lock iff stall <~ stall* = 2^(decay+~1.2) — decay4:26, decay5:~72, decay6:~144, decay7-8:>256. Locked walls equilibrate ws 1-2 below the stall edge; near-boundary failures STOCHASTIC (ws flickers under threshold — stall=32/d4 held 102t then opened) | fatigue-cal sweep | fatigue-cal |
| deflect corner-jet (bug fix) | DECLINE deflection scanned ch6..17 first-tie-wins -> all declines jetted (+1,+1,0); fix: rotate scan by rand_site(si,70)%12 -> knot-side deflect histogram max-share 48%->16%/13% isotropic (qTick salt needed: site-only hash keeps a fixed jet per site) | deflect-iso | deflect-iso |
| phonon force law (1-D wire) | delivered strain ~ exp(-D/22) — quasi-exponential screening, ~4.5%/link resistive loss dominates (no geometric dilution on a wire); NOT a power law; far-end reflection bumps amplitude at wire terminus | strain-force + fluxV envelope | strain-force |
| strain saturation (yield) | int16 flux clamp 32767 = the medium's yield strain: amp=30000 forms a flat-topped saturated shelf (~7 links pinned at 32767) advancing with a steep front — a SHOCK-like waveform, vs smooth ~2.9x integrated profiles at amp=2000 | amp 2000 vs 30000 | inline profile |
| wave momentum ledger | Sigma fluxV over the wire: 2000 -> 1812 in 40t (-0.24%/tick, lap>>vs truncation) — the injected momentum CONSERVED in the v register; ZERO off-wire cells touched (medium-bounded exactly); Sigma flux grows 0->56k as the strain integrator | whole-grid audit | inline scan |
| hexbuckle curvature screening | U-bend suppresses the charge dipole non-monotonically: dip8 -29%, dip16 -36%, dip24 -35%, dip48 -18% vs flat 25128+-4861 — screening maximum at dip16-24, recovers at deep curvature; zero fractures in 84 runs (elastic screening, not break-related) | 64^3, n=12, t=60 | hexbuckle-ensemble |

*Method note: every number above was produced against a fresh grid or
isolated trial; shared-state ordering contamination was audited out of
the early sweeps (see findings). Harnesses live in `script/cascade/`;
the engine is `src/moore26.c`; builds through `src/build.sh` only.*

## Optical & interferometric

| constant | value | conditions | harness |
|---|---|---|---|
| stim resonance | delta at nu==geo_gap; 36 ev17 at nu=32, zero at +/-1 | 6 committed pairs @128, pumped | resonance.mjs |
| line tracking | w->gap: 96->24, 128->32, 160->40, 192->48 | weakest-pair gap | resonance.mjs |
| optical gain | ~3x downstream flux at the line (104 vs 36) | stimulator transmits, clone at line | resonance.mjs |
| transition energy | dW/stim = 32.3 ~= line | 6 pairs @128 | resonance.mjs |
| ensemble linewidth | stim hist {26:10,30:4,32:3} ~20% of line | unpumped decay drift | resonance.mjs |
| correlation comb | admitted-depth seps all mult. of lambda=256/nu | co-emitted depth burst | hbt.mjs |
| HBT source-size | comb spacing=lambda=256/nu fixed; support edge ~R (R=8->sep4, R=15->sep12) | coherent depth burst nu=64, merge gate 8 | inline node / hbt.mjs |
| comb nu-tracking | nu=128->lambda=2 denser comb {2,4,6,12,14}; nu=32->{2} | R=15 depth burst | inline node |
| scattering dip | def=0 at nu=24 for wound+tube all lengths; onset nu>=48 (tube def 13-15) | dense ch14 beam, 60t | formfactor.mjs |
| scatter saturation | tube def/out saturate by L=2 (len 5) at nu=64 | length sweep | formfactor.mjs |

## Provenance & deviation-age

| constant | value | conditions | harness |
|---|---|---|---|
| deviation ages | grown knot birthdays spread t4..t291; authored bondTick=0 | 300t ch14 feed vs winding_set | devage.mjs |
| wear vs bond split | grown fixture: 74 ageless wear cells vs 25 birthday'd bond cells | same run | devage.mjs |
| stratigraphy survival | 21 birthdays persist after 150t decay | 200t feed + 150t idle | devage.mjs |
| relay speed | bare kicked mass: 1 cell/tick complete handoff, odd->odd via even conduit | odd cell m512, momentum pair7=32768 | thingtrack.mjs |
| birthday trail | every vacated site writes m=1 + bondTick=confirm-tick | same | thingtrack.mjs |
| rupture-vs-heal race | stall=200, ws seeded +20: healing phase (decay<=6) healT = 3/6/23t at d4/5/6 — rupture wins iff creepYield <~ healT (cy=20/d6 y@21 beats heal@23; cy=22 loses). Locked phase (decay>=7): ratchet sustains ws above stall (d7 ws->237, d8 280 pinned) — healing NEVER opens, rupture is the only escape at t~=cy+1 (deterministic, control decay=0/cy=30 -> y@31) | fatigue-cal --race + point runs | fatigue-cal |
| ratchet equilibrium ws* | sustained-denial wear balance (+1/denial vs w>>decay): ws* ~ 2^(decay+~1) — d6->121-128, d7->237, d8->280 (from 220 seed). The fatigue boundary IS this equilibrium: stall* = ws*. healT is margin-driven (multiplicative decay sheds a 20-unit seed margin faster at higher stall: d4 healT 9/5/3 for stall 64/128/256; near stall* ratchet-balance stretches healT to ~23t) | fatigue-cal point runs | fatigue-cal |
