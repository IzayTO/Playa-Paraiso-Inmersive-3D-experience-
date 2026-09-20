import * as THREE from 'three';
import {sunDirection,clamp,advanceSun} from './math.js?v=1.1-flat';
import {LiveShadows} from './shadows.js?v=1.1-flat';
import {Atmosphere,solarAtmosphere} from './atmosphere.js?v=1.1-flat';

export class Lighting {
  constructor(viewer) {
    this.viewer=viewer;this.enabled=false;this.skyEnabled=false;this.path='diagonal';
    this.phase=.5;this.position=.5;this.playing=true;this.duration=10;this.abort=null;this.cache=null;
    this.direction=new THREE.Vector3(0,1,0);
    this.shadows=new LiveShadows(viewer);this.atmosphere=new Atmosphere(viewer.scene);
    this.sun=new THREE.DirectionalLight(0xfff3dc,0);viewer.scene.add(this.sun,this.sun.target);
    this.ambient=new THREE.HemisphereLight(0xffffff,0x97aeb7,2.15);viewer.scene.add(this.ambient);
    this.fill=new THREE.DirectionalLight(0xffffff,1.15);this.fill.position.set(-4,7,5);viewer.scene.add(this.fill);
    this.dawnAmbient=new THREE.Color(0xc6b9e9);this.duskAmbient=new THREE.Color(0xb6a1d4);
  }
  decorate(material){this.shadows.decorate(material);}
  invalidate(){this.abort?.abort();this.abort=null;this.cache=null;this.enabled=false;this.shadows.dispose();this.update(0);}
  async prepare(path,onProgress=()=>{}) {
    this.abort?.abort();const controller=new AbortController();this.abort=controller;
    try {
      onProgress(.1);await new Promise(resolve=>requestAnimationFrame(resolve));
      if(controller.signal.aborted)throw new DOMException('Cancelado','AbortError');
      if(!this.shadows.ready)this.shadows.prepare();
      this.path=path;this.direction.fromArray(sunDirection(this.position,path));this.shadows.render(this.direction);
      onProgress(1);this.cache={path};
    }finally{if(this.abort===controller)this.abort=null;}
  }
  setEnabled(enabled){this.enabled=enabled&&this.shadows.ready;this.shadows.uniforms.solarEnabled.value=this.enabled?1:0;this.update(0);}
  setSky(enabled){this.skyEnabled=enabled;this.update(0);}
  seek(p){this.position=clamp(p,0,1);this.phase=this.position;this.playing=false;this.update(0);}
  update(dt) {
    if(this.enabled&&this.playing){const next=advanceSun(this.phase,dt,this.duration);this.phase=next.phase;this.position=next.position;}
    this.direction.fromArray(sunDirection(this.position,this.path));
    const dir=this.direction,center=this.viewer.center||new THREE.Vector3();
    this.sun.position.copy(center).addScaledVector(dir,Math.max(100,this.viewer.span||20));this.sun.target.position.copy(center);
    const {dawn,dusk}=solarAtmosphere(this.position,this.enabled);
    this.sun.intensity=this.enabled?2.7*(.36+.64*Math.sqrt(dir.y)):0;
    this.sun.color.setRGB(1,.94-.25*dawn-.43*dusk,.88-.42*dawn-.66*dusk);
    this.ambient.intensity=this.enabled?1.2-.15*dawn-.25*dusk:2.15;this.fill.intensity=this.enabled?0:1.15;
    this.ambient.color.set(this.skyEnabled?0xd4eaff:0xffffff);
    if(this.skyEnabled&&this.enabled){this.ambient.color.lerp(this.dawnAmbient,dawn*.5);this.ambient.color.lerp(this.duskAmbient,dusk*.65);}
    const fog=this.viewer.scene.fog;
    if(fog){fog.color.setRGB(.89,.935,.945);if(this.skyEnabled){fog.color.setRGB(.76,.88,.94);fog.color.lerp(new THREE.Color(.94,.59,.60),dawn);fog.color.lerp(new THREE.Color(.90,.36,.20),dusk);}}
    this.atmosphere.update(this.viewer.camera,dir,this.position,this.skyEnabled,this.enabled);
  }
  beforeRender(){this.update(0);if(this.enabled)this.shadows.render(this.direction);}
}
