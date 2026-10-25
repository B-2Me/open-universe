---
title: The Multi-Channel Bridge
---

# The Multi-Channel Bridge: meso3i Findings

> **Context note.** This page consolidates milestones M19–M38, the bridge from the single-spin prototype to the multichannel engine. The canonical record continues in the [Friction Substrate monograph](/interference/meso-monograph) (M39–M48), which revises several readings below: M37's "weak mutual attraction" is now understood as transient mutual ablation between self-radiating lumps only (M47b), and M38's "rocks, not atoms" boundary was crossed by directional rest (M39/M42).

*The canonical simulation substrate going forward is `src/meso3i.c`*. A multichannel integer-occupancy lattice gas on the True-FCC lattice. Unlike a single-spin prototype, every node carries an array of independent directional channels: simultaneous inflow on some ports and outflow on others is native mechanics, not a special case. This page consolidates the measured findings on that substrate as the seed for the accretion/outflow campaign.*

## The Substrate

`meso3i.c` runs on the even-parity True-FCC sublattice: D3Q13 channels (12 face-diagonal + rest) or D3Q19 (+ 6 axial second-shell) with `uint8_t` integer populations per channel. Collision is a finite, enumerable move family over channel occupancy. Mass and momentum conserved exactly by construction, then streaming along the True-FCC adjacency. The Q-register extensions (`IQMODE`) add a scalar core register *outside* the collision family: antipodal pairs may condense `2→Q`, and emission returns mass to channels on a τ=4 clock.

## Measured Findings

| # | Finding | Harness | Commit |
|---|---------|---------|--------|
| M19 | Boolean gas on True-FCC conserves mass+momentum exactly; counter-flow passes; 4th-rank isotropy repaired by analytic 1/8 D3Q19 axial-shell weighting | `test_meso3.c` | `bc3e192` |
| M19-T7 | The 1986 Boolean Galilean defect measured directly: g(ρ) sign-reversal quantified on both shells | `test_meso3.c` | `c60b7e7` |
| M19-T8 | Integer occupancy eliminates the sign reversal; g plateau flat in u | `meso3i.c` | `2df1957`, `38999ad` |
| M19-T9 | Edge-dwell delay lines produce fractional duty-cycle velocity v = 1/k | `test_meso3.c` | `0761395` |
| M20a | Pair-group move graph is exactly one component per (mass, momentum) class: no hidden protected sectors; mass and momentum are the only invariants | `test_m20a.c` | `822d7d2` |
| M20b-A | Bound-structure probes: coherence exists only in the collision-free sector; collidable internal DOF thermalize | `test_meso3.c` T10 | `ee2909c` |
| M20b-B | Rest-trapping and planar-circulation subfamilies *do* create protected sectors; angular restriction alone does not | `test_m20a.c` | `8ae2bb1` |
| M20b-T11 | ρ-gated planar core produces genuine lamination: a pancake phase, not a confined particle | `meso3i.c` IGATE | `391541b` |
| M21 | Deflection sweep: no collision-level rule produces position-space confinement. The barrier is structural, not parametric | `test_m20b.c` T12 | `f6353a0` |
| M22 | Q-register core binds a stable localized lump: condensation `2→Q` is the ratchet the rest channel lacked | `meso3i.c` IQMODE | `29515b3` |
| M23 | External collision-weight field cannot reach Q-bound mass: bound mass is dynamically self-shielding (bitwise-identical runs) | `test_m20b.c` T15/T16 | `3dede2c` |
| M23b | Pyrochlore ice-rule defects ARE field-coupled: ±charge separation under bias, drift v∝F. Bond-native matter couples where parked mass cannot | offline probe | `b5bfd2a` |
| M24-T17 | Phase-gated emit/capture conveyor: first bound-mass transport (v≈0.064), envelope decoheres into ring current | `meso3i.c` qmode 6 | `29e9a71` |
| M24-T18 | Thresholded emission coheres (R≈0.91) but freezes; proportional variants equilibrate to a density slab | `meso3i.c` | `02aea0b`, `9d8297b` |
| M24-T19 | Q-weighted capture fails, **Pick-Two Triangle**: binding, transport, coherence each achievable, never all three | `meso3i.c` | `6693abd` |
| M24-T20 | Peristaltic cycle: 98% mass recondensation (discrete de Broglie pulsation), zero locomotion | `meso3i.c` qmode 8 | `f33630f` |

