/* test_meso3.c — M19 measurement battery for the Boolean FCC lattice gas.
 *
 *   T1  conservation ledger — random 20% fill, 300 ticks, mass + net
 *       momentum must be bitwise constant every tick.
 *   T2  counter-flow — two slabs of antipodal single-channel quanta fired
 *       head-on; measure forward-channel retention after crossing
 *       (planck3 analog: packets fuse at v=0. LGA prediction: passage).
 *   T3  equipartition + shell tensor — randomized field, 400 ticks; per-
 *       channel occupation vs uniform, plus the analytic 4th-rank numbers
 *       (Σcx^4 vs 3Σcx²cy²) whose mismatch is the known D3Q13 isotropy gap.
 *   T4  same battery on the axial=1 (D3Q19) shell — shows the unweighted
 *       second shell makes the 4th-rank ratio worse (isotropy needs
 *       weighting, not just more channels).
 *
 * build: gcc -O2 -Wall meso3.c test_meso3.c -o /tmp/m3t -lm
 */
#include <stdint.h>
#include <stdio.h>
#include <math.h>

int      meso3_init(int w, int h, int d, int axial);
void     meso3_clear(void);
void     meso3_tick(void);
uint32_t meso3_get(int x, int y, int z);
void     meso3_set(int x, int y, int z, uint32_t mask);
void     meso3_totals(uint64_t *, int64_t *, int64_t *, int64_t *);
void     meso3_channel_hist(uint64_t *);
void     meso3_collmode(int);
int      meso3_nch(void);
const int (*meso3_cv(void))[3];

int      meso3i_init(int w, int h, int d, int axial);
void     meso3i_clear(void);
void     meso3i_collmode(int);
void     meso3i_dwell(int);
void     meso3i_gate(int);
void     meso3i_bias(int);
void     meso3i_condense(int);
void     meso3i_tick(void);
uint8_t  meso3i_get(int x, int y, int z, int c);
uint32_t meso3i_edge(int x, int y, int z, int c);
void     meso3i_set(int x, int y, int z, int c, uint8_t v);
void     meso3i_totals(uint64_t *, int64_t *, int64_t *, int64_t *);
void     meso3i_hist(uint64_t *);
int      meso3i_nch(void);
const int (*meso3i_cv(void))[3];

static int INCH_i;

static uint32_t trng = 12345u;
static uint32_t trnd(void) {
    trng ^= trng << 13; trng ^= trng >> 17; trng ^= trng << 5;
    return trng;
}

static int NCH_;
#define W 40
#define H 40
#define D 40

static void ledger(int ticks, const char *tag) {
    uint64_t m0, m; int64_t px0, py0, pz0, px, py, pz;
    meso3_totals(&m0, &px0, &py0, &pz0);
    int bad = 0;
    for (int t = 0; t < ticks; t++) {
        meso3_tick();
        meso3_totals(&m, &px, &py, &pz);
        if (m != m0 || px != px0 || py != py0 || pz != pz0) bad++;
    }
    printf("T1 %s: mass=%llu p=(%lld,%lld,%lld) violations=%d/%d\n",
           tag, (unsigned long long)m0,
           (long long)px0, (long long)py0, (long long)pz0, bad, ticks);
}

static void randfill(double p) {
    int nch = NCH_;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        uint32_t m = 0;
        for (int c = 0; c < nch; c++)
            if ((trnd() & 0xFFFF) < (uint32_t)(p * 65536)) m |= 1u << c;
        if (m) meso3_set(x, y, z, m);
    }
}

/* forward-channel population of bits {a,b} across the grid */
static uint64_t chan_pop(uint32_t bits) {
    uint64_t n = 0;
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++)
        if (!((x + y + z) & 1)) {
            uint32_t m = meso3_get(x, y, z);
            n += __builtin_popcount(m & bits);
        }
    return n;
}

