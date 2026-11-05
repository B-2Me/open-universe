---
title: "Cartan's Cascade — Induced Polarization (the Flexoelectric Analog)"
description: The moore26 substrate's curvature-coupled charge response, measured as a stochastic event rate.
---

# Induced Polarization in `moore26`

*How a curved flux boundary couples a neutral kinetic probe to signed-charge displacement — and what the ensemble actually measured.*

## The question

Real flexoelectricity couples a *strain gradient* to a *charge dipole*: bending a dielectric polarizes it. The `hexbuckle` benchmark asks whether `moore26`'s substrate does the analogous thing mechanically — a saturated U-shaped winding tube (the bend) vs a flat control, both bombarded by a neutral photon probe, and whether the curvature produces transverse charge displacement.

## The mechanism (mechanics-first, no fields added)

No long-range force is coded anywhere. The effect comes out of the ordinary mechanics chain:

1. **Probe photons negotiate** — each offer/incipient/confirm handshake deposits `2·nu` into the target's winding. The arrival edge saturates first (`≥128`), so overflow routes *internally* to the freest edge — the conduction rule.
2. **Routed winding carries charge** — when a deposit migrates winding to a neighbor edge, a signed share of the node's `charge` goes with it (charge rides the transaction ledger, not a field).
3. **Curvature biases the route** — at the U's hairpin, the "freest" neighboring edges are geometrically asymmetric: the bend's interior faces a different capacity landscape than its exterior. Absorbed pressure therefore displaces `+q` and `−q` *non-symmetrically* — a net dipole forms where the strain gradient lives.
4. The observable is `chpol = Σ (x − c0)·charge(x)` — signed charge weighted by transverse offset.

This is the mechanical induced-dipole picture: neutral kinetic pressure → internal routing → charge segregation at the curvature — with **zero** electromagnetic equations.

## What the ensemble actually measured

The honest result required `N=20` runs per scenario (the engine is deterministic — the ensemble jitters the probe microstate: source column `±2`, count `6–10` — the experimental-noise analog). `chpol` at `t=100`, `128³`, probe `nu=128 < 256` fusion wall:

| scenario | mean | sd | median | **P(chpol < −40)** |
|---|---|---|---|---|
| flat (11-node, sub-threshold) | −50.4 | 117 | 0 | 25% |
| dip = 8 | −41 | 70 | 0 | 30% |
| dip = 16 | −99.2 | 93 | **−111** | **60%** |
| dip = 24 | −64.8 | 83 | 0 | 45% |
| dip = 32 | −74.5 | 119 | −28 | 50% |
| dip = 40 | −52.4 | 62 | −1 | 45% |
| dip = 48 | −91 | 88 | **−92** | **60%** |

### The finding — polarization is a stochastic *event*, not a smooth response

`chpol` is **bimodal**: the majority of runs give `~0` (the probe disperses symmetrically), and a minority produce large negative excursions (`−200..−500` — charge segregation events). The means overlap because a mean is the wrong statistic for a bimodal distribution.

The physically meaningful number is the **response rate**: `P(chpol < −40)`. Curvature roughly *doubles* it — `25–30%` (flat, shallow) → `45–60%` (deep bends, `dip16`/`dip48` at `60%`). The bend does not *guarantee* a dipole; it makes the asymmetric-outcome branch about twice as likely.

This is, honestly, *more* interesting than a deterministic response would have been: the substrate's polarization is an emergent bifurcation — most microstates relax symmetrically, and curvature tilts the odds toward the segregating branch. That's a real curvature→polarization coupling, measured as a rate.

## Caveats (honest ledger)

- **Not a flexoelectric coefficient.** The bend doesn't yield a monotonic `pol ∝ curvature` curve — `dip16` and `dip48` peak at `60%` but `dip24`/`32`/`40` sit near `45–50%` — no clean scaling law. The claim is: *curvature raises the polarization-event rate*, not that it produces a linear response.
- **`chpol` conflates mechanisms.** Large excursions include both *induced polarization* (charge displaced while bound) and *fragment transport* (charged recoil fragments after a string-break). The flat control stays sub-threshold by construction (11 nodes < 12), but deposited winding can push a bend over — some dip runs may include break-assisted spikes.
- **The flat baseline isn't zero.** `25%` of flat runs still polarize — the probe drives some asymmetric deposition even on a straight tube. The bend amplifies a nonzero baseline, it doesn't create the effect from nothing.
- **Determinism.** The ensemble varies the *probe microstate*, not an internal seed — `rand_site` is a deterministic per-site hash. The "stochasticity" is genuine sensitivity to the bombardment pattern, which is the right analog for experimental noise.
- **`N=20` is thin.** Response-rate error bars are `±~10%` (`sqrt(p(1−p)/20)`); the `2×` rate enhancement is suggestive, not yet precise. `N=100` would tighten it.

## The one-line version

`moore26` derives induced polarization as a mechanical side-effect of local transaction routing — a curved boundary roughly *doubles the rate* at which a neutral probe drives a signed-charge dipole, with no electromagnetic field anywhere in the substrate.

::: details 🔬 Reproduce

```bash
node script/cascade/hexbuckle-ensemble.mjs --n=20 --ticks=100 --w=128
# → results/cascade/hexbuckle-ensemble.{log,json}
# single run: node script/cascade/moore26-harness.mjs --scen=hexbuckle --dip=16
```

:::
