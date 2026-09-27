---
title: Langevin's Wake
description: A bare-metal WebAssembly thermodynamic cellular automata engine.
outline: deep
audio: /audio/wake-demo.mp3
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "RESIZE_IFRAME") {
      const iframe = document.getElementById("wake-iframe");
      if (iframe) {
        iframe.style.height = event.data.height + "px";
      }
    }
  });
})
</script>

<style>
  .engine-frame {
    width: 100%;
    height: 800px; 
    border: none;
    display: block;
    background: #0a0e0a;
    transition: height 0.1s ease-out;
  }
  @media (max-width: 768px) {
    .engine-frame { height: 90vh; } 
  }
</style>

<div style="margin-top: 0; margin-bottom: 2rem; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.4);">
  <iframe id="wake-iframe" src="/wasm/wake/index.html?v=15" class="engine-frame" scrolling="no"></iframe>
</div>

# Langevin's Wake
*The Planck Field bare-metal simulation engine.*

Welcome to thermodynamic reality. What you are looking at is not a standard web canvas rendering frictionless geometric shapes. It is a 160,000-node physics grid running purely in C, calculating fundamental relational friction and directly mapping it to your graphics hardware via a zero-copy WebAssembly memory bridge. 

::: details ⚙️ Under the Hood: The Hardware Metaphor

### External Depth vs. Internal Depth
This sandbox is a literal manifestation of the Planck Field philosophy. 

**The C Engine (External Depth):** The physics loop is written in bare-metal C, compiled to WebAssembly with maximum hardware optimizations. The C code knows nothing about geometry, shapes, or user input. It exclusively calculates the relentless, microscopic accounting of thermodynamic friction, phase spins, and integer limits for all 160,000 nodes simultaneously.

**The JavaScript UI (Internal Depth):** The browser interface acts as the biological dashboard. JavaScript queries the chaotic thermal data from the Wasm memory block and compresses it into a clean, geometric visual matrix (the Macro layer). When you use the "Capture" tool, JavaScript is filtering the static, extracting relational boundaries, and defining it as "useful" geometry. The grid doesn't know it's a shape; only the UI does.

### The Objective Constraints
Unlike traditional cellular automata which rely on arbitrary "rules" of birth and death, this engine is strictly deterministic and rooted in physical constraints. It continuously calculates the following mechanics:

**1. Topological Unwinding ($E=mc^2$)**
Mass is a deadlocked knot of relational tension. When the localized heat of a node exceeds its structural capacity (`Thermal Saturation`), the topological deadlock unwinds. The total actualization yield instantly saturates the local grid, converting mass into thermal exhaust:
$$Y_{act} = (N_{nodes} \cdot \tau_{knot}) \times \Omega_{max}$$

**2. Phase Friction (Electromagnetism)**
Nodes possess a topological spin (chirality). When nodes interact, their Phase Friction ($\Phi$) is calculated based on their discrete spin angles ($\theta$):
$$\Phi = \tau(1 + \cos(\Delta \theta))$$
Opposite spins mesh perfectly, dropping friction to zero. Identical spins clash, generating a massive spike in metabolic dissipation. This tension naturally resolves down the path of least resistance, driving physical repulsion.

**3. Entropic Gravity**
Gravity is not an invisible geometric curve; it is the entropic gradient of the substrate. When local momentum is shunted by a deadlocked boundary, the grid resolves the tension by routing the quanta into the coolest adjacent locus:
$$F = T \frac{\Delta S}{\Delta x}$$

**4. Propagation Friction (Cosmological Redshift)**
Propagation incurs inevitable thermodynamic dissipation. Every time a quanta packet is handed off to an adjacent Planck node, it undergoes a baseline actualization friction. Light frequency degrades logarithmically across the active medium:
$$E_{received} = E_{emitted} e^{-\mu d}$$

**5. Stefan-Boltzmann Dissipation**
Localized relational friction continuously dissipates into the surrounding field. Nodes cool down proportionally to the square of their local temperature limit, dropping toward a minimum baseline floor (The Cosmic Microwave Background constraint).

### The Biological Swerve
While the grid is perfectly deterministic, **you** are the external biological interface. When you click the grid to inject a pattern, you are executing an intentional interference. You are actively altering the relational constraints of the substrate, forcing the physics engine to resolve your interference through a cascade of causal actualizations. 
:::
