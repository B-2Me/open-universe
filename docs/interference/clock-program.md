---
title: The Clock Program
---

# The Clock Program

*A proposal, not a claim. Everything below is a measurement roadmap —
the mechanism story is plausible, the two cruxes are open, and the
distinguishing signatures stand whether or not the calibration ever lands.*

## The mechanism

Two lattice effects, each replacing "curved time" with local accounting:

**Velocity — the longer hop path.** Carriers are rate-limited (one hop per
tick). A bound structure translating across the lattice must run its internal
cycle along a diagonal chase-path, so each internal tick of the object costs
more substrate ticks. This is the `C_max² = C_s² + C_i²` bandwidth budget made
physical: hops spent on translation are hops denied to internal cycling.

**Altitude — the congestion gradient.** Near mass, node traffic is dense and
internal cycles run into transit drag (`IFRIC` and friends); in relaxed space
they run at full rate. Gravitational time dilation becomes a statement about
local node load, not metric curvature.

Both effects compose exactly the way the real data does: the Hafele–Keating
flights (1971) measured −59 ns eastbound and +273 ns westbound — the east/west
asymmetry that forced GPS onto the non-rotating frame plus a Sagnac patch. In
substrate terms the ground was already moving; westbound clocks crossed fewer
nodes. ISS (−25 µs/day, velocity-dominated), the crossover orbit (~3,178 km,
where drag relief and hop-path cost cancel), and GPS (+38 µs/day net,
congestion-relief-dominated) are the same two terms with different signs.

## The two open cruxes — honestly

**Crux 1: does the engine's dilation curve actually equal γ?**
`sqrt(1 − v²/c²)` follows only if a bound structure's internal cadence dilates
by exactly the hop-path budget. Our lumps are dissipative, far-from-equilibrium
objects — not ideal light clocks. They could dilate by γ, by a steeper curve,
or not at all. This is measurable headless, and it gates everything.

**Crux 2: the radial law.** Flux conservation across concentric shells gives a
congestion field ~1/r². GR's clock law needs `1 + Φ/c²` with `Φ ∝ 1/r`. If
local lag is proportional to local congestion, the altitude correction has the
wrong radial dependence — a *falsifiable mismatch* with GPS data, not a
refinement of it. Whether the substrate's congestion imprint (and the
lag-vs-density transfer function) can reproduce 1/r to first order is **the**
open question. It is a measurement, not a derivation.

## The experiment ladder (all headless, no engine changes)

- **E1 — twin-clock drift.** Two identical lumps; one boosted, one stationary.
  Compare internal cadence (radiation turnover, winding precession, dwell
  counters). Does translation dilate, and by what curve?
- **E2 — the lag law.** Effective transit rate vs. local occupancy: the
  `v_eff = f(ρ)` transfer function the whole altitude story stands on.
- **E3 — the congestion profile.** Node occupancy vs. distance around a mass
  lump and around an active corridor — the radial exponent that decides
  whether Crux 2 can even be asked.
- **E4 — the corridor clock.** A wound lump parked beside a high-throughput
  flux corridor vs. an identical lump in quiet vacuum. If active traffic lags
  the internal cycle where `GM/r` is unchanged, that's the Part-3 signature —
  inside the model, before any claim about real clocks.

## The dimensional bridge — two constants only

Like GR, we import two measured constants rather than deriving them:

- `1 hop/tick = c` — locks the velocity term's geometry exactly. *If* E1
  confirms γ, the kinematic dilation is exact to all digits by construction.
- `surface congestion = GM/rc²` — calibrates the lag coefficient to Earth's
  surface clock rate (6.95 × 10⁻¹⁰).

The "17th decimal place" is reachable **only** in the conditional sense: if E1
returns γ and E2+E3 produce a 1/r-compatible lag law, the calibration
interpolates GR's own verified numbers. That is not a new prediction — it is
consistency. The program's real deliverable is what comes next.

## The distinguishing signatures (Part 3)

Where the substrate disagrees with `1 + Φ/c²` regardless of calibration:

- **Active-corridor lag.** In GR, a quiet mass and a furiously radiating one
  of equal `M` dilate clocks identically. In the substrate, throughput chokes
  node bandwidth — an optical clock inside a high-flux corridor should run
  *slow* where Einstein says the term is zero. (Testable inside the model
  first: E4. Strontium optical clocks already resolve ~1 cm of altitude,
  ~10⁻¹⁸.)
