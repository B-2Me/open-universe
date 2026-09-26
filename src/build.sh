#!/bin/bash

mkdir -p ../docs/public/wasm/wake/

# Compile the C engine to WebAssembly
emcc planck.c \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="'createPlanck'" \
  -s EXPORTED_FUNCTIONS="[
    '_init_grid', 
    '_tick', 
    '_get_pixel_buffer_pointer', 
    '_set_dissipation', 
    '_set_thermal_limit', 
    '_set_render_layer', 
    '_clear_grid', 
    '_randomize_grid', 
    '_set_node', 
    '_get_node', 
    '_get_engine_version', 
    '_get_grid_width', 
    '_get_grid_height'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory']" \
  -o ../docs/public/wasm/wake/planck.js

echo "Planck Field compiled successfully."
