#!/bin/bash

mkdir -p ../docs/public/wasm/wake/

echo "Compiling Planck Field engine (Production Bridge Simulator Edition)..."

# Stamp the engine with the revision that last touched planck.c — the
# physics provenance. Stamping the deploy HEAD would churn the displayed
# rev on JS-only commits and make "is this wasm stale?" unanswerable.
# The compile date alongside it proves build freshness.
GIT_REV=$(git log -1 --format=%h -- planck.c 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "nogit")

if emcc planck.c \
  -DGIT_REV=\"$GIT_REV\" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_NAME="'createPlanck'" \
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
    '_set_impedance_mode',
    '_set_undo_enabled',
    '_save_grid_snapshot',
    '_restore_grid_snapshot',
    '_get_snapshot_count',
    '_get_grid_pointer',
    '_get_engine_build', 
    '_get_grid_width', 
    '_get_grid_height',
    '_get_total_quanta',
    '_get_total_heat',
    '_get_phase_alignment',
    '_get_yield',
    '_generate_vtk',
    '_free_vtk'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory', 'UTF8ToString']" \
  -o ../docs/public/wasm/wake/planck.js; then
  
  echo "✅ Planck Field compiled successfully."
else
  echo "❌ Error: Planck Field compilation failed!"
  exit 1
fi
