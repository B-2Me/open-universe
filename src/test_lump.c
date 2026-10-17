// test_lump.c — probe packet vs stationary condensate lump (M7).
// Lump = s=0 q=q_target cell at C. Probe = single packet fired +x along
// port 1. mode 0: single shot. mode 1: stream — re-fire every <interval>
// ticks for <npulse> pulses. Drain at x=0 eats wrap-around traffic.
// Usage: test_lump <ticks> <mode> <q_target> <q_probe> [interval] [npulse]
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
#define CX 60
#define CY 20
#define CZ 20
#define EX 10

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks    = argc > 1 ? atoi(argv[1]) : 120;
    int mode     = argc > 2 ? atoi(argv[2]) : 0;
    int q_target = argc > 3 ? atoi(argv[3]) : 120;
    int q_probe  = argc > 4 ? atoi(argv[4]) : 80;
    int interval = argc > 5 ? atoi(argv[5]) : 5;
    int npulse   = argc > 6 ? atoi(argv[6]) : 30;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);

    planck3_set_node(idx(CX, CY, CZ), q_target, 0, 0, 0, 0);
    planck3_prepare();

    printf("# test_lump mode=%d q_target=%d q_probe=%d interval=%d npulse=%d\n",
           mode, q_target, q_probe, interval, npulse);
    printf("# C=(%d,%d,%d,s0) emitter=(%d,%d,%d,p1) drain=x0\n", CX, CY, CZ, EX, CY, CZ);
    printf("# t | live cells (x,y,z:q,s,b)\n");

    const Rec *st = (const Rec *)planck3_state_pointer();
    int fired = 0;
    for (int t = 0; t <= ticks; t++) {
        int doFire = (t == 0) || (mode == 1 && interval > 0 && t % interval == 0 && fired < npulse);
        if (doFire) { planck3_set_node(idx(EX, CY, CZ), q_probe, 1, 0, 0, 0); fired++; }

        printf("t=%3d |", t);
        int n = 0;
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    const Rec *nd = &st[(size_t)z * H * W + y * W + x];
                    if (nd->q > 0 || nd->b > 0) {
                        printf(" (%d,%d,%d):q%d,s%d,b%d", x, y, z, nd->q, nd->s, nd->b);
                        n++;
                    }
                }
        printf("  n=%d\n", n);

        // wrap drain: zero any mass that reaches x=0
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0);
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    return 0;
}