static void counterflow(void) {
    meso3_clear();
    /* channel 0 = (+1,+1,0), channel 1 = (-1,-1,0): exact antipodes.
     * Slabs perpendicular-ish: seed every even site in two x-bands. */
    uint32_t fwd = (1u << 0) | (1u << 1);
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        if (x >= 4 && x <= 7)  meso3_set(x, y, z, 1u << 0);
        if (x >= 32 && x <= 35) meso3_set(x, y, z, 1u << 1);
    }
    uint64_t before = chan_pop(fwd);
    uint64_t mass; int64_t px, py, pz;
    meso3_totals(&mass, &px, &py, &pz);

    for (int t = 0; t < 60; t++) meso3_tick();

    uint64_t after = chan_pop(fwd);
    uint64_t rest = chan_pop(1u << (NCH_ - 1));
    uint64_t mass2; meso3_totals(&mass2, &px, &py, &pz);
    printf("T2 counter-flow: injected=%llu mass=%llu | post-crossing: "
           "on-beam=%llu (%.1f%%) rest-quanta=%llu scattered=%llu\n",
           (unsigned long long)before, (unsigned long long)mass,
           (unsigned long long)after, 100.0 * after / mass2,
           (unsigned long long)rest, (unsigned long long)(mass2 - after));
}

static void shell_tensor(void) {
    const int (*cv)[3] = meso3_cv();
    long s4 = 0, s22 = 0;
    for (int c = 0; c < NCH_ - 1; c++) {
        s4  += cv[c][0] * cv[c][0] * cv[c][0] * cv[c][0];
        s22 += cv[c][0] * cv[c][0] * cv[c][1] * cv[c][1];
    }
    printf("    shell tensor:  Σcx^4 = %ld   3Σcx²cy² = %ld   ratio %.3f (iso=1)\n",
           s4, 3 * s22, s22 ? (double)s4 / (3 * s22) : 0.0);
}

static void equipartition(int ticks) {
    meso3_clear();
    randfill(0.20);
    for (int t = 0; t < ticks; t++) meso3_tick();
    uint64_t hist[19];
    meso3_channel_hist(hist);
    uint64_t tot = 0;
    for (int c = 0; c < NCH_; c++) tot += hist[c];
    double mean = (double)tot / NCH_, chi2 = 0;
    for (int c = 0; c < NCH_; c++) {
        double d = hist[c] - mean;
        chi2 += d * d / mean;
    }
    printf("T3 equipartition (axial=%d): mass=%llu chans=%d chi2/uniform=%.1f  [",
           NCH_ == 19, (unsigned long long)tot, NCH_, chi2);
    for (int c = 0; c < NCH_; c++)
        printf("%s%.3f", c ? " " : "", hist[c] / (double)tot);
    printf("]\n");
    shell_tensor();
}

/* weighted 4th-rank ratio from the channel histogram:
 *   R = Σ n_c cx^4 / (3 Σ n_c cx²cy²)   — isotropy needs R = 1 */
static double wt_tensor(void) {
    const int (*cv)[3] = meso3_cv();
    uint64_t hist[19];
    meso3_channel_hist(hist);
    double s4 = 0, s22 = 0;
    for (int c = 0; c < NCH_ - 1; c++) {
        s4  += (double)hist[c] * cv[c][0] * cv[c][0] * cv[c][0] * cv[c][0];
        s22 += (double)hist[c] * cv[c][0] * cv[c][0] * cv[c][1] * cv[c][1];
    }
    return s22 > 0 ? s4 / (3 * s22) : 0;
}

static void randfill2(double pf, double pa) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        uint32_t m = 0;
        for (int c = 0; c < 12; c++)
            if ((trnd() & 0xFFFF) < (uint32_t)(pf * 65536)) m |= 1u << c;
        for (int c = 12; c < NCH_ - 1; c++)
            if ((trnd() & 0xFFFF) < (uint32_t)(pa * 65536)) m |= 1u << c;
        if ((trnd() & 0xFFFF) < (uint32_t)(pf * 65536)) m |= 1u << (NCH_ - 1);
        if (m) meso3_set(x, y, z, m);
    }
}

/* T5: seed the axial shell at 1/8 face density; watch whether the weighted
 * tensor ratio holds ~1.0 or drifts back to the equal-occupancy 3.33. */
static void shell_weight(int mode, const char *tag) {
    meso3_clear();
    meso3_collmode(mode);
    randfill2(0.20, 0.025);
    printf("T5 %s: t=0 R=%.3f", tag, wt_tensor());
    for (int t = 1; t <= 400; t++) {
        meso3_tick();
        if (t == 50 || t == 100 || t == 200 || t == 400)
            printf("  t=%d R=%.3f", t, wt_tensor());
    }
    printf("\n");
    meso3_collmode(0);
}