## The Accretion/Outflow Experiment (M32)

`src/test_accrete.c`: 18-channel convergent "spoke" drive onto a central node, open drained box, injection `rate=4/ray/tick`.

| Regime | Result |
|--------|--------|
| **Native collision** | Pure throughput: ρ_C≈20 steady, ~94% of injected flux drains. A convergent node is a transparent scattering point, no accretion, no core. |
| **+ Q condense (qmode 1)** | Unbounded accretion: Q_C climbs linearly (≈+0.55/t, ~30% of throughput), ΣQ spreads across the box. A sink, not a structure. |
| **+ condense + emit (qmode 2)** | **Dynamic equilibrium: Q_C plateaus at ~30 under sustained inflow≈30, outflow≈20**. Accretion and venting balance. The bound core is sustained only while driven. |
| **Drive cutoff @ t=200** | condense+emit: Q_C decays to 0 in ~100 ticks, total mass→4. **full dissolution**; the core existed only inside the throughput gradient. condense-only: Q_C=116 frozen forever. Bound deposit, not driven. |

**The accretion law:** accretion and outflow are separable channels. Native collisions give outflow-only; a condensation ratchet gives accretion-only; the structure that both accretes *and* vents requires both channels open, and lives strictly inside the gradient (dissipative, Prigogine-class), while accretion-without-venting produces frozen bound deposits.

### M32b. Asymmetric drive and core scaling

- **Jet test (equatorial spokes only, dz=0 channels):** no collimated polar outflow. Z-moving channels at C read zero outflow share; drained mass splits ~42% z-faces / 58% side-faces, consistent with isotropic diffusion downstream, not bipolar jets. Equatorial accretion does not select a vent axis.
- **Core-size scaling (isotropic condense+emit):** rate=1–2 → sub-threshold, no sustained core; rate=4 → Q_C≈30 plateau; rate=8 → Q_C≈180 still climbing at t=300; rate=16 → saturates at the u8 cap (255). **The driven core's size follows the feed rate, bounded by register saturation: there is an onset threshold (between rate 2 and 4) and a hard ceiling, not a linear law.**

*Q-register (M22–M24, M32) results are engineered rule-family experiments: measured on the multichannel substrate but not its native collision mechanics.*

### M32c. Channel-native ratchet test (ICOND alone)

Can pure channel dynamics condense without the Q register? The rest channel is a native v=0 state, and `ICOND` density-weights collision *outputs* toward it, the mildest possible arrow: no new state, just a weighted output preference. (Plumbing note: ICOND weighting lived inside the weighted branch gated by `IBIAS||IFLD`, so a one-line engine change now lets `ICOND` alone activate that branch, flag-gated, inert when 0.)

**Result: negative, and instructive** (`qmode=0, icond=16`):

- At rate=4 (ρ_C≈20): identical to native. The `atti` tent cuts to zero above ρ=8, so **the ratchet disarms exactly where density is highest**. Self-limiting by construction.
- At rate=1 (ρ_C≈8–14, inside the atti window): rest share fluctuates 0–18%, never accumulates; ρ_C wanders ~10. No core.
- Cutoff @ t=300: node empties fully (resident→56). Nothing bound.

**Why it must fail:** the rest channel participates symmetrically in collisions. ICOND boosts rest *outputs*, but rest quanta are re-picked as *inputs* at the same rate. The weight shifts the equilibrium distribution; it cannot ratchet. This is M20a ergodicity one level up: every reversible or symmetrically-weighted rule thermalizes, so **an irreversible one-way move (2→Q) is not an implementation hack, it's a logical requirement for accretion**. The honest architectural question is where the arrow lives, Q-register, capacity ceiling, or absorb/remit cycle, not whether to have one.

