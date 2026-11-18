---
title: Moore26 Findings
audio: /audio/moore26-findings.mp3
---

<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Moore26 Findings

*Numerical constants distilled from this page live in the
[Constants Catalog](/moore26-constants) — when a measurement below
produces a new number, mirror it there.*

This is the measured record of the current engine — `moore26`, a
Moore/FCC lattice substrate at `0.1 fm` per node where every node
carries `26` registers (one per channel — the name is the register
count, not the lattice size). Everything
on this page is output of headless harnesses against
`src/moore26.c`, not assumptions: what the lattice actually does
when the rules run, measured, including the results we had to
retract. The engine's structure is 12 transporting edge channels
on the even-parity sublattice plus face/corner registers that hold
bound structure; transactions negotiate through an
offer→incipient→confirm handshake each tick.

![The Moore-26 stencil — the 26 neighbors around a node, exploded by z-layer. The 12 edge cells are the FCC transport channels (amber); the 6 face and 8 corner cells hold structure only.](/img/moore26-stencil.svg)

## Notation

The shorthand used throughout — defined once here:

**Registers** (per-node state; `c` indexes the 26 channels,
edge pairs are `2e`/`2e+1`):

- `winding[c]` — committed circulation count; `min(pair) ≥ 32`
  is bound structure
- `dd` — signed winding difference across a pair's two members;
  the coil's handedness and strength
- `mass` — parked rest energy (the condensation register)
- `charge` — signed `int16`; biases offer acceptance
- `heat` — the thermal bath; the friction sink
- `packet[c]` / `packetNu[c]` / `packetPar[c]` — photon count,
  energy, and parity-sign in flight
- `incip[c]` / `incipNu[c]` / `incipBorn[c]` / `incipOp[c]` /
  `incipPar[c]` — pending (incipient) offers awaiting
  confirmation; `incipBorn` is the offer's epoch, `incipOp`
  its operational phase (`nu·age mod 256`)
- `armed` — `Σ incip` on a node: the congestion measure
- `massFlight` / `chargeFlight` — directed momentum transport
- `momentum[13]` — conserved matter-momentum per pair (written
  only by force, never spent by motion)
- `bondTick` — qTick of first confirm; the node's formation
  birthday (deviation-age stratigraphy)
- `workAge` — cumulative transaction work (callus vs relic)
- `localTime` — proper-time accumulator (congestion dilation)
- `bondPar` — net chirality of confirmed bonds, saturating
  ±127 (conserved handedness record)
- `grid_current` / `grid_next` — the double-buffered state;
  phases stage into `next`, the tick swaps

**Event counters** (`ev*` — the harness-readable ledger):
`ev4` emissions · `ev17` stimulated emissions · `ev20` shed
energy · `ev23` fusion pairs · `ev24` string-breaks · `ev30`
offer declines · `ev43` mass-tax evaporations · `ev44`
thermalized overflow · `ev45` same-sign declines · `ev46`
baseline declines · `ev50` phase-opposed declines · `ev51`
bath-minted nu · `ev52` heat absorbs/dissipates · `ev53`
reflections · `ev55` momentum kicks · `ev59` relay/parity
events · journal kinds `59/61/63/65` = mass hop, site unwind,
annihilation, charge burn

**Tuners** (runtime, all exported):
`qEvapShift` mass tax · `qConfirmCap` confirm ceiling ·
`qGroundFloor` winding floor · `qCatchGate` offer gate ·
`qFusionWall` pair-production threshold (`256`) · `qCommitMin`
binding threshold (`32`) · `qMergeGate`/`qMergeMin` phase
arbitration · `qPhaseGate`/`qRailGate`/`qAxialCatch` routing
gates · `qResEmit` line-frequency emission · `qMassCap`
Compton-ansatz bandwidth · `qMomentum`/`qLaunchMode`/`qRecoilLaw`
inertia + propulsion · `qVolRoute`/`qVolShare`/`qBondShare`/
`qChainShare` composite mechanics · `qBondAge` seniority temper ·
`qParGate` handedness gate · `qWearDecay`/`qIncipTTL`/
`qStallLoad`/`qCarveLoad` aging + congestion · `qSkeletonShift`
relay skeleton-bleed rate (0=>>3/>>6 baseline … 3=full handoff)

**Phases**: `P0` carry · `P1` flight · `P1b` junction annihilation
· `P1c` mass launch · `P2` offer · `P3` confirm · `P4` winding
conduction · `P5` phase sync · `P6` emission/decay · `P7` string
break

**Ledger**: `L = Σ(winding + mass + flight + packet·nu + heat
± charge)` — the scalar the audits track. `>>` is arithmetic
shift (`m>>s = m/2^s`); `min(pair)` is a pair's committed min.

## Deviation audit — verified vs nature

**Where the substrate matches (measured, not asserted):**

| claim | status |
|---|---|
| Rest mass exists | ✓ Prigogine equilibrium — `~42k` plateau, `M ∝ 2^shift` spectrum |
| Radiative decay | ✓ spin-aligned `nu=1` emission on the circulation axis |
| Charge sign matters | ✓ `ev45=331` same-sign declines, `~12%` attraction asymmetry — *local* |
| Pair production | ✓ fusion wall `256` → `±q` fragments, net-zero charge |
| String break | ✓ `≥12`-node tubes fracture + charged endpoints — confinement analog |
| Persistent current | ✓ loss-free rail circulation on rings |
| Ledger | ✓ `~0.1%` residual, every phase audited |
| Stimulated emission | ✓ delta resonance at `nu==geo_gap`; line tracks winding exactly (96→24…192→48) |
| Optical gain + coherence | ✓ ~3× flux at the line; stimulator transmits, clone at line nu phase-locked to offer epoch |
| Transition energy | ✓ `dW/stim = 32.3` = the line; books close exactly |
| Ensemble linewidth | ✓ ~20% of line position via decay drift — measured comb, not authored width |
| Two-particle correlation | ✓ comb at `λ=256/nu`; support edge ∝ source extent R; chaoticity kills it |
| Structure scattering | ~ nu-structured response (dip at nu=24, onset ≥48) — absorption-dominated, no far-field pattern yet |
| Formation stratigraphy | ✓ deviation-age spectrum discriminates grown/authored/worn structure; birthdays survive decay |
| No thing-table | ✓ relay = complete handoff + timestamped trail; identity is reconstructed, not stored |

In plain terms: a wound knot holds a stable mass because its
evaporation rate balances its ambient feed — a genuine
dissipative structure, not a fixed parameter. It sheds energy as
real quanta radiated on its circulation axis, the way a particle
decays. Charged knots measurably bend transaction traffic by
sign — same-sign offers get declined where opposite-sign ones
bind. Above an energy threshold, collisions mint pairs of
oppositely-charged fragments. A saturated tube past twelve nodes
fractures and throws off charged endpoint mass — the confinement
signature, watchable live in the demo. Ring loops carry current
without loss. And the bookkeeping is honest: a phase-by-phase
audit sealed every leak down to a `~0.1%` documented seam.
On top of that: an excited knot amplifies a resonant probe —
the stimulator passes through and a phase-locked clone joins it,
funded by exactly the transition energy; the ensemble line has
a real ~20% width written by the structure's own decay; co-
emitted quanta bunch on a comb whose spacing is the quantum's
wavelength and whose extent inverts the source size; and nothing
in the lattice is a "thing" — identity is a trail of timestamped
transactions, which is why the deviation-age record can tell a
grown knot from an authored one.

**Where it deviates — the honest list** *(observational
measurements only — what nature's instruments actually record;
inferred rules like Pauli exclusion are excluded by definition):*

1. **Charge isn't a field** — in nature, two charged objects feel
   each other across distance (`1/r²`, measured). Ours only pushes
   on traffic that physically arrives and jams — the gate fires at
   `armed≥4` offers on a node. Attraction and repulsion are real
   but local: a congestion effect, not a field.
2. **Parity is symmetric** — nature's weak sector measurably
   prefers one handedness (the `P`-violation experiments). Our
   `dd` coils come out even — `0.89-1.0` ratio, no preference.
3. **Knots fly — and now coast** — the photon rocket is verified:
   `dd`-biased emission → `massFlight` recoil → `+1.09`
   winding-centroid drift/2000t on `rev=f6af469`. Newton's first
   law is now mechanical: the conserved `momentum[13]` register
   (written only by force, never spent by motion) lets a charged
   knot keep walking in vacuum — `+0.35` cells/2000t coast, and
   `v ∝ qMomentum` (`+0.18/+0.08/+1.42` at 32/64/128). It even
   self-thrusts on its own `ev43` evaporation — a radioactive-
   recoil rocket. Caveat: drift is slow and feed still dominates
   under sustained flux.
4. **Dilation exists — keyed on congestion, not velocity** — the
   `localTime` (τ) register integrates each node's unconsumed
   bandwidth; quiet vs congested twins diverge `22×` under
   identical `qTick` (measured). Ballistic transport stays
   absolute (rail ring period-3, bath-immune); a moving knot's
   composite clock doesn't slow — because translation doesn't
   tax the per-node bandwidth. `ω ∝ m` rest frequency also
   measured (`qMassCap`, `1:5:20` at `10/40/160`). Lorentz-in-γ
   remains absent; proper-time dilation is present and authored.
5. **Decay isn't a lifetime** — nature measures an exponential
   decay curve with a characteristic lifetime per species. Ours
   evaporates by a mass-proportional friction tax — the shape is
   equilibrium decay, not a quantized lifetime. *Nuance added
   later: spontaneous emission at the line (`qResEmit`) and
   stimulated gain are real transitions, and the ensemble
   linewidth (~20%) emerges from the drift — but no per-species
   exponential lifetime constant exists.*
6. **Mass spectrum is approximate** — the `2^shift` scaling held
   at `~3.4-3.9×` not the clean `4×` (a finite pump, not an ideal
   bath). Nature's particle masses are measured constants; ours
   are tunable emergent values.
7. **Gravity absent** — gravitational attraction is measured
   (Cavendish onward). Routing asymmetry that would act like it
   is proposed but not implemented.
8. **Ledger `~0.1%`** — nature conserves exactly. Our audit
   leaves `P7-break −63` and mid-tick sampling artifacts as
   documented seams, not physics.
9. **Scattering is absorption-dominated** — probes are captured
   into winding/heat more than deflected; the nu=24 transmission
   dip and ≥48 onset are real, but there is no far-field angular
   diffraction pattern (dσ/dΩ) yet.
10. **Linewidth is a comb, not a Lorentzian** — the ensemble
    response has teeth at the visited decay frequencies
    (~{26,30,32}); the envelope is honest, the fine structure is
    the integer decay path, not nature's smooth profile.
11. **The winding→frequency map is authored** — `geo_gap`'s
    formula (`((m>>2)*2)/L2`) is a design choice; its
    consequences (line tracking, re-emission at the line) are
    measured, but the map itself is not emergent.
12. **Authored fixtures are detectable** — `winding_set` leaves
    `bondTick=0`/`workAge=0` (perfectly ageless); grown structure
    differs in kind, not degree. Claims resting on authored
    structure carry that caveat.

**Verdict**: local transaction physics is honest (conservation,
charge-sign, pair production, confinement, recoil translation);
a proper-time clock now exists but dilates on *load* not
*velocity*; and an optical/interferometric layer is measured
(stimulated emission, gain, phase coherence, ensemble linewidth,
two-particle femtoscopy combs with source-size inversion).
**The open deviations**: charge range (field vs jam), sustained
ballistic motion (ramjet ceiling), velocity-keyed dilation,
far-field diffraction patterns, Lorentzian line shapes, and
per-species lifetimes — the remaining distance to Lorentz plus
the distance to real amplitudes.



## Scale context

The engine's node spacing is `0.1 fm` — the sub-nucleon regime
where quark confinement and string-breaking live. This MIT scale
tour is a good intuition pump for where the lattice sits:

<iframe width="560" height="315" src="https://www.youtube.com/embed/ach9JLGs2Yc?si=UFIMZu2kkgWW1zoC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Transport

- `v/c = 1.00` on all 12 FCC edge directions — isotropic, one
  hop/tick (the operational `c`)
- Dispersion-free for `nu = 1–255`
- Power-of-two dims only — chunk masks `(w-1)` corrupt on `N=40`

## Pair production + annihilation

- Fusion wall exact: `nu_a + nu_b >= 256` → `ev23` pair mint
- Yield ≈ `mass = pair × Σν >> 5` (≈ Σν/32)
- Signed `±q` recoils on `chargeFlight`, net charge `0`
- `e⁺e⁻→γγ`: opposing `massFlight` arrivals annihilate at the
  meeting node → back-to-back `255+255` packet jets, `heat=0` in
  sparse vacuum. Same mechanic as meso3i's `IANNIH` (opposing
  drest → antipodal photons) — third-generation implementation

## Knot regime (nucleon candidate)

- `comm ≈ 120` → RMS ≈ 4.7, ~10-node diameter (the `1 fm` analog)
- Kinematic ceiling `~0.033c` — routing friction, NOT inertia:
  - `4.4×` absorbed energy → no faster (routing-bandwidth bound)
  - `3×` mass → `+14%` (wrong direction for `a ∝ F/m`)
  - ceiling set by pattern re-formation cadence, not volume
- **The ceiling is the knot's SOUND SPEED**: bulk translation
  requires a structural deformation to cross the pattern — the
  emission→flight→re-arm cadence IS mechanical information
  propagating through the medium. `0.033c` = the rate phonons
  move through bound topology. Evidence: `comm 40→120` gives
  ceiling `0.027→0.031c` — it RISES with density (tighter
  coupling → faster sound), the opposite of inertia. Pushing
  harder doesn't help because you can't outrun your own phonons.
  Maps to `v_s ≪ c` in real materials — bound structures can
  only translate as fast as their internal coupling carries
  the deformation.
- Immortal against compression: flux, counter-flux, `massFlight`
  strikes, and knot overlap all accrete — never rupture
- String-break under TENSION only: `≥12`-node saturated tube
  fractures → `768+768` endpoint mass + `±8` charged recoil,
  exact ledger (`2×768 + 128 = 1664` drained)
- Species-inverse balance: `mass ≈ committed/3.4` equilibrium
  (`0.292`, flat 1000→5000t under locked rules; the rule's 1:8
  floor is a nucleation trigger, not the setpoint — competing
  radiation/condensation rates settle it higher). Massless
  sites radiate only (nucleation seed required)

## Directional memory (the `dd` stack)

`dd` = `winding[2e] − winding[2e+1]` pair imbalance — stored
angular momentum, thermodynamically irreversible:

- `dir_bias` transduction: offer's direction bit survives
  confirm → `dd=314` written from flux (vs `~1` symmetric)
- `dd_shift` conduction: imbalance pushes along its own channel
- `bend_shift` impedance-gated rotation: fires only when forward
  pair saturates (`≥128`), rotates `dd` onto `dot=1` edges
- `rad_shift` radiation tax: un-rotated fraction sheds as
  forward packets (`ev33`) — discrete synchrotron
- Retention: `125%` over `800t` beam at `dir_bias=0` (grows!);
  `+12,000%` spin-up at `dir_bias=256` — beam is a `dd` pump
  *(pre-toll measurement — the surplus toll now bounds this:
  `chain_share` re-offers pay from the uncommitted margin,
  killing the runaway while preserving the `dd=519` dimer bond)*
- Accretion physics: sustained flux → `mass`+`dd` growth at
  plateaued `heat ~7.4M` — driven `E→m` + `E→L` conversion

## Clock & history stack — measured

The substrate now carries a three-clock architecture plus four
conserved history registers — every entry below is measured, and
every mechanism is gated behind a tuner (default off).

**The three clocks:**

- `qTick` — the absolute drumbeat. Rail-ring packets circulate at
  exactly period-3, immune to `bath=0.05`. Ballistic time is not
  dilatable; it is the substrate's bookkeeping layer.
- `localTime` (`τ`, offset 456) — conserved proper time:
  `Σ free_·adv` per tick, where `free_ = cap − armed − txnWork`.
  A congested twin accumulated `3,424` vs a quiet twin's `76,800`
  over 600 ticks — a `22×` proper-time divergence from *load*,
  not velocity.
- `bondTick` (offset 448) — first-confirm birthday: volumetric
  provenance. Fed knots write concentric growth rings
  (surface-filtered accretion); bath knots fill like a sponge
  (volumetric, no radial gradient). Directional wind writes a
  `5.7×` fossil age-skew — windward face is the *old* accretion
  crust, inverted vs nature's leading-face erosion.

**Structure of the knot clock (measured):** at flat `cap=16` a
bound knot is depth-graded — shielded core ticks at max, working
shell crawls. Under `qMassCap` (Compton ansatz, `cap ∝ mass`),
`τ` scales `1:5:20` at `mass 10/40/160` — and `mass=0` sites get
`cap=0`: **vacuum has no proper time at all.**

**Selection rules (first in the substrate):**

- `bondDist` gate (`qAlignGate`) — offers confirm only on axes the
  node is already bonded into: off-axis accretion suppressed
  `75-90%`; selection is emergent (bit-identical on symmetric vs
  `dd`-biased seeds — bond topology self-organizes).
- `bondPar` + `qParGate` — net parity of confirmed bonds vs the
  offer's `incipPar`: a `+`-polarized knot refuses `−` flux and
  holds its handedness (~49% suppression). Chirality selection:
  handedness matching handedness.
- Lesson from the failed `dd` gate: the coherence source must be
  a *history record* (`bondDist`, `bondPar`), never a spendable
  ledger — the knot's own emission erodes `dd` at the surface.

**Honest nulls:** the wound lump has zero live circulation on all
4 `{111}` plaquette orientations (jam, not vortex); committed `dd`
is Meissner-frozen (no tumble exists — the emit/reabsorb cycle
never rotates it); no velocity wake under isotropic flux (history
records formation, not motion); `qBondAge` seniority temper is a
bifurcation knob, not a dial.

## Radiation

- Bend luminosity: threshold onset `<rate 2`, scales `326→1787`
  at `rate 2→8`, saturates `1853` with `dd` washout at `rate 16`
- Overdrive doesn't break the knot — it bloats (`vol +100%`),
  direction washes out, structure survives

## Holographic finding — interiors are bookkeeping

Measured: a `dd` pulse injected on the knot's surface stays pinned
at the surface (`west=3520, mid=0, east=0` across `300t`) — the
directional deformation never propagates through the interior.
The knot is sound-opaque: `dd` conducts along surfaces and
channels (tubes, legs) but the dense interior doesn't carry it.

Implication: everything the knot *does* happens at its boundary —
emission, absorption, arm/confirm, leading-edge re-formation
(the `0.033c` translation mechanism is a surface process, not a
bulk propagation). The interior is archived state; no clock
ticks there. The holographic principle (degrees of freedom on
the boundary, not the volume) appears here as a measured
property of a cellular substrate — "inside a knot" is the same
kind of question as "inside a black hole." The interior is
bookkeeping, not dynamics.

*Update — `chain_share` volumetric routing:* with chained offers
enabled, the interior isn't dead space — confirmed transactions
re-offer on the dominant `dd` rail, hopping signal node-to-node
through dense structure (far-side packets `9→173`, `dd`
`−4.8k→+76.7k` across a knot wall; U-tube `dd` reaches `leg4=2145`
through three bends). "Surfaces all the way down" becomes
"relays all the way through" — the interior conducts via
transaction forwarding, not packet flight or scalar residue.

Density probe: `8` packed knots retain `1.028×` isolated volume —
no density penalty; mutual emission recapture slightly favors
packing. "Mass is spaced far apart" does not drop out of
knot-level stability; it lives in transport instead — dense
regions are stable but *causally dark* (unverified on larger
clusters).

## Dead registers / phantoms

- `phase` register + 10-iter Jacobi sync: pure overhead —
  `phase_sync=0` is `0.09%` different (noise). Vortices unwind
  in `50t` — no topological protection in the scalar field
- `phase_gate` (qi3 `effPhase` port) works but doesn't gate
  `massFlight` parking
- Inert on standard scenario: `fusion_wall`, `commit_min`,
  `ground_floor`

## Geometric Pauli / two-slipstream

- Tilted `{111}`-plane hexagon: tangent rotates through 6 edge
  axes — supports two counter-rotating slipstreams (`a`/`b`)
- One stream: `150/30` holds at 100% (net handedness protected)
- Two streams: `150/150 → 62/62` — coexist but shed `~59%`
  (the annihilation-shed analog; energy goes mostly to heat)
- Third stream: refused — the hexagon has exactly 2 routing lanes

## Interactions at range — radiative torque transfer

Two `comm=120` knots at `sep=16` and `sep=12` show **no centroid
drift** (frozen at seed positions over 1500–3000t — null for
linear force), but they exchange angular momentum through
radiation: each knot's emission grazes the other's facing flank
and `dir_bias` writes bound circulation:

```
sep=12, chain=128:  ddL: +1 → +11 → +16 → +23   (t=0→2000)
                    ddR: +5 → −6  → −9  → −15
```

Opposite signs — each knot sees the other's flux arriving from
the opposite direction, so the deposition torques them
counter-rotating, like gears coupled by the medium. This is the
`meso3i` YORP mechanism (grazing light writes spin via absorbed
flank deposition) running on the conserved engine: a real
action-at-a-distance interaction living in the **angular** ledger,
not the linear one.

The wound `dd` circulation is literally a persistent current loop
on the transport edges — a candidate magnetic-dipole register.
Open questions before claiming dipole magnetism: orientation
sign-rule (does a pre-seeded `dd` preferentially anti-align a
neighbor?) and distance falloff (dipole-dipole ∝ `1/r³`).

*Substrate artifact fixed en route:* a `+x` lattice wind (+1.13
node drift/knot over 750t) traced to the conduction `k`-transfer
always pushing the pair's `+` member direction plus
first-tie-wins scans defaulting to channel `0`. Fixed via
gradient-descent conduction, per-node `sent[]` clamps against
`grid_current`, and rotated scan order — vacuum now measured
still at all separations.

## Virtual layer & rails (post-ledger mechanics)

- **Standing offers**: `nu%line` moved to confirm — off-shell
  arming, ~6-tick lifetimes, Landauer dust to `heat` on expiry.
  Armed-but-unconfirmed offers steer every dominance pick via
  `eff_dd` (committed `dd` + parity-weighted incipients) —
  influence without answer.
- **Parity currency**: `packetPar`/`incipPar` carry ±1 helicity
  through transport (majority-merge). Deposit direction reads
  carried parity; emission debits the emitter's `dd` by 1 —
  spin-flip ledger. Sign-rule verified: receiver flips with
  source (+54/−6 perpendicular).
- **Rails** (`rail_gate`): saturated dominant member = waveguide —
  packets skip arm AND decay, re-channeled onto the rail (turns
  with it). Confirmed transactions pave rails: ack return lays 1
  committed unit on the return pair (conserved transfer).
- **Persistent current**: `12` packets on a closed `{111}` rail,
  `2000`t, zero arms/decay — live circulating current on a
  static coil. (Seed caveat: use ENGINE channel vectors — a
  mislabeled vec[] paints an open arc.)
- **Census metrics — two axes of handedness**: a *closed*
  circulation has zero net `dd` by symmetry (loop forward
  channels alternate +90/−90 across even/odd members → global
  sum cancels). Species need TWO measures: net `dd` (stick
  polarization — wound ball reads −100,415) and path `curl`/
  `ringdd` (closed circulation — live ring holds 540 at 3000t).
  A loop reading `dd=0` is not relaxed — it's circulating.
- **Species census (corrected seeds, 3000t)**: ball
  `mass=3,846 ratio=0.020`; static ring `comm=2,340` (survives,
  no nucleation); nucleated ring `mass=60` (spark held —
  rings CAN carry mass); live ring `stream=12, ringdd=540`
  (current + winding both persistent); **wound ball**
  `mass=35,618 ratio=0.239 dd=−100,415` — 9× plain-ball mass,
  polarized winding, the spinning-knot species.
- **Untested**: `PAR_SIGN`-selective absorption — a coil that
  arms parity-*matched* offers and declines mismatched ones
  self-selects its charging spectrum (positive feedback:
  aligned flux grows `dd` → stronger selectivity). The inverted
  version (reject matched) is a `dd` stabilizer. One-line gate
  at the arm path; untested.
  **Observational anchors**: optical pumping (a vapor absorbs
  circularly polarized light → becomes spin-polarized → prefer-
  entially transmits that polarization — the feedback loop
  itself, measured since the 1950s); circular dichroism
  (differential `Δε` absorption of L/R circular light by
  chiral media); spin-valve GMR (a magnetized contact passes
  same-spin carriers preferentially).

## Strong-force mechanics — the full checklist

- **Tube exists** ✅ — `winding=200` zigzag rail carries a seeded
  stream loss-free through `6` turns (waveguide exemption +
  rail bypass). Packets re-channel onto each node's dominant
  member, riding the curve.
- **Tube mediates force** ✅ — the stream's confirmed deposits
  write `massFlight` on the **arrival channel** (`ch6=+x`)
  while the knot's intrinsic crawl writes its own `dd` axis
  (`ch7`). Per-channel anisotropy isolates extrinsic force
  from intrinsic churn — `ch6:1` vs `ch7:839` on the receiver.
- **Confinement** ✅ — `Phase 7` string-break: a continuous
  `≥128`-balanced saturated pair `≥12` nodes fractures,
  pair-produces endpoint mass (`1,792` minted, `ev6=1`),
  and recoils the fragments apart with opposite `chargeFlight`.
  The tube's job is to store tension and snap — not to heal.
  (A manually-severed gap does NOT re-pave: paving requires
  traffic, and traffic requires the tube — self-consistent stall.)
- **Motion** ✅ — `massFlight` launch rides the dominant `|dd|`
  member (fixed a sign-bias that motion-locked `−dd` knots —
  both handednesses now crawl; `−dd` drifted `+0.46`,
  `+dd` drifted `−0.20` over `3,000t`, handedness-dependent
  direction).
- **Radiation pressure** — `massFlight[c]+=1` per confirmed
  deposit wires absorbed momentum → recoil. Real but weak
  against `38k`-mass knots (needs focused flux or long runs).

## Substrate chirality — RETRACTED (bookkeeping bug)

The `1.7:1` accretion asymmetry reported here was **a parity-tag
bug**, not substrate physics. `PAR_SIGN(n,c)` was channel-relative
(`winding[c] > winding[c^1]`), so a packet emitted on the dominant
channel always minted `+Par` — a `−dd` knot therefore debited its
*even minority* member (`p_>0 → (c&~1)`), collapsing its structural
`min` and starving accretion. Member-relative `PAR_SIGN`
(even-dominant = `+`, odd = `−` — the convention the rest of the
engine already used) restores symmetry: `+dd 41,741` vs `−dd
46,763` (`0.89`, within run variance).

The residual `0.89` is worth a longer-run check — a mild second-
order asymmetry or plain seed noise, not the runaway.

## The Meissner lock — committed structure stops bleeding

Phase 4 gradient descent used to drain **any** balanced pair
`>=32` at `a>>3` per tick — rails and tubes dissolved into the
vacuum (the visible dim-out) while dust below `32` sat frozen.
The rule was inverted relative to nature: it froze the noise and
bled the structure.

The lock: balanced pairs in `[commit_min, 128)` skip conduction
entirely — committed structure is *structure*, not field.
Pairs `>=128` bleed only the over-pressure excess `(a-127)>>3`.

Measured (32³, seeded `200/200` on `ch6/7`):
- **before**: `200 → 105 → 69 → 68` and still falling
- **after**: `200 → 154 → 143`, then `t50 = t400 = 1572` — frozen

Regressions: wound-ball accretion unaffected (`25k` mass —
unbalanced pairs take the `a!=b` directional path); ring rail
holds `630/660` dominant winding (was dimming).

Calibration notes: tubes floor at `~143`, not exactly `128` —
`(a-127)>>3` falls under the `k>=8` transfer gate early. Dust
`<64` is still effectively frozen (`k<8` never transfers), so
the "vacuum expels field" half of the Meissner story is inert —
committed structure persists, but the medium doesn't actively
push flux back onto rails. Nature's tube persistence is now
matched on the structure side only.

Consequence: over-pressured tubes relax toward the `128`
fracture band — `Phase 7` stays armed on any tube that parked
just over the gate.

Post-lock hexbuckle (64³, n=12/scen): `flat=63,785±6,873`,
`dip0=57,602±5,852`, `dip32=53,755±6,485` — the bend sits within
`~1.5σ` of flat. **No flexoelectric dipole** — the `charge+=cq`
transfers that would polarize are the same transfers the lock
froze. But the probe now leaves `~60k` trapped polarization vs
`~0` pre-lock: deposited charge persists once conduction stops —
**charge memory**, not strain-induced dipole.


## Genealogy

`meso3i (IDREST/IANNIH/DWELL) → link3 (lDR/lDW/lUP) → qi3
(winding/held) → moore26 (winding pairs/massFlight/incip)`

Same knot regime across four engines — committed circulation,
directed rest, dwell parking, annihilation-on-collision.