/* T6: counter-flow under the forward-biased table (mode 2) */
static void counterflow2(void) {
    meso3_clear();
    meso3_collmode(2);
    uint32_t fwd = (1u << 0) | (1u << 1);
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        if (x >= 4 && x <= 7)   meso3_set(x, y, z, 1u << 0);
        if (x >= 32 && x <= 35) meso3_set(x, y, z, 1u << 1);
    }
    for (int t = 0; t < 60; t++) meso3_tick();
    uint64_t mass; int64_t px, py, pz;
    meso3_totals(&mass, &px, &py, &pz);
    uint64_t onb = chan_pop(fwd);
    printf("T6 fwd-biased counter-flow: on-beam=%llu (%.1f%%) rest=%llu\n",
           (unsigned long long)onb, 100.0 * onb / mass,
           (unsigned long long)chan_pop(1u << (NCH_ - 1)));
    meso3_collmode(0);
}

/* T7 Galilean probe — seed biased equilibrium with drift along the (1,1,0)
 * face diagonal (u_x = u_y = u/√2), equilibrate, extract
 *   g(ρ) = Π_xy / (M u_x u_y),  Π_xy = Σ n_c cx cy.
 * FHP theory for Boolean LGA: g(d) = (1-2d)/(1-d) → 0 at half-filling. */
static void galilean(double dfill, double s, int mode, const char *tag) {
    const int (*cv)[3] = meso3_cv();
    meso3_clear();
    meso3_collmode(mode);
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        uint32_t m = 0;
        for (int c = 0; c < NCH_ - 1; c++) {
            double bias = s * (cv[c][0] + cv[c][1]) / sqrt(2.0);
            double p = dfill * (1.0 + bias);
            if (p > 1) p = 1;
            if ((trnd() & 0xFFFF) < (uint32_t)(p * 65536)) m |= 1u << c;
        }
        if ((trnd() & 0xFFFF) < (uint32_t)(dfill * 65536)) m |= 1u << (NCH_ - 1);
        if (m) meso3_set(x, y, z, m);
    }
    for (int t = 0; t < 400; t++) meso3_tick();

    uint64_t hist[19];
    meso3_channel_hist(hist);
    double M = 0, Px = 0, Py = 0, Pxy = 0;
    for (int c = 0; c < NCH_ - 1; c++) {
        double n = (double)hist[c];
        M += n;
        Px += n * cv[c][0];
        Py += n * cv[c][1];
        Pxy += n * cv[c][0] * cv[c][1];
    }
    M += (double)hist[NCH_ - 1];
    double ux = Px / M, uy = Py / M;
    double g = (M * ux * uy != 0) ? Pxy / (M * ux * uy) : 0;
    printf("T7 %s d=%.2f: M=%.0f u=(%.4f,%.4f) Pxy=%.0f → g=%.3f  [FHP (1-2d)/(1-d)=%.3f]\n",
           tag, dfill, M, ux, uy, Pxy, g, (1 - 2 * dfill) / (1 - dfill));
    meso3_collmode(0);
}

/* ---- T8: integer-occupancy engine (meso3i) --------------------------- */

static void irandfill(double d) {
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        for (int c = 0; c < INCH_i; c++) {
            double r = d;
            while (r >= 1.0) { meso3i_set(x, y, z, c, meso3i_get(x, y, z, c) + 1); r -= 1; }
            if ((trnd() & 0xFFFF) < (uint32_t)(r * 65536))
                meso3i_set(x, y, z, c, meso3i_get(x, y, z, c) + 1);
        }
    }
}

