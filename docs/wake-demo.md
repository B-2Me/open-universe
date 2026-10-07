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
Nodes possess a topological spin (chirality). When flux arrives at an occupied node, the Phase Friction ($\Phi$) charged to the receiver is *continuous in the turn angle* — a least-friction traversal kernel applied per unit of quanta:
$$\Phi = \tau(1 - \cos(\Delta \theta))$$
Straight-through arrivals are free, a glancing turn costs a little, and full reversal is the most expensive exchange the substrate offers ($2\tau$). Aligned spins mesh into coherent flow, letting relational momentum pass smoothly; opposing momentum pays the maximum phase toll and floods the local node with metabolic heat. This tension naturally resolves down the path of least resistance, driving physical repulsion or shaping structures into stable circulating vortices.

**Hydrodynamic Integrity (Phase Lock):**
Momentum in the raw engine is ballistic — a node's spin is always overwritten by the direction of its incoming momentum, so no painted circulation can survive: vortices shear apart into linear streams within a few ticks. But a knot of matter is a *persistent phase pattern*, and the substrate's structure must steer the flux that flows through it. Phase Lock grants the lattice that inertia: when a node's incoming momentum lies within ±45° of its established spin, the node keeps its own direction — the phase lattice acts as a waveguide, channeling laminar flux rather than being erased by it. Orthogonal or head-on collisions exceed the tolerance, the lattice shatters, and raw momentum writes a new phase. And because phase is structural state rather than energy, an *empty* node receiving no flux holds its spin — silence never erases a waveguide; only flux rewrites it. A node still holding mass when momentum falls silent relinquishes its phase and goes inert: in this substrate, matter must keep circulating or it is no longer matter. This is what makes bound structures possible at all: the knot channels the flow, and the channeled flow sustains the knot. On the 8-direction lattice, the native closed streamline is the octagon — its flat edges carry exact spin tangents, which is why the Synthetic Electron's torus is an octagonal waveguide rather than a painted circle.

**3. Occupancy Gravity & the In-Flight Buffer**
Gravity is not an invisible geometric curve pulling objects toward mass; it is congestion in the substrate's routing fabric — and congestion is carried *state*, not a threshold heuristic. Every node holds a per-node **input buffer**: arriving quanta stage as in-flight flux and integrate into the resident count only up to the node's hard capacity. Overflow does not silently clip — it thermalizes as acoustic backscatter, so nothing is ever lost off the books.

Congestion is measured on **occupancy** — resident *plus* staged quanta. A jammed neighbor refracts passing flux toward the densest node that can still absorb, so mass accretes onto congestion boundaries rather than being tugged at a distance. Every node relays at most `FLOW_CAP` quanta per tick, so a dense packet drains over multiple ticks — inertia falls out of the accumulator rather than being assumed. And when a port's occupancy saturates (q + staged > 200), it does not merely refuse entry: it **bounces the flux straight back**. Deadlock walls are mirrors — exclusion pressure is real upstream load, the routing-table expression of the Pauli principle:
$$F = T \frac{\Delta S}{\Delta x}$$

**4. Propagation Friction (Cosmological Redshift)**
Propagation incurs inevitable thermodynamic dissipation. Every time a quanta packet is handed off to an adjacent Planck node, it undergoes a baseline actualization friction. Light frequency degrades logarithmically across the active medium:
$$E_{received} = E_{emitted} e^{-\mu d}$$

**5. The Cold Matter Inversion (Stefan-Boltzmann Dissipation)**
Localized relational friction continuously dissipates into the surrounding field. Nodes cool down proportionally to the square of their local temperature limit, dropping toward a minimum baseline floor (The Cosmic Microwave Background constraint). Because of this, heat has a hard mathematical ceiling. The node's bandwidth is a quadrature budget — $C_{max}^2 = C_s^2 + C_i^2$ — so spatial I/O load (arrivals, momentum, buffered backlog) starves internal dissipation exactly the way the uncertainty budget predicts. If a node must spend massive capacity maintaining a dense topological deadlock (occupancy > 200), it experiences extreme metabolic drag, over-dissipates its heat, and collapses to the stochastic floor (~2 heat). Conversely, the empty quantum foam easily sustains an ambient vibration of ~325 heat. **The vacuum is hot. Matter is freezing.**

### Topology: Shell-World vs. Knot-World
To prove that geometry is the dashboard and not the territory, the engine compiles two distinct universes: an 8-fold (Octagonal) substrate and a 6-fold (Hexagonal) substrate. **The underlying physical laws, thermal limits, and code logic are identical in both** — one C source, one `-DTOPOLOGY_HEX` compile flag. The only variable is the coordination number: how many neighbors a node routes traffic to.

By running identical thermodynamic accounting on two different graphs, we observe a radical emergence: changing the adjacency graph shifts the physical universe from classical fluid mechanics to quantum string dynamics.

*   **Invariant Viscosity:** The engine enforces a strict topological invariant for heat diffusion: a channel always transfers exactly $1/9$ of a node's heat per tick. Because a 6-fold node only has 6 avenues to dump heat, it natively retains $3/9$ of its heat locally, compared to an 8-fold node's $1/9$. In our simulator, this means 6-fold matter sustains slightly higher internal thermodynamic pressure, eroding ~17% faster under identical ambient quantum foam.
*   **Oct-8 (Macroscopic Continua):** On the 8-fold substrate, matter bounds itself as a continuous, 2D shell (a volumetric torus). When subjected to ambient quantum foam, the shell degrades *continuously* (thinning and stretching), mirroring the classical fluid mechanics of a dissipating vortex in water.
*   **Hex-6 (Quantum String Dynamics):** On the 6-fold substrate, the volumetric torus cannot exist. The native stable structure collapses into a 1-dimensional braided graph loop. When this 1D filament is struck by a massive shockwave, it does not thin out like a fluid. It suffers *quantized severing*—individual links are cleanly cut. This is a direct computational analogue to **Quantum Chromodynamics (QCD)**, where pulling quarks apart causes the color-flux string to snap.
*   **The Empirical Bridge:** The hex-native engine maps directly to empirical observations in 2D quantum materials. In real-world physics, forcing a rigid 6-fold hexagonal carbon lattice (like graphene) into sub-nanometer asymmetric curvature creates a massive 1D topological conduit. Researchers found a hard threshold voltage ($\sim 1\text{V}$) that acts as a barrier, causing highly asymmetric current flow. In the Planck Field, this is the exact measurement of **Phase Friction**. Pushing current "against" the 6-fold curvature-induced phase lock causes a massive spike in metabolic dissipation, creating the threshold barrier.

*(You can test this yourself: open the System drawer and switch the Substrate between ⏹️ Oct8 and ⬡ Hex6. The ⬡ Filament Under Fire scenario reproduces the bombardment test live.)*

### The Biological Swerve
While the grid is perfectly deterministic, **you** are the external biological interface. When you click the grid to inject a pattern, you are executing an intentional interference. You are actively altering the relational constraints of the substrate, forcing the physics engine to resolve your interference through a cascade of causal actualizations.

The Injection Matrix lets you choose *which* relational channels your interference writes — density (fluid displacement), heat (pure thermal energy), or spin (directional momentum) — and how strongly, via per-channel dose sliders. Injection obeys the field's own rules: dose into dense matter thermalizes as backscatter, and any overflow past the node's capacity stages into its input buffer as in-flight flux — nothing is ever silently discarded. Enable all three channels and the stamp overwrites the field verbatim; dial the spin channel toward entrainment and your injected mass adopts the ambient flow instead of fighting it.
:::