### M32d. Capacity arrows (IREFL congestion refusal, u8 saturation)

Gemini's candidate #2: can the hard capacity ceiling supply the irreversible arrow, with no Q register? Two capacity mechanisms tested:

- **IREFL (congestion refusal):** nodes at ρ≥cap refuse inflow, quanta reverse antipodally at source (`meso3i_reflect`, flag-gated). At `refl=30/60` (above operating density): never fires, identical to native. At `refl=12` (below ρ_C≈20): fires constantly. And produces a **mirror**, not a trap: inflow ≈30/t arrives, ρ_C collapses to ~0, outflow →0 as mass bounces back up the spokes. Cutoff: full drain (resident→10). Refusal excludes rather than binds.
- **u8 saturation (255 clamp):** unreachable in this regime. Channel populations at C carry ~1–5 quanta each; saturation needs ~100× drive. And even where it fires (Q-emission writes), the clamp **destroys** overflow mass, a leak, not a condenser.

**The arrow taxonomy, fully measured:** reversible move → equilibrium (native, ICOND); reflective boundary → exclusion (IREFL); destructive clamp → mass leak (u8). None accretes. The only measured accretion arrow remains the one-way `2→Q` move: the Q register stands as the minimal explicit implementation of what thermodynamics requires, not an arbitrary hack.

### M33. Transit friction ("space is friction"), channel-native condensation

The ontological correction: friction lives in *transit*, not in collision outputs. `meso3i_friction(cap)`: a quantum hopping into a node at ρ≥cap sheds momentum with p=½, landing in the destination's rest channel. Momentum absorbed by the network, mass conserved as parked heat. `meso3i_fricmode(k)`: rest mass becomes **inert** (excluded from collision inputs) and radiates back at ~1/(4k) per quantum per tick.

Two pieces were needed: drag alone (inert off) parked 50–93% of ρ_C in rest but still equilibrated and drained on cutoff (rest mass recollides, the same two-way door). With rest inert + boil-off:

| fric=8 | Driven | Cutoff @ t=200 |
|--------|--------|----------------|
| boil 1/16 (fricm=4) | ρ_C~100, 97% rest, in≈10/out≈3, net accretion, resident ~4.8k | ~~frozen lump~~ → corrected: **full boil-off, resident→0** (see below) |
| boil 1/4 (fricm=1) | ρ_C~30–58, 68–90% rest, in≈11–22/out≈4–13, **simultaneous accretion and venting** | Full dissolution, driven structure only |

**Correction (verified):** the first run's "bound remnant" was a code-path artifact. The boil-off loop sat behind `collide_node`'s `m < 2` early return, so pure-heat nodes could never radiate. With radiation moved ahead of the gate, the lump **fully boils away** after cutoff (resident →0, injected = drained). Self-trapping via re-parking does *not* hold: emitted quanta escape because surface nodes cool below the friction cap, and the cooling front propagates inward.

**What M33 actually establishes:** transit friction gives a **channel-native dissipative core**, accretion and venting simultaneously, no register, no pair-condensation move, but it is drive-maintained like the Q core, not self-bound. The honest statement of the ontology as measured: *space-is-friction* produces the Prigogine structure natively (drag → parked heat → radiation), but permanence still requires either a true one-way sink or sustained throughput.

### M34. Remnant decay law: exponential cooling, no metastable floor

Swept boil rate (k = 1,4,16 → 1/4k per quantum/tick) and lump size (drive rate 4/8/16 → remnant masses ~5.5k/18k/44k at cutoff). `fric=8` throughout.

| Drive | Boil | Lump @ cutoff | Cooling tail |
|-------|------|---------------|--------------|
| rate=4 | 1/4 | ~5.5k | gone by t≈300 (~100 ticks post-cut) |
| rate=4 | 1/16 | ~6.9k | gone by t≈350 |
| rate=4 | 1/64 | ~9.4k | tail to t≈650 |
| rate=8 | 1/64 | ~18k | ρ_C 49→0 over ~450 ticks |
| rate=16 | 1/64 | ~44k | ρ_C 228→0 over ~525 ticks |

