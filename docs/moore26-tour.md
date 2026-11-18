# The Substrate So Far — A Plain-Language Tour

*Companion to [Substrate](moore26-substrate) (the formal abstract),
[Findings](moore26-findings) (the measured record), and
[Constants](moore26-constants) (the numbers). This page explains
the same physics without the jargon, lists what we considered but
haven't tried, and gives an honest accounting of how close any of
this is to nature.*

## What this thing actually is

Imagine a vast three-dimensional checkerboard. Every cell is a
ledger — a small set of integer registers, each of finite size.
There are no particles flying through an empty arena and no
equations being solved. Each tick, every cell looks only at its 26
nearest neighbors and runs a handful of local rules: hand off some
mass, absorb a packet, record some wear, refuse a write that won't
fit. Nothing can see farther than one cell. Nothing acts at a
distance. Everything that happens anywhere is the sum of those
local transactions — that is the entire machine.

The checkerboard is two interleaved lattices:

- **Odd-parity cells** hold *stuff*: mass, charge, winding, heat,
  age, pressure history. Matter lives here.
- **Even-parity cells** are the *medium*: the exchange desks every
  transaction clears through, plus the field registers (`flux`,
  `fluxV`) that store polarization and elastic strain. Force,
  in this substrate, is what the medium's registers do back.

Two slogans carry the ontology:

- **"Energy is not what a thing has — it's what the ledger can't
  lose."** There is no energy variable. Conservation is not a
  constraint we check afterward; it is the mechanical fact that
  every debit has a matching credit, so the books always close.
- **"The substrate's grain is history, not geometry."** The
  registers are mostly *records*: winding is transit history,
  creep is failed-pressure history, `bondTick` is a birthday.
  A cell's present is the residue of its transactions.

## The one rule underneath everything

Every register is finite — a page can only hold so much. The
rule that organized this whole campaign:

> **A register that cannot accept a write refuses it, and the
> refused value stays real.**

Clamping was, at one point, what the code did when a destination
was full — and clamping silently *deletes* the excess. The audit
found five places that quietly destroyed ledger value this way
(charge relocation, charge-flight minting, the bond handshake, the
heat pump, and the mass tear — the last one ate ~18,000 mass in a
single compression run). Each is now converted to *back-pressure*:
the transaction pays only what fits and the remainder stays with
the source. In this substrate a clamp is not an error to hide —
it is the beginning of a physical law: *full things push back*.

## The cast, in plain terms

| register | what it is | plain meaning |
|---|---|---|
| `mass` | bound structure | how much of the cell is "stuff" |
| `winding` | committed circulation | the record of transits — both structure and rail |
| `momentum` | directional press | which way the cell is pushing |
| `heat` | disorder | the local temperature — where refused/lost work lands |
| `charge` | signed record | +q/−q bookkeeping, moves with its body |
| `flux`/`fluxV` | field state | the medium's polarization and stored elastic strain |
| `creep` | failure count | pushed-and-failed history — pressure that didn't win |
| `bondTick`/`workAge` | birthdays | how old the structure is — stratigraphy |

## The thermodynamics arc — what we built and what it showed

### 1. Heat had bookkeeping but no physics

Heat already had a complete lifecycle: minted by irreversibility
(denied transactions, packet decay, annihilation burns), drained
locally at a fixed tithe, radiated back as packets, and pumped
into charge by a heat engine. But it could not *move*. Two cells
— one burning, one frozen — never equilibrated. A cell that
couldn't shed heat to neighbors could only saturate.

**Fix**: conduction — every pair of neighbors swaps a fraction
`(ha−hb)>>shift` of their heat difference once per tick. The
transfers are antisymmetric by construction, so heat is conserved
*exactly*, even under parallel threads.

**Measured**: thermal diffusivity `D = 9.3·2^−shift cells²/tick`,
halving cleanly per shift step; the spread `σ²(t)` grows strictly
linear — a textbook diffusion law, emergent. Every unit the grid
lost matched the drain counter to <0.01%: *transport and entropy
export are now separately measurable channels.*

### 2. The engine that shouldn't work — and the Carnot fix

The heat pump converted heat → charge at 1:1, up to a rate cap.
The falsification test: one uniform-temperature bath. A Carnot
engine needs a gradient; ours converted heat to work
*isothermally* — a perpetual-motion machine of the second kind.

The structural flaw: it *deleted* the heat it spent. In nature an
engine cannot destroy heat — it must reject it, colder, and that
forced rejection is exactly where `1 − Tc/Th` comes from.

**Fix** (`qPumpCarnot`): for each unit of work `w`, the pump must
reject `r` heat onto its cold-side partner such that
`η = w/(w+r) = 1 − hc/hp` — computed from the *locally read*
temperature registers. Not a cap on top of physics; the
rejection rule itself generates the bound.

