#!/bin/bash

# Ensure the output directory exists
mkdir -p ../docs/public/wake/

# Compile the C engine to WebAssembly
emcc planck.c \
  -O3 \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS="['_init_grid', '_tick', '_get_pixel_buffer_pointer', '_set_dissipation', '_set_thermal_limit', '_set_render_layer']" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" \
  -o ../docs/public/wake/planck.js

echo "Planck Field compiled successfully to /docs/public/wake/"
