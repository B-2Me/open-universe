/* moore26 — 0.1fm/node Planck-substrate engine (Moore-26 stencil).
 *
 * The Planck Field Engine (Langevin's Wake)
 * Copyright (c) 2026 Nathan / btwo.me
 *
 * The 0.8fm→0.1fm migration of qi3: a nucleon is ~500 volumetric
 * nodes at this scale (a macroscopic topological knot, not a
 * sub-grid anomaly). The geometry upgrades from 18 channels to the
 * 26-neighbor Moore stencil (the 3x3x3 cube) for isotropic fields,
 * and the memory layout packs per-node state into an AoS NodeState
 * (one cache line per node) instead of separate flat SoA arrays.
 *
 * The physics is qi3's local-causal model: packets (the field's
 * energy-carriers) + quanta (charged conserved states, bound or
 * unbound) carrying direction/orbit/helicity/charge, moved by
 * offer/answer transactions between nodes. Conservation keeps it
 * faithful — the transactions preserve the labels' global totals.
 *
 * At 0.1fm the physics relaxes into macroscopic fluid dynamics:
 * over-pressure routing (a saturated core shunts excess outward),
 * decoupled phase-sync (a fast-pass relaxation beats c=1 transit),
 * and macroscopic string-breaking (integrated tube tension, not a
 * single saturated link).
 *
 * Vacuum-skip: ~99% of a 0.1fm grid is empty. An 8x8x8 macro-chunk
 * ledger marks chunks holding any mass/winding/packets; each tick
 * processes live chunks plus a 1-chunk halo (catching inbound flux)
 * and re-scans the write buffer to compute next-tick liveness.
 * Invariant: content only ever exists inside processed chunks, so
 * unprocessed nodes' grid_next slots stay equal to grid_current and
 * the swap is an identity there — no phantom resurrection.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifdef _OPENMP
#ifndef __EMSCRIPTEN__
#include <omp.h>      /* native OpenMP — emscripten's sysroot ships no
                        * omp.h but still honors -fopenmp pragmas */
#endif
#endif

static int QWidth, QHeight, QDepth, QSites;

/* the 26-neighbor Moore stencil: the 3x3x3 cube minus the center.
 * vec[v][0..2] = dx,dy,dz — face(6), edge(12), corner(8) neighbors.
 * len2 = squared distance (1 face, 2 edge, 3 corner) for the 1/r2
 * field-weighting — the bound state's wake being a sphere, not a
 * faceted diamond. Channels come in +/- pairs: channel 2e is the
 * opposite direction of 2e+1 (edge e spans both). */
static int QChannels = 26;
static int8_t QChannelVec[26][3] = {
/* FCC transport gate — only the 12 edge channels ({±1,±1,0} family,
 * indices 6..17) carry flight. Every edge hop is equidistant at
 * sqrt(2), so c is one local hop per tick with TRUE isotropy — the
 * starburst anisotropy of the full Moore-26 stencil is structural
 * grid bias, not physics. Face (0-5) + corner (18-25) channels stay
 * live as structural registers (winding/charge/over-pressure) — they
 * just don't transport. */
#define IS_EDGE(c) ((c)>=6&&(c)<=17)
/* even sublattice of the ABC hex grid — only parity-even cells carry
 * the transport graph. Edge hops preserve x+y+z parity, so the gate
 * closes under transport; odd cells are pure structure (winding,
 * mass, charge, heat — never packet or flight registers). */
#define IS_EVEN(x,y,z) ((((x)+(y)+(z))&1)==0)

    {1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1},        /* faces */
    {1,1,0},{-1,-1,0},{1,-1,0},{-1,1,0},                      /* xy edges */
    {1,0,1},{-1,0,-1},{1,0,-1},{-1,0,1},                      /* xz edges */
    {0,1,1},{0,-1,-1},{0,1,-1},{0,-1,1},                      /* yz edges */
    {1,1,1},{-1,-1,-1},{1,1,-1},{-1,-1,1},                    /* corners */
    {1,-1,1},{-1,1,-1},{1,-1,-1},{-1,1,1}
};
static inline int edgeLen2(int c){
    const int8_t *v=QChannelVec[c];
    return v[0]*v[0]+v[1]*v[1]+v[2]*v[2];
}

/* AoS NodeState — one cache line per node. The SoA flat arrays of
 * qi3 (qMass, qWinding, ...) packed into a single struct so a node's
 * whole local state is one memory fetch, not 12 disconnected reads.
 * grid_next mirrors it for the double-buffered transactional write. */
typedef struct {
    uint16_t winding[26];      /* channel populations — the directedness */
    uint16_t massFlight[26];   /* in-flight mass per channel */
    uint8_t  packet[26];       /* packet counts (the offers) */
    uint8_t  packetNu[26];     /* packet nu tags (the energy) */
    uint8_t  incip[26];        /* armed incipients per channel (negotiations) */
    uint8_t  incipNu[26];      /* each incipient's nu (bit7 = stim flag) */
    uint8_t  incipBorn[26];    /* each incipient's offer birth tick (tau) */
    uint8_t  packetBorn[26];   /* packet birth tick — propagates with nu */
    uint8_t  ack[26];          /* returning confirms (the ACK counts) */
    uint8_t  ackTtl[26];       /* hops remaining back to the emitter */
    uint8_t  ackRtt[26];       /* the round-trip the ACK delivers */
    uint8_t  bondDist[13];     /* measured edge reach (hops) — feeds L2 */
    int8_t   chargeFlight[26]; /* charge quanta riding the mass flight */
    uint32_t phase;            /* bound-state phase 0-511 (double-cover) */
    uint16_t mass;             /* parked mass (the structure) */
    int16_t  charge;           /* SIGNED bound charge (+q/-q pair-able) */
    uint16_t heat;             /* vacuum heat reservoir (the local temp) */
    uint16_t localDensity;     /* neighbor-sampled density (the gradient) */
} NodeState;
static NodeState *grid_current, *grid_next;
/* Jacobi scratch planes — deterministic phase-sync (read-old/
 * write-new each pass; the in-place version raced under OpenMP) */
static uint32_t *phaseA, *phaseB;
/* visualizer + snapshot buffers (see the Cascade export section) */
static uint8_t *rgBuf=0;
static NodeState *saveBuf=0;

/* vacuum-skip ledgers — 8x8x8 macro-chunks */
#define CHUNK 8
static int CW,CH,CD,nChunks;
static uint8_t *chunkLive, *chunkProc;
static int *procList, nProc;

static uint64_t qEvents[48];
static uint64_t qTick;
static int qFusionWall=256;   /* pair-production energy threshold —
     * nua+nub must clear it (each packet above ~mc2, not a crowd
     * of weak ones) */
static int qCommitMin=32;
static int qGroundFloor=512;
static int qConfirmCap=160;
static int qCatchGate=16;
static int qDirBias=0;
static int qDeflectAlign=0;
static int qDdShift=0;
static int qBendShift=0;
static int qRadShift=0;
static int qPhaseGate=0;
static int qPhaseSync=1;
static int qVolShare=0;
static int qChainShare=0;
static int qResEmit=0;
static int QMaskX, QMaskY, QMaskZ, QMaskCX, QMaskCY, QMaskCZ;

/* thread-safe stochasticity: a hash of (site, tick) — no shared RNG
 * state to race on under OpenMP. Same site+tick -> same stream. */
static inline uint8_t rand_site(int si,int salt){
    uint64_t s=(uint64_t)si*0x9E3779B97F4A7C15ULL
             +(uint64_t)salt*0x2545F4914F6CDD1DULL
             +qTick*0xD1B54A32D192ED03ULL;
    s^=s>>30;s*=0xBF58476D1CE4E5B9ULL;s^=s>>27;s*=0x94D049BB133111EBULL;s^=s>>31;
    return (uint8_t)(s>>56);
}

/* bitwise-wrap neighbor: the power-of-2 dims make wrapping a mask,
 * not a modulo — v&m instead of v%m + the v<0 branch. */
static inline int nbr(int x,int y,int z,int dx,int dy,int dz){
    return ((z+dz)&QMaskZ)*QWidth*QHeight+((y+dy)&QMaskY)*QWidth+((x+dx)&QMaskX);
}

/* loop over every node in every processed chunk (live ∪ halo).
 * pi iterates the proc list; x,y,z,si bound inside. */
