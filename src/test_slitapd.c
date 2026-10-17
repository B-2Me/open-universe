// test_slitapd.c — dilute double-slit with APD detector wall (M10).
// Detector = primed metastable cells (q=199, s=0) at x=90, y even, all z
// (congestion-isolated: dy=2 > 1 hop; z-neighbors need dx=+-1 anyway).
// A probe hitting a prime clicks it: 199+q -> fires 160 forward, leaves
// residue ~44. Click = first discharge event per cell (y,z,t logged).
//
// geom 0: parallel beams through a deadlock slit barrier at x=40
//         (full-z slit rows y16-17 / y24-25). cfg 0=A only,1=B only,2=both.
// geom 1: no barrier — two diagonal beams crossing in free space.
//         A on port2 (+x,+y), B on port6 (+x,-y), co-arriving at (60,20,z).
//         cfg 0=A only, 1=B only, 2=both (dt shifts B's fire tick).
//         Crossing cells instrumented: maxq>q_probe = fused co-arrival,
//         two separate occupied ticks = clean (statistical-avoidance) cross.
//
// Pixels are SINGLE-SHOT: a discharged prime leaves q~44 s=0 residue and
// never re-arms, so probes 2..N would pass a dead pixel silently. Fix:
// pulse i is emitted at z = z0 + 2i -> fresh primed pixel every pulse.
//
// Usage: test_slitapd <ticks> <geom> <cfg> <q_probe> <period> <npulse> [dt] [bzshift]
//   bzshift: shift B's per-pulse z index — needed for the phase-revival test:
//   with dt=k*period, B pulse m co-arrives with A pulse m+k, whose crossing
//   sits at z0+2(m+k). bzshift=k makes B_m use that crossing -> the delayed
//   pairing actually co-occupies a cell. (v=1: dt mod period == path diff.)
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
#define XB 40
#define XD 90
#define PRIME 199

static const int8_t HOFF[2][7][2] = {
    {{0,0},{1,0},{0,1},{-1,1},{-1,0},{-1,-1},{0,-1}},
    {{0,0},{1,0},{1,1},{0,1},{-1,0},{0,-1},{1,-1}}
};

static void poff(int par, int d, int *dx, int *dy, int *dz) {
    if (d <= 6) { *dx = HOFF[par][d][0]; *dy = HOFF[par][d][1]; *dz = 0; }
    else { *dx = 0; *dy = 0; *dz = 0; }  // only in-plane ports used here
}

static void back_step(int *x, int *y, int *z, int port) {
    int dx, dy, dz, bx = -999, by = -999, bz = -999;
    for (int par = 0; par < 2; par++) {
        poff(par, port, &dx, &dy, &dz);
        int cx = *x - dx, cy = *y - dy, cz = *z - dz;
        if ((cy & 1) != par) continue;
        if (cx + dx == *x && cy + dy == *y && cz + dz == *z) { bx = cx; by = cy; bz = cz; }
    }
    if (bx == -999 || bx < 0 || bx >= W || by < 0 || by >= H || bz < 0 || bz >= D) {
        fprintf(stderr, "back_step failed at (%d,%d,%d) port %d\n", *x, *y, *z, port); exit(1);
    }
    *x = bx; *y = by; *z = bz;
}

static int idx(int x, int y, int z) { return (z * H + y) * W + x; }

