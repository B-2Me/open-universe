/* meso3.c — M19: Boolean multi-channel lattice gas on the True-FCC sublattice.
 *
 * Sites: cubic grid points with (x+y+z) even — the FCC nearest-neighbor shell.
 * Channels per site:
 *   bits 0..11 : directional quanta on the 12 face-diagonal ports (±1,±1,0)-type
 *   bits 12..17: [axial=1 only] second shell, 6 axial next-nearest (±2,0,0)-type
 *   bit  NCH-1 : rest channel (v=0 quantum, momentum zero)
 * Occupancy is Boolean per channel (FHP-class LGA). Dims must be even so the
 * periodic wrap preserves site parity.
 *
 * Tick = collide then stream:
 *   collide — every site's mask is replaced by TABLE[mask], a fixed
 *             mass+momentum-conserving permutation of its equivalence class
 *             (classes enumerated over all 2^NCH masks at init).
 *   stream  — each directional bit hops one link along its channel vector;
 *             the rest bit stays. All arrivals land in the same channel index
 *             at the destination (channel = absolute direction of motion).
 *
 * Conservation is exact by construction: TABLE maps each input to another
 * member of the same (popcount, Σc_i) class, streaming is a permutation of
 * occupied channels, and Boolean occupancy prevents co-occupancy.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static const int8_t DIR12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t DIR6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static int      W3m, H3m, D3m, N3m;
static int      NCH;                 /* 13 (D3Q13) or 19 (D3Q19) */
static int      NMOV;                /* directional channels = NCH-1 */
static uint32_t RESTBIT;
static uint32_t NMASKS;
static int      CV[19][3];           /* channel momentum vectors (integer) */
static uint32_t *mA, *mB;            /* ping-pong mask planes */
static uint32_t *TABLE;

/* class structure for stochastic collision modes */
static int      COLLMODE;            /* 0=cyclic 1=shell8 2=forward-bias */
static uint32_t NCLS;
static uint32_t *CID;                /* class id per input mask */
static uint32_t *CMEM;               /* flattened member masks */
static uint16_t *CWGT;               /* member weight (axial bits → 256>>3n) */
static uint32_t *COFF, *CLEN;        /* per-class offset/length into CMEM */

static uint32_t rng3 = 0x9E3779B9u;
static inline uint32_t rng_next3(void) {
    rng3 ^= rng3 << 13; rng3 ^= rng3 >> 17; rng3 ^= rng3 << 5;
    return rng3;
}

static inline int site_ok(int x, int y, int z) { return ((x + y + z) & 1) == 0; }
static inline int sidx(int x, int y, int z) { return (z * H3m + y) * W3m + x; }
static inline int wrapm(int v, int n) { v %= n; return v < 0 ? v + n : v; }

/* ---- collision table -------------------------------------------------- */

static int cmp_u64(const void *a, const void *b) {
    uint64_t x = *(const uint64_t *)a, y = *(const uint64_t *)b;
    return x < y ? -1 : (x > y);
}

/* key = (mass,px,py,pz) packed; sort masks by key; cyclic-shift within each
 * equivalence class run after a seeded Fisher-Yates of the run ordering. */
static void build_table(void) {
    uint64_t *kv = malloc(sizeof(uint64_t) * NMASKS);
    uint32_t *cls = malloc(sizeof(uint32_t) * NMASKS);
    for (uint32_t m = 0; m < NMASKS; m++) {
        int mass = 0, px = 0, py = 0, pz = 0;
        for (int c = 0; c < NCH; c++) {
            if (m & (1u << c)) {
                mass++;
                px += CV[c][0]; py += CV[c][1]; pz += CV[c][2];
            }
        }
        uint64_t key = (uint64_t)mass
                     | ((uint64_t)(px + 64) << 5)
                     | ((uint64_t)(py + 64) << 13)
                     | ((uint64_t)(pz + 64) << 21);
        kv[m] = (key << 32) | m;
    }
    qsort(kv, NMASKS, sizeof(uint64_t), cmp_u64);

    /* count classes, then fill member lists + shell weights */
    uint32_t ncls = 0;
    for (uint32_t i = 0; i < NMASKS; i++)
        if (i == 0 || (kv[i] >> 32) != (kv[i - 1] >> 32)) ncls++;
    NCLS = ncls;
    CID  = malloc(sizeof(uint32_t) * NMASKS);
    CMEM = malloc(sizeof(uint32_t) * NMASKS);
    CWGT = malloc(sizeof(uint16_t) * NMASKS);
    COFF = malloc(sizeof(uint32_t) * ncls);
    CLEN = malloc(sizeof(uint32_t) * ncls);

    uint32_t i = 0, cid = 0, off = 0;
    while (i < NMASKS) {
        uint64_t key = kv[i] >> 32;
        uint32_t j = i;
        while (j < NMASKS && (kv[j] >> 32) == key) {
            uint32_t m = (uint32_t)(kv[j] & 0xFFFFFFFFu);
            cls[j - i] = m;
            CID[m] = cid;
            CMEM[off + j - i] = m;
            /* shell weight: 1 for pure face/rest, 1/8 per axial bit */
            int na = 0;
            for (int c = 12; c < NMOV; c++) if (m & (1u << c)) na++;
            CWGT[off + j - i] = (uint16_t)(na > 2 ? 1 : (256 >> (3 * na)));
            j++;
        }
        uint32_t len = j - i;
        COFF[cid] = off; CLEN[cid] = len; off += len;
        if (len == 1) {
            TABLE[cls[0]] = cls[0];              /* ballistic singleton */
        } else {
            for (uint32_t k = len - 1; k > 0; k--) {
                uint32_t r = rng_next3() % (k + 1);
                uint32_t t = cls[k]; cls[k] = cls[r]; cls[r] = t;
            }
            for (uint32_t k = 0; k < len; k++)
                TABLE[cls[k]] = cls[(k + 1) % len];
        }
        i = j; cid++;
    }
    free(kv); free(cls);
}

