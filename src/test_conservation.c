/*
 * test_conservation.c — M2 closed-box integer-ledger audit (Gemini brief).
 *
 *   test_conservation <ticks> [sync]
 *
 * 40x40x40 box (planar wrap, hard z walls), 500 turbulent interior cells
 * (q in [20,180], uniform random spin) from a fixed LCG seed. Runs the
 * flat engine and every 100 ticks reports:
 *   sumQ, sumB, sumH, sumTN, ledger L = Q+B+H, drift vs t=0,
 *   and the per-branch audit deltas (planck3 built with -DP3_AUDIT).
 * Each counter is the NET ledger delta its branch produced, so
 *   predicted_drift = sum(counters) - bleed   (bleed is 1:1 mass->heat)
 * Pass criterion: no unexplained residual — drift fully attributed.
 * Whether drift itself is zero is the audit's actual finding.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>

int     planck3_init_dims(int, int, int);
int     planck3_set_mode(int);
void    planck3_set_sync(int);
void    planck3_set_node(int32_t, int, int, int, int, int);
void    planck3_prepare(void);
void    planck3_tick(void);
uint8_t *planck3_state_pointer(void);
int32_t planck3_node_count(void);
int     planck3_audit_count(void);
int64_t planck3_audit(int);
void    planck3_audit_reset(void);

typedef struct { uint8_t q, s; uint16_t h; uint8_t b, tn; } Rec;

// Must match the DL_* enum order in planck3.c.
static const char *AN[] = {
    "fired", "pulled", "push_deleted", "spray_rem", "spray_wall",
    "backpressure", "bleed(info)", "friction", "shunt", "gen15",
    "floor", "dissipation", "wall_heat", "heat_clamp"
};
#define BLEED_IDX 6

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 10000;
    int sync  = argc > 2 ? atoi(argv[2]) : 0;
    const char *e = getenv("P3_SYNC");
    if (e) sync = atoi(e);
    const int W = 40, H = 40, D = 40;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(sync);
    if (!planck3_audit_count()) { fprintf(stderr, "built without -DP3_AUDIT\n"); return 1; }

    // Deterministic turbulence: 500 interior cells, q in [20,180], spin 1..12.
    uint32_t rng = 0x12345678u;
    for (int i = 0; i < 500; i++) {
        rng = rng * 1664525u + 1013904223u; int x = 5 + (rng >> 16) % 30;
        rng = rng * 1664525u + 1013904223u; int y = 5 + (rng >> 16) % 30;
        rng = rng * 1664525u + 1013904223u; int z = 5 + (rng >> 16) % 30;
        rng = rng * 1664525u + 1013904223u; int q = 20 + (rng >> 16) % 161;
        rng = rng * 1664525u + 1013904223u; int s = 1 + (rng >> 16) % 12;
        planck3_set_node((z * H + y) * W + x, q, s, 0, 0, 0);
    }
    planck3_prepare();
    planck3_audit_reset();

    int32_t n = planck3_node_count();
    uint8_t *st = planck3_state_pointer();
    int64_t L0 = 0;
    for (int32_t i = 0; i < n; i++) {
        Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
        L0 += r->q + r->b + r->h;
    }

    printf("# %dx%dx%d sync=%d ticks=%d  audit_channels=%d\n", W, H, D, sync, ticks, planck3_audit_count());
    printf("# t  sumQ  sumB  sumH  sumTN  live  ledger  drift  predicted  residual\n");
    printf("%d %" PRId64 " %" PRId64 "\n", 0, L0, L0);

    for (int t = 1; t <= ticks; t++) {
        planck3_tick();
        if (t % 100) continue;
        int64_t sQ = 0, sB = 0, sH = 0, sTN = 0; int64_t live = 0;
        for (int32_t i = 0; i < n; i++) {
            Rec *r = (Rec *)(st + (size_t)i * sizeof(Rec));
            sQ += r->q; sB += r->b; sH += r->h; sTN += r->tn;
            if (r->q) live++;
        }
        int64_t L = sQ + sB + sH;
        int64_t pred = 0;
        for (int c = 0; c < planck3_audit_count(); c++)
            if (c != BLEED_IDX) pred += planck3_audit(c);
        printf("%d %" PRId64 " %" PRId64 " %" PRId64 " %" PRId64 " %" PRId64
               " %" PRId64 " %" PRId64 " %" PRId64 " %" PRId64 "\n",
               t, sQ, sB, sH, sTN, live, L, L - L0, pred, (L - L0) - pred);
    }

    printf("# per-channel cumulative net ledger deltas:\n");
    for (int c = 0; c < planck3_audit_count(); c++)
        printf("#   %-14s %+" PRId64 "\n", AN[c], planck3_audit(c));
    return 0;
}
