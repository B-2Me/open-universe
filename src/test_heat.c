// test_heat.c — M18: can the h register act as a temporal-integrator
// detector? h dynamics: nh = ch - 12*(ch/18) + heatSum + kin + nq*15 —
// a 1/3-retention leaky integrator with spray trigger at
// g_thermal_limit=50000 (default canonical). Three measurements:
//
//   mode 0: single armed pixel (q=150,h=H0,s=0) hit by a maximal
//           probe train (q=160,s=1 every 2 ticks). Does h ever reach
//           50000 under sustained lawful influx?
//   mode 1: cascade geometry — N spray cells (q=150,h=65535) adjacent
//           to one armed pixel (q=150,h=H0). Do neighbors' sprays push
//           the pixel over? N = argv[3], H0 = argv[4].
//
// Prints h trace of the armed pixel + whether spray fired (q->0 dump).
// Usage: test_heat <ticks> <mode> [nspray] [h0]
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40
#define CY 20
#define CZ 20
#define PX 60          // armed pixel
#define EX 10          // emitter

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks  = argc > 1 ? atoi(argv[1]) : 60;
    int mode   = argc > 2 ? atoi(argv[2]) : 0;
    int nspray = argc > 3 ? atoi(argv[3]) : 1;
    int h0     = argc > 4 ? atoi(argv[4]) : 49999;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);

    planck3_set_node(idx(PX, CY, CZ), 150, 0, h0, 0, 0);   // armed pixel
    if (mode == 1)                                          // spray neighbors -x side
        for (int k = 0; k < nspray; k++)
            planck3_set_node(idx(PX - 1, CY - k, CZ), 150, 0, 65535, 0, 0);
    planck3_prepare();
    printf("# test_heat mode=%d nspray=%d h0=%d\n", mode, nspray, h0);

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    int sprayed = 0;
    for (int t = 0; t <= ticks; t++) {
        if (mode == 0 && t % 2 == 0 && t > 0)
            planck3_set_node(idx(EX, CY, CZ), 160, 1, 0, 0, 0);   // max train
        const Rec *px = &st[(size_t)CZ * H * W + CY * W + PX];
        if (t < 30 || t % 10 == 0) {
            printf("t=%3d | px: q%d h%u s%d b%d |", t, px->q, px->h, px->s, px->b);
            for (int x = PX - 2; x <= PX + 4; x++) {
                const Rec *r = &st[(size_t)CZ * H * W + CY * W + x];
                if (x != PX && (r->q || r->h > 2000 || r->s))
                    printf(" x%d:q%d,h%u,s%d,b%d", x, r->q, r->h, r->s, r->b);
            }
            printf("\n");
        }
        if (px->q == 0 && px->b == 0 && t > 0 && !sprayed)
            { sprayed = 1; printf("# PIXEL SPRAYED at t=%d\n", t); }
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) { drained += r->q + r->b; planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0); }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# sprayed=%d drained=%lld\n", sprayed, (long long)drained);
    return 0;
}
