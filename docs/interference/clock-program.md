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
