#include <stdint.h>
#include <stdlib.h>
#include <emscripten.h>

#define BUILD_VERSION 105
#define WIDTH 400
#define HEIGHT 400
#define PIXEL_COUNT (WIDTH * HEIGHT)
#define MAX_EXHAUST 255

// The bare-metal node
typedef struct {
    uint8_t alive;   
    uint8_t exhaust; 
} PlanckNode;

// Grid and Render Buffers
PlanckNode* grid_read;
PlanckNode* grid_write;
uint8_t pixel_buffer[PIXEL_COUNT * 4];

// Physical Constants (Run-Time Variables)
uint8_t KNOB_DISSIPATION = 15;
uint16_t KNOB_THERMAL_LIMIT = 1200;
uint8_t RENDER_LAYER = 0; // 0 = Macro (Spatial), 1 = Metabolic (Thermal)

// ---------------------------------------------------------
// Engine Diagnostics & Environment Setters
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE int get_engine_version() { return BUILD_VERSION; }
EMSCRIPTEN_KEEPALIVE int get_grid_width() { return WIDTH; }
EMSCRIPTEN_KEEPALIVE int get_grid_height() { return HEIGHT; }
EMSCRIPTEN_KEEPALIVE uint8_t* get_pixel_buffer_pointer() { return pixel_buffer; }

EMSCRIPTEN_KEEPALIVE void set_dissipation(int rate) { KNOB_DISSIPATION = (uint8_t)rate; }
EMSCRIPTEN_KEEPALIVE void set_thermal_limit(int limit) { KNOB_THERMAL_LIMIT = (uint16_t)limit; }
EMSCRIPTEN_KEEPALIVE void set_render_layer(int layer) { RENDER_LAYER = (uint8_t)layer; }

// ---------------------------------------------------------
// Grid Initialization & Global Interventions
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void init_grid() {
    grid_read = calloc(PIXEL_COUNT, sizeof(PlanckNode));
    grid_write = calloc(PIXEL_COUNT, sizeof(PlanckNode));
}

EMSCRIPTEN_KEEPALIVE
void clear_grid() {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].alive = 0;
        grid_read[i].exhaust = 0;
        
        pixel_buffer[i*4 + 0] = 0;
        pixel_buffer[i*4 + 1] = 0;
        pixel_buffer[i*4 + 2] = 0;
        pixel_buffer[i*4 + 3] = 255;
    }
}

EMSCRIPTEN_KEEPALIVE
void randomize_grid() {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].alive = (rand() % 100 < 15) ? 1 : 0;
        grid_read[i].exhaust = grid_read[i].alive ? MAX_EXHAUST : 0;
    }
}

// ---------------------------------------------------------
// Surgical API: The JS/Wasm Memory Bridge
// ---------------------------------------------------------

// JavaScript calls this in a loop to inject arrays/clusters
EMSCRIPTEN_KEEPALIVE
void set_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    int idx = y * WIDTH + x;
    grid_read[idx].alive = 1;
    grid_read[idx].exhaust = MAX_EXHAUST;
}

// JavaScript calls this to sample/copy regions from the grid
EMSCRIPTEN_KEEPALIVE
int get_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    return grid_read[y * WIDTH + x].alive;
}

// ---------------------------------------------------------
// The Planck Field Physics Engine
// ---------------------------------------------------------

int get_live_neighbors(int x, int y, int* local_heat) {
    int alive_count = 0;
    *local_heat = 0;

    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) continue;

            // Toroidal wrap-around for infinite edge routing
            int nx = (x + dx + WIDTH) % WIDTH;
            int ny = (y + dy + HEIGHT) % HEIGHT;
            
            PlanckNode neighbor = grid_read[ny * WIDTH + nx];
            alive_count += neighbor.alive;
            *local_heat += neighbor.exhaust;
        }
    }
    return alive_count;
}

EMSCRIPTEN_KEEPALIVE
void tick() {
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            int local_heat = 0;
            int neighbors = get_live_neighbors(x, y, &local_heat);

            PlanckNode current = grid_read[idx];
            PlanckNode next_state = current;

            // 1. Macro Relational Rules (Conway Base)
            int next_alive = (current.alive && (neighbors == 2 || neighbors == 3)) || 
                             (!current.alive && neighbors == 3);

            // 2. Bandwidth Collapse (The c² Limit)
            if (local_heat > KNOB_THERMAL_LIMIT) {
                next_alive = 0; 
            }

            // 3. Thermodynamic Dissipation (Entropy)
            if (!current.alive && next_alive) {
                next_state.exhaust = MAX_EXHAUST; 
            } else if (current.exhaust > 0) {
                next_state.exhaust = (current.exhaust > KNOB_DISSIPATION) ? 
                                      current.exhaust - KNOB_DISSIPATION : 0;
            }

            next_state.alive = next_alive;
            grid_write[idx] = next_state;

            // 4. Write to Zero-Copy Pixel Buffer
            int px_idx = idx * 4;
            if (RENDER_LAYER == 0) { 
                uint8_t color = next_alive ? 255 : 0;
                pixel_buffer[px_idx + 0] = color;
                pixel_buffer[px_idx + 1] = color;
                pixel_buffer[px_idx + 2] = color;
                pixel_buffer[px_idx + 3] = 255;
            } else { 
                pixel_buffer[px_idx + 0] = next_state.exhaust; 
                pixel_buffer[px_idx + 1] = next_state.exhaust / 2; 
                pixel_buffer[px_idx + 2] = 0;
                pixel_buffer[px_idx + 3] = 255;
            }
        }
    }

    // Swap the physical memory buffers
    PlanckNode* temp = grid_read;
    grid_read = grid_write;
    grid_write = temp;
}
