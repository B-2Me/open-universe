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
static uint8_t  *lIQ;
static uint8_t  *lIQD;              /* iQ dwell counter — backoff timer */                /* [site] collision register */

/* link registers (operator: the wire's own state) */
static uint8_t  *lUP, *lUP2;         /* [site*LMOV + c] mass in flight si->ni */
static uint8_t  *lPH, *lPH2;         /* [site*LMOV + c] photons in flight si->ni */
static uint8_t  *lSNU;               /* [site] site nu — its characteristic frequency (absorption line) */
static uint8_t  *lPHNU;              /* [site*LMOV + c] photon nu tag — the offer's config (emitter's structure signature) */
static uint16_t *lLOAD;
static uint16_t *lFLUX;
static uint8_t  *lSESS;              /* [site*LMOV + c] session strength — duplex EMA */
static uint8_t  *lSST;               /* [site*LMOV + c] session state: 0=UDP,1=LISTEN,2=SYN,3=ESTAB,4=CLOSED */
static uint8_t  *lSAGE;
static uint16_t *lBOND;              /* [site*LMOV + c] bond strength — accumulated session depth (structural, not traffic) */              /* [site*LMOV + c] session age — ticks since last duplex traffic */              /* [site*LMOV + c] session strength — EMA of duplex traffic on the wire */              /* [site] flux through junction this tick — the motion budget */              /* [site*LMOV + c] EMA link utilization */
static uint8_t  *lUPd, *lPHd;        /* delivered-this-tick buffers */
static uint8_t  *lPHNUd;             /* delivered nu tags */

