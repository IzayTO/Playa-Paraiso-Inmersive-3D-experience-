export const VIEW_PRESETS=Object.freeze([
  {id:'lindo-50-51',hotel:'lindo',area:'50-51',label:'50–51'},
  {id:'lindo-52-55',hotel:'lindo',area:'52-55',label:'52–55'},
  {id:'lindo-lobby',hotel:'lindo',area:'lobby',label:'Lobby'},
  {id:'maya-60',hotel:'maya',area:'60',label:'60'},
  {id:'maya-61-62',hotel:'maya',area:'61-62',label:'61–62'},
  {id:'maya-63-64',hotel:'maya',area:'63-64',label:'63–64'},
  {id:'maya-65-66',hotel:'maya',area:'65-66',label:'65–66'},
  {id:'maya-lobby',hotel:'maya',area:'lobby',label:'Lobby'}
]);
export const hotelName=hotel=>hotel==='maya'?'Maya':'Lindo';
export const presetName=p=>`${hotelName(p.hotel)} · ${p.area==='lobby'?'Lobby':p.label}`;
const vector=(p,fallback)=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(n=>Number.isFinite(Number(n))&&Math.abs(Number(n))<=1e6)?p.slice(0,3).map(Number):[...fallback];
export function readViewCenters(source=[]){
  if(!Array.isArray(source)||source.length>16)throw new Error('La lista de centradores de vista no es válida.');
  const seen=new Set();return source.flatMap(item=>{const preset=VIEW_PRESETS.find(p=>p.id===item?.id);if(!preset||seen.has(preset.id))return [];seen.add(preset.id);const position=vector(item.position,[0,0,0]);let offset=vector(item.initialView?.cameraOffset,[14,12,16]);if(Math.hypot(...offset)<.01)offset=[14,12,16];offset[1]=Math.max(.1,offset[1]);return [{...preset,position,nearestRouteNodeId:typeof item.nearestRouteNodeId==='string'?item.nearestRouteNodeId:null,initialView:{mode:'aerial-oblique',target:vector(item.initialView?.target,position),cameraOffset:offset,fov:Math.max(30,Math.min(80,Number(item.initialView?.fov)||45))}}];});
}
export const searchText=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—]/g,'-').trim();
export function findHomePlace(project,preset){
  if(!preset)return null;const places=project.places.filter(p=>p.visible!==false),center=project.viewCenters?.find(c=>c.id===preset.id);
  const exact=places.find(p=>p.viewCenterId===preset.id);if(exact)return exact;
  const range=preset.area.split('-').map(Number),numbers=Number.isFinite(range[0])?Array.from({length:(range[1]||range[0])-range[0]+1},(_,i)=>range[0]+i):[];
  const match=places.filter(p=>{const text=searchText(p.name+' '+p.id),hotel=searchText(p.hotel||'');if(hotel&&hotel!==preset.hotel)return false;if(text.includes(preset.hotel==='maya'?'lindo':'maya'))return false;return preset.area==='lobby'?/lobby|recepcion/.test(text):numbers.some(n=>new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text));});
  if(match.length===1)return match[0];if(center&&match.length)return match.reduce((a,b)=>Math.hypot(b.position[0]-center.position[0],b.position[2]-center.position[2])<Math.hypot(a.position[0]-center.position[0],a.position[2]-center.position[2])?b:a);return null;
}