**The law:** ρ_C decay is smooth geometric (rate-16 tail: 228→207→167→143→110→87→61→…→0, the per-25-tick ratio tightens from ~0.9 early to ~0.7 late). **pure exponential cooling**, no plateau, no stall, no critical-size floor. Cooling rate scales with boil constant; lifetime grows only **logarithmically** with lump mass (4× mass buys ~75 ticks). The self-shielding hypothesis fails: interior radiation escapes because the cooling front, surface drops below the friction cap first, propagates inward steadily rather than stalling.

**Metastability verdict:** absent. The friction core is a candle, not a rock: its lifetime is proportional to how slowly it radiates, never self-sustaining. A metastable bound regime would need a mechanism that *suppresses* radiation below a threshold (e.g., density-gated emission, or emission cost): an energy barrier the current rule set doesn't contain.

### M35. Carrier-gated radiation: persistent, re-wakeable matter

The missing barrier, implemented honestly: heat transfer needs a *carrier*. `fricmode = -k` gates boil-off on the presence of moving mass at the node: radiation fires only while flux transits (emission cost = a passing quantum). In true vacuum, parked heat is quiescent by physics, not by bug.

Three-phase protocol (drive t<200 → quiet 200–600 → re-illuminate 600–900):

| Phase | Behavior |
|-------|----------|
| Driven | Breathing core: ρ_C~106 (95%+ rest), sustained out ~2–22 |
| Quiet (400 ticks) | Partial radiative decay while in-flight carriers remain, then **frozen at ρ_C=79, resident ~6k**: inert in vacuum |
| Re-illuminated | **The remnant wakes**: ρ_C 79→118 in 25 ticks, accretes and re-vents (out 6–21). Persistent object with state, not dead mass |

This is the metastable regime M34 showed was missing: bound mass that *persists* without drive, *decays* under flux, and *responds* to re-feeding, the cold-rock phenomenology (stable in vacuum, ablatable near a flux source), achieved with two flag-gated rules on native channels and zero registers.

**Observational anchor. The Yarkovsky effect.** Real bound matter exchanging momentum with the vacuum through asymmetric thermal venting is measured physics: a rotating asteroid parks absorbed sunlight as surface heat (trapped because vacuum conducts nothing), then radiates it anisotropically. Afternoon-side infrared photons carry vector momentum p=E/c, producing measurable orbital drift (radar-confirmed on 6489 Golevka; OSIRIS-REx on Bennu). This is the macroscopic proof-of-class for the M35 mechanism: *resting mass + directional radiative outflow = momentum exchange*, no Hilbert space required.

### M36. Asymmetric illumination: the lump migrates (ablation drift, not recoil)

Protocol: drive 0–200 (build remnant), quiet 200–600 (frozen, restCM fixed at (22.0, 22.1, 22.0) to ±0.01 for 400 ticks), then **one-sided carrier re-illumination** (only spokes traveling +x, or only −x) 600–1200, tracking the parked-mass centroid.

| Illumination | restCM x-drift over 600 ticks | Remnant mass |
|---|---|---|
| carriers +x (beam hits −x face) | 22.00 → **21.67** (−0.33) | 1991 → ~1220 (−38%) |
| carriers −x (beam hits +x face) | 22.00 → **22.45** (+0.45) | 1991 → ~1220 (−39%) |

**Measured:** asymmetric illumination produces persistent directional locomotion. The lump creeps **toward the beam source** at ~0.0005 cells/tick while shedding ~40% of its mass. Mechanism is ablation-front retreat, not photon-recoil: carriers entering the lit face transit the lump and unlock emission throughout, but mass leaves preferentially downstream. The far side erodes faster, shifting the centroid against the illumination gradient. (Our boil-off emits to a *random* moving channel, so true Yarkovsky recoil, direction-correlated emission, remains untested; a directed-emit variant is the queued refinement.)