- **Spin-wake asymmetry.** A spinning body carries a directional channel
  imbalance; prograde and retrograde transits should lag differently — far
  above frame-dragging scale if the M42/M50-class winding holds in the wake.
- **A saturation floor.** Node congestion ceilings (`IREFL`) cap clock lag
  and density. Nothing in this model runs to infinity — the divergences of the
  continuum are finite ceilings here.

The pitch is not "more accurate than relativity." It is: *relativity has a
zero where the substrate has a knob — and the knob is measurable.*

## First measurements (the record so far)

**E3 (clock-profile, commit `f373ef7`).** A steady central source against
boundary drains, 56³, 600t settle: shell-averaged moving density falls as
~r⁻²·⁰⁻²·⁶; a parked lump's halo reads ~r⁻²·⁰. **The transport regime is
ballistic — which is what the ontology predicts.** Mass generates a radial
momentum-transfer field; a ballistic field falls as 1/r², and 1/r² flux
density *is* inverse-square force. A diffusive 1/r halo would have been the
bad result — it cannot produce inverse-square force from ray transport.

This corrects the framing this document originally carried: the comparison
baseline is *observation* (GPS, Hafele–Keating), not GR's functional form.
Field and potential are different objects — the potential is what the field
integrates to along the path. The substrate does not need its congestion to
resemble Φ; it needs its force field to look like g ∝ 1/r², and it does.

**The re-posed Crux 2.** A sitting clock lags from local congestion ρ(r) ∝
1/r² — but a clock's internal cycle *traverses* the field, so its lag may
integrate along its own path through the gradient (∫ r⁻² → 1/r), which is
what the GPS number requires. Whether dilation is local-density or
path-integrated is now precisely what E2 measures: the transfer function
between local congestion and internal lag.

**E3-dense.** Cranking the source 16× does not shift the
regime: slope stays ~r⁻²·⁰⁻²·¹ at ~10× the density. The inverse-square halo
is structural — carriers follow channel vectors, and the collision rules
gate on occupancy (capture/park) rather than randomizing direction into a
diffusive bath. Inverse-square transport is not a dilute-regime accident.

**E2 (clock-lag, `3ed51d5`, `f10aac4`).** Transit lag is *discrete dwell*,
not continuous drag: with capture off, v_eff = 2.174 cells/t at every
density — carriers collide but are never slowed *by congestion*.
Congestion delay is
park-and-wait, not friction.

**E1 (clock-drift, `c40b4b6`; vault-cadence, `c5ce356`).** Bound objects
have no autonomous internal clock: static scalar lumps are frozen
(wake=0), and the wound vault's winding is a *stored record* — every
internal phase constant over 2000t. "Time" for a substrate object is its
transaction rate with the environment. A real clock must be a *flowing*
resonator. Bonus finding: wound structure halves driven-drift response
vs. scalar (the C_s²+C_i² bandwidth trade as mechanics).

**E4 (clock-cavity, `9c2cf30`, `dcd7f14`).** A packet between parked
Q64/IREFL16 mirrors is a working light-clock: clean 23t half-period.
Static interior density dilates it via path-length scattering
(23→26.7t at q=4); the first transit is always invariant — `c` is fixed,
dilation accumulates over cycles. At q≥8 a single absorbing site anywhere
on the path kills the clock — the horizon is a capture cliff, not an
asymptote.

**E4b (clock-fizeau, `6771759`).** No medium drag: a −x headwind is
identical to vacuum; a +x "tailwind" only injects wind mass onto the
probe channel. The lattice does not flow — only *standing* congestion
dilates.

**E4c (clock-halo, `0304f58`).** Transverse sustained wind: zero period
change at all rates — just faster decoherence. Isotropic bath (the honest
omnidirectional halo): destroys clock coherence within ~2 bounces.
**Halo flux kills clocks; parked mass slows them** — the inversion of
the naive expectation, and the most mechanistically interesting result
of the series.

**E10 (photon-refract, `e5d2dd8`).** With `IPHOT=4` (fluorescence: the
emit gate may output photons), a photon pulse through a q=96 corridor
spreads into an exponential re-emission tail — peak arrival +40%,
still emerging at t=105. Photons detained by mass resume as photons
after `ILAT`. The delay curve is non-monotonic in ρ (peak ~q=32) and
saturates in corridor depth — a detention event, not a per-cell tax.

