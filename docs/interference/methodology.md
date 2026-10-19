---
title: Methodology & Reproducibility
audio: /audio/methodology.mp3
---
<ClientOnly>
  <StickyAudioPlayer :audioSrc="$frontmatter.audio" />
</ClientOnly>

# Methodology & Reproducibility

This document specifies the formal mathematical architecture, state-space invariants, causal thermodynamic laws, and deterministic reproduction protocols for the **Langevin's Wake** (`planck.c`) and **Hopf's Loom** (`planck3.c`) discrete lattice engines.

All macroscopic behaviors observed in [The Hopfion Zoo](/hopfion-zoo) and [Hopf's Loom](/loom-demo)—including 3D topological soliton stability, inertial rigidity under gradient stress, and multi-knot scattering cascades—emerge strictly from local, integer-only transition operators executing across a stationary 12-neighbor lattice without floating-point dynamics, pseudo-random thermal baths, or continuous differential solvers.

---

## 1. Lattice Topology & Adjacency Invariants

The 3D simulation domain is a finite, three-dimensional **True Face-Centered Cubic (FCC)** Eulerian lattice of runtime dimension $W \times H \times D$ (`planck3_init()` defaults to $100 \times 100 \times 40 = 400,000$ nodes in browser; `planck3_init_dims(256, 256, 256)` scales to $16,777,216$ nodes for headless sweeps and collision basins).

* **Coordination Number ($z = 12$):** Every node $i$ communicates exclusively with its 12 nearest neighbors via fixed directional spin ports $s \in \{1, \dots, 12\}$ (`0` = stationary/unaligned):
  * **Ports `1–6` (Equatorial):** 6 planar hex-grid neighbors handling toroidal circulation.
  * **Ports `7–9` (Zenith):** 3 upper-layer neighbors ($+z$) handling ascending poloidal flow.
  * **Ports `10–12` (Nadir):** 3 lower-layer neighbors ($-z$) handling descending poloidal return.
* **Parity-Free A-B-C Stacking:** Unlike hexagonal close-packed (`HCP`, A-B-A-B) lattices where vertical port azimuths invert on alternating layers, every layer in the True FCC substrate offers zenith ports $\{1,3,5\}$ and nadir ports $\{2,4,6\}$. A single port index hops the identical offset layer-to-layer, tracing a straight 3D diagonal through the A→B→C→A cycle with **0 broken reciprocal edges** (verified across 4,740,000 directed edges at $100 \times 100 \times 40$).
* **Honest Spatial Embedding:** Because the A-B-C stagger lives in the port offsets rather than shifted layer origins, nodes embed into Euclidean render space at $(x + 0.5 \cdot (y \bmod 2),\; y \cdot \frac{\sqrt{3}}{2},\; z \cdot \sqrt{\frac{2}{3}})$ where $\sqrt{2/3} \approx 0.816$.
* **No Global Coordinates:** The transition operator $\mathcal{T}$ is strictly translation-invariant. Nodes have no access to their global $(x,y,z)$ index or global tick $t$; state updates depend solely on the registers of the node and its 12 immediate neighbors.

---

## 2. Discrete Node State Space (`Node3`)

To eliminate IEEE-754 floating-point truncation drift and chaotic rounding divergence over multi-thousand-tick integrations, each lattice site in `planck3.c` is represented as a compact 6-byte integer struct (`Node3`):

| Register | Type | Range | Physical / Algorithmic Role |
| :--- | :--- | :--- | :--- |
| **`quanta` ($q$)** | `uint8_t` | $0 \dots 255$ | Resident discrete packet count (local mass density; deadlock threshold $> 200$). |
| **`spin` ($s$)** | `uint8_t` | $0 \dots 12$ | Active directional port index (`1–6` equatorial, `7–9` zenith, `10–12` nadir, `0` stationary). |
| **`heat` ($h$)** | `uint16_t` | $0 \dots 65535$ | Accumulated local routing friction and angular shear excitation. |
| **`buffer` ($b$)** | `uint8_t` | $0 \dots 255$ | Staged in-flight flux arriving during the current synchronous tick. |
| **`tension` ($\phi$)** | `uint8_t` | $0 \dots 255$ | Diffusing scalar occupancy-congestion field emitted by near-deadlock nodes ($q \ge 200$). |

*(Note: Load-time provenance masks `painted` $\in \{0, 1, 2\}$ are tracked externally by the analysis harnesses `sweep.mjs`, `boost.mjs`, and `collide.mjs` so the 6-byte core node carries zero particle-ID register overhead.)*

---

## 3. Synchronous Transition Operator ($\mathcal{T}$)

Time advances in discrete ticks $t \to t + 1$. The engine supports three memory traversal modes sharing the identical `planck3_node_tick` physics kernel: `flat` (canonical deterministic global order), `halo` ($20^3$ interior / $22^3$ ghost-ring chunks for $1.15\text{–}1.7\times$ cache acceleration in laminar regimes), and `ordered-chunk`.

### Phase A: Local Flux, Congestion & Tension Shear
1. **Transport Bandwidth Cap (`FLOW_CAP`):** An active node ($s \in \{1 \dots 12\}$) transfers a bounded integer count of `quanta` per tick along port $s$, enforcing a strict causal speed limit of $c = 1\text{ hop / tick}$.
2. **Near-Field Congestion & Far-Field Tension:**
   * **Congestion Routing (Near-Field):** When a target neighbor approaches the deadlock occupancy threshold (`DEADLOCK = 200`), blocked flux deflects across adjacent reciprocal ports rather than clipping.
   * **Propagating Tension Field (Far-Field):** Nodes at or above `T_EMIT_MIN = 200` emit scalar `tension` ($\phi$), which diffuses across neighbors and decays per tick, creating a graded potential well of characteristic reach $\ell \approx \sqrt{D/\lambda} \approx 10\text{–}25$ cells. Arriving flux inside a tension gradient shears up-field into flowing neighbor buffers (`T_DIVERT = 4`).
3. **Phase Lock & Angular Phase Friction ($\Phi$):** A node's painted phase steers flux cleanly when incoming momentum lies within the $\le 60^\circ$ lock tolerance of the lattice port geometry. Misaligned handoffs and $180^\circ$ head-on conflicts incur a discrete integer penalty added to the `heat` register:
   $$\Delta h_{\text{friction}} = \tau \left(1 - \cos(\Delta \theta_{ij})\right)$$
4. **Conservative Unwinding Spray (`+spray`):** When local `heat` breaches `thermal_limit` (default $50,000$), the node undergoes topological unwinding. Mass is never deleted; the failing knot's `quanta` sprays into neighboring buffers as un-actualized radiation, preserving strict global conservation.

### Phase B: Degree-Normalized Diffusion & Quadrature Drain
1. **Degree-Normalized Diffusion:** To maintain identical diffusivity across `Hex6` ($\text{deg}=6$), `Oct8` ($\text{deg}=8$), and `True FCC` ($\text{deg}=12$) substrates without bit-shift overflow, per-tick neighbor exports are normalized by coordination degree:
   $$\Delta \phi_{\text{export}} = \frac{3 \cdot \phi}{4 \cdot \text{deg}} \quad (75\% \text{ total share}), \qquad \Delta h_{\text{export}} = \frac{2 \cdot h}{3 \cdot \text{deg}} \quad (67\% \text{ total share})$$
2. **Quadrature Bandwidth Drain (`BWF_LUT`):** Total node processing capacity is bounded by the vector budget $C_{\max}^2 = C_s^2 + C_i^2$. The available cooling fraction at routing load $r \in [0, 220]$ is resolved via a 16-bit integer lookup table (`uint16_t BWF_LUT[256]`, widened from `uint8_t` to prevent $256 \to 0$ wraparound at low load $r \le 13$):
   $$\text{BWF\_LUT}[r] = \text{round}\left(256 \cdot \sqrt{1 - \left(\frac{r}{220}\right)^2}\right)$$

---

## 4. Causal Thermodynamics & Cold Matter Inversion

A foundational distinction of this framework is that the thermal register (`heat`, $h \in \text{uint16}$) does not represent a statistical-mechanical ensemble average, stochastic Brownian velocity dispersion, or coupling to an external probabilistic heat bath. In classical continuum physics, standard parabolic heat and fluid equations (Fourier and Navier-Stokes) unphysically permit infinite propagation speeds, forcing relativists and aerospace engineers to bolt on second-order hyperbolic delay patches (such as Maxwell-Cattaneo or Israel-Stewart "extended causal thermodynamics") to prevent thermal flux from outrunning the speed of light. On our discrete 12-neighbor lattice, causal transport ($c = 1\text{ hop / tick}$) is native to the adjacency graph by construction—requiring zero differential relaxation patches—and implements **Discrete Causal Thermodynamics**: an exact, PRNG-free integer accounting of directional routing impedance and finite node bandwidth.

| Property | Classical / Continuum Thermodynamics | Discrete Causal Thermodynamics (`planck3.c`) |
| :--- | :--- | :--- |
| **Microscopic Basis** | Probabilistic ensemble over continuous phase space ($\mathbb{R}^{6N}$). | Deterministic integer state transitions on a 12-port FCC lattice. |
| **Causal Speed Limit** | Infinite in classical Fourier/Navier-Stokes; patched via hyperbolic $\tau$ delay terms in Israel-Stewart. | Native $c = 1\text{ hop / tick}$ (`FLOW_CAP`) enforced by neighbor adjacency. |
| **Origin of Heat ($h$)** | Random microscopic kinetic jitter ($k_B T$). | Exact integer residual of angular port misalignment ($\Phi$) and hop friction ($\mu$). |
| **Cooling Mechanism** | Passive statistical diffusion into an infinite external reservoir. | Local per-tick quadrature bandwidth allocation (`BWF_LUT`). |
| **Equilibrium Fate of Solitons** | Entropic dissipation into uniform thermal noise unless externally pumped. | **Cold Matter Inversion:** Zero-friction ($\Delta\theta \le 60^\circ$) phase-locked cores quench to the thermal floor. |

### 4.1 The Quadrature Causal Bandwidth Budget
Every lattice site possesses a fixed, finite causal processing capacity $C_{\max}$ per discrete Planck tick ($c = 1\text{ hop / tick}$). A node cannot simultaneously route maximum mass flux ($C_s$) and execute maximum thermal relaxation ($C_i$). When local routing load $r$ is below the saturation cliff ($r < 220$), unallocated causal capacity $\text{BWF\_LUT}[r]$ drains accumulated `heat` toward the register floor at the configured `dissipation` rate (default $15$). When routing congestion saturates the node ($r \to 220$), $\text{BWF\_LUT}[r] \to 0$, choking thermal drain and trapping heat until the node unwinds via radiation spray.

### 4.2 Cold Matter Inversion
In continuum statistical mechanics, localized matter is treated as a high-energy excitation that naturally decays into a lower-energy, high-entropy background. In Causal Thermodynamics, finite node bandwidth inverts this relationship:

1. **Unstructured Vacuum Foam Is Warm:** In an active zero-point or turbulent background (such as the RFC-042 reciprocating $q=1$ floor `hexzpe`), opposing streams continuously collide at $180^\circ$, generating $\sim 24\text{ heat/tick}$ per cell and settling into a warm steady-state equilibrium floor ($h \approx 181$).
2. **Phase-Locked Topological Solitons Are Cold:** Within a coherent 3D Hopfion traced by `pathfinder.mjs`, every loop forms an exact in-degree-1 cycle where each hop stays within the $\le 60^\circ$ Phase-Lock window at sub-deadlock density ($q < 200$). Because destructive head-on clashes vanish while `BWF_LUT` cooling capacity remains open, the soliton continuously drains its internal `heat` toward the baseline floor.

Consequently, a stable particle does not fight entropy through external energy pumping; it persists as a **cold, phase-locked causal anchor** carving a frictionless slipstream through a warm substrate.

### 4.3 Hopfions as Causal Thermodynamic Attractors
Because crossing trajectories incur heavy Phase Friction and thermal unwinding while closed, linked trajectories circulate without collision penalties, 3D Hopfions act as natural **causal thermodynamic attractors** of the True FCC substrate. Under perturbation or turbulent relaxation, misaligned packets heat up, lose Phase Lock, and shed radially as evaporative spray—leaving the surviving linked core to quench into a stable eigenstate.

---

## 5. Conservation Laws & Quantitative Telemetry

Every headless run continuously audits four primary macroscopic observables:

1. **Exact Mass Conservation:** Across closed runs, total system occupancy (resident `quanta` + staged `buffer`) is strictly invariant:
   $$Q_{\text{total}}(t) = \sum_{i=1}^{N_3} \left(q_i(t) + b_i(t)\right) = Q_{\text{total}}(0)$$
2. **Skeleton Centroid & Velocity (`v10`):** Computed exclusively over surviving painted cells (`painted != 0`) inside the primary connected BFS component, making trajectory tracking immune to boundary wall-flood and ambient accretion bias.
3. **Knot Retention (`knotRetain` $\in [0, 1]$):** The fraction of initial knot mass remaining bound within the live connected component.
4. **Painted Coherence (`coherence` $\in [0, 1]$):** Structural retention of the original closed-streamline skeleton across the duration of the run.

---

## 6. Falsification Summary (Negative Results)

Before isolating the 37 stable 3D Hopfion eigenstates on the True FCC lattice, five alternative hypotheses were falsified and logged in [The Open Frontier](/interference/frontier):

* **Active ZPE Shielding [RFC-042, `hexzpe`]:** A reciprocating $q=1$ floor maintained exact macro-isotropy ($\text{netP} = 0$) at $h \approx 181$, but caused 2D rings to absorb floor mass and sever earlier than sparse foam.
* **Unclosed Vortex Envelopes [RFC-043, `hexvort`]:** Continuum-quantized tangent rings leaked radially and clumped into "vortex necklaces" (`ccirc` $\to 0.02$), proving that **streamline closure by construction** is required for zero-loss survival.
* **Planar Flank Shielding [RFC-044, `+flank`]:** Local angle refusal could not distinguish $60^\circ$ corner turns (`dd=1`) of closed hex orbits from lateral infiltration.
* **Planar Z-Relief Channels [RFC-045 / RFC-046, `+zshadow` / `+zhopfion`]:** Out-of-plane overflow drains suppressed deadlock knots (`fdead` $\to 0.015$) but bled $43\%\text{–}83\%$ of band mass because displaced re-entry destroyed toroidal-poloidal winding topology.
* **HCP Parity Frustration [RFC-047]:** On an A-B-A-B stacked-hex 12-port grid, layer-alternating vertical azimuths deleted required descent ports on even layers (`0/29` lock-tolerant closures), necessitating the parity-free A-B-C **True FCC** lattice [RFC-048].

> **Continuation note:** this summary ends with the Hopfion-dictionary era. The subsequent M1–M18 grounded-measurement campaign (conservation, cavity equilibration, detector avalanches, arrival-phase interferometry, breather clocks, ecology census, molecular binding, and the absent-channel proofs) is logged in [The Open Frontier](/interference/frontier) and consolidated in [Discrete Quantum Optics](/interference/discrete-quantum-optics). Its central finding reframes §4.3: the substrate's dominant spontaneous attractors are not topological solitons but τ=4 congestion-captured breathers, τ=1 spin-locked filaments, and scheduling-exclusion dimers — all anchored at v=0 (M17).

---

## 7. Deterministic Reproduction Suite

All empirical claims on this site can be reproduced locally from source.

### 1. Build the Engines (Docker / Emscripten & GCC)
Always compile via `src/build.sh` so modularized exports (`createPlanck`, `createPlanckHex`, `createPlanck3`) and `-DGIT_REV` provenance stamps are preserved:
```bash
# Build 2D and 3D WebAssembly modules
cd src
docker run --rm -v "$PWD/..:/src" -w /src/src emscripten/emsdk:3.1.61 bash build.sh

# Run native C verification against reference state dumps (0 mass-channel diffs over 400 ticks)
docker run --rm -v "$PWD:/src" -w /src/src gcc:13 \
  sh -c "gcc -O2 -Wall planck3.c planck3_test.c -o /tmp/p3t -lm && \
         /tmp/p3t /src/test/loom/t0.bin 60 /src/test/loom/t400.bin"
```

### 2. Trace & Sweep the 37-Specimen Hopfion Dictionary
`pathfinder.mjs` runs a memoized Phase-Lock DFS ($\le 60^\circ$/hop, strict in-degree-1 vetting) on the 12-port FCC graph and writes `seeds/hopfion_<R0>_<R1>.json`. `sweep.mjs` loads each seed into `planck3.wasm` (`dissipation = 15`, `thermal_limit = 50000`) and writes `knot_dictionary.json`:
```bash
# Trace canonical 100x100x40 Hopfion (19 loops, 27,971 cells, 1,678,260 quanta)
node script/pathfinder.mjs --w=100 --h=100 --d=40 --r0=25 --r1=9

# Trace 256^3 dictionary candidates and run 400-tick stability sweep
node script/pathfinder.mjs --r0=32,64,72,80 --r1=8,12,16,20
node script/sweep.mjs --config=config/full-sweep.json

# Monitor live sweep/basin progress
node script/status.mjs --config=config/full-sweep.json

# Export settled ZOO3 binary specimens for the WebGL Hopfion Zoo
node script/export-zoo.mjs
```

### 3. Reproduce Kinematic Boost & $256^3$ S-Matrix Collision Basins
`boost.mjs` tests inertial stability under injected boundary flux envelopes; `collide.mjs` dual-spawns dictionary knots along FCC axes and classifies scattering outcomes via dual painted-mask BFS while exporting sparse ParaView `.vtk` frames (`logs/vtk/<run>/frame_NNNNN.vtk`):
```bash
# Kinematic interference basin (Stage 1 gentle / Stage 2 tension)
node script/boost.mjs --config=config/boost-pilot.json

# 256^3 S-Matrix collision runs (head-on b=0 and asymmetric glancing b=15)
node script/collide.mjs --config=config/collide-matrix.json
```

### 4. Binary Telemetry Formats (`ZOO3` and `P3ST`)
* **`ZOO3` Sparse Specimen Format (`/public/hopfion/*.bin`):**
  * **Header (20 bytes):** `0x5a4f4f33` (`"ZOO3"` big-endian magic, 4B) + `w` (`u32` LE, 4B) + `h` (`u32` LE, 4B) + `d` (`u32` LE, 4B) + `n` (`u32` LE active cells, 4B).
  * **Records ($n \times 7$ bytes):** `[x: u8, y: u8, z: u8, quanta: u8, spin: u8, tension: u8, painted: u8]`.
* **`P3ST` Full Lattice Snapshot (`/public/loom/hopfion.p3st`):**
  * **Header (16 bytes)** followed by $W \times H \times D \times 6\text{ bytes}$ of raw `Node3` records.
