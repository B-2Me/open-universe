# Agent Notes

## File edits — watch line endings on Windows

When writing files via Python (`open(path,'w')` etc.) on Windows, the
runtime emits CRLF — which breaks bash scripts (`$'\r': command not
found`) and diffs. Force LF for `.sh` and other POSIX files:

```python
open(path, 'w', newline='\n').write(src)   # or write bytes
```

Verify with `file`/`od -c` before running the script in Docker.

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
  locally. On Windows the listener needs a firewall rule once:
  `netsh advfirewall firewall add rule name="smatrix 9898" dir=in
  action=allow protocol=TCP localport=9898 profile=private`
  (adjust the port to match `--port`).
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
Sync maps are silence-aligned, not char-proportional: the pipeline
decodes each mp3 (`audio-decode`), detects the `' ... '` separator
pauses via RMS floor, and snaps node boundaries to real gaps —
`.hash` sidecars carry a `v2:` version tag so unchanged pages get a
map-only realign with no TTS call. Bump `MAP_VERSION` if the
alignment scheme changes again.

## meso3i harnesses + telemetry layout

- `script/meso/*.mjs` — the ~51 self-contained meso3i experiment
  harnesses. As of the E-series: every meso3i setter is exported,
  including `pget`/`pset` (iPH phase registers), `dwell`/`edge`
  (edge delay lines), and the full field-coupling layer
  (`bias`/`condense`/`gate`/`field`) — previously unprobed knobs that
  were written in C but never wired to the harness. Field-coupling
  caveat: `atti(r)` is a *cliff* at `IRSAT` (default 8), not a
  plateau — dense lumps read `atti=0`; IBIAS pulls only in `1..8`
  fringes. `meso3i_gate` also enables `IGATE` side-effects.
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

## moore26 (0.1fm cascade engine)

- `src/moore26.c` — the 0.1fm/node engine (26-neighbor Moore
  stencil, AoS `NodeState`, vacuum-skip 8³ chunk ledger, OpenMP
  phases). Wasm output goes to `docs/public/wasm/cascade/`
  (`createMoore26` factory) — NOT `ember/` (that's the meso3i/qi3/
  link3 family). OpenMP pragmas are inert under emscripten; the
  chunk ledger carries the perf there.
- `script/cascade/*.mjs` — moore26 experiment harnesses (the
  cascade project's scripts — do NOT add them to `script/meso/`,
  which is the meso3i family's home). `moore26-harness.mjs` seeds a
  two-core saturated flux tube and logs winding/mass/split
  centroids + event counters; it resolves the repo root as `../..`
  (one level deeper than top-level scripts). Native smoke:
  `src/test_moore26.c` (gcc -O3 -fopenmp moore26.c test_moore26.c).
- Artifact naming: `docs/public/wasm/cascade/` should contain ONLY
  `build.sh` outputs — `moore26.js/.wasm` (always) and `moore26-mt.*`
  (emsdk ≥4.x only). Any other variant name (`-stnm`, `-mtnm`,
  `-mtd`, `-mtnmd`) is a stale artifact from an older build scheme —
  delete it. Loading stale artifacts once silently ran every cascade
  harness on a pre-recoil engine. `loadM26` (script/lib/m26.mjs) now
  refuses an artifact older than `src/moore26.c` (opt out:
  `M26_STALE_OK=1`) and prints `rev=` from `moore26_gitrev()` — the
  engine's build commit, compiled in via `-DGIT_REV`.
- Grid-size constraint: `NodeState` ≈220B × sites × 2 buffers, so
  256³ (~7.4GB) exceeds wasm32 — use ≤128³ in wasm, or a MEMORY64
  build for bigger. Power-of-2 dims ≥8 required (bitmask wrap +
  chunk ledger).
- Known behavior: string-break fires on ≥12-node saturated tubes
  (tube heads only — one fracture, +128 mass per endpoint);
  emission is conserving (nu = shed/2, recapture restores da+db);
  heat is per-node with a −1/128/tick local drain.
- Clock/history stack (all measured, commit ea6d720 era):
  `qTick` = absolute drumbeat (rail ring: exact period 3, bath-immune;
  ballistic time is NOT dilatable). `localTime` (τ, NodeState off
  456) = conserved proper-time accumulator integrating
  free_*qPhaseAdv each tick — twins diverge 22× under targeted
  congestion; bound knots are DEPTH-GRADED, not uniformly frozen:
  core ticks at max (shielded), shell crawls (congestion tax).
  `bondTick` (off 448) = first-confirm birthday — volumetric
  provenance: fed knots write concentric rings (surface-filtered
  accretion), bath knots write a sponge (volumetric fill);
  directional wind writes a 5.7× fossil age-gradient (windward
  face = OLD accretion crust — inverted vs nature's erosion).
  `workAge` (off 452) = cumulative txnWork — callus vs relic:
  effort peaks at working shell, birthday at formation site.
  `bondPar` (int8, off 460) = net parity of confirmed bonds,
  saturating ±127 — the node's conserved chirality record, set by
  its FIRST bond (self-polarizing). `qParGate` declines offers
  whose incipPar disagrees — verified: +polarized knot refuses
  -flux, holds handedness, ~49% accretion suppression. True
  delta-m=±1 selection: handedness matching handedness. `qMassCap`
  = Compton ansatz (0=off): clock bandwidth = mass*qMassCap/16
  instead of flat qWorkCap — tau rate = k*m - C_s verified on
  isolated nodes (14400/72000/288000 at mass 10/40/160). Under
  mass-scaling "mass is frozen time" INVERTS to "mass is
  accelerated time" — heavier structure ticks faster. Composite
  verification: knot core at mass 10 ticks ~19.2k (=cap 3*8*800),
  and mass=0 sites get cap=0 — VACUUM HAS NO PROPER TIME: under
  mass-scaled bandwidth, time exists only where mass exists.
  `qBondAge` tuner = seniority-weighted emission temper — verified
  NON-MONOTONIC (bifurcation knob, not a dial): suppressing early
  sheds reroutes the whole accretion trajectory. `qWorkCap` =
  authored per-node bandwidth; `qPhaseAdv` = clock rate multiplier.
  `qAlignGate` tuner = helicity-selective CONFIRM gate on
  bondDist[e] (ACK-measured bonded reach — the only orientation
  record emission can't spend; gating on winding dd self-defeats
  because the knot's own dd-emission erodes the surface axis).
  Verified: off-axis accretion suppressed 75-90% while the bonded
  axis still accepts; selection is EMERGENT (bit-identical on
  symmetric vs dd-biased seeds — bond topology self-organizes
  from feed geometry + rail paving, not birth memory).
  Honest status: time = authored-but-measured laws, not Lorentz;
  the knot is a jam (zero circulation on all 4 {111} plaquettes),
  dd is Meissner-frozen (no tumble exists), and history records
  provenance (fuel direction, formation epoch) — not velocity.

`npm run docs:build` fails on Windows (cmd.exe can't parse `mkdir -p`
in the wasm:build script). Run `npx vitepress build docs` directly, or
run inside a Linux container.
