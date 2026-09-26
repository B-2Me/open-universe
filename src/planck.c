#include <stdint.h>
#include <stdlib.h>
#include <emscripten.h>

#define BUILD_VERSION 106 // Bumped for Quantum Lattice Architecture
#define WIDTH 400
#define HEIGHT 400
#define PIXEL_COUNT (WIDTH * HEIGHT)

// The Quantum Lattice Node (Exactly 4 bytes for perfect memory alignment)
typedef struct {
    uint8_t quanta;  // Discrete energy packets (0-255)
    uint8_t spin;    // Trajectory: 0=Idle, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW
    uint16_t heat;   // Local relational friction / gravity well
} PlanckNode;

// Grid and Render Buffers
PlanckNode* grid_read;
PlanckNode* grid_write;
uint8_t pixel_buffer[PIXEL_COUNT * 4];

// Physical Constants (Controlled by JS Dashboard)
uint8_t KNOB_DISSIPATION = 15;
uint16_t KNOB_THERMAL_LIMIT = 1200;
uint8_t RENDER_LAYER = 0; 

// Directional Lookup Tables for absolute causality
// Maps dy, dx (-1 to 1) to a Spin Direction (1-8)
const uint8_t DIR_MAP[3][3] = {
    {8, 1, 2},
    {7, 0, 3},
    {6, 5, 4}
};
// The inverse spin required for a neighbor to hit the center node
const uint8_t INV_DIR[9] = {0, 5, 6, 7, 8, 1, 2, 3, 4};

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
        grid_read[i].quanta = 0;
        grid_read[i].spin = 0;
        grid_read[i].heat = 0;
        
        pixel_buffer[i*4 + 0] = 0;
        pixel_buffer[i*4 + 1] = 0;
        pixel_buffer[i*4 + 2] = 0;
        pixel_buffer[i*4 + 3] = 255;
    }
}

EMSCRIPTEN_KEEPALIVE
void randomize_grid() {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        grid_read[i].quanta = (rand() % 100 < 5) ? 1 : 0;
        grid_read[i].spin = grid_read[i].quanta ? ((rand() % 8) + 1) : 0;
        grid_read[i].heat = grid_read[i].quanta * 100;
    }
}

// ---------------------------------------------------------
// Surgical API: The JS/Wasm Memory Bridge
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void set_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    int idx = y * WIDTH + x;
    grid_read[idx].quanta = 20; // Inject a dense cluster
    grid_read[idx].heat = KNOB_THERMAL_LIMIT / 2;
    grid_read[idx].spin = (rand() % 8) + 1;
}

EMSCRIPTEN_KEEPALIVE
int get_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    return (grid_read[y * WIDTH + x].quanta > 0) ? 1 : 0;
}

// ---------------------------------------------------------
// The Planck Field Physics Engine
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void tick() {
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            PlanckNode current = grid_read[idx];
            
            int heat_sum = current.heat;
            int max_heat = -1;
            uint8_t best_spin = current.spin;
            int incoming_quanta = 0;

            // 1. Scan Local Neighborhood
            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    
                    int nx = (x + dx + WIDTH) % WIDTH;
                    int ny = (y + dy + HEIGHT) % HEIGHT;
                    PlanckNode neighbor = grid_read[ny * WIDTH + nx];

                    uint8_t n_dir = DIR_MAP[dy+1][dx+1];
                    uint8_t req_spin = INV_DIR[n_dir];

                    // Zero-Sum Math: Did this neighbor shoot a quantum at us?
                    if (neighbor.quanta > 0 && neighbor.spin == req_spin) {
                        incoming_quanta++;
                    }

                    // Accumulate heat for diffusion
                    heat_sum += neighbor.heat;

                    // Gravity: Find the densest nearby mass
                    if (neighbor.heat > max_heat) {
                        max_heat = neighbor.heat;
                        best_spin = n_dir;
                    }
                }
            }

            // 2. Process Mass (Quanta)
            int next_quanta = current.quanta;
            if (current.quanta > 0 && current.spin != 0) {
                next_quanta--; // A quantum left this node
            }
            next_quanta += incoming_quanta; // Quanta arrived
            if (next_quanta > 255) next_quanta = 255; // Pauli Exclusion

            // 3. Process Thermodynamics (Diffusion & Dissipation)
            int avg_heat = heat_sum / 9;
            int next_heat = avg_heat + (next_quanta * 15) - KNOB_DISSIPATION;
            
            if (next_heat > KNOB_THERMAL_LIMIT) {
                // Bandwidth collapse (Overheat / Supernova)
                next_heat = 0;
                next_quanta = 0;
            } else if (next_heat < 0) {
                next_heat = 0;
            }

            // 4. Process Vector Geometry (Gravity & Orbits)
            uint8_t next_spin = best_spin;
            
            if (max_heat > (KNOB_THERMAL_LIMIT / 3)) {
                // Orbital Flexion: Extreme gravity bends trajectories 45 degrees
                next_spin = (best_spin % 8) + 1; 
            }
            
            if (max_heat == 0 || (rand() % 100 < 5)) {
                // Brownian noise in empty space
                next_spin = (next_quanta > 0) ? ((rand() % 8) + 1) : 0;
            }
            
            // Write physical state
            grid_write[idx].quanta = next_quanta;
            grid_write[idx].heat = next_heat;
            grid_write[idx].spin = next_spin;

            // 5. Optical Rendering
            int px_idx = idx * 4;
            if (RENDER_LAYER == 0) { 
                // Macro View: Render Mass
                if (next_quanta > 1) { 
                    // High density glows green
                    pixel_buffer[px_idx + 0] = 150;
                    pixel_buffer[px_idx + 1] = 255;
                    pixel_buffer[px_idx + 2] = 150;
                } else {
                    // Standard mass is white
                    uint8_t color = (next_quanta > 0) ? 255 : 0;
                    pixel_buffer[px_idx + 0] = color;
                    pixel_buffer[px_idx + 1] = color;
                    pixel_buffer[px_idx + 2] = color;
                }
                pixel_buffer[px_idx + 3] = 255;
            } else { 
                // Metabolic View: Render Thermal Exhaust
                uint8_t r = (next_heat > 255) ? 255 : next_heat;
                uint8_t g = (next_heat > 512) ? 255 : (next_heat / 2);
                pixel_buffer[px_idx + 0] = r; 
                pixel_buffer[px_idx + 1] = g; 
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
