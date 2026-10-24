---
layout: page
title: The Hopfion Zoo
pageClass: hopfion-page
---

<HopfionViewer />

<div class="hopfion-doc vp-doc">

# The Hopfion Zoo

> **Milestone archive.** These specimens were measured on the earlier single-spin prototype engine (`planck3.c`) — real, stable eigenstates of *that* substrate, whose kinematics were later found to be an alternate discrete universe (matter permanently at v=0). The active multichannel engine is documented in the [Friction Substrate monograph](/interference/meso-monograph).

Every specimen in this carousel is a **measured eigenstate of the
prototype substrate** — a closed loop geometry that survived 400 ticks of the
True FCC engine's ambient metabolism with constant mass. They are not
artist impressions: each point is a live lattice cell from the actual
dictionary run, colored by its tension register.

Drag to orbit. The carousel is ordered by invariant mass — the knots
get heavier, not bigger.

- **Mass** — total quanta held in the stable state (up to ~9M for the
  heavyweights).
- **Loops** — closed streamlines the pathfinder wound into the torus.
- **r=(xy, z)** — RMS cross-sectional radius: the knot's waist and
  thickness in lattice cells.

<details class="custom-block details"><summary>Provenance and method</summary>

Geometry comes from `script/pathfinder.mjs` (Phase-Lock DFS on the
12-port graph), survival is proven by `script/sweep.mjs` (400 ticks,
dissipation 15, thermal limit 50,000 — the Earth's-ambient baseline).
The exporter is `script/export-zoo.mjs`: each seed is re-loaded into
the real engine, settled for a few ticks, and dumped as a compact
binary frame. `painted` marks original skeleton vs. settled ambient
mass. Same data opens in ParaView via `script/vtk.mjs`.

</details>

</div>
