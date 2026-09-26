---
title: Langevin's Wake
description: A bare-metal WebAssembly thermodynamic cellular automata engine.
outline: deep
---

# Langevin's Wake
*The Planck Field bare-metal simulation engine.*

Welcome to the sandbox. What you are looking at is not a standard web canvas drawing shapes—it is a 160,000-node physics grid running purely in C, directly mapped to your graphics hardware via a zero-copy WebAssembly memory bridge. 

<div style="margin-top: 2rem; margin-bottom: 2rem; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.4);">
  <iframe src="/wasm/wake/index.html" width="100%" height="700px" style="border: none; display: block; background: #0a0e0a;"></iframe>
</div>

::: details ⚙️ Under the Hood: How the Engine Actually Works

### The Architecture
Most web-based grid simulations (like Conway's Game of Life) are written in JavaScript and use `ctx.fillRect()` to draw squares on a canvas. This causes severe bottlenecks; browsers drop frames if you try to draw more than a few thousand shapes per second.

**Planck Field bypasses the browser's drawing engine almost entirely.**
The physics loop is written in bare-metal C, compiled to WebAssembly (Wasm) with maximum hardware optimizations (`-O3`). The C engine allocates a continuous block of physical memory (a `Uint8ClampedArray`). When the simulation ticks, C mathematically calculates the RGBA pixel values for all 160,000 nodes simultaneously and writes them directly into this memory block. 

JavaScript simply grabs that memory block and blasts it to the screen in a single operation. The result is a rock-solid 60 frames per second.

### Thermodynamic Rules (Modified Game of Life)
Planck Field is built on top of Conway's cellular automata, but introduces two distinct physical constraints that mimic real-world thermodynamics:

1. **Bandwidth Collapse (The c² Limit):** Standard Game of Life grids can grow infinitely. In Planck Field, a localized cluster of nodes cannot exceed a maximum temperature threshold. If too much activity happens in one place, the "bandwidth" of the field collapses, and the nodes instantly die off.
2. **Entropy (Dissipation):** When a node dies, it doesn't just disappear—it leaves behind a thermal exhaust footprint that slowly cools down. This exhaust interferes with future generations, meaning structures must constantly navigate the thermal wakes of their ancestors.

### The JavaScript UI Boundary
While the relentless physics loop happens in C, the geometry is purely controlled by the browser. 

The **Sampler Tool** demonstrates this boundary beautifully: when you click and drag over the canvas, JavaScript queries the Wasm memory block pixel-by-pixel, extracts the spatial data into a JSON array, and saves it to your clipboard. When you select a tool to draw, JavaScript fires a `_set_node` command directly into the C memory loop, allowing you to seamlessly inject structures into the chaos.

:::

### Next Steps
Try switching the **Optical Filter** to *Metabolic* to view the hidden thermal exhaust, or select the **Sampler Tool**, grab a chunk of the grid, and copy it to your clipboard.
