#!/bin/bash

mkdir -p ../docs/public/wasm/wake/ ../docs/public/wasm/loom/

# Stamp engines with the revision that last touched planck.c — the
# physics provenance. Stamping the deploy HEAD would churn the displayed
# rev on JS-only commits and make "is this wasm stale?" unanswerable.
# The compile date alongside it proves build freshness.
GIT_REV=$(git log -1 --format=%h -- planck.c 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "nogit")

# Two substrates, one dynamics: oct8 (Moore 8-fold, default) and hex6
# (6-fold odd-r offset, -DTOPOLOGY_HEX). Same laws, different adjacency —
# the site swaps modules so users can compare what persists on each.
build_engine() {
  local out=$1 export_name=$2 defs=$3

  echo "Compiling Planck Field engine ($out)..."

  if emcc planck.c \
    -DGIT_REV=\"$GIT_REV\" \
    $defs \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORT_NAME="'$export_name'" \
    -s EXPORTED_FUNCTIONS="[
      '_init_grid',
      '_free_grid',
      '_tick',
      '_render_frame',
      '_get_pixel_buffer_pointer',
      '_set_dissipation',
      '_set_thermal_limit',
      '_clear_grid',
      '_get_node_state',
      '_set_node_state',
      '_add_heat',
      '_set_spin',
      '_add_quanta',
      '_set_undo_enabled',
      '_set_seepage_mode',
      '_set_spray_mode',
      '_set_tension_mode',
      '_save_grid_snapshot',
      '_restore_grid_snapshot',
      '_get_snapshot_count',
      '_get_grid_pointer',
      '_get_engine_build',
      '_get_grid_width',
      '_get_grid_height',
      '_get_total_quanta',
      '_get_total_occupancy',
      '_get_total_heat',
      '_get_phase_alignment',
      '_get_yield',
      '_generate_vtk',
      '_free_vtk'
    ]" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory', 'UTF8ToString']" \
    -o ../docs/public/wasm/wake/$out.js; then

    echo "✅ $out compiled successfully."
  else
    echo "❌ Error: $out compilation failed!"
    exit 1
  fi
}

build_engine planck createPlanck ""
build_engine planck-hex createPlanckHex "-DTOPOLOGY_HEX"

# RFC-049: True FCC (A-B-C) 12-port 3D substrate — separate module from
# the 2D engine (own export vocabulary: planck3_*). Flat + chunk/halo +
# ordered-chunk engines; mode-selectable at runtime via planck3_set_mode.
echo "Compiling Planck Field 3D engine (planck3)..."
if emcc planck3.c \
  -DGIT_REV=\"$GIT_REV\" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_NAME="'createPlanck3'" \
  -s EXPORTED_FUNCTIONS="[
    '_planck3_init',
    '_planck3_set_mode',
    '_planck3_prepare',
    '_planck3_tick',
    '_planck3_collect',
    '_planck3_set_node',
    '_planck3_get_node',
    '_planck3_get_heat',
    '_planck3_state_pointer',
    '_planck3_node_count',
    '_planck3_dims',
    '_planck3_total_quanta',
    '_planck3_deadlocked',
    '_planck3_load_pointer',
    '_planck3_load_commit',
    '_planck3_rg_pointer',
    '_planck3_rg_refresh',
    '_planck3_set_dissipation',
    '_planck3_set_thermal_limit',
    '_planck3_save',
    '_planck3_restore'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory']" \
  -o ../docs/public/wasm/loom/planck3.js; then
  echo "✅ planck3 compiled successfully."
else
  echo "❌ Error: planck3 compilation failed!"
  exit 1
fi