**Measured**: strict isothermal bath → `ev61=0, ev65=0` for 120
ticks — the demon is dead. Pinned gradient → work at bounded η
tracking the local Carnot ratio (4.1% measured vs 3.8% bound).
The beautiful part: rejected heat piles onto the cold cell until
`hc ≥ hp` and the engine *stalls*, waits for conduction to clear
the sink, fires again. A real engine fighting a warming cold
reservoir — the second law working in real time.

### 3. Gravity is routing, not radiation

Does heavier mass emit more packets? Tracing the actual paths:
- **Thermal re-emission** is mass-blind — pure heat physics.
- **Mass-driven launch** is proportional but conditional — needs
  a winding asymmetry and a bare trailing edge; it's propulsion,
  not gravitation.
- **Gravity in the engine** is a *routing field*: heavy cells
  write field toward themselves, ambient flow bends toward them.
  Mass doesn't radiate more — it recruits more of what flows past.

The prototype that *did* get built (`qGravRad`): evaporation drive
scaled by the local mass gradient — the well's local slope.
**Measured**: a blob's interior was immune exactly while the skin
bled — corner > face > core, a clean surface-exposure ordering.
And a lone emitter self-quenched: its own exhaust congested the
unwound vent — radiation stalls by back-pressure. Emergent, not
authored.

### 4. The equation of state — holding is free, compressing costs

- **Holding** 64,800 mass in one cell: completely inert for 200
  ticks. Localization costs nothing once achieved.
- **Compressing** two full-density blocks in a sustained vice:
  ~50 heat/tick rattled at the interface — *magnitude-blind*
  (identical at 4× kick strength). The blocks never merge; the
  work dissipates as rattle heat.
- **Sweeping initial density** gave the EOS shape: mergeable
  blocks compress to a hard exclusion equilibrium (~92% page
  density) then lock — compression is nearly free until the page
  limit looms, then effectively infinite. A wall, not a curve.
  Nature's degeneracy pressure diverges *gradually* (P ∝ ρ^5/3);
  ours was binary — the honest gap.

### 5. The spring — elastic degeneracy pressure

The piston probe exposed *ghost momentum*: the relay paid the
destination the **entire** momentum vector even when the mass was
refused — a saturated wall inherited every kick and walked off on
it. Charge and proper-time hand off the moved fraction `k/m`;
momentum alone went all-or-nothing (deliberately — fractional
bleed deadlocked walkers, so the default stays untouched).

**Fix** (`qPackPress`, off by default): momentum hands off
proportionally too, and the refused share splits — part banks on
the shared conduit's strain register as counter-strain (the field
pushes back — elastic), the rest stays with the carrier
(retained back-pressure). Every unit of impulse is accounted:
destination + field + source, with the strain register's own
capacity throttling the bank.

**Measured** (pusher vs committed wall): `pp=0` → the pusher
dissolves through the wall entirely. `pp=8` → ~100K strain
banked, partial recoil. `pp=15` → ~200K banked, wall holds, and
on release **the pusher rebounded 21.6 → ~8 cells** while the
field spent its banked strain back down to ~4K. Monotone in the
knob — a real elastic coefficient. Mass conserved exactly in all
arms.

**Fixture lesson that became physics**: the mass⇄winding
capacitor means a cell holding *both* mass and winding bleeds one
into the other — a real conversion that reads exactly like a leak
in a mass-only audit. Mass lives on odd cells; winding lives on
even conduits; edge-element press keeps them from ever meeting.
The sublattice separation isn't bookkeeping pedantry — it's what
keeps the ontology clean.

## Emergent vs authored — the honesty table

Everything the substrate does falls into three categories, and
the project lives or dies on keeping them sorted:

| kind | examples | status |
|---|---|---|
| **Emergent** — fell out of the rules, had to be measured not assumed | c = 1 hop/tick; diffusion's linear σ²(t); Carnot bound from the rejection rule; exclusion equilibrium ~92% density; corner>face>core radiation; self-quench by exhaust congestion; anisotropy-free deflection | **real results** |
| **Measured substrate constants** — properties of this medium | diffusivity 9.3·2^-shift; compression rattle ~50 heat/t; knot 47:161 mass:bond ratio; stall-fatigue laws | real, but native units only |
| **Authored** — knobs we chose, default off | conduction, Carnot pump, pack-press, grav-rad, heat pump, wall catch | declared mechanism, not discovery |

The discipline: an authored coupling is never reported as a
discovery, and an emergent behavior is never claimed without the
control arm showing it's real (pp=0 dissolving wall vs pp=15
rebounding — same fixture, one knob).

## Considered but untried — and whether still relevant

