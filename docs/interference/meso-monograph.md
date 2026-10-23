---
title: The Friction Substrate
---

# The Friction Substrate: A Multichannel Research Monograph

*Consolidated findings from the `meso3i` campaign (M19–M45): a True-FCC integer-occupancy lattice gas on which transit friction produces accreting, venting, persistent, mobile, weakly self-gravitating bound matter — and, since the loom-meso extension, matter that stores angular momentum. Every claim below is anchored to a commit and a headless harness; every engineered rule is flagged as such.*

---

## Part I — The Substrate

### Axioms

`src/meso3i.c` implements an integer-occupancy lattice gas on the even-parity True-FCC sublattice:

- **Geometry:** D3Q19 channels per node — 12 face-diagonal nearest-neighbor directions + 6 axial second-shell directions + 1 rest channel. Populations are `uint8_t` integers (0–255).
- **Update:** memoryless `t → t+1`. Each tick: (1) collide — local pair reshuffles from a finite enumerable move family, mass and momentum conserved exactly; (2) stream — every moving quantum hops along its channel vector; the rest channel stays.
- **State:** anonymous directional counts only. No particle IDs, no history, no global fields, no hidden registers in the base mechanics.
- **Engineered layer:** every departure from the base mechanics is an explicit flag-gated rule, enumerated in §III — nothing operates silently.

### What the base mechanics prove

- **Conservation:** mass and momentum are the only invariants (M19 battery; the integer occupancy also repaired the 1986 Boolean-FHP Galilean sign-reversal defect — M19-T8).
- **Ergodicity:** the pair-group move graph is one connected component per (mass, momentum) class — no hidden protected sectors (M20a).
- **Transparency:** under an 18-spoke convergent drive, a native node is a pure throughput scattering point — ρ_C≈20, ~94% of injected flux drains, nothing binds (M32).

### The arrow theorem (measured, not assumed)

Accretion requires an irreversible arrow. Four candidate arrows were tested head-to-head (M32–M32d):

| Rule type | Physical analog | Verdict |
|---|---|---|
| Reversible pair-shuffle | elastic collision | equilibrium — no core |
| Density-weighted output (ICOND) | biased partition | equilibrium shift — rest is a *two-way door* |
| Reflective boundary (IREFL) | hard wall | exclusion — a mirror |
| Destructive clamp (u8 cap) | mass leak | deletion — unreachable and lossy anyway |
| **One-way move (2→Q)** | radiative capture | **accretion** |

A reversible or symmetrically-weighted rule thermalizes; it cannot bind. This is the discrete-lattice version of a real theorem: capture without an exhaust channel (a radiated photon, a third body) is impossible.

---

## Part II — The Q-Register Bridge (Engineered Baseline)

Before the native mechanism existed, the Q-register extension (`IQMODE`) demonstrated the *target phenomenology*:

- Condense alone (`2→Q`, no emit): unbounded sink — a dead deposit, not a structure (M32).
- Condense + emit: **breathing core** — Q_C plateaus at ~30 under sustained inflow≈30/outflow≈20, igniting somewhere between rate 2 and rate 4, saturating at the u8 cap (255), and **fully dissolving ~100 ticks after drive cutoff** (M32, M32b).
- Asymmetric drive: no jet collimation — outflow isotropic (M32b).
- Earlier Q experiments: bound lumps (M22), self-shielding from field weights (M23), phase-gated conveyor v≈0.064 (M24), Pick-Two triangle — binding/transport/coherence, never all three (M24-T19), peristaltic recondensation (M24-T20).

**Role in the campaign:** the Q register proved what to build, then got replaced by the channel-native mechanism that builds it.

---

## Part III — The Friction Laws (M33–M35)

The ontological correction that unlocked everything: **friction lives in transit, not in collision outputs.** Two flag-gated rules on native channels:

