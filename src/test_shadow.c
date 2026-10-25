/* test_shadow.c — lamp-free broadside shadow test.
 * A translational +x carrier beam (plane at x=4, all vx>0 channels)
 * crosses the box. Carrier-gated lumps (fricm<0) drift upstream via
 * near-face ablation. An upstream lump A shadows the beam reaching a
 * downstream lump B: does B's drift change vs solo? (One-sided by
 * construction — B's plume can't reach A. Tests shadow coupling,
 * not mutual attraction.)
 *
 * usage: shadow <ticks> <beamq>
 * Prints per-config centroid-x slopes for upstream/downstream lumps.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

int      meso3i_init(int w, int h, int d, int axial);
void     meso3i_clear(void);
int      meso3i_nch(void);
int      meso3i_cvc(int c, int k);
void     meso3i_tick(void);
uint8_t  meso3i_get(int x, int y, int z, int c);
void     meso3i_set(int x, int y, int z, int c, uint8_t v);
void     meso3i_collmode(int);
void     meso3i_friction(int);
void     meso3i_fricmode(int);
void     meso3i_lat(int);
void     meso3i_drest(int);
void     meso3i_drain_edge(int);

#define W 72
#define H 72
#define D 36
#define CX (W/2)
#define CY (H/2)
#define CZ (D/2)
#define BX 6          /* beam injection plane */
#define R 3
#define LQ 64

static int NCH, NMOV;
static int CV[18][3];

static void lump(int lx, int ly) {
    for (int dz = -R; dz <= R; dz++)
    for (int dy = -R; dy <= R; dy++)
    for (int dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        int x = lx + dx, y = ly + dy, z = CZ + dz;
        if ((x + y + z) & 1) continue;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        meso3i_set(x, y, z, NCH - 1, LQ);
    }
}

/* broadside +x beam: plane x=BX, all channels with vx>0 */
static void beam(int q) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int c = 0; c < NMOV; c++)
        if (CV[c][0] > 0)
            meso3i_set(BX, y, z, c, (uint8_t)(meso3i_get(BX, y, z, c) + q));
}

/* rest-mass centroid x inside a sphere about (lx,ly,CZ) */
static double cmx(int lx, int ly, uint64_t *mout) {
    uint64_t m = 0; double sx = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x - lx) * (x - lx) + (y - ly) * (y - ly) + (z - CZ) * (z - CZ) > 100)
            continue;
        uint8_t r = meso3i_get(x, y, z, NCH - 1);
        m += r; sx += (double)r * x;
    }
    *mout = m;
    return m > 30 ? sx / m : -999;
}

static double fit(const double *tt, const double *yy, int n) {
    if (n < 3) return -999;
    double mt = 0, my = 0, num = 0, den = 0;
    for (int i = 0; i < n; i++) { mt += tt[i]; my += yy[i]; }
    mt /= n; my /= n;
    for (int i = 0; i < n; i++) {
        num += (tt[i] - mt) * (yy[i] - my);
        den += (tt[i] - mt) * (tt[i] - mt);
    }
    return num / den;
}

/* run a config; measure centroid slope near (lx,ly) — caller passes
 * which lumps to seed and which to measure. */
static double slope_at(int seedAx, int seedAy, int seedBx, int seedBy,
                       int measX, int measY, int ticks, int q) {
    meso3i_clear();
    meso3i_collmode(0); meso3i_friction(8); meso3i_fricmode(-4);
    meso3i_lat(1); meso3i_drest(0);
    if (seedAx >= 0) lump(seedAx, seedAy);
    if (seedBx >= 0) lump(seedBx, seedBy);
    double tt[64], yy[64]; int n = 0;
    for (int t = 0; t <= ticks; t++) {
        if (t > 100 && t % 50 == 0 && n < 64) {
            uint64_t m;
            double c = cmx(measX, measY, &m);
            if (c > -900) { tt[n] = t; yy[n] = c; n++; }
        }
        beam(q); meso3i_drain_edge(3); meso3i_tick();
    }
    return fit(tt, yy, n);
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 800;
    int q     = argc > 2 ? atoi(argv[2]) : 2;
    if (meso3i_init(W, H, D, 1)) return 1;
    NCH = meso3i_nch(); NMOV = NCH - 1;
    for (int c = 0; c < NMOV; c++)
        for (int k = 0; k < 3; k++) CV[c][k] = meso3i_cvc(c, k);

    printf("config                              | v_A(up)    v_B(down) | v_A0      v_B0   | dA       dB\n");
    for (int gap = 4; gap <= 12; gap += 4) {
        int ax = CX - gap / 2 - 3, bx = CX + gap / 2 + 3;
        /* in-line pair */
        double va  = slope_at(ax, CY, bx, CY, ax, CY, ticks, q);
        double vb  = slope_at(ax, CY, bx, CY, bx, CY, ticks, q);
        /* solo baselines at same positions */
        double va0 = slope_at(ax, CY, -1, 0, ax, CY, ticks, q);
        double vb0 = slope_at(-1, 0, bx, CY, bx, CY, ticks, q);
        printf("inline  sep=%2d (A@%d,B@%d)        | %9.5f %9.5f | %9.5f %9.5f | %+7.5f %+7.5f\n",
               gap + 6, ax, bx, va, vb, va0, vb0, va - va0, vb - vb0);
        /* staggered pair: B offset +3 in y — partial shadow */
        double vas = slope_at(ax, CY, bx, CY + 3, ax, CY, ticks, q);
        double vbs = slope_at(ax, CY, bx, CY + 3, bx, CY + 3, ticks, q);
        double vb0s = slope_at(-1, 0, bx, CY + 3, bx, CY + 3, ticks, q);
        printf("offset  sep=%2d (A@%d,B@%d,y+3)    | %9.5f %9.5f | %9.5f %9.5f | %+7.5f %+7.5f\n",
               gap + 6, ax, bx, vas, vbs, va0, vb0s, vas - va0, vbs - vb0s);
    }
    return 0;
}
