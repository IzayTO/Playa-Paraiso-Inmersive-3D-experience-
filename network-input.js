// Map Design can export both its named routes and the Part 8 sidecar.
// Namespace collisions, never discard an independently authored network.
export function readNetworks(input){
  const nodes=[],edges=[],routes=[],places=[],nodeIds=new Set(),edgeIds=new Set(),routeIds=new Set(),placeIds=new Set();
  const str=(s,f)=>typeof s==='string'&&s.trim()?s.trim().slice(0,120):f;
  const unique=(id,set,prefix)=>{let result=id;if(set.has(result))result=prefix+id;while(set.has(result))result+='_' ;set.add(result);return result;};
  const lists=(s,key,limit)=>{const list=s?.[key]||[];if(!Array.isArray(list)||list.length>limit)throw new Error(`La lista ${key} de la maqueta no es válida.`);return list;};
  for(const [source,prefix]of [[input,''],[input.part8,'part8:']]){
    if(!source)continue;const network=source.routeNetwork||{},map=new Map(),routeMap=new Map(),seenNodes=new Set(),seenEdges=new Set(),seenPlaces=new Set();
    lists(network,'nodes',10000).forEach((n,i)=>{const raw=str(n?.id,`node-${i}`);if(seenNodes.has(raw))throw new Error('La red contiene nodos repetidos.');seenNodes.add(raw);const id=unique(raw,nodeIds,prefix||'root:');map.set(raw,id);const p=n.position;nodes.push({...n,id,sourceSection:prefix?'part8':'root',sourceId:raw,position:Array.isArray(p)&&p.length===2?[p[0],0,p[1]]:p});});
    lists(network,'routes',2000).forEach((r,i)=>{const raw=str(r?.id,`route-${i}`);if(routeMap.has(raw))throw new Error('La red contiene rutas repetidas.');const id=unique(raw,routeIds,prefix||'root:');routeMap.set(raw,id);routes.push({...r,id});});
    lists(network,'edges',30000).forEach((e,i)=>{const raw=str(e?.id,`edge-${i}`);if(seenEdges.has(raw))throw new Error('La red contiene conexiones repetidas.');seenEdges.add(raw);if(!map.has(e.a)||!map.has(e.b))throw new Error('Una conexión apunta a un nodo que no existe.');edges.push({...e,id:unique(raw,edgeIds,prefix||'root:'),a:map.get(e.a),b:map.get(e.b),routeId:routeMap.get(e.routeId)||null});});
    lists(source,'places',2000).forEach((p,i)=>{const raw=str(p?.id,`place-${i}`);if(seenPlaces.has(raw))throw new Error('Hay lugares con identificadores repetidos.');seenPlaces.add(raw);places.push({...p,position:Array.isArray(p.position)&&p.position.length===2?[p.position[0],0,p.position[1]]:p.position,id:unique(raw,placeIds,prefix||'root:'),routeNodeId:map.get(p.routeNodeId)||null,sourceSection:prefix?'part8':'root',sourceId:raw,sourceRouteNodeId:p.routeNodeId||null});});
  }
  return {network:{nodes,edges,routes},places};
}
