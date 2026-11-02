/* qi3 — transactional substrate ("QI realized").
 * The next engine after link3: CDT lattice + 't Hooft deterministic
 * rules + Kastner TI transactions (offer + confirmation completes
 * the exchange — absorption is the absorber's response, not just
 * photon impact).
 *
 * Inherits link3's proven mechanics: local rules only, c=1 hop/tick,
 * nu multi-role, parked flux, session lifecycle, broadcast emission.
 * Adds absorber-side internal LEVEL STRUCTURE — sites occupy discrete
 * modes, transitions are all-or-nothing at matching gaps.
 *
 * Naming: registers and exported functions are spelled out (long
 * names document the ontology); inner-loop helpers stay shorthand.
 *
 * Registers per site:
 *   qMass            parked mass (structure — stays put)
 *   qWinding[c]      winding / momentum channel population
 *   qLevel           level occupation (integer mode index — internal config)
 *   qCharge          bound charge (deposits from completed transactions)
 *   qMassFlight[c]   in-flight mass per channel (+ _next double-buffer)
 *   qPhoton[c]       photons per channel (the offers) (+ _next)
 *   qPhotonNu[c]     photon nu tag (offer energy) (+ _next)
 *   qConfirm[c]      confirmations armed this tick (responses to offers)
 *   qSessionState[c], qSessionStrength[c]  per-link session registers
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EMS_API EMSCRIPTEN_KEEPALIVE
#else
#define EMS_API
#endif

static int QWidth, QHeight, QDepth, QSites;
static int QChannels = 18;
static int8_t QChannelVec[18][3] = {
    { 1, 1,0},{-1,-1,0},{ 1,-1,0},{-1, 1,0},
    { 1,0, 1},{-1,0,-1},{ 1,0,-1},{-1,0, 1},
    {0, 1, 1},{0,-1,-1},{0, 1,-1},{0,-1, 1},
    {2,0,0},{-2,0,0},{0,2,0},{0,-2,0},{0,0,2},{0,0,-2}
};

static uint32_t *qMass, *qWinding, *qLevel, *qCharge;
static uint32_t *qMassFlight, *qMassFlight_next;
static uint32_t *qPhoton, *qPhoton_next, *qPhotonNu, *qPhotonNu_next;
static uint32_t *qConfirm, *qSessionStrength, *qDepositEdge, *qWinEdge;
static uint8_t  *qSessionState;                  /* per-EDGE (9/site) */
static uint32_t *qHeld, *qHeldNu, *qHeldBirth, *qHeldPhase;   /* incipients */
static uint32_t *qHeldInt;                                     /* internal incipients — offers
                 * answered INTRA-node (a saturated edge's offer routed
                 * to the node's own free edges) — the internal exchange */
static uint32_t *qLoopPhase;                                   /* per-edge loop phase —
     * DEPRECATED for the coherent-phase redesign: the bound state is
     * ONE oscillator — a SHARED per-site phase (qPhase) with edges at
     * fixed angular offsets in the bound state's rotational space.
     * The winding is the offset-progression around the bound state —
     * the phase wrapping consistently, not per-edge clocks.
     * (was: the circulation's POSITION in its cycle 0-255.) */
static uint32_t *qPhase;                                       /* per-site bound-state phase —
     * ONE oscillator for the whole bound state. The edge's effective
     * phase = qPhase + edgeOffset(e) — a shared cycle position plus
     * each edge's angular position in the bound state's rotational
     * structure. The winding is the spatial phase-progression —
     * the bound state as a coherent spinner, not 9 synced clocks. */
static uint32_t *qLocalDensity;                                /* neighbor-sampled
                 * density — the node's estimate of its local structure:
                 * what the node can actually MEASURE (its causal
                 * neighborhood), tracked over time (a local memory).
                 * The node's opacity = its place in the gradient. */
static uint8_t  *qHeldDir, *qHeldStim;           /* dir + stim candidates */
static uint32_t *qPhotonBirth, *qPhotonBirth_next;/* offer birth tick tag */
static uint32_t *qAck, *qAck_next;               /* returning confirms */
static uint32_t *qAckTtl, *qAckTtl_next;         /* hops remaining home */
static uint32_t *qAckRtt, *qAckRtt_next;         /* round-trip delivered */
static uint32_t *qBondDist;                      /* measured edge distance */
static uint32_t *qSiteWind;                      /* per-site totals (scratch) */
static uint64_t qEvents[32];
static int qUnwindShift = 2; /* fractional unwind: shed 1>>shift of the
                              weakest loop per emission. 2=quarter,
                              3=eighth, 1=half — the binding-depth knob. */
static uint32_t *qHeat;      /* vacuum heat reservoir per site — the
                              medium's local temperature. Seeks a global
                              target via photon absorption; obstructs
                              the flux by structure. */
static int qTempShift = 6;   /* global target: vacuum heat ~ 1<<shift
                              per site — the authored cosmic background */
static int qFusionWall = 256;/* mass-fusion ratio: nua+nub >= wall traps
                              2 flux -> 1 rest. 128=1:1, 256=2:1, 384=3:1
                              — the scale's conversion rate, a hypothesis */
static int qCycleShift  = 0; /* internal-cycle rate: the node's structure
                              cycles every 2^shift ticks — the sub-tick
                              clock at the macro scale. The photon hops
                              1/tick (c at transit scale) while internal
                              dynamics run slower — like a real atom. */
static int qPhaseMode = 0; /* 0 classical | 1 coherence lottery:
                            incipients carry phase nu*transit,
                            in-phase candidates boost each other —
                            interference in the Born weight */
static int qGapShift = 0;  /* emitted-nu downshift: scale separation
                            (transitions << rest energy, the alpha^2
                            analog — emitted light can't re-fuse) */
static int qGapMode = 0;   /* level-function candidates — falsifiable:
                            * 0 harmonic comb (nu % line == 0)
                            * 1 quadratic well E0/n^2 (converging)
                            * 2 coulomb shell E0/n  (converging)
                            * 3 harmonic oscillator E0*n (linear)
                            * 4 particle-in-box E0*n^2 (diverging) */
static inline uint32_t edgeLen2(int c){
    /* squared reach of channel c: axis (12-17) span 2 cells,
       diagonals span sqrt(2) -> use squared lengths */
    return c>=12?4:2;
}
static uint64_t siteLoopE(int si){
    /* energy of the loop configuration: matched winding per edge
       weighted by 1/reach^2 — tight loops bind harder. Reach is
       the edge's MEASURED distance (qBondDist — a bond's real span)
       when known, else the channel's geometric reach. Loops on
       long edges are extended structures, looser-bound. */
    uint64_t E=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(!m)continue;
        uint32_t reach=qBondDist[si*(QChannels/2)+e];
        uint64_t L2=reach?(uint64_t)reach*reach:edgeLen2(2*e);
        E+=(uint64_t)(m*m)*4/L2;
    }
    return E;
}
static int qi3levelE(int n){
    switch(qGapMode){
        case 1: return 256/(n*n);
        case 2: return 256/n;
        case 3: return n>0?256/n:0;          /* Em = E0/n for emit... */
        case 4: return 256/(n*n);
        default: return 256/(n*n);
    }
}
/* level gap m->n transition energy: |E_m - E_n| under candidate
 * shapes. For diverging families (3,4) E grows with n: */
static int qi3gapE(int a,int b){
    int Ea, Eb;
    if(qGapMode==3){ Ea=16*a; Eb=16*b; }        /* E0*n, E0=16 */
    else if(qGapMode==4){ Ea=4*a*a; Eb=4*b*b; } /* E0*n^2, E0=4 */
    else { Ea=qi3levelE(a); Eb=qi3levelE(b); }
    int g=Ea-Eb; return g<0?-g:g;
}
/* mode 5 — GEOMETRIC: gaps derive from the loop's edge mix.
   Emitted nu = the loop-energy released when one band drops —
   sites with the same n but different circulation patterns emit
   different nu (the spectrum IS the structure). */
static int qi3geoGap(int si,int bands){
    if(bands<1)return 0;
    /* topology-aware: a transition drops the weakest BOUND edge —
     * VOLUME migration: what siteUnwind sheds is the least-bound
     * committed component (m>=32), not only a complete 128 loop.
     * The emitted nu is that fraction's geometric energy — a
     * partially occupied edge transitions too. */
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=32&&(be<0||m<bm)){bm=m;be=e;}
    }
    if(be<0)return 0;
    uint32_t reach=qBondDist[si*(QChannels/2)+be];
    uint64_t L2=reach?(uint64_t)reach*reach:edgeLen2(2*be);
    /* fractional transition: the shed is a QUARTER of the weakest
     * loop — the emitted nu is that fraction's geometric energy,
     * not the whole loop's. Deeper binding, smaller transitions. */
    int nu=(int)((uint64_t)(bm>>qUnwindShift)*2/L2);
    if(nu<1)nu=1;if(nu>255)nu=255;return nu;
}
static uint64_t qTick, qPhotonLedger;
static uint64_t qRngSeed = 88172645463325252ULL;

