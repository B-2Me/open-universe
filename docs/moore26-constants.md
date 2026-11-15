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

*Method note: every number above was produced against a fresh grid or
isolated trial; shared-state ordering contamination was audited out of
the early sweeps (see findings). Harnesses live in `script/cascade/`;
the engine is `src/moore26.c`; builds through `src/build.sh` only.*
