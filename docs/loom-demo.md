---
title: Hopf's Loom
description: A 3D window into the Planck Field — a woven knot of matter you can slice, smash, and rewind.
outline: false
layout: page
---

<ClientOnly>
  <LoomSimulator />
</ClientOnly>

# Hopf's Loom

*A knot of matter, woven from whirlpools — alive in your browser.*

What you're looking at is a **Hopfion**: a smoke-ring-shaped knot made of 400,000 tiny cells, each one shoving its neighbors according to the same thermodynamic rules that power [Langevin's Wake](/wake-demo). It opens in **metabolism view** — a thermal portrait, not a photograph: the ember-orange ring is heat locked inside the knot, the cold blue-violet darkness is the vacuum it sits in. Because the underlying flow is woven into a closed loop, it can't simply unravel — the same reason a knot in a rope stays a knot.

And it's *running*. This is not a video — the little universe is ticking away in a real physics engine inside your browser tab.

## Play with it

- **Drag** to orbit. It slowly rotates on its own if you leave it alone.
- **Slice** + **Width** — the torus becomes a living MRI scan. Drop the width to 1 and scrub through the lattice plane by plane.
- **⌖ (knot tool)** — click it, then click *on the structure itself* to inject a bolt of dense matter. Watch the collision stir the vacuum; it may survive as a lump, spray apart, or get eaten by the ring. Every outcome is physics, not animation.
- **⧉ / ⤺** — snapshot the universe, smash things into it, then rewind and try a different shot.
- **View menu** — quick camera presets: try **Equator slab** (a thin slice through the ring's waist) or **Core bore** (straight down the vortex's throat).
- **Color menu** — you're looking at *metabolism* (heat) by default; switch to **spin class** to paint by flow direction (warm = around the ring, cyan/violet = through the hole) or **density** for raw mass.

**Diss** and **Heat** are the substrate's metabolism knobs — how fast structure radiates energy, and how much heat a cell can take before it explosively unwinds. Crank Dissipation down and matter lingers; drop the thermal ceiling and knots detonate.

## Why it matters

On the older substrates this knot was impossible — every attempt to paint a 3D particle decayed or collapsed within seconds. This one survived because it was *woven*, not painted: its flow was traced cell-to-cell around closed loops, like thread on a loom, until every strand came home to its start. That's the name. Whether matter in our universe works this way is an open question — but here, weaving is what makes a particle a particle.

::: details 🔬 Under the Hood: For Physicists & Automata Enthusiasts

### What the engine actually is

- **Substrate:** 100×100×40 stacked-hex (ABC/FCC-style) lattice, 400,000 nodes, 12 ports each — 6 equatorial + 3 zenith + 3 nadir. Parity-free port tables; a fixed port index repeats its offset every layer, so long-range diagonals trace straight lines through the A→B→C→A cycle.
- **Engine:** `src/planck3.c` compiled to WebAssembly — the same register set as the 2D engine (8-bit quanta, 8-bit spin, 16-bit heat, buffer, tension), same canonical physics: Phase Lock, FLOW_CAP routing, occupancy congestion, tension divert, unwind spray, quadrature dissipation.
- **Falsifiability:** the C port is **bit-identical** to the JS harness on all mass channels over 400 ticks (verified natively and in Wasm — `test/loom/t0.bin`/`t400.bin` regression vectors).

### The pipeline (why it's fast)

`quanta`+`spin` are packed into an RG8 buffer *inside* the Wasm heap (`planck3_rg_refresh`) and uploaded per tick via `gl.texSubImage3D` — the physics state never crosses into a JavaScript array. One instanced draw renders all 400k cells as soft billboard quads; the vertex shader applies the hex-plane embedding at √(2/3) layer spacing, culls vacuum, and ghosts anything outside the slice slab to ~6% alpha so the silhouette stays readable.

### What the Hopfion is made of

19 nested closed field-line loops traced by a memoized depth-first search over the port graph — each loop only painted if it returned to its seed *within Phase-Lock tolerance* on every hop. 27,971 painted cells, in-degree exactly 1 everywhere, `hold = 1.00` through t=400: the structure never deviates from its traced spins.

### The honest residuals

- `coh = 0.61`, not 1.00 — that metric counts cells whose *quantized* port lies within 60° of the *continuum* ideal field; it's a quantization ceiling, not an instability.
- ~2/3 of seeds close, so the envelope is a subset of ideal field lines, not a complete torus foliation.
- The fast chunk/halo memory mode is bit-exact in this laminar regime but diverges under knot congestion (push-ordering); the flat mode you see running is the canonical reference.

### Full experiment log

The complete chain — RFC-043's closed-streamline law → the RFC-047 tracing failure → the RFC-048 crystallography fix → the RFC-049 C port → this renderer — lives in the audit log: [The Interference](/interference).

:::
