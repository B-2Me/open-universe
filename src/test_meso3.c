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
int      meso3_nch(void);
const int (*meso3_cv(void))[3];

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

    return 0;
}
