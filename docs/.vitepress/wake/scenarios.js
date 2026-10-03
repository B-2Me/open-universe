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
            // Center Core Knot
            for (let y = cy - 10; y <= cy + 10; y++) {
                for (let x = cx - 10; x <= cx + 10; x++) {
                    if (Math.hypot(x - cx, y - cy) <= 8) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_VACUUM_CORE));
                    }
                }
            }
            // Ambient Dust
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
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (y >= GRID_HEIGHT - 4) {
                        // Bedrock floor
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    } else if (y > GRID_HEIGHT - 160) {
                        // Soft resting fluid: absorbs drops without exploding
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
                // Cosmic Dust Storm
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
                // Updraft Thermal Column
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
                // Core Ignition
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
