import * as THREE from 'three';
import {sunDirection,clamp} from './math.js?v=1.4';

// A small index per edge and solar position, independent of the moving camera.
export class ShadeIndex {
  constructor(viewer){this.viewer=viewer;this.cache=null;this.generation=0;}
  invalidate(){this.generation++;this.cache=null;}
  async prepare(network,path,onProgress=()=>{}){
    if(this.cache?.path===path)return;
    const generation=++this.generation,viewer=this.viewer,nodes=new Map(network.nodes.map(n=>[n.id,n]));
    const data=new Map(),steps=25,raycaster=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0);
    const meshBoxes=viewer.meshes.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh)}));
    const sampleCount=network.edges.length>300?3:5;
    const transmission=(point,direction)=>{
      raycaster.set(point,direction);raycaster.far=viewer.span*5;
      const candidates=meshBoxes.filter(e=>raycaster.ray.intersectsBox(e.box)).map(e=>e.mesh);
      const hits=raycaster.intersectObjects(candidates,false),seen=new Set();let pass=1;
      for(const hit of hits){const record=hit.object.userData.record;if(!record||seen.has(record.id))continue;seen.add(record.id);pass*=1-record.opacity;if(pass<.01)break;}
      return 1-pass;
    };
    for(let ei=0;ei<network.edges.length;ei++){
      if(generation!==this.generation)throw new DOMException('Cancelado','AbortError');
      const edge=network.edges[ei],a=nodes.get(edge.a)?.position,b=nodes.get(edge.b)?.position;if(!a||!b)continue;
      const samples=[];
      for(let si=0;si<sampleCount;si++){const t=(si+.5)/sampleCount;const point=a.map((v,j)=>v+(b[j]-v)*t);const floor=viewer.floorAt(point,viewer.baseEyeHeight);samples.push(new THREE.Vector3(point[0],floor+viewer.baseEyeHeight*.85,point[2]));}
      const covered=samples.reduce((s,p)=>s+transmission(p,up),0)/sampleCount;
      const values=new Float32Array(steps);
      for(let i=0;i<steps;i++){const dir=new THREE.Vector3(...sunDirection(i/(steps-1),path));values[i]=Math.max(covered,samples.reduce((s,p)=>s+transmission(p,dir),0)/sampleCount);}
      data.set(edge.id,{covered,values});onProgress((ei+1)/Math.max(1,network.edges.length));
      if(ei%4===0)await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    if(generation!==this.generation)throw new DOMException('Cancelado','AbortError');
    this.cache={data,path,steps};
  }
  scores(position){const result=new Map();if(!this.cache)return result;const at=clamp(position,0,1)*(this.cache.steps-1),i=Math.floor(at),j=Math.min(i+1,this.cache.steps-1);for(const[id,row]of this.cache.data)result.set(id,row.values[i]+(row.values[j]-row.values[i])*(at-i));return result;}
}
