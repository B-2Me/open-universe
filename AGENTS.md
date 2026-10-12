# Agent Notes

## WASM builds — always use `src/build.sh`

Never hand-roll `emcc` invocations for `planck.c`/`planck3.c`. The export
lists, `MODULARIZE`, and `EXPORT_NAME` flags live in `src/build.sh`; a
hand-rolled build silently produces a non-modularized `Module` singleton,
breaking the `createPlanck`/`createPlanckHex`/`createPlanck3` factories
the frontends expect (symptom: `ERR createPlanck3 is not defined`).

No local emscripten — run the whole script in Docker:

```bash
cd src
docker run --rm -v "$PWD/..:/src" -w /src/src emscripten/emsdk:3.1.61 bash build.sh
```

Outputs: `docs/public/wasm/wake/planck*.js/.wasm` (2D engine) and
`docs/public/wasm/loom/planck3.*` (3D engine). All gitignored.

## Native test (no local gcc — Docker)

```bash
docker run --rm -v "$PWD:/src" -w /src/src gcc:13 \
  sh -c "gcc -O2 -Wall planck3.c planck3_test.c -o /tmp/p3t -lm && \
         /tmp/p3t /src/test/loom/t0.bin 60 /src/test/loom/t400.bin"
```

## Phase 4 headless harness (particle dictionary)

- `script/pathfinder.mjs` — standalone DFS loop-hunter on the 12-port
  graph (Phase-Lock ≤60° per hop, memoized closure, same-shell gate).
  Reproduces the canonical 19-loop/27,971-cell Hopfion at
  `--w=100 --h=100 --d=40 --r0=25 --r1=9` exactly. Writes
  `seeds/hopfion_<R0>_<R1>.json`.
- `script/sweep.mjs` — loads seed JSONs into `planck3.wasm` via the
  P3ST bulk channel, ticks under a chosen `--diss`/`--limit`, and
  records a `knot_dictionary.json` (verdict, invariant mass, RMS
  cross-section radius, spray/deadlock telemetry, per-window series).
- Engine dims are runtime: `planck3_init()` = 100×100×40 (browser),
  `planck3_init_dims(w,h,d)` rescales (256³ verified natively +
  wasm, ~1.7–2.5 s/tick flat). Chunk size auto-picks the largest
  common divisor ≤20 (20 → 100³, 16 → 256³); non-divisible grids
  disable chunk modes and flat is the fallback. Bulk buffers
  (load/rg/save/chunk pools) are lazy — wasm memory can grow after
  ANY pointer call, so wrap `wasmMemory.buffer` only after pointer
  calls, never cache a view across them.
- Typical workflow: `node script/pathfinder.mjs --r0=32,64 --r1=8,16`
  then `node script/sweep.mjs --seeds=seeds --ticks=400`.
  Bounded pilot: `node script/sweep.mjs --config=config/pilot-sweep.json`.
- Resume is built in: the dictionary is atomically rewritten after
  every candidate; re-running skips entries whose signature
  (name|dims|ticks|diss|limit|mode) already exists. `--fresh` ignores
  prior entries. `--only=a,b` curates a subset; `--config=x.json`
  supplies defaults (CLI wins). Sweeps run in plain Node — no
  container needed, so a "restart" is just re-running the command.

## Docs build

`npm run docs:build` fails on Windows (cmd.exe can't parse `mkdir -p`
in the wasm:build script). Run `npx vitepress build docs` directly, or
run inside a Linux container.
