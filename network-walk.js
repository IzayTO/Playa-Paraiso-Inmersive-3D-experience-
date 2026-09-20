import {distance,clamp} from './math.js?v=1.3';
import {findRoute} from './routing.js?v=1.3';

const EPS=1e-7;
export function nearestNetworkPoint(network,position){
  const nodes=new Map(network.nodes.map(n=>[n.id,n]));let best=null;
  for(const edge of network.edges){
    const a=nodes.get(edge.a)?.position,b=nodes.get(edge.b)?.position;if(!a||!b)continue;
    const length=distance(a,b);if(length<EPS)continue;
    const t=clamp(a.reduce((s,v,i)=>s+(position[i]-v)*(b[i]-v),0)/(length*length),0,1);
    const point=a.map((v,i)=>v+(b[i]-v)*t),d=distance(point,position);
    if(!best||d<best.distance)best={edgeId:edge.id,t,position:point,distance:d};
  }return best;
}

// Split the occupied edge, not the camera position. The new route starts at
// exactly the same point and retains all direction and weighting rules.
export function routeFromLocation(network,location,to,mode='standard',scores=new Map()){
  const edge=network.edges.find(e=>e.id===location.edgeId);if(!edge)throw new Error('Tu posición ya no está en la red de caminos.');
  const t=clamp(location.t,0,1),a=network.nodes.find(n=>n.id===edge.a),b=network.nodes.find(n=>n.id===edge.b);
  let from=t<EPS?edge.a:t>1-EPS?edge.b:null;
  let augmented=network,nextScores=scores;
  if(!from){
    from='__explorer_start__';while(network.nodes.some(n=>n.id===from))from+='_';
    const point=a.position.map((v,i)=>v+(b.position[i]-v)*t);
    const first={...edge,id:`${from}:a`,b:from},second={...edge,id:`${from}:b`,a:from};
    augmented={...network,nodes:[...network.nodes,{id:from,position:point}],edges:[...network.edges.filter(e=>e.id!==edge.id),first,second]};
    nextScores=new Map(scores);nextScores.set(first.id,scores.get(edge.id)||0);nextScores.set(second.id,scores.get(edge.id)||0);
  }
  if(from===to){const p=network.nodes.find(n=>n.id===to).position;return {nodeIds:[to],points:[[...p]],cumulative:[0],length:0,shade:0,names:[],edges:[],mode};}
  const route=findRoute(augmented,from,to,mode,nextScores);
  route.sourceEdges=route.edges.map(id=>id===`${from}:a`||id===`${from}:b`?edge.id:id);
  return route;
}

// A trail records connected edges. Reverse movement retraces it; a fork waits
// for an explicit choice. Crossing lines without a shared node never connect.
export class NetworkWalker {
  constructor(network,start,heading=0){
    this.network=network;this.nodes=new Map(network.nodes.map(n=>[n.id,n]));this.edges=new Map();this.adj=new Map(network.nodes.map(n=>[n.id,[]]));
    for(const edge of network.edges){const length=distance(this.nodes.get(edge.a).position,this.nodes.get(edge.b).position);if(length<EPS)continue;const item={...edge,length};this.edges.set(edge.id,item);this.adj.get(edge.a).push({edge:item,from:edge.a,to:edge.b,length});if(!edge.oneWay)this.adj.get(edge.b).push({edge:item,from:edge.b,to:edge.a,length});}
    if(!this.edges.size)throw new Error('Esta maqueta necesita al menos un camino conectado.');
    const location=start?.edgeId?start:nearestNetworkPoint(network,start?.position||network.nodes[0].position);
    let edge=this.edges.get(location?.edgeId);if(!edge)edge=this.edges.values().next().value;
    let from=edge.a,to=edge.b,t=location?.t||0;
    const endpoint=t<EPS?edge.a:t>1-EPS?edge.b:null;
    if(endpoint){const candidates=this.adj.get(endpoint)||[],origin=this.nodes.get(endpoint).position,score=link=>{const q=this.nodes.get(link.to).position;return ((q[0]-origin[0])*Math.sin(heading)-(q[2]-origin[2])*Math.cos(heading))/link.length;};const best=[...candidates].sort((a,b)=>score(b)-score(a))[0];if(best){edge=best.edge;from=best.from;to=best.to;t=0;}}
    const a=this.nodes.get(from).position,b=this.nodes.get(to).position;
    if(!endpoint&&!edge.oneWay&&(b[0]-a[0])*Math.sin(heading)-(b[2]-a[2])*Math.cos(heading)<0){[from,to]=[to,from];t=1-t;}
    this.trail=[{edge,from,to,length:edge.length}];this.index=0;this.offset=t*edge.length;this.pending=null;this.totalTravel=0;
  }
  get segment(){return this.trail[this.index];}
  get point(){const s=this.segment,a=this.nodes.get(s.from).position,b=this.nodes.get(s.to).position,t=this.offset/s.length;return a.map((v,i)=>v+(b[i]-v)*t);}
  get location(){const s=this.segment;return {edgeId:s.edge.id,t:s.from===s.edge.a?this.offset/s.length:1-this.offset/s.length,position:this.point};}
  options(sign=1){const s=this.segment,node=sign>0?s.to:s.from;return (this.adj.get(node)||[]).filter(link=>link.edge.id!==s.edge.id&&(sign>0||!link.edge.oneWay));}
  get choices(){return this.pending?.options||[];}
  get atEnd(){return this.offset>=this.segment.length-EPS&&!this.options(1).length;}
  choose(edgeId){
    if(!this.pending)return false;const link=this.pending.options.find(o=>o.edge.id===edgeId);if(!link)return false;
    const sign=this.pending.sign;this.pending=null;
    if(sign>0){this.trail.splice(this.index+1);this.trail.push(link);this.index++;this.offset=0;}
    else{this.trail=this.trail.slice(this.index);this.trail.unshift({...link,from:link.to,to:link.from});this.index=0;this.offset=link.length;}
    return true;
  }
  move(delta){
    if(!Number.isFinite(delta)||Math.abs(delta)<EPS)return;
    const sign=Math.sign(delta);let remaining=Math.abs(delta),steps=0;
    if(this.pending&&this.pending.sign!==sign)this.pending=null;
    while(remaining>EPS&&steps++<128){
      const s=this.segment;if(sign<0&&s.edge.oneWay)break;
      const room=sign>0?s.length-this.offset:this.offset,used=Math.min(room,remaining);
      this.offset+=sign*used;remaining-=used;this.totalTravel+=used;
      if(remaining<=EPS)break;
      if(sign<0&&this.index>0){this.index--;this.offset=this.segment.length;continue;}
      const options=this.options(sign);if(!options.length)break;
      this.pending={sign,options};if(options.length>1)break;
      this.choose(options[0].edge.id);
    }
  }
}