static void iledger(int ticks, const char *tag) {
    uint64_t m0, m; int64_t px0, py0, pz0, px, py, pz;
    meso3i_totals(&m0, &px0, &py0, &pz0);
    int bad = 0;
    for (int t = 0; t < ticks; t++) {
        meso3i_tick();
        meso3i_totals(&m, &px, &py, &pz);
        if (m != m0 || px != px0 || py != py0 || pz != pz0) {
            if (!bad)
                printf("    first violation t=%d: dm=%lld dp=(%lld,%lld,%lld)\n",
                       t + 1, (long long)(m - m0),
                       (long long)(px - px0), (long long)(py - py0),
                       (long long)(pz - pz0));
            bad++;
        }
    }
    printf("T8i ledger %s: mass=%llu p=(%lld,%lld,%lld) violations=%d/%d\n",
           tag, (unsigned long long)m0,
           (long long)px0, (long long)py0, (long long)pz0, bad, ticks);
}

static void igalilean(double dfill, double s, int mode, const char *tag) {
    const int (*cv)[3] = meso3i_cv();
    meso3i_clear();
    meso3i_collmode(mode);
    for (int z = 0; z < D; z++)
    for (int y = 0; y < H; y++)
    for (int x = 0; x < W; x++) {
        if ((x + y + z) & 1) continue;
        for (int c = 0; c < INCH_i - 1; c++) {
            double bias = s * (cv[c][0] + cv[c][1]) / sqrt(2.0);
            double p = dfill * (1.0 + bias);
            if (p > 1) p = 1;
            if (p < 0) p = 0;
            if ((trnd() & 0xFFFF) < (uint32_t)(p * 65536))
                meso3i_set(x, y, z, c, 1);
        }
        if ((trnd() & 0xFFFF) < (uint32_t)(dfill * 65536))
            meso3i_set(x, y, z, INCH_i - 1, 1);
    }
    for (int t = 0; t < 400; t++) meso3i_tick();

    uint64_t hist[19];
    meso3i_hist(hist);
    double M = 0, Px = 0, Py = 0, Pxy = 0;
    for (int c = 0; c < INCH_i - 1; c++) {
        double n = (double)hist[c];
        M += n;
        Px += n * cv[c][0];
        Py += n * cv[c][1];
        Pxy += n * cv[c][0] * cv[c][1];
    }
    M += (double)hist[INCH_i - 1];
    double ux = Px / M, uy = Py / M;
    double g = (M * ux * uy != 0) ? Pxy / (M * ux * uy) : 0;
    printf("T8i %s d=%.2f: M=%.0f u=(%.4f,%.4f) → g=%.3f\n",
           tag, dfill, M, ux, uy, g);
    meso3i_collmode(0);
}

static void iequipartition(int ticks) {
    meso3i_clear();
    irandfill(0.30);
    for (int t = 0; t < ticks; t++) meso3i_tick();
    uint64_t hist[19];
    meso3i_hist(hist);
    uint64_t tot = 0;
    for (int c = 0; c < INCH_i; c++) tot += hist[c];
    printf("T8i equipartition (axial=%d): mass=%llu chans=%d  [",
           INCH_i == 19, (unsigned long long)tot, INCH_i);
    for (int c = 0; c < INCH_i; c++)
        printf("%s%.3f", c ? " " : "", hist[c] / (double)tot);
    printf("]\n");
}

/* T9: edge dwell — inject a sparse channel-0 (1,1,0) pulse, track x-centroid.
 * Expected v = 1/DWELL links/tick. Sparse fill ⇒ no collisions: pure
 * transport measurement of the fractional duty cycle. */
static void tof_dwell(int k) {
    meso3i_clear();
    meso3i_dwell(k);
    meso3i_collmode(0);
    for (int z = 0; z < D; z += 2)
    for (int y = 0; y < H; y += 2)
    for (int x = 4; x <= 7; x += 2)
        if (!((x + y + z) & 1))
            meso3i_set(x, y, z, 0, 1);          /* channel 0 = (+1,+1,0) */
    printf("T9 dwell=%d (predicted v=%.3f):", k, 1.0 / k);
    double x0 = 0, xend = 0;
    for (int t = 0; t <= 30; t++) {
        if (t == 0 || t == 10 || t == 20 || t == 30) {
            double cx = 0; uint64_t m = 0;
            for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                if ((x + y + z) & 1) continue;
                int n = 0;
                for (int c = 0; c < INCH_i - 1; c++)
                    n += meso3i_get(x, y, z, c) + (int)meso3i_edge(x, y, z, c);
                cx += n * x; m += n;
            }
            double xm = m ? cx / m : 0;
            if (t == 0) x0 = xm; else xend = xm;
            printf("  t=%d x̄=%.2f", t, xm);
        }
        if (t < 30) meso3i_tick();
    }
    printf("  → v_meas=%.3f\n", (xend - x0) / 30.0);
    meso3i_dwell(1);
}

