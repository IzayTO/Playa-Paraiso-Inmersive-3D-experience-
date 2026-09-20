// Wizard Map Design v1–v6. The reference image and all editor UI state are excluded.
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const text = (v, fallback = '', max = 120) => (typeof v === 'string' ? v.trim() : fallback).slice(0, max);
const vector = (v, fallback = [0, 0, 0]) => {
  if (!Array.isArray(v) || v.length < 3) return [...fallback];
  if (v.slice(0, 3).some(n => !Number.isFinite(Number(n)) || Math.abs(Number(n)) > 1e6)) throw new Error('La maqueta contiene una coordenada fuera de rango.');
  return v.slice(0, 3).map(Number);
};
export function emptyProject(){return {schema:'resort-map-builder',version:6,name:'Sin maqueta',objects:[],places:[],network:{nodes:[],edges:[],routes:[]}};}
export function parseProject(input, knownPropTypes) {
  if (!input || input.schema !== 'resort-map-builder') throw new Error('Elige un JSON exportado desde Wizard Map Design / Resort Map Builder.');
  if (![1,2,3,4,5,6].includes(Number(input.version))) throw new Error(`La versión ${input.version} aún no es compatible.`);
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
  const network = input.routeNetwork || {};
  for (const [key,limit] of [['nodes',10000],['edges',30000],['routes',2000]]) {
    if (network[key] !== undefined && (!Array.isArray(network[key]) || network[key].length > limit)) throw new Error(`La red de rutas tiene ${key} no válidos.`);
  }
  const nodeIds = new Set();
  const nodes = (network.nodes || []).map((n,i) => {
    const id = text(n.id,`node-${i}`);
    if (!id || nodeIds.has(id)) throw new Error('La red contiene nodos repetidos o vacíos.');
    nodeIds.add(id);return {id, name:text(n.name,`Punto ${i+1}`,80), position:vector(n.position)};
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
  if(input.places!==undefined&&(!Array.isArray(input.places)||input.places.length>2000))throw new Error('La lista de lugares no es válida.');
  const places = (input.places || []).filter(p=>p.visible!==false).map((p,i)=>({id:text(p.id,`place-${i}`),name:text(p.name,`Lugar ${i+1}`,80),position:vector(p.position),routeNodeId:nodeIds.has(p.routeNodeId)?p.routeNodeId:null}));
  return {schema:input.schema,version:input.version,name:text(input.name,'Mi maqueta',80),objects,places,network:{nodes,edges,routes}};
}

export async function readProjectFile(file, known) {
  if (!file || file.size > 40*1024*1024) throw new Error('Elige un archivo JSON de hasta 40 MB.');
  let data;
  try { data=JSON.parse(await file.text()); } catch { throw new Error('No se pudo leer el JSON. Vuelve a descargarlo desde el diseñador.'); }
  return parseProject(data,known);
}
