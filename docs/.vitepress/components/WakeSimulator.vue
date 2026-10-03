<script setup>
import { onMounted, onUnmounted } from 'vue'

let cleanup = null

onMounted(async () => {
  // Dynamic import ensures zero SSR collisions during `docs:build`
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
      <div id="left-pane">
        <div style="padding: 12px 16px 0 16px;">
          <div class="button-group" id="scenario_selector" style="margin-bottom: 8px;">
            <button class="group-btn active" data-val="vacuum">Vacuum</button>
            <button class="group-btn" data-val="atmosphere">Atmosphere</button>
            <button class="group-btn" data-val="nozzle">Engine Bell</button>
            <button class="group-btn" data-val="ocean">Ocean</button>
          </div>
          <div class="deck-row" style="margin-bottom: -4px;">
            <button id="btn_toggle_left" class="action-btn" style="border-radius: 8px 0 0 0; background: var(--pf-bg-input); border-right: none; font-size: 11px;">👁 Macro</button>
            <button id="btn_toggle_right" class="action-btn" style="border-radius: 0 8px 0 0; background: var(--pf-bg-input); font-size: 11px;">🕳 Entropic</button>
          </div>
        </div>

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

        <!-- Control Deck UI -->
        <div id="control-deck">
          <div class="segment-container">
            <button class="segment-btn active" data-mode="move">🖐 Move</button>
            <button class="segment-btn" data-mode="place">✏️ Place</button>
            <button class="segment-btn" data-mode="sample">🔍 Sample</button>
          </div>

          <!-- Place Context Menu -->
          <div id="context_place" class="context-popup">
            <div class="deck-row">
              <span class="sub-label">Tool Mode:</span>
              <div class="button-group" id="injection_mode_selector">
                <button class="group-btn active" data-val="clone">Clone</button>
                <button class="group-btn" data-val="quanta">Density</button>
                <button class="group-btn" data-val="heat">Heat</button>
                <button class="group-btn" data-val="spin">Momentum</button>
              </div>
            </div>
            <div class="deck-row" style="margin-top: 6px;">
              <span class="sub-label">Palette:</span>
              <div id="brush_selector" class="palette-grid"></div>
            </div>
          </div>

          <!-- Sample Context Menu -->
          <div id="context_sample" class="context-popup">
            <div class="deck-row">
              <span class="sub-label">Radius: <span id="val_radius">10</span>px</span>
              <input type="range" id="slider_radius" min="1" max="50" value="10" class="slider-fill">
            </div>
          </div>

          <!-- Sliders and Core Buttons -->
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

          <div class="button-group" style="margin-top: 8px;">
            <button id="btn_reset" class="group-btn">Reset</button>
            <button id="btn_soup" class="group-btn">Randomize</button>
            <button id="btn_clear" class="group-btn">Clear</button>
            <button id="btn_undo" class="group-btn">Undo</button>
          </div>
        </div>
      </div>

      <!-- Telemetry Sidebar -->
      <div id="sidebar">
        <div class="telemetry-box">
          <div class="telemetry-label">Status</div>
          <div id="diag_status" class="telemetry-value">BOOTING</div>
        </div>
        <div class="telemetry-box">
          <div class="telemetry-label">Nodes</div>
          <div id="diag_nodes" class="telemetry-value">160,000</div>
        </div>
        <div class="telemetry-box">
          <div class="telemetry-label">Total Quanta</div>
          <div id="diag_quanta" class="telemetry-value">0</div>
        </div>
        <div class="telemetry-box">
          <div class="telemetry-label">Total Heat</div>
          <div id="diag_heat" class="telemetry-value">0</div>
        </div>
        <div class="telemetry-box">
          <div class="telemetry-label">Phase Alignment</div>
          <div id="diag_phase" class="telemetry-value">0.0%</div>
        </div>
        <div class="telemetry-box">
          <div class="telemetry-label">Yield</div>
          <div id="diag_yield" class="telemetry-value">0</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Unscoped so imported rules apply to all children */
@import '../wake/style.css';

.wake-sandbox {
  margin: 1.5rem 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  background: #0a0e0a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}
</style>
