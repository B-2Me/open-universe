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
 * ledger marks chunks holding any mass/winding/photons; each tick
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
#include <omp.h>
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
    uint8_t  photon[26];       /* packet counts (the offers) */
    uint8_t  photonNu[26];     /* packet nu tags (the energy) */
    uint8_t  incip[26];        /* armed incipients per channel (negotiations) */
    uint8_t  incipNu[26];      /* each incipient's nu (the offered energy) */
    uint32_t phase;            /* bound-state phase 0-511 (double-cover) */
    uint16_t mass;             /* parked mass (the structure) */
    uint16_t charge;           /* bound charge (the completed-transaction deposits) */
    uint16_t heat;             /* vacuum heat reservoir (the local temp) */
    uint16_t localDensity;     /* neighbor-sampled density (the gradient) */
} NodeState;
static NodeState *grid_current, *grid_next;

/* vacuum-skip ledgers — 8x8x8 macro-chunks */
#define CHUNK 8
static int CW,CH,CD,nChunks;
static uint8_t *chunkLive, *chunkProc;
static int *procList, nProc;

static uint64_t qEvents[32];
static uint64_t qTick;
static int qFusionWall=256;   /* pair-production energy threshold —
     * nua+nub must clear it (each photon above ~mc2, not a crowd
     * of weak ones) */
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
        if(n->winding[c]||n->photon[c])return 1;
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
        if(m>=32)vol+=m;
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
        if(m>=32&&(be<0||m<bm)){bm=m;be=e;}
    }
    if(be<0)return 0;
    uint64_t L2=edgeLen2(2*be);
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
        if(m<32)continue;
        int32_t dd=(int32_t)a-(int32_t)b;if(dd<0)dd=-dd;
        if(dd>=32){
            int big=a>b?2*e:2*e+1;
            int ni=nbr(x,y,z,QChannelVec[big][0],QChannelVec[big][1],QChannelVec[big][2]);
            int rc=(big&1)?big-1:big+1;
            uint32_t ra=grid_current[ni].winding[rc],rb=grid_current[ni].winding[big];
            if(ra>rb&&ra-rb>=32)continue;      /* reciprocal: closed */
        }
        if(be<0||m<bm){bm=m;be=e;}
    }
    if(be<0)return 0;
    uint32_t tv=0;
    for(int e=0;e<QChannels/2;e++){
        uint32_t m2=n->winding[2*e]<n->winding[2*e+1]?n->winding[2*e]:n->winding[2*e+1];
        if(m2>=32)tv+=m2;
    }
    if(tv<=512)return 0;                       /* ground-state floor */
    uint32_t a=n->winding[2*be],b=n->winding[2*be+1];
    uint32_t m=a<b?a:b;
    uint32_t rung=(m-1)>>2;
    uint32_t next=rung<<2;
    if(next>=m)next=(rung-1)<<2;
    uint32_t shed=m-next;if(shed<1)shed=1;
    uint32_t da=a>shed?shed:a, db=b>shed?shed:b;
    n->winding[2*be]-=da;n->winding[2*be+1]-=db;
    return da+db;   /* the TOTAL shed — the conserved token (photon
                     * nu and mass condensation both account it) */
}