#define PROC_NODES                                                     \
    _Pragma("omp parallel for schedule(static)")                       \
    for(int pi=0;pi<nProc;pi++){                                       \
        int ci_=procList[pi];                                          \
        int cz_=ci_/(CW*CH),cy_=(ci_%(CW*CH))/CW,cx_=ci_%CW;           \
        for(int z=cz_*CHUNK;z<cz_*CHUNK+CHUNK&&z<QDepth;z++)           \
        for(int y=cy_*CHUNK;y<cy_*CHUNK+CHUNK&&y<QHeight;y++)          \
        for(int x=cx_*CHUNK;x<cx_*CHUNK+CHUNK&&x<QWidth;x++){          \
            int si=z*QWidth*QHeight+y*QWidth+x;

#define PROC_NODES_END }}

/* content test — a chunk is live if any node carries structure or
 * packets; the scan early-outs on the first live node found. */
static int node_live(const NodeState *n){
    if(n->mass)return 1;
    for(int c=0;c<QChannels;c++)
        if(n->winding[c]||n->packet[c]||n->massFlight[c]||n->incip[c])return 1;
    return 0;
}

/* build the process list = live chunks ∪ 1-chunk halo (halo catches
 * inbound flight/conduction writes, which can only land adjacent). */
static void build_proc(void){
    memset(chunkProc,0,nChunks);
    nProc=0;
    for(int cz=0;cz<CD;cz++)for(int cy=0;cy<CH;cy++)for(int cx=0;cx<CW;cx++){
        int ci=cz*CW*CH+cy*CW+cx;
        if(!chunkLive[ci])continue;
        for(int dz=-1;dz<=1;dz++)for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            int nj=((cz+dz)&QMaskCZ)*CW*CH+((cy+dy)&QMaskCY)*CW+((cx+dx)&QMaskCX);
            if(!chunkProc[nj]){chunkProc[nj]=1;procList[nProc++]=nj;}
        }
    }
}

/* after the phases: scan grid_next in every processed chunk — any
 * content (incl. freshly arrived packets) keeps the chunk live. */
static void rescan_live(void){
    memset(chunkLive,0,nChunks);
    for(int pi=0;pi<nProc;pi++){
        int ci=procList[pi];
        int cz=ci/(CW*CH),cy=(ci%(CW*CH))/CW,cx=ci%CW;
        for(int z=cz*CHUNK;z<cz*CHUNK+CHUNK&&z<QDepth&&!chunkLive[ci];z++)
        for(int y=cy*CHUNK;y<cy*CHUNK+CHUNK&&y<QHeight&&!chunkLive[ci];y++)
        for(int x=cx*CHUNK;x<cx*CHUNK+CHUNK&&x<QWidth;x++)
            if(node_live(&grid_next[z*QWidth*QHeight+y*QWidth+x])){chunkLive[ci]=1;break;}
    }
}

static void mark_chunk(int x,int y,int z){
    int ci=(z/CHUNK)*CW*CH+(y/CHUNK)*CW+(x/CHUNK);
    if(ci>=0&&ci<nChunks)chunkLive[ci]=1;
}

/* occupancy-volume level: the bound state is a DISTRIBUTION of
 * circulation over the node's edge-space — committed exchange
 * (m>=32) counts, traffic doesn't. n ~ quanta of bound volume. */
static int site_level(const NodeState *o){
    int n=1;uint32_t vol=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=qCommitMin)vol+=m;
    }
    n+=vol>>7;if(n>8)n=8;return n;
}
static uint64_t loop_winding(const NodeState *o){
    uint64_t w=0;
    for(int e=0;e<QChannels/2;e++)
        w+=2*(o->winding[2*e]<o->winding[2*e+1]?o->winding[2*e]:o->winding[2*e+1]);
    return w;
}
/* geometric gap: the emitted nu is the weakest committed edge's
 * rung energy — the spectrum IS the structure (1/r2 weighted). */
static int geo_gap(const NodeState *o){
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
        uint32_t m=a<b?a:b;
        if(m>=qCommitMin&&(be<0||m<bm)){bm=m;be=e;}
    }
    if(be<0)return 0;
    /* the loop's measured reach: an ACK-delivered bond distance wins
     * over the lattice edge length — the spectrum encodes the real
     * macroscopic extent, not the grid spacing. */
    uint64_t L2=o->bondDist[be]?(uint64_t)o->bondDist[be]*o->bondDist[be]
                              :(uint64_t)edgeLen2(2*be);
    int nu=(int)((uint64_t)(bm>>2)*2/L2);
    if(nu<1)nu=1;
    if(nu>255)nu=255;
    return nu;
}
/* rung-quantized unwind — shed one rung from the weakest committed
 * edge in grid_next. Two protections ported from qi3:
 *   - circulation protection: a directed edge inside a CLOSED
 *     vortex (reciprocal neighbor carries the return flux) is
 *     topologically protected — macroscopic tube bounds, not
 *     single-node conditions.
 *   - ground-state floor: total committed volume <=512 can't
 *     unwind — nothing lighter to carry the quantum. */
static uint32_t site_unwind(int x,int y,int z,int si){
    NodeState *n=&grid_next[si];
    int be=-1;uint32_t bm=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t a=n->winding[2*e],b=n->winding[2*e+1];
        uint32_t m=a<b?a:b;
        if(m<qCommitMin)continue;
        int32_t dd=(int32_t)a-(int32_t)b;if(dd<0)dd=-dd;
        if(dd>=qCommitMin){
            int big=a>b?2*e:2*e+1;
            int ni=nbr(x,y,z,QChannelVec[big][0],QChannelVec[big][1],QChannelVec[big][2]);
            int rc=(big&1)?big-1:big+1;
            uint32_t ra=grid_current[ni].winding[rc],rb=grid_current[ni].winding[big];
            if(ra>rb&&ra-rb>=qCommitMin)continue;      /* reciprocal: closed */
        }
        if(be<0||m<bm){bm=m;be=e;}
    }
    if(be<0)return 0;
    uint32_t tv=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t m2=n->winding[2*e]<n->winding[2*e+1]?n->winding[2*e]:n->winding[2*e+1];
        if(m2>=qCommitMin)tv+=m2;
    }
    if(tv<=qGroundFloor)return 0;                       /* ground-state floor */
    uint32_t a=n->winding[2*be],b=n->winding[2*be+1];
    uint32_t m=a<b?a:b;
    uint32_t rung=(m-1)>>2;
    uint32_t next=rung<<2;
    if(next>=m)next=(rung-1)<<2;
    uint32_t shed=m-next;if(shed<1)shed=1;
    uint32_t da=a>shed?shed:a, db=b>shed?shed:b;
    n->winding[2*be]-=da;n->winding[2*be+1]-=db;
    return da+db;   /* the TOTAL shed — the conserved token (packet
                     * nu and mass condensation both account it) */
}

void moore26_init(int w,int h,int d){
    /* power-of-2 dims required for the bitwise-mask wrap; each dim
     * must be >= 8 so the chunk grid is also power-of-2. */
    /* free any prior grid — re-init leaks ~2GB/call at 128^3 and the
     * eventual calloc failure reads garbage state (a wasm
     * "divide by zero" trap surfaced as a field reading 0). */
    if(grid_current){free(grid_current);grid_current=0;}
    if(grid_next){free(grid_next);grid_next=0;}
    if(phaseA){free(phaseA);phaseA=0;}
    if(phaseB){free(phaseB);phaseB=0;}
    if(chunkLive){free(chunkLive);chunkLive=0;}
    if(chunkProc){free(chunkProc);chunkProc=0;}
    if(procList){free(procList);procList=0;}
    if(rgBuf){free(rgBuf);rgBuf=0;}
    if(saveBuf){free(saveBuf);saveBuf=0;}
    /* enforce it: floor each dim to the nearest pow2 >= 8 — a masked
     * wrap on a non-pow2 grid silently corrupts neighbor indices
     * (N=40 -> CW=5 -> dead chunks, packets pinned at their seeds). */
    int pw=8,ph=8,pd=8;
    while(pw*2<=w)pw*=2;
    while(ph*2<=h)ph*=2;
    while(pd*2<=d)pd*=2;
    w=pw;h=ph;d=pd;
    QWidth=w;QHeight=h;QDepth=d;QSites=w*h*d;
    QMaskX=w-1;QMaskY=h-1;QMaskZ=d-1;
    CW=w/CHUNK;CH=h/CHUNK;CD=d/CHUNK;
    if(CW<1)CW=1;
    if(CH<1)CH=1;
    if(CD<1)CD=1;
    QMaskCX=CW-1;QMaskCY=CH-1;QMaskCZ=CD-1;
    nChunks=CW*CH*CD;
    grid_current=calloc(QSites,sizeof(NodeState));
    grid_next   =calloc(QSites,sizeof(NodeState));
    phaseA      =malloc(QSites*sizeof(uint32_t));
    phaseB      =malloc(QSites*sizeof(uint32_t));
    chunkLive   =calloc(nChunks,1);
    chunkProc   =calloc(nChunks,1);
    procList    =malloc(nChunks*sizeof(int));
    /* allocation failure leaves a dead-but-safe engine: every tick
     * path short-circuits on nProc=0 instead of dereferencing NULL. */
    if(!grid_current||!grid_next||!phaseA||!phaseB||!procList){
        nChunks=0;nProc=0;
        if(grid_current){free(grid_current);grid_current=0;}
        if(grid_next){free(grid_next);grid_next=0;}
        return;
    }
    memset(qEvents,0,sizeof(qEvents));
}

/* the tick — the offer/answer transaction cycle. One carry-forward
 * per processed node, then the phases read grid_current and write
 * grid_next (intra-tick visibility where a phase reads next-state
 * fields it just staged). */
