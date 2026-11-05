/* test_moore26 — smoke test for the 0.1fm engine.
 * Seeds a wound lump (mass core + circulating winding) in the center
 * of a 64^3 grid, ticks, and reports:
 *   - knot survival (mass + winding totals across time)
 *   - vacuum-skip efficacy (processed-chunk fraction)
 *   - ms/tick (acceptance: <50ms/tick at 256^3)
 */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>

void moore26_init(int w,int h,int d);
void moore26_tick(void);
uint32_t moore26_winding_get(int x,int y,int z,int c);
void moore26_winding_set(int x,int y,int z,int c,uint32_t v);
void moore26_mass_set(int x,int y,int z,uint32_t v);
uint32_t moore26_mass_get(int x,int y,int z);
void moore26_packet_set(int x,int y,int z,int c,uint32_t v);
void moore26_packet_nu_set(int x,int y,int z,int c,uint32_t v);
uint32_t moore26_packet_get(int x,int y,int z,int c);
uint64_t moore26_events(int i);

static int W=64,H_=64,D_=64;
static uint64_t tot_mass(int d){
    uint64_t s=0;
    for(int z=0;z<d;z++)for(int y=0;y<W;y++)for(int x=0;x<W;x++)
        s+=moore26_mass_get(x,y,z);
    return s;
}
static uint64_t tot_wind(int d){
    uint64_t s=0;
    for(int z=0;z<d;z++)for(int y=0;y<W;y++)for(int x=0;x<W;x++)
        for(int c=0;c<26;c++)s+=moore26_winding_get(x,y,z,c);
    return s;
}
static uint64_t tot_phot(int d){
    uint64_t s=0;
    for(int z=0;z<d;z++)for(int y=0;y<W;y++)for(int x=0;x<W;x++)
        for(int c=0;c<26;c++)s+=moore26_packet_get(x,y,z,c);
    return s;
}
uint16_t moore26_heat_get(int x,int y,int z);
static double centroid_x(int d){
    double num=0,den=0;
    for(int z=0;z<d;z++)for(int y=0;y<W;y++)for(int x=0;x<W;x++){
        uint32_t m=moore26_mass_get(x,y,z);
        num+=x*m;den+=m;
    }
    return den>0?num/den:-1;
}
static uint64_t tot_heat(int d){
    uint64_t s=0;
    for(int z=0;z<d;z++)for(int y=0;y<W;y++)for(int x=0;x<W;x++)
        s+=moore26_heat_get(x,y,z);
    return s;
}

int main(int argc,char**argv){
    int ticks=argc>1?atoi(argv[1]):200;
    if(argc>2)W=H_=D_=atoi(argv[2]);
    moore26_init(W,H_,D_);
    int c0=W/2;
    /* wound lump: a 5-node-radius ball of balanced +/- winding on
     * all 13 edge pairs — committed volume 832/site > the 512
     * ground-state floor, so emission can actually fire. */
    for(int dz=-5;dz<=5;dz++)for(int dy=-5;dy<=5;dy++)for(int dx=-5;dx<=5;dx++){
        if(dx*dx+dy*dy+dz*dz>25)continue;
        int x=c0+dx,y=c0+dy,z=c0+dz;
        for(int e=0;e<13;e++){      /* all 13 edge pairs, +/- balanced */
            moore26_winding_set(x,y,z,2*e,64);
            moore26_winding_set(x,y,z,2*e+1,64);
        }
    }
    moore26_mass_set(c0,c0,c0,256);
    /* give the core a directed edge (dd=64) — the knot should crawl
     * +x along its dominant circulation axis via mass launch. */
    moore26_winding_set(c0,c0,c0,0,96);
    moore26_winding_set(c0,c0,c0,1,32);
    /* a seed packet stream aimed at the lump */
    for(int i=0;i<20;i++)
        {moore26_packet_set(c0-10-i, c0, c0, 0, 1);
         moore26_packet_nu_set(c0-10-i, c0, c0, 0, 200);}
    /* a COUNTER-propagating stream (channel 1, -x): head-on packets
     * with nua+nub=400 > fusion wall 256 -> pair production in the
     * vacuum between the streams. */
    for(int i=0;i<20;i++)
        {moore26_packet_set(c0+10+i, c0, c0, 1, 1);
         moore26_packet_nu_set(c0+10+i, c0, c0, 1, 200);}

    printf("moore26 smoke: %d^3, %d ticks\n",W,ticks);
    printf("t=0   mass=%llu wind=%llu phot=%llu\n",
        (unsigned long long)tot_mass(W),(unsigned long long)tot_wind(W),(unsigned long long)tot_phot(W));
    struct timespec t0,t1;clock_gettime(CLOCK_MONOTONIC,&t0);
    for(int t=0;t<ticks;t++){
        moore26_tick();
        if((t+1)%50==0)
            printf("t=%-4d mass=%llu cx=%.1f wind=%llu phot=%llu heat=%llu emit=%llu arm=%llu conf=%llu fuse=%llu annih=%llu decayedE=%llu\n",t+1,
                (unsigned long long)tot_mass(W),centroid_x(W),
                (unsigned long long)tot_wind(W),(unsigned long long)tot_phot(W),
                (unsigned long long)tot_heat(W),
                (unsigned long long)moore26_events(4),
                (unsigned long long)moore26_events(5),
                (unsigned long long)moore26_events(3),(unsigned long long)moore26_events(23),
                (unsigned long long)moore26_events(9),(unsigned long long)moore26_events(7));
    }
    clock_gettime(CLOCK_MONOTONIC,&t1);
    double ms=(t1.tv_sec-t0.tv_sec)*1e3+(t1.tv_nsec-t0.tv_nsec)/1e6;
    printf("%.1f ms/tick (%d^3)\n",ms/ticks,W);
    return 0;
}
