---
title: The Measured Substrate
---

# The Measured Substrate: A Monograph of the planck3 Campaign

*Definitive synthesis of milestones M1–M31 — every claim below is backed by a committed headless harness and git commit hash; the running narrative lives in [The Open Frontier](./frontier.md), the M1–M18 detail in [Discrete Quantum Optics](./discrete-quantum-optics.md). This document states what the substrate provably does, what it provably cannot do, and the one mechanism that separates the two.*

## Foundational Axioms

The substrate is `src/planck3.c`: a deterministic, integer-only cellular automaton on a 12-port True-FCC lattice. Each cell is a 6-byte node — quanta `q∈[0,255]`, spin `s` (one of 12 ports or 0), buffer `b`, heat `h` (u16), tension `tn`. The update is receiver-pull and memoryless: state at `t+1` depends only on neighbor state at `t`.

**The three-point test** — what the substrate is built from:

1. **Anonymous integers.** No particle IDs, no substance tags, no provenance. A quantum here is indistinguishable from a quantum anywhere else; allegiance exists only in the harness, never in the node.
2. **Memoryless local updates.** No archival storage, no history registers, no hysteresis variables. Every "memory" observed in the campaign is carried by the field between cells, not written inside them.
3. **Local capacity limits.** `FLOW_CAP=160` caps per-tick emission (excess stalls as residue); `DEADLOCK=200` gates pull acceptance (a fuller receiver refuses); occupancy in `(160, 200]` is the congestion-visibility band that re-aims neighboring spins toward itself.

Zero continuous complex Hilbert space (ℂ), zero global clock beyond the tick counter, zero substance ontology. Everything the engine does decomposes into three mechanisms: **ballistic v=1 transport**, **occupancy-gated channels**, and **congestion capture**.

## Part I — The Microscopic Quantum Optics Bedrock (M1–M18)

Canonical `planck3` in sync mode (`planck3_set_sync(1)`). All claims anchored to commits `ab24a7b` through `a03c69c`.

| Result | Harness | Commit |
|--------|---------|--------|
| Sync transport is exactly mass-conserving (residual 0 / 10⁴ ticks); heat is a driven-dissipative sector, not conserved | `test_conservation.c` | `ab24a7b` |
| Cavity equilibrates to classical equipartition + BZ cutoff + low-k condensation — no Planck spectrum | `test_cavity.c` | `ab24a7b` |
| v = 1 link/tick on all 12 ports, zero dispersion, elastic REV3 wall reflection | `test_tof.c` | `ab24a7b` |
| Two-slit detection exactly additive (181+181=362); disjoint streamlines cannot interact | `test_doubleslit.c` | `ab24a7b` |
| Converging-beam S-matrix: shared-cell co-arrival fuses + vector-sum steers; equal head-on deposits a permanent lump | `test_beams.c` | `df3ddbb` |
| Probe-vs-lump phase diagram (pickup / oscillator / ablation / reflection) selected by the DEADLOCK gate; no radiation pressure, no inertia | `test_lump.c` | `8db38d3` |
| Dilute collision law is scale-invariant; opacity is self-induced choking at FLOW_CAP, not a refractive index | `test_bath.c` | `cb70e41` |
| Metastable APD avalanche: q=199 prime + q=3 trigger → 160-quantum discharge; single-shot only | `test_detector.c` | `cb70e41` |
| Discrete Mach–Zehnder: fusion channel is a periodic Dirac comb (`dt mod τ ≡ ΔL mod λ`), not cos² | `test_slitapd.c` | `f85c87d` |
| Bound oscillator = τ=4 two-lobe breather; a phase-sensitive junction with 4 arrival-phase outcome classes | `test_osc.c` | `c0f900d` |
| Phase-graded breather array paints a spatial transmission comb on the APD wall | `test_oscarray.c` | `9dfaee6` |
| Thermal bath spontaneously nucleates breathers — the substrate is fertile; census: ~85% dead lumps, ~11% τ=4 breathers | `test_ecology.c` | `a93ba44` |
| Breathers are dark resonators: zero emission, phase-lock-only coupling, die under dense flux; E=hν inexpressible — FLOW_CAP=160 is the substrate's action quantum | `test_osc.c` train + `test_ecology.c` | `36aead8` |
| Dimer breather: Δφ∈{1,3} bonds (shared-lobe multiplexing), Δφ=0 annihilates, Δφ=2 kills asymmetrically; zero wild dimers — molecules require assembly | `test_couple.c` + ecology audit | `b7e5b2a`, `f45874b` |
| Velocity spectrum is exactly {0 structures, 1 packets} — no sub-light matter, no duty-cycle v<1 | `test_drift.c` | `f45874b` |
| Heat channel is a leaky integrator whose spray threshold is unreachable in practice | `test_heat.c` | `a03c69c` |

