import {
    GRID_WIDTH,
    GRID_HEIGHT,
    DISSIPATION_DEFAULT,
    DISSIPATION_NOZZLE,
    THERMAL_LIMIT_DEFAULT,
    THERMAL_LIMIT_ENGINE_BELL,
    QUANTA_ANCHOR_WALL,
    SPIN_STATIONARY,
    SPIN_UP,
    SPIN_DOWN,
    SPIN_RIGHT,
    SPIN_LEFT,
    HEAT_ABSOLUTE_ZERO,
    HEAT_COLD_WATER,
    HEAT_ROOM_AMBIENT,
    HEAT_VACUUM_CORE,
    packNode
} from './constants.js';

export const SCENARIO_DOSSIERS = {
    vacuum: {
        title: "🌌 Vacuum Core",
        objective: "Study cold cosmic baseline entropy and high-energy topological mass deadlocks.",
        mechanisms: "CMB floor dissipation, zero-friction dispersion, and topological unwinding.",
        recommendedBrushes: ["🔥 Igniter", "⚙️ Rotor"],
        bestLayers: "👁 Macro + 🕳 Entropic",
        tips: "Drop an Igniter adjacent to the central knot to trigger a topological yield cascade."
    },
    atmosphere: {
        title: "🪐 Atmosphere",
        objective: "Barometric hydrostatic equilibrium and convective updrafts.",
        mechanisms: "Exponential density gradient, thermal buoyancy, and soft kinetic collisions.",
        recommendedBrushes: ["💨 Gas", "🔥 Igniter"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Stamp hot Gas or Igniters at the bedrock boundary to trigger buoyant atmospheric convection columns."
    },
    nozzle: {
        title: "🚀 Engine Bell (Global)",
        objective: "Macro fluid expansion through a converging-diverging de Laval rocket nozzle.",
        mechanisms: "Choked throat flow, oblique shock boundaries, and separation eddies.",
        recommendedBrushes: ["🔥 Igniter", "🧱 Wall"],
        bestLayers: "👁 Macro + 🧲 Phase",
        tips: "Inject high-heat plasma at the nozzle throat to see expansion shocks form along the bell contour."
    },
    boundary: {
        title: "🔬 Nozzle Wall (Micro-Patch)",
        objective: "Sub-millimeter boundary layer shear and acoustic wall quenching.",
        mechanisms: "1-node acoustic backscatter, viscous boundary layer deceleration, and turbulence peeling.",
        recommendedBrushes: ["🔥 Igniter", "💧 Fluid", "🧊 Cryo"],
        bestLayers: "♨ Metabolic + 🧲 Phase",
        tips: "Watch supersonic flow scrape along the vertical solid wall on the left. Cryo coolants reveal thermal quenching."
    },
    ocean: {
        title: "🌊 Deep Ocean",
        objective: "Resting incompressible fluid dynamics, wave propagation, and thermohaline convection.",
        mechanisms: "Low-entropy hydrostatic basin, momentum shunting, and thermal vent buoyancy.",
        recommendedBrushes: ["💧 Fluid", "🔥 Igniter"],
        bestLayers: "👁 Macro + ♨ Metabolic",
        tips: "Drop Fluid from above to observe splash ripples, or place an Igniter on the seabed to create a hydrothermal plume."
    }
};

export function loadScenario(type, bridge) {
    bridge.clearGrid();

    let targetDissipation = DISSIPATION_DEFAULT;
    let targetThermal = THERMAL_LIMIT_DEFAULT;
    const cx = Math.floor(GRID_WIDTH / 2);
    const cy = Math.floor(GRID_HEIGHT / 2);

    switch (type) {
        case "vacuum": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            // Central core knot
            for (let y = cy - 10; y <= cy + 10; y++) {
                for (let x = cx - 10; x <= cx + 10; x++) {
                    if (Math.hypot(x - cx, y - cy) <= 8) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_VACUUM_CORE));
                    }
                }
            }
            // Ambient dust
            for (let i = 0; i < 200; i++) {
                const rx = Math.floor(Math.random() * GRID_WIDTH);
                const ry = Math.floor(Math.random() * GRID_HEIGHT);
                const spin = Math.floor(Math.random() * 8) + 1;
                bridge.setNodeState(rx, ry, packNode(60, spin, 800));
            }
            break;
        }

        case "atmosphere": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            
            for (let y = 0; y < GRID_HEIGHT; y++) {
                const depth = y / GRID_HEIGHT;
                const densityProb = Math.pow(depth, 1.8) * 65;
                const airQuanta = 2 + Math.floor(depth * 3);
                const localHeat = Math.floor(30 + Math.pow(depth, 2) * 1200);

                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (y < 3) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ABSOLUTE_ZERO));
                    } else if (y >= GRID_HEIGHT - 3) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 800));
                    } else if (Math.random() * 100 < densityProb) {
                        const spin = Math.floor(Math.random() * 8) + 1;
                        bridge.setNodeState(x, y, packNode(airQuanta, spin, localHeat));
                    }
                }
            }
            break;
        }

        case "ocean": {
            // Massive heat sink and maximum containment to survive brush collisions
            targetDissipation = 45; 
            targetThermal = 65000;  
            
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (y >= GRID_HEIGHT - 4) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    } else if (y > GRID_HEIGHT - 160) {
                        bridge.setNodeState(x, y, packNode(40, SPIN_STATIONARY, HEAT_COLD_WATER));
                    }
                }
            }
            break;
        }

        case "nozzle": {
            targetDissipation = DISSIPATION_NOZZLE;
            targetThermal = THERMAL_LIMIT_ENGINE_BELL;
            for (let y = 50; y < GRID_HEIGHT; y++) {
                const depth = y - 50;
                const spread = 15 + Math.floor((depth * depth) / 250);
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (x < cx - spread || x > cx + spread) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    }
                }
            }
            break;
        }

        case "boundary": {
            // High-magnification micro-patch of the engine wall
            targetDissipation = DISSIPATION_NOZZLE;
            targetThermal = THERMAL_LIMIT_ENGINE_BELL;
            
            for (let y = 0; y < GRID_HEIGHT; y++) {
                // Left 60 pixels: Solid wall boundary with thermal sink
                for (let x = 0; x < 60; x++) {
                    bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                }
                // Right side: supersonic sheared gas stream flowing downwards
                for (let x = 60; x < GRID_WIDTH; x++) {
                    if (Math.random() < 0.6) {
                        const distFromWall = x - 60;
                        const spin = (distFromWall < 8 && Math.random() < 0.4) ? SPIN_STATIONARY : SPIN_DOWN;
                        const heat = 5000 + Math.floor(Math.random() * 8000);
                        bridge.setNodeState(x, y, packNode(25, spin, heat));
                    }
                }
            }
            break;
        }
    }

    bridge.setDissipation(targetDissipation);
    bridge.setThermalLimit(targetThermal);
    return { targetDissipation, targetThermal };
}

