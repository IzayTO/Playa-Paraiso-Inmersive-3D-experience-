// Wizard Map Design v1–v8. Display geometry, navigation and place data.
import {readViewCenters} from './view-presets.js?v=1.4';
import {readNetworks} from './network-input.js?v=1.4';
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const text = (v, fallback = '', max = 120) => (typeof v === 'string' ? v.trim() : fallback).slice(0, max);
const vector = (v, fallback = [0, 0, 0]) => {
  if (!Array.isArray(v) || v.length < 3) return [...fallback];
  if (v.slice(0, 3).some(n => !Number.isFinite(Number(n)) || Math.abs(Number(n)) > 1e6)) throw new Error('La maqueta contiene una coordenada fuera de rango.');
  return v.slice(0, 3).map(Number);
};
export const PLACE_TYPES={general:'Lugar',edificio:'Edificio',lobby:'Lobby',piscina:'Piscina',restaurante:'Restaurante',spa:'Spa',recepcion:'Recepción'};
export const PLACE_COLORS={general:'#59656f',edificio:'#6c655d',lobby:'#5b7394',piscina:'#4e8b9a',restaurante:'#8b694e',spa:'#7a668f',recepcion:'#5f8268'};
export function normalizePlace(p,i=0){
  if(!p||typeof p!=='object')throw new Error('Hay un lugar sin datos válidos.');
  const category=text(p.category,'general',40)||'general';
  return {id:text(p.id,`place-${i}`)||`place-${i}`,name:text(p.name,`Lugar ${i+1}`,80)||`Lugar ${i+1}`,category,
    color:typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color.trim())?p.color.trim():PLACE_COLORS[category]||PLACE_COLORS.general,
    position:vector(p.position),routeNodeId:text(p.routeNodeId)||null,visible:p.visible!==false,locked:!!p.locked,
    hours:text(p.hours,'',120),description:text(p.description,'',600),hotel:text(p.hotel,'',20),viewCenterId:text(p.viewCenterId),accessible:p.accessible===true,
    sourceSection:p.sourceSection==='part8'?'part8':'root',sourceId:text(p.sourceId)||null,sourceRouteNodeId:text(p.sourceRouteNodeId)||null};
}
export function emptyProject(){return {schema:'resort-map-builder',version:8,name:'Sin maqueta',objects:[],places:[],network:{nodes:[],edges:[],routes:[]},pathConnections:[],viewCenters:[]};}
export function parseProject(input, knownPropTypes) {
  if (!input || input.schema !== 'resort-map-builder') throw new Error('Elige un JSON exportado desde Wizard Map Design / Resort Map Builder.');
  if (![1,2,3,4,5,6,7,8].includes(Number(input.version))) throw new Error(`La versión ${input.version} aún no es compatible.`);
  if (!Array.isArray(input.objects) || input.objects.length > 10000) throw new Error('La lista de objetos no es válida (máximo 10 000).');
  const known = new Set(knownPropTypes);
  const ids = new Set();
  const objects = input.objects.map((o, i) => {
    if (!o || !['building','prop'].includes(o.editorType)) throw new Error(`El objeto ${i + 1} tiene un tipo no compatible.`);
    if (o.editorType === 'prop' && !known.has(o.propType)) throw new Error(`El objeto «${o.name || i+1}» usa el prop desconocido «${o.propType}». No se sustituyó su geometría.`);
    const id = text(o.id, `object-${i}`) || `object-${i}`;
    if (ids.has(id)) throw new Error('Hay objetos con identificadores repetidos. Vuelve a exportar la maqueta.');
    ids.add(id);
    return {id, editorType:o.editorType, propType:o.propType, name:text(o.name,'Objeto',80),
      position:vector(o.position), rotation:vector(o.rotation,[0,finite(o.rotationY),0]),
      scale:vector(o.scale,[1,1,1]).map(n => Math.max(.0001,Math.abs(n))),
      mirror:{x:!!o.mirror?.x,y:!!o.mirror?.y,z:!!o.mirror?.z},
      opacity:Math.max(0,Math.min(1,finite(o.opacity,1))),
      params:o.params ? {steps:Math.max(3,Math.min(30,Math.round(finite(o.params.steps,10))))}:null
    };
  });
  const merged=readNetworks(input),network=merged.network;
  for (const [key,limit] of [['nodes',10000],['edges',30000],['routes',2000]]) {
    if (network[key] !== undefined && (!Array.isArray(network[key]) || network[key].length > limit)) throw new Error(`La red de rutas tiene ${key} no válidos.`);
  }
  const nodeIds = new Set();
  const nodes = (network.nodes || []).map((n,i) => {
    const id = text(n.id,`node-${i}`);
    if (!id || nodeIds.has(id)) throw new Error('La red contiene nodos repetidos o vacíos.');
    nodeIds.add(id);return {id, name:text(n.name,`Punto ${i+1}`,80), position:vector(n.position),sourceSection:n.sourceSection||'root',sourceId:n.sourceId||id};
  });
  const routes = (network.routes || []).map((r,i) => ({id:text(r.id,`route-${i}`),name:text(r.name,`Ruta ${i+1}`,80),covered:r.covered === true,priority:Math.max(.1,Math.min(10,finite(r.priority,1)))}));
  const routeIds = new Set(routes.map(r => r.id));
  const edgeIds = new Set();
  const edges = (network.edges || []).map((e,i) => {
    const a=text(e.a),b=text(e.b),id=text(e.id,`edge-${i}`);
    if(!nodeIds.has(a)||!nodeIds.has(b)||a===b||edgeIds.has(id)) throw new Error(`La conexión ${i+1} de la red es inválida.`);
    edgeIds.add(id);
    return {id,a,b,routeId:routeIds.has(e.routeId)?e.routeId:null,covered:e.covered===true,shade:Math.max(0,Math.min(1,finite(e.shade,0))),oneWay:e.oneWay===true};
  });
  const placeIds=new Set();
  const places=merged.places.map((p,i)=>{const place=normalizePlace(p,i);if(placeIds.has(place.id))throw new Error('Hay lugares con identificadores repetidos.');placeIds.add(place.id);if(!nodeIds.has(place.routeNodeId))place.routeNodeId=null;return place;});
  if(input.pathConnections!==undefined&&(!Array.isArray(input.pathConnections)||input.pathConnections.length>5000))throw new Error('Las uniones de caminos no son válidas.');
  const pathConnections=(input.pathConnections||[]).filter(p=>p&&ids.has(p.a)&&ids.has(p.b)&&p.a!==p.b).map((p,i)=>({id:text(p.id,`path-link-${i}`),a:p.a,b:p.b}));
  // Preserve the original geometry/network metadata when exporting place edits.
  // A reference photograph is never needed in this viewer or its saved file.
  const source={...input,settings:{...input.settings}};delete source.settings.referenceImage;
  return {schema:input.schema,version:Number(input.version),name:text(input.name,'Mi maqueta',80),objects,places,network:{nodes,edges,routes},pathConnections,viewCenters:readViewCenters(input.viewCenters),explorer:{aheadStyle:input.explorer?.aheadStyle==='breadcrumbs'?'breadcrumbs':'line'},source};
}

