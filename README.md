# The Open Universe

Reality is a continuously actualizing, zero-storage substrate.

This repository contains the source for **The Open Universe** framework — a VitePress site presenting the ontological argument — and **Langevin's Wake**, a bare-metal thermodynamic cellular-automata engine written in C and compiled to WebAssembly.

🌐 **Live Site & Engine Sandbox:** [planckfield.site](https://planckfield.site)

## Repository Structure

| Path | Contents |
|---|---|
| `/src/planck.c` | The Planck Field physics engine (single-file C, Emscripten → WASM) |
| `/src/build.sh` | The emcc build script + exported function surface |
| `/docs` | The VitePress site: framework essays and generated Kokoro TTS audio |
| `/docs/.vitepress/wake/` | The simulator's JS modules (see below) |
| `/docs/.vitepress/components/WakeSimulator.vue` | The simulator's DOM shell / Vue mount point |
| `/docs/public/wasm/wake/` | Build output for `planck.js`/`planck.wasm` (gitignored) |
| `/script` | The automated Node.js pipeline for TTS audio + sync maps |
| `.github/workflows/` | `ci.yml` (PR build validation) and `deploy.yml` (Pages deploy) |

### Simulator module map (`docs/.vitepress/wake/`)

The frontend is plain ES modules composed by `main.js` — no framework inside the hot path.

| Module | Owns |
|---|---|
| `bridge.js` | The WASM boundary — pixel views, node state packing, snapshots, VTK |
| `loop.js` | Fixed-timestep engine loop (accumulator, telemetry cadence, tick hooks) |
| `renderer.js` | Dual-canvas WebGL renderer (lattice projections) + 2D fallback |
| `interaction.js` | Pointer Events input — paint strokes, pan/zoom, pinch gestures, sampling |
| `controls.js` | All DOM controls — modes, drawers, sliders, exports, keyboard, undo depth |
| `scenarios.js` | Declarative scenario composers + dossier copy |
| `palette.js` | Brush palette + sampled stamps (localStorage persistence) |
| `constants.js` | Grid/layer/speed/zoom/undo constants and bitfield packers |

## The Planck Field Engine (`planck.c`)

Not a canvas drawing shapes — a strictly deterministic 160,000-node physics grid. Each `PlanckNode` is 4 bytes: quanta (8b), spin (8b), heat (16b). The engine computes relational friction, topological unwinding, phase alignment, and entropic routing every tick, and renders all four visualization layers into a pixel buffer the JS side reads via a zero-copy heap view.

All physics constants are named `#define`s at the top of the file — tunable knobs, not buried literals.

## The Simulator (Langevin's Wake)

- **Four layers** per half of the split view: Macro, Metabolic, Phase, Entropic — independently toggled.
- **Scenarios** (Vacuum, Stellar Core, Atmosphere, Engine Bell, Nozzle Wall, Ocean) with dossiers, composited via declarative grid writers.
- **Modes**: Move (pan/zoom/dbl-click reset), Place (brush stamps + 4 injection modes: Clone/Density/Heat/Spin), Sample (probe a region into a reusable stamp), System (settings drawer).
- **Undo buffer**: a 2-slot snapshot ring in the engine; every mutation pushes a checkpoint and a roller captures one every ~2s of play. The Undo button's fill gradient shows buffered depth.
- **Physics live-tuning**: dissipation, thermal limit, and refractive impedance toggles; sim speed slider (fixed timestep — consistent across refresh rates).
- **Export**: composited PNG snapshot, Web Share, and ASCII VTK for ParaView.
- **Mobile-first input**: unified Pointer Events, pinch-focal zoom, stray-stamp pinch revert, 44px targets, `dvh` layout, haptics on Android.
- **Keyboard**: Space pan · P play · R randomize · C clear · Ctrl+Z undo · Esc close.

## Building & Local Development

The WASM artifacts (`docs/public/wasm/wake/planck.*`) are **gitignored build outputs** — they are always compiled from the same commit as the site, in CI and deploy alike.

| Command | Behavior |
|---|---|
| `npm run docs:dev` | Starts VitePress. WASM is **optional**: `wasm:check` builds it if `emcc` is installed and the artifact is missing or older than `src/planck.c`/`src/build.sh`; otherwise it prints a notice and the site builds anyway. |
| `npm run docs:build` | Always compiles the engine first (`wasm:build`) — **requires [Emscripten](https://emscripten.org/)**, same as CI and deploy. |
| `npm run wasm:build` | Just the engine compile (needs `emcc` on PATH). |
| `npm run generate-audio` | Kokoro TTS pipeline for the essays. |

So: no emsdk locally? `docs:dev` still works — the site builds, the simulator just won't boot its engine. Edit `planck.c` with emsdk installed and the next `docs:dev` rebuilds the stale artifact automatically.

## CI & Deploy

- **`ci.yml`** (on PRs to `main`): installs emsdk, compiles `planck.c`, builds the full VitePress site — catches engine and frontend breakage before merge.
- **`deploy.yml`** (on `main`): regenerates TTS audio, compiles WASM, builds the site, deploys to GitHub Pages. A failed engine compile fails the build — the site can never ship stale or missing WASM.

## Roadmap

Ideas under consideration for the simulator, roughly in priority order:

- **Brush footprint preview / loupe** — show the stamp outline (or a magnifier offset above the finger) so mobile painting isn't blind.
- **Wake lock** while playing, so the screen doesn't dim mid-simulation.
- **IndexedDB autosave** — persist grid + palette across reloads, with resume-on-load.
- **PWA shell** — manifest + service worker for "Add to Home Screen" and offline use.
- **Deeper undo ring** — buffer depth is compile-time configurable (currently 2 slots).
- **Accessibility** — focus trap + focus restore in the dossier modal; canvas keyboard painting.

## License

- **The Framework & Written Content:** © 2026 Nathan / btwo.me. All rights reserved.
- **The C/WASM Engine Source Code:** Released under the MIT License.
