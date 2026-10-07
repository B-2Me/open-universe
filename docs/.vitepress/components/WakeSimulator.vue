<script setup>
import { onMounted, onUnmounted } from 'vue'

let cleanup = null

const boot = async () => {
  if (typeof cleanup === 'function') cleanup()
  const { initWakeSimulator } = await import('../wake/main.js')
  cleanup = await initWakeSimulator()
}

// The Substrate selector (System drawer) swaps engine modules — same
// dynamics, different adjacency — by re-running the boot sequence.
const onTopologyChange = () => { boot() }

onMounted(async () => {
  // PWA shell: offline cache for the site + wasm (prod builds only)
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
  window.addEventListener('wake:topology', onTopologyChange)
  await boot()
})

onUnmounted(() => {
  window.removeEventListener('wake:topology', onTopologyChange)
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div class="wake-sandbox">
    <div id="wake-app">
      
      <!-- LEFT SIDEBAR: Control Center & Telemetry -->
      <div id="app-sidebar">

        <!-- Quick Actions (Moved above Move/mode bar) -->
        <div class="sidebar-section" style="padding-top: 16px;">
          <div class="button-group">
            <button id="btn_reset" class="group-btn">🔄 Reset</button>
            <button id="btn_soup" class="group-btn">🎲 Random</button>
            <button id="btn_clear" class="group-btn">🧹 Clear</button>
          </div>
          <div class="button-group" style="margin-top: 6px;">
            <button id="btn_play" class="group-btn" title="Play/Pause (P)">⏸ Pause</button>
            <button id="btn_step" class="group-btn" title="Advance one tick">⏭ Step</button>
          </div>
        </div>

        <!-- Tool Segment Bar -->
        <div class="sidebar-section">
          <div class="segment-container">
            <button class="segment-btn active" data-mode="move">🖐 Move</button>
            <button class="segment-btn" data-mode="place">✏️ Place</button>
            <button class="segment-btn" data-mode="sample">🔍 Sample</button>
            <button class="segment-btn" data-mode="config">⚙ System</button>
          </div>
        </div>

        <!-- Pop-Out Drawers -->
        <div id="context_place" class="context-popup sidebar-section">
          <div class="context-group">
            <div class="context-header">
              <span class="context-label">Materia Brushes</span>
              <span class="context-hint">Tap brush to equip</span>
            </div>
            <div id="brush_selector" class="palette-grid"></div>
          </div>
          <div class="context-group" style="margin-top: 8px;">
            <div class="context-header">
              <span class="context-label" style="display: flex; align-items: center; gap: 6px;">
                Injection Matrix
                <button id="btn_injection_info" class="icon-btn" style="width:16px; height:16px; min-height:16px; padding:0; border-radius:50%; font-size:10px;">ℹ️</button>
              </span>
              <span class="context-hint" id="hint_injection_mode">CLONE</span>
            </div>
            <div class="button-group" id="injection_mode_selector">
              <button class="group-btn active" data-val="clone">📋 Clone</button>
              <button class="group-btn" data-val="quanta">🧱 Density</button>
              <button class="group-btn" data-val="heat">🔥 Heat</button>
              <button class="group-btn" data-val="spin">🔄 Spin</button>
            </div>
            <div class="dose-rows">
              <div class="dose-row">
                <span class="dose-label">Density</span>
                <input type="range" id="dose_quanta" min="1" max="100" value="25" class="slider-fill">
                <span class="dose-val" id="val_dose_quanta">25%</span>
              </div>
              <div class="dose-row">
                <span class="dose-label">Heat</span>
                <input type="range" id="dose_heat" min="1" max="100" value="5" class="slider-fill">
                <span class="dose-val" id="val_dose_heat">5%</span>
              </div>
              <div class="dose-row">
                <span class="dose-label">Spin</span>
                <input type="range" id="dose_spin" min="0" max="100" value="100" class="slider-fill" title="0% entrain to ambient flow — 100% impose stamp direction">
                <span class="dose-val" id="val_dose_spin">100%</span>
              </div>
            </div>
          </div>
        </div>

        <div id="context_sample" class="context-popup sidebar-section">
          <div class="deck-row">
            <span class="sub-label">Radius: <span id="val_radius">10</span>px</span>
            <input type="range" id="slider_radius" min="1" max="50" value="10" class="slider-fill">
          </div>
          <div class="button-group" style="margin-top: 6px;">
            <button id="btn_save_scratch" class="group-btn" disabled>💾 Save Custom Stamp</button>
            <button id="btn_copy_stamp" class="group-btn">📋 Copy JSON</button>
          </div>
        </div>

        <div id="context_config" class="context-popup sidebar-section">
          <div class="context-group">
            <div class="context-header">
              <span class="context-label">Substrate</span>
              <span class="context-hint">Adjacency — reboots universe</span>
            </div>
            <div class="button-group" id="substrate_selector">
              <button class="group-btn" data-val="square">⏹️ Oct8</button>
              <button class="group-btn" data-val="hex">⬡ Hex6</button>
            </div>
            <a class="context-link" href="/topology" target="_blank" rel="noopener">📖 Shell-World vs. Knot-World</a>
          </div>
          <div class="context-group" style="margin-top: 6px;">
            <div class="context-header">
              <span class="context-label">Lattice Projection</span>
              <span class="context-hint" id="gpu_status_badge">WebGL Active</span>
            </div>
            <div class="button-group" id="projection_mode_selector">
              <button class="group-btn" data-val="quad">⏹️ Quad</button>
              <button class="group-btn" data-val="hex">⬡ Hex</button>
              <button class="group-btn active" data-val="oct">🛑 Oct</button>
            </div>
          </div>
          <div class="context-group" style="margin-top: 6px;">
            <div class="context-header">
              <span class="context-label">Frame Capture</span>
              <span class="context-hint">Direct canvas export</span>
            </div>
            <div class="button-group">
              <button id="btn_export_png" class="group-btn">📸 Save PNG</button>
              <button id="btn_share" class="group-btn">📤 Share</button>
              <button id="btn_export_vtk" class="group-btn">🧊 3D VTK</button>
            </div>
          </div>
          <div class="context-group" style="margin-top: 6px;">
            <div class="context-header">
              <span class="context-label">Engine Flags</span>
              <span class="context-hint">Physics injection model</span>
            </div>
            <label class="sub-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 32px;">
              <input type="checkbox" id="chk_undo">
              Undo Buffer (4 checkpoints, ~2.5 MB)
            </label>
          </div>
          <div class="context-group" style="margin-top: 6px;">
            <div class="context-header">
              <span class="context-label">Palette Presets</span>
              <span class="context-hint">Import / Export stamps</span>
            </div>
            <div class="button-group">
              <button id="btn_export_palette" class="group-btn">💾 Backup JSON</button>
              <label class="group-btn" style="cursor: pointer; margin: 0;">
                📂 Restore JSON
                <input type="file" id="import_palette_input" accept=".json" style="display: none;">
              </label>
              <button id="btn_reset_palette" class="group-btn" style="color: #ff8888;">🗑️ Reset</button>
            </div>
          </div>
          <div class="context-group" style="margin-top: 6px;">
            <div class="context-header">
              <span class="context-label">Keyboard Shortcuts</span>
              <span class="context-hint">Desktop</span>
            </div>
            <span class="context-hint" style="text-transform: none; line-height: 1.8;">
              <b>Space</b> pan · <b>P</b> play/pause · <b>R</b> randomize · <b>C</b> clear<br>
              <b>Ctrl+Z</b> undo (if enabled) · <b>Esc</b> close/unfocus · <b>Dbl-click</b> reset view (Move)<br>
              <b>Arrows</b> move brush cursor / pan · <b>Shift+Arrows</b> ×10 · <b>Enter</b> stamp (canvas focused)
            </span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="sidebar-section">
          <div class="button-group">
            <button id="btn_reset" class="group-btn">🔄 Reset</button>
            <button id="btn_soup" class="group-btn">🎲 Random</button>
            <button id="btn_clear" class="group-btn">🧹 Clear</button>
          </div>
          <div class="button-group" style="margin-top: 6px;">
            <button id="btn_play" class="group-btn" title="Play/Pause (P)">⏸ Pause</button>
            <button id="btn_step" class="group-btn" title="Advance one tick">⏭ Step</button>
          </div>
        </div>

        <!-- Telemetry Dashboard -->
        <div id="telemetry-grid" class="sidebar-section">
            <div class="tel-item"><span class="tel-lbl">Quanta</span><span class="tel-val" id="diag_quanta">0</span></div>
            <div class="tel-item"><span class="tel-lbl">Heat</span><span class="tel-val" id="diag_heat">0</span></div>
            <div class="tel-item"><span class="tel-lbl">Phase</span><span class="tel-val" id="diag_phase">0.0%</span></div>
            <div class="tel-item"><span class="tel-lbl">Yield</span><span class="tel-val" id="diag_yield">0</span></div>
        </div>

        <!-- Sliders Moved Below Controls & Telemetry -->
        <div class="sidebar-section" style="display: flex; flex-direction: column; gap: 6px;">
          <div class="deck-row">
            <div class="slider-group">
              <span class="sub-label">Speed: <span id="val_speed">60 TPS</span></span>
              <input type="range" id="slider_speed" min="0" max="120" value="60" class="slider-fill">
            </div>
            <div class="slider-group">
              <span class="sub-label">Zoom: <span id="val_zoom">1.0x</span></span>
              <input type="range" id="slider_zoom" min="1" max="10" step="0.1" value="1" class="slider-fill">
            </div>
          </div>
          
          <div class="deck-row">
            <div class="slider-group">
              <span class="sub-label">Dissipation: <span id="math_dissipation">15</span></span>
              <input type="range" id="slider_dissipation" min="0" max="100" value="15" class="slider-fill">
            </div>
            <div class="slider-group">
              <span class="sub-label">Thermal Limit: <span id="math_thermal_limit">50000</span></span>
              <input type="range" id="slider_thermal" min="1000" max="65000" step="1000" value="50000" class="slider-fill">
            </div>
          </div>
        </div>

        <!-- Footer Boot Info -->
        <div style="padding: 12px 16px; margin-top: auto; font-size: 10px; line-height: 1.25; color: #666; display: flex; justify-content: space-between; font-family: var(--font-mono); font-weight: bold;">
          <span id="diag_status">BOOTING</span>
          <span id="diag_nodes">160,000 Nodes</span>
        </div>
      </div>

      <!-- RIGHT VIEWPORT: Massive Scalable Canvas -->
      <div id="app-viewport">
        
        <!-- Viewport Header: Left Toggle + Scenario Select + Right Toggle -->
        <div class="viewport-header">
          <!-- Left Split Layer Toggle (positioned strictly on the left) -->
          <button id="btn_toggle_left" class="lens-btn" title="Left Canvas Viewport Layer">
            <span class="lens-tag">L</span>
            <span class="lens-label">👁 Macro</span>
          </button>

          <!-- Centered Scenario Nav Bar -->
          <div class="scenario-nav-bar">
            <select id="scenario_dropdown" class="scenario-select">
              <option value="vacuum">🌌 Vacuum</option>
              <option value="stellar">☀️ Stellar Core</option>
              <option value="atmosphere">🪐 Atmosphere</option>
              <option value="nozzle">🚀 Engine Bell (Global)</option>
              <option value="boundary">🔬 Nozzle Wall (Micro-Patch)</option>
              <option value="ocean">🌊 Ocean</option>
              <option value="electron">⚛️ Synthetic Electron</option>
            </select>
            <button id="btn_scenario_info" class="icon-btn" title="Scenario Dossier">ℹ️</button>
          </div>

          <!-- Right Split Layer Toggle (positioned strictly on the right) -->
          <button id="btn_toggle_right" class="lens-btn" title="Right Canvas Viewport Layer">
            <span class="lens-tag">R</span>
            <span class="lens-label">🕳 Entropic</span>
          </button>
        </div>

        <div id="canvas-touch-zone">
          <div id="canvas-container" tabindex="0" role="application"
               aria-label="Simulation field. Arrow keys move the brush cursor or pan the view, Enter stamps the brush, Escape removes focus.">
            <div id="error-banner"></div>
            <span id="kbd_cursor_status" class="sr-only" aria-live="polite"></span>
            <div id="split-view">
              <div class="split-half">
                <canvas id="canvas_left" width="400" height="400" aria-label="Primary visualization layer"></canvas>
              </div>
              <div class="split-half" style="border-left: 1px dashed rgba(255,255,255,0.15);">
                <canvas id="canvas_right" width="400" height="400" aria-label="Secondary visualization layer"></canvas>
              </div>
            </div>
            <!-- Overlay layer for the brush footprint preview; the canvases
                 live outside it because WebGL zoom/pan is shader-side now.
                 In the 2D fallback, #split-view receives the CSS transform. -->
            <div id="transform-wrapper"></div>
          </div>
          <!-- Extra touch surface below the canvas: stamps are lifted 56px
               above the fingertip, so without this strip the bottom rows of
               the field are unreachable on touch devices. Touching here
               clamps to the canvas' bottom edge. -->
          <div id="canvas-touch-pad" aria-hidden="true"></div>
        </div>
      </div>

      <!-- Dossier Modal -->
      <div id="modal_scenario_info" class="dossier-modal" role="dialog" aria-modal="true" aria-labelledby="dossier_title">
        <div class="dossier-content">
          <div class="dossier-header">
            <span id="dossier_title" class="dossier-title">Scenario Dossier</span>
            <button id="btn_close_dossier" class="dossier-close-btn">✕</button>
          </div>
          <div class="dossier-body">
            <div class="dossier-item">
              <span class="dossier-label">Objective</span>
              <span id="dossier_objective" class="dossier-text"></span>
            </div>
            <div class="dossier-item">
              <span class="dossier-label">Physics Mechanisms</span>
              <span id="dossier_mechanisms" class="dossier-text"></span>
            </div>
            <div class="dossier-item">
              <span class="dossier-label">Recommended Brushes</span>
              <span id="dossier_brushes" class="dossier-text"></span>
            </div>
            <div class="dossier-item">
              <span class="dossier-label">Best Layers</span>
              <span id="dossier_layers" class="dossier-text"></span>
            </div>
            <div class="dossier-item">
              <span class="dossier-label">Tactical Tip</span>
              <span id="dossier_tips" class="dossier-text highlight"></span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style>
@import '../wake/style.css';

.wake-sandbox {
  margin: 0.25rem 0 1rem 0 !important;
  border-radius: 8px;
  overflow: hidden;
  /* clip so the sandbox never joins the wheel scroll chain as a
     scrollable ancestor (overflow:hidden would silently consume deltas) */
  overflow: clip;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  background: var(--pf-bg-main);
  color: var(--pf-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}

/* --- Mobile Safari Header Optimization --- */
.viewport-header {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 4px !important;
  padding: 4px 6px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.viewport-header .lens-btn {
  flex: 0 0 auto !important;
  min-width: 0 !important;
  padding: 4px 6px !important;
  font-size: 11px !important;
  white-space: nowrap !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.viewport-header .lens-tag {
  font-size: 9px !important;
  opacity: 0.75 !important;
  font-weight: bold !important;
}

.viewport-header .scenario-nav-bar {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 3px !important;
}

.viewport-header .scenario-select {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: 100% !important;
  padding: 4px 6px !important;
  font-size: 11px !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}

.viewport-header .icon-btn {
  flex: 0 0 24px !important;
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
</style>
