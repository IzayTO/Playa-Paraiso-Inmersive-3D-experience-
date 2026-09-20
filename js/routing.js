import {distance,clamp} from './math.js';
class MinHeap {
  constructor(){this.a=[];}
  push(item){const a=this.a;let i=a.push(item)-1;while(i>0){const p=(i-1)>>1;if(a[p].cost<=item.cost)break;a[i]=a[p];i=p;}a[i]=item;}
  pop(){const a=this.a,root=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;if(a[j].cost>=last.cost)break;a[i]=a[j];i=j;}a[i]=last;}return root;}
  get size(){return this.a.length;}
}
export function getDestinations(project){
  const {nodes,edges}=project.network,connected=new Set(edges.flatMap(e=>[e.a,e.b]));
  if(!edges.length)return [];
  const available=nodes.filter(n=>connected.has(n.id));
  if(!project.places.length)return available.map(n=>({id:n.id,nodeId:n.id,name:n.name,position:n.position}));
  return project.places.map(p=>{
    let node=available.find(n=>n.id===p.routeNodeId);
    if(!node)node=available.reduce((best,n)=>!best||distance(n.position,p.position)<distance(best.position,p.position)?n:best,null);
    return node?{id:p.id,nodeId:node.id,name:p.name,position:node.position,accessDistance:distance(p.position,node.position)}:null;
  }).filter(Boolean);
}
export function findRoute(network,from,to,mode='standard',scores=new Map()){
  if(!['standard','fast','shade'].includes(mode))throw new Error('Tipo de ruta inválido.');
  if(from===to)throw new Error('Elige dos destinos con accesos diferentes.');
  const nodes=new Map(network.nodes.map(n=>[n.id,n])),routes=new Map(network.routes.map(r=>[r.id,r])),adj=new Map([...nodes.keys()].map(id=>[id,[]]));
  if(!nodes.has(from)||!nodes.has(to))throw new Error('El origen o el destino no forma parte de la red.');
  for(const edge of network.edges){
    if(!nodes.has(edge.a)||!nodes.has(edge.b))continue;
    const length=distance(nodes.get(edge.a).position,nodes.get(edge.b).position);
    if(length<.0001)continue;
    const route=routes.get(edge.routeId),score=Math.max(edge.covered||route?.covered?1:0,edge.shade||0,clamp(scores.get(edge.id)||0,0,1));
    const cost=length*(mode==='shade'?1+4*(1-score):mode==='standard'?(edge.routeId?1:1.25)*(route?.priority||1):1);
    const link={edge,length,score,cost};adj.get(edge.a).push({...link,next:edge.b});if(!edge.oneWay)adj.get(edge.b).push({...link,next:edge.a});
  }
  const heap=new MinHeap(),dist=new Map([[from,0]]),previous=new Map();heap.push({id:from,cost:0});
  while(heap.size){const current=heap.pop();if(current.cost!==dist.get(current.id))continue;if(current.id===to)break;for(const link of adj.get(current.id)){const cost=current.cost+link.cost;if(cost<(dist.get(link.next)??Infinity)){dist.set(link.next,cost);previous.set(link.next,{from:current.id,link});heap.push({id:link.next,cost});}}}
  if(!previous.has(to))throw new Error('No hay una ruta conectada entre esos destinos. Une los caminos en el diseñador.');
  const nodeIds=[to],links=[];let current=to;while(current!==from){const step=previous.get(current);links.unshift(step.link);current=step.from;nodeIds.unshift(current);}
  const points=nodeIds.map(id=>[...nodes.get(id).position]),cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+distance(points[i-1],points[i]));
  const length=cumulative.at(-1),shade=links.reduce((s,l)=>s+l.score*l.length,0)/length;
  const names=[...new Set(links.map(l=>routes.get(l.edge.routeId)?.name).filter(Boolean))];
  return {nodeIds,points,cumulative,length,shade,names,edges:links.map(l=>l.edge.id),mode};
}
