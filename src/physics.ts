export type Rect={min:{x:number,y:number,z:number},max:{x:number,y:number,z:number}};
export const dist=(x:number,z:number,xx:number,zz:number)=>Math.hypot(xx-x,zz-z);
export function blocked(x:number,y:number,z:number,r:number,walls:Rect[]){
 return walls.some(b=>b.max.y>y+.12&&b.min.y<y+1.6&&x+r>b.min.x&&x-r<b.max.x&&z+r>b.min.z&&z-r<b.max.z);
}
export function slide(x:number,z:number,dx:number,dz:number,y:number,bounds:number,walls:Rect[],radius=.34):[number,number]{
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.22));
 for(let i=0;i<steps;i++){const nx=Math.max(-bounds,Math.min(bounds,x+dx/steps));if(!blocked(nx,y,z,radius,walls))x=nx;
 const nz=Math.max(-bounds,Math.min(bounds,z+dz/steps));if(!blocked(x,y,nz,radius,walls))z=nz}
 return [x,z]
}
// Intersect a segment against expanded rectangular solids, including the camera's near plane.
export function clipSegment(a:{x:number,y:number,z:number},b:{x:number,y:number,z:number},walls:Rect[],padding=.18){
 let closest=1;
 for(const box of walls){let near=0,far=1;
 for(const axis of ['x','y','z'] as const){const delta=b[axis]-a[axis],lo=box.min[axis]-padding,hi=box.max[axis]+padding;
 if(Math.abs(delta)<1e-7){if(a[axis]<lo||a[axis]>hi){near=2;break}}else{const one=(lo-a[axis])/delta,two=(hi-a[axis])/delta;near=Math.max(near,Math.min(one,two));far=Math.min(far,Math.max(one,two));if(near>far)break}}
 if(near<=far&&far>=0&&near<=1)closest=Math.min(closest,Math.max(0,near-.015))}
 return closest
}
export function steer(x:number,z:number,tx:number,tz:number,y:number,walls:Rect[],side:number){
 const a=Math.atan2(tx-x,tz-z);
 for(const turn of [0,.45,-.45,.85,-.85,1.35,-1.35,1.75,-1.75,2.4,-2.4]){const h=a+turn*side,dx=Math.sin(h),dz=Math.cos(h);if(!blocked(x+dx*1.05,y,z+dz*1.05,.35,walls))return [dx,dz]}
 return [0,0]
}
