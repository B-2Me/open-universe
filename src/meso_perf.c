/* meso_perf.c — active-site-optimized kernel. Identical physics to
 * meso_core/meso3i but iterates only occupied sites. Bitwise-parity
 * is preserved: empty cells consume zero RNG in all engines, so
 * skipping them changes speed, never the random stream. */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define IMOV 18
#define INCH 19
#define REST (INCH - 1)
#define NNU  1                       /* core: single photon species */

typedef struct __attribute__((aligned(64))) {
    uint8_t mass[INCH];
    uint8_t drest[IMOV];
    uint8_t phot[IMOV];
    uint8_t n;
    uint8_t lt;
    uint8_t pt;
    uint8_t pad[6];
} PlanckNode;

static const int8_t ICV[INCH][3] = {
    { 1, 1, 0},{-1,-1, 0},{ 1,-1, 0},{-1, 1, 0},
    { 1, 0, 1},{-1, 0,-1},{ 1, 0,-1},{-1, 0, 1},
    { 0, 1, 1},{ 0,-1,-1},{ 0, 1,-1},{ 0,-1, 1},
    { 2, 0, 0},{-2, 0, 0},{ 0, 2, 0},{ 0,-2, 0},{ 0, 0, 2},{ 0, 0,-2},
    { 0, 0, 0}
};

static int      IW, IH, ID, IN;
static PlanckNode *NA, *NB;
static uint32_t  irng = 0xC0FFEEu;
static int       IFRIC, IFRICP = 128, IFRICM, IREFL, ILAT = 8;
static int       EMASK = 7, IPAIR, IPHOT, IPHN, ITICK;
static int       IPTH, IPTB, IFUS, IFCAD, IRECOMB, IANNIH, *iR;
static uint8_t  *iACT;              /* nonzero -> site occupied */
static int      *iALIST;            /* active site list (cur tick) */
static int      *iNLIST;            /* next-tick list */
static int       NACT;              /* active count */
static uint8_t  *iPTF;              /* persistent flat iPT (quiet sites stay 0) */
static uint32_t *iNNF;              /* generation flag: in next list */
static int      *iFLIST;            /* merged final list */
static int icmp_(const void *a, const void *b) { return *(const int *)a - *(const int *)b; }
static uint32_t  NGEN;              /* current generation */
static int      *iR;
static int64_t   iEV[8];

static inline uint32_t irnd(void) {
    irng ^= irng << 13; irng ^= irng >> 17; irng ^= irng << 5;
    return irng;
}
static inline int isite(int x, int y, int z) { return !((x + y + z) & 1); }
static inline int iidx(int x, int y, int z)  { return (z * IH + y) * IW + x; }
static inline int iwrap(int v, int n) { v %= n; return v < 0 ? v + n : v; }

/* ---- collision group tables: pairs {i,j} grouped by equal momentum ---- */
static uint16_t GID[INCH][INCH];
static uint8_t  GPAIRS[400][2];
static uint16_t GOFF[300], GLEN[300], GWGT[400];
static int NGRP;

static void build_pairs(void) {
    NGRP = 0;
    memset(GID, 0xFF, sizeof GID);
    memset(GLEN, 0, sizeof GLEN);
    memset(GOFF, 0, sizeof GOFF);
    int8_t gsum[300][3];
    uint16_t cur[300] = {0};
    for (int i = 0; i < INCH; i++)
    for (int j = i; j < INCH; j++) {
        int sx = ICV[i][0] + ICV[j][0];
        int sy = ICV[i][1] + ICV[j][1];
        int sz = ICV[i][2] + ICV[j][2];
        int g = -1;
        for (int k = 0; k < NGRP; k++)
            if (gsum[k][0] == sx && gsum[k][1] == sy && gsum[k][2] == sz) { g = k; break; }
        if (g < 0) { g = NGRP++; gsum[g][0] = sx; gsum[g][1] = sy; gsum[g][2] = sz; }
        GID[i][j] = (uint8_t)g;
        GLEN[g]++;
    }
    GOFF[0] = 0;
    for (int g = 1; g < NGRP; g++) GOFF[g] = GOFF[g - 1] + GLEN[g - 1];
    for (int i = 0; i < INCH; i++)
    for (int j = i; j < INCH; j++) {
        int g = GID[i][j];
        int slot = GOFF[g] + cur[g]++;
        GPAIRS[slot][0] = (uint8_t)i;
        GPAIRS[slot][1] = (uint8_t)j;
        int na = (i >= 12 && i < IMOV) + (j >= 12 && j < IMOV);
        GWGT[slot] = (uint16_t)(na > 2 ? 1 : (256 >> (3 * na)));
    }
}

