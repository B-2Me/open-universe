#!/bin/bash

mkdir -p ../docs/public/wasm/wake/

echo "Compiling Planck Field engine..."

# Compile the C engine to WebAssembly
if emcc planck.c \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="'createPlanck'" \
  -s EXPORTED_FUNCTIONS="[
    '_init_grid', 
    '_tick', 
    '_render_frame',
    '_get_pixel_buffer_pointer', 
    '_set_dissipation', 
    '_set_thermal_limit', 
    '_clear_grid', 
    '_randomize_grid', 
    '_set_node', 
    '_get_node', 
    '_get_engine_version', 
    '_get_grid_width', 
    '_get_grid_height',
    '_get_total_quanta',
    '_get_total_heat'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory']" \
  -o ../docs/public/wasm/wake/planck.js; then
  
  # This block only runs if the compile succeeds
  echo "✅ Planck Field compiled successfully."
else
  # This block runs if the compile crashes
  echo "❌ Error: Planck Field compilation failed!"
  exit 1
fi
