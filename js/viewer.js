import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {createProp,updateParametricProp,PROP_CATALOG} from './props.js';
import {Lighting} from './lighting.js';
import {makeRenderer} from './renderer.js';

export const knownProps=Object.keys(PROP_CATALOG);
export class Viewer {
  constructor(container) {
    this.container=container;this.scene=new THREE.Scene();this.meshes=[];this.group=null;this.dirty=true;this.walking=false;
    this.camera=new THREE.PerspectiveCamera(43,1,.015,10000);
    this.renderer=makeRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.65:2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=false; // Shadow depth is rendered once in Lighting.prepare(), never in the playback loop.
    container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.085;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minPolarAngle=.03;this.controls.screenSpacePanning=false;
    this.controls.touches.ONE=THREE.TOUCH.ROTATE;this.controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    this.controls.addEventListener('change',()=>this.dirty=true);this.controls.addEventListener('start',()=>this.transition=null);
    this.lighting=new Lighting(this);
    this.bounds=new THREE.Box3(new THREE.Vector3(-10,0,-10),new THREE.Vector3(10,4,10));this.center=new THREE.Vector3();this.span=20;
    this.raycaster=new THREE.Raycaster();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.onContextLost?.();});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>this.onContextRestored?.());
  }
  makeMaterial(opacity=1,color=0xf7fafa){const mat=new THREE.MeshStandardMaterial({color,roughness:.84,metalness:0,opacity,transparent:opacity<.999,depthWrite:opacity>=.999,side:THREE.DoubleSide});this.lighting.decorate(mat);return mat;}
  buildModel(project){
    const group=new THREE.Group(),meshes=[],materials=new Map();
    const getMat=opacity=>{if(!materials.has(opacity))materials.set(opacity,this.makeMaterial(opacity));return materials.get(opacity);};
    try{
      for(const record of project.objects){
        const root=record.editorType==='building'?new THREE.Mesh(new THREE.BoxGeometry(1,1,1),getMat(record.opacity)):createProp(record.propType);
        // Eliminate circular editorRoot userData; the viewer only retains geometry metadata.
        root.traverse(child=>{child.userData={};});
        if(record.params&&record.editorType==='prop'){
          root.userData.parametric=PROP_CATALOG[record.propType]?.parametric;root.userData.propType=record.propType;updateParametricProp(root,record.params);
          root.traverse(child=>{child.userData={};});
        }
        root.name=record.name;root.position.fromArray(record.position);root.rotation.set(...record.rotation);
        root.scale.set(...record.scale.map((v,i)=>v*(record.mirror[['x','y','z'][i]]?-1:1)));
        root.userData={record};
        root.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=getMat(record.opacity);mesh.userData.record=record;meshes.push(mesh);});
        group.add(root);
      }
      group.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(group);
      if(bounds.isEmpty())bounds.set(new THREE.Vector3(-5,0,-5),new THREE.Vector3(5,2,5));
      return {group,meshes,bounds,materials:[...materials.values()]};
    }catch(error){for(const material of materials.values())material.dispose();throw error;}
  }
  setModel(model){
    this.lighting.invalidate();
    if(this.group){this.scene.remove(this.group);for(const material of this.modelMaterials)material.dispose();const geometries=new Set();this.group.traverse(m=>{if(m.isMesh)geometries.add(m.geometry);});for(const geometry of geometries)geometry.dispose();}
    if(this.ground){this.scene.remove(this.ground,this.surround);this.ground.geometry.dispose();this.ground.material.dispose();this.surround.geometry.dispose();this.surround.material.dispose();}
    Object.assign(this,{group:model.group,meshes:model.meshes,bounds:model.bounds,modelMaterials:model.materials});this.scene.add(this.group);
    this.center=this.bounds.getCenter(new THREE.Vector3());const size=this.bounds.getSize(new THREE.Vector3());this.span=Math.max(size.x,size.z,size.y,4);this.groundY=Math.min(0,this.bounds.min.y)-this.span*.0008;
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(size.x+this.span*.40,size.z+this.span*.40),this.makeMaterial(1,0xf7fafb));this.ground.rotation.x=-Math.PI/2;this.ground.position.set(this.center.x,this.groundY,this.center.z);this.scene.add(this.ground);
    this.surround=new THREE.Mesh(new THREE.PlaneGeometry(this.span*1500,this.span*1500),new THREE.MeshStandardMaterial({color:0xe3edf0,roughness:1}));this.surround.rotation.x=-Math.PI/2;this.surround.position.set(this.center.x,this.groundY-this.span*.012,this.center.z);this.scene.add(this.surround);
    this.camera.far=this.span*800;this.camera.near=this.span*.0001;this.camera.updateProjectionMatrix();this.controls.maxDistance=this.span*5;this.controls.minDistance=this.span*.08;
    this.baseEyeHeight=this.estimateEyeHeight();this.frame('aerial',false);this.resize();
  }
  estimateEyeHeight(){const heights=this.group.children.filter(o=>o.userData.record.editorType==='building').map(o=>new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y).sort((a,b)=>a-b);return THREE.MathUtils.clamp((heights[Math.floor(heights.length/2)]||3)*.31,.12,1.65);}
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.clearViewOffset();
    // The 3D focus sits in the available space, away from the planning card.
    if(!this.walking&&w>760)this.camera.setViewOffset(w,h,-Math.min(150,w*.115),0,w,h);
    else if(!this.walking)this.camera.setViewOffset(w,h,0,h*.055,w,h);
    this.camera.updateProjectionMatrix();this.dirty=true;}
  frame(view='aerial',smooth=true,routeBounds){
    if(this.walking)return;
    const bounds=routeBounds||this.bounds,target=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());target.y=Math.max(this.groundY||0,target.y*.55);
    const span=Math.max(size.x,size.z,size.y,4),aspect=this.container.clientWidth/this.container.clientHeight;
    const fitFactor=this.container.clientWidth<=760?1.90:1.65;
    const distance=Math.max(span,span/Math.max(.30,aspect))*(view==='top'?1.42:fitFactor);
    const vector=view==='top'?new THREE.Vector3(0,1,.001):view==='front'?new THREE.Vector3(.0,.34,1):new THREE.Vector3(.9,.93,1.16);
    const end=target.clone().add(vector.normalize().multiplyScalar(distance));
    if(smooth&&!matchMedia('(prefers-reduced-motion:reduce)').matches)this.transition={start:performance.now(),from:this.camera.position.clone(),to:end,fromTarget:this.controls.target.clone(),target};
    else{this.transition=null;this.camera.position.copy(end);this.controls.target.copy(target);this.controls.update();}
    this.dirty=true;
  }
  zoom(factor){if(this.walking)return;const offset=this.camera.position.clone().sub(this.controls.target);const length=THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(offset.setLength(length));this.controls.update();this.dirty=true;}
  update(){if(this.transition){const p=THREE.MathUtils.clamp((performance.now()-this.transition.start)/800,0,1),t=p*p*(3-2*p);this.camera.position.lerpVectors(this.transition.from,this.transition.to,t);this.controls.target.lerpVectors(this.transition.fromTarget,this.transition.target,t);if(p===1)this.transition=null;this.dirty=true;}if(this.controls.enabled)this.controls.update();}
  floorAt(position,eye){
    // Follow walkable surfaces without teleporting onto roofs above the observer.
    const origin=new THREE.Vector3(position[0],position[1]+eye*.70,position[2]);this.raycaster.set(origin,new THREE.Vector3(0,-1,0));this.raycaster.far=eye*1.6;
    const candidates=this.meshes.filter(m=>['path','stairsStraight','stairsL','stairsU','bridge','archedBridge'].includes(m.userData.record?.propType));
    const hit=this.raycaster.intersectObjects(candidates,false)[0];return hit?Math.max(position[1],hit.point.y):position[1];
  }
  render(){this.lighting.update(0);this.renderer.render(this.scene,this.camera);this.dirty=false;}
}
