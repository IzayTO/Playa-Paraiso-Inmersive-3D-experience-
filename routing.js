import {distance,clamp} from './math.js?v=1.4';
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
  if(!project.places.length)return routeEndpoints(project.network);
  return project.places.filter(p=>p.visible!==false).map(p=>{
    let node=available.find(n=>n.id===(project.network.nodeAliases?.[p.routeNodeId]||p.routeNodeId));
    if(!node)node=available.reduce((best,n)=>!best||distance(n.position,p.position)<distance(best.position,p.position)?n:best,null);
    return node?{...p,nodeId:node.id,position:p.position,accessPosition:node.position,accessDistance:distance(p.position,node.position)}:null;
  }).filter(Boolean);
}
export function routeEndpoints(network){
  const original=network.sourceNetwork||network,sourceNodes=new Map(original.nodes.map(n=>[n.id,n])),nodes=new Map(network.nodes.map(n=>[n.id,n])),groups=new Map(),result=[];
  for(const edge of original.edges){const key=edge.routeId||'__unnamed__';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(edge);}
  let groupIndex=0;
  for(const [routeId,edges]of groups){
    const adj=new Map();for(const e of edges){for(const [a,b]of [[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({id:b,length:distance(sourceNodes.get(a).position,sourceNodes.get(b).position)});}}
    const seen=new Set();for(const first of adj.keys()){
      if(seen.has(first))continue;const component=[],queue=[first];seen.add(first);for(let i=0;i<queue.length;i++){const id=queue[i];component.push(id);for(const link of adj.get(id))if(!seen.has(link.id)){seen.add(link.id);queue.push(link.id);}}
      const farthest=start=>{const heap=new MinHeap(),dist=new Map([[start,0]]);heap.push({id:start,cost:0});let best=start;while(heap.size){const cur=heap.pop();if(cur.cost!==dist.get(cur.id))continue;if(cur.cost>dist.get(best))best=cur.id;for(const l of adj.get(cur.id)){const cost=cur.cost+l.length;if(cost<(dist.get(l.id)??Infinity)){dist.set(l.id,cost);heap.push({id:l.id,cost});}}}return best;};
      const start=component.find(id=>adj.get(id).length===1)||first,a=adj.get(start).length===1?start:farthest(start),b=farthest(a);
      const group=original.routes?.find(r=>r.id===routeId)?.name||`Ruta ${groupIndex+1}`;
      [a,b].forEach((id,i)=>{const node=nodes.get(network.nodeAliases?.[id]||id);if(!node)return;result.push({id:`endpoint:${groupIndex}:${i}`,nodeId:node.id,name:`Punto ${i+1}`,routeName:group,groupIndex,position:node.position,accessPosition:node.position,accessDistance:0});});groupIndex++;
    }
  }
  if(groupIndex>1)result.forEach(p=>p.name=`${p.routeName} · ${p.name}`);return result;
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
