# Substrate Ontology

*What the engine mechanically expresses — measured, not asserted.*

This is the Map (what exists) and the Compass (which way the loops
run) for the meso engine, distilled from the E65–E90 experiments.
Every claim traces to a measured signature; nothing here is an
authored force.

## The registers (what exists)

| Register | Role | Gradient ends |
|---|---|---|
| `mass[IMOV]` + `mass[REST]` | mass quanta — channels = direction, REST = parked | moving ↔ parked |
| `drest[IMOV]` | directional-rest — channel-tagged stock | net-wound ↔ balanced-pair ↔ dead scalar (three ends) |
| `iE` | excitation/energy battery (≤255) | charged ↔ spent |
| `iPT` / `iLT` | link-load / latency cadence meters | busy ↔ quiet |
| `phot[IMOV]` (perf) / `phot[IMOV×NNU]` (meso3i) | photon flux; ν bins = transaction amount | hot (high ν) ↔ cold (ν=1) |
| `iQ` | bound-state register — **dormant** | unexplored |

## The conserved currency

Total quanta (mass + photons) are conserved — species interconvert
at fusion/annihilation/absorb/emission forks. Measured closed ledger
(E-series audits): seed = residue + drain + cap-loss.

## The couplings (measured)

- **Photon ↔ mass**: absorb (charges `iE`), scatter (deflects),
  refuse (`linkcap` bounce/force-through)
- **Photon → mass momentum**: ablate (`phot≥3`) — radiation
  pressure, pushes lumps downstream (+3.7 sites, E84)
- **Mass ↔ mass**: accretion — mass flux deposits on the near face,
  drags centroid *toward* source (−9.4, E85). Light pushes, mass
  sticks — complementary transports
- **Directional (dipole-analog)**: `drest` winding sets emission
  direction — anti-aligned wound lumps exchange flux, converge,
  outlast aligned (~19% slower decay, +3.7-site mutual pull, E82–83)

## The feedback loops (signed)

- **+ retention**: parked density ∝ `iR` → more arrivals park →
  denser (emergent gravity — dense retains 2.5× vs empty, E77)
- **− depletion**: `iE` spend quenches itself — every hot site
  cools; ν-spectrum is a depletion curve (E69–70)
- **+/− species cycle**: fusion (photons→mass) ↔ annihilation
  (drest pairs→photons) — interconversion
- **+ glow-trap**: scatter traps photons in dense regions → more
  absorb → more `iE` → more emission (bounded by depletion)
- **− saturation**: `linkcap` refuses mass into photon-saturated
  sites — congestion self-limits

## The dynamical fixpoints

- **Static saturation**: the clot — +/− loops balance, mass
  saturates to a ceiling (drain-vs-retention equilibrium)
- **Frozen death**: the remnant — +loop starved, activity
  front-loads then falls silent
- **Periodic breathing**: relaxation oscillator — `iepush` gives
  `iE` a spend channel; charge ramps, kick dumps, repeats.
  Sawtooth, tunable (E78): iepush 4/8/16 → iE ceiling ~3,050/2,900/
  2,500

## The bound states (the deep finding)

- **The bond is the exchange**: gap `iPT` between two lumps holds
  separation while the photon bridge lives; merge follows the
  bridge's *death*, not attraction's win (E87)
- **The repulsive core IS the photons**: trapped gap photons push
  lumps apart (radiation pressure in the cavity). Attraction at
  range, photon pressure up close → **equilibrium bond length
  ~24 sites** (E88)
- **Scale-free**: pair → chain (~25–27 spacing, E89) → 2×2 plane
  (~33×24, E90) — matter with a natural lattice pitch, condensed
  matter emerging

## What's deliberately absent

- **Randomness**: `randmode=1` deterministic-phase mode reproduces
  the physics (E67) — dice were placeholder, not load-bearing
- **Age**: no register; nature's particles are indistinguishable —
  any "age" must be a state proxy (thermalization), not a clock
- **Hard-coded spectrum**: `NNU` dissolved — ν IS the transaction
  amount (E70), bounded by site charge not bin count
- **Authored forces**: every "force" measured is a routing/retention
  bias — gravity, radiation pressure, dipole coupling, bond
  equilibrium all emerge from the same ledger

## Open frontiers

- `iQ` register — wired, never fires (capture conditions unprobed)
- Asymmetric-conversion lensing (edge-grazing beams depleting on the
  mass-facing side via catalyst-gated decay — predicted, faint)
- Winding exchange — spin transfer through mass accretion
- Whether any closed bound state truly self-sustains (the
  ground-state analog — a bond whose photons never leak)

## New mechanics since E65 (all flag-gated, default off)

`scatter`± (deflect/toward-density), `nuscat` (spectral routing —
hot flee/cold trap), `lens`± (avoid/attract — +72% mass held),
`randmode` (deterministic phase picks — same physics, zero dice),
`iecost`, `iepush`± (kick out/capture), `linkcap`± (refuse/force),
`massbnc` (cap-refusal bounce), `egate` (density-gated boil-off —
the flattened-dynamic fix), `iget` (arrival capacity gate),
`photdecay` (catalyst-gated photon->mass, EMASK-mirrored, balanced),
`nuup` (photon gains nu through hot sites — inverse-Compton).

Mechanics are ends of gradients — physics emerges where ends
contest at shared junctions, not inside any single flag.
