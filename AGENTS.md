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

## Docs build

`npm run docs:build` fails on Windows (cmd.exe can't parse `mkdir -p`
in the wasm:build script). Run `npx vitepress build docs` directly, or
run inside a Linux container.