## Conservation audit arc (ledger sealed to ~0.1%)

Per-phase delta counters (`-DM26_AUDIT`, `moore26_audit(p)`)
attribute every ledger change to a tick phase. The hunt, in order:

| leak | fix |
|---|---|
| `h>>7` silent heat drain | booked to `ev44` (tracked bath) |
| incip expiry booked `h` not `h·nu` | `h*nu` thermalizes |
| annihilation `nu=hit` mint (`hit²` out) | `nu=1` per quantum — exact |
| register-cap truncations (flight/annih/chain-share/emit) | excess → `heat` everywhere |
| `incipNu` scalar overwrite on shared channel | weighted `nu` mixing at arming |
| spin-flip debit deleted 1 winding/emission | debited rung → `heat` (parity costs angular momentum, not free energy) |
| stale `grid_next` resurrected ghosts | `rescan_live` memsets dead chunks before swap |

Result: every transactional phase audits `ΔL=0`; `P7-break`
carries `−63` string-break bookkeeping; the `5%` void is now a
`~0.1%` documented seam. Mid-tick `grid_next` sampling in the
audit shows a `+957` P0 artifact (buffer-staging ghosts, not
minting) — tick-end `grid_current` sampling is the honest read.

## Mass spectrum — calibrated (Prigogine dissipative structure)

`qEvapShift` mass tax: per-tick evaporation probability
`(mass>>shift)&1023`, emitting `nu=1` packets on the knot's
dominant circulation edge (spin-aligned radiation, `ev43`).

- **Closed box**: plateau `~40k`, *supply-bound* — the knot
  eats until the vacuum starves; tax sets only the residual
  split (41k/39k/39k for shift 3/4/5)
- **Open box + sustained flux**: plateau `≈ flux × 2^shift` —
  measured `467/906/1244` (shift 5 still converging toward
  `4×` when sampled). Mass is an emergent `supply/friction`
  value — a real tunable spectrum, not an input

## Charge law — measured field behavior

`charge` (int16) is dynamic — absorption re-charges a node
(`charge += nu` can flip sign). Sign-aware binding: same-sign
offers cap at `4`, opposite-sign at `13−|q|>>3`. Measured:
`ev45=331` same-sign declines vs `35` baseline on a `+104`
target — repulsion real; `−q` knots decline `+par` ~12% less
(attraction). Knots also **repolarize** under sustained
opposite flux — a `−q` node fed `+par` packets flips `+`.

## Absorbing boundary

`qAbsorbWall` (`moore26_absorb_set`) zeroes the outer shell of
`grid_next` each tick — open-box conditions for emitter
demos; the x/y torus wrap no longer recirculates pumped
streams into the measurement.

## Runtime tuners (all exported, `build.sh` synced)

`fusion_wall`, `commit_min`, `ground_floor`, `confirm_cap`,
`catch_gate`, `axial_catch`, `dir_bias`, `deflect_align`, `dd_shift`,
`bend_shift`, `rad_shift`, `phase_gate`, `phase_sync`,
`phase_adv`, `work_cap`, `bond_age`, `align_gate`, `par_gate`,
`mass_cap`, `evap_shift`, `absorb`, `charge_set`, `packet_par_set`,
`chargeflight_get`, `audit`, `incip_ttl`, `offer_torque`,
`merge_gate`, `merge_min`, `vac_floor`, `vac_rate`, `heat_set`

**Phase/history getters**: `incipient_get`, `incipient_nu_get`,
`incipop_get`, `incip_total`, `packet_get`, `packet_total`,
`packet_nu`, `packet_born`, `packet_par`, `winding_get`,
`mass_get`, `heat_get`, `events(i)`

**History registers** (bulk-read at `state_pointer` offsets):
`txnWork` (444) per-tick transaction count · `bondTick` (448)
first-confirm birthday · `workAge` (452) cumulative effort ·
`localTime` τ (456) conserved proper-time · `bondPar` (460)
confirmed-bond chirality


## External reading

The physics concepts the substrate touches — the real-world
counterparts the measurements are compared against:

- [Moore neighborhood](https://en.wikipedia.org/wiki/Moore_neighborhood) — the 26-cell stencil the channels derive from
- [Face-centered cubic lattice](https://en.wikipedia.org/wiki/Cubic_crystal_system#Face-centered_cubic) — the underlying transport geometry
- [Lattice gas automaton](https://en.wikipedia.org/wiki/Lattice_gas_automaton) — the method family this engine belongs to
- [Dissipative structure](https://en.wikipedia.org/wiki/Dissipative_system) — Prigogine's far-from-equilibrium order (the mass plateau)
- [Color confinement / string breaking](https://en.wikipedia.org/wiki/Color_confinement) — the QCD analog of the tube fracture
- [Pair production](https://en.wikipedia.org/wiki/Pair_production) — γ+γ → charged fragments at an energy threshold
- [Parity violation](https://en.wikipedia.org/wiki/Parity_(physics)#Parity_violation) — the weak-sector asymmetry the substrate doesn't reproduce
- [Yarkovsky–O'Keefe–Radzievskii–Paddack effect](https://en.wikipedia.org/wiki/Yarkovsky%E2%80%93O%27Keefe%E2%80%93Radzievskii%E2%80%93Paddack_effect) — radiative recoil (the proposed knot-motion mechanism)
- [Transactional interpretation](https://en.wikipedia.org/wiki/Transactional_interpretation) — Kastner's offer/confirm framing, a lineage influence on the handshake
- [Causal set theory](https://en.wikipedia.org/wiki/Causal_sets) — the discrete-causality program this substrate runs as a working engine


## Axial products: the acceptance cone (pair-cone)

`script/cascade/pair-cone.mjs` — joint-coincidence axial measurement on
scar-produced pairs. Mechanic: annihilation leaves a face-channel scar
with a parity record (`scarPar`); when the scar exceeds threshold it
produces a mirrored pair on the two odd cells it separates — mass share,
mirrored `bondPar`, opposite escape kick, and now a **volumetric flux
skeleton**: mirrored `dd` circulation minted on the four edge pairs
containing the separation axis, plus `bondDist=2` on those pairs as the
bond-reach provenance. FCC edges are face diagonals — each axis is
contained in exactly four of the six edge pairs (|cos|=1/sqrt2), the
other two transverse — so the skeleton is literally an acceptance cone
in edge-space, and angle-dependence falls out of geometry + the cell's
own record rather than any authored cos^2 law.

Two fixes made the cone interrogable. `bondDist` was birth-site state —
the escape kick relocated the object but the record stayed behind, so
the align gate at the product's live cell saw a stranger. The relay now
hands `bondDist` off whole on complete relocation (a provenance record,
not circulating energy). And the skeleton is deducted from the mass
share — the earlier mint overspent ~12% of the scar budget.

Proof (`--trials=12 --catch=4 --axial=1`, probed channels on all six
edge pairs, both arms simultaneously, outcome = pair-winding jump >=8
vs +1/tick wear):

- chirality law: matched parity accepts ~92%, crossed refuses 100% —
  *mirrored* at the two products (same probe parity reads opposite
  verdicts at A and B)
- cone law: transverse-pair probes refused 100% at both arms;
  containing pairs pass (`qAlignGate` reads `bondDist`)
- rotation control: x-scar -> cone on pairs {3,4,5,6}, refuse {7,8};
  y-scar -> cone on {3,4,7,8}, refuse {5,6}. The cone follows the
  provenance axis, not grid bias.
- E(A,B) decomposes exactly as a deterministic shared-record model
  predicts — perfect anti-correlation under same-parity probes is a
  *revealed label*, not a Bell violation. This substrate is a local
  hidden-variable model by construction; the result verifies the
  record is real, axial, mirrored, and independently enforceable.

`qAxialCatch` (`moore26_axial_catch_set`, shift 0..15) adds a
channel-local term to the catch level — committed exchange
`min(w[c],w[c^1])` on the arrival pair raises that offer's catch
level. The graded (probabilistic) version of axial acceptance — a
lottery weighted by alignment rather than a binary cone — is the
remaining piece for any Bell-shaped statistics; current skeletons
settle too thin (~1-2 per pair after the w>>shift relay bleed) for
the gradient to dominate.

Verdict: axial measurement basis operational. Bertlmann-with-axes —
correlated birth records independently enforceable, not Bell.


## Anomaly resolution: charge suppression + drift selectivity

The within-cone asymmetry (p6 >> p3-p5 in charged sweeps) resolved into
three separate effects, two of them real physics:

- **Harness cross-traffic** (fixed): B-arm refusal massFlight deposited
  on A's transverse pairs; feed-phase deflected offers wrote real
  bondDist off-cone; armed feed incipients congested the probe window.
  Solo probing + 6-tick settle gap -> transverse pairs now 0.000 clean.
- **Charge suppression** (physics): sustained matched-parity feeding
  accretes deep skeleton (cone pairs ~50-120 committed) but each
  confirm also mints same-sign charge via charge provenance; the
  charged product then declines same-sign probe arrivals at cap=4 —
  post-charge cone acceptance drops ~10x. The feed binds what it feeds.
- **Drift-direction selectivity** (physics, verified): probing each
  cone-pair member separately shows acceptance concentrated on the
  HEAD-ON channel — probes traveling against the product's residual
  momentum direction. A (kick -x): +x probes favored (ch6 20/20 vs
  ch7 14/20, ch12 19/20 vs ch13 17/20). B (kick +x): exact mirror
  (ch13 19/20 vs ch12 6/20, ch7 19/20 vs ch6 4/20). ~3-5x selectivity,
  flipping with momentum sign — a ram-pressure-like observable: the
  object catches what it runs into. Emergent, unauthored.

Verdict: cone law = where the object was bonded; drift selectivity =
where it is going. Two independent directional observables, both local.


## Interferometer: phase readout verified, merge-on-phase absent

`script/cascade/interferometer.mjs` — the torus IS the beam splitter:
one emitter fires both pair members; arm A geodesic (8 hops), arm B
wraparound (24). Two-lobe arrivals resolved (Dt~19 vs predicted 16).

**Phase carriers verified**: each packet's born-tick gives op =
nu*age mod 256 — a real internal clock ticking nu per hop (substrate
de Broglie relation, spatial period 256/nu hops). Arm A arrivals all
read op=164 (coherent within arm); arm B shifted by nu*dL exactly.

**Honest null on two-arm interference**: no register exists where two
arms' phases can combine — offers are processed per-channel,
same-channel packets share velocity (can never meet), incipNu merge
requires same-channel arrival (impossible for unequal arm lengths at
1 hop/tick). The phase gate instead gives per-arm FILTERING: arm A
accepted in an op-band around the node phase (nu=30,60,90,100 cluster,
ops ~208-240 under gate +-48). Phase-selective detection: real.

**Cross-arm coupling exists through proper time**: armed offers consume
headroom (free_ = cap - armed - txnWork), headroom drives phi_D's
advance — arm A's traffic slows the detector's clock, shifting arm B's
acceptance window. Second-order; unresolved at these windows.

**Storage-ring finding**: carve residue on a warmed torus lane
circulates indefinitely — the drip floor alone bounds lifetime; warm
lanes host self-sustaining populations. drain-phase protocol: residue
dies (~150 ticks), wear records persist — warm lane, clear field.


## Coherence attempt: offer-field torque — NULL at tested strength

`qOfferTorque` (moore26_offer_torque_set): standing incipients pull
the node phase toward their born-ops, weighted by nu — the TIQM
"absorber responds to the field's coherent sum" implemented as local
clock torque (derived, not an authored amplitude factor). Required
incip TTL ~24 so a multi-component cloud exists at all.

CW two-arm sweep, corr=<oA*oB> vs dphi=nu*16, 80-tick windows:
  torque=4:  dphi=128 -> -0.20 | dphi=0 -> +0.08
  torque=0:  dphi=128 -> -0.21 | dphi=0 -> +0.09   (identical)

Verdict: NO measurable coherence effect at this strength/window. The
corr-vs-dphi structure is fully produced by gate-window selectivity
plus congestion competition for the incip cap. The clock torque
either does not propagate into confirm decisions or is far below the
statistics. Kept as a tuner for stronger tests; the honest read is
that a real merge-on-phase likely needs to act on the confirm/arbit
decision directly, not on clock dynamics.


## Merge-on-phase arbitration: the first superposition register — FRINGE MEASURED

After the offer-torque null, the remaining design was stated precisely:
relative phase must enter where a decision is made — the arming/
arbitration step — not upstream on clock dynamics.

**The law (authored, explicit — NOT emergent):** `qMergeGate` +
`qMergeMin`. At an absorber node (mass >= qMergeMin; lane nodes ~0 so
only real absorbers arbitrate), an offer arming while incipients stand
is admitted only if its frozen arrival-phase signature
`op = nu*age mod 256` is within qMergeGate of some standing member's
`incipOp`. Otherwise the offer thermalizes (heat += nu, ev50) — the
refused energy lands in the absorber's heat ledger, not the void.
New register `incipOp[26]` freezes each incipient's arrival phase at
arming; phases are compared at presentation, so same-path offers
always agree (one path, one phase) and cross-path offers differ by
exactly nu*DeltaL. The first substrate law where the field's response
depends on relative phase — the superposition term TIQM puts in the
absorber's answer.

**Earlier draft bug caught by measurement:** the first implementation
compared standing incipients' ops as-of-NOW (incipBorn age keeps
ticking while standing) — clouds self-anti-phased and every stream
self-refused at high nu (ev50 ~190/window at nu=70). Freezing at
arrival (incipOp) restored same-arm coherence; phDecl dropped ~7x.

**Second confound caught:** ev50 is a global counter — early "fringe"
declines were torus lap-mixing residue at non-detector nodes, and
merge-on P(B) suppression was initially EQUAL at all dphi: en-route
attrition at mid-lane standing clouds, not absorber arbitration.
`qMergeMin` restricted arbitration to mass-bearing absorbers.

Protocol: balanced arms E=(4,4,14),D=(16,16,14) — LA=12,LB=20 hops,
dphi = nu*8 mod 256; phase gate OFF (merge is the only discriminator);
incipTTL=32 for real joint occupancy (0.28-0.59 vs ~0.02 at TTL=8).

VERDICT TABLE (P(B), merge-off baseline -> merge=48):
  aligned (circ.dist<=48), 6 nu rows (4,28,32,60,64,96):
      0.59->0.59, 0.15->0.15, 0.47->0.47, 0.41->0.41,
      0.51->0.49, 0.19->0.17  -- BIT-IDENTICAL, law transparent in-phase
  anti-phase (dist>48):
      nu=12 (d96):  0.42->0.00
      nu=16 (d128): 0.72->0.00
      nu=48 (d128): 0.34->0.00          -- TOTAL exclusion
  gate edge nu=72 (d64): 0.56->0.60     -- jitter-smeared boundary
  B-solo control nu=16: P(B)=0.65, phDecl=0 -- same arm, same law,
      zero declines; refusal is purely RELATIONAL (phase difference
      between histories), not a property of B's path.

Mutual exclusion: whichever arm's cloud seeds first sets the field's
phase; the other arm is refused — corr goes negative on refuse rows
(-0.45..-0.68). Anti-phase meetings thermalize at the absorber
(+heat, ledger sealed).

Decoherence by path jitter: wavelength = 256/nu hops. At nu=64 a 2-hop
detour flips phase 128 — high-nu fringes smear (nu=64 aligned row
still shows phDecl=62 from arrival-age spread). At nu<=16, lambda
16-64 hops >> jitter — clean. Real physics, not artifact.

What this is: a local, deterministic, ledger-sealed interference law —
relative phase of transaction histories arbitrates who may join a
standing field. What it is NOT: no claim of QM equivalence; the gate
is authored, binary, and the absorber's exclusion is winner-take-cloud
rather than amplitude arithmetic. The honest reading: this is the
minimal place where two phases can talk, and when they do, the
substrate produces a fringe.


## Knee map: the arbitration boundary resolved (script/cascade/knee-map.mjs)

Fixed nu=8 (lambda=32 hops >> path jitter ~1-2 hops), scanned emitter
along the diagonal E=(k,k,14), k=1..15 — each placement gives a
different arm difference dL={2..30} hence dphi=8*dL covering the full
phase circle in 16-unit steps, both authored boundaries (dist=48)
sampled. Per point: merge=48 vs merge=0 matched-flux runs.

Observed curve (P(B)_on vs circular dist from 0):
  dist 16-48 (admit band):  joint = min(PA,PB) ~0.55-0.68, pd~0
      — full cloud coexistence, law transparent
  dist 48->64 boundary:     joint 0.55 -> 0.00 in ONE step (dL=2 hops)
      — the knee is razor sharp, width <= jitter*nu (~16 units)
  dist 64-72 (edge):        bistable mutual exclusion — both arms
      partially alive (PA=.33,PB=.46) but coexist ZERO ticks
  dist 80-176 (floor):      total exclusion of the weaker arm,
      P(B)=0.00-0.05, joint=0
  dist 48-16 second knee:   unreadable — B baseline starves at LB>=29
      (0.00-0.45); partial recovery at dphi=224 only

Structure: the arbitration is winner-take-cloud — phase-opposed
incipient populations never stand simultaneously; the edge is
bistable (either arm can hold the field) while the deep band excludes
the lower-flux arm entirely. The measured knee tracks the authored
boundary at essentially the resolution limit — the substrate adds
jitter-width smearing, not softening. To read knee 2 symmetrically
would need a matched-length geometry with both arms well-fed.


## Knee "hole" resolved: off-route arrivals, not a law anomaly

The 96/112 sub-band (P(B)=0.23-0.26 inside the anti-phase floor) was
fully dissected. D's incipient cloud is PURE — ch6 members only, all
frozen at op=80, stacking 13+ deep, no strays on other channels.
The ch7 "B" armers that leaked carried incipOp=104 (nu=8 stream
packets, age=13 hops) — far shorter than the nominal 22-hop wrap arm.
Mechanism: packets wander off the B lane, cross the bulk, and enter D
on ch7 from BEHIND (E->(17,17)->D ~13 hops). They carry genuinely
in-phase ops — the gate correctly admits them: arbitration reads the
offer's ACTUAL measured path phase, not the channel label — positive
evidence the law tracks real transaction history.

Strict attribution added to knee-map.mjs (incipop_get: count ch7
armers only when their frozen op is within +-24 of nominal
nu*(LB-1)). Result: the entire leak vanishes — nominal-arm exclusion
is TOTAL across the anti-phase band (strict <= 0.03 at every refuse
point). The unfiltered "leak" is a bulk-route arrival population that
varies with geometry (0.00-0.26 per point), admitted at the in-window
rate ~96/256 as expected for quasi-random ops.


## Vacuum census: the substrate's noise floor and the sidescatter halo

Aggregate census getters (moore26_packet_total / moore26_incip_total)
enabled grid-wide population counts.

QUIET VACUUM: exactly 0 packets / 0 incipients over 100+ ticks.
The vacuum is INERT — no spontaneous fluctuations. All vacuum "noise"
is driven.

MASS-SHINED VACUUM: a lone unbonded mass=40 node emits nothing in 200
ticks. Bare mass does not shine; vacuum flux requires wound/driven
structure.

DRIVEN AFTERGLOW (stream off): 234pk/235ip -> 21/108 (t=40) -> 0/4
(t=80) -> 0/0 (t=120). Packet half-life ~35 ticks on warm lanes;
incipient clouds linger ~2x longer. No persistent population.

THE HALO (single ch6 lane stream, census at t=120):
  on-lane:        39 packets (57%)
  in-plane stray: 29 packets (42%)  — almost all still ch6-channeled
  out-of-plane:    1 packet
Strays keep their CHANNEL while leaving the lane cells — they
sidestep into parallel displaced transport, same velocity, same age,
SAME PHASE as the lane population. The halo is a coherent
parallel-flow sheath, not thermal noise. This is the vacuum-noise
population that leaked into the knee map: halo members re-channel
near the detector and arrive on "wrong" channels carrying real
(in-phase) ops — correctly admitted by the merge gate.

Character: this substrate's vacuum noise = shepherded sidescatter —
directional, coherent, phase-preserving leakage (~42% of driven flux)
around every lane, over a perfectly inert vacuum.


## Fluctuation spectroscopy: is Gaussian "free" in a structured medium?

script/cascade/noise-spectrum.mjs — stray-packet counts in an off-lane
probe patch, coarse-grained at bin widths 1..64 ticks, with Fano
factor, skewness, kurtosis, autocorrelation.

ANSWER: NO — not at these scales. Deterministic emission (1 packet/
tick) produces super-Poissonian halo arrivals: Fano DIVERGES under
coarse-graining (1.06 -> 6.2 at W=64) instead of converging to 1.
Skew/kurt do approach a symmetric platykurtic shape — a Gaussian
envelope over a colored process. The medium generates its own
fluctuations; correlations never die, so the CLT never engages.

TTL REGIME DIAGRAM (incipient standing window = memory coupling):
  ttl=4:   white past lag3 — no memory, no resonance
  ttl=6:   +0.48 -> dip -> hump at lag~16 (0.24)
  ttl=12:  same ~16-tick period, stronger (0.28)
  ttl=24:  red spectrum — rho 0.77 -> 0.28 still decaying at lag24
The ~16-tick mode does NOT track TTL (6 and 12 ring identically —
likely the 32-hop toroidal lap's half period or congestion/wear
relaxation), but its EXCITATION needs standing clouds. TTL controls
the coupling between stream and the medium's memory kernel:
short = white, matched = resonant ringing, long = red 1/f-like drift.

This is the Johnson-Nyquist idea inverted: noise spectrum = the
medium's dynamical fingerprint. The substrate's vacuum noise is a
spectroscope for its internal timescales — closer to nature's 1/f
flicker (correlated, memory-carrying) than to thermal jitter.
Nature's Gaussianity presumably requires weakly-coupled independent
sectors — a many-lane/many-emitter vacuum test is the natural probe.

## Thermal vacuum channel: conserved re-emission, flux-aware audit

The substrate's vacuum is inert absent drive (census above), but
the engine long carried a dormant CMB-like pathway: a node whose
heat reservoir exceeds a threshold stochastically boils energy
back into a packet. That pathway is now exposed and audited:

- `vac_floor` (default 128): heat threshold for re-emission.
- `vac_rate` (default 64): 1-in-N odds per hot node per tick.
  Defaults are bit-identical to the legacy `h>128 && rand&63`
  hardcode — all prior measurements reproduce.
- `heat_set(x,y,z,v)`: seeds a thermal reservoir. Writes BOTH
  buffers and wakes the chunk ledger — previously heat-only
  nodes were invisible to `node_live` and the reservoir sat
  dark forever (a hot node is definitionally not vacuum).
- `ev51` = heat→packet minted nu (the bath's energy flux).
- `ev52` = nu-equivalent reabsorbed into heat across the 19
  uncountered credit sites (cap truncations, decline refunds,
  mixing remainders, TTL expiry, annihilation, recoil, vents).
- `ev7` (pre-existing) = packet decay → heat.

SEALED AUDIT (32³, 4×4 patch seeded heat=4000/node at floor=64,
rate=8, 200 ticks):
  Δheat = 17731
  ev51 mint = 31714   ev44 drain = 12171
  ev7 decay return = 18996   ev52 reabsorb = 7158
  Δheat − (ev51 + ev44 − ev7 − ev52) = 0   EXACT CLOSURE

The heat ledger is now fully flux-aware: every nu leaving heat
is counter-visible (mint ev51, drain ev44) and every nu
returning is counter-visible (decay ev7, everything else ev52).
The bath's thermodynamic cycle — structure → heat → vacuum
flux → reabsorption — is closed and measurable end to end.

Remaining caveat: u16 heat saturation (>65535) still clamps
silently — unreachable in seeded baths ≤4000/node but a real
ceiling for extreme drives.

Seeded-bath behavior (floor=64, rate=8): a 16-node 4000-heat
patch emits ~4.3 packets/tick into random edge channels with
nu=h>>3 (≈31–34 avg minted nu/emission, ev10=857 events/200t).
Emitted flux random-walks off the patch, decays via ev7, and
partially rethermalizes — a driven, funded, measured bath.

Nature-analog now testable: quiet vs seeded-thermal vs
driven-halo vacuum statistics; Brownian motion of structures;
Casimir-like shielding between absorbers in a warm bath;
noise-spectrum whitening under many independent emitters.

## Casimir probe: hot-medium plate attraction — NULL, mechanism diagnosed

Theory prediction (paradox/quantum §4): a hot ambient medium,
restricted between two plates, pushes them together — outside
tension exceeds inside tension. Tested directly with the seeded
thermal bath (script/cascade/casimir.mjs): two 9x9 mass plates
(mass=2000) at separation d, thermostat bath, packet density in
the inter-plate gap vs a matched control volume.

WARM BATH (nu~30, lambda~8.5 cells — geometric shadowing regime):
  d=4: depletion 4.1%   d=8: 1.2%   d=12: 2.8%
  non-monotonic, near the no-plate baseline (23.85/width)

COLD LONG-LAMBDA BATH (nu~4, lambda~64 cells — mode regime d<lambda):
  d=4: 0.5%   d=8: 0.3%   d=12: -0.1%   — flat null

VERDICT: no measurable Casimir-like depletion in either regime.
The null has a mechanism, not just a scale problem:

1. Volumetric sources: seeded heat emits inside the gap too — the
   cavity's own reservoir refills it. Authored emission is
   boundary-blind; there is no mode spectrum for plates to cut.
2. Radiative equilibrium: plates absorb flux -> thermalize ->
   re-emit isotropically through the same channel. A persistent
   shadow cannot survive equilibrium — the textbook Le Sage
   failure, reproduced rather than assumed.
3. Ballistic, not modal: packets carry phase but traverse, they
   don't stand. A cavity is only felt at the plate surface — by
   which point the packet is already inside.

CONSEQUENCE FOR THE THEORY DOC: "hot medium restricted between
plates" fails as SHADOWING in this substrate for the same
thermodynamic reason it fails in nature. What the prediction
actually requires is a boundary-shaped fluctuation spectrum —
i.e. standing modes. Two forks could still produce an analog:
(a) external-reservoir geometry (flux must transport into the
gap -> real shadowing, but Le Sage, not Casimir);
(b) bath on closed resonant paths (rails/rings) where flux
genuinely stands — then a cavity could cut wavelengths.
Literal-EM Casimir remains out of scope: at 0.1 fm/node the
real effect needs ~10^5 fm grids — the analog question is
whether boundary-shaped vacuum spectra exist at all.

## Force from offer density — MEASURED; the "instability" was a mint

(script/cascade/force-probe.mjs) Two controlled opposed packet
streams at a 3x3 mass plate; confirmed offers kick momentum[pair]
signed by travel direction (+x channels decrement, -x increment).

FIRST RUN showed a nonlinear runaway (+872 sustained, sign-flipping,
even under balanced streams) — initially reported as a thrust
instability. AUDIT: two momentum mints, both now sealed:

  1. flux-drag read side minted share=imb>>1 per tick per even
     neighbor with no debit — standing packets pushed forever.
     FIX: the body ABSORBS share packets off the dominant member
     (1dp/packet, nu -> heat via ev52). Funded radiation pressure.
  2. broadcast shared p>>8 to neighbors without debiting donor
     (2^-8/tick amplifier above |p|=256). FIX: donor debited —
     a coherent field now REDISTRIBUTES the kick.

POST-FIX INVERSION SET (300t, rate 1.0): +x -> -20, -x -> +13,
balanced -> +1. A mint cannot produce that pattern; funded
absorption inverts with the source and cancels under balance.
Radiation pressure is real, funded, and bounded.

## The force census — what "force" exists in this substrate

(shadow-probe.mjs, momentum-field.mjs — full audits)

| coupling | status | mechanism |
|---|---|---|
| radiation pressure | REAL, funded | absorption -> 1dp/packet, signed by travel direction |
| thrust instability | LEAK, sealed | was minted momentum, not a phenomenon |
| Le Sage / depletion shadow | STRUCTURALLY ABSENT | FCC edge-only transport: all flight is diagonal, no collimated beam can exist, every umbra refills laterally in ~2 cells (fluxAsym ~0 at probe regardless of absorber size) |
| resting momentum field | STRUCTURALLY ABSENT | momentum on a matter-free cell is vacuumed (node_live excludes it); through structure it is a marching current that drains at dead ends |
| conducted momentum | REAL | relay hands p to the frontier cell ahead of mass each tick — propagates along winding trails/mass chains, the only demonstrated inter-structure coupling |
| contact bounce / repulsion | AUTHORED + MEASURED | `qReflect` (0-255): declined offers reflect down the mirror channel c^1, refuser takes 2-unit recoil — degeneracy pressure: packed fields push back harder (+33% push at unsaturated flux, +89% saturated, ev53 counted, conservation-sealed) |
| tension / restoring | AUTHORED + MEASURED | two knobs on the ACK reach meter: `qTension` (harmonic F=k·dd, bidirectional, underdamped oscillation) and `qString` (confinement: constant pull while reach>slack — constant drag, slingback when strong, silent below slack, string-break is the release). ~25-46 stretch events/tick — strain field is pervasive |
| conducted charge force | AUTHORED + MEASURED | `qChargeKick` (shift 0-15): charged odd cells on a committed conduit push along the bond axis signed by the charge product — like repels, unlike attracts. k=min|q|>>shift spread across the axis's 4 transport pairs (AXP). ev58 counts impulse. Verified: +/- converge at the bond, +/+ separate, uncharged/knob-off controls dead, impulse scales ∝ min|q|. Force dies when the link breaks — conducted, not cast |
| stored strain energy | CENSUSED | ev56/ev57 bank/release each bond's potential per law: harmonic E=k·r²/2, string E=σ·(reach−slack) — the linear confinement potential. Bombardment banks monotonically (~44k at σ=8, ~167k at σ=32 per 200t): the lattice charges up elastically. Kicks are still authored work, not yet funded from the bank |
| vacuum back-reaction | NOT AUTHORED | structure cannot locally reshape the bath's flux except through the heat reservoir |

CONSEQUENCE: the substrate is a CONTACT UNIVERSE. Force only travels
where structure physically carries it — bonds, winding trails, mass
chains, packet streams that reach. Action at a distance is forbidden
twice over: no collimated flux (isotropy ansatz) and no resting
field (frontier-drain). If a Casimir-class attraction exists here it
must be CONDUCTED — two bodies sharing a live structure whose medium
flux loads the link asymmetrically — not radiated across a gap.

CASIMIR is matter-generated even in nature: the Lifshitz/dispersion
picture computes the identical force as summed retarded van der
Waals interactions BETWEEN THE PLATE ATOMS (Jaffe 2005 derives it
with no zero-point vocabulary at all; the force vanishes as the
coupling -> 0). Gravity is excluded by ~27 orders of magnitude and
wrong scaling — nobody mistakes it for mass attraction. So "the
plates generate the force internally" is mainstream — the vacuum-
mode language is the boundary-method bookkeeper of what the
materials do. Our substrate version says the same: the medium is
the ledger, the bodies write the entries.


## Statistical gravity: pull-to-source + dead-end seal — MECHANISM CONFIRMED

(script/cascade/source-pull.mjs, depletion-gravity.mjs) The kick
sign convention resolves: a confirmed offer on channel c writes
momentum[c>>1] with sign (c&1?+:-), and the relay maps p>0 to the
even channel (+v). Absorbing a +x+y packet therefore drives drift
-x-y: **the transaction pulls the node UPSTREAM, toward the flux
source**. Pull-model semantics made literal — prior "radiation
pressure" readings were attraction-to-source all along (mirror
arm flipped sign; balanced streams canceled — consistent either
way, the direction was mislabeled).

source-pull: single ch6 injector at B-(6,6), probe (odd, m=256):
mass 256->270, centroid cx 17.00->16.95 marching toward emitter;
control flat. Bodies drift toward what feeds them.

depletion-gravity (external-reservoir bath, 4x2048 absorber on the
ch7 axis, probe at B): mean box-momentum[3] — control -5.86,
A@+12 -10.07, A@+24 -11.76, A@-12 -2.58. Directional residual
flips with the absorber's side: a SINK REPELS — it eats the flux
that would pull the probe toward it. Le Sage inverts in a
pull-universe; +24>+12 reflects bath anisotropy (absorber nearer
the boundary emitters eats a stronger directional component).

**Dead-end broadcast leak — SEALED (rules-order bug).** The
field-drag broadcast debited the donor p>>8 per face-neighbor
without checking receiver liveness; shares written to bare cells
were vacuumed by rescan_live in the same tick — donor debited,
receiver zeroed. Broadcast now refuses dead destinations
(node_live(grid_next)); momentum backs up at live frontiers
instead of draining — dead ends became walls, emergent pressure.

**Ring-cavity matrix (first run) — no ladder.** ev50=0 at every
(C,nu): offers confirm in ~2t while injection spacing was 8t, so
the standing cloud never coexists and the merge gate never
compares phases; detWind tracked nu (energy deposited), not
admission. Mode selection needs a persistent standing cloud —
unbuilt, not disproven.

Gravity synthesis: no force needed — three statistical biases:
(a) flux ROUTES toward structure (worn-lane waveguide +
mass-bent emission), (b) transactions PULL toward source, (c)
accretion deposits preferentially at structure (catch gate +
flight-park). A pure sink repels (eats the pull); a living knot
that recycles flux into emission becomes a persistent local
source — the candidate mechanism for mass-attracts-mass is
re-emission, not depletion.

## Cold sink vs living knot: equilibrium structure is force-NEUTRAL

(script/cascade/knot-source.mjs) Same bath/geometry as
depletion-gravity; anchor at B+8*(1,1,0), probe reads box
momentum[3] mean over trailing half:

  control       -9.14   (mass 256->553)
  cold sink     -13.45  (mass 256->756)   repels: -4.31
  living knot   -8.68   (mass 256->675)   neutral: +0.46
  living-faint  -9.36   (mass 256->697)   neutral: -0.22

A mass-only absorber repels (eats upstream pull flux). Adding
committed winding — which radiates via site_unwind — erases the
repulsion to baseline at both emission rates: the knot passes the
kick ensemble through, absorbed pull re-radiated in equal measure.
Force in this substrate is NOT a property of mass; it is the sign
of a body's mass-flow imbalance: net eater repels, net emitter
attracts, equilibrium is transparent. Gravity-as-static-property
is refuted; the remaining candidate is force-as-imbalance —
decaying structure pulls, feeding structure pushes.

## Starved emitter arm: force tracks net emission — full dose-response

(knot-source.mjs --arms=starved) 4x4 block of even cells saturated
with committed winding (6 pairs x400, vol ~2400 — above the 512
ground-state floor below which a knot CANNOT unwind: meta-stable,
dark). Single-cell emitters fire ~1 rung/2-3t near the floor —
knots are intrinsically dim, a real constraint on emission-driven
forces.

  anchor                   mom3 mean   vs control
  cold sink (net eater)    -13.45      -4.31  repels
  living-faint (recycler)   -9.36      -0.22  neutral
  control (none)            -9.14       0.00
  living (balanced)         -8.68      +0.46  neutral
  starved block (emitter)   -6.75      +2.39  attracts

Mom3 increases monotonically with the anchor's emitted fraction —
a dose-response curve across the whole range, not just endpoints.
Force = net mass-flow imbalance: decaying structure attracts,
feeding structure repels, equilibrium is transparent. The first
measured ATTRACTION between separated bodies in the substrate —
and it is a decay signature, not a mass property.

## Range law: conducted attraction is FLAT (carrier-limited, not geometric)

(knot-source.mjs --arms=starved --ad=d) 4x4 starved emitter block
at d=4,8,12,16 on the +diag; probe mom3 mean vs control -9.14:

  d=4:  -6.24 (+2.90)    d=8:  -6.75 (+2.39)
  d=12: -5.86 (+3.28)    d=16: -5.72 (+3.42)

Attraction does NOT decay with distance (variation is within the
single-run chaotic spread). A conducted pull delivers full weight
when the packet survives — range is set by carrier lifetime
(per-hop decay on unworn lanes), not geometry. The substrate's
attractive force is screened, not power-law: a third measured
deviation from nature's gravity (after: force = imbalance, not
mass; pull is upstream, not downstream).

## Density flips the sign of gravity — force is object x medium balance

(knot-source.mjs starved arm, bath RATE sweep) The SAME 4x4
starved emitter block at fixed depth, three ambient densities:

  rate=16 (sparse)  control -1.63   starved -1.63   d =  0.00
  rate=8            control -9.14   starved -6.75   d = +2.39
  rate=4  (dense)   control -13.84  starved -43.95  d = -30.11

Emission is intrinsic and floor-throttled (roughly constant);
absorption scales with ambient flux (catch gate eats more in a
richer medium). So the anchor's balance flips with density:
net emitter in sparse vacuum (attracts), net eater in dense
medium (repels). The baseline ensemble also scales with density
(-1.63/-9.14/-13.84) — the ambient medium IS the kick ensemble.

Consequence: gravity's SIGN is a function of ambient conducted
density, with a measured crossover between rate 4 and 16 where
force vanishes. A dense-medium universe repels its structures;
a sparse one attracts — the substrate's "gravity" is a phase
diagram, not a constant. (Ground-state floor also characterized:
qGroundFloor=512 knob verified — lower floor lets knots radiate
deeper; committed vol <= floor = meta-stable dark bound state.)

## Charge coupling is a capacity rule, not a field — and a second channel is graded

(charge-coupling.mjs --burst=8) Isotropic 12-emitter parity bath on a
charged absorber, charge pinned, 150-300t. arming is 1 offer/channel/tick
— a trickle and a firehose transacted identically until qArmBurst let
each quantum negotiate (density was invisible to the ledger — the
inversion the knob fixed). armed_avg (time-mean incipient occupancy)
reads the effective cap directly:

  Q     armed_avg   authored cap    declines/300t
  0       11.2      13 (unbound)       1102
  +16      3.4       4 (same-sign)     1451+
  -16      9.5      11                 1339
  +64      3.4       4                 ~1600
  -64      4.4       5                 ~1620

Same-sign repulsion is a STEP at q!=0 (flat in |q| — no Coulomb
scaling); opposite-sign declines GROW with |q| toward the same floor
(cap 13-|q|>>3 hits 4 at |q|>=72) — charge suppresses admission for
BOTH signs, only asymmetrically. capSame=13 control: all arms read
armed=11.09 identically — the whole effect is the cap rule, no
emergent residue. capShift=7 (|q|>>7=0): opposite-sign interaction
vanishes — the graded term is the authored >>3 alone. Force is
quantized per decline (2 kick-units/reflect, ev53); excess-decline
cross-section ~7-13% of attempts, flat in q and flux — a discrete
coupling, not an alpha.

(conduit-burn.mjs) The GRADED coupling lives in a different channel:
a bondPar-handed odd cell facing an oppositely-charged face conduit
burns mass->conduit winding at min(mass,4|q|)/tick, spending the
charge down burn/4 — total cascade = 4|q| exactly (measured 16,32,
64,128,256 at |q|=4..64; dM/dt slope k=4.00 sustained under --pin;
zero at same-sign, zero without bondPar, zero at diagonal — the
trigger is contact-local, sign-selective, self-terminating on charge
exhaustion). mass->winding transfers 1:1 on the shared conduit.

(remote arm) chargeFlight delivers the trigger ahead of matter:
charge seeded 2 cells upstream lands on the shared conduit at t=0;
the knot's burn ignites t=1 and stops after exactly 4|cf| delivered.
"Signal precedes matter" — remote interaction = a local threshold
cascade relayed by charge mobility at transport speed.

Force taxonomy after these runs: (1) admission threshold (cap —
statistical, binary-ish), (2) burn cascade (graded, capacity-bound),
(3) load thresholds (stall/carve — traffic-mediated), (4) contact
annihilation (bondPar mismatch). Every "force" is a threshold
cascade, not a field; the only linear coupling measured is charge
as burn-capacity (k=4).

## Gate audit: authored constants wearing physics costumes

New knobs (default-preserving): qArmBurst (offers/channel/tick),
qStallLoad (incip>=32 mass-hop stall — verified: wall at load=24
arrests at stall=8, passes at stall=64, bit-identical stall=0),
qCarveLoad (incip>=16 carve slowdown), qCapSame/qCapBase/qCapShift
(the whole charge-cap law — see above), qWornGate (worn-lane decay
threshold), qSat (the 128 shared by emission routing, Meissner band,
over-pressure shunt, occupancy pick, string-break — one pressure
gauge in 5 mechanics), qChargeShed (charge>>4 mobility on routed
winding + mass launch). Fixed: three literal 32s now track
qCommitMin (committed-pair semantics at 3 sites); bondpar_set /
momentum_at_set now mark_chunk (seeds were landing in dead space).

## Charge needs process to persist (ledger bug, fixed)

node_live omitted charge/bondPar/momentum: a charge-only cell is
"dead", so the phantom-resurrection seal memset its grid_next —
seeded charge alternated -64/0/-64/0 across buffers (verified).
On transacting cells charge persisted (phases rewrite it), which is
why the bath target's charge drifted instead. Now all three records
sustain liveness — a conserved signed record can no longer be
silently sealed away.

## Knot-vs-knot duel: threshold precedence + collision repulsion

(script/cascade/conduit-burn.mjs --duel; static knots, flight-delivered
charge — no kicks)

CONSERVATION BUG FIXED first: the momentum-relay handedness check
fired annihilation per-cell — when two opposite-parity knots kicked
toward each other BOTH fired, and the second read stale grid_current
mass on an already-zeroed node: 0-4000 u16-underflow minted ~61k
mass + phantom heat. Fix: availability-clamped burn (a=min(o->mass,
next.mass)) — repeat fires are idempotent. The contact path was
already safe (ni2<=si guard + writes =0 both buffers).

THRESHOLD PRECEDENCE (measured): opposite-parity odd knots at
distance 2 (sharing a conduit) annihilate unconditionally at t=0 —
contact annihilation is charge-free and dominates the charge-burn
cascade. A mediated charge interaction between ADJACENT opposite-
parity knots is unreachable; annihilation always fires first.
Same-parity or bare knots at distance 2: perfectly stable (4000/4000,
mass conserved exactly).

SERIAL COMPETITION for one shared charge: same-parity pair (bp+20/+20)
sharing conduit C with sustained -16 influx — ONLY the lower-si knot
burns (64/t until the -16/tick spend equilibrates; measured ~32/t
with the 1-tick land-vs-scan duty cycle). K2 never sees charge: the
burn spends it in BOTH buffers within the tick. The shared conduit
is a serial resource — first-come monopoly, measured not assumed.
PRIVATE-conduit control: both burn independently ~26-32/t each.

COLLISION-VERTEX REPULSION — the emergent two-body force: opposing
mass flights on the SAME axis pair (ch6+ch7) collide on the shared
conduit -> hit=min(a,b) packet storm -> congestion -> drag-write
momentum -> mass-hop relay. Both knots receive mom=+/-25 and push
RADIALLY AWAY from the vertex at 1 cell/tick sustained, mass+bondPar
+bondDist carried whole (whole-residue handoff verified by direct
cell scan: positions track, mass stays 4000, bp intact).
Same-direction beams: nothing (hit needs both directions occupied).
Charge modulation: +q on the +dir channel AND -q on the -dir channel
suppresses repulsion to a common -1 drift; reversed or same-sign
charge leaves full +/-25. The induced force is the collision
congestion, charge-gated — exactly "a cascade tipping feedback
thresholds," and the first sustained coherent mover observed.

Signal latency: flight lands post-scan, so sustained burn duty-cycle
is ~50% — effective mediated rate 2|q|/tick vs pinned-charge 4|q|.

Collision-repulsion scaling: induced |p| = pk/2 linear (beam pk
10/25/50/100/200 -> |p| 5/13/25/50/145 symmetric both knots) —
graded radiation-pressure-like law, saturating above pk~100-200.
The vertex pushes adjacent matter AWAY at ~half the colliding
flux; momentum writes ~25 directly (not the drag >>8 share of the
conduit's +-1 residue — write path still being traced).

Write path dissected (moore26.c:1063-1086): odd cells scan their 6
face conduits for packet imbalance imb=packet[2e]-packet[2e+1] and
absorb n=|imb|>>1 quanta from the dominant channel — packets DEBITED
(conserved), nu->heat (ev52), momentum += sign*n. Radiation pressure
as ledger absorption: a body eats the field's directional surplus
and inherits its momentum + energy in one shot per quantum. The
collision vertex sprays packets outward; a knot absorbs the surplus
escaping past it -> pushed outward, symmetric both sides. |p|=pk/2
is imb>>1 read through directly; ~pk200 saturation = u8 packet cap.
Full cascade: collide -> storm -> spray -> imb -> absorb -> hop.

RETRACTION + RESOLUTION — the "charge selectivity" suppression:
the +/-1/-1 suppress signature was NOT charge physics. Byte-identical
grid diff (A+16 on ch6 vs B+16 on ch7: charge=+16 both, ZERO bytes
differ after 1 tick) proves per-channel chargeFlight provenance is
fully collapsed into scalar node charge at deposit — no consumer
reads route direction. The real discriminator: rand_site salts every
gate roll with the GLOBAL qTick, and moore26_init never reset it —
sequential inits in one process ran at different roll phases. The
ch6 arm roll rand_site(si,26)%16==0 fires at qTick in {1,17,57,60};
sweep arms landing on cumulative ticks {1-4} or {17-20} armed an
incipient whose CONFIRM (moore26.c:1980) writes momentum[3]-=1 on
the conduit -> drag shares -1 to both knots -> they hop 1 tick
BEFORE the +-25 imbalance drain lands -> big kick falls on vacated
origin cells -> reads as "-1 common drift". Suppress set {1,3,12,16}
maps exactly onto runs whose cumulative-qTick window contained 1
or 17. Charge value, sign, and channel: all irrelevant.
Fix (this commit): qTick=0 in moore26_init (init = fresh universe;
previously only moore26_clear reset it) and qTick captured by
save/restore. Post-fix all arms deterministic and charge-symmetric.
The one REAL charge asymmetry that survives: sign-selective burn —
A-16 erodes K1 64 mass (4|q|) at t=1, K2 at t=3 (burn scan reads
grid_current -> 1-tick deposit latency), A+16 nothing (same-sign
as bondPar=+20).

Granularity answer (measured): charge exists per-channel ONLY in
transit (chargeFlight[26]) and collapses to a node scalar on
deposit (moore26.c:817/848 sum cin[2e]+cin[2e+1]). The engine's
two directional-charge writers: pair production mints +/-q onto
OPPOSITE channels of the same axis (1456-1457 — a dipole leg
record) and launch sheds bondPar-signed charge onto the launch
channel (1411-1415 — handedness->charge in transit). Both erase
direction at the next landing. If "polarity as a planck-scale
force" wants a register, the existing directional registers are
packetPar/incipPar (per-channel parity) — charge never maps into
parity today; adding per-channel bound charge (charge[26]) or
preserving the flight dipole on deposit is the authored option,
but nothing measured requires it yet.

Momentum magnitude is dead state: relay hop is always 1 cell —
momentum read for SIGN only (QChannelVec pick at 1346/2466/2553)
and nonzero-ness (node_live:368, relay trigger). p=-1 and p=+/-25
both yield exactly 1 cell/tick. "Speed of nature" is currently a
binary: impulse!=0 -> full speed. |p| only matters via the drag
share (p>>8 to odd neighbors) and as hop fuel is never spent —
moving costs nothing (reservoir, no decay observed over 10 ticks).
Where the sign comes from: confirmed-offer momentum (1980 +-1),
decline-reflect recoil (1561/1646 +-2), imbalance drain (1063 +-n).
Coupling precedence measured: the +-1 confirm kick can preempt the
+-25 imbalance cascade by 1 tick — same conduit, competing writers,
order decided by rand_site phase, not magnitude.

MOMENTUM WRITER/READER MAP (coupling audit):

writers -> momentum[13]:
  1043  pair-production kick       +-kick on the two odd cells (ev55 side)
  1092  imb-drain                  +-n, n=|imb|>>1 — dominant force write,
                                   packet-supply limited (u8 cap => |d p|
                                   <= ~127/tick, matches the ~145-200
                                   measured saturation)
  1214  hop handoff                1:1 transfer, conserved relocation
  1305  conduit drag share         p>>8 -> live odd faces, donor-debited
  1561  decline-reflect recoil     +-2 on conduit (ev53)
  1756  tension/string kick        +-kick on odd pairs
  1980  confirm direction          +-1 on absorber, per transaction

readers:
  relay 1095-1104: argmax|p| axis + sign -> ONE channel hop; magnitude
      picks WHICH axis, never speed or distance
  liveness 368: nonzero keeps the record alive
  drag 1305: conduit p>>8 broadcast — a conduit needs |p|>=256 before
      its first quantum reaches matter (recoil +-2 is sub-quantization:
      128+ accumulated recoils before one share) — ev53 reservoir is
      effectively frozen on conduits unless a storm packs it
  launch dir 1346/2466/2553: sign only

counter-balances / rate-limiters (measured):
  * confirm +-1 vs imb +-25: the small write PREEMPTS the large one —
    the early hop walks the knot off the conduit face before the
    imbalance accumulates. Order beats magnitude (transaction layer
    eats the same packet reservoir the drain reads, 1 quantum at a
    time, and its timing is rand_site/qTick gated ~1/16).
  * arm consumes packets -> tips imb by +-1 per armed quantum -> the
    offer layer and the drain compete for the same reservoir.
  * reflect +-2 vs drag >>8: recoil accrues on the conduit but can't
    leak until it clears the 256 floor — two momentum registers with
    mismatched gain sharing one reservoir.

SPEED OF NATURE (measured, knot seeded p on odd site):
  p3=1 / 30 / 1000 -> IDENTICAL (+1,+1,0)/tick. Magnitude is dead
  state: hop is argmax-axis + sign, always 1 cell. p3=30+p0=20 ->
  identical to p3=30 alone: orthogonal momentum is inert cargo,
  carried whole by the handoff but producing zero displacement
  component. No decay path observed for odd-cell p (no drain other
  than handoff): preserving momentum is free; only force writes
  change it. So: moving matter costs ~0 (any p!=0 => full speed
  forever); creating matter costs the pair-production wall
  (dep>>5 mass, nu sum >= qFusionWall). The asymmetry the user
  predicted is structural: transport is enable-gated, creation is
  energy-gated.

VOLUMETRIC ROUTING (qVolRoute, moore26.c:1096-1121) — the hop axis
is drawn ~|p| per tick (rand_site salt 200), replacing argmax. The
momentum vector becomes the path DISTRIBUTION: the knot zigzags
through channel space and its centroid walks the composite vector —
the lattice version of a path integral over momentum components.
Single-axis p is untouched (one weight, always drawn) — full duel
regression identical.

measured (knot seeded p, 12 ticks):
  p3=20+p4=20  BASE: (+1,+1)/t forever (45deg off-vector, p4 dead)
                VOL:  net +x ~1 cell/t, y bounded +-2 (zigzag)
  p3=20+p4=-20 BASE: (+1,+1)/t
                VOL:  net +y ~1 cell/t, x zigzags (true composite!)
  wild two-axis collision (4 beams, axes 3+4 on C=(34,32,32)):
    knots induced p3=+-25 AND p4=+-25. BASE walked the axis-3
    diagonal (tie-break bias 45deg off-radial); VOL pushed
    radially outward (K1 net -x, K2 net +x, y canceling).

baseline defect this fixes: argmax-axis is a LINEAR router with a
systematic angular bias — equal components always break toward the
lower axis index. Force direction on the lattice was an artifact of
index order, not the field. VOL makes force direction read the
whole vector. Speed is still 1 hop/tick (each hop moves one cell —
the zigzag keeps net progress at ~c for axis-aligned composites).

caveat: the draw covers all 13 axes incl faces(0-2)/corners(9-12).
Face/corner p flips lattice parity -> lands on an even cell -> no
relay (odd-only) -> strand trap. Same trap exists in baseline when
face p dominates; natural force writers (imb drain, confirm,
reflect) only ever write edge axes 3-8, so wild dynamics never
draws a parity-breaking hop. Seeded face/corner p strands by
design, not accident.

Skagerstam 2018 (three-slit/Sorkin-kappa) cross-read: apparent
k!=0 three-path interference dissolves under properly normalized
boundary conditions — the same lesson as our phantom charge
selectivity (cumulative qTick = mismatched boundary conditions).
And the non-commuting position of helicity quanta is the continuum
analog of our argmax problem: a knot cannot resolve all momentum
components in one hop — the vol walk answers it the way path
integrals do, by sampling the components over time.

CONGESTION WALL = MOMENTUM PUMP (measured): incipient-armed
conduits seeded ahead of a walking knot don't stall it — the
confirms keep depositing -1 momentum on the conduit, drag pushes
it onto the knot, the sign flips and the knot RETREATS at full c.
v never dips below 1 hop/tick — sub-c motion exists only through
stall-gated ticks (incip>=qStallLoad blocks the hop that tick, no
deceleration ramp). "A wall" in this substrate is a reflector:
transaction density absorbs and re-emits momentum back at the
approaching body.

baseline-vs-VOL at the wall (p3=30+p4=20, wall on axis-3 only):
  BASE: first hop +diag hits the pump, momentum flips, argmax
        commits to surviving axis-4 -> clean slide along flank,
        exits at (47,18)/16t.
  VOL:  keeps drawing axis-3 at stale weight (~60%) -> re-engages
        the pump repeatedly -> wanders right-down, exits (37,18).
  The weighted draw is memoryless: it re-pays the block
  probability every tick. A spend-on-blocked or recency-weighted
  variant would fix it — deferred (p stays free today).

speed-of-nature structure, now fully mapped:
  v = 1 hop/tick whenever p!=0 and the drawn channel lands —
  enable-gated, magnitude-free. Sub-c = c*(1-stall fraction) only.
  Composite velocity under VOL = vector-sampled: centroid tracks
  the p-vector at ~c; baseline could not express non-axis
  directions at all (systematic argmax-tie bias to low index).

qBondShare (moore26.c:1102-1144) — momentum transmits through bonds.
Baseline defect measured: a bound pair (two mass cells sharing a
committed conduit) SHEARS instantly — p on one cell moves it at c,
the partner never moves. No rigid-body mechanics existed: momentum
was strictly per-cell.

the mechanic: an odd cell deposits momentum[e]>>qBondShare (from its
PRE-TICK reservoir — see caveat) through each face conduit that
carries a committed pair (max pair >= qCommitMin) to the partner odd
cell 2 steps along the face vector. Conserved, donor-debited. The
conduit-mediated alternative (deposit into conduit, let drag carry
it) fails on quantization: conduit->odd drag moves p>>8 — single
quanta can't cross a >>8 floor; the bond must carry the impulse.

measured (pair + chains, p3=40 on the head cell only):
  OFF:      head walks +diag at c, tail frozen — pure shear
  SH1, pair: both cells translate in lockstep at c, geometry held —
            FIRST coherent composite mover
  SH1, 4-chain: the impulse wavefront engages cells sequentially —
            exactly 1 bond/tick — a measurable internal sound speed.
            Tail starts moving ~N bonds after the head. At scale, a
            pushed body answers as a whole after ~L bonds of wave
            transit — center-of-mass impulse emerges from per-cell
            registers + bond transmission.

caveat fixed during dev: sourcing the share from grid_next let
deposits cascade A->B->C inside a single pass when scan order
aligned with the wave — superluminal impulse inside the body.
grid_current sourcing enforces the 1-bond/tick wavefront. Also
shift>=1 required (>>0 overdrew the reservoir on multi-bond cells).

scale note (user framing — energy = measurable displacement, not
substrate mechanics): the bond-share is the mechanism that makes
'force on a body' mean 'displacement of the body' at scales above
one cell. Without it, every force law measured so far is a
surface-cell property with no bulk interpretation.

## Composite coherence under vol routing — synchronized draws

Two experiments on a bound pair (winding-committed conduit, qBondShare=1,
composite p3=p4 seeded on the leader):

  site-salted draws (original): sep jumped 1->3 at t1 and held — the
    bond-share kept momentum flowing but each cell executed its own
    lottery, so separation became a bounded random walk (metastable
    doublet, slow sqrt(t) diffusion). Vol routing decohered the body.
  momentum+qTick hash: the draw now hashes the whole momentum VECTOR
    with the drumbeat — cells holding identical reservoirs at identical
    ticks draw identically, no site salt, no shared register needed.
    Pair: sep=1 for 12 ticks, parallel zigzag, coherent. A pure
    p-hash is insufficient: the reservoir survives the hop so the draw
    would repeat every tick — qTick supplies temporal variation.

  caveat measured: hash uses RAW values, so proportional-but-unequal
    reservoirs still decorrelate. The pair survives because bond-share
    equilibrates before the draw; a 4-chain shows ONE transient
    mis-draw at the wavefront tail (reservoir still unequilibrated),
    then re-locks — coherent jitter, not a tear. span held 3 for 8t.

Ordering bug found + fixed in the same pass: cells trading sites in one
tick (lockstep vol pair) let the departing cell's source-clear
(bondPar=0, bondDist[e]=0) clobber the arriver's just-written record —
the leader lost its handedness at t3. Clears are now mass-emptiness
guarded (grid_next[si].mass==0). Arithmetic handoffs (mass, winding,
momentum debits) were already safe — only blind clears needed guards.

Determinism: three fresh inits produce byte-identical pair trajectories
(qTick reset in init, draw is pure function of reservoir + tick).

## Composite bodies at scale — rigidity is load-pattern dependent

Cluster battery (vol routing + bond-share, seeded committed winding):

  2D plaquette, ALL cells pushed equally (p3=p4=40):
    PERFECT rigid translation — span (2,2) held 10 ticks, n=4
    throughout, coherent zigzag. Reservoir-synchronized draws make
    equal-reservoir cells step identically.

  3D cube, 2x2x2 = 8 cells / 12 bond conduits, all pushed:
    PERFECT rigid translation — span (2,2,2) held 8 ticks.

  2D plaquette, ONE CORNER pushed (torque load):
    translates (centroid +1x/tick) but deforms — span wobbles to (2,4);
    at t8 two cells drew onto the same site and MERGED (m=8000 on one
    cell, n=4->3). Corner push -> shear -> occasional collision merge.

  2D plaquette, LEFT EDGE pushed (2 of 4 cells):
    progressive shear — span_y grows 3->5->7->9->11 as the pushed
    column outruns the trailing column; body stays connected (n=4,
    bonds hold) but geometry degrades into a skewed streak.

  => the composite's shear modulus is ~0: rigidity exists ONLY via
  momentum-reservoir equilibration, which carries no geometric
  constraint. Symmetric loads translate; asymmetric loads deform and
  can merge cells. "Force on a body" at scale now has three measured
  regimes: rigid translation / coherent jitter (wavefront) / shear-
  deformation with merge risk — all from per-cell registers + bond
  transmission, no authored body frame.

## Bond provenance — what the share reads and who writes it

  qBondShare transmits through a face conduit whose committed pair
  min(winding[2e],winding[2e+1]) >= qCommitMin (default 32).
  winding[c] is the worn-lane record: +1 written on the cell a packet
  ARRIVES at during transit (measured: seeded w6=5 -> 6 after one
  transiting hop; seeded-at-source accrues 0 because wear lands on
  the destination). A sustained 60-pk/tick beam wrote w6 ~70/40t.
  => authentic bond formation = counter-propagating traffic over the
  conduit for ~25 ticks; seeded winding is register-equivalent.
  NOTE: packets seeded adjacent to mass were drained by the knot
  before transit (imbalance drain beats the worn-lane write) — the
  beam needs to arrive from upstream, not sit on the bond conduit.

## Endogenous force — self-kick works, free-space radiation doesn't

Hot-conduit emission vs a bare neighbor (vac_rate=1, heat=60000):

  emitter on the knot's OWN face conduit: the knot gets kicked
  reliably — first momentum write ~t10, then walks at c. Direction =
  whichever axis the first surplus lands on (edge-channel quantized,
  not radial). (31,32,32) beside hot (32,32,32): walked (0,-1,+1).
  Hot (30,32,32): walked (-1,+1,0). Hot (31,32,31): (-1,0,-1).
  => endogenous force confirmed at contact range.

  emitter 4 conduits from B (37,32,32), 200 ticks, heat 60000->118:
  ZERO packets reached B's face conduit, ZERO momentum on B. Packet
  population saturates ~16 (emission ~1/t vs decay) as a dilute
  random-walk spray — isotropic minting onto 12 edge channels can't
  form a directional surplus at range. A lone packet needs 2+ surplus
  on one channel to write one momentum quantum (imb>>1).

  => "radiation pressure" is not a range force in this substrate:
  channeled transport + density-tax decay kills isotropic flux within
  ~2 hops. Force at range exists ONLY along established worn lanes —
  the collision-duel beams delivered +-25 imbalance because flux
  travels the rail, not free space. The substrate's field lines are
  literally the carved channels — a knot sprays nothing coherently
  unless a lane already guides it.

  caveat: emitted packets carry nu capped at 255 and packetBorn parity
  of the source's lane sign; none of that helped coherence at range.

## Tension mechanics — a medium-anchored potential well, not a spring

Live-traffic test (diagonal pair A=(31,32,32) B=(32,33,32), shared
conduit (31,33,32) carrying ch8 offers, qTension=16 = k1):

  machinery confirmed live: offers confirm downstream, acks ride back
  on the opposite channel (ev14 climbing), ttl expiry delivers
  reach=rtt>>1, dd=reach-bondDist kicks the two "bend cells" flanking
  the conduit (ev54). Kick magnitude = dd*qTension>>4, funded by
  strainBank (elastic ledger, ev56/57).

  HOLD: with only ambient drain pushes, the pair held its bend sites
  80 ticks, ev54=22 — the tension well cancels arriving transport
  kicks, ~0.2 momentum/tick of restoring authority.

  BREAK: sustained +1 momentum per 4 ticks on B's escape axis -> free
  at t=2, gone forever. The kick writes to the conduit's bend
  POSITIONS (conduit+o1/o2); a hopped-off cell leaves a ghost site
  that keeps absorbing kicks. Recovery of a departed cell is
  IMPOSSIBLE — the bond has no reach beyond the lattice sites it
  bends through, and the strain measure (rtt) is conduit-link
  latency, lattice-fixed, blind to where the mass went.

  => the tension bond is BRITTLE: holds quiescent mass at the
  conduit, resists jitter, breaks irreversibly at first committed
  displacement. NOT a spring — no elastic recovery exists anywhere
  in the engine.

  vacuum framing (user note — tuning for zero-g, gravitic gradient
  unknown at this scale): the position-anchored kick is a
  MEDIUM-anchored potential — force toward fixed lattice positions
  regardless of which body occupies them. That is the closest
  existing analog to an external gradient in the substrate: the
  conduit+traffic makes a local potential well in the medium itself.
  A body-internal restoring force (shear modulus >0) would need the
  bond record to ride with the mass — odd-cell bondDist already
  travels with handoffs and is read by the align gate, so the
  provenance path exists; nothing currently converts it to a kick.

## Self-carved wells + the confinement law

(a) SELF-CARVED GRAVITY — the knot's own activity deepens the medium's
grip. Two measurements:

  worn vs fresh bond conduit (w=400 vs 0, same traffic/pair):
    fresh: 10 acks / 7 kicks in 80t; worn: 81 acks / 19 kicks —
    8x transaction rate, ~2.7x kick authority. The worn lane carries
    more offers -> more confirms -> more returning acks -> more
    restoring authority. The well's depth IS its traffic.

  self-carving loop: 4 hot face-conduits around a knot emit for 60t ->
    their own transit writes wear on the knot's face-conduit network:
    winding total 402->1865, 55 channels worn. The knot literally
    carves the lanes that hold it — sustained activity deepens the
    medium's grip on itself. Gravity-analog: matter paving its own
    potential well, no authored field.

  BUT depth doesn't fix brittleness: worn and fresh wells break at
  identical escT under momentum injection (+1/4t, +1/8t, +1/12t) —
  position-anchored kicks can't recover a departed cell at any rate.

(b) qString CONFINEMENT — the second potential, isolated properly
  (controls persist across init! tension_set(0)/string_set(0) needed —
  same harness-pollution class as qTick):

  OFF (no potential): the pair drifts under ambient drain pushes —
    A even stranded onto the even-parity conduit site (31,33,32) —
    parity-breaking hop, face/corner caveat live in the wild.
  S16 slack=1: 34 string-kick writes (~17 events x 2 bend cells),
    pair held at well. T16: 16 kicks, same hold.
  => string gives ~2x kick rate vs dd-scaled tension on reach~1-3
    traffic: constant-force confinement while reach>slack. Kicks are
    still strainBank-funded and position-anchored — same brittleness.

  reach semantics: rtt counts offer TIME (birth->confirm), not just
  distance — congestion-delayed confirms inflate reach, reading as
  stretch. A busy bond literally pulls harder — the well tightens
  under load (physically sensible coupling: crowding = strain).

  synthesis: two potentials now measured — harmonic (tension, dd-
  proportional) and confinement (string, constant over slack), both
  real, funded, and brittle. The well = transaction traffic at a
  conduit pulling flanking mass to its bend sites; "force" at this
  scale is carved-lane potential, not body-to-body spring.

## The momentum trail is the medium's recoil ledger — and it's minted

Followed the ~1/hop "leak" to ground. Mechanism chain:

  knot hops -> the crossed face conduit books incip[2*be]++ (line
  ~1280: "the EVEN CONDUIT records the clearing") -> next tick it
  confirms -> the confirm writes momentum[c>>1] +/-1 on the conduit
  (line ~2083, "an offer absorbed into structure pushes it the way
  the packet was travelling").

  measured: knot p=256 walks 12 hops with ALL 256 intact; each crossed
  conduit holds exactly -1 (opposite the knot's travel — even channel
  -> -1, odd -> +1 = recoil convention) forever after. One quantum
  minted per hop, one per conduit, ZERO debit anywhere.

  => mass transit writes a recoil ledger into the medium — the
  substrate books the knot's passage direction in every conduit it
  crosses. Currently UNFUNDED: total system momentum changes by -1
  per hop with no payer. Either a conservation hole, or the seed of
  the "expense of acceleration": if the transit debited the knot,
  sustained motion would cost ~1 p/hop — the medium would tax
  traversal, and a reservoir would have real range (~p hops before
  stall). Motion is currently free; the recoil record exists but
  charges no one.

  side-effect of the trail: -1 conduit momentum feeds field-drag
  (p>>8 -> sub-quantum, never reaches matter), backpressure reads —
  the wake is mostly inert bookkeeping today, but it IS a real
  medium memory of transit direction.

## History trace — the antipodal sign is deliberate; the mint isn't

git archaeology on the momentum-write convention:

  dbe29a6 (momentum[13] birth, "Newton-1 register"): the c&1?++:--
  antipodal write existed from day one, applied identically to
  absorb-confirms and launch recoils. Design rule stated there:
  "moving costs no momentum, only forces change it."

  73ef092 (statistical gravity): the sign was confirmed DELIBERATE —
  "the transaction pull is upstream; radiation pressure was
  attraction-to-source mislabeled." Le Sage pull-universe: absorbing
  flux marks a node to drift TOWARD the source. The -1 convention
  is the gravity mechanic, not an inversion.

  276f7af (precedent): flux-drag broadcast minted momentum -> fixed
  by donor debit. House rule: momentum writes must be funded.

  => two force conventions coexist TODAY by design:
     imbalance drain (imb>>1, ~+-25): pushes DOWNSTREAM with the
       stream — Newtonian radiation pressure, funded by consumed
       packets. Dominates collisions (duel repulsion).
     confirm kick (+-1): pulls UPSTREAM against the arrival —
       Le Sage pull-to-source. Unfunded (minted).
  And the knot's transit trail (conduit -1/hop) reads coherently
  under pull-universe semantics: "pulled toward where the knot was"
  = an attractor wake trailing the mover.

  SELF-PROPULSION already exists under this convention: the launch
  bleeds trailing-edge mass forward and writes "pulled toward the
  exhaust" — the knot follows its own wake (cf. link3's LRECOIL:
  funded antipodal emission kick — same physics, opposite sign map).

  OPEN — the funding gap: confirm kick, trail recoil, and launch
  recoil write are all minted. Funding the trail debit from the
  hopping knot would make motion cost ~1 p/hop through the medium:
  inertia as transit tax — the measurable "expense of acceleration".
  Under pull-universe sign the knot LOSES forward p paying its
  wake = deceleration through medium interaction. Prototype
  candidate: qRecoilLaw control (0=current minted trail,
  1=funded trail debit).

## The confirm-kick species map (a56afc8 follow-on, measured)

The flat ±1 confirm kick was traced to its full gating chain
(moore26.c ~1936-2084). `qEvents[3]` counts *standing-offer scans*
(h = incip count per channel), not confirms — a diagnostic trap.

### What a transaction must pass to produce force

1. **On-shell spectral gate**: `nu % line == 0 && nu >= line` where
   `line = (mass + winding[c]>>2) >> 2`. Off-shell offers STAND —
   they influence (incipient state) without depositing.
2. **Boundary-selective confirm** (qMomentum): the offer lands only
   where its channel exits into bare space. Interior offers re-emit
   and keep flying — the beam paves its lane and the force lands at
   the *receding front*, not mid-lane. Measured: seeded conduit at
   (32,32,32) took zero kicks; ±1 quanta landed at x=33..53+ along
   the beam axis — a moving surface-pressure boundary.
3. **Confirm cap**: nu > 160 (qConfirmCap) never confirms — heavy
   quanta stand, expire, re-emit. Absorption has a bandwidth.

### Species conflation, demonstrated

| species | nu | result |
|---|---|---|
| hop bookkeeping record | 0 (reads as 1) | confirms on bare lanes (line=1), kicks −1 minted — THE TRAIL |
| packet offer on-shell | ≤160 | kicks ±1 flat, minted — NOT nu-weighted |
| packet offer over-cap | >160 | never confirms — no force at all |
| imbalance drain (odd eats conduit pkts) | funded by eaten packet | ±1 per packet, DOWNSTREAM sign (Newtonian push) |

Full-grid audit: nu=10 beam vs nu=160 beam → identical |p| totals
(4 vs 5 over 211-212 confirms). The kick is a flat unit per
transaction regardless of the offer's energy — force ∝ absorption
*rate*, not power. The sign asymmetry drain(downstream)/kick(upstream)
is the two conventions coexisting — both deliberate per 73ef092.

### The trail is fresh-medium only — measured

Hop record nu=1: confirms on bare conduit (line=1) → −1 trail.
On a worn lane (winding 200 → line=12) the record fails on-shell,
stands, expires — **zero trail written**. Established lanes are
silent to motion bookkeeping: the medium stops recording recoil
for hops across carved paths. The wake exists only in virgin
medium — persistent currents do not accumulate counter-flow
records on their own lanes.

### Where this leaves qRecoilLaw

The conflation is narrower than feared: the force write is one
flat quantum per confirm, gated by nu but not scaled by it. A
nu-weighted funded kick would (a) make photon pressure ∝ absorbed
energy, (b) leave hop records (nu=0→1) kicking ~nothing on bare
lanes — the trail thins naturally, (c) keep the pull-universe sign
intact. The "expense of acceleration" already exists structurally:
interior transit is force-free; only boundary landings produce
force — motion is free, landing is the transaction.

## Boundary taxonomy + the charge/transit null (4caf5b9 follow-on)

### The substrate's boundary species (enumerated)

The confirm/decline stack distinguishes SEVEN distinct boundaries,
each a different species of "where a state-change may land":

1. **Infrastructure edge** — committed-winding forward test; the
   kick books at the receding beam front (measured, 4caf5b9).
2. **Mass surface** — the odd-cell drain; separate writer, opposite
   (downstream/Newtonian) sign, funded by eaten packets.
3. **Spectral** — `nu % line` on-shell gate; a boundary in energy
   space, not position.
4. **Parity/identity** — qParGate handedness mismatch; declines
   ANSWER with counter-parity recoil flight upstream.
5. **Phase** — qMergeGate: offer's arrival phase (nu*age mod 256)
   vs standing cloud; anti-phase thermalizes. The quantum carries
   its own clock — arrival phase is frozen into incipOp.
6. **Bandwidth** — qConfirmCap; over-cap quanta never land.
7. **Congestion wall** — saturation decline → qDeflectAlign tangent
   routing (60-degree forward neighbors), nu conserved — a
   work-free redirect, the magnetic-shaped mechanism.

### Charge probe: NULL — no transit-acting force exists

Experiment: parity-tagged ch6 beam through a charged conduit patch
(±40), three arms (uncharged / same-sign / opp-sign), qDeflectAlign
on. Results: identical downstream in all arms; ev45 same-sign
declines = 0 even with 25 pkts/tick on a committed-winding conduit.

Mechanism: charge enters ONLY the offer-capacity gate
(`cap = qCapBase − |q|>>shift`, or qCapSame for same-sign parity).
Declines require `armed >= cap` — an incipient PILEUP. Transiting
packets arm at ~1/16 catch and confirm/expire faster than they
accumulate; the cap is unreachable at any beam density we produced.
Charge is an absorption-permission register — it modulates WHO MAY
LAND, never who passes through. It also sheds (40→23 over 60t via
qChargeShed mobility on winding routes).

### Consequence: no magnetism, by construction

A moving charged knot's hop-channel selection reads momentum only —
charge never enters. No mechanism anywhere reads a passing quantum
and redirects it. Every force in the substrate is a transaction-
event force; there is no transit-acting coupling. The principle the
mechanics keep converging on: **state-change is priced, persistence
is free** — free along lanes, free in internal circulation, priced
at landings/emissions, direction-priced at deflection declines,
never priced mid-flight. Gravity then = rate asymmetry of
absorption events (needs shielding scale — statistical, matching
the scale-only framing). The lone exception is still the minted
nu=1 hop-trail kick on virgin lanes — a bookkeeping record
inheriting the offer force path.

## qRecoilLaw prototype — species-aware funded impulse (measured)

**The violation it fixes:** the hop ledger record (`incip++` on the
crossed conduit) flowed through the OFFER confirm machinery — a
bookkeeping entry (no nu, no parity, no phase) inherited the offer's
force write, minting −1/hop momentum on virgin lanes (on-shell
nu=1 vs line=1) and minting h*1 expiry heat on worn lanes. Paperwork
was being processed as if it were an energy-bearing offer.

**Implementation (moore26.c):**
- Hop write: fresh record on an empty channel zeroes stale incipNu —
  `incipNu==0` becomes the bookkeeping signature (real offers always
  carry nu>=1). Merging into a standing offer leaves the offer's nu
  in charge — self-healing, no flag bit needed.
- Confirm path: `incipNu==0` channels clear `incip-=h` before all
  gates — no on-shell test, no boundary test, no kick, no ack, no
  expiry thermalization. The ledger sees every crossing; paperwork
  is not an interaction.
- Real offers: `kick = nu>>qRecoilLaw` (N=0..7), DEBITED from the
  structure deposit — `nuIn = nu-kick` feeds winding/charge/route
  deposits. The absorbed energy splits between impulse and record
  instead of minting both. nu < 2^N lands softly (kick=0).
- Pull-universe sign preserved (even c -> -, odd c -> +).
- Setter: `moore26_recoil_law_set(0..7)`.

**Measured verification:**
| arm | result |
|---|---|
| trail, law=0 | trail=1 (baseline preserved) |
| trail, law=4 | trail=0 — bare-lane minted kick gone |
| kick, law=0 | p3=-1 flat |
| kick, law=4 | p3=-6 = -(96>>4) — nu-scaled, p=E/c |
| funding | pair winding +97 vs +92 — deposit drops by the kick |
| worn lane | standing=0 both; heat 27 vs 26 — expiry mint stopped |

**Noted in passing (pre-existing quirks, not introduced):**
- The over-cap else path ("arrival edge full") deposits nu into
  internal edges WITHOUT consuming the offer — standing offers
  re-deposit each tick until TTL expiry. Saturating charge absorbs
  it in practice. A repeat-mint worth revisiting.
- `massFlight[c]+=1` per confirm mints a flight quantum on the
  arrival channel — the Newtonian-sign counterpart of the kick,
  also flat and unfunded.
- `incipBorn` is not set by hop records; legacy bookkeeping confirms
  minted acks with garbage rtt into the strain path. Under the law
  they no longer do — tension/string lose the hop-transit stimulus.

## qRecoilLaw round 2 — internal-landing force + funded photoevaporation

**Internal-route mint closed (measured):** over-cap offers (mA+nu>160)
previously re-deposited nu every tick without consuming — a runaway
mint (~+800/tick into winding, overflow into saturating charge, zero
force). Under the law the internally-routed offer now LANDS: consumed,
kick=nu>>N books on the arrival axis, deposit gets nuIn. Measured:
law=0 w=8175/incip=7/p3=0/charge=1576 vs law=4 w=3307/incip=1/
p3=-48 (8 landings x -6)/charge=0. Nature check: absorbed quanta
deposit momentum regardless of which mode the energy lands in —
force books at the absorption EVENT, not the edge.

**Funded photoevaporation (measured):** massFlight[c]+=1 per confirm
was minted mass. Under the law the ejected quantum is the node's own
mass — mass-- funds the flight write, massless nodes can't be pushed.
Verified: knot mass 64->63 on one confirm (kick -6 for nu=108),
legacy kept 64 + free flight. Local reading: radiation-driven mass
transport (comet tail). Statistical reading: downwind flux replaced
by slow massive quantum = shadow = shielding — ONE mechanism serving
the direct force and the macro attenuation.

**Spectral impedance discovered (measured):** the on-shell gate
line=(mass+winding>>2)>>2 means a mass node's absorption bandwidth
scales with its mass — mass=1000 -> line~252 > incipNu max 127 ->
ordinary quanta can NEVER land. Heavy structure is a reflector,
light structure an absorber. Absorption impedance ~ mass — a real
result: inertia and spectral rejection share the same register.

**Boundary answer updated:** internally-routed landings DO produce
force now — momentum books at the absorption event regardless of
which edge receives the energy. Consistent with the principle:
state-change priced, persistence free — a landing is a state-change
wherever the energy settles.

## qRecoilLaw round 3 — funded launch, topographic wake, coast preserved

**The real propulsion mode discovered:** a knot with momentum doesn't
rocket — it DISSOLVES. Measured: mass=4000 knot fully disassembled
into massFlight over ~3 ticks, the wave flew +x at transport speed,
re-condensed at x=61 with m=4000, p=256 intact. Self-propulsion is
teleport-by-dissolution: bleed the trailing edge forward, land,
reconstitute. The exhaust carries implicit momentum (mass at flight
speed) which re-deposits on landing.

**Funded launch (measured):** launch debits the emitter's own drive
— pay=min(k,|p|) on the launch axis, exhaust carries implicit
momentum, landing re-deposits. Recondensed knot identical under
both laws (conservation through the wave now consistent).
Shortfall when |p|<k documented — can't spend drive it lacks.

**Topographic wake (measured):** under the law, each hop writes
winding+1 on the crossed conduit's transit-direction member — the
medium records WHERE it was crossed, in the direction of travel.
60-tick coast: 31 worn channels vs legacy's 5 ghost -p cells.
The knot carves a real rail through virgin medium — first crossing
paves, followers ride the worn lane, and wear feeds commit/bond
gates so the rail is live infrastructure, not inert bookkeeping.

**Newton-1 preserved:** trajectories identical across laws
(31->62 in 60t) — the silenced trail changed nothing about the
knot's motion, confirming the old trail was inert bookkeeping.
Free persistence, priced landings, paid propulsion — the ledger
is now closed on all measured paths.

## qRecoilLaw follow-ups — rail reuse, shortfall, beam shielding (measured)

### Rail reuse: knot-speed NULL, flux selectivity POSITIVE

Pre-worn lane vs virgin lane, same knot fixture:
- knot trajectory IDENTICAL at every sampled tick (x=36..61 over
  30t) — worn medium does not change the mass hop rate.
- beam flux through worn lane: 80 alive / 10 reached x>=55 vs
  virgin lane 270 / 37 — a 3.4x attenuation. The worn lane's
  spectral line (winding>>2) rejects off-shell nu=140 traffic:
  carved rails are SELECTIVE WAVEGUIDES — tuned by their own
  wear history, transmitting resonant nu and thermalizing the rest.
- This is the 'warm routing' feedback made literal: transit wears
  topography, topography filters later transit by energy spectrum.
  Knots pave but don't (yet) ride their own rail differently —
  the selectivity acts on FLUX, not on the knot's hop gate.

### Launch shortfall: unreachable under current gates (honest negative)

- p3=8 knot: no launch — the dd>=32 directedness gate rejects it
  before the funding path runs. p and trajectory identical to a
  p=256 knot that launches normally.
- p-driven launches are self-funding BY CONSTRUCTION: k~p>>2 < p
  always, so the emitter can never be short on the axis it fires.
- The p=0 winding-driven launch path is unreachable: the hop
  block's be<0 continue skips the launch phase entirely.
- Conclusion: the bounded debit (pay=min(k,|p|)) is correct
  conservation armor but never binds — either the winding-driven
  launch needs a reachable gate, or the shortfall is vacuous.

### Beam shielding: shadow + radiation sailing + flux-driven merger

Setup: ch6 (+x,+y) beam, nu=140 (under qConfirmCap), knot = mass
4000 odd cell adjacent to the lane (face conduit on the path).
- Single knot: ~6% integrated attenuation downstream (203 vs 217)
  AND the knot gains funded momentum (net p=11) then SURFS — rides
  downwind at ~1 cell/tick along the beam direction, coherent,
  mass exactly 4000. Radiation-pressure sailing: flux sweeps
  matter at the beam's own hop speed.
- Two knots in series (A upstream, B 19 cells downstream): B sits
  in A's wake — the beam front never passes A (A rides the front),
  so B is FULLY shadowed and stays parked until A sweeps into it;
  they merge (m=8000) and the merged body keeps surfing to the
  wall. Identical under law0 and law4; law4 holds total mass at
  exactly 4000/8000 while law0 drifted +7 (minted trail-mass).
- Le Sage reading: directional flux yields a SWEEP, not
  attraction — a shadowing body is pushed into what it shadows.
  The same per-quantum mechanic in an ISOTROPIC bath is mutual
  shadowing -> net inward drift -> the mechanism Le Sage
  conjectured, now funded per-quantum with no authored attraction.

### Correction to round-3 interpretation

The 'dissolve and re-condense' reading was a scan-window artifact:
a narrow x/y box missed the diagonal (+x,+y) walk. Full-grid
tracking shows the knot WALKS intact at ~1 cell/tick, mass fixed
at 4000 throughout — relocation, not teleport-by-dissolution.
Propulsion = persistent directional hopping; the funded launch
debit still applies per hop, and law4 closes the residual mass
mint that law0 carried (+5..7 over 30-60t).

## qWearDecay + the flame hunt — medium-forgetting, rail runaway, mass precipitation

### qWearDecay: the forgetting medium (implemented, measured)

New control: conduit winding loses w>>N per tick — exponential above
2^N, stochastic full-fade below (rails truly vanish, not just thin).
Even cells only — the transport graph forgets; odd-cell structure
winding is untouched. Being keeps its memory; the medium doesn't.

Carved-rail decay curves (measured):
- N=0: rail holds 19/19 forever (baseline — permanent memory)
- N=8: 18 -> 13 -> 6 -> 5 -> 3 -> 2 over 400t (stochastic regime)
- N=6: 14 -> 4 -> 0 over 160t
- N=4: 6 -> 0 within 80t (decay visible even during carving)

### Rail runaway — warm routing has no equilibrium without forgetting

The deep discovery: sustained probe traffic keeps DEPOSITING wear —
a saturated rail under continued flux grows monotonically
(989 -> 6421 over ~600t at N=0) and stays fully opaque (thru=0).
Wear is positive feedback: traffic wears, wear captures, the
spectral line rises until the lane becomes a reflector. Rails do
not stabilize — they clog to death.

With decay on (N=6) the same lane grew only 989 -> 1745 — decay
retards ~7x but loses the race under load: the fixed point
W* = 2^N x deposit_rate sits far above the opacity threshold.
Forgetting wins only when traffic stops. Vacuum memory is
crystalline under load, diffusive in quiet — the warm-routing
gravity analog inherits this asymmetry: maintained lanes harden,
abandoned lanes heal.

### The flame hunt — what a 'living' structure would require

Piloted: knot fed by counter-propagating beams (pinned against
surfing) at rates 4/16/60, mass tax probes. Findings:

- Fed knots SURF or disperse before reaching feed equilibrium —
  a directional beam cannot produce a standing flame; the knot
  rides it. Pinning needs multi-directional flux.
- The beam-COLLISION SITE is the persistent transaction locus:
  heat accumulates at the crossing (192/1056/5744+ by rate) —
  the substrate's flame is a place, not a knot.
- rate=60 drove site heat to the 65535 cap, then ~66000 MASS
  appeared — superheat precipitation: energy pumped past the heat
  ceiling condenses into structure. Needs characterization.
- Odd-cell heat is immortal: ev44 drain and ev51 re-emission live
  in the even-cell phase, so structural (odd-cell) heat never
  drains — a permanent thermal fossil at the transaction site.
  (Not a ledger bug — node_live counts heat — but a real species
  asymmetry: conduit heat cools, structural heat is frozen record.)
- The mass tax (qEvapShift) does NOT apply to bare mass — it only
  runs inside the composite-shed path (guarded by the shedding
  machinery). Single-site mass blobs are exempt: measured mass=4000
  at shift=3 over 300t — exact zero decay. INERT MASS IS IMMORTAL;
  ONLY ORGANIZED STRUCTURE PAYS THE HOLDING TAX. The flame needs
  a wound composite knot (dictionary seed), not a blob — that's
  the correct next fixture.
- Accretion confirmed in passing: fed blobs grew 500->626 and
  4000->4066 via shed-condensation (the mass:bond equilibrator),
  then plateaued.

## The flame exists (script/cascade/flame.mjs) + twin-paradox negative

### Twin paradox: structurally impossible — beings don't carry clocks

localTime is site-bound: the medium owns time, not the being.
Measured: a knot hopping EVERY TICK (1 cell/tick = c!) lands each
site's tau at exactly 32 — full qWorkCap rate, identical to a
parked twin. The hop writes no txnWork on the being's own node —
relocation costs the clock nothing. So:

- no motion dilation: v_being can equal v_flux = c at full tau
- no comoving clock: a knot's 'proper time' is written into its
  trail — the medium's record of the being, not the being's own
  accumulator. The trail sum IS the being's total elapsed tau.
- the clock law is dTau ~ (cap - work): congestion taxes tau
  (prior: 22x divergence under targeted congestion), velocity
  doesn't. Neo-Lorentzian flavor: motion vs the medium is
  absolute, and it is time-free.

### Flame: maintenance-dependent persistence measured

Fixture: wound composite (mass=500 + committed winding pair
6/7=200 -> site_level=2, shedding-capable), 12-direction
isotropic edge bath, qEvapShift=3 (mass tax on shed events).

| rate | M trajectory | regime |
| 0  | 500 -> 89 asymptotic | extinction: de-excites to remnant |
| 4  | fluctuating 870-1480 | marginal burn |
| 16 | 500 -> 1890 plateau  | clean burn: feed-rate-dependent |
| 60 | heat pinned 65535 -> crashes ~5000, M -> ~1630 | superheat precipitation |

- IGNITION exists: wound knots need shed-capable structure
  (site_level>=2). Bare blobs can't burn at all — exempt.
- EXTINCTION = de-excitation, not annihilation: the unfed wound
  knot relaxes to a quiescent ~89 remnant and FREEZES — the mass
  tax only fires during shed events, so a fully relaxed remnant
  is untaxed. Mass survives; the process dies. The corpse keeps
  the mass and loses the closure — activity is what costs.
- STEADY STATE: mass plateau rises with feed rate (~1050 @ r=4,
  ~1890 @ r=16) — feed-rate-dependent sustained structure.
- BLOWOUT'S ANALOG IS CONDENSATION — overdriving precipitates
  mass instead of dispersing it (heat-cap conversion again).

So the substrate's ontology DOES contain the third persistence
regime: not immortal (bare mass) and not mortal-by-collision,
but conditional-on-throughput — and its death is de-excitation
to an inert remnant, matching the closure-graph picture where
dying = vertices demoting from 'both' to 'came-from'.

## Dilation exists (internal work), structure can't move, Le Sage scale bound

### Clock dilation via internal economy — measured, small

Parked wound knot (mass=500 + committed pair, site_level=2,
shedding): tau ~31.85/tick vs bare control 32.0/tick — its own
shed-cycle work taxes its clock ~0.5%. The clock law
dTau ~ (cap - work) verified with INTERNAL load, not just
congestion.

### STRUCTURE CANNOT MOVE — beings travel bare

The moving wound knot hopped with winding=0 at every site: the
wound structure stayed behind at the origin site. Mass relocates
via flight; committed winding is site-bound and cannot follow.
So there is no 'moving wound knot' — motion STRIPS the wound
state, which is the only state that was taxing the clock. Deep
result: the substrate's mobility hierarchy is inverted vs naive
expectation — bare mass is maximally mobile (v=c, full tau),
structured being is site-anchored. To carry structure you'd need
to transport the wound bonds themselves — the knot as *pattern*
is immobile even when the knot as *mass* walks.

### Le Sage two-knot fog — shadow real but below drift threshold

- nobath control: both knots frozen at dx=10 for 400t — zero
  vacuum interaction. Clean null.
- isotropic fog (3-4 pk/channel/tick): knots random-walk via
  absorbed kicks; solo knot left the region by t39 while the
  paired A stayed parked 400t under identical fog draws —
  suggestive mutual stabilization, not proven (chaos).
- corridor flux: shadow corridor 10 vs control 7 (knots) —
  no depletion vs baseline 9 vs 4. The mutual shadow is real
  per-quantum (6% in directed beam) but ~100x diluted in
  isotropic flux at 1-node cross-section: below noise at
  400t integration.
- SCALE BOUND (honest): single-body shadow-gravity is real but
  negligible — it needs many bodies or long integration. Gravity
  as statistical shadowing is inherently a weak-coupling effect,
  consistent with why it only shows up at macroscopic scale.

## Federated transport — formation flying is not binding; flight writes nothing

### Two-core wound pair, orthogonal kick (cohesion fixture, feed cut at kick)

A(13,16,16)+B(19,22,16), 5-cell saturated filament (winding 128
bidirectional ch6/7) between them, bond warmed 80t, feed CUT, then
both cores kicked +300 on pair 4 = (1,-1,0), ORTHOGONAL to the bond
axis so translation can't drive them together:

- Both cores translated in lockstep: (x+y) separation held exactly
  12.0 the entire flight, mass 512 each, stall at ~16 hops when the
  kick was spent.
- Old filament: 1280 winding intact — the ENTIRE tube stayed behind
  as a fossil scar.
- Destination: inter-knot winding = 0, knot self-winding = 0 — the
  masses arrived completely bare and never re-bonded.

Formation flying is ballistic coincidence, not binding: two masses
with identical momentum keep formation because they hop identically.
The bond never tried to follow — the masses ripped off it and it
sat. Even a multi-cell wound structure is site-bound: every vertex
anchored, so the whole graph anchored.

### Coaxial kick failure mode (control datum)

Kicking both +300 on the bond axis itself drove A into B: fused to
a single m=1000 walking knot (then feed buried it at 66k). Adjacent
bound cells merge on contact — a 1-cell knot is the only 'portable'
composite, and it carries no wound structure anyway.

### Bare flight is ontologically SILENT — the worldline is not written

Probed the pair's flight path (~17 sites along (1,-1,0)):
- flight-channel winding = 0, all-channel winding = 0
- localTime along the path = 0

Contrast: PACKET flight writes rail-winding (offers/confirms/acks
transact, the medium remembers). MASS flight transacts nothing — a
bare register move — so it deposits zero structure and zero history,
and once the mass leaves, the nodes die and even the transient tau
record erases.

SHARPENED LAW: structure is TRANSACTION-bound, not merely
site-bound. A wound knot is a set of closed transaction loops at
specific addresses — it can't move because relocation transacts
nothing, so nothing of it persists en route. A mobile being in this
ontology would have to transact WHILE flying: a fed knot carving
its rail in real time, structure as a continuously re-written
wake — pattern propagation, not pattern transport.

## Soliton probe — the comet regime: deep wake, bare knot (CORRECTION)

### Correction to "bare flight writes nothing"

The hop-trail wear IS real — it lands on the EVEN conduit cell
crossed in each hop (`winding[ch]+1` per transit, qRecoilLaw
branch), one cell off the odd flight path. The earlier probe
scanned the odd sublattice only and read 0. Verified directly:
each of a kicked knot's conduit crossings reads w8=1. So bare
flight writes a THIN topographic scar (+1/conduit, uncommitted)
on the exchange sublattice — still no tau, no committed body.

### Chase-fed in-flight knot — wake deepens ~200x but never leads

Bare knot, pair-3 kick, packets seeded on its 4 even face-neighbors
EVERY tick (transacting while flying), 80t:
- trail: 3465 total winding over 181 channels, max=97/ch — the
  wake approaches the commit threshold (128) as a deep rail.
- knot's own cells: winding=0 at every sampled site including
  mid-flight. Chase-feed never winds the knot itself.

THE COMET REGIME: a transacting-in-flight knot carves a live,
near-committed wake but remains bare — structure trails, never
leads. The knot's own winding can't grow because winding forms
only between PERSISTENT transaction partners (bonds/confirms need
repeated interaction at stable addresses), and a knot at 1
hop/tick gives every conduit exactly one crossing.

SPEED-STRUCTURE EXCLUSION (measured): commitment needs ~128
transactions at a stable address; c-flight offers 1. A knot can
only grow a body where it dwells — mobility and structuredness
trade against each other as a law of the medium, not a tuning
choice. The substrate's 'glider' would have to be saltatory:
dwell ~130t to commit, hop, re-dwell — a frog, not a glider.
Open: whether a slow mover (congestion-stalled, recoil-drift
~0.033c class) accumulates a co-moving committed shell.

## Mobility variants — saltation, leapfrog, congestion, isotropic winding

### Dwelling knot feed geometry matters (saltation arm 1)

Directed chase-feed (packets on 6 face-neighbors, ch6) at a PARKED
knot wrote almost nothing near it (shell tot=2/150t) — directed
flux just beams away downstream. The deep chase-fed trail (3465)
was beam wear, not knot-centered structure.

### Isotropic micro-bath winds the knot — and digests it

All-12-edge-channel feed on a 5x5 even-cell ring around the knot,
150t: FIRST endogenous winding of the knot's own cell —
knotW=334, 12 channels committed (>=128), neighborhood tot=4462.
But mass eroded 512->11 (bath ablates faster than accretion holds)
and the post-kick remnant no longer launches. The bath converts a
walker into a wound fossil: structure accrued at the price of
mobility — the knot that gained a body lost the mass needed to
move it. Speed-structure exclusion now shown in BOTH directions:
moving can't grow structure; growing structure kills motion.

### Leapfrog — bonds transmit zero translation

Bonded pair (80t warmed filament), kicked ONLY A orthogonal:
A translated its full 16 hops identical to unfed; B never moved.
The filament anchors each cell to the medium at its address —
it is not a spring between partners. No drag, no follow, no
re-bond. 'Federated locomotion' is absent, not just weak.

### Congestion stall — sparse beams don't gate mass relay

Knot (m=512, kick=300) aimed through a 6x11-cell beam wall fed
40%/tick: sailed through at 1 hop/tick, zero stalls. Lane
incipient load from sparse transient packets never reaches the
qStallLoad=32 gate — kicked mass bulldozes traffic it outweighs.

### moveclock run — fixture null

dd-biased vs balanced 3x3x3 knots (mass-10 cells, bath 0.02,
600t warm): all phase registers read 0 at probe — knots went
quiescent, no wind-up data. Only datum: mover's WINDING centroid
drifted -0.83x over ~700t — dd-biased emission writes records
asymmetrically forward. The knot pre-wears its own lane: the
nearest thing to 'structure leading the mass' measured so far —
but it is wake-deposit ahead, not a carried body.

### The accumulated law (mobility/structure)

Being in this medium is a FIXTURE, not a vehicle:
- mass moves at c: bare, thin trail, no structure, no tau
- transacting while moving: deep comet wake, still bare
- dwelling + isotropic flux: structure grows ON the knot —
  and erodes it below the launch threshold in the same act
- bonds anchor to the medium; nothing transmits translation
- records shape future traffic (rails guide, lanes stall) but
  never propagate themselves — winding is always a memory of
  where transactions happened, never a plan of where they're
  going. The causal asymmetry vs Conway's glider is structural:
  the glider's pattern CAUSES its successor; here the pattern
  RECORDS its predecessor.

## Nature-calibration: scattering profile (Hofstadter analog) + vacuum opacity

### The missing basic thing — virgin vacuum is lossy

Found while building the scatter probe: a lone quantum on virgin
medium decays ~1/8/hop (stochastic floor drip, dm=7). Mean free
path ~7.5 cells = 0.75 fm. A worn lane drops it to ~1/64 and a
saturated rail (qRailGate) to ~zero — transport reach is a
property of accumulated records, not a constant. Deeply
load-bearing for all prior flux measurements: every 'beam' result
was measured on self-worn or dense streams; sparse lone quanta
attenuate ~85-90% over ~22 hops in virgin medium.

Also discovered in the handoff code: a FULL-residue mass hop
carries momentum + bondPar (chirality) + bondDist (provenance)
to the destination — the mobile kernel is bigger than mass+par.

### Interaction profile: hard edge at 1 face-hop, direction-asymmetric

ch6 packet stream (nu=140, gap=2, 250t) swept past a bare 2000-mass
knot on the x-y=const line family; observable = momentum transfer
(knot surfs downwind):
- d=-1 only: knot caught the beam, surfed 32 cells to the wall
  after ~155t of momentum accumulation. All other offsets: zero
  interaction, mass untouched.
- d=+1 (the mirror face-pair, also face-adjacent): NOTHING. The
  profile is a hard edge at exactly 1 face distance AND only on
  one of the two closest lines — direction-asymmetric.
- Mirror test, ch8 (1,-1,0) beam on both its face-adjacent lines
  (x+y=29, 31): zero interaction at either. The push is specific
  to the +6/d=-1 geometry.
- Candidate mechanism (authored, flagged): the caught-mass donation
  prefers +x,+y face neighbors ('so the relay MARCHES') — the
  matter lattice has a built-in forward-face asymmetry. The
  scattering asymmetry likely traces to it rather than to physics.

### Response is structure-dependent — same flux, different physics

| knot type | at d=-1 (interacting line) | off-line |
|---|---|---|
| bare m2000 | surfs to wall, mass intact | untouched |
| wound (committed pair) | FEEDS: mass 2000->67208 saturating; pinned, never moves | erodes 2000->1520 (shed tax) |
| 2x2 blob (500/cell) | splits: in-range cells walk (m1000 to wall), out-of-range stay (m1000) | untouched |

Same beam, three responses: momentum transfer (bare), accretion
(wound), partial ablation (blob). The knot's STRUCTURE, not its
mass, determines whether flux pushes it or feeds it.

### Cross-section reading (honest)

Single-cell knot = point object: hard-edged interaction disk of
radius ~0.1 fm (1 face-hop), below the proton's 0.84 fm rms
charge radius (~8 cells) — our knots are parton-scale, not
proton-scale. The proton's exponential matter distribution is a
COMPOSITE statement; the analog measurement here needs a
multi-cell composite large enough to have internal structure
(blob showed only per-cell response, no collective profile yet).

## Reaction states — the substrate's particle physics (0.1 fm is the RIGHT scale)

At this scale the honest object is not a macroscopic body but a
reaction: |in> -> |out> with conservation audited per sector.
Three reactions now measured end-to-end.

### R1 — parity-conjugate contact (repulsion-limited annihilation)

in: m500(bp+20) + m500(bp-20), separation 2, charge-free
out: m316(+127) + m316(-127) repelled to separation 4 +
     w370 conduit scars (168+168 at the origin sites)
ledger: 1000 -> 632 mass + 370 winding — CLOSES.

Physics: chirality-conjugate knots partially annihilate on
contact (mass -> winding scar, not heat), saturate each other's
parity to +-127, then REPEL — separation 2 -> 4 and frozen. The
substrate's matter/antimatter analog: conjugates can't coexist at
contact range, and the burn rate limits total conversion.

### R2 — pair production (scar -> +- pair)

in: conduit face-channel scar winding[d]=200 (d<6)
out: m64(bp+127) + m64(bp-127) on the two odd cells the conduit
     separates, each carrying a minted wound skeleton +
     bondDist=2 provenance; products repel immediately.
ledger: 200 -> 128 mass + 72 skeleton — EXACT.

Gate: scar>=64 AND both odd neighbors empty. The scar's
direction mints as the pair's SHARED quantization axis (the
skeleton is written on the 4 edge-pairs containing that axis —
an acceptance cone: probes aligned read the spin, transverse
read nothing). Not feedable by packets — they ride edge
channels; only annihilation/charge-burn recharges a face scar.

### R3 — charge-catalyzed cascade (charge-selective chemistry)

in: m500(bp+20) beside conduit charge -200
out: m215(bp-127) + w121 + conduit charge -22
physics: the conduit charge selectively burns OPPOSITE-parity
matter into a face scar (rate ~4x|charge|); the scar fires R2;
the +product re-burns beside the negative conduit while the
-product repels clear and GROWS (162->215, accreting burn
residue). Net: 500 units of +matter -> 215 units of -matter +
records. A charge bath imprints its sign on surviving matter —
charge-asymmetric production = the substrate's chiral
separation engine.

### The reaction ontology so far

- parity (bondPar) = the conserved quantum number: produced in
  +- pairs, never solo (R2), burned by conjugate contact (R1)
- conjugates repel after partial burn — annihilation is
  rate-limited, not instant
- scars = stored reaction energy on conduit face channels;
  a scar is simultaneously a bond record, an energy reservoir,
  and a spin quantization axis
- charge = chemical potential for handedness: it spends down
  converting opposite-parity mass into scar+product
- in every measured reaction the ledger closes within transient
  drain: mass <-> winding <-> products convert, nothing mints

## Reaction constants — threshold, stoichiometry, acceptance cone

### Pair-production threshold (Schwinger-analog curve)

Conduit face-scar energy -> produced mass (single tick):
| scar | mass | yield |
|------|------|-------|
| <=63 | 0    | 0     |
| 64   | 40   | 62.5% |
| 128  | 80   | 62.5% |
| 200  | 128  | 64%   |
| 400  | 256  | 64%   |

Hard barrier at exactly 64 — the 2mc^2 analog: below threshold
nothing happens, above it conversion is a constant ~64% of scar
energy -> mass, the remainder -> product skeleton. Not gradual:
a true energetic gate.

### Charge-burn stoichiometry (electrolysis ratio)

Conduit charge vs +parity knot: burn = 4*|charge| mass per event,
charge spent 1:4, exhausts in one tick. Not a rate law — a fixed
reaction ratio: q- + 4m+ -> scar + q_spent. -25 -> 100 burned,
-400 -> 1600 burned, linear to the charge exhausted.

### Acceptance cone — CONFIRMED at the record level

x-axis scar -> pair: each product's skeleton nonzero ONLY on
edge-pairs containing x (ch6-13), exactly zero on transverse yz
pairs (ch14-17); dominance mirrored between + and - products
(the pair's chirality IS its cone's handedness). faceW=0 — the
scar is fully consumed, not copied. The scar's direction is
literally the pair's shared spin axis, written as the set of
channels its future transactions can occupy.

### Functional cone test — inconclusive

Beams aimed at the settled +product on axial (ch6) vs transverse
(ch14) channels showed no differential — but no interaction in
either arm at this geometry (interaction needs face-adjacent
approach; the products repel to asymmetric sites). Blind-channel
coupling needs a tighter probe — the record-level cone is
confirmed, the coupling cone is open.

### Products repel along the production axis

Every produced pair separates along the scar's own direction —
the pair's relative momentum is collinear with their shared spin
axis. Back-to-back emission along the quantization axis, the way
real pair production aligns momentum and spin.

### Branching + charge threshold (reaction constants, cont.)

- Multi-face scars fire independently per channel: x -> 1 pair
  (128 mass), x+y -> 2 pairs (256), x+y+z -> 3 pairs (384). Each
  pair lands across its own scar's face — additive, linear, no
  arbitration between channels.
- Charge-burn has NO threshold: q=-1 still burns exactly 4 mass.
  The 4:1 electrolysis ratio holds to single-quantum resolution.

## String tension + beam transparency — the force/flux complement

### Confining potential: E = sigma*(reach - slack), sigma = qString

Saturated tube between mass cores (script/cascade/string-tension.mjs):
stretching banks strain energy at exactly qString per unit reach over
slack — bank saturated at 128 = 16*(10-2) for qString=16, and
32/64/128/256 for qString=4/8/16/32. Linear rising potential, not
harmonic: the stored energy is proportional to extension, the QCD
string form V(r) = sigma*r with a slack offset. The bank IS the
elastic potential ledger — kicks (ev55) spend it back at min(qString,
bank) per confirmed transaction until drained.

### String breaking converts the linear potential to endpoint mass

Break threshold at L>=12 filament cells confirmed: L<=11 tubes hold
(+~10 feed noise); L>=12 fractures and mints +1415 (L=12), +1542
(L=13), +1669 (L=14) total mass — slope +127 per added cell, i.e.
minted mass grows LINEARLY in tube length exactly as stored strain
does. The stored potential does not dissipate — it materializes as
matter at the fracture, the string-breaking -> pair-production
conversion in ledger form.

### Relativistic escape: kicked cores outrun the string

Any kick that reaches 1 hop/tick escapes permanently — sep saturates
at the torus wall (55.7) regardless of qString<=32. The confining
force only operates on sub-luminal separation; mass at c crosses the
fracture criterion faster than pull-back acts. Confinement is a
LOW-VELOCITY law — consistent with the speed-structure exclusion.

### Beam-beam crossing: quanta are mutually transparent

Two perpendicular worn rails (ch6 x ch8) sharing one even cell
(script/cascade/crossing.mjs): cross-fed streams deliver ~97-136% of
their solo throughput — no blocking, no scattering, no merging at the
shared cell. Packet streams are non-self-interacting (photon-like,
not gluon-like): the medium's exchange quanta carry force between
matter but do not interact with each other. No interference
observable exists at the packet level — packetNu is an energy tag
averaged on merge, there is no phase register; the fm-scale
"interference" channel (beam-beam opacity) measures null.

## Interference fringes — phase arbitration measured (qMergeGate)

The substrate has a real phase degree of freedom after all, gated off
by default: every packet carries a rotating phase op = nu*age mod 256
(born at mint; nu is the packet's clock rate — a de Broglie internal-
clock structure). Armed incipients freeze their arrival phase on the
cell; qMergeGate admits a new offer only if its phase lands within
qMergeGate of some standing cloud member — anti-phase offers decline
to heat or reflect.

### The measurement (script/cascade/fringes.mjs)

Absorber = mass-bearing even cell at two rail termini; arm A = 4-hop
ch6 rail, arm B = 8-hop ch8 rail -> path difference d=4 cells. Sweep
nu (phase diff = nu*d mod 256 at constant geometry — attenuation
identical across the sweep, so modulation is phase, not path loss):

    nu:      8   16   24   32   40   48   56   64
    nu*d:   32   64   96  128  160  192  224    0
    ev50:    0    9    9   10   10    9    2    2   (phase declines)

~80-90% modulation depth, fringe width = the gate window (32 phase
units ~ 45 degrees). Frozen cloud ops confirm the algebra: A parks
at nu*4, B at nu*8 mod 256 — exact. Controls: single arm = self-
coherent at all nu (0-1 declines); gate=0 admits all.

### What kind of fringe this is (honest characterization)

- It is a count histogram vs phase difference — the same observable
  as a real fringe (nobody measures phase directly; the histogram IS
  the measurement).
- It is NOT single-quantum superposition: packets are pointlike, one
  path each. The mechanism is phase-matching of arrivals against a
  stored reference cloud — a homodyne/lock-in structure: the
  absorber's transaction history is the local oscillator. Closest
  nature kin: stimulated-emission selection / second-order
  (intensity) interference like HBT — which is the actual fm-scale
  technique (femtoscopy).
- Asymmetry on record: at anti-phase the ch8 cloud wins the
  occupancy race and ch6 declines — competition for the standing
  cloud, not a symmetric interferogram.
- The law is authored, not emergent: qMergeGate is a control we
  wrote. The measured content = the phase algebra (op = nu*age)
  works exactly as specified and produces real count modulation
  with correct controls — a fringe observable, not an asserted
  abstraction.

## Stimulated emission — the resonance measured (ev17)

The stim branch (incipNu bit7 -> site_unwind + clone) is now
positively measured (script/cascade/resonance.mjs). Fixture: wound
cell with 6 committed pairs at w=128 (committed volume 768 >
qGroundFloor 512), pumped back to 128 each tick to pin the excited
state; probe = one packet/tick on ch14 arriving at the cell.

### Resonance curve — a delta at the line

    nu:        26  27  28  29  30  31  32  33  34  35  36  37  38
    stim:       0   0   0   0   0   0  36   0   0   0   0   0   0
    confirms: ~960 avg off-line, 120 at the line

The stim response is exactly nu==geo_gap: zero response at +-1 nu —
an authored delta function, no linewidth in the stim channel.
Confirms DROP at the line (120 vs ~950): resonant offers route to
the stim branch instead of depositing — the resonance is visible in
both channels.

### The line tracks the structure — "the spectrum IS the structure"

Pumped winding w on all 6 pairs; predicted gap = (w>>2)*2/L2:

    w:       96  128  160  192
    gap:     24   32   40   48
    stim at: 24   32   40   48   (only at the predicted nu)

### Clone characterization

Per stim event: `line` winding released (measured dW/stim=32.3
unpumped — the transition energy = the gap); the stimulator
TRANSMITS and a clone emits — both at nu=line on the STIMULATOR'S
channel (collimated, continues downstream — laser directionality).
Both packets born = the offer's epoch (phase-locked pair).
Under-funded states transmit without gain.

### Activation thresholds (all measured)

- Committed volume must EXCEED qGroundFloor (512): 4 pairs @128
  (tv=512) -> flag sets but site_unwind refuses, stim=0. 6 pairs
  (tv=768) -> fires. The "population inversion" analog: no rung
  available above ground = no downward transition to stimulate.
- The offer must ARM on the wound cell: seeding the probe ON the
  cell fails (it flies out during Phase 1 before Phase 2 can arm);
  bare upstream cells can catch it first (gap=0 there -> no flag).
  Working seed = 1 hop upstream, arrives and offers same tick.
- Controls: floor-blocked (stim=0), bare grid (stim=0),
  off-resonance by +-1 nu (stim=0).

### Honest nature comparison (authored law, measured response)

- Einstein-B structure: resonant offer -> downward transition +
  one emitted quantum, rate ~ flux. MEASURED.
- Collimated emission along the stimulating beam. MEASURED —
  the clone rides the stimulator's channel.
- Emitted quantum: FIXED — the clone now carries nu=line (= the
  stimulator's frequency). The stimulator TRANSMITS (re-emitted at
  its nu, not absorbed): 1 in -> 2 out per stim event, funded by
  shedding `line` winding (the transition energy = the line).
  Measured: dW/stim = 32.3 (unpumped), clone nu=32, both packets
  born=stimulator epoch -> mutually coherent pair. Under-funded
  (near ground floor) -> transmit only, no gain.
- GAIN measured (resonance.mjs): downstream flux at nu=32 = 104
  vs 36 baseline (~3x) — resonant optical amplification; off-line
  flux unchanged. The medium adds quanta to the resonant mode.
- Spontaneous channel (Phase 6) with qResEmit emits AT the line
  but drifts as the state decays (spectrum 26-32 recorded).
- Phase coherence: FIXED (post-measurement authored change,
  src/moore26.c clone branch): clone packetBorn = the stimulator's
  incipBorn, not the emit tick. Measured: clone.born = probe seed
  tick exactly; clone phase at emit = nu_c*(emit-born) = nonzero,
  deterministic. The clone is phase-locked to the offer's epoch —
  an 8:1 down-conversion (nu 32->4) with shared temporal origin:
  parametric-emission structure rather than degenerate lasing.
  Under the old law clone phase at emit was always 0.
- Linewidth: REVISED after measurement. Per-tick the gate is a
  delta (integer-exact nu==geo_gap) — but the ENSEMBLE response
  has real width, and it needs no authored Lorentzian: as the
  unpumped state decays (self-emission + stim-driven shedding),
  geo_gap drifts — weakest-pair shedding walks bm down (~8
  nu-steps per stim), then resets to ~31 when that pair decommits
  and the next pair becomes weakest. The line ratchets through the
  band 32..11 repeatedly. Stim-response histogram vs probe nu over
  the full decay: nu=26->10, nu=30->4, nu=32->3, all else zero
  (deterministic, reproduced 3x). A comb-structured, red-skewed
  profile spanning ~6 nu units = ~20% fractional width — the same
  order as fm-scale hadronic resonances (rho/Delta have Gamma/M
  ~15-20%). The measured width IS the decaying line's occupancy
  histogram — the ensemble integrates the line over the state's
  life, which is what a real linewidth measurement does.

## The ensemble-observables principle (program-level finding)

The laser arc surfaced a rule that now governs how every claim in
this document should be read:

**Physics at this scale is not made of laws-per-event — it is made
of distributions that laws-per-event generate.** Nobody measures a
linewidth, a form factor, a cross-section, or an HBT radius in a
single event. Every detection reads one definite number; the named
observable is a property of the accumulated histogram over an
ensemble — many events, or one system integrated over its life.

Three times in this arc, an apparent divergence from nature turned
out to be a histogram we had not accumulated yet:

- Phase existed (packetBorn clock + incipOp freeze) but there was
  no "interference" until the merge gate was swept — the fringe is
  a count histogram, never a single arrival.
- Stimulated emission existed but ev17 stayed zero through five
  fixture failures; the mechanism only showed once its activation
  conditions (floor, arming site, catch roll) were understood.
- The "missing linewidth" — an authored delta gate — was resolved
  by the ensemble response: the gap ratchets as the excited state
  decays, and the stim-vs-nu histogram over its life is a
  comb-structured red-skewed profile ~20% of the line position.
  Same as nature: the rho meson's 150 MeV width exists in no
  single event — it IS the invariant-mass histogram.

Design rule going forward: NEVER author ensemble-level laws — no
hand-tuned widths, no authored cross-sections. If a measured
histogram mismatches nature's, the fix belongs in per-event
mechanics. The per-event sharpness is faithful; ensembles carry
the widths, in both systems.

## Femtoscopy — two-particle correlation comb (script/cascade/hbt.mjs)

The fm-scale interferometry observable: a two-particle correlation
function, not a single-particle fringe. Fixture: co-emitted burst
(born=0) from emitters at depths 1..15 on the ch14 axis upstream of
detector K (even cell, mass=512, committed winding on pairs e3-e6 —
raises site_level so offers arm; gap=40 kept away from probe nu so
stim can't pollute). Packet from depth d arrives at t=d carrying
op=nu*d mod 256 — arrival phase encodes emission depth; the merge
gate admits iff op lands within qMergeGate of a stored cloud phase.

### The comb — correlation period = lambda = 256/nu

    nu=64 (lambda=4): admitted depths {2,6,14} — pairwise
        separations {4,8,12} — ALL multiples of 4
    nu=32 (lambda=8): admitted {2} — d=10 revival missed to
        arm-rate thinning (packets arm en route at bare cells,
        ~6%/hop survival attenuation)
    chaotic source (random nu/emitter): admitted {2} or {2,3} —
        the comb dies

The two-particle correlation function vs source separation is a
comb with period lambda=256/nu cells — at nu=64, 0.4 fm in the
0.1 fm/node mapping. Pairs of quanta emitted at separations that
are multiples of the coherence wavelength bunch at the detector;
other separations anti-correlate (decline to heat). The period is
DERIVED from nu — emergent from the phase algebra, not authored.

### The chaoticity contrast

Random-phase sources kill the comb entirely — bunching is a
phase-coherence property of the source, not kinematics. This is
the HBT intercept parameter: in real femtoscopy C(q)=1+lambda*f(q),
the intercept reads source coherence (coherent sources bunch,
chaotic don't). Ours does the same — correlation contrast = source
phase-coherence.

### Honest characterization

- Second-order (intensity) correlation — coincidences between two
  detection events — the actual fm-scale technique, since no
  single-particle slit apparatus can exist at this scale.
- The mechanism is authored (merge gate) — the correlation
  STRUCTURE (comb period = 256/nu) is emergent.
- Not yet the full HBT: the source-size inversion (correlation
  width ~ 1/R for a chaotic extended source) hasn't been measured
  — our comb reads the quantum's wavelength in source space; the
  R-knob measurement needs a denser, phase-diverse source.

## Femtoscopy II — source-size inversion + form-factor scattering (measured)

### HBT source-size inversion — the R-knob now swept

Coherent emitters (nu=64, lambda=4) placed at depths d=1..R along
the beam axis; arrival tick = depth; admitted-depth set recorded
per tick. The two-particle correlation is now measured in BOTH
directions:

    R=4:  admitted {2}            — no pairs
    R=8:  admitted {2,6}          — pair sep {4}
    R=10: admitted {2,6}          — sep {4}   (depth 10 lost to
                                          catch-gate thinning)
    R=12: admitted {2,6}          — sep {4}
    R=15: admitted {2,6,14}       — seps {4,8,12}

- comb SPACING stays lambda=4 at every R — the wavelength ruler
  is set by nu, not by source size;
- comb SUPPORT (max pair separation) grows with R: 4 -> 12 as
  R goes 8 -> 15 — the correlation envelope edge inverts the
  source extent. Missing teeth (e.g. depth 10) are the known
  ~6%/hop arm-rate attenuation — stochastic thinning, not signal;
- nu sweep at fixed R=15: nu=32 lambda=8 -> admitted {2} only;
  nu=128 lambda=2 -> admitted {2,4,6,12,14}, separations {2,4,6,
  8,10,12} — denser comb at shorter wavelength, spacing tracks
  lambda exactly;
- chaotic control (random nu per emitter): R=8 -> {2,7} sep {5}
  (non-periodic); R=15 -> {2} alone — comb dies, as before.

This is the femtoscopy inversion: measure the correlation comb,
read lambda=256/nu (the quantum's wavelength — what real HBT
calls the relative momentum) and read the support edge -> source
radius R. Both observables are histogram features over the
depth-resolved admission record — no per-event width exists,
consistent with the ensemble-observables principle.

### Form-factor / diffraction scattering — first probe

script/cascade/formfactor.mjs: dense probe beam (8 packets/tick,
60 ticks) down ch14 through K=(12,12,12); three structures —
bare mass, point wound cell (all 12 edge pairs at 96), wound
tube (extent 2L+1 along the beam axis, 8 pairs/cell at 96).
Readout: deflections (ev30 congestion-diverts + ev50 declines)
and surviving packet census in a 7^3 box.

Measured response vs probe nu:

    nu=8..16:   wound def=7 flat, tube def=4, out~16-20
    nu=24:      wound def=0, tube def=0  — TRANSMISSION DIP,
                the structure is transparent at nu=24 at every
                tested length
    nu=32:      wound def=7, tube def=4
    nu=48..128: wound def=7 flat; tube def 13->15, out drops
                18->7->13->12 — strong structure-dependent
                scattering above nu~48

Length sweep at nu=64 (tube):
    L=0 len=1:  out=20 def=5
    L=1 len=3:  out=19 def=13
    L=2 len=5:  out=13 def=15
    L=4 len=9:  out=12 def=15  — saturates once the tube
                intercepts the beam

Honest characterization: this is a structure-dependent
scattering cross-section vs probe nu — a form-factor-like
response (the wound geometry, not bare mass, controls the
deflection count; bare control is flat zero-deflection at every
nu). The nu=24 transparency window and the nu>=48 onset are
real measured features. NOT yet a clean diffraction pattern:
no resolved minima/maxima series vs angle — the substrate's
scattering is channel-selective deflection + absorption, not a
far-field angular amplitude. The honest claim is "scattering
response is nu-structured and geometry-dependent"; the
diffraction-pattern claim needs an angular readout (per-channel
outgoing distribution) we haven't built yet.

## Deviation-age spectrum — grown vs authored vs worn structure

script/cascade/devage.mjs + two new exports (moore26_bondtick_get,
moore26_workage_get). Census of all wound cells after a sustained
ch14 feed vs an authored winding_set fixture:

    GROWN (300t feed):    99 wound cells
        25 birthday'd (bondTick spread t4..t291 over the feed window)
        74 ageless (wear-deposited winding — traffic scars, no bonds)
    AUTHORED (12x96):     1 wound cell — bondTick=0, workAge=0
    GROWN+DECAYED (200t feed + 150t idle):
        69 wound cells, 21 birthdays survive decay (t4..t189)

Measured consequences:

- The winding field has TWO grades of deviation: wear (transit
  scars — no provenance) and committed bonds (timestamped). The
  bondTick distribution is the formation stratigraphy that
  winding magnitude alone hides.
- Formation is progressive: birthdays span the entire feed
  window, not a single nucleation instant.
- Stratigraphy outlives magnitude — birthdays persist through
  150t of decay erosion (fossil record).
- AUTHORED structure is perfectly ageless (bondTick=0,
  workAge=0) — the spectrum is a clean discriminator between
  grown and authored structure. Honest flag: winding_set
  fixtures differ from grown structure in kind, not degree.
- Per-channel resolution note: bondTick/workAge are per-NODE
  registers. A true per-channel deviation-age spectrum would
  need a new per-channel field — not currently tracked.

## There is no thing — tracking identity through local state

script/cascade/thingtrack.mjs: bare odd-cell mass=512, momentum
kick on pair 7 (32768) -> the mass relays odd->odd through the
even conduit at exactly 1 cell/tick (complete handoff — the
decode-zone relay clears the whole residue per hop).

Measured trajectory:

    t=0:  mass at (17,16,16)
    t=1+: hops (17,17,17) -> (17,18,18) -> ... 1 cell/tick
    trail: EVERY vacated site writes m=1 residue + bondTick =
        the tick the vacate-confirm landed
        (17,17,17)bt3  (17,18,18)bt4  (17,19,19)bt5  ...
    residue is invisible otherwise: w=0, m=1

What the measurement says about the ontology:

- The substrate keeps NO thing-table. The mass register
  relocates wholesale; each site records only "a transaction
  confirmed at tick N." No cell knows what passed through —
  the trail site at (17,20,20) carries bt6 and nothing else.
- Identity is reconstructed, not stored: WE connect the
  timestamped sites and call it a trajectory. The substrate's
  only account is the local deviation record.
- The deviation-age record IS the visualization layer: with
  w=0 and m=1 residue, the path is invisible to every other
  register. bondTick alone makes the motion legible — the
  substrate literally writes its own track as it moves.
- Nature's version is a detector track: a bubble chamber never
  sees a particle — it sees a sequence of timestamped local
  ionization events; the "particle" is the reconstructed
  pattern. Our trail of birthdays is the same object: local
  transactions, spatially ordered, temporally stamped.

## Synthesis — mass is not energy, and things are not objects

Two results from this session crystallize the substrate's
ontology and match nature's measured content:

### Mass = confined frequency (not "energy")

E=mc^2 is a conversion, not an identity. Nature's
counterexample: the photon has energy but zero mass — it has a
rate (nu) but no bound cycle, no rest frame, no address. Mass
specifically = the energy of a bound oscillation: Dirac's
zitterbewegung makes a confined particle tremble at 2mc^2/hbar;
every measured "mass" at fm scale is a frequency-domain readout
(decay-product invariant mass, line spacings, decay rates).

The substrate has the same shape:

    packet nu    = rate + energy, free in flight  (photon-like:
                                                    no mass)
    winding      = nu trapped in circulation — deviation
                   looping in place (bound cycle)
    geo_gap      = the circulation's characteristic frequency
                   — the structure's "mass" readout, measured
                   through re-emission spectra

So "mass" in this substrate = nu with an address. Not a
separate scalar — the frequency of a deviation that cannot
leave. Same operational content as nature: mass is what
frequency looks like when it is confined.

### Identity = formation trail (no thing-table)

thingtrack.mjs measured the relay: a kicked bare mass hands
off completely odd->odd at 1 cell/tick; every vacated site
writes m=1 + a fresh bondTick at the confirm tick. The trail
is invisible to every other register (w=0). The substrate
keeps no thing-state — each site knows only "a transaction
confirmed at tick N." "The same thing" is our reconstruction
from timestamped local records — the same object a bubble
chamber reconstructs from ionization hits.

Combined with devage.mjs: grown structure carries birthdays
(stratigraphy survives decay), authored winding is ageless,
wear scars are ageless too. The deviation field is not one
thing: it is trail (timestamps) vs scar (winding, no
provenance) vs committed structure (both). The record, not
the magnitude, is what differentiates a structure from a
disturbance.

## Skeleton-bleed knob (qSkeletonShift) — first survey

The relay's asymmetry is coded, not emergent: mass handoffs whole
(`k=o->mass`) while the winding skeleton bleeds `>>shift` — >>3 at
edges, >>6 interior. A wound knot therefore cannot carry its
structure: the mass escapes and the exoskeleton stays (measured
this session on the 3^3 glide fixture: mass centroid 16->23.5,
winding centroid 16.1 — the skeleton stays home).

New tuner `qSkeletonShift` (0..6) subtracts from the bleed shift,
exposing mid-rate bleed rates on purpose — including the full-
handoff landmine at +3 edges. First survey on the wound glide
fixture, 200 ticks:

  shift 0 (baseline):  mass 23.5 / wind 16.1 — mass escapes, ghost
  shift 2 (edge >>1):  mass 23.5 / wind 16.7 — same stall, ghost
                       marginally lighter
  shift 3 (full):      mass 23.5 / wind ~16  — NO accretion
                       explosion on an isolated knot: the documented
                       u16-underflow landmine is fixture-dependent,
                       not automatic. wind total held 3510.

The binding constraint on this fixture is the STALL, not the
bleed rate — skeleton only migrates during hops, and this knot
stops walking at x~23 regardless. Mid-rate bleed survivors need a
mover that keeps moving: the bonded-pair composite (bond-share
equilibrated reservoirs -> lockstep hops, sep held, verified
12+ ticks) is the current candidate structure that walks. The
knob's survey space is open — wound movers, chains, wound walkers.

## Conducted charge force (qChargeKick) — signed Coulomb analog, measured

(script/cascade/charge-kick.mjs) Charge was a conserved record with
no force law — signed, pair-able, carried on mass flight, policed
conduits, gated binding — but two charged cells never pushed on
each other. New tuner wires it through the bond machinery: on a
committed face conduit, each odd cell reads the partner's charge
(2 steps along the face), and applies its OWN push along the bond
axis — k = min(|qa|,|qb|)>>shift spread across the axis's 4
edge-transport pairs (AXP), signed by the charge product. The
partner fires the same law on its own scan — Newton pair with no
remote write. AUTHORED work like qTension; ev58 counts delivered
impulse.

Fixture: odd mass cells (9,16,16)+(11,16,16), conduit (10,16,16)
wound 64 on all 12 edge channels. shift=4, q=1000 -> k=62/pair.

  +/+  : ev58=992 (2 cells x 4 pairs x 62 x 2 linked ticks), pair
         separated 9,11 -> walls at ~1 cell/tick. Kick stops the
         tick the link breaks — the force is literally the wire.
  +/-  : both converged at the conduit by t=2 (all mass in one
         column) — an attracting collision — then passed through
         on residual momentum and separated. No bound state forms:
         the link severs on pass-through and the force dies.
  0/+  : dead static.  +/+ knob-off: dead static.
  +2q  : ev58=2000 vs 992 — impulse scales exactly with min|q|.

What is measured: a signed, conducted, conduit-gated, magnitude-
scaled charge force — the substrate's first candidate "EM". What
it is not yet: funded (authored kick, like qTension), ranged
beyond one bond (a trail-chained kick could carry it along worn
lanes — unwritten), or bound (no orbit forms — the collision
passes through because nothing holds the pair together once the
wire breaks, and no KE sinks). Open forks: (a) fund the kick —
charge reservoir spends down doing work (the bond is a discharge
path), or the conduit pays (decommit = natural range cutoff);
(b) multi-hop propagation through committed chains -> conducted
force at range along structure, the worn-lane EM this substrate
can actually support.

## Charge at range — the wire test, and what had to be fixed first

(script/cascade/charge-kick.mjs --mode=wire/--mode=chain)

qChargeRange (0-31) adds chain mode: BFS over the committed
even-cell graph (edge-adjacent committed pairs, depth-limited,
visited-cap 512) from a cell's conduit to the first
charged+massive odd terminus. Same signed law, same k — the push
still lands on the entry face's axis: the wire pushes at its
endpoint, never through space.

Zigzag committed wire, 9 even cells, charged masses at both ends:

  +/+  sep 10 -> 31, ev58=992 — repulsion at range
  +/-  sep 10 -> 2, converged at the wire midpoint — attraction
       at range — then passed through and separated (residual p)
  +/+  broken wire: ev58=0, dead static — the force IS the wire
  5-odd-cell chain, all +q: ends fly, interior cancels — the
  classic line-of-charge result, ev58=8x248 exact accounting

TWO MECHANICS THE TEST FORCED:

1. Charge rides the mass relay — before this fix the charge record
   stayed home while its body walked (only qChargeShed>>4 rode),
   so a moved charged body went electrically dark after ~2 hops:
   the wire pair's kicks fired twice then died. Charge now hands
   off proportionally to mass moved — the signed total is
   conserved exactly (verified: sum q = 0 across +1000/-1000
   bodies through 12 hops).

2. Transverse drift — a face-axis push spreads across 4 edge
   pairs; argmax picks the SAME diagonal member every tick, so
   the +/- pair converged in x but drifted apart in y/z, passing
   each other offset by ~10 cells. qVolRoute fixes it: the
   |p|-weighted draw distributes the transverse components —
   the pair met at the wire midpoint (x=14, t=6).

REMAINING GAP — no bound state yet: after pass-through the pair
separates on residual momentum and exits the wire's neighborhood;
the force can only re-fire while both ends sit adjacent to
committed cells. An oscillating bound pair needs either a wider
conductor (a committed SHEET the bodies surf — untested), a
KE sink, or re-bonding after crossing.

Also riding the handoff now: localTime (a body's tau ledger —
proportional share, conserved) and phase + bondDist (the
oscillator state and reach map, whole on clean hops, bondPar
rule). bondTick STAYS — a site's formation birthday is
provenance, not body state; it staying is what makes the trail.

## Conduction — Ohm's law on the wire (charge-circuit.mjs)

qChargeFlow (shift 0-15) makes the charge record itself mobile on
the lattice WITHOUT moving mass: across a committed conduit the
higher-potential side sends k=(qa-qb)>>shift of its signed record
to the partner. Only the higher side sends (one writer-pair per
link), reads are pre-tick so the wave travels 1 link/tick, and k
is clamped to dq/2 so a link can never ring. ev60 = charge in
transit — the ammeter.

Fixture: L committed conduits in a straight chain, odd lattice
cells (mass, no momentum) between them. Source pinned +V (ideal
battery), drain pinned 0 (ideal ground — its inflow IS the
current). Three independent ammeters cross-check: drain inflow,
source outflow, ev60/L.

MEASURED (shift=1, mass=100):

  Ohm's law — I ∝ V: R = 12.0-12.2 const across V=256..2048
  Resistance ∝ length: R = 2L EXACTLY (4.0/8.0/12.1/16.1 at
      L=2/4/6/8) — matches I = V/(L*2^shift)
  Kirchhoff series: I_drain = I_source = ev60/L within 0.5%
  Potential profile: q(x) linear to +/-1 —
      1024 853 682 511 341 170 0  vs  ideal ...683 512 341 171
  RC discharge (no pins): source 1024 -> 149 ~= Q/(L+1)=146,
      profile flattens, Sum q = 1024 EXACT the whole run
  Broken wire: I_drain = 0 — but the source-side stub charges
      to ~V (a dead-end wire pulls a filling current, like a
      real open conductor charging to source potential)
  Off control: dead static
  Joule (qChargeHeat): interior cells warm ~1100-1400 @ I~85,
      k>>3 minted at the receiver — the resistor heats with
      current (AUTHORED mint; the dropped potential is unbookkept)

What this is: a discrete conductor. The lattice stays home; the
charge record migrates odd->odd through committed conduits down
its own gradient. Voltage = the record differential (measured
linear), amperage = transits/tick (measured, uniform in series),
resistance = links x 2^shift.

HONEST GAPS — what a circuit layer still lacks:
  - no induction: steady current exerts no force on a neighboring
    wire's charge — MEASURED NULL (--mode=induct): a pinned probe
    linked to a current-carrying wire reads identical impulse
    under +x / -x / no current at matched local charge (72.8 /
    72.4 / 74.8 |p|/tick). The kick reads the charge RECORD;
    nothing couples to its motion. Magnetism does not exist here.
    Side finding: an unpinned charged wire DISASSEMBLES itself
    under the kick (mutual repulsion ~568 |p|/tick) — conductor
    lattices aren't self-bound against their own conducted force.
  - no reactive elements: clamped diffusion cannot ring
  - nonlinear control: conduits whose commitment depends on a
    control charge (diode/gate analog) — the charge-parity
    binding law (qCapBase) already discriminates sign, so the
    seed exists. The pump's internal short (below) is the diode
    motivation arriving on its own.

## The funded EMF — a real battery (charge-circuit.mjs --mode=pump)

qHeatPump (rate 1-511): an odd cell with heat + a bondPar polarity
pumps charge through itself — along the first axis whose BOTH face
conduits are committed, it moves k charge from the upstream odd
partner to the downstream one (direction = bondPar sign), paying
1 heat per unit. Not a mint: charge relocates, heat is debited,
ev61 = charge pumped.

Fixture: closed 12-cell ring (bottom y=16, top y=18, verticals at
x=9,19), pump at (11,16) driving -x -> +x along the bottom.

MEASURED (heat=3000, rate=8, shift=1):
  - sustained ring current ~2/tick for the battery's WHOLE LIFE;
    dies when the battery dies (t~375)
  - EMF held: sawtooth terminal differential +/-14 constant for
    the run — the pump MAINTAINS voltage against back-flow
  - funding exact: ev61 = 3000 = heat spent — 1:1, no mint
  - INTERNAL SHORT: ~3/4 of the pumped charge back-flows through
    the pump cell's own links (~7/tick backward vs ~2 forward
    around the ring) — a battery with zero internal resistance.
    A diode layer (one-way conduit) is the natural fix.

## Kirchhoff measured (--mode=parallel)

Two branches share the terminals (6-link and 8-link paths):
I_A=85.0, I_B=63.8 separately; combined I_AB=148.82 — exactly
I_A+I_B. Current splits at a junction by conductance and rejoins
— no law was written for it, the pairwise diffusion composes.

## The diode, the Ampère force, and the substrate Lorentz

(charge-circuit.mjs --mode=diode/--mode=ampere/--mode=beam)

DIODE (qDiode): a committed conduit whose bondPar!=0 conducts in
one direction only (+bondPar = +axis). MEASURED on a 4-link wire
with the mid conduit polarized: forward I=128.0 (full
conductance), reverse I=0.00 (completely blocked), diode-off
control 128.0 both ways. A one-way junction from a record the
conduit already carried — grown conduits may be born polarized.

FLUX (new register): flux[3] = signed recent charge throughput
per axis on each cell (EWMA, ~1/32 decay). Written by conduit
transfers, pumps, and charge-relay hops — a moving charged body
IS a current element. This is what the earlier probe couldn't
see: the charge RECORD was blind to motion; flux is motion.

MAGNETIC KICK (qMagKick): on a committed conduit the endpoints'
flux vectors dot — parallel currents attract, antiparallel
repel (Ampère's law), push along the link axis. ev21.

  wire-wire (ghost-wire probe, electrostatics excluded):
    parallel fluxes:   F_y = -636237 (TOWARD, -15.3k vs baseline)
    antiparallel:      F_y = -605732 (+15.3k repulsive correction)
    no current:        F_y = -620984 (gravity/curvature baseline)
    antisymmetric term = -15253 with Ampère sign — MEASURED

  beam probe (current element linked to the wire, link
  charge-blocked by a diode):
    probe flux parallel:     F_y = +1806 (TOWARD = attract)
    probe flux antiparallel: F_y = -1777 (AWAY = repel)
    probe static (flux=0):   F_y ~ +13 ~ 0 — v=0 means no force
    no wire current:         F_y = 0 exactly
  The substrate's Lorentz force: a current element feels a
  wire's current; a static charge feels nothing.

POLARIZED PUMP: diode-flanking the battery's conduits kills the
internal short — ring current 2.0 -> 6.7/tick (3.3x), held EMF
+/-14 -> +/-80, funding still exact (ev61=heat).

ALSO FIXED — AXP per-pair sign: the kick wrote sgn*k to all 4
axis pairs uniformly, but each pair's +channel carries its own
axis sign (y/z axes have a flipped member). Correct only on x
before — which is why every x-axis fixture measured right while
y/z pushes were scrambled. Now *= QChannelVec[2e][axis].

MECHANISM NOTE — junction self-attraction: any committed link
carrying charge transfer writes parallel flux on both cells, so
a conductive junction pinches itself. Real Ampère physics, and
why charge-blocked (diode) probe links are needed to isolate
the wire-current term.

## Force and induction at range — the field reaches through the wire

(charge-circuit.mjs --mode=magrange / --mode=faraday)

RANGED AMPERE (qMagRange): the magnetic kick walks the committed
even-cell graph like qChargeRange walks it for charge — BFS to
the first odd terminus bearing FLUX (a current element; charge
need not be present — ghost termini count). The push lands on
the entry face axis. Ghost-termini fixture, 9-cell zigzag wire:

  parallel   (+,+): F_x = +156.0/tick  TOWARD — attraction
  antiparallel(+,-): F_x = -156.0/tick  AWAY   — repulsion
  dead end   (+,0): F_x = 0  — no far-end current, no force
  passive T  (0,+): F_x = 0  — no local current, no force
                    (F=I x B needs I: the wire feels nothing
                    without its own current element — correct)
  broken wire:      F_x = 0  — the force IS the wire
  antisymmetric term = 156.0, Ampère sign — MEASURED AT RANGE

INDUCTION (qMagInd + fluxP): fluxP snapshots last tick's flux so
each cell can read partner dI/dt = flux-fluxP. EMF pushes k=|d|>>
shift of this cell's charge along the PARTNER's current axis to
the Lenz-signed odd neighbor (committed conduit required).
Transformer fixture: primary ghost P (harness-driven x-flux)
y-linked to secondary wire C-B-D along x, B seeded +512:

  RAMP (P flux +64/tick): ev24 ticks at 8/tick = dp>>ind EXACT;
      B.flux = -60 (LENZ: induced current opposes the growth);
      B charge drains -> C (induced voltage drives real current)
  DC HOLD (flux pinned 2560): ev24 FROZEN at 353 — total silence
      at steady current. The Faraday discriminator: DC wires
      attract (Ampere) but do NOT induce.
  RELEASE (flux -> 0): single reverse spike — ev24 +320
      (=2560>>ind exact), B.flux +341, B charge overshoots to
      -188. The switch-off kick, correct sign.
  CONTROL (ind=0): ev24=0, B.flux=0 all run — dead.

Both new laws are conducted: zero action through empty space,
zero action on passive matter, exact charge conservation (every
transfer debits+credits), and the EMF/impulse counters close to
the authored shifts exactly. The conducted E<->B loop is now
closed in both directions: current->force (Ampere/Lorentz,
direct AND at range) and CHANGING current->current (Faraday).
The one thing still absent by construction: free-space
radiation — nothing crosses a gap without a committed path.

## The junction pinch measured — the Bennett relation

(charge-circuit.mjs --mode=pinch)

The "contamination" from the beam fixture is its own physics:
a driven link's transfer writes PARALLEL flux on BOTH endpoints
regardless of current direction -> every conductive junction
self-attracts. Two signatures separate it from the two-wire
Ampere force, and both measured exact:

  REVERSAL-INVARIANT: at |I|~12000 the pinch force is -8.70M
  forward, -8.94M reversed — same pull toward the junction
  (both fluxes flip, the dot stays positive).

  I^2 SCALING (Bennett): pinch-vs-I log-log slope = 2.00 over
  a decade of current (I = 2977 -> 31744, F = -0.55M -> -63.0M).
  F = I^2/16 at mag=6 — the authored km=|f.f|>>shift law, and
  the plasma-physics result: a current column's magnetic pinch
  pressure is quadratic in current (Z-pinch, Bennett 1934).

Consequence for fixtures: ANY probe sharing a conductive link
with a driven wire feels an I^2 attraction to the junction —
isolating a true wire-current term requires charge-blocked
(diode) links, exactly as the beam mode discovered by
contamination. The pinch is also why the polarized pump's
internal short carried backward flux: a shorted link pinches
but also leaks, and the diode fixes the leak not the pinch.

## A conducted wave — the induction chain self-propagates

(charge-circuit.mjs --mode=wave)

The experiment that tests whether an EMF can induce an EMF down
a line of cells — the conducted analog of radiation. 9-cell
x-chain, all cells +200 charge carriers, head cell flux-driven
(+8192 for 4 ticks, then released — a square current pulse).

PROPAGATION: the disturbance reaches cell 25 (~t=6) — the
wavefront advances ~1 induction hop/tick, the lattice's causal
speed. Subtlety: a transfer writes flux on BOTH endpoints, so
the flux-front reads 2 cells/tick while the charge itself hops
1 cell/tick.

GAIN BANDS — three regimes measured:
  ind=3 (k=dp/8): dies in 2 hops — too lossy
  ind=2 (k=dp/4): UNDER-DAMPED WAVE — propagates the full line,
      interior cells ring with a decaying period-2/4 envelope
      for 15+ ticks after the drive releases, leaving a
      rightward-drifting flux tail. Wave, not diffusion.
  ind=1 (k=dp/2): REGENERATIVE — the ring doesn't decay, it
      locks into a period-2 standing oscillation saturated at
      the int16 rails (+/-~31700). A limit cycle at the
      lattice's Nyquist frequency (the fastest oscillation the
      substrate supports), powered by the authored EMF work —
      the flux clamp is the bounding nonlinearity.

HONEST CAVEAT: the EMF needs charge carriers (o->charge!=0) —
this is a transmission-line / Alfven-like wave in a populated
medium, NOT light-in-vacuum. Vacuum radiation would need an
EMF that acts on the conduit without a carrier to push, which
no current mechanism provides. Also authored-work caveat: the
induced EMF transfers charge but spends nothing — the energy
book for EM work is still open (same status as qTension).

## Funded induction, and what the pinch does to a free lattice

(charge-circuit.mjs --mode=tload / --mode=pring / --mode=pwire)

FUNDED INDUCTION (qIndLoad): the induced EMF now debits the
partner's flux by the same dir*k the receivers gain — reflected
impedance, the primary pays. Transformer fixture (primary V
ramps 16/tick, secondary B-C coupled):
  ind=0           : P.flux ramps, ev24=0 — no coupling
  ind=2 free      : P.flux 1695, ev24=858
  ind=2 funded    : P.flux 1552 (-8.4% sag), ev24=769 (-10% —
                    the sag itself damps the EMF: real feedback)
The load term is MEASURED as primary flux sag — a transformer's
reflected impedance, closing the authored-work caveat for the
EMF specifically.

RING PINCH (32-cell square ring, diode-flanked pump, sustained):
  pinned radial impulse: -0.6/cell/tick INWARD under drive+pinch;
  0.0 in all controls (no current / no magKick / neither).
  Free lattice: one corner cell dislodged by t=25, ring OPENED,
  circulation died, stable arc at meanR 9.83 (vs 9.21 seeded).
  Drive-only control: ring intact, flux climbs steadily.

WIRE PINCH (free 9-cell wire, driven):
  mag=10, V=1024: pinch impulse ~6000/tick >> lattice hold —
      wire destroyed in <25 ticks (cells scattered).
  mag=16, V=128 : end-erosion — source-end cell pulled inward
      and off, span 16->14, then the open end severed the drive;
      residual arc stable with flux ~3.
  mag=0         : wire stable, flux -> 500 steady conduction.

THE PHYSICS READ — this is the sausage-instability result, not a
fixture failure: interior cells sit in balanced pinch (each link
pulls equally both ways, net ~0), so net force lives ONLY at the
ends/defects — the column necks off exactly where a real
Z-pinch does. The pinch constricts but self-limits: erosion
opens the circuit, which kills the current driving the pinch.
A self-confining current structure would need either (a) cells
bound to the conduit lattice by something OTHER than the pinch,
or (b) a drive that survives lattice motion — the spheromak
question stays open, now with a measured reason why it's hard.

## Junction semantics, tracking electrodes, and the yield barrier

(engine change + charge-circuit.mjs --mode=pwire2 / --mode=wmerge)

JUNCTION SEMANTICS (engine): a committed conduit now couples
EVERY massive odd cell touching it — the odd face-neighbor scan
replaces the single 2-along-face partner. Straight wires are
unchanged (verified: Ohm's law, diode, Ampère, magrange all
byte-identical results) — but a cell that hops DIAGONAL-adjacent
to committed structure now stays linked instead of dying.
Circuits can heal topologically; pushes still land on the entry
face axis.

TRACKING ELECTRODES (pwire2): the +V/0 pins follow the wire's
surviving termini each tick. The drive DOES survive end-erosion
(ends tracked x9 -> x11 as the source cell left) — but the pinch
also dislodges an interior cell once its neighbor leaves and
unbalances it: mid-wire gap -> open circuit -> flux ~3. The
drive survives topology loss at the ENDS, not in the middle.

WIRE MERGE (wmerge): two free parallel wires, terminals pinned
so current survives, interior free. At mag=8/12/16 the result is
identical: 2 cells adjacent to the pinned ends leave early
(asymmetric pinch at the boundary), the remaining 10 hold
sub-threshold forever — sep frozen at 2.00 for 120 ticks.

THE YIELD BARRIER — the deep result: steady magnetic force
below a hop threshold does NOT accumulate into motion (momentum
drains faster than it piles up — lattice rigidity / a static-
friction analog), and force above it scatters cells off their
lanes ballistically. There is no regime where the force does
SUSTAINED slow work on free cells. Combined with balanced
interior pinch, self-confinement is doubly blocked:
  (1) interior equilibrium  -> net force only at ends/defects
  (2) sub-threshold rigidity -> sustained slow migration absent
What WOULD work, in order of substrate-honesty:
  a. momentum accumulation (weaker drag / bigger reservoir)
  b. pulsed drive (force spikes over threshold, discrete creep)
  c. cells bound to conduits (scaffold) — or the current living
     in the CONDUIT (even cells), not the cells, so structure
     motion can't kill it — the deepest option: make conduction
     a property of the committed lattice itself.

## Vacuum polarization — the empty-conduit wave (qVacPol + fluxV)

(engine change + charge-circuit.mjs --mode=wavevac)

THE ONTOLOGY MOVE: flux[] on an ODD cell is a current element (recent
charge throughput); flux[] on an EVEN cell is now the field's
orientation state — same register, two populations. "Vacuum" here is
uncommitted-but-polarizable structure; a COMMITTED conduit is
polarized vacuum literally (paired winding = aligned channels).
Vacuum polarization = the conduit's own registers reorienting to a
changing disturbance WITHOUT pushing a charge carrier. fluxV[3] is
the conjugate momentum — the wave's second variable.

THREE LOCAL RULES, all inside existing machinery:
  write — a touching odd cell's Δflux (flux−fluxP, so DC holds a
          steady poling without re-driving it) adds into the
          committed conduit's flux[]: the carrier poles the medium.
  wave  — on committed evens only: fluxV += Laplacian>>qVacPol,
          flux += fluxV, over committed even neighbors. Bare
          structure carries the disturbance; uncommitted cells
          carry nothing (deg=0 freezes). Polarization persists —
          a static field needs no upkeep; only CHANGE induces.
  read  — the conduit itself becomes an induction source: the
          qMagInd Lenz EMF fires on en's own Δflux, pushing charge
          of EVERY massive odd cell touching it. Under qIndLoad the
          FIELD pays (en.flux debited) — detector loading
          attenuates the wave.

MEASURED (21-even zigzag line x=10..30, --shift=0 conduction dead):
  PURE (no mass/charge ANYWHERE — ghost drive on head even):
    bipolar 8t pulse -> a dispersive packet ~5 cells wide travels
    the full line at ~0.4 evens/tick (2–3 ticks/link, group
    velocity < causal max — a real wave, not teleportation).
    Full crossing every even; ev24=0 ev25=0 — no carriers touched.
    At the tail the packet keeps ringing at amplitude ~2000–2900.
    Head even retains a static polarization remnant after drive
    ends — a DC poling that persists, as it should.
  BROKEN LINE (skip=10): wave stops dead at the missing even,
    energy piles up and RINGS backward (reflection at an open
    boundary — amplitude swings ±4800 at the break cell); every
    cell past the gap stays exactly 0. Detector dead.
  vacpol=0: dead everywhere, trivially.
  ind=0: wave propagates identically — the EMF read is correctly
    a separate law from the propagation.
  END-TO-END (antenna odd cell poles head; detector odd cell at
    the tail): det_q stays 0 until t≈55 — the packet's arrival
    time at v≈0.4 evens/tick — then moves (ev24=77, det_q −21,
    det flux +26 Lenz-signed against the arriving −flux). A
    CAUSALLY DELAYED response: mass at the far end acts only
    after the state-change physically reaches it.
  FIRST-RUN CONTAMINATION CAUGHT: at --shift=4 det_q ramps 12→93
    from tick 1 — ordinary Ohmic conduction of the detector's own
    charge through the committed line, not the wave. shift=0
    isolates the EMF channel.

WHAT THIS IS: "light" in the substrate's honest terms — a
propagating local state-change observable only through what mass
does at the ends. No photon register, no traveling object; the
photon-analog is the CHAIN of local updates, exactly the measured
ontology. It rides COMMITTED structure only — waveguide optics,
not free-space radiation: uncommitted cells still carry nothing,
so a true vacuum-to-vacuum hop remains absent by construction.

WHAT IT FIXES ELSEWHERE: the deepest self-confinement obstruction
was "current dies when matter moves" — the circuit lived on
matter cells. The conduit now carries a real dynamical state of
its own: the plasma-and-lattice separation has inverted, at least
for the field half.

## Pulsed-drive creep (wmerge --strobe) — threshold, not integral

Strobing the drive (1 tick on per N) at mag=6–16, strobe=4–8:
identical yield-barrier outcome — 2 boundary cells leave early,
the rest freeze at sep=2.00 for 150 ticks. The strobe hypothesis
DIES cleanly: momentum drains every tick, so a pulse that doesn't
clear the hop threshold in ONE tick contributes nothing — force
is a per-tick threshold comparison, not an accumulated integral.
The missing ingredient for creep is therefore a momentum
reservoir / yield-accumulation register (the "another layer" the
offer mechanic would need) — not a timing trick on the drive.

## The conduit as mechanical terminus — field force + the bottle

(engine change + charge-circuit.mjs --mode=fpush / --mode=fwire)

FIELD FORCE (engine): the qMagKick Ampère law gains a second
terminus species — f_cell . f_conduit dots the cell's flux against
the conduit lattice's own poling. Aligned -> pulled toward the
polarized structure; anti-aligned -> pushed off. ev26 = delivered
impulse. Works on EMPTY conduit: the field is lattice-resident —
it keeps pushing after the matter that wrote it is gone.

CALIBRATION (fpush, ghost cell flux=200 vs ghost conduit B=400,
mag=10): +78.0/tick aligned, -78.0 anti (both signs), exact zeros
for no-field, static cell, and perpendicular field. Magnitude
200*400>>10 = 78.125 -> 78 measured. ev26 = 4*78*50 = 15600 exact.

THE BOTTLE (fwire): ghost-poling the wire's conduits makes field
WALLS — the magnetic-mirror insight: cells are pushed AWAY from
anti-aligned walls, so interior cells see balanced ±x pressure.
Measured on the free-wire pinch fixture (L=8, V=128, mag=16 —
the slow-erosion regime):

  B=512 (~pinch strength): interior STABILIZED — 8 contiguous
    cells survive 200t (x11..x25) vs 7 gapped for unpoled. The
    field walls measurably prevent interior gaps. Anti vs
    aligned poling: same survival, different flux profile —
    prevention works because it counters momentum BEFORE yield,
    not because it restores.
  B=2048 (4x pinch): WORSE — the walls themselves erode the
    structure; drain end x25 now lost too. A confinement window
    exists: field must match the stress it counters.
  Mirror caps (x8/x26, aligned): no end rescue — the x9 source
    cell escapes TRANSVERSELY (hops diagonal, leaves the y=16
    lane entirely; verified: gone from y13..19, not just the
    row). A uniaxial wall can't catch a diagonal hop.

HONEST VERDICT: medium-resident force is real, calibrated, and
does preventive work — the wire interior held against pinch for
the first time in any free fixture. But a 1D wall only confines
along its axis; the end failure is transverse escape. Full
bottle needs a poled SHEATH (2D wrap around the wire) or a
toroidal poling pattern — the medium can carry that structure;
it's a fixture-complexity question, not a missing law.

## The conduit vessel + the strain reservoir (qFieldReact)

(engine change + charge-circuit.mjs --mode=fsheath / wmerge --react)

FULL VESSEL (fsheath): commit the 4 transverse evens around every
wire cell (±y,±z sheath) plus end-cap evens past each terminus —
a committed conduit CAGE wrapping the wire. Ghost-poling makes it
a pressure vessel:
  sheath ANTI + caps ALIGNED: 8 contiguous cells stable 200t
    (x11..x25) — best free-wire result; only the drive-end cell
    still leaves (its pinch is strongest and it's the terminal).
  sheath ALIGNED + caps ANTI (inverted): 6 cells, front half
    eroded — the polarity signature proves the walls do the
    holding, and which direction.
  B=1024: same hold; INVERTED also holds 8 — any wall strong
    enough beats erosion at this regime.
  drive control (no pinch): bare vessel conducts perfectly —
    the cage doesn't cost the healthy wire anything.

SELF-POLED VESSEL (vacpol): RUNAWAY, and now understood — the
poling write can only add the cell's Δflux sign, which is
ALIGNED = pulls cells toward walls = the wrong sign for a
bottle. Worse, erosion itself writes −Δ (dying flux) that grows
the anti-field into a death spiral: field scatters cells, cells
lose flux, flux writes more field. Measured: sheath_flux
−9210 raw, wire gone by t~75 without loss.
  FIX: even-flux resistive decay (flux -= flux>>6 in the wave
  pass) — an unsustained field bleeds off; steady state becomes
  injection/decay-bounded. Doubles survival to ~t150, still
  terminal. Honest physics: a self-written vessel needs the
  ANTI sign, which this write rule can't produce — the
  spheromak's j×B geometry isn't the parallel-attract form.

STRAIN RESERVOIR (qFieldReact + FIELD_REACT): Newton's third law
onto the medium — kicks crossing a committed conduit deposit
the counter-impulse into its fluxV (4-pair axis impulse); each
touching cell then receives fluxV>>react per tick, debited 4x
from the conduit — elastic strain that spends what it stores.
  VERIFIED mechanically: ev27 press delivered (fsheath runs).
  THE NULL THAT TEACHES: in wmerge the wires' attraction kicks
  are symmetric (+y/−y) — the counter-impulses CANCEL on the
  shared conduit. Internal equal-opposite forces build zero
  reservoir — the medium conserves the pair's momentum exactly.
  No free creep from inside; the reservoir fills only under
  asymmetric external forcing.
  And in the free wire, pinch erosion is RARE THRESHOLD EVENTS
  (ev21 ≈ 8 pair-impulses total), not steady force — sub-16
  deposits sit below the press floor. The yield barrier is now
  triply characterized: per-tick threshold, no sub-threshold
  accumulation channel, and symmetric internal forces can't
  self-fund a reservoir.

## Strain reservoir tail-work + the three poling write rules

(engine + charge-circuit.mjs --mode=rfill / fsheath --polprop)

TAIL-WORK VERIFIED (rfill): cell A + poled conduit E, field B=400
held 40t then killed, probe electrode seated on E's far side.
  react=4: fluxV fills to -408 (asymmetric — field-force kicks
  deposit one-sided counter-impulse, no partner to cancel);
  back-reaction drops net force 78->33/tick. After field death
  the stored strain keeps pressing: ev27 +396 tail, probe takes
  -48 net momentum, reservoir drains to the -12 floor. The medium
  spends stored strain on matter with no live field — delayed
  work, measured.
  react=1: fluxV stays EXACTLY 0 and ev27=ev26 (12792=12792) —
  the tight-coupling limit is a perfectly elastic medium
  returning the full counter-impulse same-tick. Newton's third
  law as a rigid wall.
  CONSERVATION FIX: uncapped shift<2 drained 4t>|v| per tick —
  sign-flipped the reservoir and minted momentum in a ±312
  limit cycle (ev27 +49920 with a dead field). Debit now capped
  4t<=|v|; react>=2 was always safe.
  ALSO: strain strands when no visitor remains (v frozen with
  no touching mass — stored, not lost; physically correct).

THIRD LAW DEPOSIT NOTE: the earlier "no fluxV" diagnostic read
conduit flux[], not fluxV[] — deposits were always landing;
fluxv_get/set exports added for direct reads.

THE THREE WRITE RULES (self-poling, fsheath):
  qVacPol=+6 (paramagnetic Δ-write): sheath -414, runaway —
  erosion -Δ spikes dominate; wire dies (1 cell @200t).
  qVacPol=-6 (diamagnetic Δ-write, NEW): sheath -407 — the
  write flips sign correctly but the outcome doesn't: the
  Δ-store is HISTORY-driven (ramp + death spikes), not
  field-proportional-to-I. Both signs end anti-400 via
  different routes; both destroy the wire.
  qPolProp (NEW, field ~ ±I_live relaxation): the write that
  was missing. -4 writes the anti-sheath correctly (-117,
  no runaway, 7 cells = baseline, benign). -2 spreads the
  field over the vessel via the wave pass (-34/site, 6 cells).
  SCALING OBSTRUCTION, now quantitative: self-written field
  caps at ~live current (~50-100/site); the ghost vessel's
  working confinement needs ~500/site = ~10x current. A wire
  cannot amplify its own field — self-confinement by this
  route needs either gain (strain accumulation over time,
  i.e. the fluxV reservoir as the field's integrator) or a
  geometry that concentrates the write.

WALL-PRESSURE / STRAIN-STALL (fsheath --wall --stall):
  TWO DEPOSIT SITES exist — face-touch (carrier momentum incident on a
  touching committed conduit) and transit-wake (momentum carried through
  a conduit at the crossing). FIRST VERSION debited carrier momentum at
  both sites: charge-jam — relays slow, same current piles onto fewer
  cells, flux inflates 48-74 vs baseline 3-13, flux^2 force feedback
  accelerates erosion (all wall runs 6 cells, WORSE than 7 baseline and
  8 ghost). Charged-jam diagnosis: any mechanism that blocks or taxes
  relays inside the wire corrupts the current record — yield is binary
  (zero momentum = pinned, nonzero = gone), there is no sub-threshold
  "slow", so a toll below yield can only jam, never brake.
  RECORD-ONLY fix (both sites now write 4*s*sign into conduit fluxV,
  no carrier debit): jam GONE — flux tracks baseline exactly
  [28,13,10,7]->[3,3,3,3], cells restore to 7 (bare) and 8 (ghost+wall
  unharmed). ev27 counts deposits: 80 bare / 24 ghost / 64 no-vessel.
  HONEST NULL: stall=16 never bites — bare+wall and bare+wall+stall are
  identical. The wire sheds only ~2 cells (~5 transits across ~80
  conduit faces); no wall sees the ~16 strain needed to deny a relay,
  and the deposit lands AFTER the relay decision — the first crossing
  is always free. Wrong-scale result, recorded: the mechanism is
  correct and conserving, the fixture's erosion budget is too thin to
  charge a wall before the wire stabilizes.
  react=4 press channel still actively harms (wire dead by t=50):
  deposits land on WIRE conduits along the force axis, so the press
  feeds longitudinal jitter = extra dislodging kicks, never transverse
  wall pressure. Erosion cannot fund walls under force-pair deposits.

FUSE-ORDERING FIX (stall gate ordering revisited):
  Original order was a BREACH COUNTER: stall check read CURRENT
  strain, hop executed, deposit wrote NEXT — the deposit could not
  inform its own relay decision (first crossing always free), and a
  denied attempt deposited nothing (wall learned only from breaches,
  never from resistance; sustained pressure was invisible).
  Fuse semantics now: stall tests ws + in_flight dep >= threshold,
  and a DENIED attempt still writes its strain (the pressure was
  real even though the relay wasn't). Attack funds defense;
  resistance ratchets the wall harder each retry.
  MEASURED (fsheath --wall=1 --stall=8, 200t): escaper impulse
  dep=4*(|pd|>>1) ~= 8-12, so stall=8 catches the first attempt on a
  virgin wall. bare+wall+stall AND no-vessel+wall+stall both hold 8
  CONTIGUOUS cells at x9..x25 — INCLUDING the drive-end terminal the
  authored ghost bottle always loses (ghost: 8 at x11..x25). ev27
  ~40-47k = denied attempts re-pressing and ratcheting each tick.
  Flux decays identical to baseline — no charge-jam; mass held while
  current flows = confinement, not freezing. First self-organizing
  confinement that matches and locally exceeds the authored bottle,
  needing no field, no poling, no vessel geometry — the wall is
  emergent in the lane itself.
  CONSERVATION CAVEAT (resolved below): stall/ratchet deposits were
  UNPAID records in fluxV — the same register qFieldReact's press
  treats as spendable momentum.

REGISTER SPLIT (the honest fix — measured):
  momentum[be] is only the hop's ROUTING TICKET (|p| 1-3 picks the
  channel; the impact energy is not in it). The lane's real history
  currency is winding[] — free bookkeeping, never spent as momentum.
  fluxV is now STRICTLY PAID: FIELD_REACT counter-impulse + denied-
  hop absorption only. The two unpaid writers (face-touch record,
  transit-wake record) removed — a successful crossing leaves no
  strain (its momentum traveled with it); a truck crossing a bridge
  doesn't leave momentum behind.
  STALL = lane fatigue: ws = winding wear on the channel pair;
  fuse test ws+1 >= stall (THIS attempt counts); denial wears the
  lane (+1, ratchet) AND absorbs pd into fluxV 1:1 (inelastic catch).
  Allowed crossings wear too (write extended to qWallStall).
  MEASURED (fsheath --wall=1 --stall=4, 200t): 9/9 cells held at
  x9..x25 INCLUDING the drive-end terminal — flux trajectory
  identical to the no-pinch drive control [53,50,50,50]. Better
  than the authored ghost bottle (8 at x11, loses terminal) and
  better than the unpaid-strain version (8 cells). ev27=4324 paid
  absorptions. MECHANISM: traffic-induced rigidity — every lane
  that sees ~4 transits (crossings + denied retries) work-hardens
  shut; mass cannot relocate but the charge channel (incip offers)
  is untouched — a conductor that rigidifies BECAUSE it is
  conducting. No field, no poling, no vessel geometry — the wall
  is emergent wear-history in the lane itself.
  RESERVOIR ANSWER: fluxV is the medium-side momentum reservoir we
  were looking for — but only denied momentum legitimately arrives
  (momentum with no kinematic outlet). It is not the carrier-side
  creep register — that would live on the cell, accumulating
  sub-threshold impulse on the carrier itself; still unbuilt.

CREEP REGISTER (the third reservoir — built + measured):
  NodeState.creep = per-cell pressure history: +1 per denied relay
  (pushed-and-failed record; rides the body on hop like momentum).
  qCreepYield = rupture threshold: at creep>=yield the cell squeezes
  through the fatigued lane once, spending the record (plastic
  flow). ev64 counts yields. Subtlety found: moore26_events()
  clamped i<64 — index 64 unreadable; array now [80].
  MEASURED (fsheath stall=4): creep=4 yields almost immediately
  (ev64=4/2, cells collapse to baseline-7); creep=50 holds ~50t
  then discrete ruptures peel cells (9->6->3 over 150t). The wall
  is no longer binary: stall sets lane fatigue (how much traffic
  hardens it), creep sets rupture strength (how much sustained
  pressure breaks through) — the two ends of a stress-strain
  curve, tunable. Surviving carriers show elevated flux (same
  current through fewer cells — geometry, not jam).
  THE THREE REGISTERS, finally separated: winding[] = lane history
  (free bookkeeping), fluxV = paid medium momentum (counter-
  impulse + absorbed denial only), creep = cell pressure history
  (free bookkeeping, spent on yield). Conservation honest
  throughout: denied pd is paid into fluxV 1:1; creep is a record
  of events that really happened; yield spends the record.

ELASTIC REGIME (wall+react, the closed loop — measured):
  --wall=1 --stall=4 --wallreact=4: 9/9 cells held AND ev27 rose
  4324 -> 32544 (7.5x). The loaded wall presses its PAID strain
  back onto the pressing bodies: mass denied, momentum returned —
  exactly what a real wall does. The yield barrier's void-sink is
  now a closed loop: kick -> denial -> stored strain -> press back
  -> impulse delivered. Third-law accounting WITH A DELAY: the
  medium is a momentum bank, not a graveyard.
  THE FULL RHEOLOGY now exists end to end, all from bookkeeping:
  ELASTIC (react: store+return), YIELD (stall: lanes work-harden
  under ~4 transits), PLASTIC FLOW (creep: sustained pressure
  ruptures at threshold). Stress-strain response with no authored
  force law — emergent from the relay ledger + three registers.

STALL SWEEP (fatigue law shape — measured): stall=2,3,8,16 ALL
  hold 9/9 cells with IDENTICAL ev27=1924 @100t. The threshold is
  not a cliff — it's a latency knob. A denied cell re-presses its
  lane every tick (momentum persists), ratcheting wear past any
  threshold in ~stall ticks. Once locked the dynamics are the
  same, and total absorbed impulse = the momentum that would
  have escaped — a conserved, threshold-invariant quantity.
  The wall is the DEFAULT response of a lane under sustained
  pressure, not a fragile tuned artifact.

WALL RINGS (stall + vacpol wave — measured): --wallwave=3:
  vessel+wave: 9/9 held, sheath_flux +17->+35 (strain couples to
  the field channel — the wall rings onto committed structure).
  NO vessel + wave: 9/9 held but ev27 = 116,559 — 60x the
  wave-off absorption. Strain doesn't sit, it RADIATES: the wall
  accepts impulse and sheds it as field waves continuously.
  A fatigue-locked wall on a radiative medium is a DAMPER —
  it dissipates incoming momentum into the field rather than
  storing static stress — and dissipation doesn't weaken the
  lock (winding keeps the lane shut regardless).

WMERGE CREEP (honest null): creep=8 congestion-rupture enabled,
  sep=2.00 flat, ev64=0, all cases. No denied relays ever occur —
  the wmerge yield barrier is UPSTREAM OF THE RELAY: interior
  cells never get hop-worthy momentum at all. Creep integrates
  only pressure that exists; this barrier lives in the kick
  channel, not the gate channel. (Diagnostic path: probe
  momentum[] on interior cells mid-drive.)

SPRING-PROBE — the wall AS BATTERY, calibrated end to end
  (script/cascade/spring-probe.mjs: one kicked cell vs one
  pre-worn stall conduit, full p+fluxV ledger per tick):
  CHARGE: denied momentum -> fluxV at 100% efficiency, LINEAR
    (p=3200->fluxV=3200; p=1600->fluxV=1600; ledger pins exact).
  HOLD: react=0 stores the full charge indefinitely — 3200 units
    sat untouched 30+ ticks, zero self-discharge.
  DISCHARGE: the press is CONTACT-BOUND — a touching cell gets
    min(|v|>>react, |v|>>2) per tick over 4 pair channels.
    react<=2 dumps ~everything in one tick (stiff spring:
    3200 back in a single tick, then the cell re-presses and
    gets re-caught — bounce/rebounce, ev27=8000 total cycles).
    react=4 releases ~25%/tick exponential (soft spring).
  RESIDUAL: once the carrier breaks contact the press stops and
    leftover strain LOCKS IN (1128 left forever at react=4) —
    the battery only discharges to a customer that stays.
  The spring constant IS the react shift; the battery's
  terminal is physical contact. Energy is not what a thing
  has — it is what the ledger cannot lose.

  THE DEEPER FRAME (worth stating): the substrate is a
  relational ledger where the grain is HISTORY, not geometry.
  Winding wear, creep pressure, fatigue locks, strain charge —
  every "material property" measured so far is a record of
  what happened, not a property of the site. There is no
  thing-table; structure is what the ledger remembers.

  THE DETECTION PROBLEM (why a substrate hides): the only
  instruments available are made of the substrate, so every
  measurement returns substrate-normalized numbers. Nobody
  inside the lattice can see "1 hop/tick" — what they can see
  is exactly what we measured: a linear medium with a wave
  speed, impedance set by connectivity, resonators that
  charge like capacitors, and momentum that conserves. The
  lattice is invisible TO the wave precisely because the
  wave's conservation law is written in lattice registers.
  Ticks and links are the only honest units until a second
  independent constant lands in SI.

LAYOUT API — moore26_node_off(fid), and the audit that forced it
  Raw-register harnesses used to keep hardcoded NodeState byte
  offsets. The struct grew (incipOp inserted at +234, strainBank +
  chargeFlight before phase, creep at the tail) and EVERY table
  silently rotted — seven harnesses (ageprobe, epochclock,
  fluxprobe, latency, moveclock, phaseclock, wakeprobe) were
  reading wrong registers while running "successfully". fluxprobe's
  node_size guard only checked a minimum, so 568 >= 444 passed
  while every field past incipBorn was off by +26..+48.
  Fix: int moore26_node_off(int fid) in the engine resolves
  offsetof(NodeState, field) live (fids 0..32, -1 unknown);
  script/lib/m26.mjs exports nodeOff(q) -> {winding, massFlight,
  ..., creep} and all seven harnesses now use it. node_size stays
  the stride. Any future harness touching raw registers MUST use
  nodeOff — never a literal.
  Bonus find in latency.mjs: it viewed the wasm buffer from byte 0
  WITHOUT the state_pointer() base — it had been reading an
  unrelated memory region all along. Fixed; first correct run:
  meanAckRtt~11.0, meanBondDist~2.8 (previously-reported 5.38 was
  garbage memory, not a measurement). wakeprobe -/- under the stale
  table now reads real hemispheric ages (t=2000: lo/hi ~1478/1477 x,
  ~1459/1498 y — a real accretion age field, nearly isotropic at
  bath=0.02). phaseclock: inner phase ~500 vs shell ~129, work/t
  ~0 — phase advances without txn work (the qTick drumbeat, not
  paid labor). moore26-harness (128^3 string scen): runs clean,
  185ms/tick — but zero mass/zero events in 1000t; flagged, needs
  scenario re-tuning, not offset-related.

SPRING-HANDOFF — the battery's second customer (fungibility)
  (script/cascade/spring-handoff.mjs: charge wall at react=0, then
  swap/duel customers on opposite faces):
  SWAP: wall charged to fluxV=3200, carrier deleted, fresh cell B
    seated on the FAR face. react=2 flips on -> the wall dumps the
    ENTIRE stored charge into B in one tick (4 channels x 800) and
    B launches +x at hop speed. The charge is fully fungible —
    the reservoir doesn't care who paid it in.
  DUEL: A (near face, lower si) + B (far face) both touching.
    A drinks the whole reservoir at t=12; B gets only the 800 that
    trickles through A's next denied hop at t=13. Serving order =
    si scan order, first-come-per-tick, no queuing fairness.
  EXIT LANES: the press spreads the returned impulse over all 4
    FCC pairs of the axis — the discharged customer does NOT
    ricochet straight back through the (still stalled) lane, it
    exits along the least-worn diagonal. Rebound angle is set by
    the medium's channel geometry, not the incident direction.

CARVE-LANE — lane history vs matter throughput (qCarveLoad)
  (script/cascade/carve-lane.mjs: dense slug tearing into a
  partially-filled dest through a conduit held at seeded incipient
  load). Measured single-hop response curve, src=60000 dest=40000:
    load<16            -> tear = 7500  (src>>3, baseline)
    16<=load<32        -> tear = 15000 (src>>2, CARVED 2.0x)
    load>=32 (stall)   -> tear = 0     (congestion denial, creep)
  Control carve=0: the middle regime collapses to baseline — the
  delta is the carve LAW, not the incipient presence.
  HONEST FRAME: lane history changes THROUGHPUT (merge quantum per
  hop), not propagation speed — the hop is still 1 cell/tick. For
  the Fermi-analog: packets remain ballistic-absolute; matter
  throughput bends to traffic history. Congestion widens the
  squeeze — it doesn't speed the walk.
  ARTIFACT NOTE: re-seeding moore26_incipient_set every tick is an
  INJECTION PUMP — each armed incipient carries nu=1 real energy
  that confirms into mass (+24/tick measured, landed on cells
  adjacent to the conduit). Not a conservation bug — the driver
  was feeding the lane. Single-tick measurement avoids it.

MOORE26-HARNESS — dead-grid guard (found while auditing):
  NodeState grew to 568B -> 128^3 needs ~2.4GB for both buffers,
  calloc fails in wasm, init falls into the dead-but-safe path
  (grid_current=NULL, every getter 0) — and the harness reported
  all-zero telemetry for 1000 "ticks" at 185ms/tick (the cost was
  the JS getter loop itself). Now guarded by _moore26_grid_ready()
  at init (initM26() in m26.mjs does init+check together). At 64^3
  the string scenario is healthy: break=1 at ~t20, mass spike,
  winding drain — the classic fracture signature.

STRAIN-WAVE — the medium has sound (script/cascade/strain-wave.mjs)
  A committed {1,1,0} wire of 16 conduits (winding 6/7=64 each),
  fluxV=2000 injected at link 0, qVacPol wave layer on.
  PROPAGATES: the stored strain rings down the wire as a
    polarization wave — oscillating, reflecting off the free end,
    sustained front ~2.3 ticks/link = 0.43 committed-link/tick
    at vs=3. First arrivals L1..L15 = t2..t34, near-linear.
  COUPLING-DEPENDENT: vs=6 slows the front (~0.19 link/tick) and
    SELF-EXTINGUISHES at link 7 — the Laplacian needs gradients
    >= 2^vs to register, so a spreading wave falls below its own
    visibility threshold. Weak coupling also PILES amplitude at
    the source (~12000 from a 2000 injection — fluxV keeps
    integrating into flux while neighbors drain slowly).
  CONTROL: vs=0 -> the phase is skipped entirely; the charge
    freezes on link 0 forever. The battery's ONLY self-discharge
    channel is radiation into committed structure — no medium,
    no leak. A charged wall in vacuum-structure is perfect; a
    charged wall in a committed lattice is an antenna.
  THIS CLOSES THE LOOP: the same register (fluxV) is the battery's
  stored momentum AND the wave's momentum. Catch -> hold -> press
  back -> or radiate away, all one conserved currency.

STRAIN-RELAY — force transmitted THROUGH the medium (Newton's
  cradle, substrate edition; script/cascade/strain-relay.mjs)
  The complete causal chain measured end to end: carrier A denied
  at a stall wall (link 0 of a committed {1,1,0} wire) -> 3200
  units of paid momentum land in the wall's fluxV -> the vacpol
  wave propagates the strain down the lattice -> a receiver cell
  touching link 4 is pressed at t=7, a receiver touching link 8
  at t=11 — pushed by a collision it never saw, through a medium
  that remembered it.
  DELAY IS REAL: ~1t/link effective press-arrival (the press
  threshold |v|>=4 triggers before the flux front peaks —
  consistent with the 2.3t/link wave speed measured in
  strain-wave).
  RINGING, NOT DC: fluxV at link 8 oscillates +-350 — the medium
  transmits an oscillatory strain packet, not a steady force.
  Net delivered momentum is small (the receivers hopped away on
  ~12 units) — most of the deposited charge sloshes in the wire
  or bleeds resistively. The medium telegraphs force lossily.
  CONTROLS (identical A-bounce, receivers untouched):
    vs=0   — wave layer off: charge stays on the wall, tN=tF=-1
    nomed  — wire uncommitted: deg=0 freezes the wave at the
             source, tN=tF=-1
  So momentum crossed the lattice without matter: the substrate's
  phonon channel. The wall didn't push the receiver — the history
  stored in the conduit lattice did.

STRAIN-INTERFERE — the wave is LINEAR (superposition proven)
  (script/cascade/strain-interfere.mjs: pulses injected at both
  ends of one committed wire, three arms):
  ANTI (+2000 left, -2000 right): mirror-antisymmetric field held
    12+ ticks; the packets cross mid-wire and PASS THROUGH —
    by t=28 the negative packet sits on the LEFT, positive on
    the RIGHT. E_total dips to 17337 at the crossing then
    rebuilds: destructive interference is TRANSIENT, not
    absorption. Linear superposition confirmed.
  SAME (+2000 both ends): mirror-symmetric field, center flux
    peaks 9805 vs 5251 lone — ~2x constructive.
  CAVEAT: the field norm is NOT energy. Measured: injected
    fluxV=2000 -> Sigma(f^2+v^2) grows 4M to 356M over 60t;
    Sigma v^2 decays 4M->0.7M while Sigma f^2 climbs to 356M.
    The injected momentum converts to a QUASI-STATIC compression
    field (~15k/link x 16 links) — the wire DC-absorbs momentum
    into static strain, like a spring pressed and held. The
    conserved currency remains the deposit/press ledger.

STRAIN-SPLIT — the medium has IMPEDANCE (junctions scatter)
  (script/cascade/strain-split.mjs: committed wire, 8-link
  incident arm -> junction -> 0/1/2 outgoing arms):
  Y-JUNCTION (deg=3): transmission splits EXACTLY 50/50 between
    the two outgoing arms (peak flux 3452 each — mirror-symmetric
    arms, mirror-symmetric split). Per-arm amplitude = 0.66 of
    the no-branch thru arm — matching the Kirchhoff expectation
    t=2/3 for a 3-edge star. The degree in the Laplacian IS the
    medium's impedance.
  THRU (deg=2 control): junction flux 3420, arm peak 5242.
  DEAD END (deg=1): flux piles at the junction to 7415 (2.2x
    the thru case) — a fixed-end standing-wave pile-up; the
    incident arm rings up to ~8000.
  No negative flux anywhere: flux is a DC-offset integrated
    quantity, so reflections superpose positively — read
    reflection as junction pile-up, not sign flips.
  ENERGY CAVEAT (same as interfere): Sigma flux^2 grows during
    ringing — the fluxV->flux leapfrog is not norm-conserving.
    The split ratio, not the absolute amplitude, is the robust
    observable.

HEXBUCKLE-ENSEMBLE — dead-grid regression FIXED
  The 128^3 default silently calloc-failed (568B NodeState x2
  buffers > wasm heap) and 120 trials ticked a NULL grid:
  all-zero chpol, brk=0. Now initM26-guarded + --w=64 default.
  FULL ENSEMBLE (n=12, t=60, 64^3): curvature screens the
  charge dipole non-monotonically — dip8 -29%, dip16 -36%,
  dip24 -35%, dip48 -18% vs flat 25128+-4861. Screening
  peaks at dip16-24 then recovers at deep curvature. All
  84 runs fracture-free: this is ELASTIC screening by the
  bent tube, not break-related.

STRAIN-SPLIT + DISPERSION — the medium's full wave spec
  JUNCTION IMPEDANCE (strain-split.mjs): a deg=3 Y-junction
    splits transmission EXACTLY 50/50 between mirror arms at
    0.66 of the deg=2 thru amplitude — the Kirchhoff t=2/3.
    A deg=1 dead end piles flux 2.2x at the junction
    (fixed-end standing wave). The Laplacian's degree term
    IS the impedance; there are no negative flux reflections
    because flux carries a DC offset — read reflection as
    junction pile-up.
  DISPERSION (strain-wave vs sweep): wave speed follows the
    discrete wave-equation law c ~ 2^(-vs/2) up to the
    stencil's causal ceiling: vs=1 ~1.0, vs=2 ~0.55,
    vs=3 ~0.43, vs=4 ~0.30 link/tick. Weak coupling self-
    extinguishes — the pulse front falls below the >>vs
    truncation floor (vs4 dies L11, vs5 L9, vs6 L7).
  AMPLITUDE-INDEPENDENT SPEED: 500/2000/8000 impulses arrive
    within 1-2 ticks at every link — speed is a medium
    property, not a pulse property. Second proof of linearity
    after superposition.
  CAVITY MODE = STANDING WAVE: ringdown envelope returns at
    t~40/57/74/108 for LEN 8/12/16/24 — matching 2L/c =
    37/56/74/112 within ~10%. The ~11t fast peak spacing is a
    SEPARATE clock: the medium's local flux<->fluxV exchange,
    length-independent, set by vs coupling alone.
  STRAIN SATURATION — the medium's first nonlinearity:
    the int16 clamp (flux<=32767) is a YIELD STRAIN. An
    amp=30000 impulse can't raise the field past the clamp,
    so instead of a taller pulse it forms an advancing
    FLAT-TOPPED SHELF (~7 links pinned at exactly 32767,
    sharp leading edge) — a shock-like waveform. Below the
    clamp the medium is exactly linear (superposition,
    amplitude-independent speed); at it, excess strain
    redistributes FORWARD to unsaturated links — the same
    physics as a real material's elastic limit.
  FIELD NORM != ENERGY: Sigma(f^2+v^2) grows 4M->356M/60t on
    a LEN16 ringdown — injected fluxV momentum converts into a
    quasi-static compression field (the wire as a held
    spring). The wave stores DC strain; the conserved currency
    remains the deposit/press ledger.

BENT-WIRE — the wave is GEOMETRY-BLIND (deepest medium result)
  A 90-degree corner in the committed wire changes NOTHING:
  identical arrival ticks, peaks, transmission (1.036 both) —
  BIT-IDENTICAL trajectories. The Laplacian couples committed
  neighbors without any direction term, so the wave propagates
  on the COMMITMENT GRAPH, not through space. Straight chain
  and bent chain are the same graph = the same physics. The
  medium's "distance" is graph-distance; geometric embedding
  is reconstructed, not fundamental. This is the ledger frame
  made measurable: the grain is history (connectivity), not
  geometry — and now we can PROVE the field can't tell a
  corner from a straight line. It also reframes the membrane
  anisotropy: the diamond wavefront isn't the wave preferring
  a direction — the commitment graph itself is anisotropic
  and the wave just follows it faithfully.

FATIGUE-vs-HEALING — the two-clock phase map (fatigue-cal.mjs)
  A lane under sustained 1-denial/tick pressure has TWO failure
  clocks racing: wall HEALING (winding decays w>>wearDecay per
  tick, opens when ws < stall) and carrier RUPTURE (creep +=1 per
  denial, yields through once at creep >= qCreepYield, ev64).
  Map at stall=200, marginal wall seeded ws=stall+20:

    HEALING PHASE (decay <= ~6): heal time scales ~4x per decay
      step — d4: 3t, d5: 6t, d6: 23t. Rupture wins iff
      creepYield < healT: cy=20/d6 yields at t=21 beating the
      t=23 heal; cy=22 loses. Sharp boundary cy* ~= healT - 1.
      Loser's record resets: creep reads 0 after a heal-escape.
    LOCKED PHASE (decay >= 7): fatigue is SELF-SUSTAINING — the
      +1/denial ratchet outpaces healing, ws equilibrates ABOVE
      stall (d7: ws->237 vs stall 200; d8: 280 pinned). Healing
      never opens; rupture is the ONLY escape, firing at
      t ~= cy+1 exactly (cy=40->y@41, cy=80->y@81, cy=60/d8->y@61).
    CONTROL (decay=0): cy=30 -> y@31 — one creep per denied tick,
      no stochasticity. The rupture clock is deterministic; only
      the heal clock carries rand_site noise.

  The physical read: a fatigue-locked wall is a RATCHET — while
  pressure persists, denial wear refreshes faster than memory
  fades, so the lock is permanent and the only way through is to
  break (plastic yield). Reduce the decay persistence far enough
  (d<=6 at this pressure) and the wall becomes a fuse with a
  stochastic melt-time; whether the carrier ruptures through or
  the fuse melts first is set by cy vs healT (healT grows
  super-exponentially in decay near the ratchet/decay balance —
  3/6/23t at d4/5/6 for stall=200, margin=20).
  Combined with stall* ~ 2^(decay+~1.2): the (stall, decay)
  plane splits into OPEN / RUPTURE-WIN / LOCK-then-rupture
  regions — a three-phase failure diagram from two registers.
  REFINEMENT (stall-scaling + the equilibrium reframe):
    Locked-phase ws settles at ws* ~ 2^(decay+~1) regardless of
    stall — d6 -> 121-128, d7 -> 237, d8 -> 280 (seed was 220 for
    the d7/8 runs, so 280 is pure ratchet gain). stall* IS that
    equilibrium: lock iff stall < ws*, i.e. the lane holds while
    denial-wear refresh outpaces w>>decay healing.
    healT is margin-driven, not absolute — decay is multiplicative
    (w>>N ~ w/2^N per tick), so a wall seeded stall+20 sheds the
    20-unit margin faster at HIGHER stall: d4 gives 9/5/3t at
    stall 64/128/256 (~2x the pure-decay estimate — the +1/denial
    ratchet halves the net fade). Near stall* the ratchet almost
    balances healing and healT stretches to a plateau (~23t for
    stall 150-200 at d6). cy=150/d7 confirmed yields at t=151 on
    a 300t run — the locked phase never self-opens.

  REPEAT LOADING (fatigue-cal --repeat, successive carriers vs one
  wall): rupture NEVER damages the lane — it feeds it.
    decay=0: every carrier yields at exactly t=31 and the wall
      ratchets +31 wear per rupture (30 denials + the yielded
      transit) — ws 220->251->282->313->344. Plastic flow IS
      work-hardening: the wall gets more fatigued with every
      break it survives.
    decay=7 (locked): same y@31 cadence but ws pins at the
      equilibrium 237-238 — a saturated wall yields carrier after
      carrier forever, damage capped by the ratchet balance.
    decay=5 (healing): wall melts at t=6 before creep can reach
      cy=30 (ev64=0 — a heal-escape, not a yield); once open it
      stays open, later carriers walk through at t=1 while ws
      decays away (191->183).
    The breach is PERSONAL, not structural: creep resets to 0 at
    each yield (carrier#2 needs the full 30 denials — no inherited
    pressure), while winding — the lane's own record — only ever
    grows or fades. A ruptured wall is not a broken wall; it's a
    wall that remembers being tested.

  PORTABLE DEBT (fatigue-cal --inherit): creep is BODY history,
  not site history — a relocating hop carries the register with
  the mass (engine: "creep rides too — pressure history belongs
  to the body that earned it"). A carrier denied 5x at wall1
  that escapes via heal arrives at wall2 with c=5 and yields
  after ~26 fresh denials (vs ~31 virgin — debt carried = 5
  exactly). Two ledgers, two owners: transit-debt (winding)
  rides LANES, pressure-debt (creep) rides BODIES. And a detail
  the trace exposed: a denied hop drains the WHOLE momentum
  register into gate fluxV — sustained pressure requires a
  re-kick every tick; a single kicked carrier presses once and
  sits inert (c frozen at 6) even while denied forever.
  Magnitude-blindness verified: p=50 and p=3200 both yield at
  exactly t=31 — ws+1>=stall counts ATTEMPTS, not force.
  ELASTICITY SHEDS THE PRESSER (fatigue-cal --bounce): with
  fieldReact>0 the wall's press-back returns the denied impulse
  spread across the axis's channel pairs — the carrier is thrown
  off on a diagonal ((7,8)->(11,4) by 200t) and the rupture
  clock stops (maxCreep=6 vs c=30 needed). react=0 yields at
  t=30; react=1/2/4 never yield — ANY elasticity makes a wall
  rupture-proof against an UNCONFINED presser. Plastic flow
  requires sustained contact; a springy wall breaks contact.
  CONFINEMENT FLIPS THE TARGET: a kicked carrier inside a
  fully-fatigued 5x5 ring can't rupture the walls — it TEARS
  ITSELF into ~37 fragments in one tick (256->2816 shed+spawn
  mass, settling ~2212) and the creep record fragments with
  the body (pieces found carrying c=1..9 debts independently).
  Total denial doesn't break the wall; it shatters the presser.
  Rupture (ev64) needs exactly ONE hard contact with nowhere
  else to go — free pressers leave, confined pressers burst.

  BATTERY CAPACITY — the ledger has a page limit, and the
  clamp is a KNOB not a sink (fatigue-cal --cap): fluxV is
  int16, saturates at 32767 (~10 denials at p=3200). First
  measurement caught the clamp DESTROYING the excess: ev27
  credited 131200 while the register held 32767 — 75% of paid
  momentum silently lost. Fix (this engine rev): the catch is
  now capacity-limited — the wall absorbs only what fits and
  the residual momentum STAYS with the carrier. A saturated
  battery is a REFUSAL, not a graveyard: denials still count
  (creep grows, ev27 stops), momentum is never destroyed.
  Verified: one 200000 kick -> fluxV=32767 + carrier retains
  167233, deficit=0; --cap deficit column now reads 0 forever.
  ev27 semantics upgraded: it credits only PAID absorption,
  not attempts — more honest bookkeeping. Consequence worth
  noting: a carrier that yields through a SATURATED wall now
  exits with its residual momentum — hot escapees vs the old
  fully-drained cold exit. On COMMITTED STRUCTURE the clamp
  never binds anyway — the wave carries the excess down the
  wire (|v|sum ~48k, |f|sum ->393k). Capacity is bounded by
  connectivity: a lone cell's bookkeeping saturates; a cell
  embedded in a medium is part of a bigger ledger.

  CLAMP AUDIT — every int16/u16 bound in the engine classified:
    ALREADY FEEDBACK: mass handoff computes room and sheds a
      tear fraction (the tear IS the back-pressure); the wave
      integrator clamps are the measured yield-strain nonlinearity;
      winding/creep caps are history records, not currency.
    FIXED AS BACK-PRESSURE (this rev):
      charge RELOCATION: handoff pays only what the destination
        holds — residual stays with the source; the current-
        element flux writes use the PAID amount (a partially-
        moved charge is a partially-recorded current). Verified:
        carrier+20000 hopping into a saturated cell -> sum
        52767 conserved exactly; the landed body then carried
        the destination's own 32767 onward on its next hop
        (charge record joins whatever body occupies the cell).
      chargeFlight PAIR MINT: qc throttled to both ledgers' room
        — also fixed a latent asymmetric clamp (upper bound only)
        that could WRAP int8, not just leak.
      BOND HANDSHAKE mint (+q/-q pair): now atomic — if either
        endpoint can't hold its quantum neither is written. A
        bond can't mint a charge the ledger can't record.
      HEAT PUMP: k throttled by both endpoints' charge room —
        partial pump conserves, heat stays for later.
    FLAGGED (open design questions, not silent bugs):
      heat 65535 clamps — energy->disorder is one-way mint;
        overflow routing needs a physics decision (radiate?
        shed packets?) not a mechanical fix. ANSWERED below:
        the missing feedback was CONDUCTION, not overflow.
      massFlight 65535 — likely unreachable in measured regimes.
    Regressions after all four fixes: fatigue y@31, deflect-iso
    isotropic, charge-circuit Ohmic sweeps all unchanged.

  HEAT CONDUCTION — the thermodynamic feedback the substrate was
  missing (heat-conduct.mjs): heat minted/drained/re-emitted per
  cell, but NOTHING moved it between cells — a 60000 node beside
  a 0 node never equilibrated. No temperature gradients, no
  Fourier's law: bookkeeping without dynamics, and the 65535 clamp
  bound only because a node that can't conduct can only saturate.
  Implemented qHeatFlow (right-shift, default 0=off): every
  unordered pair of the 26-Moore stencil swaps (ha-hb)>>shift once
  per tick — an antisymmetric discrete Laplacian, EXACTLY
  conserved by construction. Runs as the final tick phase before
  rescan, on the committed-neighbor stencil (geometry-blind like
  every other transport channel).
  Measured (4^3 block @60000 in cold vacuum, vac_rate=0):
    flow  D(cells^2/tick)   sigma^2(t) linear?   conservation
    4     0.58              yes                  deficit=424972 vs ev44=424975
    5     0.29              yes                  deficit=485103 vs ev44=485118
    6     0.14              yes                  deficit=515084 vs ev44=515095
    7     0.07              yes                  deficit=527457 vs ev44=527491
    0     ~0 (control)      sigma^2 frozen 1.3   deficit=drain exactly
  LAWS:
    D = 9.3 x 2^(-shift) cells^2/tick — halving exactly per shift,
      i.e. the conduction rate is 26 pairs x (1/2^shift) against a
      ~3 lattice-geometry factor. sigma^2(t) grows strictly linear
      after ~4 ticks of transient — clean discrete heat equation.
    CONSERVATION: conduction itself loses NOTHING — every unit the
      grid loses matches ev44 (the honest sub-grid drain) to <0.01%.
      Conduction is pure redistribution.
    The drain h>>7/tick remains a genuine entropy export — now
      distinguishable from transport because conduction moves heat
      and drain removes it, both separately booked.
  CONSEQUENCE: heat gradients now relax; the heat pump (heat->
  charge work) can sit across a real hot/cold reservoir pair — a
  Carnot-style efficiency experiment is now possible. The 65535
  saturation risk is largely defused: hot nodes shed to neighbors
  before clamping, so the clamp becomes rare rather than routine.

  THE HEAT ENGINE (heat-engine.mjs) — a closed thermodynamic
  cycle, all four elements measured: HOT BATH (pinned plate)
  --conduction--> PUMP cell --qHeatPump: heat->charge 1:1--> RING
  current --qChargeHeat: Joule mint--> COLD BATH + h>>7 ambient
  drain. Results:
    FULL CYCLE (Th=40000, Tc=4000, Carnot=90%): pump at its 511/t
      cap, ring current I~135, cold bath went NET ABSORBER (Qc<0)
      — heat rejection confirmed. System eta = W/Qh ~0.4%.
    ISOTHERMAL DEMON (Th=Tc=20000, Carnot=0%): IDENTICAL output —
      W=511/t, I~135. The pump converts heat->work from a SINGLE
      uniform-temperature bath: no Carnot bound exists on the
      conversion channel. This is a second-kind perpetual-motion
      machine in classical terms — the substrate's "heat" behaves
      like free energy, not thermodynamic entropy, at the engine.
      The 2nd-law content lives entirely in TRANSPORT (conduction
      is irreversible) and the h>>7 entropy export, not in any
      conversion bound.
    PUMP OFF: W=0, I=0, Qh unchanged — clean control.
    PARASITIC LEAK dominates the system efficiency: the pinned
      bath re-seed cost Qh/t~250K is >99% stencil-conduction bleed
      into open bulk — identical with pump on or off. The engine's
      511/t draw is lost in the noise. Qh is bath maintenance, not
      useful input: insulation doesn't exist on the raw stencil.
    T_pump ~11000 = the ambient conduction equilibrium at that
      site — the pump's heat bank reflects the local bath, not
      its own work history.
  INTERPRETATION: the substrate has thermodynamic transport and
  honest entropy export, but its "engine" is a rate-capped direct
  converter with no temperature-ratio limit — eta is bounded by
  geometry and plumbing, never by 1-Tc/Th. A closed-loop version
  (unpinned baths, Joule return) would wind down only through the
  drain's per-cycle tithe — measure that next if needed.

  THE CARNOT PUMP (qPumpCarnot, heat-engine --carnot) — the
  conversion limit, FOUND. The demon's flaw was structural: it
  DELETED the heat it spent, so no entropy ever had to be
  accounted. The fix is thermodynamic, not a throttle: for every
  w units of charge work the pump must REJECT r=w*hc/(hp-hc) heat
  onto its downstream (cold-side) cell — so eta = w/(w+r) =
  1-hc/hp EXACTLY, the Carnot bound computed from the substrate's
  own locally-read temperatures. ev65 = rejected heat (the
  entropy tithe); eta_pump = ev61/(ev61+ev65) is directly
  measurable. Results:
    STRICT ISOTHERMAL (uniform 8000-heat bath, no pinning):
      ev61=0, ev65=0 for 120t — the demon is DEAD. The pump
      never fires; T_c tracks T_p ~4% hot so it stays refused.
    GRADIENT (Th=40000, Tc=4000, pump on a ring): W~100-140/t vs
      the demon's flat 511/t. eta_pump measured 3.6-7.5% —
      matching the LOCAL Carnot bound 1-T_c/T_p at firing time
      (4.1% vs 3.8% at t=150). Note the bound is set by the
      pump's own cold-side PARTNER (the downstream ring cell),
      not the bath label — correct physics.
    COLD-RESERVOIR-FILLS dynamics: rejected heat piles onto the
      cold cell (T_c: 0->12000) until hc>=hp — the pump STALLS,
      waits for conduction/drain to clear the sink, fires again.
      Stall-fire oscillation = a real engine fighting a warming
      sink; snapshots catching hc>hp show it refused.
    CONSERVATION: pump debits spend=w+r, vi gains r heat, charge
      gains w — nothing destroyed, entropy booked.
  THE CLAIM: nature's conversion limit now lives in the substrate
  — not authored as a cap, but emerging from a structural rule
  (work must be paid with entropy rejected at the cold
  temperature). The 2nd law content splits cleanly: conversion
  bound (this pump), transport irreversibility (conduction),
  entropy export (h>>7 drain). Legacy qPumpCarnot=0 retains the
  demon for funded-EMF fixtures.

  WHY MASS IS SPREAD OUT — the confinement question, measured
  (compress-probe.mjs, compress-collide.mjs): nature's spread
  floor is confinement economics (packing past ~1fm costs hbar*c/
  dx > m*c^2). Does the substrate charge for the same trick?
    HOLDING is FREE: one cell at mass=64800, or 27x2400, or
      125x518 — all inert for 200t. No heat, no shedding, no
      evaporation. Localization costs nothing once achieved.
    COMPRESSING COSTS — but as a RATTLE, not an energy function:
      two full-density 3x5x5 blocks (65535/cell) pressed with a
      sustained vice mint ~50 heat/tick steadily — identical at
      p=800/3200/12800 (magnitude-blind again: the substrate reads
      attempts, not force). The work can't write into full mass
      registers, so it thermalizes at the contact interface.
      Blocks never merge: the u16 cell page-limit is a hard
      exclusion — the substrate's Pauli is geometric, not
      energetic.
    THE VERDICT: the substrate's spread floor is CAPACITY (one
      cell-page holds <=65535, period), nature's is ENERGY
      (density costs ~1/dx). Same outcome — a minimum volume per
      unit mass — different mechanism.
    THE EQUATION OF STATE (compress-collide, fullness sweep):
      mass0=30000/cell: blocks merge freely 150->88 cells until
        destinations can't fit the remaining residue — a hard
        EXCLUSION EQUILIBRIUM at ~92% page density (60000), not
        a soft stop. Cheap: ~74 heat total, then lock.
      mass0=45000: cells saturate to 65535 one by one — an
        interface layer fills (12->37->50 full), compression
        stalls at the wall, sustained press keeps minting the
        ~50/t rattle.
      mass0=65535: zero merges from the start — pure rattle.
      EOS shape: compression is nearly free until the page
      limit looms, then effectively infinite — a wall, not a
      curve. Nature's degeneracy pressure (P ~ rho^(5/3)) is a
      graded divergence; ours is binary. The honest gap.
    LEAK FOUND + FIXED (same silent-sink class as the clamp
      audit): the tear branch set k=mass>>shift WITHOUT capping
      to destination room — the u16 clamp ate the difference.
      Measured ~18,369 mass destroyed at a saturated interface
      (ledger m+flight+heat = 6,731,631 vs seeded 6,750,000).
      Fix: k=min(k,room) — refused mass stays with the source.
      Post-fix ledger: mass flat at 6,750,000 exactly.
    OPEN DESIGN — where degeneracy pressure SHOULD live: the
      mass-relay refusal isn't governed by the armed-cap (that's
      the packet layer), and the capacity check only fires on
      confirmed transactions. Two honest prototypes: (a) refused
      handoff deposits the denied press into destination fluxV
      as STRAIN — stored, elastic, qFieldReact pushes back —
      the wall-catch semantics extended to mass-merge; (b) mint
      heat ∝ refused share. (a) is the nature-analog (degeneracy
      stores, doesn't dissipate) — unprototyped as of this rev.

  SURFACE-GRAVITY RADIATION (qGravRad, default 0) — emission as
  a horizon phenomenon: the evap tax's drive is multiplied by
  the local mass gradient (o->mass - min nbr mass)>>shift — the
  well's local slope. Flat field radiates nothing.
    INTERIOR IMMUNE exactly: a 5^3 wound blob's core cell held
      1000->1000 for 100t while the skin bled — corner > face >
      core, a pure surface-exposure ordering.
    SELF-QUENCH: a lone wound cell (mass=1000) radiated ~14
      units then STOPPED — its own exhaust congests the vent:
      emitted packets can't leave through unwound vacuum,
      channel occupancy rises, the graded-Pauli pick fails and
      the tax becomes unreachable. Radiation stalls by back-
      pressure — a body embedded in a routing medium would keep
      radiating; a stranded one chokes on its own exhaust.
    The upstream gates still dominate absolute rate (1/4
      lifetime gate, density refusal ~live/26, channel pick);
      gravRad multiplies by the local slope — it decides WHERE
      emission happens, not how fast.
