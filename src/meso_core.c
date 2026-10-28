/* meso_core.c — parallel production kernel for the meso3i substrate.
 *
 * Stripped to the verified thermodynamic triad (RFC):
 *   - 18 moving channels + 1 scalar rest channel (D3Q19, True-FCC parity)
 *   - 18 directional rest bins (IDREST=1: frozen flux, winding survives)
 *   - 18 photon channels (massless, invariant c = 1 hop/tick)
 *   - 1 excitation register n (Planck's bound oscillator)
 *   - 1 transit latency counter (iLT) + 1 photon arrival counter (iPT)
 *
 * Hardcoded rules: antipodal-pair shuffle, transit drag parking (IFRIC),
 * elastic congestion refusal (IREFL), carrier-gated/unconditional rest
 * emission (IFRICM), Einstein A21 decay (EMASK), photon->n absorption,
 * Breit-Wheeler pair production (IPP).
 *
 * Stripped: dwell delay lines, Q-cores, gates, fields, phase offsets,
 * collision-mode selection.  meso3i.c remains the canonical reference.
 *
 * Single 64-byte aligned node, double-buffered — cache-line clean.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define IMOV 18
#define INCH 19
#define REST (INCH - 1)

typedef struct __attribute__((aligned(64))) {
    uint8_t mass[INCH];   /* 12 face + 6 axial + 1 scalar rest   */
    uint8_t drest[IMOV];  /* directional rest bins (frozen flux) */
    uint8_t phot[IMOV];   /* photon channels                     */
    uint8_t n;            /* bound excitation                    */
    uint8_t lt;           /* consecutive mass-transit ticks      */
    uint8_t pt;           /* consecutive photon-arrival ticks    */
    uint8_t pad[6];
} PlanckNode;             /* exactly 64 bytes */

static const int8_t ICV[INCH][3] = {
    { 1, 1, 0},{-1,-1, 0},{ 1,-1, 0},{-1, 1, 0},
    { 1, 0, 1},{-1, 0,-1},{ 1, 0,-1},{-1, 0, 1},
    { 0, 1, 1},{ 0,-1,-1},{ 0, 1,-1},{ 0,-1, 1},
    { 2, 0, 0},{-2, 0, 0},{ 0, 2, 0},{ 0,-2, 0},{ 0, 0, 2},{ 0, 0,-2},
    { 0, 0, 0}
};

static int      IW, IH, ID, IN;
static PlanckNode *NA, *NB;         /* double buffer */
static uint32_t  irng = 0xC0FFEEu;
static int       IFRIC, IFRICP = 128, IFRICM, IREFL, ILAT = 8;
static int       EMASK = 7, IPP, IPHN, ITICK;
static int64_t   iEV[8];

static inline uint32_t irnd(void) {
    irng ^= irng << 13; irng ^= irng >> 17; irng ^= irng << 5;
    return irng;
}
static inline int isite(int x, int y, int z) { return !((x + y + z) & 1); }
static inline int iidx(int x, int y, int z)  { return (z * IH + y) * IW + x; }
static inline int iwrap(int v, int n) { v %= n; return v < 0 ? v + n : v; }

void meso3i_init(int w, int h, int d, int seed) {
    IW = w; IH = h; ID = d; IN = IW * IH * ID;
    free(NA); free(NB);
    NA = calloc((size_t)IN, sizeof(PlanckNode));
    NB = calloc((size_t)IN, sizeof(PlanckNode));
    irng = seed ? (uint32_t)seed : 0xC0FFEEu;
    IPHN = ITICK = 0;
    memset(iEV, 0, sizeof(iEV));
}
void meso3i_seed(int s) { irng = (uint32_t)s; }