/* T10: Route A bound-structure probes (meso3i).
 *   a) mono-channel slab blob at dwell k — {c,c} pairs are singleton
 *      classes on D3Q13, predicted rigid coherent translation at v=1/k.
 *   b) 50/50 ch0+ch4 blob — internal collisions should disperse it.
 *   c) bidirectional rhombus ring — bookkeeping predicts instant death:
 *      vertex pairs sum to momentum with zero ring-resident outputs.
 * Coherence = fraction of seed mass still within the seed slab channels;
 * drift = x-centroid slope. */
static void t10_blob(int dwell, int mixed) {
    meso3i_clear(); meso3i_dwell(dwell); meso3i_collmode(0);
    for (int z = 16; z <= 24; z++)
    for (int y = 16; y <= 24; y++)
    for (int x = 4; x <= 8; x += 2) {
        if ((x + y + z) & 1) continue;
        if (mixed) {
            /* ch0+ch2: {0,2} is a genuine 2-member class — collidable control */
            meso3i_set(x, y, z, (x + y + z) % 4 == 0 ? 0 : 2, 1);
        } else {
            meso3i_set(x, y, z, 0, 1);
        }
    }
    printf("T10%s dwell=%d:", mixed ? "b-mixed" : "a-mono", dwell);
    for (int t = 0; t <= 40; t++) {
        if (t % 10 == 0) {
            double cx = 0, cy = 0, in0 = 0; uint64_t m = 0;
            for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                if ((x + y + z) & 1) continue;
                int n = 0;
                for (int c = 0; c < INCH_i - 1; c++)
                    n += meso3i_get(x, y, z, c) + (int)meso3i_edge(x, y, z, c);
                cx += n * x; cy += n * y; m += n;
                in0 += meso3i_get(x, y, z, 0) + (int)meso3i_edge(x, y, z, 0);
            }
            double sy = 0; cy = m ? cy / m : 0;
            for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                if ((x + y + z) & 1) continue;
                int n = 0;
                for (int c = 0; c < INCH_i - 1; c++)
                    n += meso3i_get(x, y, z, c) + (int)meso3i_edge(x, y, z, c);
                sy += n * (y - cy) * (y - cy);
            }
            printf("  t=%d x̄=%.1f σy=%.1f ch0=%.0f%%",
                   t, m ? cx / m : 0, m ? sqrt(sy / m) : 0, m ? 100 * in0 / m : 0);
        }
        if (t < 40) meso3i_tick();
    }
    printf("\n");
    meso3i_dwell(1);
}

static void t10_ring(void) {
    /* rhombus vertices (offset to +coords); both directions seeded:
     * vertex gets {fwd_leg, rev_leg} pair so arrivals form antipodal pairs */
    int vx[4] = {20, 21, 20, 19}, vy[4] = {20, 21, 22, 21}, vz = 20;
    /* legs: v0->v1 ch0, v1->v2 ch3, v2->v3 ch1, v3->v0 ch2
     * reverse: v0->v3 ch3, v3->v2 ch0, v2->v1 ch2, v1->v0 ch1 */
    int out[4][2] = {{0,3},{3,1},{1,2},{2,0}};   /* {fwd,rev} per vertex */
    meso3i_clear(); meso3i_dwell(1); meso3i_collmode(0);
    for (int v = 0; v < 4; v++) {
        meso3i_set(vx[v], vy[v], vz, out[v][0], 1);
        meso3i_set(vx[v], vy[v], vz, out[v][1], 1);
    }
    printf("T10c rhombus ring (predicted dead):");
    for (int t = 0; t <= 20; t++) {
        int on = 0;
        for (int v = 0; v < 4; v++)
            for (int c = 0; c < INCH_i - 1; c++)
                on += meso3i_get(vx[v], vy[v], vz, c) + (int)meso3i_edge(vx[v], vy[v], vz, c);
        if (t % 4 == 0) printf("  t=%d ringmass=%d", t, on);
        if (t < 20) meso3i_tick();
    }
    printf("\n");
}