**Hemisphere-resolved confirmation:** splitting parked mass at the centroid plane shows the lit hemisphere (beam-entry side) holds steady at ~480 (erosion exactly offset by drag-parked carriers) while the downstream hemisphere loses 43% (474→269). The "leading edge absorbs, trailing edge erodes" picture is direct evidence, not inference.

This is genuine environment-driven motion of persistent bound matter: the remnant doesn't just sit or dissolve. It *migrates* under anisotropic flux, slowly, while being eaten. A comet, not a rocket.

### M37. Two-body probe: weak mutual attraction via ablation, no merger

`test_two.c` seeds two rest-channel lumps (mpn=60, r²≤8 blobs, ~3k quanta each) at separation d, unconditional slow boil (1/256) so each lump's radiation acts as the other's carrier beam. Drained open box, 1500 ticks.

| Initial sep | Δsep over ~1400t | Verdict |
|---|---|---|
| 4 | 4.75 → 4.16 (monotonic −0.6) | **steady mutual approach** |
| 8 | ~7.9 (within noise) | flat |
| 16 | ~15.5 (noisy end-stage) | flat/weak |

**Mechanism:** each lump radiates isotropically; its quanta strike the other's near face → carrier-gated ablation erodes the far side (M36 comet mechanism) → **each centroid creeps toward its neighbor**. Mutual ablation IS mutual attraction: the closest thing to a gravitational analog yet measured on this substrate, with a reach set by geometric dilution (intercepted flux ∝ solid angle, ∝ d⁻² in the far field, though at these separations the near-face/diffuse-halo geometry dominates).

**The honest limit:** drift ~0.0004 cells/tick vs. evaporative lifetime ~2500 ticks: the lumps die ~1 cell short of contact. No merger observed; no repulsion; no orbit. Two-body "gravity" exists here but is weak and mortal: a qualitative force-analog, not yet chemistry.

### M37b. Merger at contact: trivially stable, structurally inert

Seeding two lumps at sep≤2 (overlapping halos) produces a single connected blob that decays exactly like a lone lump, smooth, symmetric, no fragmentation, but also no coalescence signature: no density spike, no reconfiguration, no ejecta. **Rest-channel mass is passive**: adjacent parked heat is just adjacent parked heat. Lumps have no internal structure to fail or succeed at cohering, no surface tension, no binding energy to release.

**Interpretation:** the "matter" here is a heat deposit, not a droplet. Coalescence is degenerate (two touching deposits ARE one deposit), which means the interaction vocabulary is currently limited to *ablative* coupling: lumps affect each other only through the flux they exchange, never through contact. A real merger physics (cohesion, surface tension, binding-energy release) would need structure inside the lump that contact can rearrange: the rest channel is too simple a state to carry it.

### M38. Structured lump test: circulation dies in ~25 ticks

`test_spin.c` seeds a rest blob then injects tangentially-aligned moving quanta on a shell inside it: a lump that *spins*. Tracked lump rest mass, trapped moving mass, and net z-angular momentum Lz.

| Config | Lz at t=0 → t=25 | Verdict |
|---|---|---|
| inert rest + carrier-gated boil (fricm=−4) | 320 → 6 | circulation thermalizes instantly; lump persists as scalar heat |
| colliding rest (fricm=0) | 320 → 9, rest→8 | lump evaporates entirely, worse |

**The boundary of this rule set, measured:** friction thermalizes every directed pattern. There is *no* persistent internal structure a lump can carry. No spin, no polarity, no chirality, no valence. **Friction gives rocks, not atoms**: the substrate supports the full "heat deposit" phenomenology (accrete, vent, persist, migrate, weakly attract) but the structured-matter rung (and therefore chemistry) is absent *in principle* under these rules, not just untested. Reaching it would need a mechanism that preserves pattern inside parked mass: e.g., channel-structured bound states rather than a single scalar rest bin.
