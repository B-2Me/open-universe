<script setup>
import { onMounted, onUnmounted } from 'vue'

let cleanup = null

onMounted(async () => {
  const { initWakeSimulator } = await import('../wake/main.js')
  cleanup = await initWakeSimulator()
})

onUnmounted(() => {
  if (typeof cleanup === 'function') cleanup()
})
</script>

<template>
  <div class="wake-sandbox">
    <div id="wake-app">
      
      <!-- LEFT SIDEBAR: Control Center & Telemetry -->
      <div id="app-sidebar">
        
        <!-- Scenario Selector Header -->
        <div class="sidebar-section" style="padding-top: 12px;">
          <div class="deck-row scenario-nav-bar">
            <select id="scenario_dropdown" class="scenario-select">
              <option value="vacuum">🌌 Vacuum</option>
              <option value="stellar">☀️ Stellar Core</option>
              <option value="atmosphere">🪐 Atmosphere</option>
              <option value="nozzle">🚀 Engine Bell (Global)</option>
              <option value="boundary">🔬 Nozzle Wall (Micro-Patch)</option>
              <option value="ocean">🌊 Ocean</option>
            </select>
            <button id="btn_scenario_info" class="icon-btn" title="Scenario Dossier">ℹ️</button>
          </div>
        </div>

        <!-- Tool Segment Bar -->
        <div class="sidebar-section">
          <div class="segment-container">
            <button class="segment-btn active" data-mode="move">🖐 Move</button>
            <button class="segment-btn" data-mode="place">✏️ Place</button>
            <button class="segment-btn" data-mode="sample">🔍 Sample</button>
            <button class="segment-btn" data-mode="config">⚙️ System</button>
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
              <span class="context-label">Lattice Projection</span>
              <span class="context-hint" id="gpu_status_badge">WebGL Active</span>
            </div>
            <div class="button-group" id="projection_mode_selector">
              <button class="group-btn active" data-val="quad">⏹️ Quad</button>
              <button class="group-btn" data-val="hex">⬡ Hex</button>
              <button class="group-btn" data-val="oct">🛑 Oct</button>
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
        </div>

        <!-- Quick Actions -->
        <div class="sidebar-section">
          <div class="button-group">
            <button id="btn_reset" class="group-btn">🔄 Reset</button>
            <button id="btn_soup" class="group-btn">🎲 Random</button>
            <button id="btn_clear" class="group-btn">🧹 Clear</button>
            <button id="btn_undo" class="group-btn">↩️ Undo</button>
          </div>
        </div>

        <!-- Telemetry Dashboard -->
        <div id="telemetry-grid" class="sidebar-section">
            <div class="tel-item"><span class="tel-lbl">Quanta</span><span class="tel-val" id="diag_quanta">0</span></div>
            <div class="tel-item"><span class="tel-lbl">Heat</span><span class="tel-val" id="diag_heat">0</span></div>
            <div class="tel-item"><span class="tel-lbl">Phase</span><span class="tel-val" id="diag_phase">0.0%</span></div>
            <div class="tel-item"><span class="tel-lbl">Yield</span><span class="tel-val" id="diag_yield">0</span></div>
        </div>

        <!-- Sliders -->
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
        <div style="padding: 12px 16px; margin-top: auto; font-size: 10px; color: #666; display: flex; justify-content: space-between; font-family: var(--font-mono); font-weight: bold;">
          <span id="diag_status">BOOTING</span>
          <span id="diag_nodes">160,000 Nodes</span>
        </div>
      </div>

      <!-- RIGHT VIEWPORT: Massive Scalable Canvas with HUD Corner Overlays -->
      <div id="app-viewport">
        
        <!-- Left Canvas Layer HUD Overlay -->
        <button id="btn_toggle_left" class="viewport-hud-btn hud-left">👁 Macro</button>
        
        <!-- Right Canvas Layer HUD Overlay -->
        <button id="btn_toggle_right" class="viewport-hud-btn hud-right">🕳 Entropic</button>

        <div id="canvas-container">
          <div id="error-banner"></div>
          <div id="transform-wrapper">
            <div class="split-half">
              <canvas id="canvas_left" width="400" height="400"></canvas>
            </div>
            <div class="split-half" style="border-left: 1px dashed rgba(255,255,255,0.15);">
              <canvas id="canvas_right" width="400" height="400"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Dossier Modal -->
      <div id="modal_scenario_info" class="dossier-modal">
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
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  background: #0a0e0a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}
</style>
