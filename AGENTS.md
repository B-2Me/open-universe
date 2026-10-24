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

- `script/lib/p3.mjs` — shared plumbing every harness imports:
  `loadPlanck3` (glue eval + `wasm.heap8()` view helper), `initEngine`
  (dims/diss/limit/mode/sync + reset_stats), `arg`/`loadConfig`/`opts`
  (--flag/--k=v over --config JSON), `HOFF`/`ZU`/`ZD`/`step` FCC table,
  `V3`/`nearestPort` fixed-point port vectors, `packLoad`/`commitLoad`
  (P3ST q,s,b,tn,hp blob → pointer→copy→commit→prepare), `heartbeat`,
  `makeCensus` (live/freeEnds/maxCycle), `extractCycles` (seed
  spin-cycle digraph). Don't re-copy these into new scripts.

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
- `planck3_state_pointer()` is STABLE: flat mode publishes into a
  fixed `g_rd` via memcpy-back (no buffer swap — the swap silently
  invalidated a cached JS pointer every other tick). Refetching per
  tick is still harmless and keeps harnesses robust; what is NOT ok
  is caching `wasmMemory.buffer` across pointer calls (see above).
- Typical workflow: `node script/pathfinder.mjs --r0=32,64 --r1=8,16`
  then `node script/sweep.mjs --seeds=seeds --ticks=400`.
  Bounded pilot: `node script/sweep.mjs --config=config/pilot-sweep.json`.
- Resume is built in: the dictionary is atomically rewritten after
  every candidate; re-running skips entries whose signature
  (name|dims|ticks|diss|limit|mode) already exists. `--fresh` ignores
  prior entries. `--only=a,b` curates a subset; `--config=x.json`
  supplies defaults (CLI wins). Sweeps run in plain Node — no
  container needed, so a "restart" is just re-running the command.