/* T11: rho-gated planar core — the domain-wall stability test.
 * Seed a 5x5 patch on z=20, 4 quanta/node spread across xy channels
 * (rho=4 >= gate). Below rho_crit nodes run the ergodic family; at/above
 * they run the planar-circulation subfamily. Measure:
 *   planemass = fraction of total mass on the z=20 plane
 *   boxmass   = fraction within the seed footprint x,y in [16,24]
 * If the gate binds, the core persists; if the wall leaks, it evaporates
 * into the ergodic bath. gate=0 control shows unprotected decay. */
static void t11_core3(int gate, int dwell, int per, int bias, int restseed, int cond);
static void t11_core2(int gate, int dwell, int per, int bias, int restseed);
static void t11_core(int gate, int dwell, int per, int bias) {
    t11_core2(gate, dwell, per, bias, 0);
}
static void t11_core2(int gate, int dwell, int per, int bias, int restseed) {
    t11_core3(gate, dwell, per, bias, restseed, 0);
}
static void t11_core3(int gate, int dwell, int per, int bias, int restseed, int cond) {
    meso3i_clear(); meso3i_dwell(dwell); meso3i_collmode(0);
    meso3i_gate(gate); meso3i_bias(bias); meso3i_condense(cond);
    int seed = 0;
    for (int y = 16; y <= 24; y++)
    for (int x = 16; x <= 24; x++) {
        if ((x + y + 20) & 1) continue;
        for (int c = 0; c < 4; c++) meso3i_set(x, y, 20, c, (uint8_t)per), seed += per;
        if (restseed) meso3i_set(x, y, 20, INCH_i - 1, (uint8_t)per), seed += per;
    }
    printf("T11 gate=%d bias=%d dwell=%d rest=%d cond=%d (seed=%d):",
           gate, bias, dwell, restseed, cond, seed);
    for (int t = 0; t <= 200; t++) {
        if (t % 25 == 0 || t == 199) {
            uint64_t m = 0, plane = 0, box = 0, boxrest = 0;
            int rmax = 0;
            for (int z = 0; z < D; z++)
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                if ((x + y + z) & 1) continue;
                int n = 0;
                for (int c = 0; c < INCH_i; c++)
                    n += meso3i_get(x, y, z, c) + (int)meso3i_edge(x, y, z, c);
                m += n;
                if (n > rmax) rmax = n;
                if (z == 20) plane += n;
                if (z == 20 && x >= 16 && x <= 24 && y >= 16 && y <= 24) {
                    box += n;
                    boxrest += meso3i_get(x, y, z, INCH_i - 1);
                }
            }
            printf("  t=%d plane=%.0f%% box=%.0f%% boxrest=%llu ρmax=%d", t,
                   m ? 100.0 * plane / m : 0, m ? 100.0 * box / m : 0,
                   (unsigned long long)boxrest, rmax);
        }
        if (t < 200) meso3i_tick();
    }
    uint64_t m; int64_t px, py, pz;
    meso3i_totals(&m, &px, &py, &pz);
    printf("  [conservation m=%llu p=(%lld,%lld,%lld)]\n",
           (unsigned long long)m, (long long)px, (long long)py, (long long)pz);
    meso3i_gate(0); meso3i_bias(0); meso3i_condense(0); meso3i_dwell(1);
}

