---
title: Joule's Mill
description: The flagship instrument. A live 3D lattice gas where matter is trapped momentum, light writes spin, and every irreversible event leaves a countable mark.
outline: false
layout: page
pageClass: mill-page
---

<ClientOnly>
  <div class="mill-stage">
    <MillSimulator />
  </div>
</ClientOnly>

<div class="mill-doc vp-doc">

# Joule's Mill

*The friction substrate, live in your browser: a universe where nothing moves for free and everything interesting happens at contact.*

This is `meso3i` compiled to WebAssembly: 93,000 live cells, each carrying 19 integer channels of real quanta. There is no empty space and there are no objects: only directional traffic on a lattice, and the parked deposits that congestion leaves behind. Cyan is moving flux; amber is **parked momentum**: mass, in the only sense this universe has. Every behavior you can produce here is a measured milestone in the [Friction Substrate](/interference/meso-monograph) record (M33–M51), not a scripted animation.

The page boots with a cold lump at center. Frozen flux, silent in vacuum, because heat here only radiates while a carrier transits. From there the controls are the experiment: **☀** pours an 18-spoke convergent feed that grows a breathing dissipative core; **➤** fires an apertured photon plane wave; **⚭** drops the two-body preset; the **Scene** menu reproduces the milestone regimes in one click.

## Play with it

