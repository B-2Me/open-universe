/* test_accrete.c — accretion + outflow probe on meso3i (post-pivot).
 *
 * Core question: can a True-FCC node accrete simultaneous multichannel
 * inflow while continuously venting outflow — i.e., does driven
 * convergence produce (a) a throughput scattering node, (b) a bound
 * condensate sustained by throughput, or (c) saturation/runaway?
 *
 * Apparatus: 18 upstream "spoke" rays — for each moving channel c the
 * site C - R*ICV[c] injects `rate` quanta on channel c every `period`
 * ticks.  Single-quantum ray cells (m<2) don't collide, so each ray is
 * a collision-free feed delivering flux to C at v=1 per hop.
 * Boundary slab (x/y/z < EDGE or >= W-EDGE) drains all flux: open box.
 *
 * Telemetry: rho_C, Q_C, inflow (quanta staged at C's predecessors
 * aimed at C), outflow (moving-chan mass at C), rest-chan share
 * (internal-energy analog), shell masses at graph distance 1..3,
 * injected vs drained ledger.
 *
 * usage: accrete <ticks> <rate> <period> <qmode> [qdir] [cut] [gate]
 *   qmode 0 native | 1 condense | 2 condense+tau emit | 3 +directed
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int      meso3i_init(int w, int h, int d, int axial);
void     meso3i_clear(void);
void     meso3i_collmode(int);
void     meso3i_gate(int);
void     meso3i_condense(int);
void     meso3i_reflect(int);
void     meso3i_qmode(int);
void     meso3i_qdir(int);
uint8_t  meso3i_qget(int, int, int);
uint8_t  meso3i_get(int, int, int, int);
void     meso3i_set(int, int, int, int, uint8_t);
void     meso3i_tick(void);
int      meso3i_nch(void);

#define W 44
#define H 44
#define D 44
#define EDGE 3          /* drain slab thickness */
#define CX 22
#define CY 22
#define CZ 22

/* channel vectors, mirror of meso3i.c ICV */
static const int8_t IDIR12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t IDIR6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static int NMOV, NCH;
static int cv(int c, int k) {
    if (c < 12) return IDIR12[c][k];
    if (c < 18) return IDIR6[c - 12][k];
    return 0;
}
static int isite(int x, int y, int z) { return ((x + y + z) & 1) == 0; }

static uint32_t node_mass(int x, int y, int z) {
    if (!isite(x, y, z)) return 0;
    uint32_t m = 0;
    for (int c = 0; c < NCH; c++) m += meso3i_get(x, y, z, c);
    return m;
}

static int64_t dz_face, dxy_face;   /* cumulative drain split: z-faces vs sides */
static void drain_edge(void) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if (!isite(x, y, z)) continue;
        int dzf = (z < EDGE || z >= D - EDGE);
        int dxy = (x < EDGE || x >= W - EDGE || y < EDGE || y >= H - EDGE);
        if (!dzf && !dxy) continue;
        uint32_t m = node_mass(x, y, z);
        if (dzf) dz_face += m; else dxy_face += m;
        for (int c = 0; c < NCH; c++) meso3i_set(x, y, z, c, 0);
    }
}

