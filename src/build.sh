#!/bin/bash

mkdir -p ../docs/public/wasm/wake/

echo "Compiling Planck Field engine (Production Bridge Simulator Edition)..."

if emcc planck.c \
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
    '_randomize_grid', 
    '_set_node', 
    '_get_node', 
    '_get_node_state',
    '_set_node_state',
    '_add_heat',
    '_set_spin',
    '_add_quanta',
    '_add_quanta_impedance',
    '_set_impedance_mode',
    '_save_grid_snapshot',
    '_restore_grid_snapshot',
    '_get_snapshot_count',
    '_get_grid_pointer',
    '_get_engine_version', 
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
