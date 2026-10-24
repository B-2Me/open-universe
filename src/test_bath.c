/* test_bath.c — M37 in the ambient-bath regime.
 * Carrier-gated lumps (fricm<0) in an isotropic flux bath injected on
 * the boundary shell — no central source. Solo baselines isolate mutual
 * shadowing from bath asymmetry.
 *
 * usage: bath <ticks> <sep> <mpn> <bathq>
 *   sep = x-separation of lump centers (0 = run all), negative = solo L/R:
 *         call twice with sep encoded as flags (see modes below)
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
#define SH 4

static int NCH, NMOV;
static int CV[18][3];

static void lump(int lx, int R, int Q) {
    for (int dz = -R; dz <= R; dz++)
    for (int dy = -R; dy <= R; dy++)
    for (int dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        int x = lx + dx, y = CY + dy, z = CZ + dz;
        if ((x + y + z) & 1) continue;
        meso3i_set(x, y, z, NCH - 1, Q);
    }
}

static void bath(int q) {
    for (int z = SH; z < D - SH; z++)
    for (int y = SH; y < H - SH; y++)
    for (int c = 0; c < NMOV; c++) {
        if (CV[c][0] > 0) meso3i_set(SH, y, z, c, meso3i_get(SH, y, z, c) + q);
        if (CV[c][0] < 0) meso3i_set(W - 1 - SH, y, z, c, meso3i_get(W - 1 - SH, y, z, c) + q);
    }
    for (int z = SH; z < D - SH; z++)
    for (int x = SH; x < W - SH; x++)
    for (int c = 0; c < NMOV; c++) {
        if (CV[c][1] > 0) meso3i_set(x, SH, z, c, meso3i_get(x, SH, z, c) + q);
        if (CV[c][1] < 0) meso3i_set(x, H - 1 - SH, z, c, meso3i_get(x, H - 1 - SH, z, c) + q);
    }
    for (int y = SH; y < H - SH; y++)
    for (int x = SH; x < W - SH; x++)
    for (int c = 0; c < NMOV; c++) {
        if (CV[c][2] > 0) meso3i_set(x, y, SH, c, meso3i_get(x, y, SH, c) + q);
        if (CV[c][2] < 0) meso3i_set(x, y, D - 1 - SH, c, meso3i_get(x, y, D - 1 - SH, c) + q);
    }
}

/* rest-mass centroid x in [x0,x1) */
static double cmx(int x0, int x1, uint64_t *mout) {
    uint64_t m = 0; double sx = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = x0; x < x1; x++) {
        uint8_t r = meso3i_get(x, y, z, NCH - 1);
        m += r; sx += (double)r * x;
    }
    *mout = m;
    return m > 50 ? sx / m : -999;
}

static double fit(const double *tt, const double *yy, int n) {
    if (n < 3) return -999;
    double mt = 0, my = 0, num = 0, den = 0;
    for (int i = 0; i < n; i++) { mt += tt[i]; my += yy[i]; }
    mt /= n; my /= n;
    for (int i = 0; i < n; i++) { num += (tt[i] - mt) * (yy[i] - my); den += (tt[i] - mt) * (tt[i] - mt); }
    return den > 0 ? num / den : -999;
}

/* mode: 0 pair, 1 solo-left, 2 solo-right. Per-side centroid slopes
 * into *vl / *vr; missing side or dead lump => -999. */
static void run(int mode, int sep, int ticks, int q, double *vl, double *vr) {
    meso3i_clear();
    meso3i_collmode(0); meso3i_friction(8); meso3i_fricmode(-4);
    meso3i_lat(1); meso3i_drest(0);
    int h = sep >> 1;
    if (mode != 2) lump(CX - h, 3, 64);
    if (mode != 1) lump(CX + h, 3, 64);
    double tbuf[64], lbuf[64], rbuf[64]; int n = 0;
    for (int t = 0; t <= ticks; t++) {
        if (t > 100 && t % 50 == 0 && n < 64) {
            uint64_t ml, mr;
            double cl = cmx(0, CX, &ml), cr = cmx(CX, W, &mr);
            tbuf[n] = t;
            lbuf[n] = cl; rbuf[n] = cr;
            n++;
        }
        bath(q); meso3i_drain_edge(3); meso3i_tick();
    }
    /* drop dead samples (centroid returns -999 sentinel), keeping
     * timestamps paired per side */
    double tl[64], ll[64], tr[64], rr[64]; int nl = 0, nr = 0;
    for (int i = 0; i < n; i++) {
        if (lbuf[i] > -900) { tl[nl] = tbuf[i]; ll[nl] = lbuf[i]; nl++; }
        if (rbuf[i] > -900) { tr[nr] = tbuf[i]; rr[nr] = rbuf[i]; nr++; }
    }
    *vl = fit(tl, ll, nl);
    *vr = fit(tr, rr, nr);
    if (mode == 2) *vl = -999;
    if (mode == 1) *vr = -999;
}

int main(int argc, char **argv) {
    int ticks = argc > 1 ? atoi(argv[1]) : 800;
    int q     = argc > 2 ? atoi(argv[2]) : 1;
    if (meso3i_init(W, H, D, 1)) return 1;
    NCH = meso3i_nch(); NMOV = NCH - 1;
    for (int c = 0; c < NMOV; c++)
        for (int k = 0; k < 3; k++) CV[c][k] = meso3i_cvc(c, k);

    printf(" sep  gap |  v_L(pair)  v_R(pair) |   v_L0      v_R0   |  mutual_close\n");
    for (int sep = 8; sep <= 20; sep += sep < 12 ? 2 : 4) {
        double vlp, vrp, vl0, vr0, dummy;
        run(0, sep, ticks, q, &vlp, &vrp);
        run(1, sep, ticks, q, &vl0, &dummy);
        run(2, sep, ticks, q, &dummy, &vr0);
        double cp = (vlp > -900 && vrp > -900) ? vlp - vrp : -999;
        double cb = (vl0 > -900 && vr0 > -900) ? vl0 - vr0 : -999;
        printf(" %3d %4d | %10.5f %10.5f | %10.5f %10.5f | %10.6f\n",
               sep, sep - 6, vlp, vrp, vl0, vr0,
               (cp > -900 && cb > -900) ? cp - cb : -999);
    }
    return 0;
}
