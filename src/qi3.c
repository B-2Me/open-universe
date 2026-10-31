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
static uint32_t *qConfirm, *qSessionStrength;
static uint8_t  *qSessionState;
static uint64_t qEvents[24];
static int qGapMode = 0;   /* 0 = harmonic comb (nu % line == 0)
                            * 1 = quadratic well: levels E_n = E0/n^2,
                            *     absorb iff nu == a level gap (converging
                            *     series — candidate for Rydberg-family
                            *     structure; measurement decides) */
static uint64_t qTick, qPhotonLedger;
static uint64_t qRngSeed = 88172645463325252ULL;

static inline int siteIndex(int x,int y,int z){ return (z*QHeight+y)*QWidth+x; }
static inline int wrapCoord(int v,int m){ v%=m; if(v<0)v+=m; return v; }
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
    qConfirm        =calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    qSessionState   =calloc((size_t)QSites*QChannels,1);
    qSessionStrength=calloc((size_t)QSites*QChannels,sizeof(uint32_t));
    return (qMass&&qWinding&&qLevel&&qCharge&&qMassFlight&&qMassFlight_next&&
            qPhoton&&qPhoton_next&&qPhotonNu&&qPhotonNu_next&&qConfirm&&
            qSessionState&&qSessionStrength)?0:-1;
}