void moore26_init(int w,int h,int d){
    /* power-of-2 dims required for the bitwise-mask wrap; each dim
     * must be >= 8 so the chunk grid is also power-of-2. */
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
    chunkLive   =calloc(nChunks,1);
    chunkProc   =calloc(nChunks,1);
    procList    =malloc(nChunks*sizeof(int));
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

    /* Phase 1: packet flight — photons hop 1 node/tick along their
     * channel direction (c at transit scale). PULL-MODEL: each node
     * reads its upstream neighbor's channel (unique writer per slot —
     * no send/receive race). Arriving flux DECAYS into heat at the
     * destination's density: opaque media thermalize photons, sparse
     * vacuum passes them — the field's thermalization sink (qi3's
     * vacuum-absorption opacity). */
    PROC_NODES
        NodeState *o=&grid_current[si];
        /* gather upstream arrivals first — only nodes receiving flux
         * pay the 26-neighbor opacity scan (halo vacuum skips it). */
        uint32_t v[26],nu[26];int anyp=0;
        for(int c=0;c<QChannels;c++){
            int up=nbr(x,y,z,-QChannelVec[c][0],-QChannelVec[c][1],-QChannelVec[c][2]);
            v[c]=grid_current[up].photon[c];
            nu[c]=grid_current[up].photonNu[c];
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
            if(!v[c]){grid_next[si].photon[c]=0;continue;}
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
            grid_next[si].photon[c]=(uint8_t)(r>255?255:r);
            grid_next[si].photonNu[c]=(uint8_t)nuv;
        }
        /* local heat drain — the reservoir cools into the sub-grid
         * depth (per-node state, NOT a global bath): each node's
         * stored energy bleeds ~1/128 per tick into the coarse-
         * grained internals below the node scale. */
        if(grid_next[si].heat)grid_next[si].heat-=grid_next[si].heat>>7;
    PROC_NODES_END

    /* Phase 1b: mass stream + junction collide — in-flight mass
     * pulls along its channel (unique writer per slot). Opposing
     * arrivals annihilate AT the meeting node (matter/antimatter ->
     * back-to-back photons + charge residue); survivors PARK into
     * the node's mass — the knot's anchor shifting forward. */
    PROC_NODES
        uint32_t in[26];
        for(int c=0;c<QChannels;c++){
            int up=nbr(x,y,z,-QChannelVec[c][0],-QChannelVec[c][1],-QChannelVec[c][2]);
            in[c]=grid_current[up].massFlight[c];
            grid_next[si].massFlight[c]=0;
        }
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=in[2*e],b=in[2*e+1];
            uint32_t hit=a<b?a:b;
            if(hit){
                in[2*e]-=hit;in[2*e+1]-=hit;
                uint32_t nu=grid_current[si].mass>4?grid_current[si].mass>>2:64;
                uint32_t r0=255-grid_next[si].photon[2*e],r1=255-grid_next[si].photon[2*e+1];
                grid_next[si].photon[2*e]  +=hit<r0?hit:r0;
                grid_next[si].photon[2*e+1]+=hit<r1?hit:r1;
                grid_next[si].photonNu[2*e]=nu;
                grid_next[si].photonNu[2*e+1]=nu;
                uint32_t ch=grid_next[si].charge+hit;
                grid_next[si].charge=(uint16_t)(ch>65535?65535:ch);
                qEvents[0]+=hit*2;qEvents[9]+=hit;
            }
            uint32_t pk=in[2*e]+in[2*e+1];
            if(pk){
                uint32_t m=grid_next[si].mass+pk;
                grid_next[si].mass=(uint16_t)(m>65535?65535:m);
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
            int de=-1;int32_t dd=0;
            for(int e=0;e<QChannels/2;e++){
                int32_t d=(int)o->winding[2*e]-(int)o->winding[2*e+1];
                if(d>dd){dd=d;de=e;}
            }
            if(de<0||dd<32)continue;
            uint32_t k=o->mass>>4;
            uint32_t k2=(uint32_t)dd>>2;
            if(k>k2)k=k2;
            if(!k)continue;
            grid_next[si].mass-=k;
            uint32_t f=grid_next[si].massFlight[2*de]+k;
            grid_next[si].massFlight[2*de]=(uint16_t)(f>65535?65535:f);
        PROC_NODES_END
    }

    /* Phase 2: OFFER — arrived packets arm incipient transactions.
     * A photon on channel c offers to the node; passing the catch
     * gate (bare vacuum ~1/16, deeper structure catches more) and
     * the edge-local match (the channel's own absorption line), it
     * arms an incipient and leaves the stream. The node can hold at
     * most 13 concurrent negotiations — a saturated node DECLINES:
     * the offer scatters to the freest channel (the hard-core
     * bounce — deflection, not absorption). */
    PROC_NODES
        NodeState *n=&grid_next[si],*o=&grid_current[si];
        /* PAIR PRODUCTION (photon+photon -> mass): bare nodes only —
         * opposing arrivals on the same axis fuse when their combined
         * nu clears the fusion wall. The residue crystallizes as
         * mass+charge and LAUNCHES apart on the arrival channels
         * (momentum conservation — gamma+gamma -> e+e- flies, not a
         * static pile). Radiation recombining into knots: the
         * universe regenerates, not only degrades. */
        if(!n->mass){
            for(int c=0;c<QChannels;c++){
                int oc=c^1;
                uint32_t a=n->photon[c],b=n->photon[oc];
                if(!a||!b)continue;
                uint32_t nua=n->photonNu[c]?n->photonNu[c]:1;
                uint32_t nub=n->photonNu[oc]?n->photonNu[oc]:1;
                if(nua+nub<(uint32_t)qFusionWall)continue;
                uint32_t pair=a<b?a:b;
                n->photon[c]-=pair;n->photon[oc]-=pair;
                uint64_t dep=(uint64_t)pair*(nua+nub);
                uint32_t m=n->mass+(uint32_t)(dep>>5);
                n->mass=(uint16_t)(m>65535?65535:m);
                uint32_t ch=n->charge+(uint32_t)(dep>>3);
                n->charge=(uint16_t)(ch>65535?65535:ch);
                uint32_t f0=n->massFlight[c]+pair,f1=n->massFlight[oc]+pair;
                n->massFlight[c]=(uint16_t)(f0>65535?65535:f0);
                n->massFlight[oc]=(uint16_t)(f1>65535?65535:f1);
                n->winding[c]+=pair>>2;          /* residual wound */
                n->winding[oc]+=pair>>2;
                qEvents[23]+=pair;
            }
        }
        int lvl=site_level(o);if(lvl<1)lvl=1;
        for(int c=0;c<QChannels;c++){
            if(!n->photon[c])continue;
            if((rand_site(si,20+c)&15)>=lvl)continue;     /* catch gate */
            uint32_t nu=n->photonNu[c]?n->photonNu[c]:1;
            int line=((int)o->mass+((int)o->winding[c]>>2))>>2;
            if(line<1)line=1;
            if(nu%(uint32_t)line!=0||nu<(uint32_t)line)continue; /* off-band: flies on */
            int armed=0;
            for(int cc=0;cc<QChannels;cc++)armed+=n->incip[cc];
            if(armed>=13){
                /* DECLINED — deflect to the freest channel: the photon
                 * bounces off the dense field to find another target
                 * rather than stacking inside it. */
                int fc=0;uint32_t fo=255;
                for(int j=1;j<QChannels;j++){
                    int c2=(c+j)%QChannels;
                    if(n->photon[c2]<fo){fo=n->photon[c2];fc=c2;}
                }
                n->photon[fc]++;
                n->photonNu[fc]=(uint8_t)nu;
                n->photon[c]--;
                qEvents[30]++;
                continue;
            }
            n->incip[c]++;n->incipNu[c]=(uint8_t)(nu>255?255:nu);
            n->photon[c]--;
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
        for(int c=0;c<QChannels;c++){
            uint32_t h=o->incip[c];
            if(!h)continue;
            n->incip[c]-=h;          /* consumed — new arms this tick survive */
            uint32_t nu=o->incipNu[c]?o->incipNu[c]:1;
            int arr=c>>1;
            for(uint32_t p=0;p<h;p++){
                uint32_t aA=n->winding[2*arr],bA=n->winding[2*arr+1];
                uint32_t mA=aA<bA?aA:bA;
                if(mA+nu<=160){
                    n->winding[2*arr]+=nu;n->winding[2*arr+1]+=nu;
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
                        n->winding[2*de]+=(uint32_t)feed;
                    }
                } else {
                    /* arrival edge full — route internally: dominant
                     * directedness first (circulation axis), else the
                     * freest edge (the corner). */
                    int fe=-1;int32_t dd=0;
                    for(int e2=0;e2<QChannels/2;e2++){
                        int32_t d2=(int)n->winding[2*e2]-(int)n->winding[2*e2+1];
                        uint32_t m2=n->winding[2*e2]<n->winding[2*e2+1]?n->winding[2*e2]:n->winding[2*e2+1];
                        if(d2>dd&&m2<128){dd=d2;fe=e2;}
                    }
                    uint32_t fm=999;
                    for(int e2=0;e2<QChannels/2&&fe<0;e2++){
                        uint32_t m2=n->winding[2*e2]<n->winding[2*e2+1]?n->winding[2*e2]:n->winding[2*e2+1];
                        if(m2<128&&m2<fm){fm=m2;fe=e2;}
                    }
                    if(fe<0){n->charge+=(uint16_t)(nu>65535?65535:nu);continue;}
                    n->winding[2*fe]+=nu;n->winding[2*fe+1]+=nu;
                }
            }
            qEvents[3]+=h;qEvents[16]+=(uint64_t)h*nu;
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
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=o->winding[2*e],b=o->winding[2*e+1];
            if(a<32||a!=b)continue;
            uint32_t k=a>>3;
            int ni=nbr(x,y,z,QChannelVec[2*e][0],QChannelVec[2*e][1],QChannelVec[2*e][2]);
            int nx=(x+QChannelVec[2*e][0])&QMaskX,ny=(y+QChannelVec[2*e][1])&QMaskY,nz=(z+QChannelVec[2*e][2])&QMaskZ;
            uint32_t mn=grid_current[ni].winding[2*e]<grid_current[ni].winding[2*e+1]
                       ?grid_current[ni].winding[2*e]:grid_current[ni].winding[2*e+1];
            if(mn>=128){
                /* over-pressure shunt — the saturated recipient routes
                 * the excess to its own freest neighbor (the core not
                 * crystallizing, the knot's perimeter draining). */
                int fo=-1;uint32_t fr=128;
                for(int e2=0;e2<QChannels/2;e2++){
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
                }
            } else {
                uint32_t room=128-mn;if(k>room)k=room;
                if(k>=8){
                    grid_next[si].winding[2*e]-=k;grid_next[si].winding[2*e+1]-=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e]+=k;
                    #pragma omp atomic
                    grid_next[ni].winding[2*e+1]+=k;
                }
            }
        }
    PROC_NODES_END

    /* Phase 5: phase-sync — DECOUPLED at 0.1fm. A fast-pass
     * relaxation (~10 iters) lets the phase field reach equilibrium
     * across a ~10-node bound state before the next mechanical tick.
     * Pull-model: each node averages its neighbors' pull (unique
     * writer — no atomics). Reads next (post-carry), writes next. */
    for(int iter=0;iter<10;iter++){
        PROC_NODES
            if(node_live(&grid_next[si])){
                int32_t pull=0;
                uint32_t ph=grid_next[si].phase;
                for(int c=0;c<QChannels;c++){
                    int ni=nbr(x,y,z,QChannelVec[c][0],QChannelVec[c][1],QChannelVec[c][2]);
                    int dp=(int)grid_next[ni].phase-(int)ph;
                    if(dp>255)dp-=511;
                    if(dp<-255)dp+=511;
                    pull+=dp>>4;
                }
                grid_next[si].phase=(uint32_t)((int)ph+pull)&511;
            }
        PROC_NODES_END
    }

    /* Phase 6: emission — the bound state radiates. A site at level
     * n>=2 stochastically sheds one rung of its weakest committed
     * edge into a photon. The photon needs a channel mode with room
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
        for(int try_=0;try_<4;try_++){
            int tc=rand_site(si,2+try_)%QChannels;
            uint32_t occ=grid_next[si].photon[tc];
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
        uint32_t dens=live*64/QChannels;
        grid_next[si].localDensity=(uint16_t)(dens*4);
        if(dens&&(rand_site(si,10)&63)<(int)dens){qEvents[28]++;continue;}
        /* species-inverse: a composite's shed condenses to mass
         * instead of radiating, until the mass:bond ratio equilibrates
         * — the closed cycle where structure and mass hold each
         * other. A bare (massless) site still radiates a photon. */
        /* SPECIES-INVERSE, conserved: the shed winding condenses to
         * mass — mass += da+db exactly what the edges lost (the
         * mass:bond ratio equilibrating, no minted energy). A bare
         * (massless) site still radiates a photon instead. */
        if(o->mass>0&&(uint64_t)o->mass*8<loop_winding(o)){
            uint32_t shed=site_unwind(x,y,z,si);
            if(!shed)continue;
            uint32_t m=grid_next[si].mass+shed;
            grid_next[si].mass=(uint16_t)(m>65535?65535:m);
            qEvents[29]++;
            continue;
        }
        /* CONSERVING emission: the photon's nu IS half the shed
         * (per-side) — recapture deposits nu per channel, restoring
         * exactly da+db total (net zero), while escape or
         * thermalization makes the emission real radiation. */
        uint32_t shed=site_unwind(x,y,z,si);
        if(shed<2)continue;
        grid_next[si].photon[c]++;
        grid_next[si].photonNu[c]=(uint8_t)((shed>>1)>255?255:(shed>>1));
        qEvents[4]++;qEvents[20]+=shed;
    PROC_NODES_END

    /* Phase 7: macroscopic string-breaking — forward-trace the
     * continuous >128 saturated tube, fracture only when the
     * INTEGRATED tension (the tube's length) exceeds the macro-
     * threshold, then pair-produce at the 2 endpoints. Not a
     * single-link saturation — the whole tube's tension. */
    PROC_NODES
        for(int e=0;e<QChannels/2;e++){
            uint32_t a=grid_current[si].winding[2*e],b=grid_current[si].winding[2*e+1];
            if(a<128||a!=b)continue;
            int len=0,nx=x,ny=y,nz=z;
            for(int step=0;step<16;step++){
                int tni=nbr(nx,ny,nz,QChannelVec[2*e][0]*step,QChannelVec[2*e][1]*step,QChannelVec[2*e][2]*step);
                uint32_t na=grid_current[tni].winding[2*e],nb=grid_current[tni].winding[2*e+1];
                if(na>=128&&na==nb)len++;else break;
            }
            if(len>=12){
                /* macro-tension — the whole tube saturated: fracture,
                 * pair-produce mass at the two endpoints. */
                int p2=nbr(x,y,z,QChannelVec[2*e][0]*(len-1),QChannelVec[2*e][1]*(len-1),QChannelVec[2*e][2]*(len-1));
                #pragma omp atomic
                grid_next[si].mass+=128;
                #pragma omp atomic
                grid_next[p2].mass+=128;
                for(int s=0;s<len;s++){
                    int tni=nbr(x,y,z,QChannelVec[2*e][0]*s,QChannelVec[2*e][1]*s,QChannelVec[2*e][2]*s);
                    #pragma omp atomic
                    grid_next[tni].winding[2*e]-=64;
                    #pragma omp atomic
                    grid_next[tni].winding[2*e+1]-=64;
                }
                qEvents[6]++;
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
uint32_t moore26_photon_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c];
}
void moore26_photon_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photon[c]=v;
    mark_chunk(x,y,z);
}
void moore26_photon_nu_set(int x,int y,int z,int c,uint32_t v){
    grid_current[z*QWidth*QHeight+y*QWidth+x].photonNu[c]=v;
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
    grid_current[z*QWidth*QHeight+y*QWidth+x].massFlight[c]=v;
    mark_chunk(x,y,z);
}
uint32_t moore26_massflight_get(int x,int y,int z,int c){
    return grid_current[z*QWidth*QHeight+y*QWidth+x].massFlight[c];
}
uint64_t moore26_events(int i){return qEvents[i&31];}
/* bulk-read support for wasm harnesses: the flat NodeState array —
 * JS strides it by moore26_node_size() to render the grid state. */
void *moore26_state_pointer(void){return grid_current;}
int moore26_node_size(void){return (int)sizeof(NodeState);}
int moore26_channel_count(void){return QChannels;}