- `script/boost.mjs` — kinematic interference basin: couples fluxes
  (quanta/tension/spin/heat) through the 24 axis+polarity vectors
  mapped to boundary walls, driven by constant/sine/ADSR envelopes.
  Telemetry = skeleton centroid (surviving painted cells inside the
  live component — immune to wall-flood and accretion bias), rolling
  v10 velocity, knot mass retain, painted coherence. Run:
  `node script/boost.mjs --config=config/boost-pilot.json`.
  Results land in `logs/boost-<seed>-v<vector>.json`; heartbeat in
  `logs/boost-status.json` (separate from the sweep's status.json).
- `script/collide.mjs` — S-Matrix harness: dual-spawns two dictionary
  knots ±`separation` along an FCC axis (0-11 → ports 1-12), applies a
  symmetric tension pinch at both ends, and classifies the aftermath
  (elastic_bounce / fusion / annihilation / asymmetric / degraded) via
  dual painted-mask BFS — knot allegiance is load-time provenance, the
  6-byte node has no ID register. Run:
  `node script/collide.mjs --config=config/collide-matrix.json`.
  Results → logs/collide-<name>.json + collide-results.json.
- `script/vtk.mjs` — shared sparse VTK exporter (ASCII POLYDATA point
  cloud, live cells only): quanta / tension / painted (1=A, 2=B, 0
  accreted) / flow_vector (spin port → unit FCC vector). Wire with
  `--vtk-interval=N` (or `vtk_interval` in config); frames land in
  `logs/vtk/<run>/frame_NNNNN.vtk` — open the folder in ParaView as a
  time series. The 2D engine's dense STRUCTURED_POINTS export lives in
  planck.c (generate_vtk); sparse is the right topology for 16.7M nodes.
- `src/smatrix/` — CUDA port of the planck3 tick (sync semantics only —
  deferred pushes become atomicAdds into a u16 accumulator plane, a
  publish kernel clamps to `min(255, nb2+Σ)`; provably identical since
  pushes are all-positive). Ping-pong swap replaces the memcpy-back.
  Batches stack independent grids in one flat launch. Build with
  `build.bat` (`nvcc -O3 -arch=sm_86 -cudart=static` — the exe needs
  only the NVIDIA driver on the runner machine). `smatrix serve
  --port=N` is the LAN listener: `POST /job` (streams SMX1 blob to
  disk), `GET /status`, `/result/<id>`, `/state/<id>/<b>`,
  `/file/<id>/<name>`, `GET /disk` (free bytes on the jobs volume),
  `DELETE /job/<id>` and `POST /purge` (drop finished job dirs +
  uploads — refused for running/queued jobs). Upload `.smx` blobs
  auto-delete when the run finishes. `smatrix run <job.smx>` runs
  locally.
  `script/smatrix_pack.mjs` emits the binary job + a `.meta.json`
  provenance sidecar (painted A/B masks — the node has no ID
  register); `script/smatrix_submit.mjs --config=… --host=<ip>`
  packs + pushes, `--watch` polls heartbeats, `--pull` fetches
  status + latest per-batch states into `logs/smx-job-<id>/`.
  Validation gate: `config/smatrix-validate.json` (batch=1
  hopfion_25_9, 400t) must reproduce the wasm `--sync` run —
  1,678,260 mass / 27,971 live, stable.
- `script/status.mjs` — read-only dashboard. Prints progress bar,
  stable/unraveled yield, latest stable discovery, per-candidate
  timing + ETA from `logs/status.json` (heartbeat written per tick
  by sweep.mjs; stale >2min ⇒ check the process). Usage:
  `node script/status.mjs --config=config/full-sweep.json`.
- Background launch on Windows: `nohup … &` under Git Bash does NOT
  survive the spawning session — and worse, `echo $!` captures the MSYS
  wrapper PID, which dies while the real node.exe orphan keeps running
  (we had two sweeps ping-pong-flushing knot_dictionary.json). Detach
  via PowerShell instead (BelowNormal ≈ nice -n 19), and if output
  looks like it's regressing, check for duplicate processes:
  `Get-CimInstance Win32_Process -Filter "name='node.exe'"`

```powershell
$p = Start-Process node 'script/sweep.mjs --config=config/full-sweep.json' `
  -WorkingDirectory <repo> -WindowStyle Hidden `
  -RedirectStandardOutput logs\sweep.log -RedirectStandardError logs\sweep.err -PassThru
$p.PriorityClass = 'BelowNormal'
Write-Output $p.Id > logs/sweep.pid
```

## Headless physics harnesses (src/test_*.c)

- `test_conservation.c` — M2 closed-box ledger audit. Needs `-DP3_AUDIT`
  on planck3.c for the 14 per-branch ledger-delta counters (zeroed cost
  when off). Sync mode: attribution residual is exactly 0; legacy mode
  carries a known order-dependent push-absorption residual.
- `test_cavity.c` — M3 thermalization + exact separable 40³ DFT spectrum.
- `test_tof.c` — M4 ballistic pulse; v_g = 1 link/tick isotropic, z-walls
  reflect via deadlock→REV3.
- `test_doubleslit.c` — M5 slit apparatus: barrier = q=255 s=0 deadlock
  plane; detector = harness-drained absorbing plane; P3_TEMIT=300 silences
  wall tension (else T_DIVERT captures slit-mouth packets).
- Apparatus rules learned the hard way: `planck3_set_node` between ticks
  mutates g_rd = sustained emitter / absorber. Emitters must inject
  q ≤ FLOW_CAP — denser sources congestion-divert receiver spins back at
  the pack (self-scatter ping-pong). Sustained beams self-jam by packet
  coalescence — pulse sparsely (≥4-tick spacing). x/y are a torus: bounced
  traffic wraps — put a drain plane upstream of the wrap.

## Generated artifacts — never commit

`seeds/`, `docs/public/audio/` (Kokoro TTS mp3s + sync maps), and all
wasm outputs are generated, not source. `knot_dictionary.json` IS
committed — it's the 48K sweep verdict registry, expensive to
regenerate; only its `.tmp` swap file stays ignored.
The deploy workflow regenerates audio per deploy and ships it via
`dist/` — it is NOT committed back (kept out to stop repo bloat).
To hear narration locally, run `npm run generate-audio` (needs the
Kokoro pipeline); without it the Listen chip appears but can't play.

## meso3i harnesses + telemetry layout

- `script/meso/*.mjs` — the 28 self-contained meso3i experiment
  harnesses behind the M33–M48 monograph milestones (m37-bath,
  photon-test, drest-*, transactions, wavefront-isotropy, lump-ablate,
  yorp-*, eos-thermalize, stress-tensor …). Each loads
  `docs/public/wasm/ember/meso3i.js` (build via `src/build.sh` first)
  and prints measurements to stdout — no output files. They were
  rescued from the ignored `logs/` dir; keep new harnesses here.
- `results/` — committed telemetry: the collide/anneal/boost/fountain/
  quench JSONs, run `.log` transcripts, census `.txt` dumps, and
  per-job `status.json`/`-results.json` under `results/smx-job-*/`.
  The monograph's numbers trace back to these files.
- `logs/` stays fully ignored — it's the scratch dir for bulk
  regenerable binary output (`.smxst` state snapshots, `.smx` job
  blobs, `.vtk` frames, `.bin` knot states, `*.meta.json` painted
  masks). After a run worth keeping, move its small JSON/log output
  into `results/` and any new harness into `script/meso/`.

## Docs build

`npm run docs:build` fails on Windows (cmd.exe can't parse `mkdir -p`
in the wasm:build script). Run `npx vitepress build docs` directly, or
run inside a Linux container.