export function randomizeScenarioSoup(type, bridge) {
    bridge.clearGrid();
    const cx = Math.floor(GRID_WIDTH / 2);
    const flavor = Math.floor(Math.random() * 3);

    switch (type) {
        case "vacuum": {
            if (flavor === 0) {
                // Nebula Clusters
                for (let c = 0; c < 3; c++) {
                    const nx = 50 + Math.random() * (GRID_WIDTH - 100);
                    const ny = 50 + Math.random() * (GRID_HEIGHT - 100);
                    for (let i = 0; i < 150; i++) {
                        const rx = nx + (Math.random() * 40 - 20);
                        const ry = ny + (Math.random() * 40 - 20);
                        bridge.setNodeState(rx, ry, packNode(80, Math.floor(Math.random() * 8) + 1, 15000));
                    }
                }
            } else if (flavor === 1) {
                // Asteroid Field
                for (let c = 0; c < 15; c++) {
                    const nx = Math.floor(Math.random() * GRID_WIDTH);
                    const ny = Math.floor(Math.random() * GRID_HEIGHT);
                    bridge.setNodeState(nx, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx + 1, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx, ny + 1, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                }
            } else {
                // Cosmic Dust Drift
                for (let i = 0; i < 500; i++) {
                    const rx = Math.random() * GRID_WIDTH;
                    const ry = Math.random() * GRID_HEIGHT;
                    bridge.setNodeState(rx, ry, packNode(50, SPIN_RIGHT, 3000));
                }
            }
            break;
        }

        case "atmosphere": {
            loadScenario("atmosphere", bridge);
            if (flavor === 0) {
                // Thermal Updraft Column
                for (let y = GRID_HEIGHT - 6; y > 30; y--) {
                    for (let x = cx - 8; x < cx + 8; x++) {
                        if (Math.random() > 0.3) bridge.setNodeState(x, y, packNode(6, SPIN_UP, 35000));
                    }
                }
            } else if (flavor === 1) {
                // Wind Shear Bands
                for (let y = 20; y < GRID_HEIGHT - 10; y += 40) {
                    const dir = (y % 80 === 20) ? SPIN_RIGHT : SPIN_LEFT;
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (Math.random() < 0.6) bridge.setNodeState(x, y, packNode(8, dir, 1500));
                    }
                }
            } else {
                // Warm Thermal Pockets
                for (let i = 0; i < 16; i++) {
                    const rx = Math.floor(Math.random() * (GRID_WIDTH - 20));
                    const ry = Math.floor(100 + Math.random() * (GRID_HEIGHT - 150));
                    for (let dy = 0; dy < 6; dy++) {
                        for (let dx = 0; dx < 6; dx++) {
                            bridge.setNodeState(rx + dx, ry + dy, packNode(8, SPIN_UP, 22000));
                        }
                    }
                }
            }
            break;
        }

        case "nozzle": {
            loadScenario("nozzle", bridge);
            if (flavor === 0) {
                // Continuous Core Ignition
                for (let y = 50; y < GRID_HEIGHT - 10; y++) {
                    for (let x = cx - 4; x <= cx + 4; x++) {
                        bridge.setNodeState(x, y, packNode(140, SPIN_DOWN, 60000));
                    }
                }
            } else if (flavor === 1) {
                // Pre-Ignition Sparks
                for (let i = 0; i < 40; i++) {
                    const rx = cx + (Math.random() * 24 - 12);
                    const ry = 60 + Math.random() * 60;
                    bridge.setNodeState(rx, ry, packNode(180, Math.floor(Math.random() * 8) + 1, 65000));
                }
            } else {
                // Asymmetric Wall Flare
                const side = Math.random() > 0.5 ? cx - 12 : cx + 12;
                for (let y = 60; y < 110; y++) {
                    bridge.setNodeState(side, y, packNode(180, SPIN_DOWN, 65000));
                }
            }
            break;
        }

        case "boundary": {
            loadScenario("boundary", bridge);
            if (flavor === 0) {
                // Violent Wall Hotspot / Ablation
                for (let y = 100; y < 140; y++) {
                    for (let x = 40; x < 70; x++) {
                        bridge.setNodeState(x, y, packNode(120, SPIN_DOWN, 60000));
                    }
                }
            } else if (flavor === 1) {
                // Severe Acoustic Boundary Backscatter
                for (let y = 50; y < GRID_HEIGHT - 50; y += 15) {
                    for (let dx = 0; dx < 8; dx++) {
                        bridge.setNodeState(60 + dx, y, packNode(140, SPIN_UP, 45000));
                    }
                }
            } else {
                // Boundary Layer Separation Vortex
                for (let y = 180; y < 220; y++) {
                    for (let x = 65; x < 100; x++) {
                        bridge.setNodeState(x, y, packNode(35, SPIN_UP, 12000));
                    }
                }
            }
            break;
        }

        case "ocean": {
            loadScenario("ocean", bridge);
            if (flavor === 0) {
                // Deep Vent Plumes
                const v1 = cx - 50;
                const v2 = cx + 50;
                for (let y = GRID_HEIGHT - 6; y > GRID_HEIGHT - 70; y--) {
                    if (Math.random() > 0.25) bridge.setNodeState(v1 + (Math.random() * 4 - 2), y, packNode(50, SPIN_UP, 40000));
                    if (Math.random() > 0.25) bridge.setNodeState(v2 + (Math.random() * 4 - 2), y, packNode(50, SPIN_UP, 40000));
                }
            } else if (flavor === 1) {
                // Deep Steady Current
                for (let y = GRID_HEIGHT - 90; y < GRID_HEIGHT - 50; y++) {
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (Math.random() < 0.35) bridge.setNodeState(x, y, packNode(45, SPIN_RIGHT, HEAT_COLD_WATER));
                    }
                }
            } else {
                // Surface Swell Waves
                for (let y = GRID_HEIGHT - 160; y < GRID_HEIGHT - 145; y++) {
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (Math.random() < 0.3) {
                            const spin = (x % 4 < 2) ? SPIN_RIGHT : SPIN_LEFT;
                            bridge.setNodeState(x, y, packNode(45, spin, 800));
                        }
                    }
                }
            }
            break;
        }
    }
}