EMS_API int qi3_channel_count(void){ return QChannels+1; }
EMS_API void qi3_tick(void){
    qTick++;
    memset(qMassFlight_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qPhoton_next,0,(size_t)QSites*QChannels*sizeof(uint32_t));
    memset(qConfirm,0,(size_t)QSites*QChannels*sizeof(uint32_t));

    /* Phase 1 — junction collide: redistribute in-flight mass.
     * Opposing channels annihilate into parked mass + charge. */
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++){
        int oc=c^1;
        int a=qMassFlight[si*QChannels+c],b=qMassFlight[si*QChannels+oc];
        int hit=a<b?a:b;
        if(hit>0){
            qMassFlight[si*QChannels+c]-=hit;qMassFlight[si*QChannels+oc]-=hit;
            qMass[si]+=hit*2;
            qCharge[si]+=hit*2;
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
            int keep=v;if((qTick%nu)==0)keep=v-1;   /* nu-gated loss */
            qEvents[7]+=v-keep;
            if(!keep){qPhoton[si*QChannels+c]-=v;continue;}
            int nx=wrapCoord(x+QChannelVec[c][0],QWidth);
            int ny=wrapCoord(y+QChannelVec[c][1],QHeight);
            int nz=wrapCoord(z+QChannelVec[c][2],QDepth);
            int ni=siteIndex(nx,ny,nz)*QChannels+c;
            qPhoton_next[ni]+=keep;qPhotonNu_next[ni]=nu;
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
        for(int c=0;c<QChannels;c++){
            int offer=qPhoton_next[si*QChannels+c];
            if(!offer||!mass)continue;
            int nu=qPhotonNu_next[si*QChannels+c]?qPhotonNu_next[si*QChannels+c]:1;
            /* edge-local line: the channel's own winding + site mass
             * set what this edge can absorb — different edges of the
             * same node may absorb differently. */
            int line=(mass+(qWinding[si*QChannels+c]>>2))>>2;
            if(line<1)line=1;
            int match=0, stim=0;
            if(qGapMode==1){
                /* level-dependent transitions: site at level n absorbs
                 * upward gaps E(n->m) = 256/n^2-256/m^2 (m>n), or is
                 * stimulated to emit downward gaps E(n->m)=256/m^2-
                 * 256/n^2 (m<n). n derived from charge, not stored. */
                int n=1+(qCharge[si]>>5);if(n>8)n=8;
                int En=256/(n*n);
                for(int m=1;m<=8;m++){
                    if(m>n&&nu==En-256/(m*m)){match=1;break;}
                    if(m<n&&nu==256/(m*m)-En){stim=1;break;}
                }
            } else {
                match=(nu%line==0&&nu>=line);
            }
            if(match){
                int oc=c^1;
                qConfirm[si*QChannels+oc]+=offer;        /* arm reverse */
                uint32_t take=offer;qPhoton_next[si*QChannels+c]-=take;
                qCharge[si]+=take*(uint32_t)nu;
                qEvents[18]+=(uint64_t)take*nu;          /* E deposited */
                qWinding[si*QChannels+c]+=((uint32_t)take*nu)>>3; /* nu recoil */
                qEvents[3]+=take;qEvents[16]+=take*nu;
            } else if(stim){
                /* clone: site falls one level, emits identical photon —
                 * the original continues unabsorbed. */
                /* clone energy must come from the level drop — emit
                 * only what the charge can pay for, ledger the rest */
                uint32_t afford=nu?(qCharge[si]/(uint32_t)nu):0;
                uint32_t cloned=offer<afford?offer:afford;
                qEvents[21]+=(uint64_t)(offer-cloned)*nu;  /* E shortfall */
                qPhoton_next[si*QChannels+c]+=cloned;
                qPhotonNu_next[si*QChannels+c]=nu;
                qCharge[si]=qCharge[si]>cloned*(uint32_t)nu
                    ? qCharge[si]-cloned*(uint32_t)nu : 0;
                qEvents[17]+=cloned;
            }
        }
    }

    /* Phase 5 — session strength: duplex EMA on matching links. */
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++){
        int flow=qPhoton_next[si*QChannels+c];
        if(flow){
            int s=qSessionStrength[si*QChannels+c];
            qSessionStrength[si*QChannels+c]=s+((flow-s)>>2);
            if(qSessionState[si*QChannels+c]==0&&flow>4)
                {qSessionState[si*QChannels+c]=1;qEvents[10]++;}
            else if(qSessionState[si*QChannels+c]==1&&qSessionStrength[si*QChannels+c]>30)
                {qSessionState[si*QChannels+c]=2;qEvents[11]++;}
        } else if(qSessionState[si*QChannels+c]){
            qSessionState[si*QChannels+c]=0;qSessionStrength[si*QChannels+c]>>=1;qEvents[12]++;
        }
    }

    /* Phase 6 — emission: charged massive sites emit offers at their
     * line nu (gap-mode aware: mode 1 emits at the level gap the
     * site's charge implies — level derived, not stored). */
    for(int si=0;si<QSites;si++){
        int mass=qMass[si],e=qCharge[si];
        if(e<32||!mass)continue;
        int line;
        if(qGapMode==1){
            int n=2+(e>>5);if(n>8)n=8;          /* charge-derived level */
            line=256-256/(n*n);                 /* ground->n gap */
        } else {
            line=mass>4?mass>>2:1;
        }
        /* emit ENERGY, not count: dump e>>3 charge as photons at the
         * line — count = energy/line so the ledger stays closed. */
        int dumpE=e>>3;if(dumpE<1)continue;
        int emit=dumpE/line;if(emit<1){emit=1;dumpE=line;}
        if(dumpE>e)dumpE=e;
        int nout=0;
        for(int c=0;c<QChannels;c++)if(qSessionState[si*QChannels+c])nout++;
        if(!nout)nout=QChannels;                    /* broadcast before sessions */
        int per=emit/nout;if(per<1)per=1;
        for(int c=0;c<QChannels;c++){
            if(nout!=QChannels&&!qSessionState[si*QChannels+c])continue;
            int ni=si*QChannels+c;
            qPhoton_next[ni]+=per;qPhotonNu_next[ni]=line;
        }
        qCharge[si]=e>(uint32_t)dumpE?e-(uint32_t)dumpE:0;
        qEvents[4]+=emit;qEvents[20]+=(uint64_t)dumpE;
    }

    /* commit streamed buffers */
    for(int i=0;i<QSites*QChannels;i++){
        qMassFlight[i]+=qMassFlight_next[i];
        qPhoton[i]+=qPhoton_next[i];
        if(qPhoton_next[i])qPhotonNu[i]=qPhotonNu_next[i];
    }
}

EMS_API void qi3_photon_set(int x,int y,int z,int c,int v){
    if(c>=QChannels)return;
    int si=siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth));
    qPhoton[si*QChannels+c]=(uint32_t)v; qPhotonNu[si*QChannels+c]=32;
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
    return qLevel[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))];
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
    return qSessionState[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API int qi3_session_strength(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qSessionStrength[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API void qi3_gap_mode(int m){ qGapMode=m; }
EMS_API int qi3_confirm_get(int x,int y,int z,int c){
    if(c>=QChannels)return 0;
    return qConfirm[siteIndex(wrapCoord(x,QWidth),wrapCoord(y,QHeight),wrapCoord(z,QDepth))*QChannels+c];
}
EMS_API uint64_t qi3_event(int i){ return qEvents[i & 31]; }
EMS_API uint64_t qi3_photon_count(void){ uint64_t m=0;
    for(int si=0;si<QSites;si++)for(int c=0;c<QChannels;c++)m+=qPhoton[si*QChannels+c];return m; }
