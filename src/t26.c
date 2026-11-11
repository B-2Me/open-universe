#include <stdio.h>
#include <stdint.h>
extern void moore26_init(int,int,int);
extern void moore26_tick(void);
extern void moore26_winding_set(int,int,int,int,int);
extern void moore26_mass_set(int,int,int,int);
extern uint32_t moore26_events(int);
int main(void){
    moore26_init(32,32,32);
    for(int dz=0;dz<=2;dz++)for(int dy=0;dy<=2;dy++)for(int dx=0;dx<=2;dx++){
        int x=15+dx,y=15+dy,z=15+dz;
        moore26_winding_set(x,y,z,6,600);moore26_winding_set(x,y,z,7,600);
        moore26_mass_set(x,y,z,100);
    }
    for(int i=0;i<500;i++)moore26_tick();
    printf("ok ev59=%u\n",moore26_events(59));
    return 0;
}
