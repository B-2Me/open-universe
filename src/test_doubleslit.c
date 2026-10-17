/*
 * test_doubleslit.c — M5 double-slit detector wall (Gemini brief).
 *
 *   test_doubleslit <ticks> [slits] [sync]
 *     slits: 0 = A only, 1 = B only, 2 = both (default)
 *
 * 120x40x40, sync mode. Sparse pulsed emitters: cells at (10,16,20) and
 * (10,24,20) fire port-1 (+x) packets of q=120 every 4th tick — spacing
 * prevents the packet-coalescence jam that kills continuous beams.
 * Barrier at x=40: q=255 s=0 deadlock plane (refuses pulls; reflected
 * packets shunt-reverse — handled by the wrap absorber), two w=2 slits
 * at y=[16,17] and y=[24,25] (centers d=8 apart), full height z.
 * Detector at x=90: every tick each cell is drained; a CLICK logs when
 * q+buffer >= FLOW_CAP. A second silent absorber at x=0 eats reflected
 * packets before they wrap the torus and hit the detector from behind.
 *
 * Baselines: slits=0/1 single-slit references; slits=2 is H12 vs H1+H2.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_temit(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);
int32_t planck3_node_count(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

#define W 120
#define H 40
#define D 40
#define XB 40   // barrier plane
#define XD 90   // detector plane
#define THRESH 120

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 800;
    int slits = argc > 2 ? atoi(argv[2]) : 2;
    int sync  = argc > 3 ? atoi(argv[3]) : 1;
    const char *e = getenv("P3_SYNC");
    if (e) sync = atoi(e);

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(sync);
    // P3_TEMIT: raise the tension-emission threshold past 255 to make the
    // barrier a pure geometric obstacle (no tension field => no T_DIVERT
    // capture of slit-mouth packets into saturated wall buffers).
    const char *te = getenv("P3_TEMIT");
    if (te) { int m = atoi(te); printf("# temit_min=%d\n", m); planck3_set_temit(m); }

    // Barrier: deadlock plane at x=XB with slit gaps left empty.
    for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) {
        int inA = (y == 16 || y == 17), inB = (y == 24 || y == 25);
        int open = (slits == 2 && (inA || inB)) || (slits == 0 && inA) || (slits == 1 && inB);
        if (!open) planck3_set_node((z * H + y) * W + XB, 255, 0, 0, 0, 0);
    }
    // Two point emitters aligned with the slit columns.
    int emit[2] = {
        (20 * H + 16) * W + 10,   // aims through slit A (y16-17)
        (20 * H + 24) * W + 10    // aims through slit B (y24-25)
    };
    planck3_prepare();

    uint8_t *st = planck3_state_pointer();
    int32_t n = planck3_node_count();

    int64_t clicks[40][40]; memset(clicks, 0, sizeof clicks);
    int64_t drained[40][40]; memset(drained, 0, sizeof drained);
    int64_t clickN = 0, wrapEaten = 0;

    printf("# %dx%dx%d sync=%d ticks=%d slits=%d\n", W, H, D, sync, ticks, slits);
    for (int t = 0; t < ticks; t++) {
        // sparse emitters: a q=159 packet every 4th tick. q must be
        // <= FLOW_CAP: the receiver's congestion-divert (maxCong > FLOW_CAP)
        // reads the still-full g_rd quanta of the sender and aims BACK at
        // it — any denser source creates a ping-pong that never leaves.
        if (t % 4 == 0) {
            planck3_set_node(emit[0], 159, 1, 0, 0, 0);
            planck3_set_node(emit[1], 159, 1, 0, 0, 0);
        }
        planck3_tick();
        // drain detector plane; log clicks
        for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) {
            int32_t i = (z * H + y) * W + XD;
            Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
            int m = r->q + r->b;
            if (m > 0) {
                drained[y][z] += m;
                if (m >= THRESH) { clicks[y][z]++; clickN++; }
                planck3_set_node(i, 0, 0, 0, 0, 0);
            }
        }
        // wrap absorber: x=0 column eats anything moving -x
        for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) {
            int32_t i = (z * H + y) * W;
            Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
            if (r->q + r->b > 0) { wrapEaten += r->q + r->b; planck3_set_node(i, 0, 0, 0, 0, 0); }
        }
        if (t % 200 == 0) {
            int64_t mq = 0; int live = 0;
            for (int32_t i = 0; i < n; i++) {
                Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
                if (r->q) { live++; mq += r->q; }
            }
            printf("# t=%d live=%d sumQ=%lld clicks=%lld wrap_eaten=%lld\n",
                   t, live, (long long)mq, (long long)clickN, (long long)wrapEaten);
            fflush(stdout);
        }
    }

    printf("# detector histograms (y-rows; click = drain >= %d):\n", THRESH);
    printf("# y  clicks  drained_mass\n");
    for (int y = 0; y < H; y++) {
        int64_t c = 0, m = 0;
        for (int z = 0; z < D; z++) { c += clicks[y][z]; m += drained[y][z]; }
        printf("%d %" PRId64 " %" PRId64 "\n", y, c, m);
    }
    int64_t totD = 0;
    for (int y = 0; y < H; y++) for (int z = 0; z < D; z++) totD += drained[y][z];
    printf("# total clicks=%lld drained=%lld wrap_eaten=%lld\n",
           (long long)clickN, (long long)totD, (long long)wrapEaten);
    return 0;
}