**Proven-absent channels (M1–M18):** wave superposition (cos²), refractive index n>1, radiation pressure, inertia, energy conservation, reusable single-pixel detectors, E=hν action–frequency coupling. Phase on this substrate is *scheduling*, not a continuous amplitude.

## Part II — The Mesoscale Bridge (M19–M21)

`src/meso3i.c`: integer-occupancy multichannel lattice gas on the even-parity True-FCC sublattice — the question of whether richer per-node dynamics unlocks bound moving matter. Commits `bc3e192` through `f6353a0`.

| Result | Harness | Commit |
|--------|---------|--------|
| Boolean FHP-class gas on True-FCC: exact mass+momentum conservation, counter-flow passes, 4th-rank isotropy repaired by shell weighting | `test_meso3.c` | `bc3e192` |
| The 1986 Boolean Galilean defect *measured* on both shells: g(ρ) sign-reversal quantified | `test_meso3.c` T7 | `c60b7e7` |
| Integer occupancy eliminates the sign reversal — g plateau flat in u | `meso3i.c` T8/T8b | `2df1957`, `38999ad` |
| Edge-dwell delay lines give fractional duty-cycle velocity v=1/k — first sub-light transport, but of packets, not structures | `test_meso3.c` T9 | `0761395` |
| Pair-group move graph is exactly one component per (mass, momentum) class — zero protected sectors, nothing hidden to build on | `test_m20a.c` | `822d7d2` |
| Bound-structure probes: coherence exists only in the collision-free sector; any structure with collidable internal DOF thermalizes | `test_meso3.c` T10 | `ee2909c` |
| ρ-gated planar lamination measured — a pancake phase, not a particle | `meso3i.c` IGATE T11 | `391541b` |
| Density-gradient deflection sweep: no collision-level rule produces position-space confinement — the barrier is structural | `test_m20b.c` T12 | `f6353a0` |

**Bridge verdict:** the mesoscale gas is a better fluid and a worse building material. It measures conservation and Galilean mechanics cleanly, but confinement is unreachable at the collision-rule level — binding requires a register *outside* the move family.

## Part III — The Bound-Matter Laws (M22–M28b)

Two substrate families tested: engineered Q-register variants on `meso3i` (labeled as rule-family experiments, not canonical mechanics), and canonical `planck3` breather chemistry.

### The Q-register program — engineered, exhausted

| Result | Commit |
|--------|--------|
| Q-register core binds a persistent lump — and anchors at v≈0, reproducing the invariant | `29515b3` |
| External field cannot reach Q-bound mass (bitwise-identical runs at field 0/16): bound mass is dynamically self-shielding | `3dede2c` |
| Pyrochlore defects ARE field-coupled: ±charge separation under bias, drift v∝F — bond-native matter couples where Q-mass cannot | `b5bfd2a` |
| T17 phase-gated conveyor: first 0<v<1 bound-mass transport (v≈0.064) — envelope decoheres into ring current | `29e9a71` |
| T18 thresholded emission coheres (R≈0.91) but freezes; proportional variants equilibrate to density slab | `02aea0b`, `9d8297b` |
| T19 Q-weighted capture fails — three-way complementarity final form | `6693abd` |
| T20 peristaltic cycle: 98% mass recondensation (discrete de Broglie pulsation), zero locomotion — discrete Scallop bound | `f33630f` |

