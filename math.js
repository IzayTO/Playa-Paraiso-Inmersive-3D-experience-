export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function sunDirection(position,path='diagonal') {
  const theta=.07+clamp(position,0,1)*(Math.PI-.14);
  const horizontal=Math.cos(theta), y=Math.sin(theta);
  return path==='side' ? [horizontal,y,0] : [horizontal/Math.SQRT2,y,horizontal/Math.SQRT2];
}
export function advanceSun(phase,seconds,durationMinutes){const p=((phase+seconds/(durationMinutes*60))%2+2)%2;return {phase:p,position:p<=1?p:2-p,returning:p>1};}
export function directionCue(forward,target){
  const dot=forward[0]*target[0]+forward[2]*target[2];
  const right=forward[0]*target[2]-forward[2]*target[0];
  const angle=Math.atan2(right,dot);
  const abs=Math.abs(angle);
  return {angle,text:abs<Math.PI/6?'Continúa de frente':abs>Math.PI*5/6?'El camino está detrás':angle>0?'El camino va a la derecha':'El camino va a la izquierda'};
}
export function pointOnPath(points,cumulative,d){
  const total=cumulative.at(-1)||0,at=clamp(d,0,total);
  let i=1;while(i<cumulative.length-1&&cumulative[i]<at)i++;
  const a=points[Math.max(0,i-1)],b=points[Math.min(i,points.length-1)];
  const segment=(cumulative[i]||0)-(cumulative[i-1]||0);
  const t=segment>0?(at-cumulative[i-1])/segment:0;
  return a.map((v,j)=>v+(b[j]-v)*t);
}
