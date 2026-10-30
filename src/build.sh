#!/bin/bash

mkdir -p ../docs/public/wasm/wake/ ../docs/public/wasm/loom/ ../docs/public/wasm/ember/

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
    '_planck3_init_dims',
    '_planck3_dim',
    '_planck3_chunk_size',
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
    '_planck3_live_cells',
    '_planck3_spray_events',
    '_planck3_spray_quanta',
    '_planck3_reset_stats',
    '_planck3_load_pointer',
    '_planck3_load_commit',
    '_planck3_rg_pointer',
    '_planck3_rg_refresh',
    '_planck3_rg_hmin',
    '_planck3_rg_hmax',
    '_planck3_mean_heat',
    '_planck3_set_dissipation',
    '_planck3_set_thermal_limit',
    '_planck3_set_sync',
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

# Yarkovsky's Ember — meso3i integer-occupancy multichannel engine
# (True-FCC D3Q19, transit friction + carrier-gated radiation). RG8 pack
# buffer inside the wasm heap feeds texSubImage3D exactly like planck3.
echo "Compiling meso3i friction engine (ember)..."
if emcc meso3i.c \
  -DGIT_REV=\"$GIT_REV\" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_NAME="'createEmber'" \
  -s EXPORTED_FUNCTIONS="[
    '_meso3i_init',
    '_meso3i_clear',
    '_meso3i_tick',
    '_meso3i_get',
    '_meso3i_set',
    '_meso3i_collmode',
    '_meso3i_friction',
    '_meso3i_fricp',
    '_meso3i_friccurve',
    '_meso3i_reflect',
    '_meso3i_fricmode',
    '_meso3i_dim',
    '_meso3i_nch',
    '_meso3i_cvc',
    '_meso3i_rg_pointer',
    '_meso3i_rg_refresh',
    '_meso3i_rest_mass',
    '_meso3i_mov_mass',
    '_meso3i_cm',
    '_meso3i_drain_edge',
    '_meso3i_save',
    '_meso3i_restore',
    '_meso3i_phot',
    '_meso3i_erate',
    '_meso3i_pair',
    '_meso3i_lat',
    '_meso3i_drest',
    '_meso3i_recomb',
    '_meso3i_annih',
    '_meso3i_friclum',
    '_meso3i_linkcap',
    '_meso3i_iecost',
    '_meso3i_phset',
    '_meso3i_phset_nu',
    '_meso3i_phget_nu',
    '_meso3i_phenergy',
    '_meso3i_phth',
    '_meso3i_nushift',
    '_meso3i_ptget',
    '_meso3i_iptbar',
    '_meso3i_fusemin',
    '_meso3i_fusecad',
    '_meso3i_recomb',
    '_meso3i_annih',
    '_meso3i_friclum',
    '_meso3i_linkcap',
    '_meso3i_iecost',
    '_meso3i_phget',
    '_meso3i_photons',
    '_meso3i_pset',
    '_meso3i_pget',
    '_meso3i_eget',
    '_meso3i_eset',
    '_meso3i_dwell',
    '_meso3i_edge',
    '_meso3i_qmode',
    '_meso3i_qdir',
    '_meso3i_bias',
    '_meso3i_condense',
    '_meso3i_gate',
    '_meso3i_field',
    '_meso3i_qcap',
    '_meso3i_qget',
    '_meso3i_recoil',
    '_meso3i_qset',
    '_meso3i_totals',
    '_meso3i_drest',
    '_meso3i_rget',
    '_meso3i_rset',
    '_meso3i_ev',
    '_meso3i_ev_reset',
    '_meso3i_scatter',
    '_meso3i_iepush',
    '_meso3i_lens',
    '_meso3i_randmode',
    '_meso3i_nuscat',
    '_meso3i_photdecay',
    '_meso3i_nuup',
    '_meso3i_qget',
    '_meso3i_recoil',
    '_malloc',
    '_free'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory']" \
  -o ../docs/public/wasm/ember/meso3i.js; then
  echo "✅ meso3i (ember) compiled successfully."
else
  echo "❌ Error: meso3i compilation failed!"
  exit 1
fi

# --- meso_core: stripped production kernel (RFC) ---
if emcc meso_core.c   -DGIT_REV=\"$GIT_REV\"   -O3   -s WASM=1   -s MODULARIZE=1   -s ALLOW_MEMORY_GROWTH=1   -s EXPORT_NAME="'createEmberCore'"   -s EXPORTED_FUNCTIONS="[
    '_meso3i_init',
    '_meso3i_seed',
    '_meso3i_tick',
    '_meso3i_get',
    '_meso3i_set',
    '_meso3i_collmode',
    '_meso3i_friction',
    '_meso3i_fricp',
    '_meso3i_reflect',
    '_meso3i_fricmode',
    '_meso3i_dim',
    '_meso3i_nch',
    '_meso3i_rg_refresh',
    '_meso3i_rest_mass',
    '_meso3i_mov_mass',
    '_meso3i_drain_edge',
    '_meso3i_phot',
    '_meso3i_erate',
    '_meso3i_pair',
    '_meso3i_lat',
    '_meso3i_phset',
    '_meso3i_phget',
    '_meso3i_photons',
    '_meso3i_rget',
    '_meso3i_eget',
    '_meso3i_eset',
    '_meso3i_ptget',
    '_meso3i_ltget',
    '_meso3i_ev',
    '_meso3i_ev_reset',
    '_meso3i_drest',
    '_meso3i_dwell',
    '_meso3i_fusemin',
    '_meso3i_fusecad',
    '_meso3i_recomb',
    '_meso3i_annih',
    '_meso3i_friclum',
    '_meso3i_linkcap',
    '_meso3i_iecost',
    '_meso3i_scatter',
    '_meso3i_iepush',
    '_meso3i_lens',
    '_meso3i_randmode',
    '_meso3i_iptbar',
    '_malloc',
    '_free'
  ]"   -o ../docs/public/wasm/ember/meso_core.js; then
    echo "✅ meso_core compiled successfully."
else
    echo "❌ Error: meso_core compilation failed!"
fi

# --- link3: network-ontology engine (links, sessions, nu spectrum) ---
if emcc link3.c \
  -DGIT_REV=\"$GIT_REV\" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_NAME="'createLink3'" \
  -s EXPORTED_FUNCTIONS="[
    '_link3_init',
    '_link3_seed',
    '_link3_tick',
    '_link3_get',
    '_link3_set',
    '_link3_phset',
    '_link3_phget',
    '_link3_phnu',
    '_link3_upget',
    '_link3_load',
    '_link3_sess',
    '_link3_sst',
    '_link3_bond',
    '_link3_snu',
    '_link3_snu_set',
    '_link3_rset',
    '_link3_drest',
    '_link3_eget',
    '_link3_eset',
    '_link3_qget',
    '_link3_rest',
    '_link3_nch',
    '_link3_dim',
    '_link3_rest_mass',
    '_link3_mov_mass',
    '_link3_photons',
    '_link3_ev',
    '_link3_ev_reset',
    '_link3_friction',
    '_link3_emit',
    '_link3_phot',
    '_link3_recoil',
    '_link3_comove',
    '_link3_iqmode',
    '_link3_iqcap',
    '_link3_iqdwell',
    '_link3_drain_edge',
    '_link3_photdecay',
    '_link3_fusion',
    '_link3_annih',
    '_link3_egate',
    '_link3_iecost',
    '_link3_ieburst',
    '_link3_grav',
    '_malloc',
    '_free'
  ]" \
  -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'wasmMemory']" \
  -o ../docs/public/wasm/ember/link3.js; then
  echo "✅ link3 (ember) compiled successfully."
else
  echo "❌ Error: link3 compilation failed!"
  exit 1
fi
