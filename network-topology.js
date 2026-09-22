import {distance,clamp} from './math.js?v=1.4';
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const at=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

// Exact X/Z crossings, including T junctions and collinear overlaps. Elevation
// is checked independently so a bridge above a path does not become a turn.
export function segmentCrossings(a,b,c,d,tolerance=1e-5,heightTolerance=.05){
  const r=[b[0]-a[0],b[2]-a[2]],s=[d[0]-c[0],d[2]-c[2]],q=[c[0]-a[0],c[2]-a[2]],rr=r[0]**2+r[1]**2,ss=s[0]**2+s[1]**2;
  if(rr<tolerance*tolerance||ss<tolerance*tolerance)return [];
  const denominator=cross(r,s),result=[];
  const push=(t,u)=>{if(t<-.0000001||t>1.0000001||u<-.0000001||u>1.0000001)return;t=clamp(t,0,1);u=clamp(u,0,1);const p=at(a,b,t),other=at(c,d,u);if(Math.abs(p[1]-other[1])>heightTolerance||Math.hypot(p[0]-other[0],p[2]-other[2])>tolerance)return;if(result.some(x=>Math.abs(x.t-t)<1e-8&&Math.abs(x.u-u)<1e-8))return;result.push({t,u,position:[(p[0]+other[0])/2,(p[1]+other[1])/2,(p[2]+other[2])/2]});};
  if(Math.abs(denominator)>1e-10*Math.sqrt(rr*ss)){push(cross(q,s)/denominator,cross(q,r)/denominator);return result;}
  if(Math.abs(cross(q,r))/Math.sqrt(rr)>tolerance)return result;
  const project=(p,start,dir,length2)=>((p[0]-start[0])*dir[0]+(p[2]-start[2])*dir[1])/length2;
  push(0,project(a,c,s,ss));push(1,project(b,c,s,ss));push(project(c,a,r,rr),0);push(project(d,a,r,rr),1);return result;
}
function makeTree(items){
  const box={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity,maxIndex:-1};
  for(const i of items){box.minX=Math.min(box.minX,i.minX);box.minZ=Math.min(box.minZ,i.minZ);box.maxX=Math.max(box.maxX,i.maxX);box.maxZ=Math.max(box.maxZ,i.maxZ);box.maxIndex=Math.max(box.maxIndex,i.index);}
  if(items.length<=12)return {...box,items};const axis=box.maxX-box.minX>box.maxZ-box.minZ?'X':'Z';items.sort((a,b)=>(a['min'+axis]+a['max'+axis])-(b['min'+axis]+b['max'+axis]));const middle=items.length>>1;return {...box,left:makeTree(items.slice(0,middle)),right:makeTree(items.slice(middle))};
}
function candidates(tree,item,out){if(tree.maxIndex<=item.index||tree.minX>item.maxX||tree.maxX<item.minX||tree.minZ>item.maxZ||tree.maxZ<item.minZ)return;if(tree.items){for(const other of tree.items)if(other.index>item.index&&other.minX<=item.maxX&&other.maxX>=item.minX&&other.minZ<=item.maxZ&&other.maxZ>=item.minZ)out.push(other);return;}candidates(tree.left,item,out);candidates(tree.right,item,out);}