- **`IFRIC` (transit drag):** a quantum hopping into a node at ρ≥cap sheds momentum with p=½, landing in the destination's rest channel. Momentum absorbed by the network; mass conserved as parked heat. *Space is friction.*
- **`IFRICM` (rest inertia + radiation):** parked rest mass is inert — excluded from collision inputs (heat doesn't do elastic collisions). `+k`: unconditional boil-off ~1/4k per quantum per tick. `−k`: **carrier-gated** — emission only while moving mass transits the node (heat needs a carrier).

Drag alone fails (rest mass recollides — the two-way door). Inert rest alone freezes dead. Together:

| Regime | Measured |
|---|---|
| Driven, boil 1/4 | ρ_C~30–58, 68–90% rest; **in≈11–22 / out≈4–13 sustained** — a channel-native breathing core |
| Driven, boil 1/16 | ρ_C~100, 97% rest — heavier core |
| Cutoff, unconditional boil | exponential decay to zero — candle not rock (M34) |
| Cutoff, carrier-gated | **persistent remnant** — decays while in-flight carriers remain, then frozen ρ_C~79 for the full 400-tick quiet window (M35) |
| **Re-illumination** | remnant **wakes**: ρ 79→118 in 25 ticks, re-accretes and re-vents — persistent interactive matter (M35) |

### The decay law (M34)

Remnant cooling is pure exponential (ρ_C ratio ≈0.75–0.8 per 25 ticks) at every size tested (5.5k–44k quanta); lifetime grows only logarithmically with mass. No self-shielding plateau — the cooling front propagates inward without stalling. Metastability requires an emission barrier, which carrier-gating then supplied.

---

## Part IV — Locomotion and Interaction (M36–M37)

### Ablation drift (M36)

A frozen remnant illuminated by a one-sided carrier beam **migrates toward the beam source** at ~0.0005 cells/tick while shedding ~40% of its mass — mirror-confirmed in both directions (−0.33 / +0.45 cells over 600 ticks).

**Mechanism, hemisphere-resolved:** the lit face holds steady (erosion offset by drag-parked carriers) while the downstream hemisphere loses 43% — *leading edge absorbs, trailing edge erodes*: comet ablation, not recoil thrust. True Yarkovsky recoil requires direction-correlated emission (untested variant, queued).

### Two-body interaction (M37, M37b)

Two seeded lumps under mutual radiation exchange:

- **sep=4:** monotonic approach, 4.75 → 4.16 over 1400 ticks — mutual ablation acts as an **attractive force-analog** (each lump's radiation erodes the other's far side).
- **sep=8/16:** flat — reach is short, consistent with flux dilution.
- **Verdict:** weak, mortal "gravity" — drift ~0.0004 cells/tick vs. ~2500-tick lifetime; lumps die ~1 cell short of contact. No merger, no orbit.
- **Contact (M37b):** overlapping lumps are trivially stable — parked heat has no internal structure to cohere or resist. Coalescence is degenerate, not physical.

---

## Part V — The Measured Boundary (M38)

Tangential moving quanta injected inside a lump — a circulation pattern — thermalize in ~25 ticks (Lz 320→6, moving mass→0). **No persistent internal structure exists under these rules:** no spin, no polarity, no chirality, no valence.

This is a boundary in principle, not in coverage: the rest channel is a scalar bin — everything parked there forgets how it arrived. Friction gives **rocks, not atoms**. The structured-matter tier (and with it, any chemistry) would require bound mass that retains channel/directional identity — a different state representation, not another flag.

**Scale honesty:** the arena is 85,184 cells (44³, of which 42,592 even-parity sites are live). A hydrogen atom is ~10⁶⁰ Planck cells. Rocks and weather — not the periodic table — is the correct expectation at this scale, and that is exactly what was measured.

---

## Part VI — The Observational Bridge

The mechanism class — *resting mass exchanging momentum with vacuum through directed radiative venting* — is measured astronomy: the **Yarkovsky effect** (radar on 6489 Golevka, OSIRIS-REx on Bennu). Vacuum insulates; parked heat radiates anisotropically; photons carry p=E/c. On this substrate: transit drag parks heat, carrier-gated emission vents it, one-sided flux migrates the lump. Same physics family, different scale.

---

## Part VII — The Honesty Ledger

- **The M33 correction:** the first "self-bound remnant" was a code-path artifact — radiation was gated behind an `m<2` early return, so pure-heat nodes could never emit. Detected, fixed, re-measured: the lump boils away under unconditional radiation. Persistence is real only under carrier-gating, and it is quiescence, not self-trapping.
- **Native vs. engineered:** every IFRIC/IFRICM result is channel-*native* (no extra state) but flag-*gated* (authored mechanics, not emergent collisions). The substrate gained a **transit-friction law**; friction did not "emerge" — it was coded, measured, and audited.
- **Momentum accounting:** IFRIC absorbs transiting momentum into the network (flagged). Mass is exact; momentum is not — that is what friction means.
- **Retracted:** single-spin `planck3` campaign mechanics (M1–M31) — removed from the record as an implementation artifact; history retained in git.
- **Dormant:** Q-register path (IQMODE/IDIR/IQCAP), ICOND, IREFL, IGATE, IBIAS/IFLD, DWELL, directed-emit recoil variant.
- **Branch ledger (`loom-meso`):** IPHOT/IPHOT=3 absorption, IPAIR, ILAT and IDREST are flag-gated authored mechanics in the same honesty class as IFRIC. Under IDREST, `totals()` counts stored directional momentum — a friction park is momentum-neutral (stored, not absorbed). Under IPHOT=3, photon momentum joins the ledger so absorption closes exactly.

## Part VIII — The Structured-Matter Tier (M39–M45, `loom-meso`)

*M38's boundary was drawn for scalar rest. This part measures what happens when the rest state is given the one thing it lacked: a channel identity. All results on the 72×72×36 loom grid, harnesses in `logs/*.mjs`.*

### M39 — The photon field (massless directional plane)

A parallel `u8` population per (site, moving channel): photons carry direction but no mass, never collide, stream at channel speed, drain at the boundary. Coupling modes: `IPHOT 0` uncoupled, `1` catalyst (licenses the carrier-gated emission gate without adding mass), `2` stimulated (each arriving photon may eject a rest quantum into *its own channel*), `3` absorbed (the ejecting photon is consumed — momentum transfers into the mass ledger).

- Ring fossil (727 rest), 150t of a 1-cell +x pencil beam: off → untouched; catalyst → 626; stimulated → 623, with ~528 photons in flight.
- Thick lump (23.9k) under a plane wave: catalyst −71.5% (isotropic boil, smears); stimulated −67.8% (confined to the beam row — drills a tunnel). No measurable centroid recoil at this scale.

### M40 — Antipodal pair rules (IPAIR)

Momentum-honest wind/unwind: `2·rest ⇄ c + c¹`. Rest radiates back-to-back pairs (zero net momentum); populated antipodal pairs may bind into rest with no congestion requirement.

**Measured caveat — the entanglement theorem:** a colliding antipodal pair *is itself* a carrier, so a binding site opens its own emission gate. Standing head-on collision (300t): rest 75 without pairs, 31 with — capture adds a trickle while the gate it opened drains faster. Under drive, pair emission doubles the ablation rate (two quanta per event). Wind and unwind cannot be separated at a node because both read the same bit: `m>0`.

### M41 — Sustained-transit latency (ILAT)

`iLT`: per-site consecutive-transit counter; the emission gate opens only after `n` straight ticks of `m>0`. One byte of *time* memory, not structure.

- Sparse pulse (1t/20t) vs a 23.9k lump: Lat 1 → 7.7k; Lat 8 → **24,048** (frozen, slightly grows — parking without venting); Lat 24 → 24,064.
- Sustained drive: Lat 1 → 6.9k; Lat 8 → 23.6k; Lat 24 → 22.1k.
- Pair-collision site with IPAIR: rest 66 at Lat 1 → **130 at Lat 8** — the first configuration where binding beat decay.
- Interpretation: parked mass is metastable with an *activation barrier* — sporadic flux scatters, sustained bombardment unwinds. Lumps self-shield: the congested skin parks transients so the interior never sustains transit.

### M42 — Directional rest, `rest[18]` (IDREST) — "frozen flux"

One rest bin per channel: a friction-parked quantum lands in `rest[c]` and re-emits onto channel `c`. Momentum is stored on park and handed back on emit. Scalar rest remains the canonical default.

- **Storage:** canonical vortex seed → scalar: Lz 9,984→0 by t=40 (M38 reconfirmed). Directional: `Lz_park = 4,932` persists to t=200+ — ~half the injected angular momentum frozen into channel-bin imbalance (the rest was lost to pre-park scrambling and drain, not the parking).
- **Revival:** drive carriers through the wound fossil → `Lz_mov` reappears at 2,317 **with the original sign** — a latent vortex that re-inflates on demand and unwinds honestly under sustained probing (~120t bleed to drain).
- **Shielding (M41 × M42):** at Lat 16, a sparse probe leaves `Lz_park` exactly untouched; a sustained drive erodes it ~4% while the lump *accretes* the drive into wound mass (parked 588→4,560). Metastable flywheel regime.
- **Q-register control (M42b):** `IQMODE` condensation tested against the same benchmark — Q is a scalar bin and its antipodal-only capture can't even admit a coherent vortex: `Lz→0` by t≈40 in all modes, Q-total stays 0 under canonical friction (mechanics confirmed live under sustained head-on flux). The scalar trap is *generic*.

### M43 — Writing spin: collisions and light

- **Collision-writ (L→S):** a collimated +x mass beam grazing an R5 lump at impact parameter ±3 writes `Lz_park = −17,671` / `+13,931` (sign correct both flanks; dead-center control ≈0). Orbital momentum converts to stored spin — measured.
- **Light-writ (absorbed mode, the YORP analog):** a grazing photon beam writes the same sign structure at ~5% magnitude (−521 / +436 at t50): each absorbed photon deposits one quantum's worth of momentum. Ledger audit: mass exactly conserved, ~3,800 px transferred light→matter over 40t, transverse components ≈0.

### M44 — The no-go: no live circulation

A closed channel loop (12-node hexagonal polygon — every hop lands on the next loop site, so emitted quanta are auto-aimed forward) was swept over emission rate, friction, latency, and IDREST. **Every regime collapses `Lz_mov` to zero by t≈40.** The bucket brigade is subcritical *by construction*: emission needs `m>0` (a carrier present), but every hop either parks the carrier or passes it through without production — once flux hits zero nothing re-ignites. The substrate has matter that *remembers* rotation but cannot *be* rotation: a stationary ground state, not a perpetual whirlpool.

### M45 — Spin-contact dynamics

Two adjacent wound lumps (±4-cell gap, drive-coupled interface), 300t:

| configuration | outcome |
|---|---|
| antiparallel (+Lz/−Lz) | spins survive with signs intact — the gap insulates; cancellation needs co-location |
| parallel (+Lz/+Lz) | symmetric coexistence, no composite enhancement |
| +Lz vs cold | **induction**: the cold lump spins up 0→+2,734 through contact transit |
| counter-rotating halves in ONE body | **shear annihilation**: ±30k stored spin → ~0 in ~60t (co-located antipodal bins vent into each other; the spin, not an extra mechanism, is what dies) |

*Ledger note:* the ~70% mass boil-off in all four runs is generic drive-ablation, not annihilation-specific; the distinctive weld datum is spin collapse, not mass loss.

**Standing conclusion:** the substrate now produces matter that **stores angular momentum, acquires it from collisions and from light, shields it behind a latency barrier, transfers it by contact, and annihilates it under internal counter-rotation** — while provably refusing perpetual circulation. "Atoms, not whirlpools" is the measured ontology.

## Milestone Index

*Numbering note: the meso campaign continued the sequential ledger, so the M-numbers below overlap the retracted single-spin M1–M31 range. Every index entry here refers exclusively to `meso3i` experiments; same-numbered `planck3` results are the ones marked retracted in the ledger.*

| M | Finding | Commit |
|---|---------|--------|
| M19–M21 | Integer lattice gas: conservation, ergodicity, dwell v=1/k, no confinement | `bc3e192`–`f6353a0` |
| M22–M24 | Q-register bound matter, conveyor, Pick-Two, peristalsis | `29515b3`–`f33630f` |
| M32 | Accretion probe: native transparent; Q condense+emit = breathing core | `535970f` |
| M32b | No jets; core size scales with drive to u8 cap | `554c32d` |
| M32c–d | Arrow taxonomy: equilibrium/mirror/leak — accretion needs one-way | `8dbdbb6`, `fa0ee87` |
| M33 | Transit friction → channel-native breathing core | `08193b2`, corrected `cececd9` |
| M34 | Remnant decay = pure exponential, no metastable floor | `2f28e7b` |
| M35 | Carrier-gated radiation → persistent re-wakeable matter | `6c23a03` |
| M36 | Ablation drift — lump migrates toward beam, hemisphere-imaged | `cb41b20`, `f95706a` |
| M37 | Mutual attraction via reciprocal ablation; contact degenerate | `5a7f8b2`, `4540cc1` |
| M38 | No internal structure — rocks not atoms | `94cbebb` |
| M39 | Massless photon plane; catalyst/stimulated/absorbed coupling | `b3fa609`, `1b1f88c` |
| M40 | Pair wind/unwind — binders are carriers; entangled gate | `10d521e` |
| M41 | Transit-latency gate → activation barrier, self-shielding | `bf737da` |
| M42 | Directional rest `rest[18]` stores Lz; sign-true revival | `a622a8b` |
| M43 | Grazing collisions and absorbed light write spin (YORP) | `1b1f88c` |
| M44 | No live circulation — bucket brigade subcritical, all regimes | `a622a8b` |
| M45 | Spin induction by contact; internal counter-rotation annihilates | `1b1f88c` |

## The Picture That Emerges

A discrete substrate on which **space is friction** produces, in order:

1. **Drag** turns flux into parked heat (accretion).
2. **Inertia** keeps parked heat out of collisions (a mass state).
3. **Emission cost** makes radiation require a carrier (metastability + environmental coupling).
4. The result: bound matter that **breathes while fed, sleeps in vacuum, wakes under light, migrates under anisotropic flux, and weakly attracts its neighbors through mutual radiation.**

All of it lives on 19 integer channels per node, one rest bin, and two rules. All of it survives honest audit. The structured-matter rung turned out to be a state-representation question — answered on `loom-meso` by giving rest mass a channel identity (Part VIII): the result is matter that stores spin, acquires it from collisions and light, and provably cannot circulate it forever.

---

## Replay: The Life of a Lump

A recorded run — real telemetry, not an animation mock: `test_replay` ran the canonical sequence (drive → cutoff → quiet → one-sided beam) and dumped every frame. Watch the convergent spokes feed a breathing amber core, the core freeze dead when the drive cuts at t=200, sit inert for 400 ticks of vacuum quiet, then creep toward the +x carrier beam at t=600 while its far side evaporates.

<FrictionReplay />

Or run it yourself — the same engine, live in your browser: **[Yarkovsky's Ember](/ember-demo)** compiles `meso3i` to WebAssembly and lets you toggle the drive, drop cold rocks, and push them around with the carrier beam.