void meso3_collmode(int mode) { COLLMODE = mode; }

/* stochastic pick within the input's class. Mode 1: weight ∝ (1/8)^(axial
 * bits) — sustains the w_axial/w_face = 1/8 ensemble weight the 4th-rank
 * isotropy condition requires. Mode 2: 7/8 identity (forward exit), else
 * uniform class member — biases head-on traffic toward ballistic transit.
 * Output is always a class member, so conservation stays exact. */
static uint32_t collide_one(uint32_t m) {
    uint32_t cid = CID[m], off = COFF[cid], len = CLEN[cid];
    if (len == 1) return m;
    if (COLLMODE == 2) {
        if (rng_next3() % 8 < 7) return m;
        return CMEM[off + rng_next3() % len];
    }
    uint32_t tot = 0;
    for (uint32_t k = 0; k < len; k++) tot += CWGT[off + k];
    uint32_t r = rng_next3() % tot;
    for (uint32_t k = 0; k < len; k++) {
        if (r < CWGT[off + k]) return CMEM[off + k];
        r -= CWGT[off + k];
    }
    return m;
}

/* ---- engine ------------------------------------------------------------ */

int meso3_init(int w, int h, int d, int axial) {
    if ((w | h | d) & 1) return -1;            /* dims must be even */
    W3m = w; H3m = h; D3m = d; N3m = w * h * d;
    NMOV = 12 + (axial ? 6 : 0);
    NCH = NMOV + 1;
    NMASKS = 1u << NCH;
    RESTBIT = 1u << (NCH - 1);
    for (int c = 0; c < 12; c++)
        for (int k = 0; k < 3; k++) CV[c][k] = DIR12[c][k];
    for (int c = 0; c < 6; c++)
        for (int k = 0; k < 3; k++) CV[12 + c][k] = DIR6[c][k];
    CV[NCH - 1][0] = CV[NCH - 1][1] = CV[NCH - 1][2] = 0;

    TABLE = malloc(sizeof(uint32_t) * NMASKS);
    mA = calloc(N3m, sizeof(uint32_t));
    mB = calloc(N3m, sizeof(uint32_t));
    if (!TABLE || !mA || !mB) return -2;
    build_table();
    return 0;
}

void meso3_clear(void) { memset(mA, 0, sizeof(uint32_t) * N3m); }

uint32_t meso3_get(int x, int y, int z) {
    x = wrapm(x, W3m); y = wrapm(y, H3m); z = wrapm(z, D3m);
    return mA[sidx(x, y, z)];
}
void meso3_set(int x, int y, int z, uint32_t mask) {
    x = wrapm(x, W3m); y = wrapm(y, H3m); z = wrapm(z, D3m);
    if (!site_ok(x, y, z)) return;
    mA[sidx(x, y, z)] = mask & (NMASKS - 1);
}

void meso3_tick(void) {
    if (COLLMODE == 0) {
        for (int i = 0; i < N3m; i++)
            if (mA[i]) mA[i] = TABLE[mA[i]];
    } else {
        for (int i = 0; i < N3m; i++)
            if (mA[i]) mA[i] = collide_one(mA[i]);
    }

    memset(mB, 0, sizeof(uint32_t) * N3m);
    for (int z = 0; z < D3m; z++)
    for (int y = 0; y < H3m; y++)
    for (int x = 0; x < W3m; x++) {
        if (!site_ok(x, y, z)) continue;
        uint32_t m = mA[sidx(x, y, z)];
        if (!m) continue;
        int di = sidx(x, y, z);
        mB[di] |= m & RESTBIT;
        for (int c = 0; c < NMOV; c++) {
            if (m & (1u << c)) {
                int nx = wrapm(x + CV[c][0], W3m);
                int ny = wrapm(y + CV[c][1], H3m);
                int nz = wrapm(z + CV[c][2], D3m);
                mB[sidx(nx, ny, nz)] |= 1u << c;
            }
        }
    }
    uint32_t *t = mA; mA = mB; mB = t;
}

/* ---- probes ------------------------------------------------------------ */

void meso3_totals(uint64_t *mass, int64_t *px, int64_t *py, int64_t *pz) {
    uint64_t m = 0; int64_t x_ = 0, y_ = 0, z_ = 0;
    for (int i = 0; i < N3m; i++) {
        uint32_t mk = mA[i];
        if (!mk) continue;
        for (int c = 0; c < NCH; c++)
            if (mk & (1u << c)) {
                m++;
                x_ += CV[c][0]; y_ += CV[c][1]; z_ += CV[c][2];
            }
    }
    *mass = m; *px = x_; *py = y_; *pz = z_;
}

/* per-channel population histogram */
void meso3_channel_hist(uint64_t *out) {
    memset(out, 0, sizeof(uint64_t) * NCH);
    for (int i = 0; i < N3m; i++) {
        uint32_t mk = mA[i];
        while (mk) {
            int c = __builtin_ctz(mk);
            mk &= mk - 1;
            out[c]++;
        }
    }
}

int  meso3_nch(void) { return NCH; }
const int (*meso3_cv(void))[3] { return (const int (*)[3])CV; }