**The Pick-Two Triangle (M22–M24 final form):** binding, transport, and coherence are each achievable; no tested local rule achieves all three. The Q-track is exhausted with a measured boundary, not a guess.

### Canonical breather chemistry — the structure alphabet

| Result | Harness | Commit |
|--------|---------|--------|
| Trimer breather: 3-core chain molecule stable at t=1000 — fifth structure class | `test_trimer.c` | `72cc94d` |
| Arbitrary n-mer chains: parity coloring (odd-Δφ bonds), lossless phase substitution, local-only fracture | `test_trimer.c` | `cd9d6a9` |
| All 6 axes host breathers; tilted axes obey a stricter 3-phase bond rule ({0,1,2}, ±1 only); 3-D chains stable | `test_ring.c` | `9427249` |
| Corridor crossfire: the phase-3 dead slot is a penetrable one-packet window for foreign traffic | `test_ring.c` | `cc42446` |
| Schedule braid impossible — the dead slot cannot multiplex; bound structures are strictly disjoint | `test_ring.c` | `1459c67` |
| Parallel chains: Δy=1 mutually lethal, Δy≥2 independent — a hard 1-cell kill shell; no 2-D sheets | `test_ring.c` | `8aa45ff` |

**The bound-matter law:** on canonical `planck3`, bound matter is exactly the set of disjoint, straight, 1-D breather crystals along any of 6 axes — stable at arbitrary length, unable to corner, cross, braid, interpenetrate, or pack into sheets. Binding ⇒ v=0 held across three independent mechanism families (Q-register, breather chemistry, orbit geometry).

## Part IV — The Macro Regime (M27–M31)

The campaign's own "knot-scale only" conclusion was tested to destruction — and overturned.

| Result | Harness | Commit |
|--------|---------|--------|
| Minimum Phase-Locked loop = 6-cell planar hexagon (BFS proof: zero cycles at L=3–5); no dead-paint configuration circulates | `minloop.mjs` + `test_orbit.c` | `789a502` |
| L-sweep falsifies mod-4 clock hypothesis: L=9 completes an orbit, L=8/12 don't unlock; escape is near-antipodal | `test_orbit.c` + DFS | `8aa45ff` |
| Exit-vector diagnostic: packet completes a full orbit then exits along incident momentum — **inertial blowout via spin consumption**: a painted spin steers once, then arrival momentum overwrites it | `test_orbit.c` trace | `92da507` |
| Curl exchange-field (`planck3_set_curl`, RFC-050) exists but can't rescue q=1 at minimum scale — needs real current density | `test_orbit.c` | `6828877` |
| Ambient sea: incoherent q∈[1,3] flux erodes a breather in 25–50 ticks; no halo, no medium — **the vacuum is a protective void** | `test_sea.c` | `412775e` |
| Driven whirlpool: counter-beams + curl produce a ~110k-quanta congestion slug sustained by throughput — a true dissipative structure that dissolves on drive cutoff; a jam, not a vortex | `test_whirlpool.c` | `1bac9f3` |
| **Circulation onset is a state threshold:** dead paint gives exactly one orbit at L=6…498; a q=60+heat=500 floor gives perpetual circulation *even at L=6*; curl adds nothing — heat-driven emission is the regenerator | `test_orbit2.c` | `3739981` |

## The Unified Phase Space

