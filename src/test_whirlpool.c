// test_whirlpool — driven dissipative-structure probe (Direction 2).
// Open flow-through: emitter line injects +x momentum every 4th tick
// (per AGENTS.md sustained-beam rule: q<=FLOW_CAP, >=4-tick spacing),
// drain plane downstream, optional curl induction ON.
//
// Question: does coherent driven flux self-organize structure (eddies,
// lumps, shear-layer rolls) where incoherent sea only erodes?
//
// metrics: total mass, mass in a mid-channel box, spin coherence
// (fraction of occupied cells whose spin is the drive port 1),
// max cell quanta (lump formation), #cells above q>=150.
//
// usage: whirl <ticks> <curldiv> <curlvac>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_set_curl(int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);

#define W 120
#define H 40
#define D 40
#define SRC_X 10          /* emitter column */
#define DRN_X 115         /* drain plane */
#define FLOW_CAP 64

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;
static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 400;
    int cdiv  = argc > 2 ? atoi(argv[2]) : 0;
    int cvac  = argc > 3 ? atoi(argv[3]) : 1;
    int coll  = argc > 4 ? atoi(argv[4]) : 0;   /* 1: counter-beam from x=W-11 (-x) */
    int cut   = argc > 5 ? atoi(argv[5]) : 0;   /* stop emitting at t=cut */

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init fail\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);
    if (cdiv) planck3_set_curl(cdiv, cvac);

    planck3_prepare();
    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0, injected = 0;
    printf("# whirl curl=%d,%d t=%d\n", cdiv, cvac, ticks);
    printf("# t | mass | ch_mass | coherent% | maxq | cells>=150 | injected drained\n");
    for (int t = 0; t <= ticks; t++) {
        int64_t mass = 0, ch = 0;
        int occ = 0, coh = 0, maxq = 0, hot = 0;
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    const Rec *r = &st[idx(x, y, z)];
                    int m = r->q + r->b;
                    mass += m;
                    if (x >= 30 && x <= 90 && y >= 10 && y <= 30 &&
                        z >= 10 && z <= 30) ch += m;
                    if (m > 0) {
                        occ++;
                        if ((r->s & 15) == 1) coh++;
                        if (r->q > maxq) maxq = r->q;
                        if (r->q >= 150) hot++;
                    }
                }
        if (t % 50 == 0 || t == ticks)
            printf("t=%3d | %6lld | %6lld | %5.1f%% | %3d | %4d | %lld %lld\n",
                   t, (long long)mass, (long long)ch,
                   occ ? 100.0 * coh / occ : 0, maxq, hot,
                   (long long)injected, (long long)drained);
        /* emitter: +x momentum line at SRC_X every 4th tick */
        if (t % 4 == 0 && t < ticks && (!cut || t < cut)) {
            for (int y = 15; y <= 25; y++) {
                planck3_set_node(idx(SRC_X, y, 20), FLOW_CAP, 1, 0, 0, 0);
                injected += FLOW_CAP;
            }
            if (coll)
                for (int y = 15; y <= 25; y++) {
                    planck3_set_node(idx(W - 11, y, 20), FLOW_CAP, 4, 0, 0, 0);
                    injected += FLOW_CAP;
                }
        }
        /* drain plane */
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[idx(DRN_X, y, z)];
                if (r->q + r->b > 0) {
                    drained += r->q + r->b;
                    planck3_set_node(idx(DRN_X, y, z), 0, 0, 0, 0, 0);
                }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    return 0;
}