static int pick_chan_x(const uint8_t *n, int r, int excl, int skip) {
    for (int c = 0; c < INCH; c++) {
        if (c == excl) continue;
        int cnt = n[c] - (c == skip);
        if (cnt <= 0) continue;
        if (r < cnt) return c;
        r -= cnt;
    }
    return -1;
}

static int drest_sum(const PlanckNode *n) {
    int d = 0;
    for (int c = 0; c < IMOV; c++) d += n->drest[c];
    return d;
}
static int phot_at(const PlanckNode *n) {
    int p = 0;
    for (int c = 0; c < IMOV; c++) p += n->phot[c];
    return p;
}

/* collide_node — exact port of meso3i's five stages, adapted to PlanckNode.
 * Writes post-collision state into nb at the same site (local only). */
static void collide_node(const PlanckNode *na, PlanckNode *nb) {
    /* carry stationary registers */
    nb->n = na->n;
    nb->pt = na->pt;
    memcpy(nb->drest, na->drest, IMOV);
    memcpy(nb->phot,  na->phot,  IMOV);
    memcpy(nb->mass,  na->mass,  INCH);
    uint8_t *n = nb->mass;

    int rest = IFRICM ? n[REST] : 0;
    int m = 0;
    for (int c = 0; c < INCH; c++) m += n[c];
    m -= rest;
    nb->lt = m ? (na->lt < 255 ? na->lt + 1 : 255) : 0;

    int dsum = drest_sum(nb);
    int parked = n[REST] + dsum;
    if (IFRICM && parked && (IFRICM > 0 || nb->lt >= ILAT ||
                             (IPHOT == 1 && phot_at(nb)))) {
        int k = IFRICM < 0 ? -IFRICM : IFRICM;
        for (int u = 0; u < n[REST] + dsum; u++) {
            if (irnd() % (4 * k) != 0) continue;
            int tot = n[REST] + dsum;
            int pick = tot > 0 ? (int)(irnd() % (uint32_t)tot) : 0;
            if (pick < n[REST]) {
                if (IPAIR && n[REST] >= 2) {
                    int c = irnd() % IMOV;
                    n[REST] -= 2;
                    n[c]++; n[c ^ 1]++;
                    iEV[2] += 2;
                } else if (IPHOT >= 4) {
                    int c = irnd() % IMOV;
                    n[REST]--;
                    nb->phot[c]++; IPHN++;
                    iEV[2]++;
                } else {
                    n[REST]--; n[irnd() % IMOV]++;
                    iEV[2]++;
                }
            } else {
                int w = pick - n[REST], c = 0;
                for (; c < IMOV - 1; c++) { if (w < nb->drest[c]) break; w -= nb->drest[c]; }
                nb->drest[c]--; dsum--;
                n[c]++;
                iEV[2]++;
            }
        }
    }

    /* drest annihilation (fusion inverse): opposing bins -> photon pair */
    if (IANNIH) {
        for (int c = 0; c < IMOV; c += 2)
            while (nb->drest[c] && nb->drest[c ^ 1] && (int)(irnd() & 255) < IANNIH) {
                nb->drest[c]--; nb->drest[c ^ 1]--;
                nb->phot[c]++; nb->phot[c ^ 1]++;
                IPHN += 2; iEV[4] += 2;
            }
    }

    /* thermal decay: IPHOT>=7 per-quantum (nu drawn from occupation —
     * core has no nu bins: emit nu=1, cost 1) vs flat for IPHOT>=5 */
    if (IPHOT >= 7 && nb->n) {
        int lv = nb->n;
        for (int u = 0; u < lv; u++) {
            if (!nb->n) break;
            if ((irnd() & EMASK) == 0) {
                int cap = nb->n < NNU ? nb->n : NNU;
                int nu = 1 + (int)(irnd() % (uint32_t)cap);
                nb->n -= nu;
                nb->phot[irnd() % IMOV]++; IPHN++;
            }
        }
    } else if (IPHOT >= 5 && nb->n && (irnd() & EMASK) == 0) {
        nb->n--;
        nb->phot[irnd() % IMOV]++; IPHN++;
    }

    /* IPAIR: antipodal moving pairs bind into rest at ~1/(4k) */
    if (IPAIR) {
        int k = IFRICM ? (IFRICM < 0 ? -IFRICM : IFRICM) : 4;
        for (int c = 0; c + 1 < IMOV; c += 2)
            if (n[c] && n[c + 1] && irnd() % (4 * k) == 0) {
                n[c]--; n[c + 1]--;
                iEV[1] += 2;
                if (nb->drest[c] < 255) nb->drest[c]++;
                if (nb->drest[c + 1] < 255) nb->drest[c + 1]++;
            }
    }

    if (m < 2) return;
    int excl = IFRICM ? REST : -1;
    int attempts = m >> 1;
    if (!attempts) attempts = 1;
    for (int a = 0; a < attempts; a++) {
        int i = pick_chan_x(n, irnd() % m, excl, -1);
        int j = pick_chan_x(n, irnd() % (m - 1), excl, i);
        if (i < 0 || j < 0) continue;
        int lo = i < j ? i : j, hi = i < j ? j : i;
        int g = GID[lo][hi];
        int len = GLEN[g];
        if (len <= 1) continue;
        /* canonical: uniform member pick (weighted flags stripped) */
        int k = (int)(irnd() % (uint32_t)len);
        int ko = GPAIRS[GOFF[g] + k][0], lo2 = GPAIRS[GOFF[g] + k][1];
        n[i]--; n[j]--; n[ko]++; n[lo2]++;
    }
}