int main(int argc, char **argv) {
    int ticks   = argc > 1 ? atoi(argv[1]) : 1200;
    int geom    = argc > 2 ? atoi(argv[2]) : 0;
    int cfg     = argc > 3 ? atoi(argv[3]) : 2;
    int q_probe = argc > 4 ? atoi(argv[4]) : 5;
    int period  = argc > 5 ? atoi(argv[5]) : 20;
    int npulse  = argc > 6 ? atoi(argv[6]) : 16;
    int dt      = argc > 7 ? atoi(argv[7]) : 0;
    int bzshift = argc > 8 ? atoi(argv[8]) : 0;

    if (planck3_init_dims(W, H, D)) { fprintf(stderr, "init_dims failed\n"); return 1; }
    planck3_set_mode(0);
    planck3_set_sync(1);
    planck3_set_temit(300);   // pure geometry: no tension emission anywhere

    int ax, ay, az, as, bx, by, bz, bs, fireB = 0;
    if (geom == 0) {
        // barrier plane with slit rows; emitters aim through them
        for (int z = 0; z < D; z++) for (int y = 0; y < H; y++) {
            int inA = (y == 16 || y == 17), inB = (y == 24 || y == 25);
            int open = (cfg == 2 && (inA || inB)) || (cfg == 0 && inA) || (cfg == 1 && inB);
            if (!open) planck3_set_node(idx(XB, y, z), 255, 0, 0, 0, 0);
        }
        ax = 10; ay = 16; az = 4; as = 1;
        bx = 10; by = 24; bz = 4; bs = 1;
    } else {
        // free-space crossing at (60,20,4+2i): A via port2, B via port6
        ax = 60; ay = 20; az = 4; bx = 60; by = 20; bz = 4;
        for (int i = 0; i < 19; i++) back_step(&ax, &ay, &az, 2);
        for (int i = 0; i < 19; i++) back_step(&bx, &by, &bz, 6);
        as = 2; bs = 6; fireB = dt;   // arrivals coincide when dt=0
    }

    // APD wall: primed cells at x=XD, y even AND z even — spacing must
    // beat the EJECTA's congestion-divert capture too: a discharged
    // prime's 160 packet transits one cell over and diverts into any
    // >FLOW_CAP prime (measured: lateral avalanche down a z-row).
    // y-spacing 2 in-plane, z-spacing 2 cross-plane => truly isolated.
    for (int z = 0; z < D; z += 2)
        for (int y = 0; y < H; y += 2)
            planck3_set_node(idx(XD, y, z), PRIME, 0, 0, 0, 0);

    planck3_prepare();
    printf("# test_slitapd geom=%d cfg=%d q=%d period=%d npulse=%d dt=%d\n",
           geom, cfg, q_probe, period, npulse, dt);
    printf("# A=(%d,%d,%d,p%d) B=(%d,%d,%d,p%d) fireB=%d\n", ax, ay, az, as, bx, by, bz, bs, fireB);

    static uint8_t clicked[H][D];
    static int64_t clicks[H][D];
    memset(clicked, 0, sizeof clicked); memset(clicks, 0, sizeof clicks);
    int64_t clickN = 0, drainMass = 0;
    static int maxqC[D], occT[D];   // per-crossing-cell co-occupancy (geom1)

    const Rec *st = (const Rec *)planck3_state_pointer();
    int fired = 0;
    for (int t = 0; t <= ticks; t++) {
        // emitters: A fires on t%period==0; B on (t-dt)%period==0.
        // pulse i goes out at z = z0 + 2i (fresh APD pixel per pulse).
        int fireA = cfg != 1 && period > 0 && t % period == 0 && t / period < npulse;
        int fB    = cfg != 0 && period > 0 && t >= dt && (t - dt) % period == 0 && (t - dt) / period < npulse;
        if (fireA) { planck3_set_node(idx(ax, ay, az + 2 * (t / period)), q_probe, as, 0, 0, 0); fired++; }
        if (fB)    { planck3_set_node(idx(bx, by, bz + 2 * ((t - dt) / period + bzshift)), q_probe, bs, 0, 0, 0); fired++; }

        // geom1: watch crossing cell C_i=(60,20,az+2i) during its arrival window
        if (geom == 1) {
            for (int i = 0; i < npulse; i++) {
                if (t < i * period + 15 || t > i * period + 19 + dt + 6) continue;
                int zc = az + 2 * i;
                const Rec *nd = &st[(size_t)zc * H * W + 20 * W + 60];
                if (nd->q > maxqC[zc]) maxqC[zc] = nd->q;
                if (nd->q > 0) occT[zc]++;
            }
        }

        // click scan on APD wall
        for (int z = 0; z < D; z += 2)
            for (int y = 0; y < H; y += 2) {
                const Rec *nd = &st[(size_t)z * H * W + y * W + XD];
                if (!clicked[y][z] && (nd->s != 0 || nd->q < 197) && nd->q > 0) {
                    clicked[y][z] = 1; clicks[y][z]++; clickN++;
                    printf("CLICK t=%d y=%d z=%d resid=%d\n", t, y, z, nd->q);
                }
            }
        // drain x=0 (wrap absorber)
        for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++) {
                const Rec *r = &st[(size_t)z * H * W + y * W];
                if (r->q + r->b > 0) { drainMass += r->q + r->b; planck3_set_node(idx(0, y, z), 0, 0, 0, 0, 0); }
            }
        if (t < ticks) planck3_tick();
        st = (const Rec *)planck3_state_pointer();
    }

    printf("\n# H(y) click histogram (summed over z):\n");
    for (int y = 0; y < H; y++) {
        int64_t s = 0; for (int z = 0; z < D; z++) s += clicks[y][z];
        if (s || y % 2 == 0) printf("y=%2d clicks=%lld\n", y, (long long)s);
    }
    printf("# total clicks=%lld wrap_drain=%lld\n", (long long)clickN, (long long)drainMass);

    if (geom == 1) {
        int nCo = 0, nClean = 0, nNone = 0;
        printf("# crossing-cell verdicts (C_i at (60,20,z)):\n");
        for (int i = 0; i < npulse; i++) {
            int zc = az + 2 * i;
            const char *v;
            if (maxqC[zc] > q_probe)      { v = "COARRIVE-fused"; nCo++; }
            else if (occT[zc] >= 2)       { v = "CLEAN-cross";    nClean++; }
            else if (occT[zc] == 1)       { v = "single-pass";    nNone++; }
            else                          { v = "no-arrival";     nNone++; }
            printf("#   pulse=%2d z=%2d maxq=%3d occTicks=%d -> %s\n",
                   i, zc, maxqC[zc], occT[zc], v);
        }
        printf("# cooccupancy: fused=%d clean=%d other=%d\n", nCo, nClean, nNone);
    }
    return 0;
}