int main(int argc, char **argv) {
    int ticks  = argc > 1 ? atoi(argv[1]) : 400;
    int rate   = argc > 2 ? atoi(argv[2]) : 1;
    int period = argc > 3 ? atoi(argv[3]) : 4;
    int qmode  = argc > 4 ? atoi(argv[4]) : 0;
    int qdir   = argc > 5 ? atoi(argv[5]) : -1;
    int cut    = argc > 6 ? atoi(argv[6]) : 0;
    int gate   = argc > 7 ? atoi(argv[7]) : 0;
    int RAY    = argc > 8 ? atoi(argv[8]) : 10;
    int spokes = argc > 9 ? atoi(argv[9]) : 0;  /* 0=all, 1=equatorial(dz=0), 2=polar(dz!=0) */
    int cond   = argc > 10 ? atoi(argv[10]) : 0; /* ICOND rest-channel ratchet */
    int refl   = argc > 11 ? atoi(argv[11]) : 0; /* IREFL congestion-refusal cap */

    if (meso3i_init(W, H, D, 1)) { fprintf(stderr, "init fail\n"); return 1; }
    NCH = meso3i_nch(); NMOV = NCH - 1;
    meso3i_collmode(0);
    if (gate) meso3i_gate(gate);
    if (cond) meso3i_condense(cond);
    if (refl) meso3i_reflect(refl);
    if (qmode) meso3i_qmode(qmode);
    if (qdir >= 0) meso3i_qdir(qdir);

    int64_t injected = 0;
    printf("# accrete rate=%d/%dt qmode=%d qdir=%d gate=%d cond=%d refl=%d t=%d\n",
           rate, period, qmode, qdir, gate, cond, refl, ticks);
    printf("# t | rho_C | Q_C | inflow | out | rest%% | sh1 sh2 sh3 | sumQ | inj drain\n");
    for (int t = 0; t <= ticks; t++) {
        /* measure staged inflow at C's predecessors + center state */
        uint32_t infl = 0;
        for (int c = 0; c < NMOV; c++)
            infl += meso3i_get(CX - cv(c, 0), CY - cv(c, 1), CZ - cv(c, 2), c);
        uint32_t rhoC = 0, restC = 0, outpol = 0;
        for (int c = 0; c < NCH; c++) {
            uint32_t v = meso3i_get(CX, CY, CZ, c);
            rhoC += v;
            if (c == NCH - 1) restC = v;
            else if (cv(c, 2) != 0) outpol += v;   /* z-moving channels */
        }
        uint32_t outC = rhoC - restC;
        uint32_t qc = meso3i_qget(CX, CY, CZ);
        uint32_t qtot = 0;
        for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++)
            if (isite(x, y, z)) qtot += meso3i_qget(x, y, z);
        /* shell masses at graph distance 1..3 (Euclidean band approx) */
        uint32_t sh[3] = {0, 0, 0};
        for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
            if (!isite(x, y, z)) continue;
            int dx = x - CX, dy = y - CY, dz = z - CZ;
            int r2 = dx * dx + dy * dy + dz * dz;
            uint32_t m = node_mass(x, y, z);
            if (r2 >= 1 && r2 <= 6)      sh[0] += m;
            else if (r2 > 6 && r2 <= 14)  sh[1] += m;
            else if (r2 > 14 && r2 <= 24) sh[2] += m;
        }
        uint64_t tot = qtot;
        for (int z = 0; z < D; z++)
        for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) tot += node_mass(x, y, z);
        if (t % 25 == 0 || t == ticks)
            printf("t=%4d | %4u | %3u | %5u | %5u(%u pol) | %4.1f | %u %u %u | %5u | %lld dz=%lld xy=%lld\n",
                   t, rhoC, qc, infl, outC, outpol,
                   rhoC ? 100.0 * restC / rhoC : 0,
                   sh[0], sh[1], sh[2], qtot,
                   (long long)injected,
                   (long long)dz_face, (long long)dxy_face);
        /* drive: inject on each spoke */
        if (t % period == 0 && t < ticks && (!cut || t < cut)) {
            for (int c = 0; c < NMOV; c++) {
                if (spokes == 1 && cv(c, 2) != 0) continue;   /* equatorial only */
                if (spokes == 2 && cv(c, 2) == 0) continue;   /* polar only */
                int sx = CX - RAY * cv(c, 0), sy = CY - RAY * cv(c, 1),
                    sz = CZ - RAY * cv(c, 2);
                for (int u = 0; u < rate; u++)
                    meso3i_set(sx, sy, sz, c,
                               (uint8_t)(meso3i_get(sx, sy, sz, c) + 1));
                injected += rate;
            }
        }
        drain_edge();
        if (t < ticks) meso3i_tick();
    }
    /* final ledger: injected - resident = drained */
    uint64_t tot = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        tot += node_mass(x, y, z);
        if (isite(x, y, z)) tot += meso3i_qget(x, y, z);
    }
    printf("# injected=%lld resident=%llu drained=%lld\n",
           (long long)injected, (unsigned long long)tot,
           (long long)(injected - (int64_t)tot));
    return 0;
}
