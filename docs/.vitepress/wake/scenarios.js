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
            for (let y = cy - 10; y <= cy + 10; y++) {
                for (let x = cx - 10; x <= cx + 10; x++) {
                    if (Math.hypot(x - cx, y - cy) <= 8) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_VACUUM_CORE));
                    }
                }
            }
            for (let i = 0; i < 200; i++) {
                const rx = Math.floor(Math.random() * GRID_WIDTH);
                const ry = Math.floor(Math.random() * GRID_HEIGHT);
                const spin = Math.floor(Math.random() * 8) + 1;
                bridge.setNodeState(rx, ry, packNode(80, spin, 1000));
            }
            break;
        }

        case "atmosphere": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            for (let y = 0; y < GRID_HEIGHT; y++) {
                const depth = y / GRID_HEIGHT;
                const densityProb = Math.pow(depth, 2.2) * 55;
                const airQuanta = Math.min(80, 2 + Math.floor(depth * 30));
                const localHeat = Math.floor(20 + Math.pow(depth, 1.8) * 600);

                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (y < 3) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ABSOLUTE_ZERO));
                    } else if (y >= GRID_HEIGHT - 3) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    } else if (Math.random() * 100 < densityProb) {
                        const spin = ((x + y) % 3 === 0) ? SPIN_STATIONARY : ((x % 2 === 0) ? SPIN_RIGHT : SPIN_LEFT);
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
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    } else if (y > GRID_HEIGHT - 160) {
                        const s = ((x + y) % 2 === 0) ? SPIN_RIGHT : SPIN_LEFT;
                        bridge.setNodeState(x, y, packNode(110, s, HEAT_COLD_WATER));
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
    const flavor = Math.floor(Math.random() * 3); // Picks 0, 1, or 2

    switch (type) {
        case "vacuum": {
            if (flavor === 0) {
                // Flavor 0: Nebula Clusters (Dense explosive pockets)
                for (let c = 0; c < 3; c++) {
                    let nx = 50 + Math.random() * (GRID_WIDTH - 100);
                    let ny = 50 + Math.random() * (GRID_HEIGHT - 100);
                    for (let i = 0; i < 150; i++) {
                        let rx = nx + (Math.random() * 40 - 20);
                        let ry = ny + (Math.random() * 40 - 20);
                        bridge.setNodeState(rx, ry, packNode(90, Math.floor(Math.random() * 8) + 1, 15000));
                    }
                }
            } else if (flavor === 1) {
                // Flavor 1: Asteroid Field (Floating deadlocked rocks)
                for (let c = 0; c < 15; c++) {
                    let nx = Math.floor(Math.random() * GRID_WIDTH);
                    let ny = Math.floor(Math.random() * GRID_HEIGHT);
                    bridge.setNodeState(nx, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx + 1, ny, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                    bridge.setNodeState(nx, ny + 1, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, 10));
                }
            } else {
                // Flavor 2: Uniform Cosmic Dust Storm
                for (let i = 0; i < 500; i++) {
                    let rx = Math.random() * GRID_WIDTH;
                    let ry = Math.random() * GRID_HEIGHT;
                    bridge.setNodeState(rx, ry, packNode(60, SPIN_RIGHT, 5000));
                }
            }
            break;
        }

        case "atmosphere": {
            loadScenario("atmosphere", bridge);
            if (flavor === 0) {
                // Flavor 0: Massive Thermal Updraft Column
                for (let y = GRID_HEIGHT - 5; y > 20; y--) {
                    for (let x = cx - 10; x < cx + 10; x++) {
                        if (Math.random() > 0.3) bridge.setNodeState(x, y, packNode(10, SPIN_UP, 45000));
                    }
                }
            } else if (flavor === 1) {
                // Flavor 1: Severe Horizontal Microbursts
                for (let y = 10; y < GRID_HEIGHT - 10; y++) {
                    let dir = (y % 40 < 20) ? SPIN_RIGHT : SPIN_LEFT;
                    if (Math.random() < 0.2) {
                        for (let x = 0; x < GRID_WIDTH; x++) {
                            if (Math.random() > 0.5) bridge.setNodeState(x, y, packNode(20, dir, 2000));
                        }
                    }
                }
            } else {
                // Flavor 2: Scattered Hot Air Pockets
                for (let i = 0; i < 20; i++) {
                    let rx = Math.random() * GRID_WIDTH;
                    let ry = Math.random() * GRID_HEIGHT;
                    bridge.setNodeState(rx, ry, packNode(30, Math.floor(Math.random() * 8) + 1, 30000));
                }
            }
            break;
        }

        case "nozzle": {
            loadScenario("nozzle", bridge);
            if (flavor === 0) {
                // Flavor 0: Smooth Steady Burn
                for (let y = 50; y < GRID_HEIGHT - 10; y++) {
                    for (let x = cx - 5; x <= cx + 5; x++) {
                        bridge.setNodeState(x, y, packNode(150, SPIN_DOWN, 60000));
                    }
                }
            } else if (flavor === 1) {
                // Flavor 1: Cold Start (Scattered explosive sparks)
                for (let i = 0; i < 50; i++) {
                    let rx = cx + (Math.random() * 20 - 10);
                    let ry = 60 + Math.random() * 50;
                    bridge.setNodeState(rx, ry, packNode(180, Math.floor(Math.random() * 8) + 1, 65000));
                }
            } else {
                // Flavor 2: Chamber Instability (Asymmetric wall strike)
                let side = Math.random() > 0.5 ? cx - 12 : cx + 12;
                for (let y = 60; y < 100; y++) {
                    bridge.setNodeState(side, y, packNode(200, SPIN_DOWN, 65000));
                }
            }
            break;
        }

        case "ocean": {
            loadScenario("ocean", bridge);
            if (flavor === 0) {
                // Flavor 0: Thermal Seafloor Vents
                let vent1 = cx - 50;
                let vent2 = cx + 50;
                for (let y = GRID_HEIGHT - 5; y > GRID_HEIGHT - 60; y--) {
                    if (Math.random() > 0.2) bridge.setNodeState(vent1 + (Math.random() * 4 - 2), y, packNode(120, SPIN_UP, 45000));
                    if (Math.random() > 0.2) bridge.setNodeState(vent2 + (Math.random() * 4 - 2), y, packNode(120, SPIN_UP, 45000));
                }
            } else if (flavor === 1) {
                // Flavor 1: Massive Deep Shearing Currents
                for (let y = GRID_HEIGHT - 120; y < GRID_HEIGHT - 20; y++) {
                    let dir = (y % 60 < 30) ? SPIN_RIGHT : SPIN_LEFT;
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (Math.random() < 0.3) bridge.setNodeState(x, y, packNode(140, dir, HEAT_COLD_WATER));
                    }
                }
            } else {
                // Flavor 2: High Surface Churn
                for (let y = GRID_HEIGHT - 160; y < GRID_HEIGHT - 130; y++) {
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (Math.random() < 0.4) bridge.setNodeState(x, y, packNode(110, Math.floor(Math.random() * 8) + 1, 5000));
                    }
                }
            }
            break;
        }
    }
}