static inline int siteIndex(int x,int y,int z){ return (z*QHeight+y)*QWidth+x; }
static inline int wrapCoord(int v,int m){ v%=m; if(v<0)v+=m; return v; }
static inline uint64_t loopWinding(int si){
    /* the bound VOLUME: matched winding across each edge pair is
     * committed circulation (bound occupancy) — the level derives
     * from its total. "loop" is a historical name; the measured
     * quantity is the volume of bound exchange. */
    uint64_t w=0;
    for(int e=0;e<QChannels/2;e++)
        w+=2*(qWinding[si*QChannels+2*e]<qWinding[si*QChannels+2*e+1]
              ?qWinding[si*QChannels+2*e]:qWinding[si*QChannels+2*e+1]);
    return w;
}
static inline void snapLoop(int si,int e){
    /* rung-quantize a loop's matched amplitude on arrival — the
     * bound state snaps to the allowed ladder, excess stays free */
    int c0=si*QChannels+2*e, c1=c0+1;
    uint32_t a=qWinding[c0],b=qWinding[c1];
    uint32_t m=a<b?a:b;
    if(m<32||m>128)return;   /* sub-rung edges aren't loops — the
         * attractor drain owns that domain. CRITICAL: quantizing a
         * sub-32 edge makes dm=m-rung NEGATIVE -> uint32 wrap to
         * ~4 billion -> the m>128 drain clamps it back to exactly
         * 128, minting a full quantum from nothing. That wrap+clamp
         * pair was the "conduction flood": every transfer to a
         * fresh edge manufactured a 128. Never quantize downward
         * across the floor. */
    uint32_t rung=m>>qUnwindShift<<qUnwindShift;  /* nearest rung <= m */
    if(rung<32)rung=32;                          /* don't snap below floor */
    uint32_t dm=m-rung;
    if(a>b){qWinding[c0]-=dm;}else if(b>a){qWinding[c1]-=dm;}
    else{qWinding[c0]-=dm/2;qWinding[c1]-=dm/2;}
    /* the DIRECTEDNESS also rung-quantizes — the substrate only
     * generates circulation in loop-quanta, so the unmatched
     * excess snaps to the same ladder: a bound state's circulation
     * is a multiple of the loop-quantum, not a continuous magnitude.
     * The spin is discrete because circulation comes in rungs. */
    {
        int32_t d=(int)qWinding[c0]-(int)qWinding[c1];
        int32_t dr=(d>>qUnwindShift)<<qUnwindShift;
        if(dr<0)dr=0;
        int32_t dd=d-dr;
        if(dd>0)qWinding[c0]-=(uint32_t)dd;
    }
}
static inline int siteLevel(int si){
    /* occupancy-volume level: the bound state is a DISTRIBUTION of
     * circulation over the node's edge-space — a 3D shape, not a
     * set of loop-lines. The level = the volume of bound occupancy:
     * how much closed circulation the node holds, in quanta. A site
     * at level n holds ~n quanta of bound exchange — the geometry
     * of the distribution IS the state (mathematicians get their
     * geometry back — this is a volume, not a line). */
    int n=1;
    uint32_t vol=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=32)vol+=m;                     /* COMMITTED circulation only
         * — the threshold is what separates bound structure from
         * traffic. The volume counts committed exchange, not flux. */
    }
    n+=vol>>7;                             /* 128 = one quantum of volume */
    if(n>8)n=8;return n;
}
static inline void siteUnwind(int si,uint32_t amount){
    int full=(amount>500000);   /* full depletion: consume the whole loop */
    /* quantized unwind: the least-bound component sheds a rung —
     * VOLUME migration: any committed edge (m>=32) is bound
     * occupancy, not only complete 128-quanta. The weakest bound
     * part transitions first (like the outermost electron), and a
     * partially-wound site can emit too — volume, not loop-lines. */
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(m<32)continue;
        /* skip edges whose directedness is part of a CLOSED
         * circulation — a bound vortex's edges aren't weak, they're
         * topologically protected. Don't shed the circulation. */
        int32_t dd=(int)a-(int)b;if(dd<0)dd=-dd;
        if(dd>=32){
            int big=a>b?2*e:2*e+1;
            int xx=si%QWidth,yy=(si/QWidth)%QHeight,zz=si/(QWidth*QHeight);
            int ni=siteIndex(wrapCoord(xx+QChannelVec[big][0],QWidth),
                             wrapCoord(yy+QChannelVec[big][1],QHeight),
                             wrapCoord(zz+QChannelVec[big][2],QDepth));
            int rc=(big&1)?big-1:big+1;
            uint32_t ra=qWinding[ni*QChannels+rc],rb=qWinding[ni*QChannels+big];
            if(ra>rb&&ra-rb>=32)continue;      /* reciprocal: closed */
        }
        if(be<0||m<bm){bm=m;be=e;}             /* weakest bound edge */
    }
    if(be<0)return;
    /* GROUND-STATE protection: the bound state can't unwind below
     * its minimum bound volume — the ground state being the lowest
     * stable configuration. In nature a stable particle can't
     * decay below its ground state (nothing lighter to carry its
     * quantum). The threshold is context-sensitive — the bound
     * state can't drop below a minimum volume, protecting the
     * ground state from spontaneous unwinding. */
    uint32_t tv=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t m2=qWinding[si*QChannels+2*e]<qWinding[si*QChannels+2*e+1]
                   ?qWinding[si*QChannels+2*e]:qWinding[si*QChannels+2*e+1];
        if(m2>=32)tv+=m2;
    }
    if(tv<=512)return;          /* ground-state floor — can't unwind below */
    /* RUNG-QUANTIZED unwind: the loop drops to the next allowed
     * rung (128->96->64->32->0), emitting the rung difference —
     * bound states are DISCRETE amplitudes, not a continuum.
     * The 't Hooft allowed-periods made mechanical: only certain
     * loop strengths are real states, so the spectrum sharpens. */
    uint32_t a=qWinding[si*QChannels+be*2],b=qWinding[si*QChannels+be*2+1];
    uint32_t m=a<b?a:b;
    uint32_t shed;
    if(full){shed=m;}                           /* consume the whole loop */
    else{
        uint32_t rung=(m-1)>>qUnwindShift;
        uint32_t next=rung<<qUnwindShift;
        if(next>=m)next=(rung-1)<<qUnwindShift;
        shed=m-next;if(shed<1)shed=1;
    }
    uint32_t da=a>shed?shed:a, db=b>shed?shed:b;
    qWinding[si*QChannels+be*2]-=da;
    qWinding[si*QChannels+be*2+1]-=db;
}
static inline uint8_t randByte(void){ qRngSeed^=qRngSeed>>12;qRngSeed^=qRngSeed<<25;qRngSeed^=qRngSeed>>27;
    return (uint8_t)((qRngSeed*0x2545F4914F6CDD1DULL)>>56); }
/* edgeOffset — the edge's angular position around the bound state's
 * circulation axis: the angle of the edge's direction projected
 * onto the plane perpendicular to the bound state's dominant
 * directedness. The offsets form a SPATIAL progression — the phase
 * winding around the circulation axis, not fixed by edge type. */
static inline uint32_t edgeOffset(int e,int axis){
    /* the rotation plane is perpendicular to the axis edge — the
     * edge's offset is its angle around the axis, quantized to the
     * 255-cycle. Simple version: the edge's position in the ring
     * ordered by direction around the axis. */
    static const int ring[3][8]={
        {2,4,10,8, 6,12,14,0},   /* around +x (yz-plane edges) */
        {0,2,6,14,12,10,4,0},    /* around +y (xz-plane edges) */
        {0,4,6,10,2,0,0,0},      /* around +z (xy-plane edges) */
    };
    if(axis<0||axis>8)axis=0;
    int ax=axis>5?axis-6:0;
    for(int i=0;i<8;i++)if(ring[ax][i]==2*e)return (uint32_t)(i*32)&255;
    return 0;
}
/* effectivePhase — the edge's receptive-window phase: the bound
 * state's SHARED orientation (qPhase, a 0-511 doubled cycle —
 * direction is mod-256, sheet is /256) plus the edge's angular
 * offset. The window uses the DIRECTION part (mod-256) — the
 * sheet is the bound state's spinor-cover, not a window. */
static inline uint32_t effPhase(int si,int e){
    int ax=-1;int32_t dd=0;
    for(int e2=0;e2<QChannels/2;e2++){
        int32_t d2=(int)qWinding[si*QChannels+2*e2]
                 -(int)qWinding[si*QChannels+2*e2+1];
        if(d2>dd){dd=d2;ax=e2;}
    }
    return ((qPhase[si]&255)+edgeOffset(e,ax))&255; }

EMS_API int qi3_init(int width,int height,int depth,int mov){
    QWidth=width;QHeight=height;QDepth=depth;QSites=QWidth*QHeight*QDepth;
    if(mov>0&&mov<=18)QChannels=mov;
    qMass           =calloc((size_t)QSites,sizeof(uint32_t));
    qWinding        =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qLevel          =calloc((size_t)QSites,sizeof(uint32_t));
    qCharge         =calloc((size_t)QSites,sizeof(uint32_t));
    qMassFlight     =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qMassFlight_next=calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qPhoton         =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qPhoton_next    =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qPhotonNu       =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qPhotonNu_next  =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qConfirm        =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qDepositEdge    =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qWinEdge        =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qHeld           =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qHeldInt        =calloc((size_t)QSites,sizeof(uint32_t));
    qHeat           =calloc((size_t)QSites,sizeof(uint32_t));
    qLoopPhase      =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qPhase          =calloc((size_t)QSites,sizeof(uint32_t));
    qLocalDensity   =calloc((size_t)QSites,sizeof(uint32_t));
    qHeldNu         =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qHeldDir        =calloc((size_t)QSites*(QChannels/2),1);
    qHeldStim       =calloc((size_t)QSites*(QChannels/2),1);
    qHeldBirth      =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qHeldPhase      =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qPhotonBirth    =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qPhotonBirth_next=calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAck            =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAck_next       =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAckTtl         =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAckTtl_next    =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAckRtt         =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qAckRtt_next    =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qBondDist       =calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    qSiteWind       =calloc((size_t)QSites,sizeof(uint32_t));
    qSessionState   =calloc((size_t)QSites*(QChannels/2),1);
    qSessionStrength=calloc((size_t)QSites*(QChannels/2),sizeof(uint32_t));
    return (qMass&&qWinding&&qLevel&&qCharge&&qMassFlight&&qMassFlight_next&&
            qPhoton&&qPhoton_next&&qPhotonNu&&qPhotonNu_next&&qConfirm&&
            qSessionState&&qSessionStrength&&qHeldBirth&&qPhotonBirth&&
            qPhotonBirth_next&&qAck&&qAck_next&&qAckTtl&&qAckTtl_next&&
            qAckRtt&&qAckRtt_next&&qBondDist)?0:-1;
}

