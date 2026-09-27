#include <stdint.h>
#include <stdlib.h>
#include <emscripten.h>

#define BUILD_VERSION 110 
#define WIDTH 400
#define HEIGHT 400
#define PIXEL_COUNT (WIDTH * HEIGHT)

// The Quantum Lattice Node
typedef struct {
    uint8_t quanta;  
    uint8_t spin;    
    uint16_t heat;   
} PlanckNode;

PlanckNode* grid_read;
PlanckNode* grid_write;
uint8_t pixel_buffer[PIXEL_COUNT * 4];

// Physical Constants 
uint8_t KNOB_DISSIPATION = 15; 
uint16_t KNOB_THERMAL_LIMIT = 1200;

// Vector Mapping for Absolute Causality
const uint8_t DIR_MAP[3][3] = {
    {8, 1, 2},
    {7, 0, 3},
    {6, 5, 4}
};
const uint8_t INV_DIR[9] = {0, 5, 6, 7, 8, 1, 2, 3, 4};

// ---------------------------------------------------------
// Observable Telemetry
// ---------------------------------------------------------
double obs_total_quanta = 0;
double obs_total_heat = 0;

EMSCRIPTEN_KEEPALIVE double get_total_quanta() { return obs_total_quanta; }
EMSCRIPTEN_KEEPALIVE double get_total_heat() { return obs_total_heat; }

// ---------------------------------------------------------
// Engine Diagnostics & Environment Setters
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE int get_engine_version() { return BUILD_VERSION; }
EMSCRIPTEN_KEEPALIVE int get_grid_width() { return WIDTH; }
EMSCRIPTEN_KEEPALIVE int get_grid_height() { return HEIGHT; }
EMSCRIPTEN_KEEPALIVE uint8_t* get_pixel_buffer_pointer() { return pixel_buffer; }

EMSCRIPTEN_KEEPALIVE void set_dissipation(int rate) { KNOB_DISSIPATION = (uint8_t)rate; }
EMSCRIPTEN_KEEPALIVE void set_thermal_limit(int limit) { KNOB_THERMAL_LIMIT = (uint16_t)limit; }

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
        grid_read[i].quanta = 0; grid_read[i].spin = 0; grid_read[i].heat = 0;
        pixel_buffer[i*4+0] = 0; pixel_buffer[i*4+1] = 0; pixel_buffer[i*4+2] = 0; pixel_buffer[i*4+3] = 255;
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
// Surgical API: The JS/Wasm Dimensional Injection
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void set_node(int x, int y, int injected_quanta) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || injected_quanta <= 0) return;
    int idx = y * WIDTH + x;
    
    int new_quanta = grid_read[idx].quanta + injected_quanta;
    grid_read[idx].quanta = (new_quanta > 255) ? 255 : new_quanta; 
    
    grid_read[idx].heat += injected_quanta * 25; 
    grid_read[idx].spin = (rand() % 8) + 1;
}

EMSCRIPTEN_KEEPALIVE
int get_node(int x, int y) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
    return grid_read[y * WIDTH + x].quanta;
}

