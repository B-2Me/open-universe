/* test_atten.c — wave attenuation vs ambient density.
 * A single-channel +x axial pulse (self-coherent per M47c — it cannot
 * self-scatter) is fired into a box seeded with a uniform dilute gas
 * at rho_amb quanta/site. Any loss of coherent +x population is pure
 * ambient interaction: congestion drag parking (absorption) or
 * collisional scatter off the channel.
 *
 * usage: atten <ticks>
 * Prints beam-channel population vs tick for rho in {0,1,2,4,8},
 * plus event-counter decomposition (park vs drain vs emit).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

int      meso3i_init(int w, int h, int d, int axial);
void     meso3i_clear(void);
int      meso3i_nch(void);
int      meso3i_cvc(int c, int k);
void     meso3i_tick(void);
uint8_t  meso3i_get(int x, int y, int z, int c);
void     meso3i_set(int x, int y, int z, int c, uint8_t v);
void     meso3i_collmode(int);
void     meso3i_friction(int);
void     meso3i_fricmode(int);
void     meso3i_lat(int);
void     meso3i_drest(int);
void     meso3i_drain_edge(int);
double   meso3i_ev(int k);
void     meso3i_ev_reset(void);

#define W 72
#define H 72
#define D 36
#define BX 6
#define CB 12          /* +x axial channel index (face-diagonals are 0..11) */

static int NCH, NMOV;
static int CV[18][3];

static int cpos = -1;  /* channel index of the +x axial */

static void seed_ambient(int rho) {
    /* deterministic spread: round-robin rho quanta over channels */
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        for (int r = 0; r < rho; r++) {
            int c = (x * 7 + y * 11 + z * 13 + r * 5) % NMOV;
            meso3i_set(x, y, z, c, meso3i_get(x, y, z, c) + 1);
        }
    }
}

static void fire_pulse(int q) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
        meso3i_set(BX, y, z, cpos, meso3i_get(BX, y, z, cpos) + q);
}

static uint64_t beam_pop(void) {
    uint64_t n = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++)
        n += meso3i_get(x, y, z, cpos);
    return n;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 60;
    if (meso3i_init(W, H, D, 1)) return 1;
    NCH = meso3i_nch(); NMOV = NCH - 1;
    for (int c = 0; c < NMOV; c++)
        for (int k = 0; k < 3; k++) CV[c][k] = meso3i_cvc(c, k);
    for (int c = 0; c < NMOV; c++)
        if (CV[c][0] == 2 && CV[c][1] == 0 && CV[c][2] == 0) cpos = c;
    if (cpos < 0) { fprintf(stderr, "no +x axial channel\n"); return 1; }
    printf("+x axial channel = %d\n", cpos);
    printf("rho |   t  | beam_pop | park(cum) | drain(cum) | emit(cum)\n");

    for (int ri = 0; ri < 5; ri++) {
        int rho = (int[]){0, 1, 2, 4, 8}[ri];
        meso3i_clear();
        meso3i_collmode(0); meso3i_friction(8); meso3i_fricmode(-4);
        meso3i_lat(1); meso3i_drest(0);
        meso3i_ev_reset();
        seed_ambient(rho);
        fire_pulse(32);
        uint64_t p0 = beam_pop();
        for (int t = 0; t <= ticks; t++) {
            if (t % 5 == 0)
                printf(" %d  | %3d  | %8llu (%5.1f%%) | %9.0f | %10.0f | %9.0f\n",
                       rho, t, (unsigned long long)beam_pop(),
                       100.0 * beam_pop() / p0,
                       meso3i_ev(0), meso3i_ev(4), meso3i_ev(2));
            meso3i_drain_edge(3); meso3i_tick();
        }
        printf("\n");
    }
    return 0;
}