EMS_API int qi3_channel_count(void){ return QChannels+1; }
EMS_API void qi3_tick(void){
    qTick++;
    memset(qMassFlight_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qPhoton_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qPhotonBirth_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qAck_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qAckTtl_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qAckRtt_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qConfirm,0,(size_t)QSites*(QChannels/2)*sizeof(uint32_t));

    /* Resolution pass (heartbeat beat 2): incipient offers armed last
     * tick compete — ONE actualizes per site per tick, weighted by
     * count*nu*(1+edge bond) (Born-like lottery). Losers' offers
     * return to the stream — declined transactions continue. */
    for(int si=0;si<QSites;si++){
        uint64_t totW=0;
        uint32_t coh[QChannels/2];                       /* coherence term */
        for(int e=0;e<QChannels/2;e++){
            coh[e]=1;
            if(!qPhaseMode||!qHeld[si*(QChannels/2)+e])continue;
            uint32_t pe=qHeldPhase[si*(QChannels/2)+e]&255;
            int aligned=0;
            for(int e2=0;e2<QChannels/2;e2++){
                if(e2==e||!qHeld[si*(QChannels/2)+e2])continue;
                uint32_t p2=qHeldPhase[si*(QChannels/2)+e2]&255;
                int d=(int)pe-(int)p2; if(d<0)d=-d; if(d>128)d=256-d;
                if(d<64)aligned++;                      /* in-phase */
            }
            coh[e]=1+aligned;                           /* constructive boost */
        }
        for(int e=0;e<QChannels/2;e++){
            uint32_t h=qHeld[si*(QChannels/2)+e];
            if(h)totW+=(uint64_t)h*qHeldNu[si*(QChannels/2)+e]
                       *coh[e]*(1+(qSessionStrength[si*(QChannels/2)+e]>>3));
        }
        if(!totW)continue;
        /* unlocked edges: each armed edge is an INDEPENDENT port to
         * a different neighbor — they resolve in parallel, not a
         * single-winner lottery. The reach-density coupling: a dense
         * node has many armed edges transacting at once (confined,
         * short-range exchange); a sparse node's few armed ports
         * leave photons free-streaming (long-range). */
        for(int e=0;e<QChannels/2;e++){
            uint32_t h=qHeld[si*(QChannels/2)+e];
            uint32_t nu=qHeldNu[si*(QChannels/2)+e];
            if(!h)continue;
            uint64_t wt=(uint64_t)h*nu*coh[e]*(1+(qSessionStrength[si*(QChannels/2)+e]>>3));
            if(wt){
                int cc=(e<<1)|qHeldDir[si*(QChannels/2)+e];
                if(qHeldStim[si*(QChannels/2)+e]){
                    /* stimulated winner: ONE clone per trigger — the
                     * site falls one level and releases nu; the
                     * emitted photon's energy is the transition gap,
                     * not the offer's intensity. One atom, one
                     * transition, one quantum — no multiplicative
                     * runaway. */
                    if(siteLevel(si)>1){
                        qPhoton[si*QChannels+cc]+=1;  /* ONE clone per
                         * trigger — and the excitation is FULLY SPENT:
                         * the whole weakest loop unwinds, not a rung.
                         * One atom, one photon, done — conservation
                         * does the bounding, not a rate cap. */
                        qPhotonNu[si*QChannels+cc]=nu;
                        siteUnwind(si,0);           /* one rung — not full depletion */
                        qEvents[17]++;
                    } else {
                        qPhoton[si*QChannels+cc]+=1; /* can't drop: pass one */
                        qPhotonNu[si*QChannels+cc]=nu;
                    }
                    qHeldStim[si*(QChannels/2)+e]=0;
                    qHeld[si*(QChannels/2)+e]=0;continue;
                }
                /* WINNER actualizes — the offer deposits its PACKET
                 * (nu), not a fixed quantum: onto the ARRIVAL edge
                 * first (the transaction completes where the offer
                 * landed — the selector approved this state), else
                 * routed INTERNALLY to the freest edge (the corner —
                 * structural, not a coin flip). Crowded nodes split
                 * because the free-edge geometry forces it. */
                for(uint32_t ph=0;ph<h;ph++){
                    int arr=(cc>>1);                    /* arrival edge */
                    uint32_t aA=qWinding[si*QChannels+2*arr],
                             bA=qWinding[si*QChannels+2*arr+1];
                    uint32_t mA=aA<bA?aA:bA;
                    if(mA+nu<=160){
                        /* matched deposit first — bound structure
                         * needs both channels (the circulation is
                         * balanced occupancy). If the bound state
                         * ALREADY has directedness (a vortex), a
                         * share also feeds the directed edge — the
                         * spin responds to momentum without
                         * unbalancing structure formation. */
                        qWinding[si*QChannels+2*arr]+=nu;
                        qWinding[si*QChannels+2*arr+1]+=nu;
                        int de=-1;int32_t dd=0;
                        for(int e2=0;e2<QChannels/2;e2++){
                            int32_t d2=(int)qWinding[si*QChannels+2*e2]
                                     -(int)qWinding[si*QChannels+2*e2+1];
                            if(d2>dd){dd=d2;de=e2;}
                        }
                        if(de>=0){
                            /* the spin's SHEET matters: a bound state
                             * on the +sheet (qPhase<256) absorbs aligned
                             * torque into its circulation; on the
                             * -sheet (qPhase>=256) the same torque
                             * flips it — the spin-projection being a
                             * real DOF, not just a label. */
                            int sheet=(qPhase[si]>=256)?-1:1;
                            int32_t feed=(int32_t)(nu>>2)*sheet;
                            int32_t newD=(int)qWinding[si*QChannels+2*de]
                                       +feed-(int)qWinding[si*QChannels+2*de+1];
                            if(newD>0)qWinding[si*QChannels+2*de]+=(uint32_t)feed;
                        }
                        qDepositEdge[si*(QChannels/2)+arr]+=1;
                        continue;
                    }
                    /* arrival edge full: route internally — prefer
                     * the bound state's DOMINANT DIRECTEDNESS (the
                     * circulation axis — the vortex "corrects" the
                     * absorbed energy into its rotation direction,
                     * conserving circulation like a real spinning
                     * bound state feeding absorbed momentum into
                     * its spin), else the freest edge (the corner). */
                    int fe=-1;uint32_t fm=999;
                    int start=randByte()%(QChannels/2);
                    /* directed edge first — the circulation's axis */
                    int32_t dd=0;
                    for(int e2=0;e2<QChannels/2;e2++){
                        int32_t d2=(int)qWinding[si*QChannels+2*e2]
                                 -(int)qWinding[si*QChannels+2*e2+1];
                        uint32_t m2=qWinding[si*QChannels+2*e2]<qWinding[si*QChannels+2*e2+1]
                                  ?qWinding[si*QChannels+2*e2]:qWinding[si*QChannels+2*e2+1];
                        if(d2>dd&&m2<128){dd=d2;fe=e2;}
                    }
                    for(int j=0;j<QChannels/2&&fe<0;j++){
                        int e2=(start+j)%(QChannels/2);
                        uint32_t a2=qWinding[si*QChannels+2*e2],
                                 b2=qWinding[si*QChannels+2*e2+1];
                        uint32_t m2=a2<b2?a2:b2;
                        if(m2<128&&m2<fm){fm=m2;fe=e2;} /* FREEST edge */
                    }
                    if(fe<0){qCharge[si]+=nu;continue;} /* all full: stays fuel */
                    qWinding[si*QChannels+2*fe]+=nu;
                    qWinding[si*QChannels+2*fe+1]+=nu;
                    qDepositEdge[si*(QChannels/2)+fe]+=1;
                }
                qEvents[18]+=(uint64_t)h*nu;
                qEvents[3]+=h;qEvents[16]+=(uint64_t)h*nu;
                qSessionStrength[si*(QChannels/2)+e]+=h;
                if(qSessionState[si*(QChannels/2)+e]<2)
                    qSessionState[si*(QChannels/2)+e]++;
                qEvents[qSessionState[si*(QChannels/2)+e]==1?10:11]++;
                qConfirm[si*(QChannels/2)+e]+=h;
                qWinEdge[si*(QChannels/2)+e]+=h;   /* wins by arrival edge */
                /* the ACK returns home: tau = offer's transit time,
                 * ack walks back ttl=tau hops carrying RTT=2*tau —
                 * the emitter's edge receives a measured distance. */
                {
                    int tau=(int)(qTick-qHeldBirth[si*(QChannels/2)+e]);
                    if(tau>40)tau=40;if(tau<1)tau=1;   /* lattice bound */
                    int oc2=cc^1;
                    qAck_next[si*QChannels+oc2]+=1;
                    qAckTtl_next[si*QChannels+oc2]=tau;
                    qAckRtt_next[si*QChannels+oc2]=2*tau;
                }
            } else {
                /* DECLINED: the offer rejoins the stream */
                int c=(e<<1)|qHeldDir[si*(QChannels/2)+e];
                qPhoton[si*QChannels+c]+=h;
                qPhotonNu[si*QChannels+c]=nu;
            }
            qHeld[si*(QChannels/2)+e]=0;
        }
        /* INTERNAL incipients actualize — RARE: the network ontology
         * prefers large infrequent changes. One internal transaction
         * per site per tick at most — the dense-regime exception,
         * not equilibrium flow. VOLUME migration: the ledger accretes
         * into the edge with the most room — partial occupancy grows
         * by what fits, not a whole quantum on a free edge. */
        if(qHeldInt[si]>=128){
            int fe=-1,start=randByte()%(QChannels/2);uint32_t room=0;
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],
                         b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;
                uint32_t r=m<160?160-m:0;
                if(r>room){room=r;fe=e2;}
            }
            uint32_t k=qHeldInt[si]>128?128:qHeldInt[si];
            if(k>room)k=room;
            if(k>=8&&fe>=0){
                qWinding[si*QChannels+2*fe]+=k;
                qWinding[si*QChannels+2*fe+1]+=k;
                qHeldInt[si]-=k;qEvents[3]++;
            }
        }
    }

    /* Phase 1 — junction collide: opposing in-flight mass emits
     * back-to-back photons (matter/antimatter -> light), leaving a
     * small charge residue — annihilation radiation, not bookkeeping. */
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++){
        int oc=c^1;
        int a=qMassFlight[si*QChannels+c],b=qMassFlight[si*QChannels+oc];
        int hit=a<b?a:b;
        if(hit>0){
            qMassFlight[si*QChannels+c]-=hit;qMassFlight[si*QChannels+oc]-=hit;
            int nu=qMass[si]>4?(int)(qMass[si]>>2):64;
            qPhoton_next[si*QChannels+c]+=hit;
            qPhoton_next[si*QChannels+oc]+=hit;
            qPhotonNu_next[si*QChannels+c]=nu;
            qPhotonNu_next[si*QChannels+oc]=nu;
            qCharge[si]+=hit;                      /* binding residue */
            qEvents[0]+=hit*2;qEvents[9]+=hit;
        }
    }

    /* Phase 2 — mass stream: parked structure stays put (link3's
     * drest clamp), in-flight mass moves to the facing channel. */
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int c=0;c<QChannels;c++){
            int v=qMassFlight[si*QChannels+c];if(!v)continue;
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            qMassFlight_next[siteIndex(nx,ny,nz)*QChannels+c]+=v;
            qMassFlight[si*QChannels+c]-=v;
        }
    }

    /* Phase 3 — photon stream (offers): propagate, transit decay
     * scales with nu (range ~ 1/nu). */
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int c=0;c<QChannels;c++){
            int v=qPhoton[si*QChannels+c];if(!v)continue;
            int nu=qPhotonNu[si*QChannels+c]?qPhotonNu[si*QChannels+c]:1;
            /* vacuum absorption: the node's LOCAL DENSITY is its
             * opacity — the decay rate scales with the neighbor-
             * sampled density (what the node measures of its
             * neighborhood, its place in the gradient). Dense
             * regions thermalize photons; sparse vacuum lets them
             * pass — the medium's own structure is the drag. */
            /* vacuum absorption: thermalization scales with the LOCAL
             * PHOTON PRESSURE — a crowded field thermalizes faster
             * (the medium is hotter where more photons compete), not
             * just where more structure sits. The node's opacity =
             * its structure density PLUS its photon load: a lit
             * region radiates into heat faster than a quiet one —
             * the medium's own blackbody-law balance. */
            uint32_t density=qLocalDensity[si]+1;
            if((qTick%(1<<qCycleShift))==0){
                /* opacity = STRUCTURE density only. Earlier versions
                 * added photonLoad — photons suppressing photon decay —
                 * which made the sink superlinear: the field could only
                 * drain after extreme pileup, giving a limit cycle
                 * (flood/collapse/rebuild). Matter absorbs photons,
                 * photons don't absorb photons — a linear hazard means
                 * the field settles at production/lambda, a real
                 * equilibrium point instead of an oscillation. */
                uint32_t opac=density;
                uint32_t decay=((uint32_t)v*(opac>>2))>>8;
                if(decay<1&&(randByte()&7)==0)decay=1;    /* floor: ~1/8 */
                if(decay>(uint32_t)v)decay=v;
                if(decay){v-=decay;qHeat[si]+=(uint64_t)decay*nu;
                    qEvents[7]+=(uint64_t)decay*nu;}
            }
            if(v<=0){qPhoton[si*QChannels+c]=0;continue;}
            /* bulk flux propagation: photons are COUNTS, not single
             * quanta — the bulk continues straight (ballistic flux)
             * while a few quanta scatter off per hop (per-quantum
             * stochasticity — ~1/8 of the count jitters to a random
             * channel, the rest goes forward. The field's agitation
             * is fractional, not all-or-nothing). */
            int c2=c;
            uint32_t scat=(v>>3);             /* ~1/8 of the count */
            if(scat<1&&v>1&&(randByte()&7)==0)scat=1;  /* small flux: chance */
            if(scat>(uint32_t)v)scat=v;
            if(scat>0){
                /* VORTEX CURVING — the photon deflects toward the
                 * local net directedness, not randomly. The site's
                 * unmatched winding (excess on a channel) IS the
                 * local circulation — passing flow curves toward it
                 * (like a charged particle in a field: motion deflects
                 * by the local current). The curved flow feeds the
                 * vortex — a closed rotational path can form. */
                int rc=randByte()%QChannels;
                /* bias toward the channel with local net directedness */
                int bv=-1;int32_t bd=0;
                for(int e2=0;e2<QChannels/2;e2++){
                    int32_t d=(int)qWinding[si*QChannels+2*e2]
                             -(int)qWinding[si*QChannels+2*e2+1];
                    if(d>bd){bd=d;bv=e2;}             /* strongest +flow */
                }
                if(bv>=0&&(randByte()&3)<2)rc=bv<<1;  /* ~50% curve toward */
                int rnx=wrapCoord(x+QChannelVec[rc][0],QWidth);
                int rny=wrapCoord(y+QChannelVec[rc][1],QHeight);
                int rnz=wrapCoord(z+QChannelVec[rc][2],QDepth);
                int rni=siteIndex(rnx,rny,rnz)*QChannels+rc;
                qPhoton_next[rni]+=scat;
                if(!qPhotonNu_next[rni]||nu>qPhotonNu_next[rni])qPhotonNu_next[rni]=nu;
                v-=scat;                            /* the rest goes straight */
            }
            int nx=wrapCoord(x+QChannelVec[c2][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c2][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c2][2],QDepth);
            int ni=siteIndex(nx,ny,nz)*QChannels+c2;
            /* bosonic flux: photons are a COUNT on the channel — they
             * don't exclude (same mode piles up freely). On mixed
             * arrivals the populations superpose; nu tags the stronger
             * component (an approximation of a wavepacket). */
            qPhoton_next[ni]+=v;
            if(!qPhotonNu_next[ni]||nu>qPhotonNu_next[ni]){
                qPhotonNu_next[ni]=nu;
                qPhotonBirth_next[ni]=qPhotonBirth[si*QChannels+c];
            }
            /* CONSERVATION FIX: the whole channel is accounted —
             * decay -> heat, scat -> rni, v -> ni. The old -=v left
             * decay+scat ON the source: decayed photons stayed in
             * flight AND became heat (double-counted), and scattered
             * photons duplicated. ~1/8 minted per channel per tick —
             * the field explosion was bookkeeping, not physics. */
            qPhoton[si*QChannels+c]=0;
        }
    }

    /* Phase 4 — transaction pass (the heartbeat): every edge on every
     * node evaluates its offers independently in the same tick — an
     * absorber is a statistical region of absorber-active edges, not
     * a named object; its extent is derived, not assumed. Buffered
     * reads (qPhoton_next) keep all edges simultaneous. */
    for(int si=0;si<QSites;si++){
        int mass=qMass[si];
        /* fusion at vacuum: opposing offers arriving in the same tick
         * with enough combined energy deposit rest mass + charge —
         * pair production, thresholded by total E (E -> m). */
        if(!mass){
            for(int c=0;c<QChannels;c++){
                int oc=c^1;
                uint32_t a=qPhoton_next[si*QChannels+c];
                uint32_t b=qPhoton_next[si*QChannels+oc];
                if(!a||!b)continue;
                uint32_t nua=qPhotonNu_next[si*QChannels+c]?qPhotonNu_next[si*QChannels+c]:1;
                uint32_t nub=qPhotonNu_next[si*QChannels+oc]?qPhotonNu_next[si*QChannels+oc]:1;
                /* gate on QUANTUM energy, not population: pair
                 * production needs each photon above threshold
                 * (gamma+gamma -> e+e- needs ~mc2 EACH), a crowd of
                 * weak photons can't fuse. */
                if(nua+nub<(uint32_t)qFusionWall)continue;
                uint32_t pair=a<b?a:b;
                qPhoton_next[si*QChannels+c]-=pair;
                qPhoton_next[si*QChannels+oc]-=pair;
                uint64_t dep=pair*(nua+nub);
                qMass[si]+=(uint32_t)(dep>>5);          /* creation residue */
                qCharge[si]+=(uint32_t)(dep>>3);
                /* the pair LAUNCHES apart on the two channels —
                 * gamma+gamma -> e+e- flies, not a static pile */
                qMassFlight_next[si*QChannels+c]+=pair;
                qMassFlight_next[si*QChannels+oc]+=pair;
                qWinding[si*QChannels+c]+=pair>>2;      /* residual wound */
                qWinding[si*QChannels+oc]+=pair>>2;
                qEvents[23]+=pair;mass=1;
            }
        }
        for(int c=0;c<QChannels;c++){
            int offer=qPhoton_next[si*QChannels+c];
            /* bare sites CAN arm incipients — mass is a CONSEQUENCE
             * of bound structure (the deposit creates winding -> the
             * mass-equivalent), not a prerequisite. But bare-vacuum
             * catch is RARE: an unstructured site is a weak absorber,
             * not a strong one — ~1/16 of arriving photons can arm
             * (density grows the rate later via the neighbor density
             * field, but the base bootstrap rate is low). */
            if(!offer)continue;
            /* the FIFTH !mass gate: qMass=0 doesn't mean bare —
             * a loop-site is a STRONG absorber (receptive internal
             * states). The catch rate scales with siteLevel: bare
             * vacuum catches ~1/16 of arrivals, deeper structure
             * catches proportionally more — arm reads the local
             * configuration, not the mass ledger. */
            int lvl=siteLevel(si);if(lvl<1)lvl=1;   /* bare: base 1/16 */
            if((randByte()&15)>=lvl)continue;
            int nu=qPhotonNu_next[si*QChannels+c]?qPhotonNu_next[si*QChannels+c]:1;
            /* edge-local line: the channel's own winding + site mass
             * set what this edge can absorb — different edges of the
             * same node may absorb differently. */
            int line=(mass+(qWinding[si*QChannels+c]>>2))>>2;
            if(line<1)line=1;
            int match=0, stim=0;
            if(qGapMode>=1&&qGapMode<=4){
                /* level-dependent transitions: site at level n absorbs
                 * upward gaps E(n->m) = 256/n^2-256/m^2 (m>n), or is
                 * stimulated to emit downward gaps E(n->m)=256/m^2-
                 * 256/n^2 (m<n). n derived from charge, not stored. */
                int n=siteLevel(si);
                if(qGapMode==5){
                    /* geometric: accept offers at the loop's actual
                     * transition energies — absorb bands up, stim
                     * bands down. */
                    for(int bnd=1;bnd<=n-1&&bnd<8;bnd++)
                        if(nu==qi3geoGap(si,bnd)){match=1;break;}
                    if(!match&&nu==qi3geoGap(si,1))stim=1;
                } else {
                    for(int m=1;m<=8;m++){
                        if(m!=n&&nu==qi3gapE(n,m)){
                            if(m>n)match=1; else stim=1;
                            break;
                        }
                    }
                }
            } else {
                match=(nu%line==0&&nu>=line);
            }
            if(qGapMode==6){
                /* TOPOLOGICAL + PHASE-LOCK selection: no nu-table. The
                 * offer is a packet of circulation; it completes only if
                 * depositing lands the loop on an allowed rung AND the
                 * offer's phase aligns with the loop's cycle position —
                 * the transaction is a RESONANCE, not a lookup. */
                match=0;
                int edge6=(c>>1);
                uint32_t a=qWinding[si*QChannels+2*edge6],
                         b=qWinding[si*QChannels+2*edge6+1];
                uint32_t m=a<b?a:b;
                uint32_t step=1u<<qUnwindShift;
                for(uint32_t r=32;r<=128;r+=step){
                    if((uint32_t)(m+nu)>=r&&(uint32_t)(m+nu)<r+step&&m<r){
                        match=1;break;
                    }
                }
                if(match&&m>=32){
                    /* the loop exists — the offer's phase must land in
                     * its receptive window (within a rung of the cycle) */
                    uint32_t lp=effPhase(si,edge6);
                    uint32_t op=(nu*(uint32_t)(qTick-qPhotonBirth_next[si*QChannels+c]))&255;
                    int d=(int)lp-(int)op;if(d<0)d=-d;if(d>128)d=256-d;
                    if(d>64)match=0;                     /* out of phase: decline */
                    /* ORIENTATION-SELECTIVE — the bound state has a
                     * directedness (its circulation's orientation —
                     * the "spinor" alignment). It prefers offers
                     * arriving on the channel ALIGNED with its
                     * dominant directedness — the absorber selecting
                     * for orientation, not just energy+phase. An
                     * offer on the circulation's axis is favored;
                     * off-axis offers are declined more often. */
                    if(match){
                        int de=-1;int32_t dd=0;
                        for(int e2=0;e2<QChannels/2;e2++){
                            int32_t d2=(int)qWinding[si*QChannels+2*e2]
                                     -(int)qWinding[si*QChannels+2*e2+1];
                            if(d2>dd){dd=d2;de=e2;}
                        }
                        if(de>=0&&de!=edge6){            /* off-axis offer */
                            if(randByte()&1)match=0;     /* ~50% declined */
                        }
                    }
                }
            }
            if(match){
                /* arm an INCIPIENT transaction — BUT the node has a
                 * receptive capacity: its edge-space is its whole
                 * boundary to the world, so it can hold at most
                 * ~9 incipient transactions (one per edge). At
                 * capacity new offers are DECLINED — a bound node
                 * can't receive more than its interface can hold.
                 * The Planck fix for the incipient runaway: finite
                 * regions have finite receptive capacity. */
                int edge=(c>>1);
                int ei=si*(QChannels/2)+edge;
                uint32_t heldTot=0;
                for(int e3=0;e3<QChannels/2;e3++)
                    heldTot+=qHeld[si*(QChannels/2)+e3];
                if(heldTot>=QChannels/2){
                    /* external saturated — but the node can answer
                     * INTERNALLY: the offer routes to the intra-node
                     * ledger, bounded by the bound volume (each quantum
                     * of structure hosts one internal negotiation). */
                    uint32_t vol=0;
                    for(int e3=0;e3<QChannels/2;e3++){
                        uint32_t a=qWinding[si*QChannels+2*e3],
                                 b=qWinding[si*QChannels+2*e3+1];
                        uint32_t m=a<b?a:b;
                        if(m>=32)vol+=m;
                    }
                    if(qHeldInt[si]<(vol>>7)*128){
                        qHeldInt[si]+=offer;
                        qPhoton_next[si*QChannels+c]-=offer;
                        continue;
                    }
                    /* both saturated: DECLINE — the transaction can't
                     * complete, but the offer's energy isn't lost: it
                     * sinks into the site's charge (fuel for the medium,
                     * the thermalization path — a declined photon is
                     * absorbed as potential, not left accumulating). */
                    qCharge[si]+=nu;
                    qPhoton_next[si*QChannels+c]-=offer;
                    continue;
                }
                /* an incipient is a TRANSACTION UNIT — one photon arms
                 * one incipient, consumes one photon. The rest stay in
                 * the channel for their own transactions later — the
                 * flood was h=population-count actualizing at once. */
                qHeld[ei]+=1;qHeldNu[ei]=nu;qHeldDir[ei]=c&1;
                qHeldBirth[ei]=qPhotonBirth_next[si*QChannels+c];
                qHeldPhase[ei]=(nu*(uint32_t)(qTick-qPhotonBirth_next[si*QChannels+c]))&255;
                qPhoton_next[si*QChannels+c]-=1;
            } else if(stim){
                /* stim arms an INCIPIENT too — but it needs the same
                 * receptive capacity as absorb: the node's edges can
                 * only hold so many negotiations. Uncapped stim arms
                 * were the absorb runaway — held accumulating without
                 * bound, resolving as huge h. */
                int edge=(c>>1);
                int ei=si*(QChannels/2)+edge;
                uint32_t heldTot=0;
                for(int e3=0;e3<QChannels/2;e3++)
                    heldTot+=qHeld[si*(QChannels/2)+e3];
                if(heldTot>=QChannels/2)continue;
                qHeld[ei]+=offer;qHeldNu[ei]=nu;qHeldDir[ei]=c&1;
                qHeldStim[ei]=1;
                qPhoton_next[si*QChannels+c]-=offer;
            }
        }
    }

    /* Phase 4b — ACK transit: returning confirms walk their ttl
     * down to zero; the site where ttl expires is the emitter —
     * its edge gets the measured distance (RTT/2 = hop distance),
     * and the bond credits on BOTH ends of the same transaction. */
    for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int c=0;c<QChannels;c++){
            uint32_t n=qAck[si*QChannels+c];if(!n)continue;
            uint32_t ttl=qAckTtl[si*QChannels+c];
            if(ttl==0){
                int ei=si*(QChannels/2)+(c>>1);
                qBondDist[ei]=qAckRtt[si*QChannels+c];
                qSessionStrength[ei]+=n;
                if(qSessionState[ei]<2){qSessionState[ei]++;qEvents[14]++;}
                /* structure transfer lives in the transaction itself
                 * (the emitter shed its band at emission; the absorber
                 * gained it at actualization) — the ACK just confirms
                 * dual-end completion. */
                qAck[si*QChannels+c]=0;
                continue;
            }
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz)*QChannels+c;
            qAck_next[ni]+=n;
            qAckTtl_next[ni]=ttl-1;
            qAckRtt_next[ni]=qAckRtt[si*QChannels+c];
            qAck[si*QChannels+c]-=n;
        }
    }

    /* internal-cycle gate: structure only evolves every 2^shift ticks
     * — the macro node's internal clock is slower than the photon's
     * transit rate (c at this scale is simulated, not assumed). */
    int internal = (qTick % (1<<qCycleShift))==0;

    /* neighbor-sampled local density: each node queries its edge-
     * neighbors' structure — the node's opacity is what it can
     * actually MEASURE (its causal neighborhood), tracked over time
     * via an EMA (a local memory of the gradient). */
    if(internal)for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        uint32_t nsum=0;
        for(int c=0;c<QChannels;c+=2){           /* duplex: 9 neighbors */
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz);
            uint32_t w2=0;
            for(int e=0;e<QChannels/2;e++){
                uint32_t a=qWinding[ni*QChannels+2*e],b=qWinding[ni*QChannels+2*e+1];
                uint32_t m=a<b?a:b;if(m>=32)w2++;
            }
            nsum+=w2;                            /* neighbor's loop count */
        }
        /* EMA over time: density = 1/4 new + 3/4 old — the node
         * remembers its neighborhood across ticks */
        qLocalDensity[si]=(qLocalDensity[si]*3+nsum)>>2;
    }

    /* loop phases advance on the internal clock — the oscillator's
     * circulation turns at its own frequency: each loop's phase
     * steps by its edge-reach (a tighter loop cycles faster, the
     * position in the cycle IS the internal state — the 720° upgrade). */
    /* the bound-state phase: ONE oscillator per site — the shared
     * cycle position. qPhase advances at a common rate for the whole
     * bound state (the site is one oscillator), edges' effective
     * phases are the shared phase + their angular offset. The winding
     * is the spatial offset-progression — the bound state spinning
     * coherently. COUPLING: the site's qPhase pulls toward its
     * neighbors' — a coherent bound-state phase-field. */
    if(internal)for(int si=0;si<QSites;si++){
        int wound=0;
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
            uint32_t m=a<b?a:b;if(m>=32)wound++;
        }
        if(!wound)continue;                     /* only bound sites cycle */
        /* the bound state's orientation is a 0-511 DOUBLED cycle —
         * the spinor structure: the direction is phase%256, the
         * SHEET (which cover) is phase/256 — a 720-degree object
         * where a 360 rotation flips the sheet (-1). The bound
         * state's orientation needs TWO wraps to return — the real
         * spinor double-cover, not a relabeled 360. */
        qPhase[si]=(qPhase[si]+64)&511;         /* doubled cycle */
        /* pull toward neighbors — coherent orientation including
         * the sheet (the bound state's spinor-frame) */
        int xx=si%QWidth,yy=(si/QWidth)%QHeight,zz=si/(QWidth*QHeight);
        int px=wrapCoord(xx+1,QWidth);
        int ni=siteIndex(px,yy,zz);
        int dp=(int)qPhase[ni]-(int)qPhase[si];
        if(dp>255)dp-=511;if(dp<-255)dp+=511;
        qPhase[si]=(uint32_t)((int)qPhase[si]+(dp>>3))&511;
    }

    /* Phase 4c — winding conduction: circulation flows down its
     * own gradient along edges — a wound site sheds a quantum
     * into a low-winding neighbor. Loop-preserving: both channels
     * move together. Fick's-law diffusion on the loop field.
     *
     * ============================================================
     *  THE PROBLEM — configuration space is an open-ended canvas:
     * it can represent EVERY transition state in the possible
     * universe. This is our SECOND BEST ATTEMPT at the real
     * annihilation question: how much transition-space can a local
     * region actually hold — not an artificial cap, but the
     * substrate's honest bound on transport. The conduction rate
     * is bounded by the RECIPIENT's remaining edge-capacity —
     * a site accepts winding only into edges that can hold it,
     * and the transfer is capped by the free room, not just the
     * gradient. Saturated recipients REFUSE the transfer (the
     * winding stays with the donor — the medium's own exclusion
     * bounds the flux, not an authored limit).
     * ============================================================
     *
     * Runs at the INTERNAL cycle rate — structure cycles slowly. */
    if(internal)for(int si=0;si<QSites;si++){
        uint32_t w=0;
        for(int c=0;c<QChannels;c++)w+=qWinding[si*QChannels+c];
        qSiteWind[si]=w;
    }
    if(internal)for(int z=0;z<QDepth;z++)for(int y=0;y<QHeight;y++)for(int x=0;x<QWidth;x++){
        int si=siteIndex(x,y,z);
        for(int e=0;e<QChannels/2;e++){
            int c=e<<1;
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz);
            int d=(int)qSiteWind[si]-(int)qSiteWind[ni];
            if(d<8)continue;
            uint32_t k=(uint32_t)(d>>5);if(k>16)k=16;if(!k)k=1;
            uint32_t a=qWinding[si*QChannels+e*2],b=qWinding[si*QChannels+e*2+1];
            uint32_t m=a<b?a:b;
            /* CONFINEMENT — only COMPLETE bound quanta are
             * site-locked: an edge at m>=128 is a committed bound
             * state, it doesn't conduct. Partial volumes (m<128)
             * are still dynamic — they conduct normally. A fully-
             * bound lump holds (every edge committed); partial
             * structure still spreads — selective confinement. */
            if(m>=128)continue;
            /* VORTEX protection — an edge whose directedness is part
             * of a CLOSED circulation is bound, not free to conduct.
             * Don't drain its matched part — the circulation's
             * closure is what holds it. */
            {
                int32_t dd=(int)a-(int)b;if(dd<0)dd=-dd;
                if(dd>=32){
                    int big=a>b?e*2:e*2+1;
                    int rx=wrapCoord(x+QChannelVec[big][0],QWidth);
                    int ry=wrapCoord(y+QChannelVec[big][1],QHeight);
                    int rz=wrapCoord(z+QChannelVec[big][2],QDepth);
                    int rns=siteIndex(rx,ry,rz);
                    int rc=(big&1)?big-1:big+1;
                    uint32_t ra=qWinding[rns*QChannels+rc],
                             rb=qWinding[rns*QChannels+big];
                    if(ra>rb&&ra-rb>=32)continue;  /* reciprocal: closed */
                }
            }
            uint32_t avail=m;
            if(k>avail)k=avail;if(!k)continue;
            /* CAPACITY BOUND — the deep question: a recipient accepts
             * winding only into edges that can hold it, and the
             * transfer is capped by its remaining room (m_room =
             * 128 - recipient's matched winding on this edge).
             * Saturated recipients REFUSE — the winding stays with
             * the donor (exclusion bounds the flux, not a cap). */
            uint32_t an=qWinding[ni*QChannels+e*2],
                     bn=qWinding[ni*QChannels+e*2+1];
            uint32_t mn=an<bn?an:bn;
            uint32_t room=mn<128?128-mn:0;
            if(room<8)continue;              /* recipient is saturated:
                 * refuse — the configuration space is full here */
            /* GROUND-STATE: the donor can't conduct away its bound
             * volume below the ground-state floor — a bound state
             * at its minimum can't shed its ground-state winding
             * (like a stable particle not draining its rest-mass). */
            {
                uint32_t dv=0;
                for(int e2=0;e2<QChannels/2;e2++){
                    uint32_t m2=qWinding[si*QChannels+2*e2]<qWinding[si*QChannels+2*e2+1]
                               ?qWinding[si*QChannels+2*e2]:qWinding[si*QChannels+2*e2+1];
                    if(m2>=32)dv+=m2;
                }
                if(dv-k<512)k=dv>512?dv-512:0;   /* can't drop below floor */
                if(k<8)continue;
            }
            if(k>room)k=room;
            qWinding[si*QChannels+e*2]-=k;
            qWinding[si*QChannels+e*2+1]-=k;
            qWinding[ni*QChannels+e*2]+=k;
            qWinding[ni*QChannels+e*2+1]+=k;
            snapLoop(ni,e);   /* quantize the received circulation */
            /* PHASE-EXCHANGE — the circulation transfer couples the
             * edges' phases: the donor's phase pulls the recipient's
             * toward it (a phase-locking exchange, like the
             * circulation carrying its cycle-position). Coherent
             * bound states emerge when the phases lock — a single
             * phase-field across the bound configuration instead
             * of independent per-edge clocks. */
            {
                int dp=(int)qPhase[si]-(int)qPhase[ni];
                /* shortest wrap around the 511-cycle (doubled — the
                 * spinor's 720 orientation incl the sheet) */
                if(dp>255)dp-=511;if(dp<-255)dp+=511;
                int pull=dp>>4;                       /* ~1/16 toward */
                qPhase[ni]=(uint32_t)((int)qPhase[ni]+pull)&511;
            }
            qEvents[24]+=k;
        }
    }

    /* Phase 5 — bonds are event-ledgers: strength accrues on
     * completed transactions (set in phase 4) and decays slowly —
     * a bond is a history of actualized events, not a traffic
     * average. SYN->ESTAB on repeat transactions; the bond rests
     * rather than times out (slow decay, not instant drop). */
    for(int si=0;si<QSites;si++)for(int e=0;e<QChannels/2;e++){
        uint32_t s=qSessionStrength[si*(QChannels/2)+e];
        if(s>8)qSessionStrength[si*(QChannels/2)+e]-=(s>>6);
        else if(s)qSessionStrength[si*(QChannels/2)+e]=s-1;
        if(qSessionState[si*(QChannels/2)+e]&&
           qSessionStrength[si*(QChannels/2)+e]==0){
            qSessionState[si*(QChannels/2)+e]=0;qEvents[12]++;
        }
    }

    /* Phase 6 — emission: charged massive sites emit offers at their
     * line nu (gap-mode aware: mode 1 emits at the level gap the
     * site's charge implies — level derived, not stored). A lump
     * out of charge burns its own mass — mass is a persistence
     * ledger with an evaporation channel, not a ratchet. Emission
     * runs at the INTERNAL cycle rate too. */
    if(internal)for(int si=0;si<QSites;si++){
        int mass=qMass[si],e=qCharge[si];
        if(mass&&e<32){                          /* evaporate */
            int burn=mass>>4;if(burn<1)burn=1;
            e+=burn*8;qMass[si]=mass-burn;
            /* SPECIES INVERSE: mass decay feeds structure — the
             * persistence ledger's loss becomes bound circulation,
             * not just charge. A composite's mass converts to
             * winding internally (the conjugate channel — the
             * closed cycle where each species' decay feeds the
             * other instead of leaking to radiation). */
            int be=-1;uint32_t bm=0;
            for(int e2=0;e2<QChannels/2;e2++){
                uint32_t a=qWinding[si*QChannels+2*e2],
                         b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;
                if(m>bm&&m<160){bm=m;be=e2;}         /* deepest open edge */
            }
            if(be>=0){qWinding[si*QChannels+2*be]+=burn;
                      qWinding[si*QChannels+2*be+1]+=burn;}
            if(!qMass[si])continue;
            mass=qMass[si];
        }
        /* emission derives from STRUCTURE (loops), not mass — same
         * fix as the absorb gate: mass is a consequence of bound
         * circulation, not a prerequisite. A loop-only site emits
         * at its level-gap line. */
        if(!mass&&!siteLevel(si))continue;
        /* bound energy thermalizes into VOLUME — the loops->volumes
         * migration. The old loop ontology needed a free edge and
         * dropped a whole 128 quantum; a saturated node (all edges
         * partially wound) couldn't accept heat at all. In the volume
         * picture the reservoir accretes into the edge with the MOST
         * ROOM, by the amount it can afford — partial occupancy
         * grows incrementally. The 2:1 charge:winding rate is kept
         * (256 charge bought a 128 quantum; now any k buys k). */
        if(e>288){
            int fe=-1;uint32_t room=0;
            int start=randByte()%(QChannels/2);
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;uint32_t r=m<160?160-m:0;
                if(r>room){room=r;fe=e2;}
            }
            uint32_t k=(uint32_t)(e-256)>>1;             /* can afford */
            if(k>room)k=room;                            /* fits in edge */
            if(k>=8&&fe>=0){
                qWinding[si*QChannels+2*fe]+=k;
                qWinding[si*QChannels+2*fe+1]+=k;
                qCharge[si]=e-2*(int)k;qEvents[25]++;
            }
        }
        /* STRING BREAKING — the Schwinger analog, MULTI-NODE: the
         * flux tube is a chain of wound edges spanning ~1.2fm = 2+
         * nodes. A link is STRETCHED when BOTH ends hold a saturated
         * channel on the same direction — the field is dense across
         * the node boundary, not a lump's internal edge. When the
         * stretched link's field exceeds the pair cost, a node
         * materializes a new bound pair — the stored field energy
         * becomes the pair's mass+charge, the new charges terminate
         * the field — the channel splits. Conservation exact:
         * winding -= 128 -> mass+charge (funded, not minted). */
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=qWinding[si*QChannels+2*e],
                     b=qWinding[si*QChannels+2*e+1];
            uint32_t m=a<b?a:b;
            if(m<128)continue;                    /* needs a full quantum */
            /* a stretched channel is a LINEAR flux tube — the field
             * concentrated on ONE direction between separated charges.
             * A bound LUMP has all its edges saturated; a dense MEDIUM
             * saturates uniformly — neither is a stretched tube. The
             * interior of a real tube has only the channel edge wound:
             * the site is a tension point, not a lump. */
            int sat=0;
            for(int e2=0;e2<QChannels/2;e2++){
                uint32_t a2=qWinding[si*QChannels+2*e2],
                         b2=qWinding[si*QChannels+2*e2+1];
                uint32_t m2=a2<b2?a2:b2;
                if(m2>=128)sat++;
            }
            if(sat>2)continue;                    /* a lump, not a channel */
            int c=e<<1;
            int xx=si%QWidth, yy=(si/QWidth)%QHeight, zz=si/(QWidth*QHeight);
            int nx=wrapCoord(xx+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(yy+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(zz+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz);
            uint32_t na=qWinding[ni*QChannels+2*e],
                     nb=qWinding[ni*QChannels+2*e+1];
            uint32_t nm=na<nb?na:nb;
            if(nm<128)continue;                   /* not stretched across */
            /* the link is a saturated channel — the field converts a
             * quantum into a new bound pair at the tension node */
            qWinding[si*QChannels+2*e]-=128;
            qWinding[si*QChannels+2*e+1]-=128;
            qMass[si]+=96;                        /* the pair's rest */
            qCharge[si]+=256;                     /* + binding fuel */
            qEvents[30]++;
            break;                                 /* one break per tick */
        }
        /* the heat reservoir accretes into VOLUME too — same
         * migration: absorbed photon energy becomes bound occupancy
         * wherever there's room, not a whole quantum on a free edge.
         * A saturated site can still warm its partial edges — the
         * cold leg works at any occupancy. */
        if(qHeat[si]>288){
            int fe=-1,start=randByte()%(QChannels/2);uint32_t room=0;
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;uint32_t r=m<160?160-m:0;
                if(r>room){room=r;fe=e2;}
            }
            uint32_t k=(qHeat[si]-256)>>1;
            if(k>room)k=room;
            if(k>=8&&fe>=0){
                qWinding[si*QChannels+2*fe]+=k;
                qWinding[si*QChannels+2*fe+1]+=k;
                qHeat[si]-=2*k;qEvents[26]++;
            }
        }
        /* ONE quantum per transition: a site at level n>=2 falls
         * n->n-1 and emits a single photon at that gap — the level
         * structure pays (siteUnwind), emission is a transition,
         * not a bank dump. */
        int n=siteLevel(si);
        if(n<2)continue;
        /* excited states have a LIFETIME: emission is stochastic,
         * not per-tick — else every loop unwinds the tick it forms
         * and structure can never outpace the radiative drain. */
        if(randByte()&3)continue;
        int line;
        if(qGapMode==5)line=qi3geoGap(si,1);
        else if(qGapMode>=1&&qGapMode<=4)line=qi3gapE(n,n-1);
        else line=mass>4?mass>>2:1;
        int c;
        int nout=0, edlive=-1;
        for(int ed=0;ed<QChannels/2;ed++)
            if(qSessionState[si*(QChannels/2)+ed]){nout++;edlive=ed;}
        if(nout==1)c=(edlive<<1)|(randByte()&1);   /* emit on the bond */
        else c=randByte()%QChannels;                /* else random dir */
        /* CHANNEL OCCUPANCY — the Pauli analog, GRADED: the emitted
         * photon needs a MODE with room. A channel's photon count
         * IS its occupancy — the refusal probability scales with
         * occupancy/capacity (a half-full mode refuses ~half, a
         * saturated one ~always). Not a cliff: decay slows smoothly
         * as the bath fills the channels — like nature's product-
         * state occupancy suppressing the channel probabilistically
         * until it's fully blocked. */
        {
            int room=-1;
            for(int try_=0;try_<4;try_++){
                int tc=(try_==0)?c:randByte()%QChannels;
                uint32_t occ=qPhoton[si*QChannels+tc];
                if(occ<128&&(randByte()&127)>=(int)occ){room=tc;break;} /* P(accept)=1-occ/128 */
            }
            if(room<0){qEvents[31]++;continue;}     /* modes refuse — stable */
            c=room;
        }
        /* EMISSION IS TRANSACTIONAL — the photon only exists if the
         * local environment can take it. The node's measured
         * structure-density IS the pressure: a site in a dense
         * medium has high qLocalDensity — its neighbors are
         * occupied absorbers that refuse or reabsorb the emitted
         * offer, so the decay product can't be placed and the
         * energy stays bound. GRADED: the refusal probability
         * scales with local density — sparse vacuum lets emission
         * escape, dense media stall it — stable vs unstable by
         * context, no global switch. */
        {
            uint32_t dens=qLocalDensity[si];
            if(dens>64)dens=64;
            if(dens&&(randByte()&63)<(int)dens){  /* P(refuse)~dens/64 */
                qEvents[28]++;
                continue;
            }
        }
        /* SPECIES INVERSE: a composite's structure shed feeds the
         * mass ledger — the internal exchange channel. The bound
         * circulation condenses to persistence rather than radiating
         * — the closed cycle where structure and mass hold each
         * other. A bare (massless) site still radiates a photon.
         * BOUNDED: the composite's mass can't exceed a share of its
         * bound volume — a bound state has a CHARACTERISTIC mass,
         * not unbounded accretion. Once mass-full, the shed goes to
         * radiation — the species equilibrate at a fixed ratio. */
        if(mass>0&&(uint64_t)mass*8<loopWinding(si)){
            qMass[si]+=line;                       /* structure -> mass */
            siteUnwind(si,(uint32_t)line);          /* shed pays it */
            qEvents[29]++;
            continue;
        }
        qPhoton_next[si*QChannels+c]+=1;
        qPhotonNu_next[si*QChannels+c]=line>>qGapShift;
        if(!qPhotonNu_next[si*QChannels+c])qPhotonNu_next[si*QChannels+c]=1;
        qPhotonBirth_next[si*QChannels+c]=(uint32_t)qTick;
        siteUnwind(si,(uint32_t)line);          /* fell one band */
        qEvents[4]++;qEvents[20]+=line;
    }

    /* Phase 6a — thermal re-emission: DISABLED (the recycler bug).
     *
     * We built heat -> photon re-emission as the "self-driving"
     * cycle, but it's not how matter thermalizes at this scale:
     * a body that absorbs light gets WARMER — its internal energy
     * rises — it does not mint a fresh photon per reservoir quantum.
     * Re-radiation in nature happens through the structure's OWN
     * transition lines (which we already have — the rung emission),
     * not a second channel double-dipping the reservoir. The 6a
     * path recycled every decayed photon back into the band at
     * nu=64 — the field could never drain. qHeat is now a terminal
     * reservoir (the medium's temperature), drained only by the
     * rare heat->structure leg. Prediction: the photon field
     * drains into the lattice's internal energy and equilibrates
     * at a thin residual while qHeat measures the warmth. */
    if(0)for(int si=0;si<QSites;si++){
        if(qHeat[si]<256)continue;
        if(randByte()&3)continue;
        int c=randByte()%QChannels;
        qPhoton_next[si*QChannels+c]+=1;
        qPhotonNu_next[si*QChannels+c]=64;
        qPhotonBirth_next[si*QChannels+c]=(uint32_t)qTick;
        qHeat[si]-=256;
        qEvents[4]++;
    }

    /* Phase 6b — dissipation of free momentum ("the annihilation
     * question, second best attempt").
     *
     * ============================================================
     *  DIAGNOSIS LOG — the conduction flood (t≈20):
     *  Old trigger: pair=min(a,b) on the same edge — but min(a,b)
     *  IS the loop's matched amplitude. Bound structure past 128
     *  got burned as "particle/antiparticle excess" — conduction
     *  and deposits push loops deep, this path floods photons.
     *  Verdict: same-edge min is LOOP amplitude, not decay fuel.
     *
     *  VARIANT A (this version): the decay candidate is the
     *  UNMATCHED part |a-b| — net directedness that isn't closed
     *  circulation. A loop (a≈b) is a bound state, protected; an
     *  imbalance is free momentum — directedness that found no
     *  transaction. Whether ANY explicit dissipation belongs at
     *  this scale is itself a question: real "annihilation" is
     *  presumably an EMERGENT transaction, not a rule. This is a
     *  stochastic drain on free directedness — minimal honest
     *  version. Sheds only the excess side; the matched loop is
     *  untouched.
     * ============================================================ */
    for(int si=0;si<QSites;si++){
        for(int e=0;e<QChannels/2;e++){
            int c=2*e,oc=c+1;
            uint32_t a=qWinding[si*QChannels+c];
            uint32_t b=qWinding[si*QChannels+oc];
            uint32_t free=a>b?a-b:b-a;         /* UNMATCHED excess —
                 * free directedness, not the loop (min is protected) */
            if(free<32)continue;                /* small imbalance is
                 * just fluctuation — only real asymmetry dissipates */
            /* CLOSED-CIRCULATION is a bound vortex — the excess is
             * directed momentum, and if it forms a CLOSED directed
             * path (following the directedness leads back to the
             * start) it's a topologically-protected circulation —
             * a vortex. Protected like the matched loop: the flow
             * returns to itself, so it drains nowhere. Free
             * directedness (no closure) drains normally. */
            int big=a>b?c:oc;
            int xx=si%QWidth, yy=(si/QWidth)%QHeight, zz=si/(QWidth*QHeight);
            /* does the directedness close? two checks:
             * 1. RECIPROCAL — the neighbor's directedness on the SAME
             *    channel points back (a 2-cycle, the simplest loop)
             * 2. FORWARD-TRACE — follow the directedness chain up to
             *    8 hops; if it returns to the start it's a vortex. */
            int closed=0,cs=si,cc=big;
            /* reciprocal check: does the far side point back? */
            int rnx=wrapCoord(xx+QChannelVec[big][0],QWidth);
            int rny=wrapCoord(yy+QChannelVec[big][1],QHeight);
            int rnz=wrapCoord(zz+QChannelVec[big][2],QDepth);
            int rns=siteIndex(rnx,rny,rnz);
            {
                int rc2=(big&1)?big-1:big+1;      /* opposite channel */
                uint32_t ra=qWinding[rns*QChannels+rc2],
                         rb=qWinding[rns*QChannels+big];
                if(ra-rb>=32)closed=1;            /* points back */
            }
            if(!closed)for(int hop=0;hop<8;hop++){
                int nx=wrapCoord(xx+QChannelVec[cc][0],QWidth);
                int ny=wrapCoord(yy+QChannelVec[cc][1],QHeight);
                int nz=wrapCoord(zz+QChannelVec[cc][2],QDepth);
                int ns=siteIndex(nx,ny,nz);
                if(ns==si){closed=1;break;}
                /* continue along the neighbor's directedness */
                int nc=-1;int32_t nd=0;
                for(int e2=0;e2<QChannels/2;e2++){
                    int32_t d=(int)qWinding[ns*QChannels+2*e2]
                             -(int)qWinding[ns*QChannels+2*e2+1];
                    if(d>nd){nd=d;nc=2*e2;}
                }
                if(nc<0||nd<32)break;             /* chain ends */
                cs=ns;cc=nc;
                xx=nx;yy=ny;zz=nz;
            }
            if(closed)continue;                   /* a bound vortex */
            /* free directedness: drain stochastically */
            if(randByte()&3)continue;
            uint32_t cur=free>>4;if(cur<1)cur=1;
            qWinding[si*QChannels+big]-=cur;
            qEvents[5]+=cur;
        }
        /* PAULI — the node's per-DIRECTION capacity is quantum-bounded:
         * each mode (+ or -) holds at most ONE circulation-quantum.
         * Two same-direction bound states would need 2x the +mode —
         * it saturates at one quantum so the second coincides (can't
         * be "more +"), while opposite uses the complementary - mode.
         * The exclusion is the directed-mode being single-occupancy.
         * NOTE — per-edge quantum occupancy is spin-0/spin+/spin-:
         * currently summed occupancy; a deeper version would track
         * per-bound-state quanta and bookkeep spin-flips. */
        for(int e=0;e<QChannels/2;e++){
            int32_t d=(int)qWinding[si*QChannels+2*e]
                    -(int)qWinding[si*QChannels+2*e+1];
            int32_t lim=32;
            if(d>lim)qWinding[si*QChannels+2*e]-=(uint32_t)(d-lim);
            else if(d<-lim)qWinding[si*QChannels+2*e+1]-=(uint32_t)(-d-lim);
        }
    }

    /* Attractor drain: only complete winding bands are stable — the
     * fractional remainder below the last full band evaporates as
     * photons. Quantization is enforced by dynamics (intermediates
     * decay), not by measurement bins — the level is still read,
     * but now only real stable states persist to be read. */
    for(int si=0;si<QSites;si++){
        /* the quantization applies to STRUCTURE not mass — the
         * FOURTH !mass gate (same bug class as absorb/emit/conduction):
         * non-massive loop-sites skipped this entirely, so their
         * winding accumulated unboundedly. The medium's ceiling is
         * the loop cap, and it applies wherever structure exists. */
        if(!siteLevel(si))continue;
        /* per-edge quantization: an edge's loop is either complete
         * (matched >= 128) or it evaporates — incomplete circulations
         * shed as photons. Quantization enforced per loop, not per
         * total — the discrete structure is a count of closed paths. */
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
            uint32_t m=a<b?a:b;
            if(m>0&&m<32){                         /* sub-metastable: shed */
                qWinding[si*QChannels+2*e]-=a<128?a:128;
                qWinding[si*QChannels+2*e+1]-=b<128?b:128;
                qPhoton_next[si*QChannels+2*e]+=1;
                qPhotonNu_next[si*QChannels+2*e]=m;
                qEvents[27]++;
            } else if(m>128){                      /* saturated loop: cap at
                 * the quantum — one loop per edge (exclusion), the
                 * excess is free winding that evaporates */
                uint32_t ex=m-128;
                qWinding[si*QChannels+2*e]-=ex;
                qWinding[si*QChannels+2*e+1]-=ex;
            }
        }
    }

    /* commit streamed buffers */
    for(int i=0;i<QSites*QChannels;i++){
        qMassFlight[i]+=qMassFlight_next[i];
        qPhoton[i]+=qPhoton_next[i];
        if(qPhoton_next[i]){qPhotonNu[i]=qPhotonNu_next[i];qPhotonBirth[i]=qPhotonBirth_next[i];}
        qAck[i]+=qAck_next[i];
        if(qAck_next[i]){qAckTtl[i]=qAckTtl_next[i];qAckRtt[i]=qAckRtt_next[i];}
    }
}