```
+--------------------------------------------------------------------------------------------------+
|                                   THE PLANCK FIELD PHASE SPACE                                   |
+--------------------------------------------------------------------------------------------------+
|  REGIME              |  UNDRIVEN (DEAD SUBSTRATE)            |  DRIVEN (THERMODYNAMIC FLOW)      |
+----------------------+---------------------------------------+-----------------------------------+
|  Rest Matter (v = 0) |  1-D straight breather crystals;     |  ~110k steady-state congestion     |
|                      |  1-cell kill shell; Pick-Two bound   |  slug (jam, not eddy); dissolves   |
|                      |                                       |  on drive cutoff                   |
+----------------------+---------------------------------------+-----------------------------------+
|  Circulation (v = 1) |  One-shot waveguides: exactly 1      |  Perpetual conductor at ALL        |
|                      |  orbit at any L ∈ [6, 498],          |  scales L ≥ 6 — live floor         |
|                      |  inertial blowout at re-entry        |  regenerates guidance each tick    |
+----------------------+---------------------------------------+-----------------------------------+
|  Vacuum              |  Protective void — silence is        |  Conductive floor — carries        |
|                      |  load-bearing; incoherent flux       |  excitation, creates none          |
|                      |  erodes bound matter in <50 ticks    |                                    |
+----------------------+---------------------------------------+-----------------------------------+
```

**The mechanism that unifies it:** arrival momentum re-aims `out->spin` every tick. On a dead substrate a painted guide is consumed by the first traversal — hence one orbit at any scale. On a driven floor, continuous upstream inflow re-aims each cell's spin back to the local tangent every tick — the loom knots' multi-inflow refresh, supplied by a one-cell-thick heated floor instead of 27,971 painted cells. **Circulation was never a scale phenomenon; it is a drive phenomenon.** The earlier "knot-scale only" reading is retracted: the loom's size bought topological complexity, not the circulation mechanism.

## The Vanguard Lineage

The campaign's measured physics grounds each adopted pillar — and its rejects stand sharper than before (see [vanguard.md](../vanguard.md) for the full audit):

| Pioneer | Adopted foundation | Campaign grounding |
|---------|--------------------|--------------------|
| 't Hooft | Discrete deterministic automaton | The entire arc — every result is bitwise reproducible integer mechanics |
| Lamb & Hobson | No point particles; extended modes | Breathers are extended 3–5 cell cycles; "particles" are resonant structures, never points |
| Rovelli | Relational state | All properties measured are relational — bond Δφ, chain parity, lobe sharing; no intrinsic substance tags exist |
| Markopoulou & Smolin | Graphity / geometrogenesis | 12-port True-FCC graph; loop existence is graph-theoretic (BFS proof of L_min=6) |
| Heisenberg & Euler | Vacuum non-linearity | DEADLOCK gate is a measured light-light channel — but the campaign's sharpest correction: the vacuum must be *quiet*; saturation exists, fluctuation does not help |
| Hoffman | Perceptual dashboard | Adopted only as epistemology; the substrate itself needs no observer — every claim here is observer-independent telemetry |

The rejected detours stay rejected, now with evidence: no ℂ register was needed anywhere (phase = scheduling, measured), no operationalism (packets in flight are real deterministic state, tracked per-tick), no idealism (the substrate's laws are harness-invariant).

## Provenance & Honesty Ledger

- **Canonical vs engineered:** M1–M18, M25–M31 are canonical `planck3.c`; M19–M21, M23b are canonical `meso3i.c`; M22–M24 (Q-register, T15–T20) are *engineered rule-family* experiments — measured, but not substrate-native mechanics.
- **Retractions on record:** "circulation is knot-scale only" (M27) → corrected by M31 (drive threshold, not scale); "antipodal/half-orbit escape" (M27b) → corrected by M28c (sampling artifact; true failure is re-entry).
- **Known unexplored knobs:** `set_recoil`, `set_split`/`set_split_duty`, `set_trate`, `set_dissipation` remain dormant — cataloged at M28d for future campaigns.
- **Reproducibility:** every result above names its harness in `src/test_*.c` or `script/*.mjs` and its commit hash; native builds via `gcc:13` Docker, Wasm via `src/build.sh` — see AGENTS.md.

*29 milestones, one mechanism: occupancy gates decide everything, and drive decides whether a guide lives.*