// ---------------------------------------------------------
// The Planck Field Physics Engine (Math Only, No Render)
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void tick() {
    double frame_quanta = 0;
    double frame_heat = 0;

    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            int idx = y * WIDTH + x;
            PlanckNode current = grid_read[idx];
            
            int heat_sum = 0;
            int max_heat = -1;
            uint8_t gravity_spin = current.spin;
            uint8_t nuclear_spin = 0;
            
            int incoming_quanta = 0;
            int mom_x = 0; 
            int mom_y = 0;

            // 1. Scan Local Neighborhood
            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    
                    int nx = (x + dx + WIDTH) % WIDTH;
                    int ny = (y + dy + HEIGHT) % HEIGHT;
                    PlanckNode neighbor = grid_read[ny * WIDTH + nx];

                    uint8_t n_dir = DIR_MAP[dy+1][dx+1];
                    uint8_t req_spin = INV_DIR[n_dir];

                    // Perfect Integer Diffusion
                    heat_sum += neighbor.heat / 9;

                    // True Relational Mass Transfer (p = mv)
                    if (neighbor.quanta > 0 && neighbor.spin == req_spin) {
                        incoming_quanta += neighbor.quanta; // Receive ALL quanta
                        mom_x -= (dx * neighbor.quanta);    // Scale vector by mass
                        mom_y -= (dy * neighbor.quanta);
                    }

                    // Gravity
                    if (neighbor.heat > max_heat) {
                        max_heat = neighbor.heat;
                        gravity_spin = n_dir;
                    }
                    
                    // Strong Nuclear Force
                    if (neighbor.quanta > 150) {
                        nuclear_spin = (n_dir + 2 > 8) ? (n_dir + 2 - 8) : (n_dir + 2);
                    }
                }
            }

            // 2. Process Mass (Quanta)
            int next_quanta = current.quanta;
            if (current.quanta > 0 && current.spin != 0) {
                next_quanta = 0; // All quanta vacate the cell instantly
            }
            next_quanta += incoming_quanta; 
            if (next_quanta > 255) next_quanta = 255; 

            // 3. Resolve Momentum & Collisions
            int x_dir = (mom_x > 0) - (mom_x < 0); 
            int y_dir = (mom_y > 0) - (mom_y < 0);
            uint8_t dominant_spin = DIR_MAP[y_dir + 1][x_dir + 1];
            
            int kinetic_heat = 0;
            if (incoming_quanta > 0 && dominant_spin == 0) {
                kinetic_heat = incoming_quanta * 10; // True head-on collision
            }

            // 4. Process Thermodynamics
            int kept_heat = current.heat - 8 * (current.heat / 9);
            int next_heat = kept_heat + heat_sum + kinetic_heat;
            
            // Mass inherently warps the field (radiates tension)
            next_heat += (next_quanta * 15); 
            
            // Stefan-Boltzmann / Planck radiation approximation.
            // Radiation scales non-linearly with temperature, and escapes 
            // strictly in quantized packets of size (KNOB_DISSIPATION).
            int temp_scalar = next_heat / 200; 
            int quantum_packets_emitted = 1 + (temp_scalar * temp_scalar); 
            int heat_loss = quantum_packets_emitted * KNOB_DISSIPATION;
            
            next_heat -= heat_loss;
            if (next_heat < 0) next_heat = 0;
            
            // E = mc^2 (Thermal Limit Annihilation)
            if (next_heat > KNOB_THERMAL_LIMIT && next_quanta > 0) {
                next_heat += (next_quanta * 80); 
                next_quanta = 0;
                dominant_spin = 0;
            }

            // 5. Hierarchy of Vector Forces
            uint8_t next_spin = dominant_spin; 
            
            if (max_heat > (KNOB_THERMAL_LIMIT / 4)) {
                next_spin = gravity_spin; 
            }
            if (nuclear_spin > 0 && next_quanta > 0) {
                next_spin = nuclear_spin; 
            }
            if (max_heat < 10 && next_quanta > 0 && (rand() % 100 < 2)) {
                next_spin = (rand() % 8) + 1; 
            }
            
            // 6. Write to Grid
            grid_write[idx].quanta = next_quanta;
            grid_write[idx].heat = next_heat;
            grid_write[idx].spin = next_spin;
            
            // Log Telemetry
            frame_quanta += next_quanta;
            frame_heat += next_heat;
        }
    }

    obs_total_quanta = frame_quanta;
    obs_total_heat = frame_heat;

    PlanckNode* temp = grid_read;
    grid_read = grid_write;
    grid_write = temp;
}

// ---------------------------------------------------------
// Disconnected Renderer (Called from JS)
// ---------------------------------------------------------

EMSCRIPTEN_KEEPALIVE
void render_frame(int layer) {
    for (int i = 0; i < PIXEL_COUNT; i++) {
        int px_idx = i * 4;
        int next_quanta = grid_read[i].quanta;
        int next_heat = grid_read[i].heat;

        if (layer == 0) { 
            // LAYER 0: MACRO VIEW (Raw Mass)
            if (next_quanta > 150) { 
                pixel_buffer[px_idx + 0] = 0; 
                pixel_buffer[px_idx + 1] = 255; 
                pixel_buffer[px_idx + 2] = 255;
            } else {
                uint8_t color = (next_quanta > 0) ? 255 : 0;
                pixel_buffer[px_idx + 0] = color; 
                pixel_buffer[px_idx + 1] = color; 
                pixel_buffer[px_idx + 2] = color;
            }
            pixel_buffer[px_idx + 3] = 255;
            
        } else { 
            // LAYER 1: METABOLIC VIEW (Blackbody Heat Radiation)
            uint8_t r = 0, g = 0, b = 0;
            
            if (next_heat < 100) {
                // Cold vacuum: Deep Purple/Blue
                r = next_heat;
                b = (next_heat * 2 > 255) ? 255 : next_heat * 2;
            } else if (next_heat < 400) {
                // Warming up: Red to Orange
                r = (next_heat > 255) ? 255 : next_heat;
                g = (next_heat - 100) / 2;
            } else {
                // Supernova: Yellow to Blinding White
                r = 255;
                g = 150 + (next_heat - 400) / 4;
                if (g > 255) g = 255;
                b = (next_heat - 400) / 2;
                if (b > 255) b = 255;
            }
            
            pixel_buffer[px_idx + 0] = r; 
            pixel_buffer[px_idx + 1] = g; 
            pixel_buffer[px_idx + 2] = b;
            pixel_buffer[px_idx + 3] = 255;
        }
    }
}