int main(void) {
    printf("# M19 — Boolean LGA on True-FCC (channels=%d)\n", 13);

    NCH_ = 13;
    if (meso3_init(W, H, D, 0)) { printf("init fail\n"); return 1; }

    randfill(0.20);
    ledger(300, "D3Q13 randfill 20%");

    counterflow();
    equipartition(400);

    printf("# --- axial second shell (D3Q19) ---\n");
    NCH_ = 19;
    if (meso3_init(W, H, D, 1)) { printf("init fail\n"); return 1; }
    randfill(0.20);
    ledger(300, "D3Q19 randfill 20%");
    equipartition(400);

    printf("# --- shell weighting (w_axial/w_face = 1/8 target, R iso = 1.0) ---\n");
    shell_weight(0, "D3Q19 1/8-seeded, cyclic table");
    shell_weight(1, "D3Q19 1/8-seeded, shell-weighted table");

    printf("# --- forward-biased collision (mode 2, D3Q13) ---\n");
    NCH_ = 13;
    if (meso3_init(W, H, D, 0)) { printf("init fail\n"); return 1; }
    counterflow2();

    printf("# --- Galilean probe: g(ρ) = Pxy/(M ux uy), FHP curve (1-2d)/(1-d) ---\n");
    for (double d = 0.1; d <= 0.9; d += 0.2)
        galilean(d, 0.25, 0, "D3Q13 cyclic");
    galilean(0.5, 0.25, 2, "D3Q13 fwd-bias");

    printf("# --- Galilean probe on D3Q19 shell-weighted table ---\n");
    NCH_ = 19;
    if (meso3_init(W, H, D, 1)) { printf("init fail\n"); return 1; }
    for (double d = 0.1; d <= 0.5; d += 0.2)
        galilean(d, 0.25, 1, "D3Q19 shell8");

    printf("# === T8: integer-occupancy engine (meso3i, D3Q13) ===\n");
    INCH_i = 13;
    if (meso3i_init(W, H, D, 0)) { printf("init fail\n"); return 1; }
    irandfill(0.30);
    iledger(300, "int D3Q13 fill 30%");
    iequipartition(400);

    printf("# --- T8 Galilean sweep: does integer occupancy flatten g(rho)? ---\n");
    for (double d = 0.1; d <= 0.9; d += 0.2)
        igalilean(d, 0.25, 0, "int D3Q13");

    printf("# --- T8b u->0 convergence of the g plateau (int D3Q13, d=0.3) ---\n");
    for (double s = 0.05; s <= 0.26; s += 0.10)
        igalilean(0.30, s, 0, "int D3Q13 u-sweep");
    igalilean(0.30, 0.02, 0, "int D3Q13 u-sweep");

    printf("# --- T9 edge dwell: fractional duty-cycle velocity (int D3Q13) ---\n");
    meso3i_dwell(2);
    irandfill(0.30);
    iledger(200, "int D3Q13 dwell=2");
    meso3i_dwell(1);
    tof_dwell(1);
    tof_dwell(2);
    tof_dwell(4);

    printf("# --- T10 Route A: bound-structure probes (int D3Q13) ---\n");
    t10_blob(1, 0);
    t10_blob(2, 0);
    t10_blob(4, 0);
    t10_blob(2, 1);
    t10_ring();

    printf("# --- T11 rho-gated planar core (int D3Q13) ---\n");
    t11_core(0, 1, 2, 0);   /* ungated control */
    t11_core(4, 1, 2, 0);   /* gate only — lamination, no confinement */
    t11_core(4, 2, 2, 0);   /* gate + dwell */

    printf("# --- T12 M21: density-gradient deflection phase sweep ---\n");
    t11_core(4, 1, 2, 1);   /* weak attraction */
    t11_core(4, 1, 2, 4);   /* moderate */
    t11_core(4, 1, 2, 16);  /* strong — runaway check */
    t11_core(4, 2, 2, 4);   /* moderate at dwell=2 */
    t11_core(0, 1, 2, 4);   /* bias everywhere, no planar gate */
    t11_core(0, 1, 2, 16);  /* bias everywhere, strong */
    t11_core2(4, 1, 2, 16, 1); /* rest-anchored core (condensation test) */
    t11_core2(0, 1, 2, 16, 1); /* rest anchor, bias only */
    t11_core3(4, 1, 2, 16, 0, 32); /* condensation ratchet, no rest seed */
    t11_core3(4, 2, 2, 16, 0, 32); /* ratchet at dwell=2 */

    printf("# --- T8 D3Q19 shell-weighted integer engine ---\n");
    INCH_i = 19;
    if (meso3i_init(W, H, D, 1)) { printf("init fail\n"); return 1; }
    irandfill(0.30);
    iledger(300, "int D3Q19 fill 30%");
    iequipartition(400);
    for (double d = 0.1; d <= 0.5; d += 0.2)
        igalilean(d, 0.25, 1, "int D3Q19 shell8");

    return 0;
}
