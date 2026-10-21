---
title: Hopf's Loom
description: The 3D instrument re-seated on the multichannel friction substrate — an experiment in whether woven structure can survive transit friction.
outline: false
layout: page
pageClass: loom-page
---

<ClientOnly>
  <div class="loom-stage">
    <LoomSimulator />
  </div>
</ClientOnly>

<div class="loom-doc vp-doc">

# Hopf's Loom — friction-substrate experiment

*The same 3D instrument, re-seated on `meso3i` — the multichannel engine where friction lives in transit, not in registers.*

This branch is a live experiment. The original Loom ran `planck3`, whose single-spin nodes could store a direction — the ingredient that let the Hopfion's woven loops persist. `meso3i` has no such register: a node holds nineteen population counts and one rest bin, and the measured boundary of that engine (M38) is that injected circulation thermalizes in ~25 ticks at 44³. The open question this page asks at 72×72×36: **does anything knot-shaped survive transit friction, or is a "weaving" the one thing this substrate refuses to hold?**

What you see on boot is a cold lump at center — parked amber heat, inert in vacuum (carrier-gated radiation can't vent without a carrier). From there, the tools are the experiment: ☀ starts the 18-spoke convergent feed that grows a breathing ember (the M33–M35 canon), ➤ fires the photon laser.

## Play with it

- **Drag** to orbit; **two-finger drag** pans, pinch zooms (or use the **Zoom** slider). It slowly rotates on its own if you leave it alone.
- **☀ drive** — the convergent feed that accretes a breathing ember. Cut it and the core freezes in place (carrier-gated radiation — parked heat only vents while a carrier transits).
- **➤ beam** — a **photon laser**: massless light sourced inside the left drain shell, riding the +x axial channel (v=2) straight across the lattice. Photons carry direction but no mass and never collide. What they do to matter depends on the **Phot** dial — and they never *delete* mass, only kick parked heat back into flight, which then drains off the boundary.
- **Phot select** — the light–matter coupling experiment:
  - *off* — photons stream through parked mass untouched: light that cannot couple.
  - *catalyst* — a transiting photon licenses the carrier-gated emission gate, like a massless carrier: isotropic boil-off with no payload added.
  - *stimulated* — each photon may kick a rest quantum into *its own channel*: coherent directional ablation, the microscopic mechanism under M36's walk-toward-the-beam.
- **⇄ (pair rules)** — the momentum-honest wind/unwind cycle: `2·rest ⇄ c + c¹`. Rest sheds mass as back-to-back antipodal pairs (no net momentum), and head-on collisions can bind a pair back into rest. Measured caveat: the colliding pair is itself a carrier, so a binding site also lights its own emission gate — unwind tends to dominate wind wherever they meet.
- **⌖ (vortex tool)** — arm it, tap the slice plane: injects two concentric rings of moving quanta on the best-tangent equatorial channels — a circulation seed. Watch whether it holds, shears, or thermalizes into parked heat. This is the knot question.
- **● (rock tool)** — arm it, tap the slice plane: drops a cold rest-mass lump — the proven-persistent control case.
- **⧉ / ⤺** — snapshot the field, perturb, rewind.
- **Tuning** — **Slice** + **Width** give a living MRI scan; **Drag** is the transit-friction congestion threshold (IFRIC); **Rad** sets the radiation gate strength (carrier-gated: heat vents only under transit); **Collide** picks the collision variant (uniform / shell-weighted / forward-bias); **Speed** caps ticks per second.

::: details 🔬 Under the Hood: For Physicists & Automata Enthusiasts

### What the engine actually is

- **Substrate:** 72×72×36 even-parity True-FCC sublattice — only half the cubic sites can ever host matter; the 18 moving channels (12 face-diagonal + 6 axial second-shell) carry the lattice geometry. Rendered in the honest embedding: raw cubic coords, odd-parity sites are structural vacuum.
- **Engine:** `src/meso3i.c` compiled to WebAssembly — the same module Yarkovsky's Ember runs. Integer populations (u8) per channel; collide = procedural pair-group shuffle conserving mass and momentum exactly; stream = hop along channel vectors; **friction** (IFRIC) sheds congested transits into the rest channel as parked heat; **radiation** (IFRICM −4) is carrier-gated — inert heat re-emits only while moving mass transits.
- **Photons (IPHOT):** a parallel massless field on the moving channels — streams like quanta, carries no mass, never collides. Flag-gated coupling: `0` uncoupled, `1` catalyst (licenses the emission gate), `2` stimulated emission (rest quantum ejected into the photon's own channel — directional). Momentum is injected/absorbed at these flagged points, like every other non-invariant in the engine. Headless result: a 1-cell +x beam ablated ~14% of a 727-quantum ring fossil in 150 ticks under either coupling mode; with coupling off the same beam left the fossil untouched.
- **Boundary:** `drain_edge(3)` zeroes a 3-cell shell each tick — an open boundary for light as well as mass.

### The pipeline

`meso3i_rg_refresh()` packs {moving, rest, photons} into an RGB8 buffer inside the Wasm heap → `gl.texSubImage3D` per frame → one instanced billboard draw. Cyan ramp = moving flux, blackbody ramp = parked rest mass, violet = the photon field (additive in every palette — a beam must read through vacuum).

### What this is testing

- The vortex tool writes *momentum*, not structure — meso3i has no per-site direction register to pin a weave the way planck3's spin field did. If circulation survives anyway, it's emergent self-consistency; if it thermalizes, that confirms M38's "rocks, not atoms" boundary at loom scale.
- Everything else — accretion, breathing, quiescence, beam drift, two-body attraction — was already measured headless (see [The Friction Substrate](/interference/meso-monograph), M19–M38, each claim commit-anchored).

:::

</div>
