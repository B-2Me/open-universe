// test_bath.c — dilute beam through a medium (M8).
// Bath slab x in [25,95]: each cell gets q=q_bath with probability rho.
//   mode 0: static bath (s=0) — nothing else can reach x>=100, so any
//           mass there is provably probe-origin (accretion transmission).
//   mode 1: random-walk bath (s=rand) — moving flux background.
// Probe = single packet at (10,20,20) port1 fired at t=0.
// Metrics: first crossing tick at x>=100 (vacuum expectation ~90),
// lead packet state at crossing (mass growth, y/z deflection).
// Usage: test_bath <ticks> <rho_ppm> <q_bath> <q_probe> <mode> [seed]
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40
#define XB0 25
#define XB1 95
#define XDET 100

static uint32_t rs;
static uint32_t rnd(void) { rs ^= rs << 13; rs ^= rs >> 17; rs ^= rs << 5; return rs; }

int main(int argc, char **argv) {
    int ticks  = argc > 1 ? atoi(argv[1]) : 140;
    int rho    = argc > 2 ? atoi(argv[2]) : 1000;   // per-million
    int q_bath = argc > 3 ? atoi(argv[3]) : 3;
    int q_probe= argc > 4 ? atoi(argv[4]) : 5;
    int mode   = argc > 5 ? atoi(argv[5]) : 0;
    int seed   = argc > 6 ? atoi(argv[6]) : 12345;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);

    rs = (uint32_t)seed | 1u;
    int nplaced = 0;
    for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
            for (int x = XB0; x < XB1; x++) {
                if (rnd() % 1000000 < (uint32_t)rho) {
                    int s = mode ? 1 + (int)(rnd() % 12) : 0;
                    planck3_set_node((z * H + y) * W + x, q_bath, s, 0, 0, 0);
                    nplaced++;
                }
            }
    planck3_set_node((20 * H + 20) * W + 10, q_probe, 1, 0, 0, 0);
    planck3_prepare();

    printf("# test_bath mode=%d rho=%dppm q_bath=%d q_probe=%d seed=%d placed=%d\n",
           mode, rho, q_bath, q_probe, seed, nplaced);

    const Rec *st = (const Rec *)planck3_state_pointer();
    int first_cross = -1;
    for (int t = 0; t <= ticks; t++) {
        // report: any live cell with x>=XDET (probe-origin in mode 0)
        printf("t=%3d |", t);
        int ndet = 0;
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = XDET; x < W; x++) {
                    const Rec *nd = &st[(size_t)z * H * W + y * W + x];
                    if (nd->q + nd->b > 0) {
                        printf(" (%d,%d,%d):q%d,s%d", x, y, z, nd->q, nd->s);
                        ndet++;
                    }
                }
        if (ndet && first_cross < 0) first_cross = t;
        // leading-edge probe packet = max-x live cell with s!=0
        int lx = -1, lq = 0, lspin = 0;
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = W - 1; x >= 0; x--) {
                    const Rec *nd = &st[(size_t)z * H * W + y * W + x];
                    if (nd->q > 0 && nd->s != 0 && x > lx) { lx = x; lq = nd->q; lspin = nd->s; break; }
                }
        printf("  ndet=%d lead=(x%d):q%d,s%d\n", ndet, lx, lq, lspin);
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# first crossing at x>=%d: t=%d (vacuum expectation ~90)\n", XDET, first_cross);
    return 0;
}