void moore26_tick(void){
    qTick++;
    build_proc();

    /* Phase 0: carry — every processed node copies current→next so
     * unwritten fields survive the swap (and vacuum writes zeros,
     * killing stale-state resurrection). */
    PROC_NODES
        grid_next[si]=grid_current[si];
    PROC_NODES_END

    /* Phase 1: packet flight — packets hop 1 node/tick along their
     * channel direction (c at transit scale). PULL-MODEL: each node
     * reads its upstream neighbor's channel (unique writer per slot —
     * no send/receive race). Arriving flux DECAYS into heat at the
     * destination's density: opaque media thermalize packets, sparse
     * vacuum passes them — the field's thermalization sink (qi3's
     * vacuum-absorption opacity). */
    PROC_NODES
        if(!IS_EVEN(x,y,z))continue;   /* transport lives on the even sublattice */
        NodeState *o=&grid_current[si];
        /* gather upstream arrivals first — only nodes receiving flux
         * pay the 26-neighbor opacity scan (halo vacuum skips it). */
        uint32_t v[26],nu[26];uint8_t born[26];int anyp=0;
        for(int c=0;c<QChannels;c++){
            int up=nbr(x,y,z,-QChannelVec[c][0],-QChannelVec[c][1],-QChannelVec[c][2]);
            v[c]=grid_current[up].packet[c];
            nu[c]=grid_current[up].packetNu[c];
            born[c]=grid_current[up].packetBorn[c];
            if(v[c])anyp=1;
        }
        int live=0;
        if(anyp||o->mass){
            for(int cc=0;cc<QChannels;cc++){
                int ni=nbr(x,y,z,QChannelVec[cc][0],QChannelVec[cc][1],QChannelVec[cc][2]);
                if(node_live(&grid_current[ni]))live++;
            }
            grid_next[si].localDensity=(uint16_t)(live*255/QChannels);
        }
        for(int c=0;c<QChannels;c++){
            /* non-edge channels don't transport — the register keeps
             * whatever was parked there (structural reservoir). */
            if(!IS_EDGE(c))continue;
            if(!v[c]){grid_next[si].packet[c]=0;continue;}
            uint32_t nuv=nu[c]?nu[c]:1;
            /* decay -> heat: the arriving packet's energy becomes the
             * node's local temperature (not lost — the thermal sink
             * the emit/reabsorb loop needs for equilibrium). */
            uint32_t decay=(v[c]*(uint32_t)live)>>8;
            if(decay<1&&(rand_site(si,40+c)&7)==0)decay=1;
            if(decay>v[c])decay=v[c];
            if(decay){
                uint32_t h=grid_next[si].heat+decay*nuv;
                grid_next[si].heat=(uint16_t)(h>65535?65535:h);
                qEvents[7]+=(uint64_t)decay*nuv;
            }
            uint32_t r=v[c]-decay;
            grid_next[si].packet[c]=(uint8_t)(r>255?255:r);
            grid_next[si].packetNu[c]=(uint8_t)nuv;
            grid_next[si].packetBorn[c]=born[c];
        }
        /* local heat drain — the reservoir cools into the sub-grid
         * depth (per-node state, NOT a global bath): each node's
         * stored energy bleeds ~1/128 per tick into the coarse-
         * grained internals below the node scale. */
        uint16_t h=grid_next[si].heat;
        if(h)grid_next[si].heat=h-(h>>7);
        /* thermal re-emission — the hot sub-grid fluctuates and
         * boils a fraction of its stored energy back into a packet
         * (the CMB-like floor: opaque structure grinds packets to
         * heat, hot vacuum stochastically re-radiates). CONSERVED:
         * heat is debited exactly the minted nu. */
        if(h>128&&(rand_site(si,50)&63)==0){
            /* re-emit only onto transporting edge channels — a packet
             * minted on a face/corner register would freeze there. */
            int c=6+rand_site(si,51)%12;
            if(grid_next[si].packet[c]<255){
                uint32_t nu=(uint32_t)(h>>3)>255?255:(uint32_t)(h>>3);
                if(nu){
                    grid_next[si].heat-=(uint16_t)nu;
                    /* merge nu into occupied channel — count*nu preserved,
                     * truncation remainder books to heat */
                    if(grid_next[si].packet[c]){
                        uint32_t tot=(uint32_t)grid_next[si].packetNu[c]*grid_next[si].packet[c]+nu;
                        grid_next[si].packetNu[c]=(uint8_t)(tot/(grid_next[si].packet[c]+1));
                        uint32_t rem=tot-(uint32_t)grid_next[si].packetNu[c]*(grid_next[si].packet[c]+1);
                        grid_next[si].heat=(uint16_t)((grid_next[si].heat+rem)>65535?65535:(grid_next[si].heat+rem));
                    } else grid_next[si].packetNu[c]=(uint8_t)nu;
                    grid_next[si].packet[c]++;
                    grid_next[si].packetBorn[c]=(uint8_t)qTick;
                    qEvents[10]++;
                }
            }
        }
    PROC_NODES_END

    /* Phase 1b: mass stream + junction collide — in-flight mass
     * pulls along its channel (unique writer per slot). Opposing
     * arrivals annihilate AT the meeting node (matter/antimatter ->
     * back-to-back packets + charge residue); survivors PARK into
     * the node's mass — the knot's anchor shifting forward. */
    PROC_NODES
        uint32_t in[26];int8_t cin[26];
        for(int c=0;c<QChannels;c++){
            if(!IS_EDGE(c)){in[c]=0;cin[c]=0;grid_next[si].massFlight[c]=0;grid_next[si].chargeFlight[c]=0;continue;}
            int up=nbr(x,y,z,-QChannelVec[c][0],-QChannelVec[c][1],-QChannelVec[c][2]);
            in[c]=grid_current[up].massFlight[c];
            cin[c]=grid_current[up].chargeFlight[c];
            grid_next[si].massFlight[c]=0;
            grid_next[si].chargeFlight[c]=0;
        }
        /* catch rule: in-flight mass only parks at STRUCTURE (a mass
         * node or a committed-winding edge) — bare vacuum lets the
         * quantum keep flying (fragments separate until caught). */
        int catch_=grid_current[si].mass>0;
        if(!catch_){
            for(int e=0;e<QChannels/2;e++){
                uint32_t m2=grid_current[si].winding[2*e]<grid_current[si].winding[2*e+1]
                           ?grid_current[si].winding[2*e]:grid_current[si].winding[2*e+1];
                if(m2>=qCommitMin){catch_=1;break;}
            }
        }
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=in[2*e],b=in[2*e+1];
            uint32_t hit=a<b?a:b;
            if(hit){
                in[2*e]-=hit;in[2*e+1]-=hit;
                uint32_t nu=grid_current[si].mass>4?grid_current[si].mass>>2:64;
                uint32_t r0=255-grid_next[si].packet[2*e],r1=255-grid_next[si].packet[2*e+1];
                grid_next[si].packet[2*e]  +=hit<r0?hit:r0;
                grid_next[si].packet[2*e+1]+=hit<r1?hit:r1;
                grid_next[si].packetNu[2*e]=nu;
                grid_next[si].packetNu[2*e+1]=nu;
                grid_next[si].packetBorn[2*e]=(uint8_t)qTick;
                grid_next[si].packetBorn[2*e+1]=(uint8_t)qTick;
                /* charge residue is the SIGNED sum of what arrived —
                 * e+ + e- leaves nothing; like signs accumulate. */
                int32_t ch=(int32_t)grid_next[si].charge+(int)cin[2*e]+(int)cin[2*e+1];
                grid_next[si].charge=(int16_t)(ch>32767?32767:ch<-32767?-32767:ch);
                qEvents[0]+=hit*2;qEvents[9]+=hit;
            }
            if(catch_){
                uint32_t pk=in[2*e]+in[2*e+1];
                if(pk){
                    uint32_t m=grid_next[si].mass+pk;
                    grid_next[si].mass=(uint16_t)(m>65535?65535:m);
                    /* the parked mass lands with its carried charge */
                    int32_t ch=(int32_t)grid_next[si].charge+(int)cin[2*e]+(int)cin[2*e+1];
                    grid_next[si].charge=(int16_t)(ch>32767?32767:ch<-32767?-32767:ch);
                }
            } else {
                /* not caught — stays in-flight for next tick's pull */
                grid_next[si].massFlight[2*e]=in[2*e];
                grid_next[si].massFlight[2*e+1]=in[2*e+1];
                grid_next[si].chargeFlight[2*e]=cin[2*e];
                grid_next[si].chargeFlight[2*e+1]=cin[2*e+1];
            }
        }
    PROC_NODES_END

    /* Phase 1c: mass launch — a knot with a dominant directed edge
     * bleeds a fraction of its mass onto the flight channel along
     * the circulation axis every 8th tick (slower than c — the
     * internal clock). The stream parks it one node on: the knot
     * crawls along its own directedness. */
    if((qTick&7)==0){
        PROC_NODES
            NodeState *o=&grid_current[si];
            if(o->mass<32)continue;
            if(!IS_EVEN(x,y,z))continue;  /* mass on odd cells can't
             * launch — interstitial structure stays pinned */
            int de=-1;int32_t dd=0;
            for(int e=0;e<QChannels/2;e++){
                int32_t d=(int)o->winding[2*e]-(int)o->winding[2*e+1];
                if(d>dd){dd=d;de=e;}
            }
            if(de<0||dd<32)continue;
            /* remap the launch onto the edge channel nearest the
             * dominant winding axis — face/corner axes don't fly
             * under the FCC gate. */
            int fc=2*de;
            if(!IS_EDGE(fc)){
                int bs=-1;for(int c=6;c<18;c++){
                    int s=QChannelVec[c][0]*QChannelVec[fc][0]+QChannelVec[c][1]*QChannelVec[fc][1]+QChannelVec[c][2]*QChannelVec[fc][2];
                    if(s>bs){bs=s;fc=c;}
                }
            }
            uint32_t k=o->mass>>4;
            uint32_t k2=(uint32_t)dd>>2;
            if(k>k2)k=k2;
            if(!k)continue;
            grid_next[si].mass-=k;
            uint32_t f=grid_next[si].massFlight[fc]+k;
            grid_next[si].massFlight[fc]=(uint16_t)(f>65535?65535:f);
            /* the launched mass carries a proportional charge share */
            int32_t qc=(int32_t)o->charge>>4;
            grid_next[si].charge-=qc;
            int32_t cf=(int32_t)grid_next[si].chargeFlight[fc]+qc;
            grid_next[si].chargeFlight[fc]=(int8_t)(cf>127?127:cf<-127?-127:cf);
        PROC_NODES_END
    }

    /* Phase 2: OFFER — arrived packets arm incipient transactions.
     * A packet on channel c offers to the node; passing the catch
     * gate (bare vacuum ~1/16, deeper structure catches more) and
     * the edge-local match (the channel's own absorption line), it
     * arms an incipient and leaves the stream. The node can hold at
     * most 13 concurrent negotiations — a saturated node DECLINES:
     * the offer scatters to the freest channel (the hard-core
     * bounce — deflection, not absorption). */
    PROC_NODES
        NodeState *n=&grid_next[si],*o=&grid_current[si];
        /* PAIR PRODUCTION (packet+packet -> mass): bare nodes only —
         * opposing arrivals on the same axis fuse when their combined
         * nu clears the fusion wall. The residue crystallizes as
         * mass+charge and LAUNCHES apart on the arrival channels
         * (momentum conservation — gamma+gamma -> e+e- flies, not a
         * static pile). Radiation recombining into knots: the
         * universe regenerates, not only degrades. */
        if(!n->mass){
            for(int c=0;c<QChannels;c++){
                /* pair production only fires on transporting edges —
                 * face/corner registers don't fuse or launch. */
                if(!IS_EDGE(c))continue;
                int oc=c^1;
                uint32_t a=n->packet[c],b=n->packet[oc];
                if(!a||!b)continue;
                uint32_t nua=n->packetNu[c]?n->packetNu[c]:1;
                uint32_t nub=n->packetNu[oc]?n->packetNu[oc]:1;
                if(nua+nub<(uint32_t)qFusionWall)continue;
                uint32_t pair=a<b?a:b;
                n->packet[c]-=pair;n->packet[oc]-=pair;
                uint64_t dep=(uint64_t)pair*(nua+nub);
                uint32_t m=n->mass+(uint32_t)(dep>>5);
                n->mass=(uint16_t)(m>65535?65535:m);
                /* SIGNED pair: the separating fragments carry +q/-q
                 * (net zero minted — gamma+gamma -> e+ + e-). */
                int32_t qc=(int32_t)(dep>>4);
                int32_t cf0=(int32_t)n->chargeFlight[c]+qc;
                int32_t cf1=(int32_t)n->chargeFlight[oc]-qc;
                n->chargeFlight[c]=(int8_t)(cf0>127?127:cf0);
                n->chargeFlight[oc]=(int8_t)(cf1<-127?-127:cf1);
                uint32_t f0=n->massFlight[c]+pair,f1=n->massFlight[oc]+pair;
                n->massFlight[c]=(uint16_t)(f0>65535?65535:f0);
                n->massFlight[oc]=(uint16_t)(f1>65535?65535:f1);
                n->winding[c]+=pair>>2;          /* residual wound */
                n->winding[oc]+=pair>>2;
                qEvents[23]+=pair;
            }
        }
        int lvl=site_level(o);if(lvl<1)lvl=1;
        if(!IS_EVEN(x,y,z))continue;   /* packets never arm on odd cells */
        for(int c=0;c<QChannels;c++){
            if(!n->packet[c])continue;
            if((rand_site(si,20+c)%qCatchGate)>=lvl)continue;     /* catch gate */
            uint32_t nu=n->packetNu[c]?n->packetNu[c]:1;
            int line=((int)o->mass+((int)o->winding[c]>>2))>>2;
            if(line<1)line=1;
            if(nu%(uint32_t)line!=0||nu<(uint32_t)line)continue; /* off-band: flies on */
            /* phase gate (qPhaseGate, qi3 effPhase port): the offer's
             * phase nu*age mod 256 must land within the site's
             * receptive window — else the transaction declines.
             * The 720 spinor register finally does work. */
            if(qPhaseGate){
                uint32_t age=((uint32_t)(qTick&255)-(uint32_t)n->packetBorn[c])&255;
                uint32_t op=(nu*age)&255;
                int d=(int)(o->phase&255)-(int)op;
                if(d<0)d=-d;if(d>128)d=256-d;
                if(d>qPhaseGate)continue;
            }
            int armed=0;
            for(int cc=0;cc<QChannels;cc++)armed+=n->incip[cc];
            /* electrostatic screening as occupancy economics: an
             * accumulated charge lowers the negotiation capacity —
             * charged nodes decline earlier, shedding flux they
             * can't accommodate. */
            int cap=13-((n->charge<0?-n->charge:n->charge)>>3);
            if(cap<4)cap=4;
            if(armed>=cap){
                /* DECLINED — deflect to the freest channel: the packet
                 * bounces off the dense field to find another target
                 * rather than stacking inside it. */
                int fc=6;uint32_t fo=255;
                /* deflection target must be a transporting edge —
                 * scattering onto a face/corner register freezes the
                 * packet in a dead channel under the FCC gate.
                 * qDeflectAlign: parallel-transport deflection —
                 * prefer the 60-degree forward neighbors (dot=1),
                 * so wall declines route along the surface tangent
                 * instead of back-scattering. Falls back to the
                 * freest edge when the forward set is saturated. */
                if(qDeflectAlign){
                    const int8_t *vc=QChannelVec[c];
                    for(int c2=6;c2<18;c2++){
                        const int8_t *v2=QChannelVec[c2];
                        if(vc[0]*v2[0]+vc[1]*v2[1]+vc[2]*v2[2]!=1)continue;
                        if(n->packet[c2]<fo){fo=n->packet[c2];fc=c2;}
                    }
                }
                if(fo==255||!qDeflectAlign){
                    for(int c2=6;c2<18;c2++){
                        if(n->packet[c2]<fo){fo=n->packet[c2];fc=c2;}
                    }
                }
                n->packet[fc]++;
                n->packetNu[fc]=(uint8_t)nu;
                n->packet[c]--;
                qEvents[30]++;
                continue;
            }
            n->incip[c]++;
            /* stim flag in bit7: an offer at the node's own loop gap
             * stimulates a downward transition instead of depositing */
            n->incipNu[c]=(uint8_t)((nu>127?127:nu)|(nu==geo_gap(o)?0x80:0));
            n->incipBorn[c]=n->packetBorn[c];
            n->packet[c]--;
            qEvents[5]++;
        }
    PROC_NODES_END

    /* Phase 3: CONFIRM — incipients armed LAST tick actualize: each
     * deposits its nu onto the arrival edge (matched, mA+nu<=160)
     * plus a feed to the dominant circulation axis (geometric
     * momentum — the vortex corrects absorbed momentum into its
     * spin). Arrival-full routes internally to the dominant/freest
     * edge; all-full sinks to charge (the thermalization path). */
    PROC_NODES
        NodeState *n=&grid_next[si],*o=&grid_current[si];
        /* ACK transit — returning confirms pull home like packets;
         * expiry delivers the measured reach to the emitter's edge
         * (the bond channel — its distance feeds emitted spectra). */
        for(int c=0;c<QChannels;c++){
            if(!IS_EVEN(x,y,z)){n->ack[c]=0;continue;}  /* ack rides the
             * even-sublattice transport graph like packets do */
            int up=nbr(x,y,z,-QChannelVec[c][0],-QChannelVec[c][1],-QChannelVec[c][2]);
            uint8_t a=grid_current[up].ack[c];
            if(!a){n->ack[c]=0;continue;}
            uint8_t ttl=grid_current[up].ackTtl[c],rtt=grid_current[up].ackRtt[c];
            if(ttl<=1){n->bondDist[c>>1]=rtt>1?(uint8_t)(rtt>>1):1;qEvents[14]++;}
            else{n->ack[c]=a;n->ackTtl[c]=ttl-1;n->ackRtt[c]=rtt;}
        }
        for(int c=0;c<QChannels;c++){
            uint32_t h=o->incip[c];
            if(!h)continue;
            n->incip[c]-=h;          /* consumed — new arms this tick survive */
            uint8_t iv=o->incipNu[c];
            uint32_t nu=(iv&0x7f)?(iv&0x7f):1;
            if(iv&0x80){
                /* STIMULATED emission — the resonant offer triggers a
                 * downward transition: ONE clone + a rung shed (the
                 * laser analog — not a deposit). */
                uint32_t shed=site_unwind(x,y,z,si);
                if(shed>=2){
                    uint32_t sn=shed>>1;
                    /* shed>>1 drops half the rung — book to heat,
                     * merge nu into occupied traffic */
                    uint32_t rem2=shed-sn;
                    n->heat=(uint16_t)((n->heat+rem2)>65535?65535:(n->heat+rem2));
                    if(n->packet[c]){
                        uint32_t tot=(uint32_t)n->packetNu[c]*n->packet[c]+sn;
                        n->packetNu[c]=(uint8_t)(tot/(n->packet[c]+1));
                        uint32_t r3=tot-(uint32_t)n->packetNu[c]*(n->packet[c]+1);
                        n->heat=(uint16_t)((n->heat+r3)>65535?65535:(n->heat+r3));
                    } else n->packetNu[c]=(uint8_t)sn;
                    n->packet[c]++;
                    n->packetBorn[c]=(uint8_t)qTick;
                    qEvents[17]++;
                } else {
                    if(n->packet[c]){
                        uint32_t tot=(uint32_t)n->packetNu[c]*n->packet[c]+nu;
                        n->packetNu[c]=(uint8_t)(tot/(n->packet[c]+1));
                        uint32_t r3=tot-(uint32_t)n->packetNu[c]*(n->packet[c]+1);
                        n->heat=(uint16_t)((n->heat+r3)>65535?65535:(n->heat+r3));
                    } else n->packetNu[c]=(uint8_t)nu;
                    n->packet[c]++;
                    n->packetBorn[c]=(uint8_t)qTick;
                }
                continue;
            }
            int arr=c>>1;
            for(uint32_t p=0;p<h;p++){
                uint32_t aA=n->winding[2*arr],bA=n->winding[2*arr+1];
                uint32_t mA=aA<bA?aA:bA;
                if(mA+nu<=qConfirmCap){
                    /* direction-aware deposit: qDirBias (0-256) biases
                     * the pair toward the packet's arrival channel —
                     * the offer carries a direction bit; transducing it
                     * converts linear momentum into circulation.
                     * qDirBias=0 = symmetric (momentum shredder).
                     * qVolShare (0-256): a fraction of the deposit is
                     * answered by the node's whole flow — distributed
                     * to the two most-committed edges (the node's
                     * active axes) rather than the arrival pair. The
                     * bound structure absorbs volumetrically: energy
                     * follows the node's own routing, not just the
                     * arrival channel. */
                    uint32_t share=((uint32_t)nu*qVolShare)>>8;
                    uint32_t cnu=qChainShare?((uint32_t)nu*qChainShare)>>8:0;
                    uint32_t dep=nu-share;   /* cnu is funded by the
                     * rail toll (winding), not carved from dep */
                    /* signed qDirBias: >0 biases toward the travel
                     * direction (c, momentum forward); <0 biases
                     * toward the OFFERER (c^1, the response riding
                     * back upstream — like the ack). */
                    int32_t b=(int32_t)dep*qDirBias;
                    uint32_t bias=(uint32_t)(b<0?-b:b)>>8,half=dep>>1;
                    if(bias>half)bias=half;   /* clamp only — the
                     * split already writes dep total either way;
                     * the excess is phantom fraction, NOT lost
                     * energy (booking it to heat minted +0.03%). */
                    int fwd=qDirBias>=0;
                    n->winding[fwd?c:c^1]+=dep-half+bias;
                    n->winding[fwd?c^1:c]+=half-bias;
                    if(share){
                        int t1=-1,t2=-1;uint32_t m1=0,m2=0;
                        for(int e2=0;e2<QChannels/2;e2++){
                            if(e2==arr)continue;
                            uint32_t m2_=n->winding[2*e2]<n->winding[2*e2+1]
                                       ?n->winding[2*e2]:n->winding[2*e2+1];
                            if(m2_>m1){m2=m1;t2=t1;m1=m2_;t1=e2;}
                            else if(m2_>m2){m2=m2_;t2=e2;}
                        }
                        if(t1>=0){
                            /* direction-following: the share deposits
                             * onto each target edge's DOMINANT member —
                             * it reinforces the local circulation's
                             * sign rather than shredding it. The
                             * volumetric share carries direction,
                             * not just volume. */
                            uint32_t s1=(t2>=0&&m1+m2>0)?(share*m1)/(m1+m2):share;
                            int m_=n->winding[2*t1]>n->winding[2*t1+1]?0:1;
                            n->winding[2*t1+m_]+=s1;
                            if(t2>=0){
                                uint32_t s2=share-s1;
                                int m2_=n->winding[2*t2]>n->winding[2*t2+1]?0:1;
                                n->winding[2*t2+m2_]+=s2;
                            }
                        }
                    }
                    /* offer-chaining (qChainShare): the confirmed
                     * transaction re-offers a share of nu on the node's
                     * dominant-dd channel — the signal hops along the
                     * structure's own rail instead of stopping at the
                     * node. Moving toward an established offer does
                     * more work than forging new structure. */
                    if(cnu){
                        int dch=-1;int32_t dm=0;
                        for(int e2=0;e2<QChannels/2;e2++){
                            int32_t d2=(int)n->winding[2*e2]-(int)n->winding[2*e2+1];
                            if(d2>dm){dm=d2;dch=2*e2;}else if(-d2>dm){dm=-d2;dch=2*e2+1;}
                        }
                        if(dch>=0){
                            /* rail toll: the chained re-offer draws
                             * only the SURPLUS above the pair's
                             * committed floor — the structural bond
                             * (min(a,b)) is protected, the imbalance
                             * margin pays for the re-offer. Riding
                             * the rail costs traffic, not topology. */
                            uint32_t floor_=n->winding[dch]<n->winding[dch^1]
                                          ?n->winding[dch]:n->winding[dch^1];
                            uint32_t surplus=n->winding[dch]>floor_
                                           ?n->winding[dch]-floor_:0;
                            uint32_t toll=(uint32_t)cnu>surplus?surplus:(uint32_t)cnu;
                            if(toll>0){
                                n->winding[dch]-=toll;
                                /* conserve the shared nu register:
                                 * mixing a new packet into occupied
                                 * traffic average-weights nu instead
                                 * of overwriting (count*nu ≈ preserved). */
                                uint32_t tn=toll>127?127:toll;
                                if(n->packet[dch]){
                                    uint32_t tot=(uint32_t)n->packetNu[dch]*n->packet[dch]+tn;
                                    n->packetNu[dch]=(uint8_t)(tot/(n->packet[dch]+1));
                                    uint32_t rem=tot-(uint32_t)n->packetNu[dch]*(n->packet[dch]+1);
                                    n->heat=(uint16_t)((n->heat+rem)>65535?65535:(n->heat+rem));
                                } else n->packetNu[dch]=(uint8_t)tn;
                                n->packet[dch]++;
                                n->packetBorn[dch]=(uint8_t)qTick;
                            }
                        }
                    }
                    /* charge-response — the dominant directed edge
                     * feeds from the absorbed momentum (magnitude-
                     * dependent push). */
                    int de=-1;int32_t dd=0;
                    for(int e2=0;e2<QChannels/2;e2++){
                        int32_t d2=(int)n->winding[2*e2]-(int)n->winding[2*e2+1];
                        if(d2>dd){dd=d2;de=e2;}
                    }
                    if(de>=0){
                        int32_t feed=(dd*nu)>>9;if(feed<0)feed=0;
                        /* conserving: the feed REDIRECTS deposited
                         * energy — taken from the biased arrival
                         * member (src), added to the dominant edge.
                         * The old minted feed was the dimer leak. */
                        int src=fwd?c:c^1;
                        uint32_t f2=(uint32_t)feed>n->winding[src]?n->winding[src]:(uint32_t)feed;
                        n->winding[src]-=f2;
                        n->winding[2*de]+=f2;
                    }
                } else {
                    /* arrival edge full — route internally: dominant
                     * directedness first (circulation axis), else the
                     * freest edge (the corner). */
                    int fe=-1;int32_t dd=0;
                    int rot2=(x+y+z+si)%13;
                    for(int k_=0;k_<QChannels/2;k_++){
                        int e2=(k_+rot2)%13;
                        int32_t d2=(int)n->winding[2*e2]-(int)n->winding[2*e2+1];
                        uint32_t m2=n->winding[2*e2]<n->winding[2*e2+1]?n->winding[2*e2]:n->winding[2*e2+1];
                        if(d2>dd&&m2<128){dd=d2;fe=e2;}
                    }
                    uint32_t fm=999;
                    for(int k_=0;k_<QChannels/2&&fe<0;k_++){
                        int e2=(k_+rot2)%13;
                        uint32_t m2=n->winding[2*e2]<n->winding[2*e2+1]?n->winding[2*e2]:n->winding[2*e2+1];
                        if(m2<128&&m2<fm){fm=m2;fe=e2;}
                    }
                    if(fe<0){
                        int32_t ch=(int32_t)n->charge+(int32_t)nu;
                        n->charge=(int16_t)(ch>32767?32767:ch);
                        continue;
                    }
                    n->winding[2*fe]+=nu;n->winding[2*fe+1]+=nu;
                }
            }
            qEvents[3]+=h;qEvents[16]+=(uint64_t)h*nu;
            /* the ACK returns home: tau = the offer's transit, the
             * ack walks back ttl hops carrying rtt — expiry at the
             * emitter's edge delivers the measured distance. */
            {
                int tau=((int)qTick-(int)o->incipBorn[c])&255;
                if(tau>40)tau=40;
                if(tau<1)tau=1;
                int oc=c^1;
                n->ack[oc]+=1;n->ackTtl[oc]=(uint8_t)tau;
                n->ackRtt[oc]=(uint8_t)(2*tau);
            }
        }
    PROC_NODES_END

    /* Phase 4: winding conduction — the bound state's circulation
     * transferring to neighbors. OVER-PRESSURE ROUTING at 0.1fm:
     * a saturated core shunts excess outward (the interior staying
     * fluid, not crystallizing at 128). Reads current, writes next;
     * cross-node adds are atomic (pull-model refactor is the
     * atomic-free upgrade). */
    PROC_NODES
        NodeState *o=&grid_current[si];
        uint32_t sent[26]={0};   /* per-node outgoing tally — clamps
         * read grid_current−sent, NOT grid_next: incoming pushes from
         * earlier-swept neighbors must not count as sendable, else
         * conduction cascades in sweep order (the +x wind bug). */
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
            /* direction transport (qDdShift): an imbalanced edge's
             * excess pushes along its own channel — the dd the
             * direction-aware deposit wrote rides forward.
             * 0 = off (balanced pairs only, the original rule). */
            if(a!=b){
                int big=a>b?2*e:2*e+1;
                uint32_t ex=a>b?a-b:b-a;
                /* impedance gate: probe the forward neighbor's committed
                 * pair — a bend exists only where straight conduction
                 * meets saturation. No macro-awareness, just refusal. */
                const int8_t *vb=QChannelVec[big];
                int ni=nbr(x,y,z,vb[0],vb[1],vb[2]);
                uint32_t rm=grid_current[ni].winding[2*e]<grid_current[ni].winding[2*e+1]
                          ?grid_current[ni].winding[2*e]:grid_current[ni].winding[2*e+1];
                if(!qDdShift||rm<128){
                    if(qDdShift>=1){
                        uint32_t dk=ex>>qDdShift;
                        uint32_t dav=o->winding[big]-sent[big];
                        if(dk>dav)dk=dav;
                        if(dk){
                            #pragma omp atomic
                            grid_next[ni].winding[big]+=dk;
                            grid_next[si].winding[big]-=dk;
                            sent[big]+=dk;
                        }
                    }
                    continue;
                }
                /* blocked: parallel transport — the projected share
                 * (dot=1 => cos60) rotates onto aligned edges; the
                 * remainder sheds as a packet continuing straight —
                 * curvature costs radiation, the discrete
                 * synchrotron tax. */
                if(qBendShift>=1){
                    for(int e2=0;e2<QChannels/2;e2++){
                        if(e2==e)continue;
                        int d0=vb[0]*QChannelVec[2*e2][0]+vb[1]*QChannelVec[2*e2][1]+vb[2]*QChannelVec[2*e2][2];
                        int d1=vb[0]*QChannelVec[2*e2+1][0]+vb[1]*QChannelVec[2*e2+1][1]+vb[2]*QChannelVec[2*e2+1][2];
                        int t=d0>d1?2*e2:2*e2+1,w=d0>d1?d0:d1;
                        if(w<=0)continue;
                        uint32_t s=(ex*(uint32_t)w)>>qBendShift;
                        uint32_t sav=o->winding[big]-sent[big];
                        if(s>sav)s=sav;
                        if(!s)continue;
                        grid_next[si].winding[t]+=s;
                        grid_next[si].winding[big]-=s;
                        sent[big]+=s;
                    }
                }
                if(qRadShift>=1){
                    uint32_t rad=ex>>qRadShift;
                    uint32_t rav=o->winding[big]-sent[big];
                    if(rad>rav)rad=rav;
                    if(rad){
                        grid_next[si].winding[big]-=rad;
                        sent[big]+=rad;
                        int np=grid_next[si].packet[big]+1;
                        grid_next[si].packet[big]=(uint8_t)(np>255?255:np);
                        int rnu=(int)(rad>255?255:rad);
                        if(rnu>grid_next[si].packetNu[big])
                            grid_next[si].packetNu[big]=(uint8_t)rnu;
                        qEvents[33]+=rad;
                    }
                }
                continue;
            }
            if(a<32)continue;
            uint32_t k=a>>3;
            /* UNDERFLOW GUARD: deductions write grid_next but reads
             * saw grid_current — when several edges drain one node in
             * a tick, next can already be lower than current. Clamp
             * the deduction to what's actually staged (a uint16 wrap
             * to ~65k minted the conduction flood). */
            uint32_t av0=o->winding[2*e]-sent[2*e],av1=o->winding[2*e+1]-sent[2*e+1];
            uint32_t avail=av0<av1?av0:av1;
            if(k>avail)k=avail;
            if(!k)continue;
            sent[2*e]+=k;sent[2*e+1]+=k;
            /* gradient descent: probe BOTH neighbors on the pair's
             * axis and push toward the freer side — the old rule
             * always pushed the + member's direction, a systematic
             * +x/+y/+z flux (the lattice wind). Tie breaks by node
             * hash so equal-freedom axes don't favor +. */
            int niP=nbr(x,y,z,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);
            int niM=nbr(x,y,z,QChannelVec[2*e+1][0],QChannelVec[2*e+1][1],QChannelVec[2*e+1][2]);
            uint32_t mP=grid_current[niP].winding[2*e]<grid_current[niP].winding[2*e+1]
                       ?grid_current[niP].winding[2*e]:grid_current[niP].winding[2*e+1];
            uint32_t mM=grid_current[niM].winding[2*e]<grid_current[niM].winding[2*e+1]
                       ?grid_current[niM].winding[2*e]:grid_current[niM].winding[2*e+1];
            int ni=(mP<mM)?niP:(mP>mM)?niM:(((x+y+z+si)&1)?niP:niM);
            int nx=(x+QChannelVec[ni==niP?2*e:2*e+1][0])&QMaskX,
                ny=(y+QChannelVec[ni==niP?2*e:2*e+1][1])&QMaskY,
                nz=(z+QChannelVec[ni==niP?2*e:2*e+1][2])&QMaskZ;
            uint32_t mn=mP<mM?mP:mM;
            if(mn>=128){
                /* over-pressure shunt — the saturated recipient routes
                 * the excess to its own freest neighbor (the core not
                 * crystallizing, the knot's perimeter draining). */
                int fo=-1;uint32_t fr=128;
                /* rotated scan order — a first-tie-wins loop on a
                 * symmetric knot always picks channel 0 (+x), the
                 * lattice wind. Rotate by node hash so ties break
                 * isotropically across the ensemble. */
                int rot=(x+y+z+si)%13;
                for(int k_=0;k_<QChannels/2;k_++){
                    int e2=(k_+rot)%13;
                    int ni2=nbr(nx,ny,nz,QChannelVec[2*e2][0],QChannelVec[2*e2][1],QChannelVec[2*e2][2]);
                    uint32_t m2=grid_current[ni2].winding[2*e2]<grid_current[ni2].winding[2*e2+1]
                               ?grid_current[ni2].winding[2*e2]:grid_current[ni2].winding[2*e2+1];
                    if(m2<fr){fr=m2;fo=e2;}
                }
                if(fo>=0){
                    int ni3=nbr(nx,ny,nz,QChannelVec[2*fo][0],QChannelVec[2*fo][1],QChannelVec[2*fo][2]);
                    grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                    #pragma omp atomic
                    grid_next[ni3].winding[2*fo]+=k;
                    #pragma omp atomic
                    grid_next[ni3].winding[2*fo+1]+=k;
                    /* charge rides the transfer — routed winding
                     * displaces the node's charge share (the induced-
                     * dipole path: asymmetric routing polarizes). */
                    int32_t cq=(int32_t)grid_next[si].charge>>4;
                    grid_next[si].charge-=cq;
                    #pragma omp atomic
                    grid_next[ni3].charge+=cq;
                }
            } else {
                uint32_t room=128-mn;if(k>room)k=room;
                if(k>=8){
                    grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e]+=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e+1]+=k;
                    /* charge rides the winding transfer */
                    int32_t cq=(int32_t)grid_next[si].charge>>4;
                    grid_next[si].charge-=cq;
                    #pragma omp atomic
                    grid_next[ni].charge+=cq;
                }
            }
        }
    PROC_NODES_END

    /* Phase 5: phase-sync — DECOUPLED at 0.1fm. A fast-pass
     * relaxation (~10 iters) lets the phase field reach equilibrium
     * across a ~10-node bound state before the next mechanical tick.
     * Pull-model: each node averages its neighbors' pull (unique
     * writer — no atomics). Reads next (post-carry), writes next. */
    PROC_NODES
        if(qPhaseSync)phaseA[si]=grid_next[si].phase;
    PROC_NODES_END
    for(int iter=0;iter<10&&qPhaseSync;iter++){
        PROC_NODES
            if(node_live(&grid_next[si])){
                int32_t pull=0;
                uint32_t ph=phaseA[si];
                for(int c=0;c<QChannels;c++){
                    int ni=nbr(x,y,z,QChannelVec[c][0],QChannelVec[c][1],QChannelVec[c][2]);
                    int dp=(int)phaseA[ni]-(int)ph;
                    if(dp>255)dp-=511;
                    if(dp<-255)dp+=511;
                    pull+=dp>>4;
                }
                phaseB[si]=(uint32_t)((int)ph+pull)&511;
            } else phaseB[si]=phaseA[si];
        PROC_NODES_END
        uint32_t *t=phaseA;phaseA=phaseB;phaseB=t;
    }
    PROC_NODES
        if(qPhaseSync)grid_next[si].phase=phaseA[si];
    PROC_NODES_END

    /* Phase 6: emission — the bound state radiates. A site at level
     * n>=2 stochastically sheds one rung of its weakest committed
     * edge into a packet. The packet needs a channel mode with room
     * (graded Pauli — refusal scales with occupancy) and escapes
     * only if the local density lets it (dense media stall the decay
     * product — the measured neighborhood IS the pressure). */
    PROC_NODES
        NodeState *o=&grid_current[si];
        if(site_level(o)<2)continue;
        if(rand_site(si,1)&3)continue;         /* excited-state lifetime */
        int line=geo_gap(&grid_next[si]);     /* the gap gates emission */
        if(line<1)continue;
        /* channel occupancy — graded refusal: P(accept)=1-occ/128,
         * up to 4 tries on different modes. A saturated directional
         * mode refuses — the geometric Pauli analog. */
        int c=-1;
        /* bond preference: if exactly one edge has a measured reach
         * (an ACK-delivered bond), emit along it — the transaction's
         * channel is the established bond, not a random direction. */
        int nb=0,blive=-1;
        for(int ed=3;ed<=8;ed++)     /* edge pairs only — a face/corner
         * bond emission would freeze the packet in a dead channel */
            if(o->bondDist[ed]){nb++;blive=ed;}
        /* chiral emission: prefer the dominant-dd channel — the
         * packet leaves along the lump's circulation (dipole
         * emission, meso3i's drbest_). Falls back through bond,
         * then random. */
        int dch=-1;{int32_t dm=0;
            for(int e2=0;e2<QChannels/2;e2++){
                int32_t d2=(int)o->winding[2*e2]-(int)o->winding[2*e2+1];
                if(d2>dm){dm=d2;dch=2*e2;}else if(-d2>dm){dm=-d2;dch=2*e2+1;}
            }}
        for(int try_=0;try_<4;try_++){
            int tc=(try_==0&&nb==1)?(blive<<1)|(rand_site(si,11)&1)
                 :(try_==0&&dch>=0)?dch
                 :6+rand_site(si,2+try_)%12;   /* edge channels only */
            uint32_t occ=grid_next[si].packet[tc];
            if(occ<128&&(rand_site(si,6+try_)&127)>=(int)occ){c=tc;break;}
        }
        if(c<0){qEvents[31]++;continue;}       /* modes refuse — stable */
        /* density refusal — the measured neighborhood structure is
         * the pressure: sparse vacuum lets emission escape, dense
         * media stall it. Context-stable, no global switch. */
        int live=0;
        for(int cc=0;cc<QChannels;cc++){
            int ni=nbr(x,y,z,QChannelVec[cc][0],QChannelVec[cc][1],QChannelVec[cc][2]);
            if(node_live(&grid_current[ni]))live++;
        }
        /* unified 0-255 density scale — same field Phase 1 writes */
        uint32_t dens=live*255/QChannels;
        grid_next[si].localDensity=(uint16_t)dens;
        if(dens&&(rand_site(si,10)&255)<(int)dens){qEvents[28]++;continue;}
        /* species-inverse: a composite's shed condenses to mass
         * instead of radiating, until the mass:bond ratio equilibrates
         * — the closed cycle where structure and mass hold each
         * other. A bare (massless) site still radiates a packet. */
        /* SPECIES-INVERSE, conserved: the shed winding condenses to
         * mass — mass += da+db exactly what the edges lost (the
         * mass:bond ratio equilibrating, no minted energy). A bare
         * (massless) site still radiates a packet instead. */
        if(o->mass>0&&(uint64_t)o->mass*8<loop_winding(o)){
            uint32_t shed=site_unwind(x,y,z,si);
            if(!shed)continue;
            uint32_t m=grid_next[si].mass+shed;
            grid_next[si].mass=(uint16_t)(m>65535?65535:m);
            qEvents[29]++;
            continue;
        }
        if(!IS_EVEN(x,y,z))continue;   /* packets are born only on the
         * transport graph — odd cells hold structure; their unwound
         * energy stays wound (conserved, not minted). */
        /* CONSERVING emission: the packet's nu IS half the shed
         * (per-side) — recapture deposits nu per channel, restoring
         * exactly da+db total (net zero), while escape or
         * thermalization makes the emission real radiation. */
        uint32_t shed=site_unwind(x,y,z,si);
        if(shed<2)continue;
        /* resonant emission (qResEmit): the packet carries the
         * site's own line frequency — emitted at the structure's
         * characteristic nu so recycled quanta are always in-band
         * for reabsorption (the spectral-line closure). */
        uint32_t enu=qResEmit?(uint32_t)line:(shed>>1);
        uint32_t pn=enu>255?255:enu<1?1:enu;
        /* conserving: the rung sheds 'shed' total — the packet
         * carries pn, the remainder dissipates as friction heat.
         * (shed>>1 alone lost half of every emission.) */
        if(shed>pn){uint32_t r=shed-pn;
            grid_next[si].heat=(uint16_t)((grid_next[si].heat+r)>65535?65535:(grid_next[si].heat+r));}
        /* conserve the shared nu register — average-weight instead
         * of overwriting when the channel already holds packets */
        if(grid_next[si].packet[c]){
            uint32_t tot=(uint32_t)grid_next[si].packetNu[c]*grid_next[si].packet[c]+pn;
            grid_next[si].packetNu[c]=(uint8_t)(tot/(grid_next[si].packet[c]+1));
            uint32_t rem=tot-(uint32_t)grid_next[si].packetNu[c]*(grid_next[si].packet[c]+1);
            grid_next[si].heat=(uint16_t)((grid_next[si].heat+rem)>65535?65535:(grid_next[si].heat+rem));
        } else grid_next[si].packetNu[c]=(uint8_t)pn;
        grid_next[si].packet[c]++;
        grid_next[si].packetBorn[c]=(uint8_t)qTick;
        qEvents[4]++;qEvents[20]+=shed;
    PROC_NODES_END

    /* Phase 7: macroscopic string-breaking — forward-trace the
     * continuous >128 saturated tube, fracture only when the
     * INTEGRATED tension (the tube's length) exceeds the macro-
     * threshold, then pair-produce at the 2 endpoints. Not a
     * single-link saturation — the whole tube's tension. */
    PROC_NODES
        for(int e=3;e<=8;e++){   /* edge pairs only — faces/corners
         * are dead registers under FCC; pair production on them
         * would freeze the recoiling mass. */
            uint32_t a=grid_current[si].winding[2*e],b=grid_current[si].winding[2*e+1];
            if(a<128||a!=b)continue;
            /* only the tube HEAD fires — the upstream neighbor must be
             * unsaturated (else every node of the same tube fractures
             * simultaneously, minting endpoint mass per node). */
            int un=nbr(x,y,z,-QChannelVec[2*e][0],-QChannelVec[2*e][1],-QChannelVec[2*e][2]);
            uint32_t ua=grid_current[un].winding[2*e],ub=grid_current[un].winding[2*e+1];
            if(ua>=128&&ua==ub)continue;
            int len=0;
            for(int step=0;step<16;step++){
                int tni=nbr(x,y,z,QChannelVec[2*e][0]*step,QChannelVec[2*e][1]*step,QChannelVec[2*e][2]*step);
                uint32_t na=grid_current[tni].winding[2*e],nb=grid_current[tni].winding[2*e+1];
                if(na>=128&&na==nb)len++;else break;
            }
            if(len>=12){
                /* macro-tension — the whole tube saturated: fracture,
                 * pair-produce mass at the two endpoints, and RECOIL-
                 * launch them apart along the tube axis. CONSERVED:
                 * the endpoint mass + recoil flight equals the winding
                 * actually drained — no minted energy. */
                int p2=nbr(x,y,z,QChannelVec[2*e][0]*(len-1),QChannelVec[2*e][1]*(len-1),QChannelVec[2*e][2]*(len-1));
                uint32_t totalDrain=0;
                for(int s=0;s<len;s++){
                    int tni=nbr(x,y,z,QChannelVec[2*e][0]*s,QChannelVec[2*e][1]*s,QChannelVec[2*e][2]*s);
                    uint32_t d0=grid_next[tni].winding[2*e]<64?grid_next[tni].winding[2*e]:64;
                    uint32_t d1=grid_next[tni].winding[2*e+1]<64?grid_next[tni].winding[2*e+1]:64;
                    #pragma omp atomic
                    grid_next[tni].winding[2*e]-=d0;
                    #pragma omp atomic
                    grid_next[tni].winding[2*e+1]-=d1;
                    totalDrain+=d0+d1;
                }
                if(totalDrain>128){
                    uint32_t endMass=(totalDrain-128)/2;
                    uint32_t m0=grid_next[si].mass+endMass,m1=grid_next[p2].mass+endMass;
                    #pragma omp atomic write
                    grid_next[si].mass=(uint16_t)(m0>65535?65535:m0);
                    #pragma omp atomic write
                    grid_next[p2].mass=(uint16_t)(m1>65535?65535:m1);
                    /* flight quanta only on the even sublattice —
                     * edge hops preserve parity so p2 shares si's
                     * parity; odd endpoints park mass without recoil */
                    if(IS_EVEN(x,y,z)){
                    #pragma omp atomic
                    grid_next[si].massFlight[2*e+1]+=64;   /* head recoils back */
                    #pragma omp atomic
                    grid_next[p2].massFlight[2*e]+=64;     /* tail recoils forward */
                    /* and the broken pair carries opposite charge —
                     * the tube's meson -> q + qbar signature. */
                    #pragma omp atomic
                    grid_next[si].chargeFlight[2*e+1]+=8;
                    #pragma omp atomic
                    grid_next[p2].chargeFlight[2*e]-=8;
                    }
                    qEvents[6]++;
                }
            }
        }
    PROC_NODES_END

    rescan_live();
    {NodeState *t=grid_current;grid_current=grid_next;grid_next=t;}
}