/* flags — same names as meso3i where the mechanic carries over */
static int LFRIC = 8;                /* link congestion cap -> park (retention) */
static int LEMIT = 32;               /* deterministic emission rate /256 per tick */
static int LPHOT = 0;                /* photon conversion level (0=off) */
static int LRECOIL = 1;              /* momentum-conserving emission */
static int LCOMOVE = 1;              /* co-moving charge on hops */
static int LIQ = 1;
static int LIQCAP = 64;             /* iQ collision buffer cap -> flush */
static int LIQDW = 8;               /* collision backoff: ticks buffered before flush */                  /* iQ condensation on opposing streams */
static int LEG = 0;                 /* egate: junction density gates emission */
static int LIEC = 0;
static int LIEB = 0;                /* iE burst: charge saturates -> photon dump */                /* iecost: emission spends iE */
static int LPHDEC = 0;              /* photdecay: photon -> drest at catalyst-mass */
static int LFUS = 0;                /* fusion: photon pair -> drest, energy-threshold gated */
static int LANNIH = 0;              /* annih: drest pair -> photon pair (the mirror) */                /* fusion: photon pair on junction -> drest pair */
static int LGRAV = 0;               /* mass falls toward mass — density-gradient attraction */
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
    lIQD  = calloc(LN, 1);
    lUP   = calloc((size_t)LN * LMOV, 1);
    lUP2  = calloc((size_t)LN * LMOV, 1);
    lPH   = calloc((size_t)LN * LMOV, 1);
    lPHNU = calloc((size_t)LN * LMOV, 1);
    lSNU  = calloc(LN, 1);
    lPH2  = calloc((size_t)LN * LMOV, 1);
    lLOAD = calloc((size_t)LN * LMOV, 2);
    lFLUX = calloc(LN, 2);
    lSESS = calloc((size_t)LN * LMOV, 1);
    lSST  = calloc((size_t)LN * LMOV, 1);
    lSAGE = calloc((size_t)LN * LMOV, 1);
    lBOND = calloc((size_t)LN * LMOV, 2);
    lUPd  = calloc((size_t)LN * LMOV, 1);
    lPHd  = calloc((size_t)LN * LMOV, 1);
    lPHNUd= calloc((size_t)LN * LMOV, 1);
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
void link3_iqcap(int k)         { LIQCAP = k; }
void link3_iqdwell(int k)       { LIQDW = k; }
void link3_drain_edge(int k)    { LDRAIN = k; }
void link3_grav(int k)          { LGRAV = k; }
void link3_photdecay(int k)    { LPHDEC = k; }
void link3_fusion(int k)       { LFUS = k; }
void link3_annih(int k)         { LANNIH = k; }
void link3_egate(int k)         { LEG = k; }
void link3_iecost(int k)        { LIEC = k; }
void link3_ieburst(int k)       { LIEB = k; }
uint64_t link3_ev(int i)        { return LIEV[i & 15]; }
uint64_t link3_photons(void)    { return LIPH; }
int  link3_rest(int x,int y,int z){ return lREST[lidx(x,y,z)]; }
int  link3_snu(int x,int y,int z){ return lSNU[lidx(x,y,z)]; }
void link3_snu_set(int x,int y,int z,int v){ lSNU[lidx(x,y,z)] = v&255; }
int  link3_drest(int x,int y,int z,int c){ return c<LMOV?lDR[lidx(x,y,z)*LMOV+c]:0; }
int  link3_eget(int x,int y,int z){ return lIE[lidx(x,y,z)]; }
int  link3_qget(int x,int y,int z){ return lIQ[lidx(x,y,z)]; }
void link3_eset(int x,int y,int z,int v){ lIE[lidx(x,y,z)] = v<0?0:v>255?255:v; }
void link3_rset(int x,int y,int z,int c,int v){ if(c<LMOV)lDR[lidx(x,y,z)*LMOV+c]=v<0?0:v>255?255:v; }
int  link3_upget(int x,int y,int z,int c){ return c<LMOV?lUP[lidx(x,y,z)*LMOV+c]:0; }
int  link3_phget(int x,int y,int z,int c){ return c<LMOV?lPH[lidx(x,y,z)*LMOV+c]:0; }
int  link3_phnu(int x,int y,int z,int c){ return c<LMOV?lPHNU[lidx(x,y,z)*LMOV+c]:0; }
int  link3_load(int x,int y,int z,int c){ return c<LMOV?lLOAD[lidx(x,y,z)*LMOV+c]:0; }
int  link3_sess(int x,int y,int z,int c){ return c<LMOV?lSESS[lidx(x,y,z)*LMOV+c]:0; }
int  link3_sst(int x,int y,int z,int c){ return c<LMOV?lSST[lidx(x,y,z)*LMOV+c]:0; }
int  link3_bond(int x,int y,int z,int c){ return c<LMOV?lBOND[lidx(x,y,z)*LMOV+c]:0; }

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
    lPHNU[si*LMOV+c] = 32;  /* fresh photons enter ENERGETIC — high nu, redshiftable */
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
        int x_ = si % LW, y_ = (si / LW) % LH, z_ = si / (LW * LH);
        /* the C_max budget: flux through the junction (translation)
         * competes with internal cycling for the tick's throughput —
         * hops spent moving are hops denied to internal work. The
         * junction's internal rate scales down as its flux rises —
         * the moving-clock dilation as a local budget, not geometry. */
        int busy = lFLUX[si] >> 5;              /* flux in 1/32 units */
        if (busy > 6) busy = 6;                 /* cap at ~19% suppression */
        int bscale = 8 - busy;                  /* internal budget scale /8 */
        lFLUX[si] = 0;
        /* deterministic emission: REST sheds LEMIT/256 of its stock to
         * moving channels — rate gate, not dice (queue fairness). */
        if (LEMIT && lREST[si]) {
            /* emission as a junction decision — the loops:
             * iE-boost: a charged junction emits harder (its own
             *   energy funds radiation — depletion loop)
             * egate:    junction density modulates the rate —
             *   +k suppresses in crowd (retention), -k vents (outflow)
             * iecost:   each emission spends charge (the budget) */
            /* charge MODULATES, doesn't dominate — iE as a
             * bounded multiplier on the base rate (hot junction
             * emits up to ~3x, not +60x). The mass's own rate
             * stays the rule; the charge is a modifier. */
            int rate = (LEMIT * bscale) >> 3;
            rate += ((LEMIT * (lIE[si] >> 5)) >> 2);
            if (LEG) {
                int jr = lREST[si];
                for (int cc = 0; cc < LMOV; cc++) jr += lDR[si*LMOV+cc];
                if (jr >= (LEG < 0 ? -LEG : LEG))
                    rate = LEG > 0 ? (rate >> 3) : rate << 1;
            }
            int out = ((int)lREST[si] * rate) >> 8;
            if (LIEC && lIE[si] >= LIEC) { out = out ? out : 1; }
            if (out) {
                if (LIEC) { int cst = out * LIEC; lIE[si] -= lIE[si] < cst ? lIE[si] : cst; }
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
        /* wound conveyor: the winding PROPAGATES — a wound site hands
         * a share of its drest to the downstream neighbor's drest (the
         * spin transfers through the lump like angular momentum through
         * a body). The winding CIRCULATES — it doesn't leave as mass;
         * the lump's spin is structure, not fuel. The mass stays bound;
         * the direction flows. */
        for (int c = 0; c < LMOV; c++) {
            int leak = ((int)lDR[si*LMOV+c] * 32) >> 8;
            if (leak) {
                lDR[si*LMOV+c] -= leak;
                int nx = lidx(lwrap(x_ + LCV[c][0], LW),
                              lwrap(y_ + LCV[c][1], LH),
                              lwrap(z_ + LCV[c][2], LD));
                uint32_t v = lDR[nx*LMOV+c] + leak;
                lDR[nx*LMOV+c] = v > 255 ? 255 : v;
                LIEV[3] += leak;
                /* the transfer also pushes a parked quantum forward —
                 * winding moves mass downstream (the conveyor drags
                 * the lump's interior toward its spin axis). */
                if (lREST[si] >= leak) {
                    lREST[si] -= leak;
                    uint32_t m = lDR[nx*LMOV+c] + leak;
                    lDR[nx*LMOV+c] = m > 255 ? 255 : m;
                }
            }
        }
        /* iE burst: charge saturates -> dump the reservoir as a photon
         * burst (the capacitor discharge — charge -> hold -> dump ->
         * recharge: the lump's heartbeat, same oscillator shape as the
         * iQ collision domain but on the energy register). */
        /* site nu derivation: the lump's spectral signature =
         * dominant winding + charge band — its absorption line
         * shifts with excitation (the atom's lines move as it's
         * ionized — frequency IS the structure's state). */
        {
            int dch = -1, dv = 0;
            for (int cc = 0; cc < LMOV; cc++)
                if (lDR[si*LMOV+cc] > dv) { dv = lDR[si*LMOV+cc]; dch = cc; }
            if (dch >= 0) lSNU[si] = dch + (lIE[si] >> 4);   /* nu = winding + charge */
            else lSNU[si] = lIE[si] >> 4;
        }
        if (LIEB && lIE[si] >= LIEB) {
            int dump = lIE[si] >> 2;
            lIE[si] -= dump;
            /* session-directed burst: the bound pair dumps down its
             * strongest ESTABLISHED session wire — the exchange is
             * the photon economy's preferred channel, not isotropic. */
            int c = (si + LTICK) % LMOV;
            int dch = -1, dv = 0;
            for (int cc = 0; cc < LMOV; cc++)
                if (lDR[si*LMOV+cc] > dv) { dv = lDR[si*LMOV+cc]; dch = cc; }
            { int bv = -1; for (int cc = 0; cc < LMOV; cc++)
                  if (lSST[si*LMOV+cc] == 3 && lSESS[si*LMOV+cc] > bv) {
                      bv = lSESS[si*LMOV+cc]; c = cc;
                  } }
            lPHNU[si*LMOV+c] = dch < 0 ? 255 : dch + (dump >> 4);   /* nu = the burst's energy quantum */
            uint32_t v = lPH[si*LMOV+c] + dump;
            lPH[si*LMOV+c] = v > 255 ? 255 : v;
            LIPH += dump; LIEV[11] += dump;
            if (LRECOIL && lREST[si] >= dump) {
                lREST[si] -= dump;
                uint32_t r = lUP[si*LMOV+(c^1)] + dump;
                lUP[si*LMOV+(c^1)] = r > 255 ? 255 : r;
            }
        }
        /* iE decay -> photon (depletion -loop): charge emits light.
         * recoil: emitter quantum pushed antipodal (momentum). */
        if (LPHOT && lIE[si] && (lrnd() % (uint32_t)(32 - busy * 4)) == 0) {
            lIE[si]--;
            /* directional emission: photons inherit the lump's
             * structure — prefer the dominant drest channel (the
             * winding axis) or the strongest session — the lump's
             * shape steers where its light goes. */
            int c = (int)(lrnd() % (uint32_t)LMOV);
            int dch2 = -1, dv2 = 0;
            for (int cc = 0; cc < LMOV; cc++)
                if (lDR[si*LMOV+cc] > dv2) { dv2 = lDR[si*LMOV+cc]; dch2 = cc; }
            { int bv = 0;
              if (dch2 >= 0) c = dch2;
              for (int cc = 0; cc < LMOV; cc++)
                  if (lSST[si*LMOV+cc] == 3 && lSESS[si*LMOV+cc] > bv) {
                      bv = lSESS[si*LMOV+cc]; c = cc;
                  } }
            lPHNU[si*LMOV+c] = dch2 < 0 ? 255 : (lIE[si] >> 4) + 8;   /* nu = the transition the charge affords — hotter lumps emit hotter light */
            uint32_t v = lPH[si*LMOV+c] + 1;
            lPH[si*LMOV+c] = v > 255 ? 255 : v;
            LIPH++; LIEV[4]++;
            if (LRECOIL && lREST[si]) {
                lREST[si]--;
                uint32_t m = lUP[si*LMOV+(c^1)] + 1;
                lUP[si*LMOV+(c^1)] = m > 255 ? 255 : m;
            }
        }
        /* annihilation — the fusion mirror: opposing drest pairs
         * burn to antipodal photons (density^2, the mass side's
         * pair-production run in reverse). Momentum-conserving:
         * wound mass on {c,c^1} -> photons on {c,c^1}. */
        if (LANNIH) {
            for (int c = 0; c < LMOV; c += 2) {
                int a = lDR[si*LMOV+c] < lDR[si*LMOV+(c^1)] ? lDR[si*LMOV+c] : lDR[si*LMOV+(c^1)];
                int burn = (LANNIH * a) >> 8;
                if (burn > a) burn = a;
                if (burn) {
                    lDR[si*LMOV+c] -= burn; lDR[si*LMOV+(c^1)] -= burn;
                    uint32_t v;
                    v = lPH[si*LMOV+c] + burn;   lPH[si*LMOV+c] = v > 255 ? 255 : v;
                    v = lPH[si*LMOV+(c^1)] + burn; lPH[si*LMOV+(c^1)] = v > 255 ? 255 : v;
                    LIPH += 2*burn;
                    LIEV[12] += burn;
                }
            }
        }
        /* LGRAV — gravity as capture asymmetry, not a force: parked
         * mass jitters to a RANDOM neighbor (thermal — mass isn't
         * perfectly still). No densest-search, no field — the node
         * doesn't know where density is. The asymmetry is in the
         * CAPTURE: jittered mass that lands at a dense junction gets
         * parked (the existing LFRIC mechanic); mass that jitters
         * away keeps moving. Net drift toward density from random
         * walk + differential sticking — diffusion-limited
         * aggregation, the substrate's honest gravity. */
        /* density-bound jitter: parked mass jitters LESS where it's
         * already dense (the lump holds its own — binding energy).
         * Sparse mass wanders freely; dense mass stays bound — the
         * asymmetry that makes gravity one-directional. */
        int jitter = LGRAV;
        if (lREST[si] >= 48) jitter = LGRAV >> 3;   /* bound mass jitters 1/8 */
        if (LGRAV && lREST[si] > 1 && (lrnd() & 255) < jitter) {
            lREST[si]--;
            int c = (int)(lrnd() % (uint32_t)LMOV);
            uint32_t v = lUP[si*LMOV+c] + 1;
            lUP[si*LMOV+c] = v > 255 ? 255 : v;
            LIEV[13]++;
        }
        /* iQ collision domain: opposing in-flight streams at the
         * junction collide and buffer (the collision register).
         * The buffer holds for a BACKOFF dwell, then flushes —
         * the collision domain breathes: collide -> hold -> dump. */
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
            /* backoff: the buffered collision holds LIQDW ticks before
             * the junction can flush it — a real collision domain's
             * retry delay, not instant release */
            if (lIQ[si]) {
                if (lIQ[si] >= LIQCAP && ++lIQD[si] >= (LIQDW + busy)) {
                    /* flush: the buffered mass bursts back onto the
                     * moving streams — antipodal pair release
                     * (momentum-balanced, like the collision was) */
                    int c = (si + LTICK) % LMOV;
                    int burst = lIQ[si] >> 1;
                    lIQ[si] -= 2 * burst;
                    lIQD[si] = 0;
                    uint32_t v;
                    v = lUP[si*LMOV+c] + burst;   lUP[si*LMOV+c] = v > 255 ? 255 : v;
                    v = lUP[si*LMOV+(c^1)] + burst; lUP[si*LMOV+(c^1)] = v > 255 ? 255 : v;
                    LIEV[10] += burst;
                } else if (lIQ[si] < LIQCAP) lIQD[si] = 0;
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
            lFLUX[si] += n;   /* departing flux — the junction's motion cost */
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
            /* LINK-LEVEL backpressure: a packet in flight continues
             * on its channel (transit persistence = momentum). It
             * parks ONLY when the continuation wire refuses — the
             * outgoing link ni->c is loaded. Junction density doesn't
             * buffer transit traffic; the wire's own load does.
             * Parked mass lands on its channel's drest (the winding
             * it carried). This is the duplex model earning its keep:
             * parking is a per-LINK decision, momentum persists. */
            int busy = lLOAD[ni*LMOV+c];          /* continuation wire load */
            if (LFRIC && busy >= LFRIC) {
                /* strict friction: the continuation wire is loaded —
                 * the packet buffers at this junction (meso3i's hard
                 * park penalty, relocated to the wire-level signal).
                 * Transit persists only on a genuinely free link —
                 * momentum is free in vacuum, costly in traffic. */
                int park = n, esc = 0;
                if (park) {
                    /* winding sustenance: parked mass lands on the
                     * junction's DOMINANT drest channel — a wound lump
                     * re-winds its arrivals onto its own spin axis
                     * (the spin is renewable, fed by accretion — like
                     * a spinning body entraining captured material). */
                    int bc = c, best = 0;
                    for (int cc = 0; cc < LMOV; cc++)
                        if (lDR[ni*LMOV+cc] > best) { best = lDR[ni*LMOV+cc]; bc = cc; }
                    if (best >= 16) c = bc;
                    uint32_t v = lDR[ni*LMOV+c] + park;
                    lDR[ni*LMOV+c] = v > 255 ? 255 : v;
                    LIEV[6] += park;
                }
                if (esc) lUPd[ni*LMOV+c] += esc;
            } else {
                lUPd[ni*LMOV+c] += n > 255 ? 255 : n;
            }
            lLOAD[si*LMOV+c] += n;
            continue;
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
            /* self-collimation: photons prefer channels that already
             * carry photon flow — light follows light, the waveguide
             * effect. The exchange concentrates on the lit path. */
            if (LPHOT >= 4) {
                int bestc = c, bestv = 0;
                for (int cc = 0; cc < LMOV; cc++) {
                    if (cc == (c^1)) continue;          /* don't U-turn */
                    int v = lPH[si*LMOV+cc];
                    if (v > bestv) { bestv = v; bestc = cc; }
                }
                if (bestv > 0) c = bestc;
            }
            int ni = lidx(lwrap(x + LCV[c][0], LW),
                          lwrap(y + LCV[c][1], LH),
                          lwrap(z + LCV[c][2], LD));
            /* absorb: photons arriving at parked mass -> iE (substrate:
             * bound energy; operator: the wire deposits into node) */
            int mass = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) mass += lDR[ni*LMOV+cc];
            /* catalyst zone: the mass check extends to neighbors — a
             * photon passing NEAR mass converts ONTO it (the nucleus
             * takes the recoil — the energy joins the catalyst, not
             * the photon's own site). Deposits land at the mass, so
             * accretion LOCALIZES at existing structure — the seed
             * eats its surroundings, not a corridor. */
            int cat = ni;
            if (mass < 32 && LPHDEC) {
                int nx_ = ni % LW, ny_ = (ni / LW) % LH, nz_ = ni / (LW * LH);
                int bmass = 0;
                for (int cc = 0; cc < LMOV; cc++) {
                    int nn = lidx(lwrap(nx_ + LCV[cc][0], LW),
                                  lwrap(ny_ + LCV[cc][1], LH),
                                  lwrap(nz_ + LCV[cc][2], LD));
                    int nm_ = lREST[nn];
                    for (int dd = 0; dd < LMOV; dd++) nm_ += lDR[nn*LMOV+dd];
                    if (nm_ > bmass) { bmass = nm_; cat = nn; }
                }
                if (bmass >= 96) mass = bmass;   /* convert onto DENSE mass only — thin corridor deposits don't catalyze */
            }
            /* session-state gating: the photon's fate depends on the
             * link's session — at an ESTABLISHED session endpoint it
             * VOLLEYS back (the exchange continues — catch prompts
             * throw); at a LISTEN port it absorbs (the transaction
             * completes); in UDP transit it streams. */
            int sst = lSST[ni*LMOV+c];
            /* the volley needs a LIVE endpoint — a session's echo only
             * fires if the far end still holds mass (a listener). A
             * dead endpoint's channel lets the photon stream on — the
             * ghost session dies when the mass leaves. */
            int emass = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) emass += lDR[ni*LMOV+cc];
            if (sst == 3 && LPHOT && emass > 16) {
                uint32_t v = lPH[ni*LMOV+(c^1)] + p;
                lPH[ni*LMOV+(c^1)] = v > 255 ? 255 : v;
                LIEV[14] += p;
                continue;
            }
            /* absorption echo: at a LISTENing port (SYN+), an absorbed
             * photon gets re-emitted back down the wire it came on —
             * c^1, antipodal, toward the sender. The catch prompts a
             * throw back along the same channel — the exchange's
             * natural direction is the wire it arrived on. */
            if (sst == 2 && LPHOT && lIE[ni] > 0 && emass > 16) {
                lIE[ni]--;
                uint32_t v = lPH[ni*LMOV+(c^1)] + 1;
                lPH[ni*LMOV+(c^1)] = v > 255 ? 255 : v;
                LIPH++;
                LIEV[14]++;
            }
            /* the SDP negotiation: the site's acceptance filter is its
             * own dominant channel (its structure signature — what it
             * "speaks"). A photon whose nu tag matches the site's
             * config gets 200-OK'd (absorbs); a mismatch gets volleyed
             * back (reject — the offer declined). nu=255 unmarked
             * photons negotiate at base rate. */
            int nu = lPHNU[si*LMOV+c];
            /* graded handoff (Compton): the site takes what its line
             * accepts and the photon continues at LOWER nu — partial
             * energy transfer, not all-or-nothing. site nu = the
             * site's line (winding + charge band); photon nu = its
             * energy tag. nu > line -> site takes its share, photon
             * continues downgraded; nu == line -> full absorb;
             * nu < line -> the photon can't fill the transition —
             * passes through (or volleys if the site demands more). */
            int cfg = lSNU[ni];
            if (mass > 96 && LPHOT && p > 0) {
                if (nu > cfg) {
                    /* partial handoff: the site takes its line's
                     * worth of ENERGY per photon — each photon
                     * deposits (nu - cfg) worth... no: deposits cfg
                     * worth (the transition it can take), continuing
                     * at nu - cfg. Energy-conserving: iE += dep*nu
                     * absorbed... photons deposit their excess. */
                    int dep = p > 4 ? 4 : p;          /* photons depositing */
                    uint32_t e = lIE[cat] + dep * 4;   /* energy in = photons * their deposit */
                    lIE[cat] = e > 255 ? 255 : e;
                    LIEV[7] += dep;
                    p -= dep;
                    nu -= cfg + 1;
                    lPHNU[si*LMOV+c] = nu > 0 ? nu : 0;
                    LIPH -= dep;
                    if (!p) continue;
                }
            }
            int compat = (nu == 255) ? 1 : (nu == cfg ? 4 : (nu > cfg ? 2 : 0));
            if (compat == 0 && mass > 96 && LPHOT) {
                /* reject: the offer's config doesn't match — the
                 * photon volleys back toward its sender (declined) */
                uint32_t v = lPH[ni*LMOV+(c^1)] + p;
                lPH[ni*LMOV+(c^1)] = v > 255 ? 255 : v;
                lPHNU[ni*LMOV+(c^1)] = nu;
                LIEV[15]++;
                continue;
            }
            if (LPHOT >= 5 && mass > 96 && p > 0 && (lrnd() & 31) < compat * 2) {
                /* weak-coupling absorption: photon capture is RARE per
                 * encounter (~6% — the mean free path is many hops).
                 * Most photons transmit or volley; only occasionally
                 * does a transaction complete (Kastner: absorption
                 * needs a compatible transition — selective, not
                 * every encounter). The exchange sustains because
                 * photons shuttle many times before one captures. */
                /* motion-diluted absorption: a lump that's moving gets
                 * only a partial handoff — the photon grazes a target
                 * already leaving. Deposited charge ∝ stillness —
                 * the chase-path means the moving absorber absorbs
                 * less per encounter (the clock's charge-in slows
                 * with motion, matching the budget on the dump-out
                 * side). */
                int still = 255 - (lFLUX[ni] >> 2);
                if (still < 0) still = 0;
                int dep = (p * still) >> 8;
                if (dep < 1) dep = 1;
                if (LPHDEC && (lrnd() & 255) < LPHDEC) {
                    uint32_t v = lDR[cat*LMOV+c] + dep;
                    lDR[cat*LMOV+c] = v > 255 ? 255 : v;
                    LIPH -= dep;
                    LIEV[8] += dep;
                    continue;
                }
                uint32_t e = lIE[cat] + dep * (nu > 0 ? nu : 1);   /* photons deposit their nu */
                lIE[cat] = e > 255 ? 255 : e;
                LIPH -= dep;
                LIEV[7] += dep;
                continue;
            }
            /* fusion: photon pairs meeting at a bare junction can
             * materialize (gamma-gamma pair production) — opposing
             * photon streams at a near-vacuum site -> drest pair.
             * Needs BOTH directions present (the transaction needs
             * a partner, like real gg -> ee needs momentum balance). */
            if (LFUS && lPHd[ni*LMOV+(c^1)] && mass < 8 && p > 0) {
                /* fusion as real pair production: energy threshold —
                 * the site's photon DENSITY must exceed LFUS (the
                 * 2mc^2 analog — light materializes only where light
                 * is dense enough). Opposing streams meeting in
                 * vacuum -> BALANCED drest pair {c, c^1} (net-zero
                 * momentum, like a real gamma-gamma -> ee). */
                int pdens = p + lPHd[ni*LMOV+(c^1)];
                for (int cc = 0; cc < LMOV; cc++) pdens += lPH[ni*LMOV+cc];
                int a = p < lPHd[ni*LMOV+(c^1)] ? p : lPHd[ni*LMOV+(c^1)];
                if (a && pdens >= LFUS) {
                    lPHd[ni*LMOV+(c^1)] -= a;
                    uint32_t v;
                    v = lDR[ni*LMOV+c] + a;     lDR[ni*LMOV+c] = v > 255 ? 255 : v;
                    v = lDR[ni*LMOV+(c^1)] + a; lDR[ni*LMOV+(c^1)] = v > 255 ? 255 : v;
                    LIPH -= 2*a;
                    LIEV[9] += a;
                    continue;
                }
            }
            lPHd[ni*LMOV+c] += p > 255 ? 255 : p;
            lPHNUd[ni*LMOV+c] = lPHNU[si*LMOV+c];
        }
    }
    for (int i = 0; i < LN * LMOV; i++) {
        uint32_t v = lPH[i] + lPHd[i];
        if (v > 255) { LIPH -= v - 255; v = 255; }
        lPH[i] = v;
        if (lPHd[i]) lPHNU[i] = lPHNUd[i];
    }

    /* session strength: a wire's session is live when it carries
     * duplex traffic — both directions moving (mass or photons).
     * Session = established duplex exchange, measured as EMA of
     * duplex flow — the bound-state register per link. */
    for (int z = 0; z < LD; z++)
    for (int y = 0; y < LH; y++)
    for (int x = 0; x < LW; x++) {
        if (((x + y + z) & 1)) continue;
        int si = lidx(x, y, z);
        for (int c = 0; c < LMOV; c++) {
            int ni = lidx(lwrap(x + LCV[c][0], LW),
                          lwrap(y + LCV[c][1], LH),
                          lwrap(z + LCV[c][2], LD));
            /* duplex flow: up on this link + dn on the antipodal link
             * (ni's c^1 channel back toward si) — the session's
             * bidirectional traffic */
            int up = lUP[si*LMOV+c] + lPH[si*LMOV+c];
            int dn = lUP[ni*LMOV+(c^1)] + lPH[ni*LMOV+(c^1)];
            int flow = (up < dn ? up : dn) >> 2;   /* duplex = min of directions */
            /* session bias: a wire toward a MASSIVE endpoint is the
             * preferred session direction — the pair's exchange
             * concentrates on the connecting axis. Mass attracts the
             * session; the session steers the flow. */
            int emass = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) emass += lDR[ni*LMOV+cc];
            if (emass > 48) flow += flow >> 1;   /* mass-weighted: heavy endpoint boosts the session */
            int s = lSESS[si*LMOV+c];
            s = (s * 7 + flow * 8) >> 3;           /* EMA toward duplex flow */
            lSESS[si*LMOV+c] = s > 255 ? 255 : s;
            /* session lifecycle — the link's TCP state machine:
             * UDP(0): sessionless traffic, no state
             * SYN(1): handshake — first duplex exchange seen
             * ESTAB(2): established — sustained duplex (the bound state)
             * CLOSED(3): session dropped — duplex died, aged out
             * A session can't look like UDP: established links route
             * preferentially (the bound exchange gets its own channel). */
            int idx = si * LMOV + c;
            /* LISTEN: a link whose endpoint holds mass is an open
             * socket — the junction is ready to absorb (passive open).
             * Mass makes the port listen; vacuum transit stays UDP. */
            int mass = lREST[ni];
            for (int cc = 0; cc < LMOV; cc++) mass += lDR[ni*LMOV+cc];
            /* a dead endpoint closes the session outright — the bond
             * needs BOTH sockets live. Residual channel traffic can't
             * hold a session whose endpoint is gone. */
            if (mass <= 16 && lSST[idx] >= 2) { lSST[idx] = 4; lSESS[idx] = 0; LIEV[15]++; }
            if (mass > 16 && lSST[idx] == 0) lSST[idx] = 1;   /* UDP -> LISTEN */
            if (mass <= 16 && lSST[idx] == 1) lSST[idx] = 0;  /* port closed — no mass to absorb */
            /* session traffic = an ACK on the wire — ANY traffic on
             * an active session counts (either direction — receiving
             * IS the keepalive). ESTAB = session traffic seen within
             * the timeout; CLOSED = no traffic for the window. */
            int traffic = up > 0 || dn > 0;
            /* hub preference: a MASSIVE endpoint's socket attracts
             * sessions — its many ports make it a preferential target
             * (the Barabasi-Albert attachment: sessions prefer dense
             * endpoints). Saturated -> hub wins (many ports catch the
             * flow); sparse -> peer-peer (one focused duplex beats
             * a spread hub — the hub can't hold weak sessions). */
            int pref = mass > 128 ? 3 : mass > 48 ? 1 : 0;   /* hub gets the boost */
            if (traffic && lSST[idx] >= 1) {
                lSAGE[idx] = 0;
                /* keepalive: received traffic prompts a reply — the
                 * catch prompts a throw. Charged endpoints answer back
                 * — the session self-sustains through the ACK chain. */
                if (lSST[idx] >= 2 && lIE[ni] > 16 && LPHOT) {
                    uint32_t e = lIE[ni];
                    int out = e > 8 ? 8 : e;
                    lIE[ni] = e - out;
                    uint32_t v = lPH[ni*LMOV+(c^1)] + out;
                    lPH[ni*LMOV+(c^1)] = v > 255 ? 255 : v;
                    LIPH += out;
                }
                if (lSST[idx] == 1 && (lSESS[idx] > 1 || pref)) lSST[idx] = 2;  /* SYN: traffic at a LISTEN port */
                else if (lSST[idx] == 2 && lSESS[idx] > (4 - pref)) lSST[idx] = 3;  /* ESTAB: hub promotes easier */
                if (lSST[idx] == 4) lSST[idx] = 0;          /* fresh start after close */
                LIEV[14]++;
                /* the BOND: session depth accumulating — the channel's
                 * structural holding grows while connected (exchange
                 * history embedding into the wire — the bond is the
                 * connection's own mass, not the flow). */
                if (lSST[idx] == 3) {
                    uint32_t b = lBOND[idx] + 1;
                    lBOND[idx] = b > 65535 ? 65535 : b;
                }
            } else if (lSST[idx] >= 2) {
                if (++lSAGE[idx] > 32) {                     /* timeout: no traffic 32 ticks */
                    lSST[idx] = 4;                           /* CLOSED */
                    lSESS[idx] = 0;
                    LIEV[15]++;
                }
            } else if (lBOND[idx]) {
                lBOND[idx] >>= 1;   /* dead channel's structure drains */
            }
        }
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
