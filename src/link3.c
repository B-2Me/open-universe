/* link3.c — the link-centric engine.
 *
 * OPERATOR LAYER (network ontology): sites are pure junctions; the
 * state that matters lives ON THE WIRE. Every directed link carries
 * per-direction occupancy (up = si->ni traffic) — the duplex split
 * the site-centric engines couldn't express. Congestion is a link
 * property; the junction only holds parked/bound state.
 *
 * SUBSTRATE LAYER (physics bridge): the junction registers keep the
 * measured ontology — REST (scalar mass), drest[c] (wound mass on
 * channel c), iE (stored excitation), iQ (collision register). Mass
 * streams are deterministic (FIFO queue order — decorrelation lives
 * in the wire, not in dice). Photons keep their fuzz.
 *
 * Loop inventory carried from meso3i (the baseline, not the ceiling):
 *   retention +loop   — park when the LINK congests (friction on wire)
 *   depletion -loop   — iE decay -> photon emission -> charge drains
 *   propulsion        — conveyor (wound mass emits on its channel) +
 *                       recoil (photon out c -> mass pushed c^1)
 *   co-moving charge  — hopping mass carries a share of iE
 *   collision iQ      — opposing-link streams condense at junction
 *   bond equilibrium  — photon exchange between junctions
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* ---- channel topology: 12 FCC diagonals + 6 axial = 18 ports ---- */
static const int8_t LDIR12[12][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1}
};
static const int8_t LDIR6[6][3] = {
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static int LW, LH, LD, LN;
static int LMOV, LCV[19][3];

/* site registers (substrate: parked/bound state at the junction) */
static uint8_t  *lREST;              /* [site] scalar mass stock */
static uint8_t  *lDR;                /* [site*LMOV + c] wound mass */
static uint8_t  *lIE;                /* [site] stored excitation */
static uint8_t  *lIQ;                /* [site] collision register */

/* link registers (operator: the wire's own state) */
static uint8_t  *lUP, *lUP2;         /* [site*LMOV + c] mass in flight si->ni */
static uint8_t  *lPH, *lPH2;         /* [site*LMOV + c] photons in flight si->ni */
static uint16_t *lLOAD;              /* [site*LMOV + c] EMA link utilization */
static uint8_t  *lUPd, *lPHd;        /* delivered-this-tick buffers */

/* flags — same names as meso3i where the mechanic carries over */
static int LFRIC = 8;                /* link congestion cap -> park (retention) */
static int LEMIT = 32;               /* deterministic emission rate /256 per tick */
static int LPHOT = 0;                /* photon conversion level (0=off) */
static int LRECOIL = 1;              /* momentum-conserving emission */
static int LCOMOVE = 1;              /* co-moving charge on hops */
static int LIQ = 1;                  /* iQ condensation on opposing streams */
static int LDRAIN = 0;
static int LTICK = 0;
static uint64_t LIEV[16];
static uint64_t LIPH = 0;            /* live-photon ledger */

static uint32_t lrng = 0xC0FFEEu;
static inline uint32_t lrnd(void) {
    lrng ^= lrng << 13; lrng ^= lrng >> 17; lrng ^= lrng << 5;
    return lrng;
}
static inline int lwrap(int v, int m) { return v < 0 ? v + m : (v >= m ? v - m : v); }
static inline int lidx(int x, int y, int z) { return z * (LW * LH) + y * LW + x; }

int link3_init(int w, int h, int d, int axial) {
    if ((w | h | d) & 1) return -1;
    LW = w; LH = h; LD = d; LN = w * h * d;
    LMOV = 12 + (axial ? 6 : 0);
    for (int c = 0; c < 12; c++) for (int k = 0; k < 3; k++) LCV[c][k] = LDIR12[c][k];
    for (int c = 0; c < 6;  c++) for (int k = 0; k < 3; k++) LCV[12 + c][k] = LDIR6[c][k];
    lREST = calloc(LN, 1);
    lDR   = calloc((size_t)LN * LMOV, 1);
    lIE   = calloc(LN, 1);
    lIQ   = calloc(LN, 1);
    lUP   = calloc((size_t)LN * LMOV, 1);
    lUP2  = calloc((size_t)LN * LMOV, 1);
    lPH   = calloc((size_t)LN * LMOV, 1);
    lPH2  = calloc((size_t)LN * LMOV, 1);
    lLOAD = calloc((size_t)LN * LMOV, 2);
    lUPd  = calloc((size_t)LN * LMOV, 1);
    lPHd  = calloc((size_t)LN * LMOV, 1);
    LTICK = 0; LIPH = 0;
    memset(LIEV, 0, sizeof LIEV);
    return 0;
}

/* ---- accessors ---- */
int  link3_nch(void)            { return LMOV + 1; }
int  link3_dim(int i)           { return i == 0 ? LW : i == 1 ? LH : LD; }
void link3_seed(uint32_t s)     { lrng = s ? s : 0xC0FFEEu; }
void link3_friction(int k)      { LFRIC = k; }
void link3_emit(int k)          { LEMIT = k; }
void link3_phot(int k)          { LPHOT = k; }
void link3_recoil(int k)        { LRECOIL = k; }
void link3_comove(int k)        { LCOMOVE = k; }
void link3_iqmode(int k)        { LIQ = k; }
void link3_drain_edge(int k)    { LDRAIN = k; }
uint64_t link3_ev(int i)        { return LIEV[i & 15]; }
uint64_t link3_photons(void)    { return LIPH; }
int  link3_rest(int x,int y,int z){ return lREST[lidx(x,y,z)]; }
int  link3_drest(int x,int y,int z,int c){ return c<LMOV?lDR[lidx(x,y,z)*LMOV+c]:0; }
int  link3_eget(int x,int y,int z){ return lIE[lidx(x,y,z)]; }
int  link3_qget(int x,int y,int z){ return lIQ[lidx(x,y,z)]; }
void link3_eset(int x,int y,int z,int v){ lIE[lidx(x,y,z)] = v<0?0:v>255?255:v; }
void link3_rset(int x,int y,int z,int c,int v){ if(c<LMOV)lDR[lidx(x,y,z)*LMOV+c]=v<0?0:v>255?255:v; }
int  link3_upget(int x,int y,int z,int c){ return c<LMOV?lUP[lidx(x,y,z)*LMOV+c]:0; }
int  link3_phget(int x,int y,int z,int c){ return c<LMOV?lPH[lidx(x,y,z)*LMOV+c]:0; }
int  link3_load(int x,int y,int z,int c){ return c<LMOV?lLOAD[lidx(x,y,z)*LMOV+c]:0; }

void link3_set(int x,int y,int z,int c,int v) {
    int si = lidx(x,y,z);
    if (c < LMOV) { uint32_t u = lUP[si*LMOV+c]+v; lUP[si*LMOV+c]=u>255?255:u; }
    else          { uint32_t u = lREST[si]+v;    lREST[si]=u>255?255:u; }
}
int link3_get(int x,int y,int z,int c) {
    int si = lidx(x,y,z);
    return c < LMOV ? lUP[si*LMOV+c] : lREST[si];
}
void link3_phset(int x,int y,int z,int c,int v) {
    if (c>=LMOV) return;
    int si = lidx(x,y,z);
    LIPH += v - lPH[si*LMOV+c];
    lPH[si*LMOV+c] = v<0?0:v>255?255:v;
}
static uint64_t lmass_total(void) {
    uint64_t m = 0;
    for (int si = 0; si < LN; si++) {
        m += lREST[si];
        for (int c = 0; c < LMOV; c++) { m += lUP[si*LMOV+c]; m += lDR[si*LMOV+c]; }
    }
    return m;
}
uint64_t link3_rest_mass(void) {
    uint64_t m = 0;
    for (int si = 0; si < LN; si++) { m += lREST[si]; for (int c = 0; c < LMOV; c++) m += lDR[si*LMOV+c]; }
    return m;
}
uint64_t link3_mov_mass(void) {
    uint64_t m = 0;
    for (int si = 0; si < LN; si++) for (int c = 0; c < LMOV; c++) m += lUP[si*LMOV+c];
    return m;
}

/* ---- the tick ----
 * Order (parity discipline): junction collide -> link stream (mass,
 * FIFO per wire, deterministic) -> photon stream -> drain. Sites in
 * ascending index; links handled with their source site. */
void link3_tick(void) {
    LTICK++;
    memset(lUPd, 0, (size_t)LN * LMOV);
    memset(lPHd, 0, (size_t)LN * LMOV);

    /* 1. junction collide — parked registers interact (substrate) */
    for (int si = 0; si < LN; si++) {
        /* deterministic emission: REST sheds LEMIT/256 of its stock to
         * moving channels — rate gate, not dice (queue fairness). */
        if (LEMIT && lREST[si]) {
            int out = ((int)lREST[si] * LEMIT) >> 8;
            if (out) {
                lREST[si] -= out;
                for (int u = 0; u < out; u++) {
                    /* round-robin channel spread — deterministic
                     * decorrelation (the wire's queue order) */
                    int c = (si + LTICK + u) % LMOV;
                    uint32_t v = lUP[si*LMOV+c] + 1;
                    lUP[si*LMOV+c] = v > 255 ? 255 : v;
                }
                LIEV[2] += out;
            }
        }
        /* wound conveyor: drest leaks onto its own channel — the
         * propulsion mechanic (wound mass emits where it wound). */
        for (int c = 0; c < LMOV; c++) {
            if (lDR[si*LMOV+c] && ((lrnd() & 255) < 32)) {
                lDR[si*LMOV+c]--;
                uint32_t v = lUP[si*LMOV+c] + 1;
                lUP[si*LMOV+c] = v > 255 ? 255 : v;
                LIEV[3]++;
            }
        }
        /* iE decay -> photon (depletion -loop): charge emits light.
         * recoil: emitter quantum pushed antipodal (momentum). */
        if (LPHOT && lIE[si] && (lrnd() & 31) == 0) {
            lIE[si]--;
            int c = (int)(lrnd() % (uint32_t)LMOV);
            uint32_t v = lPH[si*LMOV+c] + 1;
            lPH[si*LMOV+c] = v > 255 ? 255 : v;
            LIPH++; LIEV[4]++;
            if (LRECOIL && lREST[si]) {
                lREST[si]--;
                uint32_t m = lUP[si*LMOV+(c^1)] + 1;
                lUP[si*LMOV+(c^1)] = m > 255 ? 255 : m;
            }
        }
        /* iQ condensation: opposing in-flight streams at the junction
         * condense into core mass (the collision register). */
        if (LIQ) {
            for (int c = 0; c < LMOV; c += 2) {
                int a = lUP[si*LMOV+c], b = lUP[si*LMOV+(c^1)];
                int pr = a < b ? a : b;
                if (pr) {
                    lUP[si*LMOV+c] -= pr; lUP[si*LMOV+(c^1)] -= pr;
                    uint32_t q = lIQ[si] + 2*pr;
                    lIQ[si] = q > 255 ? 255 : q;
                    LIEV[5] += pr;
                }
            }
        }
    }

    /* 2. link stream — mass hops on the wire (operator).
     * Duplex congestion: the wire's occupancy this tick decides
     * whether the hop commits (refused -> bounce to antipode). */
    for (int z = 0; z < LD; z++)
    for (int y = 0; y < LH; y++)
    for (int x = 0; x < LW; x++) {
        if (((x + y + z) & 1)) continue;
        int si = lidx(x, y, z);
        for (int c = 0; c < LMOV; c++) {
            int n = lUP[si*LMOV+c];
            if (!n) continue;
            lUP[si*LMOV+c] = 0;
            int ni = lidx(lwrap(x + LCV[c][0], LW),
                          lwrap(y + LCV[c][1], LH),
                          lwrap(z + LCV[c][2], LD));
            /* duplex congestion check: this wire's in-flight load +
             * arriving exceeds capacity -> refused (park at source). */
            int wire = lLOAD[si*LMOV+c] + n;
            if (LFRIC && wire > 255 * 2) {
                uint32_t v = lDR[si*LMOV+c] + n;
                lDR[si*LMOV+c] = v > 255 ? 255 : v;
                LIEV[6] += n;      /* refused -> parked on source */
                continue;
            }
            /* junction congestion: mass arriving at a crowded node
             * parks into drest (retention +loop — density breeds
             * density). Operator: the junction's queue is full ->
             * packet buffers locally. */
            int jr = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) jr += lDR[ni*LMOV+cc];
            if (LFRIC && jr >= LFRIC) {
                uint32_t v = lDR[ni*LMOV+c] + n;
                lDR[ni*LMOV+c] = v > 255 ? 255 : v;
                LIEV[6] += n;
                lLOAD[si*LMOV+c] += n;
                continue;
            }
            lUPd[ni*LMOV+c] += n > 255 ? 255 : n;
            lLOAD[si*LMOV+c] += n;   /* flow meter — the wire's load */
            LIEV[0] += n;
            /* co-moving charge: hopping mass carries a share of iE */
            if (LCOMOVE && lIE[si]) {
                int share = n > lIE[si] ? lIE[si] : n;
                lIE[si] -= share;
                uint32_t e = lIE[ni] + share;
                lIE[ni] = e > 255 ? 255 : e;
            }
        }
    }
    for (int i = 0; i < LN * LMOV; i++) {
        uint32_t v = lUP[i] + lUPd[i];
        lUP[i] = v > 255 ? 255 : v;
    }

    /* 3. photon stream — photons keep their fuzz; absorbed at mass */
    for (int z = 0; z < LD; z++)
    for (int y = 0; y < LH; y++)
    for (int x = 0; x < LW; x++) {
        if (((x + y + z) & 1)) continue;
        int si = lidx(x, y, z);
        for (int c = 0; c < LMOV; c++) {
            int p = lPH[si*LMOV+c];
            if (!p) continue;
            lPH[si*LMOV+c] = 0;
            int ni = lidx(lwrap(x + LCV[c][0], LW),
                          lwrap(y + LCV[c][1], LH),
                          lwrap(z + LCV[c][2], LD));
            /* absorb: photons arriving at parked mass -> iE (substrate:
             * bound energy; operator: the wire deposits into node) */
            int mass = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) mass += lDR[ni*LMOV+cc];
            if (LPHOT >= 5 && mass > 32 && p > 0) {
                uint32_t e = lIE[ni] + p;
                lIE[ni] = e > 255 ? 255 : e;
                LIPH -= p;
                LIEV[7] += p;
                continue;
            }
            lPHd[ni*LMOV+c] += p > 255 ? 255 : p;
        }
    }
    for (int i = 0; i < LN * LMOV; i++) {
        uint32_t v = lPH[i] + lPHd[i];
        if (v > 255) { LIPH -= v - 255; v = 255; }
        lPH[i] = v;
    }

    /* 4. link load decay — utilization meter relaxes (EMA >> 2) */
    for (int i = 0; i < LN * LMOV; i++) lLOAD[i] = (uint16_t)((lLOAD[i] * 3) >> 2);

    /* 5. edge drain */
    if (LDRAIN) {
        for (int z = 0; z < LD; z++)
        for (int y = 0; y < LH; y++)
        for (int x = 0; x < LW; x++) {
            if (((x + y + z) & 1)) continue;
            int si = lidx(x, y, z);
            int edge = (x < LDRAIN || y < LDRAIN || z < LDRAIN ||
                        x >= LW - LDRAIN || y >= LH - LDRAIN || z >= LD - LDRAIN);
            if (!edge) continue;
            for (int c = 0; c < LMOV; c++) {
                if (lPH[si*LMOV+c]) { LIPH -= lPH[si*LMOV+c]; lPH[si*LMOV+c] = 0; }
            }
            lREST[si] = 0; lIE[si] = 0; lIQ[si] = 0;
        }
    }
}

void link3_ev_reset(void) { memset(LIEV, 0, sizeof LIEV); }
