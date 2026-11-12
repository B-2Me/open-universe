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
lattice produced. Distances in cells, times in ticks.

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

## Conservation

| constant | value | conditions | harness |
|---|---|---|---|
| emission balance | nu = shed/2, recapture restores | closed-box audit | conservation test |
| declined energy | → node heat (sealed) | merge/refusal paths all thermalize | merge/knee maps |
| incipient merge remainder | → heat | weighted-nu mixing | engine |
| string-break payout | +128 mass per endpoint | ≥12-node saturated tubes | harness |

## Nulls on record

| claim tested | result |
|---|---|
| ordinary two-arm interference without merge law | **null** — independent channels never compare phases |
| qOfferTorque clock coherence | **null** — identical with law on/off at tested strength |
| Casimir-like effect | **null** — inert vacuum, two plates feel nothing |

*Method note: every number above was produced against a fresh grid or
isolated trial; shared-state ordering contamination was audited out of
the early sweeps (see findings). Harnesses live in `script/cascade/`;
the engine is `src/moore26.c`; builds through `src/build.sh` only.*
