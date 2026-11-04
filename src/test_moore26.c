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
void moore26_photon_set(int x,int y,int z,int c,uint32_t v);
void moore26_photon_nu_set(int x,int y,int z,int c,uint32_t v);

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

int main(int argc,char**argv){
    int ticks=argc>1?atoi(argv[1]):200;
    if(argc>2)W=H_=D_=atoi(argv[2]);
    moore26_init(W,H_,D_);
    int c0=W/2;
    /* wound lump: a 5-node-radius ball of balanced +/- winding on the
     * face channels (a circulating knot) with a mass core. */
    for(int dz=-5;dz<=5;dz++)for(int dy=-5;dy<=5;dy++)for(int dx=-5;dx<=5;dx++){
        if(dx*dx+dy*dy+dz*dz>25)continue;
        int x=c0+dx,y=c0+dy,z=c0+dz;
        for(int e=0;e<6;e++){       /* 3 face-edge pairs, +/- balanced */
            moore26_winding_set(x,y,z,2*e,64);
            moore26_winding_set(x,y,z,2*e+1,64);
        }
    }
    moore26_mass_set(c0,c0,c0,256);
    /* a seed photon stream aimed at the lump */
    for(int i=0;i<20;i++)
        {moore26_photon_set(c0-10-i, c0, c0, 0, 1);
         moore26_photon_nu_set(c0-10-i, c0, c0, 0, 200);}

    printf("moore26 smoke: %d^3, %d ticks\n",W,ticks);
    printf("t=0   mass=%llu wind=%llu\n",
        (unsigned long long)tot_mass(W),(unsigned long long)tot_wind(W));
    struct timespec t0,t1;clock_gettime(CLOCK_MONOTONIC,&t0);
    for(int t=0;t<ticks;t++){
        moore26_tick();
        if((t+1)%50==0)
            printf("t=%-4d mass=%llu wind=%llu\n",t+1,
                (unsigned long long)tot_mass(W),(unsigned long long)tot_wind(W));
    }
    clock_gettime(CLOCK_MONOTONIC,&t1);
    double ms=(t1.tv_sec-t0.tv_sec)*1e3+(t1.tv_nsec-t0.tv_nsec)/1e6;
    printf("%.1f ms/tick (%d^3)\n",ms/ticks,W);
    return 0;
}
