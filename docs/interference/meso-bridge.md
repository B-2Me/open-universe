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

## The Accretion/Outflow Experiment (M32)

`src/test_accrete.c` — 18-channel convergent "spoke" drive onto a central node, open drained box, injection `rate=4/ray/tick`.

| Regime | Result |
|--------|--------|
| **Native collision** | Pure throughput: ρ_C≈20 steady, ~94% of injected flux drains. A convergent node is a transparent scattering point — no accretion, no core. |
| **+ Q condense (qmode 1)** | Unbounded accretion: Q_C climbs linearly (≈+0.55/t, ~30% of throughput), ΣQ spreads across the box. A sink, not a structure. |
| **+ condense + emit (qmode 2)** | **Dynamic equilibrium: Q_C plateaus at ~30 under sustained inflow≈30, outflow≈20** — accretion and venting balance. The bound core is sustained only while driven. |
| **Drive cutoff @ t=200** | condense+emit: Q_C decays to 0 in ~100 ticks, total mass→4 — **full dissolution**; the core existed only inside the throughput gradient. condense-only: Q_C=116 frozen forever — bound deposit, not driven. |

**The accretion law:** accretion and outflow are separable channels. Native collisions give outflow-only; a condensation ratchet gives accretion-only; the structure that both accretes *and* vents requires both channels open — and lives strictly inside the gradient (dissipative, Prigogine-class), while accretion-without-venting produces frozen bound deposits.

### M32b — asymmetric drive and core scaling

- **Jet test (equatorial spokes only, dz=0 channels):** no collimated polar outflow — z-moving channels at C read zero outflow share; drained mass splits ~42% z-faces / 58% side-faces, consistent with isotropic diffusion downstream, not bipolar jets. Equatorial accretion does not select a vent axis.
- **Core-size scaling (isotropic condense+emit):** rate=1–2 → sub-threshold, no sustained core; rate=4 → Q_C≈30 plateau; rate=8 → Q_C≈180 still climbing at t=300; rate=16 → saturates at the u8 cap (255). **The driven core's size follows the feed rate, bounded by register saturation — there is an onset threshold (between rate 2 and 4) and a hard ceiling, not a linear law.**

*Q-register (M22–M24, M32) results are engineered rule-family experiments — measured on the multichannel substrate but not its native collision mechanics.*

### M32c — channel-native ratchet test (ICOND alone)

Can pure channel dynamics condense without the Q register? The rest channel is a native v=0 state, and `ICOND` density-weights collision *outputs* toward it — the mildest possible arrow: no new state, just a weighted output preference. (Plumbing note: ICOND weighting lived inside the weighted branch gated by `IBIAS||IFLD`, so a one-line engine change now lets `ICOND` alone activate that branch — flag-gated, inert when 0.)

**Result: negative, and instructive** (`qmode=0, icond=16`):

- At rate=4 (ρ_C≈20): identical to native — the `atti` tent cuts to zero above ρ=8, so **the ratchet disarms exactly where density is highest**. Self-limiting by construction.
- At rate=1 (ρ_C≈8–14, inside the atti window): rest share fluctuates 0–18%, never accumulates; ρ_C wanders ~10. No core.
- Cutoff @ t=300: node empties fully (resident→56). Nothing bound.

**Why it must fail:** the rest channel participates symmetrically in collisions — ICOND boosts rest *outputs*, but rest quanta are re-picked as *inputs* at the same rate. The weight shifts the equilibrium distribution; it cannot ratchet. This is M20a ergodicity one level up: every reversible or symmetrically-weighted rule thermalizes, so **an irreversible one-way move (2→Q) is not an implementation hack, it's a logical requirement for accretion**. The honest architectural question is where the arrow lives — Q-register, capacity ceiling, or absorb/remit cycle — not whether to have one.