export function buildConnectedNetwork(source,onProgress=()=>{}){
  const tolerance=1e-5,heightTolerance=.05,sourceNodes=new Map(source.nodes.map(n=>[n.id,n])),nodes=[],buckets=new Map(),aliases=Object.create(null),cuts=new Map(),ids=new Set(source.nodes.map(n=>n.id));let nextId=0,intersectionCount=0;
  const key=(x,z)=>`${x}:${z}`;
  function nodeAt(position,original){
    const gx=Math.floor(position[0]/tolerance),gz=Math.floor(position[2]/tolerance);
    for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const node of buckets.get(key(x,z))||[]){if(Math.hypot(node.position[0]-position[0],node.position[2]-position[2])<=tolerance&&Math.abs(node.position[1]-position[1])<=heightTolerance)return node;}
    let id=original?.id;while(!id||(!original&&ids.has(id)))id=`__junction_${nextId++}`;ids.add(id);const node={...(original||{}),id,position:[...position],generated:!original};nodes.push(node);const k=key(gx,gz);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(node);return node;
  }
  for(const node of source.nodes)aliases[node.id]=nodeAt(node.position,node).id;
  const segments=[];
  for(const edge of source.edges){const a=sourceNodes.get(edge.a)?.position,b=sourceNodes.get(edge.b)?.position;if(!a||!b||distance(a,b)<tolerance)continue;const item={edge,a,b,index:segments.length,minX:Math.min(a[0],b[0])-tolerance,maxX:Math.max(a[0],b[0])+tolerance,minZ:Math.min(a[2],b[2])-tolerance,maxZ:Math.max(a[2],b[2])+tolerance};segments.push(item);cuts.set(edge.id,[{t:0,nodeId:aliases[edge.a]},{t:1,nodeId:aliases[edge.b]}]);}
  const tree=makeTree([...segments]);let comparisons=0;
  for(const item of segments){const possible=[];candidates(tree,item,possible);for(const other of possible){if(++comparisons>8000000)throw new Error('Hay demasiados tramos superpuestos. Divide esa red para poder prepararla.');for(const hit of segmentCrossings(item.a,item.b,other.a,other.b,tolerance,heightTolerance)){
      const node=nodeAt(hit.position);cuts.get(item.edge.id).push({t:hit.t,nodeId:node.id});cuts.get(other.edge.id).push({t:hit.u,nodeId:node.id});intersectionCount++;
      if(nodes.length>90000)throw new Error('La red genera demasiadas intersecciones para este visor.');
    }}if(item.index%200===0)onProgress((item.index+1)/Math.max(1,segments.length));}
  const edges=[],usedIds=new Set(source.edges.map(e=>e.id));
  for(const {edge}of segments){const split=cuts.get(edge.id).sort((a,b)=>a.t-b.t).filter((p,i,list)=>!i||Math.abs(p.t-list[i-1].t)>1e-8);for(let i=1;i<split.length;i++){const a=split[i-1],b=split[i];if(a.nodeId===b.nodeId)continue;let id=edge.id;if(split.length>2){id=`${edge.id}::part-${i}`;while(usedIds.has(id))id+='_';usedIds.add(id);}edges.push({...edge,id,a:a.nodeId,b:b.nodeId,sourceEdgeId:edge.sourceEdgeId||edge.id,sourceRange:[a.t,b.t]});if(edges.length>180000)throw new Error('La red contiene demasiados tramos después de unir sus cruces.');}}
  const used=new Set(edges.flatMap(e=>[e.a,e.b]));onProgress(1);
  return {nodes:nodes.filter(n=>used.has(n.id)),edges,routes:source.routes||[],nodeAliases:aliases,sourceNetwork:source,topology:{crossings:intersectionCount,generatedNodes:nodes.filter(n=>n.generated).length}};
}

export async function prepareConnectedNetwork(source,onProgress=()=>{}){
  if(source.sourceNetwork)return source;
  if(typeof Worker==='undefined'||source.edges.length<100)return buildConnectedNetwork(source,onProgress);
  // Large files are analyzed away from touch/scroll handling.
  let worker;try{worker=new Worker(new URL('./topology-worker.js?v=1.4',import.meta.url),{type:'module'});}catch{return buildConnectedNetwork(source,onProgress);}
  return new Promise((resolve,reject)=>{worker.onmessage=e=>{if(e.data.progress!==undefined){onProgress(e.data.progress);return;}worker.terminate();e.data.error?reject(new Error(e.data.error)):resolve(e.data.network);};worker.onerror=()=>{worker.terminate();try{resolve(buildConnectedNetwork(source,onProgress));}catch(error){reject(error);}};worker.postMessage(source);});
}