**E8b (clock-ensemble-ac, `5118759`).** The population clock survives
congestion but bleeds — ~9 momentum flips then the cavity runs dry.
Mean half-period does not shift monotonically with density; the
per-packet dilation of E4 washes out in the bulk sign oscillation.
Honest negative: the ensemble keeps ticking, but a usable period
statistic needs a resonant drive, not a decaying cavity.

**E11 (dwell-probe, `5118759`).** The edge delay-line register
verified: `DWELL=k` gives `v_eff = 2/k` exactly (0.96, 0.64, 0.48
for k=2,3,4 — axial base rate 2 cells/tick divided by k). Uniform
detention aggregates into smooth slowdown: the substrate can express
effective `v = c/k` built from discrete waits. Third lag channel
confirmed; also the first *engineered* slowdown (a knob, not an
emergent effect — honest distinction).

> **The Refraction & Dilation Law (E2, E4, E10):** Photons detained in
> rest resume as photons after `ILAT`; effective refractive index
> `n(ρ)` and cavity clock lag emerge from discrete dwell and scattered
> path length, with `c` strictly invariant on every hop.

**E18–E20 (thermal arc — the `iE` excitation register).** The substrate
gained Planck's `n`: a per-site excitation level where absorbed photons
raise bound energy *at fixed mass* (`IPHOT>=5`), shed back as light on a
thermal decay beat. The measured arc: vacuum cooling is exponential and
emission linear in mass (E18); a sustained flux bath accretes, it does
not cool (E18b — ambient medium is a mass *feeder*); a parked ambient
bath is perfectly inert — no equilibration channel exists without
transiting carriers (E18c); a finite moving bath equilibrates once then
starves (E18d). Heat exchange is transaction-mediated all the way down.
The capstone (E20, `8b2447a`): a lump radiating into a photon-absorbing
bath in a closed box — radiation is trapped by the medium and returns as
excitation, and the lump ends as a massless hot object, pure `n`.
Mass↔photon↔excitation is a full reversible cycle; the substrate can now
express an object made of heat. `iE` is photon-specific: massive-carrier
kinetic energy still has no thermalization channel (E18b re-validation).

**E21–E25 (thermodynamics closed).** `IPHOT>=6` collision->`n`
verified: carriers thermalize into excitation (E21, n=329k vs 0
control). The conduction arc: open-space equilibration fails — photons
self-recycle or drain (E22, three variants); a mass filament conducts
`n` continuously (E23, B warms monotonically) but long-run still leaks
to the free photon sea. Four audit bugs found and fixed: `iE` edge
drain, snapshot coverage, `IPHOT>=5` ablation fall-through, and photon
deletion on missed rolls (the real killer — unabsorbed photons were
deleted while IPHN stayed frozen). Post-fix the Solid Conduction Bar
(matter-dense closed box, hot/cold step) shows **First Law bitwise
conservation, a steady ~600-photon dynamic gas, and real Fourier
diffusion** (R: 0->8598 while L cools) — energy transfers cell-to-cell
as n->photon->n. **E25: the clock is excitation-invariant** — n=50
preload gives identical bounceTicks to cold at every density; thermal
`n` lives on the photon plane and never touches mass-channel transit.
A hot cavity ticks exactly like a cold one. **E26 takes the claim
from architectural to emergent**: a probe photon pulse crossing a
dense photon bath *on the same iPA plane* arrives with a bit-identical
profile — light is blind to light at full `c`, Maxwellian
superposition measured on a shared discrete channel.

**E27–E29 (light → matter).** `IPHOT>=8` fires Breit-Wheeler on the
lattice: antipodal photon pairs crystallize into rest mass (E27).
The product can't persist inside its own bath — beams shred what
they make (E28, five geometries). But **E29 cracks it**: a convergent
6-fold photon implosion pair-produces 920 quanta at the focus, then
the bath's own momentum carries it radially away — leaving a frozen
lump in clean vacuum, stable 270+t. Structure assembled from pure
light; the freeze-out is geometric, not expansion.

**Re-validation (`iE` era).** Prior results survive the new register:
E4's cavity clock unchanged (vacuum emits nothing to thermalize, 23t);
E18b accretion identical; E10's refractive tail *gained* physics — the
`n`-reservoir roughly doubles detention and turns the corridor into a
persistent photon source.

