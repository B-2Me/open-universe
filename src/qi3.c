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
                 * the circulation's POSITION in its cycle (0-255), not
                 * just amplitude. The oscillator's internal state. */
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
    /* topology-aware: a transition drops the WEAKEST complete loop
     * (what siteUnwind sheds) — the emitted nu is that loop's energy,
     * E ~ 128 * 4 / L^2: the quantum over the edge's reach (a tight
     * loop is more energetic, like a particle in a smaller box).
     * Use the measured bond distance when the handshake knows it. */
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=128&&(be<0||m<bm)){bm=m;be=e;}
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
    /* the CLOSED-circulation content: winding balanced across each
     * edge pair forms a loop through the edge and back — the internal
     * structure is closed circulations, and the level derives from
     * their total, not scattered deposits. */
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
    if(m<1||m>128)return;
    uint32_t rung=m>>qUnwindShift<<qUnwindShift;  /* nearest rung <= m */
    if(rung<32)rung=32;                          /* don't snap below floor */
    uint32_t dm=m-rung;
    if(a>b){qWinding[c0]-=dm;}else if(b>a){qWinding[c1]-=dm;}
    else{qWinding[c0]-=dm/2;qWinding[c1]-=dm/2;}
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
    /* quantized unwind: drop exactly ONE loop — the weakest
     * complete circulation collapses (its winding releases as
     * the transition's energy). Structure is loop-discrete, not
     * band-smooth — a transition is a loop unwinding, not a
     * bank balance draining. */
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=128&&(be<0||m<bm)){bm=m;be=e;}   /* weakest complete loop */
    }
    if(be<0)return;
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
                    if(mA+nu<=160){                      /* arrival edge takes it
                         * (cap a bit over the quantum — the snapLoop
                         * canonizes the overflow) */
                        qWinding[si*QChannels+2*arr]+=nu;
                        qWinding[si*QChannels+2*arr+1]+=nu;
                        qDepositEdge[si*(QChannels/2)+arr]+=1;
                        continue;
                    }
                    /* arrival edge full: route internally to the
                     * freest edge — the intra-node corner */
                    int fe=-1;uint32_t fm=999;
                    int start=randByte()%(QChannels/2);
                    for(int j=0;j<QChannels/2;j++){
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
         * not equilibrium flow. The offer deposits a full quantum
         * to a free internal edge. */
        if(qHeldInt[si]>=128){
            int fe=-1,start=randByte()%(QChannels/2);
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],
                         b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;
                if(m<128){fe=e2;break;}
            }
            if(fe>=0){
                qWinding[si*QChannels+2*fe]+=128;
                qWinding[si*QChannels+2*fe+1]+=128;
                qHeldInt[si]-=128;qEvents[3]++;
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
            /* vacuum absorption: the node's LOCAL DENSITY is its
             * opacity — each photon in the channel decays with
             * probability scaled by the neighbor-sampled density
             * (bosons: a count decays by a fraction, not per-photon
             * all-or-nothing). Runs on the internal clock — the
             * medium's own thermalization, not transit. */
            uint32_t density=qLocalDensity[si]+1;
            if((qTick%(1<<qCycleShift))==0){
                uint32_t decay=((uint32_t)v*(density>>2))>>8;
                if(decay<1&&(randByte()&7)==0)decay=1;    /* floor: ~1/8 */
                if(decay>(uint32_t)v)decay=v;
                if(decay){v-=decay;qHeat[si]+=(uint64_t)decay*nu;
                    qEvents[7]+=(uint64_t)decay*nu;}
            }
            if(v<=0){qPhoton[si*QChannels+c]=0;continue;}
            /* stochastic propagation: the photon isn't a laminar flux —
             * it's a quantum that JITTERS. It may continue forward
             * (mostly) or scatter to a random channel — the medium
             * agitates it, no preferred flow. The field drives global
             * frustration: photons arrive from random directions,
             * agitating every site, keeping the medium far from
             * equilibrium without imposing a net current. */
            int c2=c;
            if((randByte()&7)==0)c2=randByte()%QChannels;   /* ~1/8 scatter */
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
            qPhoton[si*QChannels+c]-=v;
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
            if(!mass&&(randByte()&15))continue;   /* 15/16 pass through */
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
                    uint32_t lp=qLoopPhase[si*(QChannels/2)+edge6]&255;
                    uint32_t op=(nu*(uint32_t)(qTick-qPhotonBirth_next[si*QChannels+c]))&255;
                    int d=(int)lp-(int)op;if(d<0)d=-d;if(d>128)d=256-d;
                    if(d>64)match=0;                     /* out of phase: decline */
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
    if(internal)for(int si=0;si<QSites;si++){
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=qWinding[si*QChannels+2*e],b=qWinding[si*QChannels+2*e+1];
            uint32_t m=a<b?a:b;
            if(m<32)continue;                    /* only real loops cycle */
            uint64_t L2=edgeLen2(2*e);
            qLoopPhase[si*(QChannels/2)+e]=
                (qLoopPhase[si*(QChannels/2)+e]+(128/L2+1))&255;
        }
    }

    /* Phase 4c — winding conduction: circulation flows down its
     * own gradient along edges — a wound site sheds a quantum
     * into a low-winding neighbor, so the hole relocates TOWARD
     * the donor. Loop-preserving: both channels of the edge
     * move together. Fick's-law diffusion on the loop field.
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
            if(!qMass[ni])continue;   /* conduction is a medium property —
                vacuum can't hold circulation; a transaction's quantum
                must BIND at a massive absorber, not smear into void. */
            int d=(int)qSiteWind[si]-(int)qSiteWind[ni];
            if(d<8)continue;
            uint32_t k=(uint32_t)(d>>5);if(k>16)k=16;if(!k)k=1;
            uint32_t a=qWinding[si*QChannels+e*2],b=qWinding[si*QChannels+e*2+1];
            uint32_t m=a<b?a:b;if(k>m)k=m;if(!k)continue;
            qWinding[si*QChannels+e*2]-=k;
            qWinding[si*QChannels+e*2+1]-=k;
            qWinding[ni*QChannels+e*2]+=k;
            qWinding[ni*QChannels+e*2+1]+=k;
            snapLoop(ni,e);   /* quantize the received circulation */
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
            if(!qMass[si])continue;
            mass=qMass[si];
        }
        /* emission derives from STRUCTURE (loops), not mass — same
         * fix as the absorb gate: mass is a consequence of bound
         * circulation, not a prerequisite. A loop-only site emits
         * at its level-gap line. */
        if(!mass&&!siteLevel(si))continue;
        /* bound energy thermalizes into circulation: a whole quantum
         * organizes at once — charge >= 256 converts into a complete
         * loop (128+128) on a free edge. Structure forms in quanta,
         * not a trickle that the drain sheds before it can close. */
        /* thermalize above a SURVIVAL floor (mass burn needs e>32
         * + one more quantum's worth) — charge is fuel for staying
         * alive and forming structure; the LOOPS are the reservoir,
         * not the charge pool. */
        if(e>288){
            int fe=-1;
            int start=randByte()%(QChannels/2);
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;if(m<128){fe=e2;break;}
            }
            if(fe>=0){
                qWinding[si*QChannels+2*fe]+=128;
                qWinding[si*QChannels+2*fe+1]+=128;
                qCharge[si]=e-256;
            }
        }
        /* the heat reservoir drains the same way — absorbed photon
         * energy thermalizes into structure, not just sits. The
         * vacuum-heat is a channel, not a bucket: photon->heat->
         * loop is the species cycle closing. */
        if(qHeat[si]>288){
            int fe=-1,start=randByte()%(QChannels/2);
            for(int j=0;j<QChannels/2;j++){
                int e2=(start+j)%(QChannels/2);
                uint32_t a=qWinding[si*QChannels+2*e2],b=qWinding[si*QChannels+2*e2+1];
                uint32_t m=a<b?a:b;if(m<128){fe=e2;break;}
            }
            if(fe>=0){
                qWinding[si*QChannels+2*fe]+=128;
                qWinding[si*QChannels+2*fe+1]+=128;
                qHeat[si]-=256;
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
        qPhoton_next[si*QChannels+c]+=1;
        qPhotonNu_next[si*QChannels+c]=line>>qGapShift;
        if(!qPhotonNu_next[si*QChannels+c])qPhotonNu_next[si*QChannels+c]=1;
        qPhotonBirth_next[si*QChannels+c]=(uint32_t)qTick;
        siteUnwind(si,(uint32_t)line);          /* fell one band */
        qEvents[4]++;qEvents[20]+=line;
    }

    /* Phase 6a — thermal re-emission: the vacuum-heat reservoir
     * RADIATES. A site holding heat above a quantum sheds a photon —
     * the medium is SELF-DRIVING: photon -> absorbed -> heat ->
     * re-emit -> photon. The sinks feed the sources; the cycle
     * closes internally, no external injector. Local and stochastic —
     * a site radiates when ITS reservoir is hot, not on a schedule. */
    for(int si=0;si<QSites;si++){
        if(qHeat[si]<256)continue;
        if(randByte()&3)continue;               /* stochastic lifetime */
        int c=randByte()%QChannels;
        qPhoton_next[si*QChannels+c]+=1;
        qPhotonNu_next[si*QChannels+c]=64;
        qPhotonBirth_next[si*QChannels+c]=(uint32_t)qTick;
        qHeat[si]-=256;
        qEvents[4]++;
    }

    /* Phase 6b — annihilation: antipodal winding on an axis (a
     * particle/antiparticle pair wound on facing channels) decays
     * into equal back-to-back photon populations at the site line. */
    for(int si=0;si<QSites;si++){
        for(int c=0;c<QChannels;c++){
            int oc=c^1;
            uint32_t a=qWinding[si*QChannels+c];
            uint32_t b=qWinding[si*QChannels+oc];
            uint32_t pair=a<b?a:b;
            /* bound circulation is protected: annihilate only the
             * antipodal winding ABOVE the loop quantum — free
             * particle/antiparticle excess decays, the closed loop
             * (the level structure itself) persists. */
            uint32_t free=pair>128?pair-128:0;
            if(free<16)continue;                       /* stability floor */
            uint32_t burst=free>>3;if(burst<1)burst=1;
            int n=siteLevel(si);if(n<2)n=2;
            int nu=(qGapMode>=1&&qGapMode<=4)?qi3gapE(n,1):(qMass[si]>4?qMass[si]>>2:1);
            qWinding[si*QChannels+c]-=burst;
            qWinding[si*QChannels+oc]-=burst;
            qPhoton_next[si*QChannels+c]+=burst;
            qPhoton_next[si*QChannels+oc]+=burst;
            qPhotonNu_next[si*QChannels+c]=nu;
            qPhotonNu_next[si*QChannels+oc]=nu;
            qEvents[5]+=burst;                          /* annihilation */
        }
    }

    /* Attractor drain: only complete winding bands are stable — the
     * fractional remainder below the last full band evaporates as
     * photons. Quantization is enforced by dynamics (intermediates
     * decay), not by measurement bins — the level is still read,
     * but now only real stable states persist to be read. */
    for(int si=0;si<QSites;si++){
        if(!qMass[si])continue;
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
