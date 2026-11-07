#include <stdio.h>
#include <stdint.h>
extern void moore26_init(int,int,int),moore26_tick(void);
extern void moore26_mass_set(int,int,int,uint32_t),moore26_winding_set(int,int,int,int,uint32_t);
extern void moore26_photon_set(int,int,int,int,uint32_t),moore26_photon_nu_set(int,int,int,int,uint32_t);
extern int32_t moore26_cvc(int,int);
int main(int argc,char**argv){
  int W=128,c0=64,A=16,D=8;
  moore26_init(W,W,W);
  int pts[64][2],n=0;
  for(int i=0;i<=51;i++){double t=i*0.02;
    pts[n][0]=c0+(int)(A*(2*t-1)+0.5);pts[n][1]=c0-D/2+(int)(D*(4*t*(1-t))+0.5);n++;}
  moore26_mass_set(pts[0][0],pts[0][1],c0,512);
  moore26_mass_set(pts[n-1][0],pts[n-1][1],c0,512);
  for(int i=0;i<n-1;i++){
    int dx=pts[i+1][0]-pts[i][0],dy=pts[i+1][1]-pts[i][1],b=0,bs=-1;
    for(int c=0;c<26;c++){int s=moore26_cvc(c,0)*dx+moore26_cvc(c,1)*dy;if(s>bs){bs=s;b=c;}}
    moore26_winding_set(pts[i][0],pts[i][1],c0,b,128);
    moore26_winding_set(pts[i][0],pts[i][1],c0,b^1,128);
  }
  for(int jit=-2;jit<=2;jit++)
    for(int cnt=6;cnt<=9;cnt++)
      for(int t=0;t<150;t++){
        if(t<80)for(int x=c0-3+jit;x<=c0+3+jit;x++){
          moore26_photon_set(x,c0+36,c0,3,cnt);
          moore26_photon_nu_set(x,c0+36,c0,3,128);}
        moore26_tick();
      }
  printf("all clean\n");
  return 0;
}