## The dimensional bridge

**Formal bridge — grounded.** The unit assignment is an ontological
identification, not a measured result:

| Substrate unit | Physical unit |
|---|---|
| `cell` (hop length) | `ℓ_P = 1.616×10⁻³⁵ m` |
| `tick` (hop period) | `t_P = 5.39×10⁻⁴⁴ s` |
| `c = 1 hop/tick` | `ℓ_P/t_P = c` — exact by construction |

With this assignment every measured ratio is already physical:
E4's 23-tick cavity half-period is `1.24×10⁻⁴² s`; the E10 photon
delay tail's ~80-tick span is `4.3×10⁻⁴² s`; E11's `v = 2/k` dwell
law is a literal refractive-index law `n = k`. **The E-series is a
Planck-resolution measurement record.**

**Structural bridge — open.** Which substrate structure *is* a
physical object is the harder identification: the atomic regime
(~10⁴³ t_P cycles, ~10³⁰ Planck volumes — an electron is ~10³ cells
across) is reachable only through ensemble statistics, not direct
simulation. The coarse-graining path is the program's own premise —
substrate structures are Planck-scale seeds whose population
statistics produce atomic-scale physics. All measured lag *ratios*
survive that coarse-graining intact — the absolute scale was always
the identification step's job.

## New directions from here

1. **Identification hunt** — find the substrate structure whose
   characteristic scale/period matches a known physical anchor; that
   fixes the bridge.
2. ~~n(ρ) mechanism check~~ — **done (E10c)**: delay grows with
   corridor length (bulk, not boundary) but saturates once every
   photon is detained once — detention event, not per-cell tax.
3. ~~Ensemble dilation~~ — **done (E8b)**: ensemble survives but the
   period doesn't shift monotonically; needs resonant drive.
4. ~~Capacity-stealing channel~~ — **done (E12, `31825b5`)**: refuted
   for the Q-beat. The `ITICK`-locked emitter can't dilate in rate,
   and transit flux refills its Q-core — traffic *supplies* the
   internal cycle (emitted=1 in vacuum, 213k under wind=32).
   Capacity-stealing survives only as a mechanical budget (E1's
   drift resistance), not a rate budget. (`pget` now exported.)
5. ~~Edge-dwell registers~~ — **done (E11)**: `v_eff = 2/k` verified;
   detention aggregates into smooth slowdown.

## Open assumptions (the honest audit)

- **Capacity-stealing is a second, unmeasured mechanism.** The audits'
  own framing is *actualization* bandwidth stolen by field processing —
  the C_s²+C_i² budget — not transit lag. The E1 wound-vault result
  (internal circulation halves drift response) is that signature, but it
  has never been run as a clock experiment. There may be two dilation
  channels; we've measured one.
- **Static fill ≠ a mass's halo.** E4 seeded parked rest; a real halo is
  sustained transaction traffic around capturing/emitting structure —
  occupancy + throughput + active self-focusing (IQMODE7) at once. Each
  ingredient was tested separately; the combination hasn't been.
- **Single-particle artifacts — resolved (E8, E8b).** The ensemble
  clock survives densities that kill a lone packet — the q≥2 cliff
  was an n=1 artifact. But the ensemble's *period* doesn't shift
  monotonically; the bulk oscillation outlasts decoherence without
  cleanly dilating. A usable statistical clock still needs a resonant
  drive or lossless mirrors.
- **"Never slowed" has an exception.** E11's `DWELL` delay line
  produces uniform `v = c/k` — smooth slowdown built from discrete
  waits. Congestion never slows a carrier mid-hop, but engineered
  detention registers can. The invariant is `c` per *hop*, not per
  unit time spent in transit.
- **Two candidate "gravity" terms are conflated.** Passive occupancy
  (E3) vs active Q-capture (E5) — the ontology's gravity is transaction
  focusing, not congestion; Q-field strength may be the right
  independent variable, not ρ.
- **The lag is a spectrum, not a rate.** Most carriers pass, some
  detain — the honest comparison to GR is the *ensemble mean of the
  capture-time distribution*, not a single-packet T(q).
- **Dimensional bridge still absent.** All numbers are lattice units —
  ratios and regimes only, never µs/day.
- **Open boundaries.** Every probe drains edges; the r⁻² halo holds
  over ~20 cells in a 56-box, untested at larger scale.
