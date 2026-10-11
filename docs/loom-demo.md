---
title: Hopf's Loom
description: WebGL2 volume renderer for the True FCC 3D substrate — the traced Hopfion live in the C engine.
outline: false
layout: page
---

<ClientOnly>
  <FccViewer />
</ClientOnly>

# Hopf's Loom

*The 100×100×40 True FCC substrate — 400,000 nodes running in `planck3.wasm`.*

This instrument streams the RFC-049 chunked/flat C engine's memory straight to the GPU: `quanta`+`spin` are packed into an RG8 3D texture inside the Wasm heap and uploaded per tick (`texSubImage3D`, zero JS copies), then drawn as a single instanced draw of 400k billboard quads. The vertex shader applies the hex-plane embedding with √(2/3) z-spacing and culls vacuum; the Z sliders slice the volume live without touching engine state.

The initial condition is the RFC-048 exact-trace Hopfion (19 nested closed loops, `hold=1.00`, deadlock-free for 400+ ticks in the harness) — the loom's warp and weft. Use **💥** to inject a saturated knot and watch the collision, or scrub the Z range for a tomographic cross-section. Colors by spin class: warm = equatorial (toroidal), cyan = zenith (poloidal up), violet = nadir (poloidal down).

See [`interference.md`](/interference) for the RFC-047→049 arc: graph-traversal closure on the ABC lattice, the in-degree-1 fix that made multi-loop assemblies stable, and the chunk+halo cache architecture this renderer is pointed at.
