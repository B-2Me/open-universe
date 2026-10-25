# The Open Universe

**A substrate built to work like reality does: continuously actualizing, zero-storage.**

The Open Universe is an ontology and framework for exploring thermodynamic reality, and a working instrument for poking it. The premise: the "infinitely divisible empty space" paradigm of legacy physics is an accounting error. Geometry is the dashboard, not the territory. Underneath the dashboard is the **Planck Field**: a dense, saturated, memoryless substrate where nothing actualizes without physical dissipation, where the past is physically consumed to write the present, and the future is radically unwritten.

This repository is that argument made executable: a set of essays auditing the legacy framework, an audio edition of every prose page, and a family of bare-metal C cellular-automata engines running on CPU, WebAssembly, and CUDA: **Joule's Mill** (3D multichannel friction substrate, the flagship instrument) and its milestone builds **Yarkovsky's Ember**, **Hopf's Loom** (3D True-FCC, up to 16.7M nodes headless), and **Langevin's Wake** (2D, 160,000 nodes), plus the headless experiment suite whose measured results fill the research monograph.

🌐 **Live site & engine sandbox:** [planckfield.site](https://planckfield.site)

## The Framework

The site is structured as an audit: state the thesis, stress-test it against the paradoxes, ground it in the vanguard literature, then hand you the instrument. Navigation follows the same arc: **Theory** (the argument) → **Interference** (the lab) → **Intent** (the design rationale).

### Theory: the argument

| Essay | What it argues |
|---|---|
| [**The Planck Field**](docs/field.md) (`field.md`) | The core thesis: the zero-storage substrate, actualization limits, matter as standing knots of relational tension |
| [**The Theory**](docs/theory.md) (`theory.md`) | Section overview: how the chapters fit: anomalies → model → formalism → observer |
| [**Observational Paradoxes**](docs/paradox.md) (`paradox.md`) | Wave-function collapse, simulation theory, Banach–Tarski, the coastline paradox: reframed as accounting errors of a broken ontology |
| [**The Source**](docs/source.md) (`source.md`) | The thermodynamic bedrock: entropic gravity, capacity-stealing time dilation, propagation-friction redshift, phase friction, actualization yield, plus the lineage (Whitehead, Popper, Prigogine, et al.) |
| [**The Mathematics**](docs/math.md) (`math.md`) | The formal machinery: the discrete transition operator, turn-friction kernel, and conservation invariants behind the essays |
| [**The Interface**](docs/interface.md) (`interface.md`) | Biology as nature's causal router: geometry as sensory compression, agency as hyper-local. The observer chapter: who the theory is for |

### Interference: the lab

| Page | What it documents |
|---|---|
| [**The Interference**](docs/interference.md) (`interference.md`) | Predict → Interfere → Measure; the lab hub and the separation-of-scales argument |
| [**Theoretical Audits**](docs/interference/audits.md) (`interference/audits.md`) | Five audits translating each legacy paradox into a testable lab procedure |
| [**Methodology & Reproducibility**](docs/interference/methodology.md) (`interference/methodology.md`) | The formal spec: FCC lattice invariants, the 6-byte `Node3` state space, the transition operator, discrete causal thermodynamics, and the reproduction suite for every empirical claim |
| [**Predictive Roadmap**](docs/interference/roadmap.md) (`interference/roadmap.md`) | The path from working simulator to a direct benchmark against collider telemetry |
| [**The Open Frontier**](docs/interference/frontier.md) (`interference/frontier.md`) | The research log: every measured experiment, falsified hypothesis, and engine RFC, including the results that failed |
| [**The Multi-Channel Bridge**](docs/interference/meso-bridge.md) (`interference/meso-bridge.md`) | The `meso3i` transition document: why the substrate moved to a multichannel integer lattice gas, and the first accretion/outflow findings on it |
| [**The Friction Substrate**](docs/interference/meso-monograph.md) (`interference/meso-monograph.md`) | The consolidated `meso3i` monograph (M19–M49): the measured friction laws, bound matter, locomotion, interaction, and the honesty ledger, with a real telemetry replay |
| [**The Utility of Causal Simulation**](docs/interference/usefulness.md) (`interference/usefulness.md`) | Why a computationally irreducible substrate is still worth simulating: the engineering case for the instrument |
| [**Audio Sessions**](docs/interference/sessions.md) (`interference/sessions.md`) | The living syllabus for the podcast companion |
| [**The Intent**](docs/intent.md) (`intent.md`) | Why this site exists: a systems integrator's audit of philosophical architecture |

### Instruments: the engines

| Instrument | What it is |
|---|---|
| [**Joule's Mill**](docs/mill-demo.md) (`mill-demo.md`) | The flagship: the full `meso3i` instrument (72×72×36 True-FCC). Directional rest, photon coupling modes, pair rules, latency gating, scene presets, and the apertured plane-wave beam |
| [**Yarkovsky's Ember**](docs/ember-demo.md) (`ember-demo.md`) | Milestone instrument: the first browser build of the `meso3i` substrate (44³ True-FCC): convergent drive, cold rocks, carrier beam |
| [**Hopf's Loom**](docs/loom-demo.md) (`loom-demo.md`) | The 3D instrument: a live Hopfion on the 400k-node `planck3.wasm` substrate: tomographic slices, spin-class coloring, knot injection, snapshot rewind |
| [**The Hopfion Zoo**](docs/hopfion-zoo.md) (`hopfion-zoo.md`) | The measured particle dictionary: 37 stable rest-mass geometries found by sweeping the engine's configuration space, each specimen a real simulation result inspectable in 3D (vtk.js) |
| [**Langevin's Wake**](docs/wake-demo.md) (`wake-demo.md`) | The 2D instrument: a live 160k-node substrate you can paint, perturb, and watch metabolize. Hosts the *Shell-World vs. Knot-World* topology capstone |

Every prose page ships with a narrated audio edition generated by the Kokoro TTS pipeline in `/script` (markdown → speech → word-level sync maps for the sticky player, regenerated per deploy).

## The Instruments: `planck.c` · `planck3.c` · `meso3i.c` · CUDA

The simulators are not demos bolted onto the site: they're the framework's working artifacts. If reality is a discrete thermodynamic substrate rather than a continuous void, the honest test is whether those mechanics can be *computed* cheaply enough to run in a browser tab. They can.

`src/planck.c` is a single-file C engine: 160,000 `PlanckNode`s at 4 bytes each (8-bit quanta, 8-bit spin, 16-bit heat). Every tick it computes relational friction, topological unwinding, phase alignment, and entropic routing: strictly deterministic, no floating-point mysticism, no birth/death rules. All physics constants are named `#define`s at the top of the file; the engine is stamped at compile time with the git revision that built it (`build.sh` injects `-DGIT_REV`), so the build shown in the UI footer is always the provenance of the artifact you're running.

`src/meso3i.c` is the **canonical 3D engine**: a multichannel integer-occupancy lattice gas on the even-parity True-FCC sublattice: D3Q19 channels per node (12 face-diagonal + 6 axial second-shell + 1 rest), `uint8_t` populations, memoryless collide→stream ticks with exact mass/momentum conservation. Every departure from the base mechanics is a flag-gated, enumerated rule: the campaign's measured contribution is the **transit-friction law** (drag parks moving flux as rest heat; carrier-gated emission vents it), which produces accreting, breathing, persistent, mobile bound matter. This is the engine behind Joule's Mill, Yarkovsky's Ember, and the M19–M49 monograph. `src/meso3.c` is its immediate predecessor, retained for history.

`src/planck3.c` is the earlier 3D engine: a True Face-Centered Cubic lattice of 6-byte `Node3`s (quanta, spin, heat, buffer, tension) with 12 directional ports: 6 equatorial, 3 zenith, 3 nadir, and parity-free A-B-C stacking verified across 4.7M directed edges. `planck3_init()` gives the browser's 100×100×40; `planck3_init_dims()` rescales to 256³ for headless sweeps and collision basins. It still powers Hopf's Loom and the Hopfion Zoo; its single-spin *campaign mechanics* (M1–M31) were later retracted as an implementation artifact: see the monograph's honesty ledger. The full formal spec lives in [Methodology & Reproducibility](docs/interference/methodology.md).

`src/smatrix/` is a CUDA port of the `planck3` tick for headless batch work: deferred pushes become `atomicAdd`s into an accumulator plane, provably identical under sync semantics. It doubles as a LAN job server (`smatrix serve`): HTTP endpoints accept binary job blobs, stream heartbeats, and expose results and live states; `script/smatrix_*.mjs` pack, submit, watch, classify, and resume those jobs. Validation gate: the hopfion_25_9 400-tick run must reproduce the wasm `--sync` baseline exactly (1,678,260 mass / 27,971 live).

The JS side is deliberately framed as the biological interface to that substrate: it reads the raw field via a zero-copy WASM heap view and compresses it into geometry your eyes can navigate, while the engine below knows nothing about shapes.

### Simulator module map (`docs/.vitepress/wake/`)

Plain ES modules composed by `main.js`: no framework inside the hot path.

| Module | Owns |
|---|---|
| `bridge.js` | The WASM boundary: pixel views, node state packing, snapshots, VTK |
| `loop.js` | Fixed-timestep engine loop (accumulator, telemetry cadence, tick hooks) |
| `renderer.js` | Dual-canvas WebGL renderer (lattice projections) + 2D fallback |
| `interaction.js` | Pointer Events input: paint strokes, pan/zoom, pinch gestures, sampling, brush preview, keyboard cursor |
| `controls.js` | All DOM controls: modes, drawers, sliders, exports, keyboard, undo depth, autosave |
| `scenarios.js` | Declarative scenario composers + dossier copy |
| `palette.js` | Brush palette + sampled stamps (localStorage persistence) |
| `wakelock.js` | Screen Wake Lock lifecycle (iOS gesture/visibility quirks) |
| `persist.js` | IndexedDB autosave: raw grid bytes + scenario, restore on boot |
| `constants.js` | Grid/layer/speed/zoom/undo constants and bitfield packers |

### What the instrument does

- **Two substrate builds** from one `planck.c` source: ⏹️ Oct8 (8-neighbor Moore) and ⬡ Hex6 (parity-aware 6-neighbor hex) via `-DTOPOLOGY_HEX`: identical thermodynamic laws, different adjacency; the System drawer's Substrate selector reboots the universe on the other WASM module with topology-tagged autosaves. See *Topology: Shell-World vs. Knot-World* in [wake-demo.md](docs/wake-demo.md).
- **Four layers** per half of the split view: Macro, Metabolic, Phase, Entropic: independently toggled.
- **Scenarios** (Vacuum, Stellar Core, Atmosphere, Engine Bell, Nozzle Wall, Ocean, Synthetic Electron) with dossiers, composited via declarative grid writers.
- **Modes**: Move (pan/zoom/dbl-click reset), Place (brush stamps through the injection matrix), Sample (probe a region into a reusable stamp), System (settings drawer).
- **Injection matrix**: Density/Heat/Spin are independent channel toggles: each injects only its component, with a per-channel dose slider (% of the stamp's stored value; Spin's slider is an entrainment↔imposition dial that blends stored direction against ambient flow). All three enabled is a verbatim Clone write; doses are ignored during clone.
- **Undo buffer**: a `SNAPSHOT_DEPTH`-slot ring in the engine (currently 4); every mutation pushes a checkpoint and a roller captures one every ~2s of play. The Undo button's fill gradient shows buffered depth. Snapshots hold field bytes only: cumulative stats (Yield) persist through undo by design.
- **Lattice projections**: Quad / Hex (staggered rows) / Oct (chamfered cells with interstitial voids) via a fragment-shader pass: requires WebGL, so the buttons disable on the 2D-canvas fallback.
- **Telemetry**: live Quanta / Heat / Phase-alignment / Yield readouts. Yield counts topological-unwinding events and resets with the field (scenario load, Clear, Random).
- **Physics live-tuning**: dissipation and thermal limit sliders; sim speed slider (fixed timestep, consistent across refresh rates).
- **Export**: WYSIWYG PNG snapshot of the split view, Web Share, and ASCII VTK for ParaView.
- **Mobile-first input**: unified Pointer Events, pinch-focal zoom, stray-stamp pinch revert, 44px targets, `dvh` layout, haptics on Android.
- **Brush footprint preview + touch lift**: the stamp/sample outline is drawn on the field (follows zoom/pan), and touch input lands ~56px above the fingertip so painting isn't blind.
- **Screen wake lock** while playing (iOS 16.4+ / Chrome): re-acquires after tab switches and gestures.
- **IndexedDB autosave**: the 640KB grid + scenario are saved every 10s and on page hide; reloads resume where you left off.
- **PWA shell**: web manifest + a stale-while-revalidate service worker for offline use.
- **Keyboard**: Space pan · P play · R randomize · C clear · Ctrl+Z undo · Esc close/unfocus, plus a full keyboard brush cursor (canvas focus + arrows move, Shift+arrows ×10, Enter stamps/samples).

### Hopf's Loom (`docs/.vitepress/loom/` + `LoomSimulator.vue`)

WebGL2 volume renderer over `planck3.wasm`: the engine packs {quanta,spin} into an RG8 buffer on the wasm heap, uploaded per frame via `texSubImage3D`: one instanced draw renders 400k nodes with tomographic slab uniforms and the honest FCC embedding. Knot tool injects a circulating tangential ring (not a deadlocked mass block); the Metabolism layer uses a percentile-clipped, temporally smoothed AGC so injected spikes saturate instead of capturing the whole palette; the HUD reports real physics telemetry: mean live heat `T̄` next to the palette ceiling `⌈⌉` so you can tell a real thermal pulse from a renormalization shift.

### The Hopfion Zoo (`docs/.vitepress/hopfion/` + `HopfionViewer.vue`)

A vtk.js carousel over `docs/public/hopfion/*.bin`: compact `ZOO3` sparse specimens exported from settled dictionary runs, ordered by invariant mass.

### Joule's Mill (`docs/.vitepress/mill/` + `MillSimulator.vue`)

The full `meso3i` instrument on a 72×72×36 lattice: same RG8 `texSubImage3D` zero-copy pipeline as the Loom, with the complete flag surface exposed: directional vs scalar rest, photon coupling modes (off/catalyst/stimulated/absorbed), pair wind/unwind rules, emission latency, collision variants, and one-click scene presets that drop you into measured regimes (wound lump, breathing core, comet ablation).

### Yarkovsky's Ember (`docs/.vitepress/ember/` + `EmberSimulator.vue`)

The earlier, smaller `meso3i` browser build: a WebGL2 instanced renderer over the engine packed into an RG8 3D texture (85,184 cells, 42,592 live even-parity sites), uploaded per frame via `texSubImage3D`. Convergent drive on/off, carrier beam, cold-rock placement, tomographic slice/width controls, transport, snapshots, and camera presets, with cyan/blue for moving flux and amber/white for parked rest heat. A recorded "Life of a Lump" replay (`FrictionReplay.vue`, real `test_replay` telemetry) plays the same canonical sequence inside the monograph.

### The headless experiment suite (`/script`, `/script/meso`, `/config`)

The same engines run as plain Node against the wasm artifacts, no container needed, producing the measured claims on the site. `script/meso/*.mjs` holds the 28 self-contained meso3i harnesses behind the M33–M48 milestones (each loads `docs/public/wasm/ember/meso3i.js` and prints measurements to stdout); `script/*.mjs` holds the earlier planck3 suite:

| Script | Role |
|---|---|
| `pathfinder.mjs` | Phase-Lock DFS loop-hunter on the 12-port graph → `seeds/hopfion_<R0>_<R1>.json` |
| `sweep.mjs` | Loads seeds into `planck3.wasm`, ticks 400+, writes the resumable `knot_dictionary.json` |
| `boost.mjs` | Kinematic interference basin: boundary flux envelopes vs. knot survival (centroid/v10/retain/coherence) |
| `collide.mjs` | Dual-knot S-Matrix harness: FCC-axis spawns, symmetric pinch, painted-mask BFS verdicts (fusion/degraded/…) |
| `vtk.mjs` | Sparse ParaView `.vtk` frame export for boost/collision runs |
| `export-zoo.mjs` | Settled knots → `ZOO3` binaries + manifest for the Zoo |
| `status.mjs` | Read-only progress dashboard over `logs/` heartbeats |
| `smatrix_*.mjs` | CUDA job harness: pack SMX1 blobs (`smatrix_pack`), submit to a LAN `smatrix serve` instance (`smatrix_submit`), watch heartbeats, classify verdicts, pull states |
| `kokoro-pipeline.js` | TTS narration + word-level sync maps for every prose page |

Alongside the JS harnesses, `src/test_*.c` is a 29-file headless C suite: the monograph's reproduction battery: conservation ledgers (`test_conservation`, `-DP3_AUDIT`), ballistic ToF (`test_tof`), slit apparatus (`test_doubleslit`), beams/drift/bath/lump/orbit probes on `meso3i`, and `test_replay` which dumps the canonical drive→cutoff→beam sequence frame-by-frame for the site's replay.

Latest results: the `meso3i` friction campaign (M19–M49): transit friction accretes moving flux into bound lumps; carrier-gated radiation makes them persistent and re-wakeable; lumps drift toward beams by ablation; directional rest stores angular momentum in parked channels and absorbed light writes it (YORP); the collision operator is exactly blind to coherent flow (M47c), so beams cross vacuum forever but attenuate in ambient media (M48); and the only pairwise coupling measured is transient mutual ablation between *self-radiating* lumps; passive shadow gravity is null (M47b). Consolidated with commit-anchored provenance in [The Friction Substrate](docs/interference/meso-monograph.md). Earlier `planck3` results: the 37-specimen dictionary (37/37 stable at 400 ticks), collision verdicts (head-on ~0–4% retention, glancing fusion ~15–17%), remain inspectable in the Zoo but their single-spin mechanics are retracted from the theoretical record; details in [The Open Frontier](docs/interference/frontier.md). Generated data (`seeds/`, `logs/` bulk output, TTS audio) is reproducible output: gitignored, never committed; `results/` (the campaign telemetry) and `knot_dictionary.json` (the sweep verdict registry) are tracked, and the zoo `.bin` specimens are committed as site content.

## Repository Structure

| Path | Contents |
|---|---|
| `/src/planck.c` | The 2D Planck Field engine (single-file C, Emscripten → WASM) |
| `/src/planck3.c` | The 3D True-FCC engine: `planck3.c` + `planck3_test.c` native verification harness (single-spin campaign mechanics retracted; still powers Loom + Zoo) |
| `/src/meso3i.c` · `meso3.c` | The canonical multichannel friction engine (D3Q19 integer lattice gas) and its predecessor: compiled to WASM for Yarkovsky's Ember |
| `/src/test_*.c` | 25-file headless C harness suite: the monograph's reproduction battery |
| `/src/smatrix/` | CUDA port of the `planck3` tick + LAN job server (`smatrix serve`, HTTP job API) |
| `/src/engine-sim.mjs` | JS mirror of the `planck.c` tick kernel: scenario prototyping without an emcc build |
| `/src/build.sh` | The emcc build script: git-rev provenance injection + exported function surface (always use this; never hand-roll `emcc`) |
| `/docs` | The VitePress site: the framework essays listed above |
| `/docs/.vitepress/wake/` | Langevin's Wake JS modules (see map above) |
| `/docs/.vitepress/mill/` · `loom/` · `hopfion/` · `ember/` | Joule's Mill · Hopf's Loom volume renderer · Hopfion Zoo vtk.js renderer · Yarkovsky's Ember WebGL2 renderer |
| `/docs/.vitepress/components/` | Vue mount points: `WakeSimulator`, `MillSimulator`, `LoomSimulator`, `HopfionViewer`, `EmberSimulator`, `FrictionReplay`, `StickyAudioPlayer` |
| `/docs/public/wasm/wake/` · `loom/` · `ember/` | Build output for `planck*` / `planck3` / `meso3i` wasm modules (gitignored) |
| `/docs/public/hopfion/` | Committed `ZOO3` specimen binaries + `index.json` manifest for the Zoo |
| `/docs/public/loom/` | `hopfion.p3st`: the Loom's starting-state blob |
| `/script` · `/script/meso` | planck3 headless suite + TTS pipeline · the 28 meso3i experiment harnesses (see table above) |
| `/config` | Experiment configs: sweep/boost/collide run definitions |
| `/results` | Committed telemetry: campaign JSONs, run transcripts, per-job status |
| `knot_dictionary.json` | Tracked sweep verdict registry (expensive to regenerate) |
| `/seeds` · `/logs` | Generated data: gitignored, reproducible |
| `AGENTS.md` | Build/test notes for coding agents (Docker wasm build, detached-run pitfalls) |
| `.github/workflows/` | `ci.yml` (PR build validation) and `deploy.yml` (Pages deploy) |

## Building & Local Development

The WASM artifacts (`docs/public/wasm/wake/planck.*`, `docs/public/wasm/loom/planck3.*`, `docs/public/wasm/ember/meso3i.*`) are **gitignored build outputs**: they are always compiled from the same commit as the site, in CI and deploy alike.

| Command | Behavior |
|---|---|
| `npm run docs:dev` | Starts VitePress. WASM is **optional**: `wasm:check` builds it if `emcc` is installed and the artifact is missing or older than `src/planck.c`/`src/build.sh`; otherwise it prints a notice and the site builds anyway. |
| `npm run docs:build` | Always compiles the engines first (`wasm:build`): **requires [Emscripten](https://emscripten.org/)**, same as CI and deploy. On Windows the `mkdir -p` wrapper fails under cmd.exe: run `npx vitepress build docs` directly (or build inside a Linux container) once the WASM is in place. |
| `npm run wasm:build` | Just the engine compile (needs `emcc` on PATH). |
| `npm run generate-audio` | Kokoro TTS pipeline: recursive over all prose pages; deploy regenerates it. |

No local emsdk? Use the pinned Docker toolchain: `cd src && docker run --rm -v "$PWD/..:/src" -w /src/src emscripten/emsdk:3.1.61 bash build.sh`. Or just run `docs:dev` without it: the site builds, the simulators simply won't boot an engine.

**Validating a result:** once `docs/public/wasm/ember/meso3i.js` exists, any meso3i experiment is one Node command: `node script/meso/eos-thermalize.mjs` reruns the M46 closed-box equation-of-state measurement; `node script/meso/m37-bath.mjs` reruns the ambient-bath shadow control. No dependencies beyond Node itself. Native C harnesses (`src/test_*.c`) compile against `meso3i.c`/`planck3.c` via Docker `gcc:13`. The full environment guide, prerequisites, build, harness map, and where the archived telemetry lives, is [Build & Validation Environments](docs/interference/reproduce.md).

## CI & Deploy

- **`ci.yml`** (on PRs to `main`): installs emsdk, compiles the C engines, builds the full VitePress site: catches engine and frontend breakage before merge.
- **`deploy.yml`** (on `main`): regenerates TTS audio, compiles WASM, builds the site, deploys to GitHub Pages. A failed engine compile fails the build: the site can never ship stale or mislabeled WASM.

## Roadmap

The framework work is the discovery process; the instrument work exists to serve it. Deferred items whose plumbing is verified and ready:

- **Loupe magnification**: deprioritized: the touch lift + footprint preview already cover blind painting. If added, `drawImage` from the live canvas (WebGL runs with `preserveDrawingBuffer`) crops a magnified region cheaply.
- **Timelapse video export**: deferred: `compositeCanvas()` already produces a WYSIWYG split-view frame ready for a `captureStream()` + `MediaRecorder` pump; mime sniffing (webm vs mp4 on iOS) is the remaining work.
- **Deeper undo ring**: `SNAPSHOT_DEPTH` is compile-time configurable (currently 4 slots).

Shipped: brush footprint preview + touch lift, wake lock, IndexedDB autosave, PWA shell, modal focus trap, keyboard brush cursor, configurable undo ring, compile-time build provenance, injection channel matrix + dose sliders, per-field yield telemetry, and on the 3D side: the `meso3i` multichannel engine with its measured transit-friction laws (M19–M49), Yarkovsky's Ember live substrate, the recorded Life-of-a-Lump replay, the 37-specimen Hopfion dictionary, kinematic boost basins, the dual-knot collision S-Matrix harness with ParaView export, the CUDA `smatrix` port with LAN job serving, the Hopfion Zoo, AGC-stabilized metabolism rendering, and ring-based knot injection.

## License

- **The Framework & Written Content:** © 2026 Nathan / btwo.me. All rights reserved.
- **The C/WASM Engine Source Code:** Released under the MIT License.
