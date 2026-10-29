/* meso_core.c — parity port of meso3i's canonical collide semantics.
 * 64-byte aligned PlanckNode, double-buffered. meso3i stays reference. */
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
static int       IPTH, IPTB, IFUS, IFCAD, IRECOMB, IANNIH, IFRLUM, ILINKCAP, IECOST, ISCATT, *iR;
static int64_t   iEV[10];

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
    /* drest annihilation (fusion inverse): opposing bins -> photon pair */
    if (IANNIH) {
        for (int c = 0; c < IMOV; c += 2) {
            int pairs = nb->drest[c] < nb->drest[c ^ 1] ? nb->drest[c] : nb->drest[c ^ 1];
            int rate = (IANNIH * pairs) >> 8;
            for (int u = 0; u < pairs && (int)(irnd() & 255) < rate; u++) {
                nb->drest[c]--; nb->drest[c ^ 1]--;
                nb->phot[c]++; nb->phot[c ^ 1]++;
                IPHN += 2; iEV[4] += 2;
            }
        }
    }
    /* iecost: energy funds work — emission needs iE>=k OR transit (lt>0) */
    if (IECOST && parked && (int)nb->n < IECOST && !nb->lt) return;
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
    if (isite(x, y, z)) NA[iidx(x, y, z)].mass[c] = v;
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
    if (isite(x, y, z)) NA[iidx(x, y, z)].n = (uint8_t)v;
}
uint8_t meso3i_ptget(int x, int y, int z) {
    return NA[iidx(iwrap(x, IW), iwrap(y, IH), iwrap(z, ID))].pt;
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
int64_t meso3i_ev(int i) { return i < 0 || i >= 10 ? 0 : iEV[i]; }
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
void meso3i_friclum(int k)   { IFRLUM = k; }
void meso3i_linkcap(int k)   { ILINKCAP = k; }
void meso3i_iecost(int k)    { IECOST = k; }
void meso3i_scatter(int k)   { ISCATT = k; }
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

    /* 1. pre-collision density snapshot */
    for (int s = 0; s < IN; s++) {
        int r = NA[s].mass[REST];
        for (int c = 0; c < IMOV; c++) r += NA[s].mass[c] + NA[s].drest[c];
        iR[s] = r;
    }

    /* 2. node collisions (flat si order — identical RNG consumption) */
    memset(B, 0, (size_t)IN * sizeof(PlanckNode));
    for (int s = 0; s < IN; s++)
        collide_node(NA + s, B + s);

    memset(A, 0, (size_t)IN * sizeof(PlanckNode));

    /* carry ALL stationary registers globally first — per-site copies
     * inside the stream loop would wipe arrivals written by earlier
     * sources (meso3i's memcpy iRB<-iRA happens before the stream) */
    for (int s2 = 0; s2 < IN; s2++) {
        A[s2].n  = B[s2].n;  A[s2].lt = B[s2].lt; A[s2].pt = B[s2].pt;
        A[s2].mass[REST] = B[s2].mass[REST];
        memcpy(A[s2].drest, B[s2].drest, IMOV);
    }

    /* 3. mass stream: rest stays, moving hops with drag/reflection */
    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (!isite(x, y, z)) continue;
        int si = iidx(x, y, z);
        const PlanckNode *nb = B + si;
        PlanckNode *na = A + si;
        for (int c = 0; c < IMOV; c++) {
            int p = nb->mass[c];
            if (!p) continue;
            int ni = iidx(iwrap(x + ICV[c][0], IW),
                          iwrap(y + ICV[c][1], IH),
                          iwrap(z + ICV[c][2], ID));
            int fp = IFRICP;
            if (IFRLUM) {
                int lum = 0;
                for (int pc = 0; pc < IMOV; pc++) lum += B[ni].phot[pc];
                fp -= lum * IFRLUM / 8;
            }
            if (IFRIC && iR[ni] >= IFRIC &&
                (int)(irnd() & 255) < fp) {
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
            if (ILINKCAP && B[ni].pt >= ILINKCAP) {
                uint32_t v = na->mass[c ^ 1] + p;
                na->mass[c ^ 1] = v > 255 ? 255 : (uint8_t)v;
                iEV[6] += p;
                continue;
            }
            uint32_t v = A[ni].mass[c] + p;
            if (v > 255) iEV[9] += v - 255;
            A[ni].mass[c] = v > 255 ? 255 : (uint8_t)v;
        }
    }

    /* 4. photon stream + absorb/ablate + cadence + pair production */
    if (IPHN) {
        for (int z = 0; z < ID; z++)
        for (int y = 0; y < IH; y++)
        for (int x = 0; x < IW; x++) {
            if (!isite(x, y, z)) continue;
            int si = iidx(x, y, z);
            const PlanckNode *nb = B + si;
            for (int c = 0; c < IMOV; c++) {
                int p = nb->phot[c];
                if (!p) continue;
                int ni = iidx(iwrap(x + ICV[c][0], IW),
                              iwrap(y + ICV[c][1], IH),
                              iwrap(z + ICV[c][2], ID));
                if (IPHOT >= 3 && B[ni].pt >= IPTB && 1 >= IPTH) {
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
                if (ISCATT) {
                    int rho2 = iR[ni];
                    for (int u = 0; u < p; u++)
                        if (rho2 && (int)(irnd() & 255) < ISCATT) {
                            int c2 = (int)(irnd() % IMOV);
                            if (A[ni].phot[c2] < 255) A[ni].phot[c2]++;
                            p--;
                        }
                }
                uint32_t v = A[ni].phot[c] + p;
                if (v > 255) { IPHN -= (int)(v - 255); v = 255; }
                A[ni].phot[c] = (uint8_t)v;
            }
        }
        /* iPT: leaky arrival cadence on the fresh plane */
        for (int s = 0; s < IN; s++) {
            int any = 0;
            for (int c = 0; c < IMOV; c++) if (A[s].phot[c]) { any = 1; break; }
            A[s].pt = any ? (B[s].pt < 255 ? B[s].pt + 1 : 255)
                          : (B[s].pt ? B[s].pt - 1 : 0);
        }
        /* pair production (IPHOT>=8): same-channel-set pairs fuse */
        if (IPHOT >= 8)
        for (int s = 0; s < IN; s++) {
            PlanckNode *na = A + s;
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
    ITICK++;
}

void meso3i_drain_edge(int t) {
    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (x >= t && x < IW - t && y >= t && y < IH - t &&
            z >= t && z < ID - t) continue;
        int si = iidx(x, y, z);
        int64_t drq = NA[si].mass[REST];
        for (int c = 0; c < IMOV; c++) {
            drq += NA[si].mass[c] + NA[si].drest[c] + NA[si].phot[c];
            IPHN -= NA[si].phot[c];
        }
        iEV[8] += drq;   /* drained quanta — all species */
        memset(&NA[si], 0, sizeof(PlanckNode));
    }
}
