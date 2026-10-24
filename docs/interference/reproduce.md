---
title: Build & Validation Environments
---

# Build & Validation Environments

*Every number in the [Friction Substrate monograph](/interference/meso-monograph) came out of a committed harness. This page is the recipe for reproducing any of them: build the engine once, then run the script that made the measurement.*

The same `meso3i.c` source runs in three environments: the browser instruments (Joule's Mill, Yarkovsky's Ember), Node headless harnesses, and native C test programs, plus a fourth (CUDA) for the earlier `planck3` engine. All three meso3i environments execute the identical tick; the only difference is who calls it.

## Prerequisites

| Need | What for |
|---|---|
| **Node 18+** | The headless harnesses (`script/meso/*.mjs`, `script/*.mjs`). They use only `node:` builtins: no `npm install` required to run an experiment. |
| **Docker** | The pinned WASM toolchain (`emscripten/emsdk:3.1.61`) and native C builds (`gcc:13`). The only way to build on Windows, where there is no local `emcc`/`gcc`. |
| **emsdk 3.1.61** *(optional)* | Same WASM build without Docker, if you have Emscripten installed natively. |
| **CUDA toolkit + NVIDIA GPU** *(optional)* | Only for the `smatrix` batch engine (planck3-era batch jobs). Not needed for any meso3i measurement. |

## Step 1: Build the WASM artifacts

The compiled engines are gitignored build outputs, produced by `src/build.sh`: always run it rather than invoking `emcc` by hand, because the export lists, `MODULARIZE`/`EXPORT_NAME` flags, and `-DGIT_REV` provenance stamps live in that script:

```bash
cd src
docker run --rm -v "$PWD/..:/src" -w /src/src emscripten/emsdk:3.1.61 bash build.sh
```

With a native emsdk instead: `npm run wasm:build`.

Outputs:

| Artifact | Engine | Consumed by |
|---|---|---|
| `docs/public/wasm/ember/meso3i.{js,wasm}` | `src/meso3i.c` | Joule's Mill, Yarkovsky's Ember, **and every `script/meso/` harness** |
| `docs/public/wasm/loom/planck3.{js,wasm}` | `src/planck3.c` | Hopf's Loom, Hopfion Zoo, `script/*.mjs` planck3 harnesses |
| `docs/public/wasm/wake/planck{,-hex}.{js,wasm}` | `src/planck.c` | Langevin's Wake |

## Step 2: Run the site

```bash
npx vitepress dev docs
```

Serves at `http://localhost:5173/`. The instrument pages boot whichever artifacts exist; a missing engine shows a load notice rather than breaking the page, so you can validate prose without building anything.

## Step 3: Run a headless experiment

The `script/meso/` harnesses are the measurements themselves: each is a self-contained Node script that loads `docs/public/wasm/ember/meso3i.js`, drives the engine through a scenario, and prints its measurements to stdout:

```bash
node script/meso/eos-thermalize.mjs
```

No config files, no output files: read the header comment at the top of each script for the scenario, then run it and compare its numbers against the monograph.

### Harness map: which script produced which claim

| Harness | What it measures | Milestone |
|---|---|---|
| `ember-attractor.mjs` | Is the driven ember an accumulator or an attractor | M33–M35 |
| `lump-ablate.mjs` | Photon coupling modes vs lump ablation style | M36, M43 |
| `m37-drift.mjs` · `m37-drift2.mjs` | The apparent pairwise attraction, driven and self-radiating regimes | M37, M47b |
| `m37-bath.mjs` | Mutual shadowing in an isotropic ambient bath: the process-ontology control | M47b |
| `ring-test.mjs` · `spin-collide.mjs` | Vortex-ring injection, circulation thermalization | M38, M44 |
| `spin-collide-clean.mjs` | Lamp-free replication: spin collisions with zero drive | M45 |
| `drest-test.mjs` | Directional rest: Lz persistence in parked channels | M39–M40 |
| `drest-graze-test.mjs` | Off-center mass beam writing rotation into cold matter | M42 |
| `drest-lat-test.mjs` · `latency-test.mjs` | Latency-gated emission vs sporadic flux | M41 |
| `drest-revive.mjs` | Re-waking latent angular momentum in parked bins | M42 |
| `eos-thermalize.mjs` | Closed-box equation of state; the collisionless-flow control | M46, M47c |
| `stress-tensor.mjs` | Momentum-flux tensor `Πᵢⱼ` in shells around the ember | M46 |
| `wavefront-isotropy.mjs` | Two-shell wavefront arrival (D3Q19 two-speed lattice) | M46 |
| `wound-tensor.mjs` · `wound-tensor2.mjs` | Stored angular momentum as shear in `Πxy` | M42, M46 |
| `transactions.mjs` | The seven-counter irreversible contact ledger | M47 |
| `pair-test.mjs` | The `2·rest ⇄ c + c¹` wind/unwind cycle | M47 |
| `photon-test.mjs` | IPHOT coupling modes vs parked mass | M43 |
| `yorp-test.mjs` · `yorp-ledger.mjs` | Light writing spin into directional rest; momentum bookkeeping | M43 |
| `qmode-test.mjs` · `qmode-control.mjs` | Q-register condensation experiments | exploratory |
| `snapshot-test.mjs` | Bit-for-bit save/restore replay | infrastructure |
| `beam-front-test.mjs` | Apertured photon plane wave: collimation, grazing hits | M43 support |
| `loop-resonance.mjs` | Closed-polygon bucket-brigade emission | exploratory |

The `script/*.mjs` suite alongside it (pathfinder, sweep, boost, collide, smatrix) belongs to the earlier `planck3` campaign: same pattern, loading `docs/public/wasm/loom/planck3.js` instead.

## Step 4: Native C harnesses

`src/test_*.c` is a 29-file headless C suite: conservation ledgers, ballistic time-of-flight, slit apparatus, and the meso3i probes (`test_bath`, `test_shadow`, `test_atten`, `test_accrete`, `test_replay`). Each file documents its own usage line in the header comment. Compile against the engine directly: no local gcc on this machine means Docker:

```bash
docker run --rm -v "$PWD:/src" -w /src/src gcc:13 \
  sh -c "gcc -O2 -Wall meso3i.c test_atten.c -o /tmp/atten -lm && /tmp/atten 30"
```

The planck3 regression vector (`planck3.c` + `planck3_test.c` → `test/loom/t0.bin`/`t400.bin`) is the bit-identity gate between the C and WASM builds: same recipe, see `AGENTS.md`.

## The telemetry archive

`results/` holds the committed outputs these harnesses produced: the collide/anneal/boost/fountain/quench JSONs, run transcripts, census dumps, and per-job status files, organized as the runs produced them. `knot_dictionary.json` (repository root) is the tracked sweep verdict registry. If a harness's stdout disagrees with the monograph, `results/` is the archived baseline to diff against, and a diff is itself a finding worth reporting.

`logs/` is the ignored scratch directory for bulk output (CUDA state snapshots, packed job blobs, ParaView frames). If a new run produces telemetry worth keeping, promote the small JSON/log files into `results/` and the harness into `script/meso/`.
