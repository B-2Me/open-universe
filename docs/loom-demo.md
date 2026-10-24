---
title: Hopf's Loom
description: A 3D window into the Planck Field. A self-sustaining routing pattern you can slice, perturb, and rewind.
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

# Hopf's Loom

*A continuous routing cycle, woven from whirlpools: rendering live in your browser.*

> **Milestone instrument.** This page documents the earlier single-spin prototype engine (`planck3.c`), whose stable knots first showed the lattice could hold woven structure. The active engine is the multichannel `meso3i`, **[Joule's Mill](/mill-demo)**, and the current measured record is the [Friction Substrate monograph](/interference/meso-monograph).

What you're looking at is a **Hopfion**: a localized standing wave of extreme routing congestion made of 400,000 tiny cells, each one routing data and resolving friction according to the exact same thermodynamic rules that power [Langevin's Wake](/wake-demo). It opens in **metabolism view**, a thermal portrait, not a photograph: the ember ring is the intense phase friction continuously generated to maintain the loop, while the dim red darkness is the surrounding vacuum. Rendered faint because empty cells are culled from the thermal palette (per the substrate's own accounting the vacuum runs warm; it is the phase-locked knot that freezes). Because the underlying flow is woven into a perfectly closed, phase-locked loop, it continuously re-renders itself without unraveling.

And it's *running*. This is not a video: the little universe is ticking away in a real physics engine inside your browser tab.

## Play with it

- **Drag** to orbit; **two-finger drag** pans, pinch zooms (or use the **Zoom** slider). It slowly rotates on its own if you leave it alone.
- **Focus menu**: quick camera framings: try **Equator slab** (a thin slice through the ring's waist) or **Core bore** (straight down the vortex's throat). The little axes orb on the right edge shows where you're looking; double-tap it to reset.
- **View menu**: you're looking at *metabolism* (heat) by default; switch to **macro** for the clean geometric readout (dense cores glow cyan, the *shape* of the standing wave), **spin class** to paint by flow direction (warm = around the ring, cyan/violet = through the hole), or **density** for raw traffic volume.
- **⌖ (knot tool)**: tap it, then tap *on the structure itself* to inject a burst of dense relational flux. It stays armed for repeat throws; tap ⌖ again to disarm. Every outcome is a deterministic routing resolution, not an animation.
- **⧉ / ⤺**: snapshot the universe, disrupt the traffic patterns, then rewind and try a different perturbation.
- **Tuning**: open the sliders: **Slice** + **Width** turn the torus into a living MRI scan (drop width to 1 and scrub the lattice plane by plane); **Diss** and **Heat** are the substrate's metabolism knobs, crank Dissipation down and routing patterns linger, drop the thermal ceiling and the structures violently blow out.

## How Topological Closure Occurs

On the older substrates this routing pattern was impossible. Continuously painted 3D topologies decayed or collapsed within seconds. This one maintains its coherence because it was *woven*, not painted: its flow was exact-traced cell-to-cell around closed loops, like thread on a loom, until every strand perfectly meshed with its origin. That's the name. Whether the thermodynamic routing in our universe works this exact way is an open question, but here, closed-loop weaving is what allows a macroscopic boundary to persistently re-render itself.

::: details 🔬 Under the Hood: For Physicists & Automata Enthusiasts

### What the engine actually is

- **Substrate:** 100×100×40 stacked-hex (ABC/FCC-style) lattice, 400,000 nodes, 12 ports each, 6 equatorial + 3 zenith + 3 nadir. Parity-free port tables; a fixed port index repeats its offset every layer, so long-range diagonals trace straight lines through the A→B→C→A cycle.
- **Engine:** `src/planck3.c` compiled to WebAssembly, the same register set as the 2D engine (8-bit quanta, 8-bit spin, 16-bit heat, buffer, tension), same canonical physics: Phase Lock, FLOW_CAP routing, occupancy congestion, tension divert, unwind spray, quadrature dissipation.
- **Falsifiability:** the C port is **bit-identical** to the JS harness on all mass channels over 400 ticks (verified natively and in Wasm, `test/loom/t0.bin`/`t400.bin` regression vectors).

### The pipeline (the zero-copy path)

`quanta`+`spin` are packed into an RG8 buffer *inside* the Wasm heap (`planck3_rg_refresh`) and uploaded per tick via `gl.texSubImage3D`: the physics state never crosses into a JavaScript array. In metabolism mode the G channel carries **scene-normalized heat** (thermal-camera style min→max over live cells), so the palette always spans the structure's full internal gradient rather than absolute temperature. One instanced draw renders all 400k cells as soft billboard quads; the vertex shader applies the hex-plane embedding at √(2/3) layer spacing, culls vacuum, and ghosts anything outside the slice slab to ~6% alpha so the silhouette stays readable.

### What the Hopfion is made of

19 nested closed field-line loops traced by a memoized depth-first search over the port graph. Each loop only painted if it returned to its seed *within Phase-Lock tolerance* on every hop. 27,971 painted cells, in-degree exactly 1 everywhere, `hold = 1.00` through t=400: the structure never deviates from its traced routing pattern.

### The honest residuals

- `coh = 0.61`, not 1.00: that metric counts cells whose *quantized* port lies within 60° of the *continuum* ideal field; it's a quantization ceiling, not an instability.
- ~2/3 of seeds close, so the envelope is a subset of ideal field lines, not a complete torus foliation.
- The fast chunk/halo memory mode is bit-exact in this laminar regime but diverges under knot congestion (push-ordering); the flat mode you see running is the canonical reference.

### Full experiment log

The complete chain: RFC-043's closed-streamline law → the RFC-047 tracing failure → the RFC-048 crystallography fix → the RFC-049 C port → this renderer. Lives in the audit log: [The Interference](/interference).

:::

</div>