EMS_API void qi3_photon_set(int x,int y,int z,int c,int v){
    if(c>=QChannels)return;
    int si=siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth));
    qPhoton[si*QChannels+c]=(uint32_t)v; qPhotonNu[si*QChannels+c]=32;
    qPhotonBirth[si*QChannels+c]=(uint32_t)qTick;
}
EMS_API int qi3_photon_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qPhoton[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API void qi3_photon_nu_set(int x,int y,int z,int c,int v){
    if(c<QChannels)
        qPhotonNu[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c]=(uint32_t)(v<0?0:v);
}
EMS_API int qi3_photon_nu(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qPhotonNu[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API void qi3_mass_set(int x,int y,int z,int v){
    qMass[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=(uint32_t)v;
}
EMS_API int qi3_mass_get(int x,int y,int z){
    return qMass[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API void qi3_charge_set(int x,int y,int z,int v){
    qCharge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=(uint32_t)v;
}
EMS_API int qi3_charge_get(int x,int y,int z){
    return qCharge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API int qi3_heat_get(int x,int y,int z){
    return qHeat[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
}
EMS_API void qi3_level_set(int x,int y,int z,int v){
    qLevel[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))]=(uint32_t)v;
}
EMS_API int qi3_level_get(int x,int y,int z){
    return siteLevel(siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth)));
}
EMS_API void qi3_winding_set(int x,int y,int z,int c,int v){
    if(c<QChannels)
        qWinding[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c]=(uint32_t)(v<0?0:v);
}
EMS_API int qi3_loopphase_get(int x,int y,int z,int e){
    if(x<0||x>=QWidth||y<0||y>=QHeight||z<0||z>=QDepth)return 0;
    return effPhase(siteIndex(x,y,z),(e&8)); }
EMS_API int qi3_winding_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qWinding[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API int qi3_session_state(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qSessionState[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_session_strength(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qSessionStrength[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API void qi3_gap_mode(int m){ qGapMode=m; }
EMS_API void qi3_gap_scale(int s){ qGapShift=s; }
EMS_API void qi3_phase_mode(int m){ qPhaseMode=m; }
EMS_API void qi3_unwind_shift(int s){ qUnwindShift=s; }
EMS_API void qi3_cycle_shift(int s){ qCycleShift=s; }
EMS_API void qi3_temp_shift(int s){ qTempShift=s; }
EMS_API void qi3_fusion_wall(int w){ qFusionWall=w; }
EMS_API int qi3_confirm_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qConfirm[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_bond_dist(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qBondDist[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_ack_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qAck[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API uint64_t qi3_event(int i){ return qEvents[i & 31]; }
EMS_API int qi3_held_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qHeld[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_held_phase(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qHeldPhase[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_win_edge(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qWinEdge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API int qi3_deposit_edge(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qDepositEdge[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*(QChannels/2)+(c>>1)];
}
EMS_API uint64_t qi3_photon_count(void){ uint64_t m=0;
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++)m+=qPhoton[si*QChannels+c];return m; }