/* getters/setters for the harnesses — the AoS node's state. Setters
 * mark their chunk live so seeded content is processed next tick. */
uint32_t moore26_winding_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c];
}
void moore26_winding_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].winding[c]=v;
    grid_next[z*QWidth*QHeight+y*QWidth+x].winding[c]=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_packet_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].packet[c];
}
void moore26_packet_set(int x,int y,int z,int c,uint32_t v){
    if(!IS_EVEN(x,y,z))return;   /* odd sublattice is not for use —
     * quanta setters silently refuse interstitial cells */
    grid_current[z*QWidth*QHeight+y*QWidth+x].packet[c]=v;
    grid_current[z*QWidth*QHeight+y*QWidth+x].packetBorn[c]=(uint8_t)qTick;
    mark_chunk(x,y,z);
}
void moore26_packet_nu_set(int x,int y,int z,int c,uint32_t v){
    if(!IS_EVEN(x,y,z))return;
    grid_current[z*QWidth*QHeight+y*QWidth+x].packetNu[c]=v;
}
uint32_t moore26_packet_nu_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].packetNu[c];
}
void moore26_mass_set(int x,int y,int z,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].mass=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_mass_get(int x,int y,int z){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].mass;
}
uint16_t moore26_heat_get(int x,int y,int z){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].heat;
}
void moore26_massflight_set(int x,int y,int z,int c,uint32_t v){
    if(!IS_EVEN(x,y,z))return;
    grid_current[z*QWidth*QHeight+y*QWidth+x].massFlight[c]=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_massflight_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].massFlight[c];
}
uint64_t moore26_events(int i){return (i>=0&&i<48)?qEvents[i]:0;}
void moore26_phase_set(int x,int y,int z,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].phase=v&511;
    mark_chunk(x,y,z);
}
uint32_t moore26_phase_get(int x,int y,int z){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].phase;
}
int32_t moore26_charge_get(int x,int y,int z){
    return (int32_t)grid_current[z*QWidth*QHeight+y*QWidth+x].charge;
}
int32_t moore26_cvc(int c,int i){return QChannelVec[c][i];}