/* ---------- lifecycle / accessors / knobs ---------- */
void meso3i_init(int w, int h, int d, int axial) {
    /* parity with meso3i: arg 4 is the axial-channel flag, NOT a seed.
     * irng persists across init (default 0xC0FFEE; meso3i_seed() sets). */
    (void)axial;
    IW = w; IH = h; ID = d; IN = IW * IH * ID;
    free(NA); free(NB); free(iR); iR = 0;
    free(iACT); free(iALIST); free(iNLIST); free(iNNF);
    iACT   = calloc((size_t)IN, 1);
    iALIST = malloc((size_t)IN * sizeof(int));
    iNLIST = malloc((size_t)IN * sizeof(int));
    iFLIST = malloc((size_t)IN * sizeof(int));
    iNNF   = calloc((size_t)IN, sizeof(uint32_t));
    iPTF   = calloc((size_t)IN, 1);
    NACT = 0; NGEN = 0;
    NA = calloc((size_t)IN, sizeof(PlanckNode));
    NB = calloc((size_t)IN, sizeof(PlanckNode));
    IPHN = ITICK = 0;
    memset(iEV, 0, sizeof(iEV));
    build_pairs();
}
void meso3i_seed(int s) { irng = (uint32_t)s; }

void meso3i_set(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= INCH) return;
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) { int si = iidx(x, y, z); NA[si].mass[c] = v;
        if (v && !iACT[si]) { iACT[si] = 1; iALIST[NACT++] = si; } }
}
uint8_t meso3i_get(int x, int y, int z, int c) {
    if (c < 0 || c >= INCH) return 0;
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].mass[c];
}
uint8_t meso3i_rget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].drest[c];
}
void meso3i_phset(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= IMOV) return;
    int si = iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID));
    IPHN += (int)v - NA[si].phot[c];
    NA[si].phot[c] = v;
    if (v && !iACT[si]) { iACT[si] = 1; iALIST[NACT++] = si; }
}
uint8_t meso3i_phget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].phot[c];
}
uint8_t meso3i_eget(int x, int y, int z) {
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].n;
}
void meso3i_eset(int x, int y, int z, int v) {
    x = iwrap(x, IW); y = iwrap(y, IH); z = iwrap(z, ID);
    if (isite(x, y, z)) { int si = iidx(x, y, z); NA[si].n = (uint8_t)v;
        if (v && !iACT[si]) { iACT[si] = 1; iALIST[NACT++] = si; } }
}
uint8_t meso3i_ptget(int x, int y, int z) {
    return iPTF[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))];
}
uint8_t meso3i_ltget(int x, int y, int z) {
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].lt;
}
int meso3i_photons(void) { return IPHN; }
int meso3i_nch(void) { return INCH; }
int meso3i_dim(int a) { return a == 0 ? IW : a == 1 ? IH : ID; }
int meso3i_rest_mass(void) {
    long m = 0;
    for (int s = 0; s < IN; s++) {
        m += NA[s].mass[REST];
        for (int c = 0; c < IMOV; c++) m += NA[s].drest[c];
    }
    return (int)m;
}
int meso3i_mov_mass(void) {
    long m = 0;
    for (int s = 0; s < IN; s++)
        for (int c = 0; c < IMOV; c++) m += NA[s].mass[c];
    return (int)m;
}
int64_t meso3i_ev(int i) { return i < 0 || i >= 8 ? 0 : iEV[i]; }
void meso3i_ev_reset(void) { memset(iEV, 0, sizeof(iEV)); }