export function serializeProject(project){
  // Save original authored networks, not the automatically generated junctions.
  const authored=project.network.sourceNetwork||project.network;
  const clean=p=>{const {sourceSection,sourceId,sourceRouteNodeId,...place}=p,node=authored.nodes.find(n=>n.id===p.routeNodeId&&(n.sourceSection||'root')===(sourceSection||'root'));return {...place,id:sourceId||p.id,position:[...p.position],routeNodeId:node?(node.sourceId||node.id):null};};
  const source=project.source||{},result={...source,schema:'resort-map-builder',version:8,name:project.name,savedAt:new Date().toISOString(),
    objects:source.objects||project.objects,routeNetwork:source.routeNetwork||project.network.sourceNetwork||project.network,
    pathConnections:project.pathConnections||[],places:project.places.filter(p=>p.sourceSection!=='part8').map(clean),viewCenters:project.viewCenters||[],
    explorer:{version:'1.4',guestFov:100,guestSpeed:1,aheadStyle:project.explorer?.aheadStyle||'line'}};
  if(source.part8)result.part8={...source.part8,places:project.places.filter(p=>p.sourceSection==='part8').map(clean)};
  return result;
}

export async function readProjectFile(file, known) {
  if (!file || file.size > 40*1024*1024) throw new Error('Elige un archivo JSON de hasta 40 MB.');
  let data;
  try { data=JSON.parse(await file.text()); } catch { throw new Error('No se pudo leer el JSON. Vuelve a descargarlo desde el diseñador.'); }
  return parseProject(data,known);
}