/* ---- visualizer surface (Cascade) ----
 * rg_refresh packs the four physics layers into an RGBA8 buffer the
 * JS side uploads straight to a 3D texture:
 *   R = structure (dominant winding, boosted at mass sites)
 *   G = phase (the Jacobi wake, 0-511 -> 0-255)
 *   B = heat   (the thermal sink)
 *   A = charge (signed, biased +127 — the polarization layer) */
uint32_t moore26_rg_pointer(void){return (uint32_t)(uintptr_t)rgBuf;}
void moore26_rg_refresh(void){
    const int ns=QWidth*QHeight*QDepth;
    if(!rgBuf)rgBuf=(uint8_t*)malloc((size_t)ns*4);
    for(int i=0;i<ns;i++){
        NodeState *n=&grid_current[i];
        uint8_t mx=0;
        for(int c=0;c<QChannels;c++)if(n->winding[c]>mx)mx=n->winding[c];
        uint8_t r=n->mass?(n->mass>128?255:(uint8_t)(n->mass<<1)):mx;
        rgBuf[4*i+0]=r;
        rgBuf[4*i+1]=(uint8_t)(n->phase>>1);
        rgBuf[4*i+2]=(uint8_t)(n->heat>255?255:n->heat);
        int32_t ch=((int32_t)n->charge+32767)>>8;
        rgBuf[4*i+3]=(uint8_t)(ch>255?255:ch<0?0:ch);
    }
}
void moore26_clear(void){
    memset(grid_current,0,(size_t)QWidth*QHeight*QDepth*sizeof(NodeState));
    qTick=0;
}
uint32_t moore26_save(void){
    const size_t sz=(size_t)QWidth*QHeight*QDepth*sizeof(NodeState);
    if(!saveBuf)saveBuf=(NodeState*)malloc(sz);
    memcpy(saveBuf,grid_current,sz);
    return 0;
}
uint32_t moore26_restore(void){
    if(!saveBuf)return 1;
    memcpy(grid_current,saveBuf,(size_t)QWidth*QHeight*QDepth*sizeof(NodeState));
    return 0;
}
/* bulk telemetry — a C-side sum is far cheaper than a JS sweep */
uint64_t moore26_sum(int what){
    const int ns=QWidth*QHeight*QDepth;
    uint64_t t=0;
    for(int i=0;i<ns;i++){
        NodeState *n=&grid_current[i];
        switch(what){
            case 0:t+=n->mass;break;
            case 1:for(int c=0;c<QChannels;c++)t+=n->winding[c];break;
            case 2:for(int c=0;c<QChannels;c++)t+=n->packet[c];break;
            case 3:t+=n->heat;break;
            case 4:t+=n->charge<0?-(int32_t)n->charge:n->charge;break;
            case 5:for(int c=0;c<QChannels;c++)t+=n->incip[c]*(n->incipNu[c]&127);break;
            case 6:for(int c=0;c<QChannels;c++)t+=n->massFlight[c];break;
            case 7:for(int c=0;c<QChannels;c++)t+=n->chargeFlight[c]<0?-(int32_t)n->chargeFlight[c]:n->chargeFlight[c];break;
            case 8:for(int c=0;c<QChannels;c++)t+=n->packet[c]*n->packetNu[c];break;
        }
    }
    return t;
}
/* center of mass in fixed-point (x<<8) for the HUD core readout */
uint32_t moore26_cm(int axis){
    const int ns=QWidth*QHeight*QDepth;
    uint64_t m=0,s=0;
    for(int i=0;i<ns;i++){
        uint32_t mi=grid_current[i].mass;
        if(!mi)continue;
        int v=axis==0?i%QWidth:axis==1?(i/QWidth)%QHeight:i/(QWidth*QHeight);
        m+=mi;s+=(uint64_t)v*mi;
    }
    return m?(uint32_t)((s<<8)/m):0;
}
/* bulk-read support for wasm harnesses: the flat NodeState array —
 * JS strides it by moore26_node_size() to render the grid state. */
void *moore26_state_pointer(void){return grid_current;}
int moore26_node_size(void){return (int)sizeof(NodeState);}
int moore26_channel_count(void){return QChannels;}
void moore26_fusion_wall_set(int v){qFusionWall=v;}
void moore26_commit_min_set(int v){qCommitMin=v;}
void moore26_ground_floor_set(int v){qGroundFloor=v;}
void moore26_confirm_cap_set(int v){qConfirmCap=v;}
void moore26_catch_gate_set(int v){qCatchGate=v>0?v:16;}
void moore26_dir_bias_set(int v){qDirBias=v;}
void moore26_deflect_align_set(int v){qDeflectAlign=v;}
void moore26_dd_shift_set(int v){qDdShift=v;}
void moore26_bend_shift_set(int v){qBendShift=v;}
void moore26_rad_shift_set(int v){qRadShift=v;}
int32_t moore26_chargeflight_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].chargeFlight[c];
}
void moore26_phase_gate_set(int v){qPhaseGate=v;}
void moore26_phase_sync_set(int v){qPhaseSync=v;}
void moore26_vol_share_set(int v){qVolShare=v;}
void moore26_chain_share_set(int v){qChainShare=v;}
void moore26_res_emit_set(int v){qResEmit=v;}