void meso3i_friction(int k)  { IFRIC = k; }
void meso3i_fricp(int n)     { IFRICP = n; }
void meso3i_fricmode(int m)  { IFRICM = m; }
void meso3i_reflect(int k)   { IREFL = k; }
void meso3i_erate(int m)     { EMASK = m; }
void meso3i_lat(int n)       { ILAT = n; }
void meso3i_pair(int m)      { IPAIR = m; }
void meso3i_phot(int m)      { IPHOT = m; }
void meso3i_friccurve(int m) { (void)m; }   /* stripped: flat IFRICP */
/* compat no-ops: exploratory scaffolding absent in core */
void meso3i_collmode(int m)  { (void)m; }
void meso3i_drest(int m)     { (void)m; }
void meso3i_phth(int t)      { IPTH = t; }
void meso3i_nushift(int k)   { (void)k; }
void meso3i_iptbar(int k)    { IPTB = k; }
void meso3i_fusemin(int k)   { IFUS = k; }
void meso3i_fusecad(int k)   { IFCAD = k; }
void meso3i_recomb(int k)    { IRECOMB = k; }
void meso3i_annih(int k)     { IANNIH = k; }
void meso3i_dwell(int k)     { (void)k; }
void meso3i_rg_refresh(void) { }

/* ---------- tick — lockstep port of meso3i's canonical order ----------
 * 1. iR pre-collision density snapshot (mass + drest, all cells)
 * 2. collide_node per site (flat si order) -> NB
 * 3. mass stream NB -> NA: friction batch roll, IREFL deterministic
 * 4. photon stream NB -> NA: absorb/ablate vs post-stream parked
 * 5. iPT update + pair production on the fresh plane
 * State lands back in NA — no swap needed. */
