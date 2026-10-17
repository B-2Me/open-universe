// test_detector.c — metastable avalanche detector chain (M9).
// N primed cells (q=prime, s=0) at (60+i,20,20). A dilute probe packet
// hits the chain head along port1. Logs every live cell on the detector
// row per tick: cascade depth, ejected packet, cell re-arm state.
// Usage: test_detector <ticks> <prime> <q_probe> <n_chain> [spacing]
// spacing>=2 keeps primes congestion-isolated (adjacent primes
// congestion-divert each other into a self-firing chain — measured).
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

int main(int argc, char **argv) {
    int ticks   = argc > 1 ? atoi(argv[1]) : 120;
    int prime   = argc > 2 ? atoi(argv[2]) : 199;
    int q_probe = argc > 3 ? atoi(argv[3]) : 3;
    int nchain  = argc > 4 ? atoi(argv[4]) : 10;
    int spacing = argc > 5 ? atoi(argv[5]) : 3;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);

    for (int i = 0; i < nchain; i++)
        planck3_set_node((20 * H + 20) * W + 60 + i * spacing, prime, 0, 0, 0, 0);
    planck3_set_node((20 * H + 20) * W + 10, q_probe, 1, 0, 0, 0);
    planck3_prepare();

    printf("# test_detector prime=%d q_probe=%d nchain=%d\n", prime, q_probe, nchain);
    printf("# t | cells on detector row y=20,z=20 x in [55,110]\n");

    const Rec *st = (const Rec *)planck3_state_pointer();
    for (int t = 0; t <= ticks; t++) {
        printf("t=%3d |", t);
        for (int x = 55; x < 110; x++) {
            const Rec *nd = &st[(size_t)20 * H * W + 20 * W + x];
            if (nd->q > 0 || nd->b > 0)
                printf(" x%d:q%d,s%d,b%d", x, nd->q, nd->s, nd->b);
        }
        printf("\n");
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    return 0;
}
