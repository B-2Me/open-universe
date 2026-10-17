// test_osc.c — M12: is the bound two-cell oscillator a phase-sensitive
// junction? The M7 q_t=120 + q_p=80 collision forms a permanent limit
// cycle (lump ~200 -> eject 160 -> congestion-divert back -> remerge),
// period 2 ticks, occupying cells (60,20,20)/(61,20,20).
//
// Protocol:
//   t=0      : probe1 q=80 port1 forms the oscillator at x=60-61.
//   t=48..   : calibration — dump cells x=58..64 so the internal phase
//              (which parity holds the "full" state) is measured, not
//              assumed.
//   t=t2     : probe2 (q2) fired port1 from x=10; arrives at the
//              oscillator boundary ~t2+50. Sweep t2 to hit even/odd
//              arrival parity.
//   After    : classify probe2 fate — absorbed (mass stays in osc, no
//              escapees), transmitted (packet exits x>=65 +x), or
//              reflected (packet exits x<58 -x, drains at x=0) — and
//              whether the tau=2 cycle survives, rephases, or dies.
//
// Usage: test_osc <ticks> <t2> <q2> [interval] [npulse]
//   interval>0: probe2 becomes a TRAIN — q2 packet fired every <interval>
//   ticks starting at t2, npulse times (resonance sweep: a train hits a
//   fixed internal phase iff interval mod 4 == 0).
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
#define OX 60          // oscillator anchor cell
#define CY 20
#define CZ 20
#define EX 10

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 200;
    int t2    = argc > 2 ? atoi(argv[2]) : 60;
    int q2    = argc > 3 ? atoi(argv[3]) : 20;
    int tper  = argc > 4 ? atoi(argv[4]) : 0;
    int npulse= argc > 5 ? atoi(argv[5]) : 8;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);   // isolate oscillator mechanics from tension divert

    // lump seed + forming probe (exactly the M7 bound-oscillator recipe)
    planck3_set_node(idx(OX, CY, CZ), 120, 0, 0, 0, 0);
    planck3_prepare();
    planck3_set_node(idx(EX, CY, CZ), 80, 1, 0, 0, 0);

    printf("# test_osc t2=%d q2=%d (oscillator at x=%d,%d)\n", t2, q2, OX, OX + 1);

    const Rec *st = (const Rec *)planck3_state_pointer();
    int64_t drained = 0;
    int probeFired = 0;
    for (int t = 0; t <= ticks; t++) {
        int doFire = tper > 0 ? (t >= t2 && (t - t2) % tper == 0 && probeFired < npulse)
                            : (!probeFired && t == t2);
        if (doFire) {
            planck3_set_node(idx(EX, CY, CZ), q2, 1, 0, 0, 0);
            probeFired++;
        }

        // region dump: cells x in [55,68] on the beamline
        if (t >= 48) {
            printf("t=%3d |", t);
            for (int x = 55; x <= 68; x++) {
                const Rec *nd = &st[(size_t)CZ * H * W + CY * W + x];
                if (nd->q || nd->b || nd->s)
                    printf(" x%d:q%d,s%d,b%d", x, nd->q, nd->s, nd->b);
            }
            printf("\n");
        }

        // wrap drain at x=0 (catches reflections)
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) { drained += r->q + r->b; planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0); }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }
    printf("# drained_at_x0=%lld\n", (long long)drained);
    return 0;
}