| idea | status | still worth it? |
|---|---|---|
| **Emission-law measurement** — run the thermal re-emitter over a sweep of `h` and record power-vs-h and the packet-nu spectrum | Not built | **Yes — the natural next experiment.** Before shaping a black body, measure what the emitter actually does. If it mints a clean power law, that's a new substrate constant and a candidate scale-pinning relation. |
| **Planck/Stefan-Boltzmann grounding** — does any T⁴-like law or ν³/(e^{ν/T}−1) spectrum emerge? | Untried, depends on the above | Only meaningful *after* the emission law is measured. At 0.1fm/node the relevant temperatures are GeV-scale — quark-gluon territory — a defensible regime, but the spectrum must be measured, not asserted. |
| **Entropy audit** — running ledger of total entropy production (drain + conduction irreversibility), verify ≥0 every tick | Not built | **Yes — cheap and deep.** Would promote the second law from "enforced at the pump" to "measured invariant of the whole tick". |
| **Unpinned engine round-trip** — finite hot block, Joule return, drain tithe per cycle: real closed-loop efficiency | Not built | Yes — the pinned-bath runs bleed ~250K/tick sideways through raw stencil conduction (no insulation exists). A closed loop measures round-trip η honestly. |
| **Thermal insulation fixture** — a cell type or flag that refuses heat transfer | Not built | Useful plumbing for all the above: the bath leak is currently bigger than the engine's draw. |
| **Melting** — heat above a threshold damages winding/mass | Considered, not tried | The phase-transition version of the heat clamp; relevant if any scenario approaches 65535 heat. Conduction already made saturation rare. |
| **Degeneracy EOS curve P(ρ)** — banked strain vs compression depth | Now measurable (qPackPress exists) | **Yes — the follow-up that turns the prototype into a law.** Does banked strain grow linearly, quadratically, as a power? That curve *is* the substrate's degeneracy equation of state. |
| **Hawking-style spectrum** — emitted-packet energies vs surface gravity (qGravRad) | Radiation exists; spectrum unmeasured | Same order of business: measure the spectrum before naming it. |
| **1/r² force law** — charge-kick or gravity-routing strength vs distance | Never measured | Important and unproven. If either decays as an inverse square over a few cells, that's a genuine emergent force law — and a scale-pinning candidate. |
| **Relay-level degeneracy hook** — density-dependent refusal inside the mass relay itself | Attempted twice, reverted twice | Superseded by qPackPress — the strain-bank route works and is better physics. Closed, unless the EOS curve demands more. |

## What could this predict, if the mechanics are right?

Within the substrate, the laws already make falsifiable
predictions — and they've been tested that way:

- `D = 9.3·2^−shift` — a definite scaling, verified at four
  shifts.
- Isothermal pump → exactly zero work (verified — demon dead).
- Recoil ∝ banked strain, monotone in `pp` (verified 0/8/15).
- Exclusion equilibrium ~92% of page density (measured at two
  densities).
- `ev65/(ev61+ev65) = Tc/Th` — internal consistency check any
  run can audit.

For nature, the honest claim is *structural*, not numerical: the
substrate says that if a ledger is local and finite, you should
expect back-pressure everywhere, entropy that must be rejected
somewhere, a surface that radiates and an interior that doesn't,
and compression that stores before it dissipates. Those are the
shapes nature also has — which is either meaningful or a shared
consequence of locality + conservation + finite registers. The
experiment program exists to find out which.

## How far is it from known measurement?

**The honest answer: far in units, close in structure.**

- **Every number is in ticks, links, and register units.** No SI
  calibration exists. The instruments are made of the same
  substrate — there is no outside meter stick.
- **0.1 fm/node is aspirational**, and stays so until *two*
  independent constants over-constrain the scale. `c = 1 hop/tick`
  pins the space-time ratio only — one equation, two unknowns
  (cell size, tick duration). A second independently-matched
  constant closes it: a measured force law (charge-kick →
  fine-structure?), the mass↔proper-time rate (a Compton
  relation), or a structural ratio matching a measured nature
  ratio.
- **What does not yet resemble nature**: the radiation has no
  spectrum (linear in `h`, single energy — not Planck); no 1/r²
  force law is measured for anything; temperature is a register,
  not a Boltzmann average — there is no microscopic statistics,
  so no `S = k ln Ω` entropy, and the second law is enforced
  structurally rather than emergent statistically; degeneracy
  pressure is a page-limit wall plus an authored elastic knob,
  not an emergent ρ^5/3.
- **What does resemble**: conservation to 99.999%+; c emergent;
  diffusion exact; Carnot bound emergent with the right *form*
  (`1 − Tc/Th` read off native registers); an exclusion
  equilibrium; elastic recoil from stored compression;
  surface-ordered radiation.

The distance is not a failure state — it's the measurement
program. Every untried item above is a specific, runnable
experiment, and two of them (the emission-law sweep and a
distance-resolved force law) are potential second constants. If
one lands and agrees with `c`, the aspirational scale becomes a
measured one.