void meso3i_tick(void) {
    PlanckNode *A = NA, *B = NB;
    if (!iR) iR = malloc((size_t)IN * sizeof(int));
    ++NGEN;
    int nn = 0;                         /* next-list count */
    qsort(iALIST, NACT, sizeof(int), icmp_);   /* si-ascending = meso3i's z,y,x order */

    /* 1. pre-collision density snapshot — actives only */
    memset(iR, 0, (size_t)IN * sizeof(int));
    for (int i = 0; i < NACT; i++) {
        int s = iALIST[i];
        int r = NA[s].mass[REST];
        for (int c = 0; c < IMOV; c++) r += NA[s].mass[c] + NA[s].drest[c];
        iR[s] = r;
    }

    /* 2. node collisions — active sites only (empty cells draw
     *    zero RNG in all engines, so skipping preserves parity) */
    for (int i = 0; i < NACT; i++)
        collide_node(NA + iALIST[i], B + iALIST[i]);

    /* carry + clear: actives get full stationary regs AND zeroed
     * channel fields (arrivals accumulate onto zeros) — replaces
     * the O(IN) full-plane memset */
    for (int i = 0; i < NACT; i++) {
        int s = iALIST[i];
        A[s].n = B[s].n; A[s].lt = B[s].lt; A[s].pt = B[s].pt;
        memset(A[s].mass, 0, IMOV);
        memset(A[s].phot, 0, IMOV);
        A[s].mass[REST] = B[s].mass[REST];
        memcpy(A[s].drest, B[s].drest, IMOV);
    }

    /* 3. mass stream over actives; mark destinations for next tick */
    for (int i = 0; i < NACT; i++) {
        int si = iALIST[i];
        const PlanckNode *nb = B + si;
        PlanckNode *na = A + si;
        int x = si % IW, y = (si / IW) % IH, z = si / (IW * IH);
        for (int c = 0; c < IMOV; c++) {
            int p = nb->mass[c];
            if (!p) continue;
            int ni = iidx(iwrap(x + ICV[c][0], IW),
                          iwrap(y + ICV[c][1], IH),
                          iwrap(z + ICV[c][2], ID));
            if (iNNF[ni] != NGEN) { iNNF[ni] = NGEN; iNLIST[nn++] = ni; if (!iACT[ni]) memset(&A[ni], 0, sizeof(PlanckNode)); } iACT[ni] = 1;
            if (IFRIC && iR[ni] >= IFRIC &&
                (int)(irnd() & 255) < IFRICP) {
                if (IRECOMB && (int)(irnd() & 255) < IRECOMB) {
                    uint32_t v2 = A[ni].phot[c] + p;
                    A[ni].phot[c] = v2 > 255 ? 255 : (uint8_t)v2;
                    IPHN += p;
                    iEV[0] += p;
                    continue;
                }
                if (IPHOT >= 6) {
                    uint32_t v = A[ni].n + p;
                    A[ni].n = v > 255 ? 255 : (uint8_t)v;
                } else {
                    uint32_t v = A[ni].drest[c] + p;
                    A[ni].drest[c] = v > 255 ? 255 : (uint8_t)v;
                }
                iEV[0] += p;
                continue;
            }
            if (IREFL && iR[ni] >= IREFL) {
                uint32_t v = na->mass[c ^ 1] + p;
                na->mass[c ^ 1] = v > 255 ? 255 : (uint8_t)v;
                iEV[6] += p;
                continue;
            }
            uint32_t v = A[ni].mass[c] + p;
            A[ni].mass[c] = v > 255 ? 255 : (uint8_t)v;
        }
    }

    /* 4. photon stream + absorb/ablate over actives */
    if (IPHN) {
        for (int i = 0; i < NACT; i++) {
            int si = iALIST[i];
            const PlanckNode *nb = B + si;
            int x = si % IW, y = (si / IW) % IH, z = si / (IW * IH);
            for (int c = 0; c < IMOV; c++) {
                int p = nb->phot[c];
                if (!p) continue;
                int ni = iidx(iwrap(x + ICV[c][0], IW),
                              iwrap(y + ICV[c][1], IH),
                              iwrap(z + ICV[c][2], ID));
                if (iNNF[ni] != NGEN) { iNNF[ni] = NGEN; iNLIST[nn++] = ni; if (!iACT[ni]) memset(&A[ni], 0, sizeof(PlanckNode)); } iACT[ni] = 1;
                if (IPHOT >= 3 && iPTF[ni] >= IPTB && 1 >= IPTH) {
                    int parked = A[ni].mass[REST] + drest_sum(A + ni);
                    int absorbed = 0;
                    if (IPHOT >= 5) {
                        for (int u = 0; u < p; u++)
                            if (parked && (int)(irnd() & 255) < parked) {
                                uint32_t e = A[ni].n + 1;
                                A[ni].n = e > 255 ? 255 : (uint8_t)e;
                                absorbed++;
                            }
                    } else {
                        for (int u = 0; u < p; u++)
                            if (parked && (int)(irnd() & 255) < parked) {
                                int pick = parked > A[ni].mass[REST]
                                    ? (int)(irnd() % (uint32_t)parked) : 0;
                                if (pick < A[ni].mass[REST]) {
                                    A[ni].mass[REST]--;
                                } else {
                                    PlanckNode *dn = A + ni;
                                    int w = pick - dn->mass[REST], c2 = 0;
                                    for (; c2 < IMOV - 1; c2++)
                                        { if (w < dn->drest[c2]) break; w -= dn->drest[c2]; }
                                    dn->drest[c2]--;
                                }
                                parked--; absorbed++;
                                uint32_t v = A[ni].mass[c] + 1;
                                A[ni].mass[c] = v > 255 ? 255 : (uint8_t)v;
                            }
                    }
                    p -= absorbed;
                    IPHN -= absorbed;
                    iEV[5] += absorbed;
                    if (!p) continue;
                }
                if (IPHOT == 2) {
                    int parked = A[ni].mass[REST] + drest_sum(A + ni);
                    for (int u = 0; u < p; u++)
                        if (parked && (int)(irnd() & 255) < parked) {
                            int pick = parked > A[ni].mass[REST]
                                ? (int)(irnd() % (uint32_t)parked) : 0;
                            if (pick < A[ni].mass[REST]) {
                                A[ni].mass[REST]--;
                            } else {
                                PlanckNode *dn = A + ni;
                                int w = pick - dn->mass[REST], c2 = 0;
                                for (; c2 < IMOV - 1; c2++)
                                    { if (w < dn->drest[c2]) break; w -= dn->drest[c2]; }
                                dn->drest[c2]--;
                            }
                            parked--;
                            iEV[5]++;
                            uint32_t v = A[ni].mass[c] + 1;
                            A[ni].mass[c] = v > 255 ? 255 : (uint8_t)v;
                        }
                }
                uint32_t v = A[ni].phot[c] + p;
                if (v > 255) { IPHN -= (int)(v - 255); v = 255; }
                A[ni].phot[c] = (uint8_t)v;
            }
        }
    }   /* end if (IPHN) photon stream */

    /* merge cur (sorted) + dests into a sorted dedup'd final list —
     * every phase must run in si-ascending order to keep the RNG
     * stream aligned with meso3i's flat z,y,x iteration */
    int fin = 0;
    qsort(iNLIST, nn, sizeof(int), icmp_);
    {
        int a = 0, b = 0;
        while (a < NACT || b < nn) {
            int si;
            if (b >= nn || (a < NACT && iALIST[a] < iNLIST[b])) si = iALIST[a++];
            else if (a >= NACT || iNLIST[b] < iALIST[a]) si = iNLIST[b++];
            else { si = iNLIST[b++]; a++; }
            PlanckNode *n = A + si;
            int nonempty = n->n | iPTF[si] | n->mass[REST];
            for (int c = 0; c < IMOV && !nonempty; c++)
                if (n->mass[c] || n->drest[c] || n->phot[c]) nonempty = 1;
            if (nonempty) iFLIST[fin++] = si;
            else iACT[si] = 0;
        }
    }

    /* iPT: leaky cadence over the merged sites */
    if (IPHN) {
        for (int i = 0; i < fin; i++) {
            int s = iFLIST[i];
            int any = 0;
            for (int c = 0; c < IMOV; c++) if (A[s].phot[c]) { any = 1; break; }
            iPTF[s] = any ? (iPTF[s] < 255 ? iPTF[s] + 1 : 255)
                          : (iPTF[s] ? iPTF[s] - 1 : 0);
            A[s].pt = iPTF[s];
        }
        /* pair production (IPHOT>=8): photon sites only */
        if (IPHOT >= 8)
        for (int i = 0; i < fin; i++) {
            int s = iFLIST[i];
            PlanckNode *na = A + s;
            if (iPTF[s] < IFCAD) continue;     /* fusecad gate */
            for (int c = 0; c < IMOV; c++)
            for (int c2 = c + 1; c2 < IMOV; c2++) {
                if (IPHOT == 8 && c2 != (c ^ 1)) continue;
                while (IFUS <= 1 && na->phot[c] && na->phot[c2] && (irnd() & 7) == 0) {
                    na->phot[c]--; na->phot[c2]--; IPHN -= 2;
                    if (na->drest[c] < 255) na->drest[c]++;
                    if (na->drest[c2] < 255) na->drest[c2]++;
                    iEV[7] += 2;
                }
            }
        }
    }

    /* commit: final sorted list becomes next tick's actives */
    {
        int *tmp = iALIST; iALIST = iFLIST; iFLIST = tmp;
        NACT = fin;
        for (int i = 0; i < NACT; i++) iNNF[iALIST[i]] = 0;
    }
    ITICK++;
}

void meso3i_drain_edge(int t) {
    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (x >= t && x < IW - t && y >= t && y < IH - t &&
            z >= t && z < ID - t) continue;
        int si = iidx(x, y, z);
        for (int c = 0; c < IMOV; c++) IPHN -= NA[si].phot[c];
        memset(&NA[si], 0, sizeof(PlanckNode));
    }
}