- **Drag** to orbit; **two-finger drag** pans, pinch zooms (or use the **Zoom** slider). It slowly rotates on its own if you leave it alone.
- **☀ drive**: the convergent feed that accretes a breathing ember (M33–M35). Cut it and the core freezes in place: carrier-gated radiation means parked heat can only vent while flux transits.
- **➤ beam**: an **apertured photon plane wave**: a checkerboard disc of light sourced just inside the drain shell, riding one axial channel straight across the lattice. Photons carry direction but no mass and never collide. Only the six axial channels (v=2) travel in straight lines on this lattice, face diagonals zigzag, so **Dir** offers ±x/±y/±z. **Ap** sizes the aperture, **OffU**/**OffV** translate it in the beam-normal plane to graze lumps off-center. What light does to matter depends on the **Phot** dial.
- **⚭ binary**: the M37 two-body preset: two self-radiating lumps a few cells apart. The honest headline now (M47b): they ablate each other asymmetrically. A real, transient, short-range coupling between *active radiators*, not a sustained force and not passive shadow gravity.
- **Scene select**: one-click measured regimes: *wound lump* (directional rest + latency + feed, the M42 metastable spinning state), *breathing core* (the ☀ attractor), *comet ablation* (offset plane wave on a cold lump, the M36 walk-toward-the-light), *porous rim* / *fossil seal* (the M49 capture-window edges: dissolution vs frozen scar), *walled crust* (the IREFL refusal boundary: exclusion anatomy), and *spin vault* (M50 — a wound lump behind a refusal crust that keeps 98% of its stored spin under an 800-tick beam while the beam *feeds* the winding).
- **sparkline**: the amber/violet strips: rest mass over moving flux, independently scaled, last ~40 minutes of evolution.
- **Phot select**: the light–matter coupling experiment:
  - *off*. Photons stream through parked mass untouched: light that cannot couple.
  - *catalyst*: a transiting photon licenses the carrier-gated emission gate.
  - *stimulated*. Each photon may kick a rest quantum into *its own channel*: coherent directional ablation, the mechanism under M36's walk.
  - *absorbed*, photon momentum is deposited into **directional rest**: light literally writes spin into matter (M43, a YORP-class mechanism).
- **⇄ (pair rules)**: the momentum-honest wind/unwind cycle: `2·rest ⇄ c + c¹`. Rest sheds mass as back-to-back antipodal pairs, and head-on collisions can bind a pair back into rest. Measured caveat: the colliding pair is itself a carrier, so a binding site also lights its own emission gate. Unwind tends to dominate wind wherever they meet.
- **⌖ (vortex tool)**: arm it, tap the slice plane: injects two concentric rings of moving quanta on the best-tangent equatorial channels. A circulation seed. Watch it thermalize into parked heat (M38/M44's boundary), or park it as *directional* rest and the winding survives frozen (M42).
- **● (rock tool)**: arm it, tap the slice plane: drops a cold rest-mass lump, the proven-persistent control case.
- **⧉ / ⤺**: snapshot the field, perturb, rewind. The save is physics-complete, channels, photons, latency counters, dwell lines, registers and RNG state, so a restore replays bit-for-bit (verified headless).
- **Tuning**: **Plane** + **Cut** + **Slab** give a living MRI scan on any axis — Shift+scroll on the canvas scrubs the cut plane through the volume, and the vortex/rock tools inject on whichever plane is showing; **Drag** is the transit-friction congestion threshold (IFRIC); **Rad** sets the radiation gate strength; **Lat** sets emission latency. How many *consecutive* ticks a carrier must dwell before rest can radiate (the M41 shield: raise it and sporadic flux stops unwinding parked mass); **Collide** picks the collision variant; **Rest** selects scalar vs. directional parking (directional = M39's frozen flux that keeps its channel and its angular momentum); **Park%**/**Curve**/**Wall** expose the M49 capture gate (flat rate, graded ramps, congestion refusal); **Speed** caps ticks per second.

## What it is (honestly)

- **Substrate:** 72×72×36 even-parity True-FCC sublattice. Only half the cubic sites can ever host matter; the 18 moving channels (12 face-diagonal + 6 axial second-shell) carry the lattice geometry. Rendered in the honest embedding: odd-parity sites are structural vacuum.
- **Engine:** `src/meso3i.c`. Integer populations (u8) per channel; collisions conserve mass and momentum exactly; **transit friction** (IFRIC) sheds congested flux into the rest channel as parked heat; **radiation** is carrier-gated: heat re-emits only under transit.
- **Photons (IPHOT):** a parallel massless field on the moving channels. Carries direction, never collides, couples only through the flagged modes above.
- **Boundary:** `drain_edge(3)` zeroes a 3-cell shell each tick, an open boundary for light as well as mass.
- **What the record supports:** driven dissipative cores (M33), frozen quiescent matter (M35), light-driven locomotion (M36), transient radiator coupling (M37→M47b), thermalization of circulation (M38/M44), directional-rest spin storage (M39/M42), light- and collision-written spin (M43), a measured equation of state `P/ρ ≈ 0.879` (M46), a transaction ledger that reads zero in free flight and silence in the frozen ground state (M47), collisionless coherent beams (M47c), and density-dependent wave attenuation (M48). What it does **not** support: passive Le Sage shadowing, sustained two-body attraction, or a dimensional bridge to SI units, all measured, all in the monograph.

::: details 🔬 Under the Hood: For Physicists & Automata Enthusiasts

### The pipeline

`meso3i_rg_refresh()` packs {moving, rest, photons} into an RGB8 buffer inside the Wasm heap → `gl.texSubImage3D` per frame → one instanced billboard draw. Cyan ramp = moving flux, blackbody ramp = parked rest mass, violet = the photon field (additive in every palette: a beam must read through vacuum).

### What this instrument measures

- The vortex tool writes *momentum*, not structure: under scalar rest, circulation thermalizes (M38's "rocks, not atoms" wall, loom-scale). Under **directional** rest the same seed parks as a wound state that keeps ~half its angular momentum and re-animates with the original sign (M39/M42).
- The ☀ drive is a convergent *point source*: the M47b audit showed it can masquerade as two-body attraction. The ⚭ preset lumps are self-radiating (`fricm>0`), which is the faithful regime.
- Everything else, accretion, breathing, quiescence, beam drift, transaction counters, attenuation, was measured headless; each claim in the [monograph](/interference/meso-monograph) is commit-anchored.

:::

</div>
