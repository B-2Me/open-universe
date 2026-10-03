import {
    GRID_WIDTH,
    GRID_HEIGHT,
    DISSIPATION_DEFAULT,
    DISSIPATION_NOZZLE,
    THERMAL_LIMIT_DEFAULT,
    THERMAL_LIMIT_ENGINE_BELL,
    QUANTA_ANCHOR_WALL,
    QUANTA_OCEAN_WATER,
    QUANTA_COSMIC_DUST,
    QUANTA_GAS_MIN,
    QUANTA_GAS_VARIANCE,
    SPIN_STATIONARY,
    SPIN_FLUID_A,
    SPIN_FLUID_B,
    HEAT_ABSOLUTE_ZERO,
    HEAT_COLD_WATER,
    HEAT_GEOTHERMAL_CRUST,
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
                bridge.setNodeState(rx, ry, packNode(QUANTA_COSMIC_DUST, spin, 1000));
            }
            break;
        }

        case "atmosphere": {
            targetDissipation = DISSIPATION_DEFAULT;
            targetThermal = THERMAL_LIMIT_DEFAULT;
            for (let y = 0; y < GRID_HEIGHT; y++) {
                const depthRatio = y / GRID_HEIGHT;
                const prob = Math.pow(depthRatio, 2.5) * 25;
                const localHeat = Math.floor(50 + Math.pow(depthRatio, 2) * 14000);

                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (y < 4) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ABSOLUTE_ZERO));
                    } else if (y >= GRID_HEIGHT - 4) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_GEOTHERMAL_CRUST));
                    } else if (Math.random() * 100 < prob) {
                        const q = QUANTA_GAS_MIN + Math.floor(Math.random() * QUANTA_GAS_VARIANCE);
                        const s = ((x + y) % 2 === 0) ? SPIN_FLUID_A : SPIN_FLUID_B;
                        bridge.setNodeState(x, y, packNode(q, s, localHeat));
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
                    if (y > GRID_HEIGHT - 10) {
                        bridge.setNodeState(x, y, packNode(QUANTA_ANCHOR_WALL, SPIN_STATIONARY, HEAT_ROOM_AMBIENT));
                    } else if (y > GRID_HEIGHT - 150) {
                        const s = ((x + y) % 2 === 0) ? SPIN_FLUID_A : SPIN_FLUID_B;
                        bridge.setNodeState(x, y, packNode(QUANTA_OCEAN_WATER, s, HEAT_COLD_WATER));
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