/* ---------- accessors ---------- */
void meso3i_set(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= INCH) return;
    if (!isite(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))) return;
    NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].mass[c] = v;
}
uint8_t meso3i_get(int x, int y, int z, int c) {
    if (c < 0 || c >= INCH) return 0;
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].mass[c];
}
uint8_t meso3i_rget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].drest[c];
}
void meso3i_phset(int x, int y, int z, int c, uint8_t v) {
    if (c < 0 || c >= IMOV) return;
    int si = iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID));
    IPHN += (int)v - NA[si].phot[c];
    NA[si].phot[c] = v;
}
uint8_t meso3i_phget(int x, int y, int z, int c) {
    if (c < 0 || c >= IMOV) return 0;
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].phot[c];
}
uint8_t meso3i_eget(int x, int y, int z) {
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].n;
}
void meso3i_eset(int x, int y, int z, int v) {
    if (!isite(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))) return;
    NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].n = (uint8_t)v;
}
uint8_t meso3i_ptget(int x, int y, int z) {
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].pt;
}
uint8_t meso3i_ltget(int x, int y, int z) {
    return NA[iidx(iwrap(x,IW), iwrap(y,IH), iwrap(z,ID))].lt;
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

/* ---------- knobs ---------- */
void meso3i_friction(int k)  { IFRIC = k; }
void meso3i_fricp(int n)     { IFRICP = n; }
void meso3i_fricmode(int m)  { IFRICM = m; }
void meso3i_reflect(int k)   { IREFL = k; }
void meso3i_erate(int m)     { EMASK = m; }
void meso3i_lat(int n)       { ILAT = n; }
void meso3i_pair(int m)      { IPP = m; }
/* compat no-ops for harness parity */
void meso3i_collmode(int m)  { (void)m; }
void meso3i_drest(int m)     { (void)m; }
void meso3i_phot(int m)      { (void)m; }
void meso3i_phth(int t)      { (void)t; }
void meso3i_nushift(int k)   { (void)k; }
void meso3i_iptbar(int k)    { (void)k; }
void meso3i_dwell(int k)     { (void)k; }
void meso3i_rg_refresh(void) { }
void meso3i_tick(void) {
    PlanckNode *A = NA, *B = NB;
    memset(B, 0, (size_t)IN * sizeof(PlanckNode));

    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (!isite(x, y, z)) continue;
        int si = iidx(x, y, z);
        PlanckNode *na = A + si, *nb = B + si;

        nb->n = na->n; nb->pt = na->pt;
        nb->mass[REST] = na->mass[REST];
        memcpy(nb->drest, na->drest, IMOV);
        memcpy(nb->phot,  na->phot,  IMOV);

        int mov = 0;
        for (int c = 0; c < IMOV; c++) mov += na->mass[c];
        nb->lt = mov ? (na->lt < 255 ? na->lt + 1 : 255) : 0;

        while (nb->n && (irnd() & EMASK) == 0) {
            nb->n--;
            nb->phot[irnd() % IMOV]++;
            IPHN++;
        }

        if (IFRICM && nb->mass[REST]) {
            int k = IFRICM > 0 ? IFRICM : -IFRICM;
            if (IFRICM > 0 || nb->lt >= ILAT)
                for (int u = 0; u < nb->mass[REST]; u++)
                    if ((int)(irnd() % (uint32_t)(4 * k)) == 0) {
                        nb->mass[REST]--;
                        nb->mass[irnd() % IMOV]++;
                        iEV[1]++;
                    }
        }

        for (int a = 0; a < IMOV; a += 2) {
            int q0 = na->mass[a], q1 = na->mass[a ^ 1];
            int pair = q0 < q1 ? q0 : q1;
            for (int u = 0; u < pair; u++) {
                int b = (int)(irnd() % (IMOV / 2)) * 2;
                nb->mass[b]++; nb->mass[b ^ 1]++;
                iEV[3] += 2;
            }
            nb->mass[a]     += q0 - pair;
            nb->mass[a ^ 1] += q1 - pair;
        }
    }

    memset(A, 0, (size_t)IN * sizeof(PlanckNode));

    for (int z = 0; z < ID; z++)
    for (int y = 0; y < IH; y++)
    for (int x = 0; x < IW; x++) {
        if (!isite(x, y, z)) continue;
        int si = iidx(x, y, z);
        const PlanckNode *nb = B + si;
        PlanckNode *na = A + si;
        na->n = nb->n; na->lt = nb->lt; na->pt = nb->pt;
        na->mass[REST] = nb->mass[REST];
        memcpy(na->drest, nb->drest, IMOV);
        for (int c = 0; c < IMOV; c++) {
            int p = nb->mass[c];
            if (!p) continue;
            int ni = iidx(iwrap(x + ICV[c][0], IW),
                          iwrap(y + ICV[c][1], IH),
                          iwrap(z + ICV[c][2], ID));
            PlanckNode *dn = A + ni;
            int occ = dn->mass[REST];
            for (int j = 0; j < IMOV; j++) occ += dn->mass[j] + dn->drest[j];
            if (IREFL && occ >= IREFL) {
                int bi = iidx(iwrap(x - ICV[c][0], IW),
                              iwrap(y - ICV[c][1], IH),
                              iwrap(z - ICV[c][2], ID));
                uint32_t v = A[bi].mass[c ^ 1] + p;
                A[bi].mass[c ^ 1] = v > 255 ? 255 : (uint8_t)v;
                iEV[2] += p;
                continue;
            }
            if (IFRIC && occ >= IFRIC &&
                (int)(irnd() & 255) < IFRICP) {
                uint32_t v = dn->drest[c] + p;
                dn->drest[c] = v > 255 ? 255 : (uint8_t)v;
                iEV[0] += p;
                continue;
            }
            uint32_t v = dn->mass[c] + p;
            dn->mass[c] = v > 255 ? 255 : (uint8_t)v;
        }
    }

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
                PlanckNode *dn = A + ni;
                int parked = dn->mass[REST];
                for (int j = 0; j < IMOV; j++) parked += dn->drest[j];
                int absorbed = 0;
                for (int u = 0; u < p; u++)
                    if (parked && (int)(irnd() & 255) < parked) {
                        if (dn->n < 255) dn->n++;
                        absorbed++;
                    }
                IPHN -= absorbed;
                iEV[5] += absorbed;
                uint32_t v = dn->phot[c] + (p - absorbed);
                dn->phot[c] = v > 255 ? 255 : (uint8_t)v;
            }
        }
        if (IPP)
        for (int si = 0; si < IN; si++) {
            PlanckNode *na = A + si;
            for (int c = 0; c < IMOV; c++)
            for (int c2 = c + 1; c2 < IMOV; c2++)
                while (na->phot[c] && na->phot[c2] && (irnd() & 7) == 0) {
                    na->phot[c]--; na->phot[c2]--; IPHN -= 2;
                    if (na->drest[c] < 255) na->drest[c]++;
                    if (na->drest[c2] < 255) na->drest[c2]++;
                    iEV[7] += 2;
                }
        }
        for (int si = 0; si < IN; si++) {
            int any = 0;
            for (int c = 0; c < IMOV; c++) if (A[si].phot[c]) { any = 1; break; }
            A[si].pt = any ? (B[si].pt < 255 ? B[si].pt + 1 : 255)
                           : (B[si].pt ? B[si].pt - 1 : 0);
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
        for (int c = 0; c < IMOV; c++) IPHN -= NA[si].phot[c];
        memset(&NA[si], 0, sizeof(PlanckNode));
    }
}
