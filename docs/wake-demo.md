---
title: Langevin's Wake
description: A bare-metal WebAssembly thermodynamic cellular automata engine.
outline: false
overscroll: false
layout: page
pageClass: wake-page
---

<ClientOnly>
  <WakeSimulator />
</ClientOnly>

# Langevin's Wake
*The Planck Field bare-metal simulation engine.*

Welcome to thermodynamic reality. What you are looking at is not a standard web canvas rendering frictionless geometric shapes. It is a 160,000-node physics grid running purely in C, calculating fundamental relational friction and directly mapping it to your graphics hardware via a zero-copy WebAssembly memory bridge. 

::: details ⚙️ Under the Hood: The Hardware Metaphor

### External Depth vs. Internal Depth
This sandbox is a literal manifestation of the Planck Field philosophy. 

**The C Engine (External Depth):** The physics loop is written in bare-metal C, compiled to WebAssembly with maximum hardware optimizations. The C code knows nothing about geometry, shapes, or user input. It exclusively calculates the relentless, microscopic accounting of thermodynamic friction, phase spins, and integer limits for all 160,000 nodes simultaneously.

**The JavaScript UI (Internal Depth):** The browser interface acts as the biological dashboard. JavaScript queries the chaotic thermal data from the Wasm memory block and compresses it into a clean, geometric visual matrix (the Macro layer). When you use the Sample tool to probe a region — or Frame Capture in the System drawer to export a PNG/VTK — JavaScript is filtering the static, extracting relational boundaries, and defining it as "useful" geometry. The grid doesn't know it's a shape; only the UI does.

### The Objective Constraints
Unlike traditional cellular automata which rely on arbitrary "rules" of birth and death, this engine is strictly deterministic and rooted in physical constraints. It continuously calculates the following mechanics:

**1. Topological Unwinding ($E=mc^2$)**
Mass is a deadlocked knot of relational tension. When the environmental thermal limit drops below the localized heat of a node, the topological deadlock unwinds. The total actualization yield instantly saturates the local grid, converting mass into thermal exhaust:
$$Y_{act} = (N_{nodes} \cdot \tau_{knot}) \times \Omega_{max}$$

**2. Phase Friction (Electromagnetism)**
Nodes possess a topological spin (chirality). When nodes interact, their Phase Friction ($\Phi$) is dictated by momentum alignment:
$$\Phi = \tau(1 + \cos(\Delta \theta))$$
Aligned spins mesh into coherent flow, allowing relational momentum to pass smoothly. Opposite spins crash head-on, triggering immediate momentum cancellation and generating a massive spike in metabolic dissipation (a heavy heat penalty). This tension naturally resolves down the path of least resistance, driving physical repulsion or shaping structures into stable circulating vortices.

**Hydrodynamic Integrity (Phase Lock):**
Momentum in the raw engine is ballistic — a node's spin is always overwritten by the direction of its incoming momentum, so no painted circulation can survive: vortices shear apart into linear streams within a few ticks. But a knot of matter is a *persistent phase pattern*, and the substrate's structure must steer the flux that flows through it. Phase Lock grants the lattice that inertia: when a node's incoming momentum lies within ±45° of its established spin, the node keeps its own direction — the phase lattice acts as a waveguide, channeling laminar flux rather than being erased by it. Orthogonal or head-on collisions exceed the tolerance, the lattice shatters, and raw momentum writes a new phase. And because phase is structural state rather than energy, a node receiving no flux simply holds its spin — silence never erases the lattice; only flux rewrites it. This is what makes bound structures possible at all: the knot channels the flow, and the channeled flow sustains the knot. On the 8-direction lattice, the native closed streamline is the octagon — its flat edges carry exact spin tangents, which is why the Synthetic Electron's torus is an octagonal waveguide rather than a painted circle.

**3. Entropic Gravity**
Gravity is not an invisible geometric curve; it is the entropic gradient of the substrate. When local momentum is shunted by a deadlocked boundary, the grid resolves the tension by routing the quanta into the coolest adjacent locus:
$$F = T \frac{\Delta S}{\Delta x}$$

**4. Propagation Friction (Cosmological Redshift)**
Propagation incurs inevitable thermodynamic dissipation. Every time a quanta packet is handed off to an adjacent Planck node, it undergoes a baseline actualization friction. Light frequency degrades logarithmically across the active medium:
$$E_{received} = E_{emitted} e^{-\mu d}$$

**5. The Cold Matter Inversion (Stefan-Boltzmann Dissipation)**
Localized relational friction continuously dissipates into the surrounding field. Nodes cool down proportionally to the square of their local temperature limit, dropping toward a minimum baseline floor (The Cosmic Microwave Background constraint). Because of this, heat has a hard mathematical ceiling. If a node must spend massive computational bandwidth maintaining a dense topological deadlock (mass > 200), it experiences extreme metabolic drag, over-dissipates its heat, and collapses to the stochastic floor (~2 heat). Conversely, the empty quantum foam easily sustains an ambient vibration of ~325 heat. **The vacuum is hot. Matter is freezing.**

### The Biological Swerve
While the grid is perfectly deterministic, **you** are the external biological interface. When you click the grid to inject a pattern, you are executing an intentional interference. You are actively altering the relational constraints of the substrate, forcing the physics engine to resolve your interference through a cascade of causal actualizations.

The Injection Matrix lets you choose *which* relational channels your interference writes — density (fluid displacement), heat (pure thermal energy), or spin (directional momentum) — and how strongly, via per-channel dose sliders. Enable all three and the stamp overwrites the field verbatim; dial the spin channel toward entrainment and your injected mass adopts the ambient flow instead of fighting it.
:::
