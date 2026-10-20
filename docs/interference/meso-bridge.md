---
title: The Multi-Channel Bridge
---

# The Multi-Channel Bridge: meso3i Findings

*The canonical simulation substrate going forward is `src/meso3i.c` — a multichannel integer-occupancy lattice gas on the True-FCC lattice. Unlike a single-spin prototype, every node carries an array of independent directional channels: simultaneous inflow on some ports and outflow on others is native mechanics, not a special case. This page consolidates the measured findings on that substrate as the seed for the accretion/outflow campaign.*

## The Substrate

`meso3i.c` runs on the even-parity True-FCC sublattice: D3Q13 channels (12 face-diagonal + rest) or D3Q19 (+ 6 axial second-shell) with `uint8_t` integer populations per channel. Collision is a finite, enumerable move family over channel occupancy — mass and momentum conserved exactly by construction, then streaming along the True-FCC adjacency. The Q-register extensions (`IQMODE`) add a scalar core register *outside* the collision family: antipodal pairs may condense `2→Q`, and emission returns mass to channels on a τ=4 clock.

## Measured Findings

| # | Finding | Harness | Commit |
|---|---------|---------|--------|
| M19 | Boolean gas on True-FCC conserves mass+momentum exactly; counter-flow passes; 4th-rank isotropy repaired by analytic 1/8 D3Q19 axial-shell weighting | `test_meso3.c` | `bc3e192` |
| M19-T7 | The 1986 Boolean Galilean defect measured directly — g(ρ) sign-reversal quantified on both shells | `test_meso3.c` | `c60b7e7` |
| M19-T8 | Integer occupancy eliminates the sign reversal; g plateau flat in u | `meso3i.c` | `2df1957`, `38999ad` |
| M19-T9 | Edge-dwell delay lines produce fractional duty-cycle velocity v = 1/k | `test_meso3.c` | `0761395` |
| M20a | Pair-group move graph is exactly one component per (mass, momentum) class — no hidden protected sectors; mass and momentum are the only invariants | `test_m20a.c` | `822d7d2` |
| M20b-A | Bound-structure probes: coherence exists only in the collision-free sector; collidable internal DOF thermalize | `test_meso3.c` T10 | `ee2909c` |
| M20b-B | Rest-trapping and planar-circulation subfamilies *do* create protected sectors; angular restriction alone does not | `test_m20a.c` | `8ae2bb1` |
| M20b-T11 | ρ-gated planar core produces genuine lamination — a pancake phase, not a confined particle | `meso3i.c` IGATE | `391541b` |
| M21 | Deflection sweep: no collision-level rule produces position-space confinement — the barrier is structural, not parametric | `test_m20b.c` T12 | `f6353a0` |
| M22 | Q-register core binds a stable localized lump — condensation `2→Q` is the ratchet the rest channel lacked | `meso3i.c` IQMODE | `29515b3` |
| M23 | External collision-weight field cannot reach Q-bound mass — bound mass is dynamically self-shielding (bitwise-identical runs) | `test_m20b.c` T15/T16 | `3dede2c` |
| M23b | Pyrochlore ice-rule defects ARE field-coupled: ±charge separation under bias, drift v∝F — bond-native matter couples where parked mass cannot | offline probe | `b5bfd2a` |
| M24-T17 | Phase-gated emit/capture conveyor: first bound-mass transport (v≈0.064) — envelope decoheres into ring current | `meso3i.c` qmode 6 | `29e9a71` |
| M24-T18 | Thresholded emission coheres (R≈0.91) but freezes; proportional variants equilibrate to a density slab | `meso3i.c` | `02aea0b`, `9d8297b` |
| M24-T19 | Q-weighted capture fails — **Pick-Two Triangle**: binding, transport, coherence each achievable, never all three | `meso3i.c` | `6693abd` |
| M24-T20 | Peristaltic cycle: 98% mass recondensation (discrete de Broglie pulsation), zero locomotion | `meso3i.c` qmode 8 | `f33630f` |

## The Open Question

The substrate's measured primitives — multi-channel simultaneous inflow/outflow, exact conservation, a condense/emit ratchet in the Q register, field-coupled defect matter — are the pieces of the actual target: **how a True-FCC node can accrete incoming flux while continuously venting outflow**, settling into a bound condensate sustained by throughput rather than a frozen trap. What is not yet measured: whether steady driven accretion on multichannel nodes self-organizes a persistent core, what density profile it carries, and whether venting selects a preferred emission axis. That is the campaign this page seeds.

*Q-register (M22–M24) results are engineered rule-family experiments — measured on the multichannel substrate but not its native collision mechanics.*
