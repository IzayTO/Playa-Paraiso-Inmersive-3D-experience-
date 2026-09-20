import * as THREE from 'three';
import {clamp,pointOnPath,directionCue} from './math.js';
export class WalkController {
  constructor(viewer,onChange){
    this.viewer=viewer;this.onChange=onChange;this.active=false;this.keys=new Set();this.joy={x:0,y:0};this.drag=null;this.position=0;this.eye=.35;this.yaw=0;this.pitch=0;
    const canvas=viewer.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{if(!this.active||e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);e.preventDefault();});
    canvas.addEventListener('pointermove',e=>{if(!this.active||this.drag?.id!==e.pointerId)return;this.yaw+=(e.clientX-this.drag.x)*.004;this.pitch=clamp(this.pitch-(e.clientY-this.drag.y)*.004,-1.45,1.45);this.drag.x=e.clientX;this.drag.y=e.clientY;viewer.dirty=true;});
    const release=e=>{if(this.drag?.id===e.pointerId)this.drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
    window.addEventListener('keydown',e=>{if(!this.active||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.resetInput());document.addEventListener('visibilitychange',()=>this.resetInput());
  }
  bindJoystick(element,thumb){
    let pointer=null;
    const update=e=>{const rect=element.getBoundingClientRect();const x=(e.clientX-rect.left-rect.width/2)/(rect.width*.35),y=(e.clientY-rect.top-rect.height/2)/(rect.height*.35);const length=Math.max(1,Math.hypot(x,y));this.joy={x:x/length,y:-y/length};thumb.style.transform=`translate(${this.joy.x*30}px,${-this.joy.y*30}px)`;};
    element.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;element.setPointerCapture(pointer);update(e);e.preventDefault();});
    element.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e);});
    const release=e=>{if(pointer===e.pointerId){pointer=null;this.joy={x:0,y:0};thumb.style.transform='';}};for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,release);
    window.addEventListener('blur',()=>{pointer=null;thumb.style.transform='';this.joy={x:0,y:0};});
  }
  start(route,from,to){
    if(!route?.points?.length)throw new Error('Primero elige una ruta.');
    this.saved={position:this.viewer.camera.position.clone(),target:this.viewer.controls.target.clone()};this.route=route;this.from=from;this.to=to;this.position=0;this.eye=this.viewer.baseEyeHeight;this.pitch=0;
    const [a,b]=route.points;this.yaw=Math.atan2(b[0]-a[0],-(b[2]-a[2]));
    this.active=true;this.viewer.walking=true;this.viewer.transition=null;this.viewer.controls.enabled=false;this.viewer.camera.fov=70;this.viewer.resize();this.resetInput();this.viewer.container.focus({preventScroll:true});this.update(0);
  }
  stop(){
    if(!this.active)return;this.active=false;this.viewer.walking=false;this.resetInput();this.viewer.camera.fov=43;this.viewer.camera.position.copy(this.saved.position);this.viewer.controls.target.copy(this.saved.target);this.viewer.controls.enabled=true;this.viewer.resize();this.viewer.controls.update();this.viewer.frame('aerial',true);
  }
  resetInput(){this.keys.clear();this.joy={x:0,y:0};this.drag=null;}
  seek(value){if(!this.active)return;this.position=clamp(value,0,1)*this.route.length;this.viewer.dirty=true;this.update(0);}
  update(dt){
    if(!this.active)return false;
    const forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)+(Math.abs(this.joy.y)>.12?this.joy.y:0);
    const turn=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+(Math.abs(this.joy.x)>.20?this.joy.x:0);
    this.position=clamp(this.position+forward*dt*this.eye*1.65,0,this.route.length);this.yaw+=turn*dt*1.3;
    const p=pointOnPath(this.route.points,this.route.cumulative,this.position),floor=this.viewer.floorAt(p,this.eye);
    const direction=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    this.viewer.camera.position.set(p[0],floor+this.eye,p[2]);this.viewer.camera.lookAt(this.viewer.camera.position.clone().add(direction));
    const atEnd=this.position>=this.route.length-.01,lookDistance=this.eye*3;
    const q=pointOnPath(this.route.points,this.route.cumulative,Math.min(this.route.length,this.position+lookDistance));let target=[q[0]-p[0],0,q[2]-p[2]];
    if(Math.hypot(target[0],target[2])<.001){const prev=pointOnPath(this.route.points,this.route.cumulative,Math.max(0,this.position-lookDistance));target=[prev[0]-p[0],0,prev[2]-p[2]];}
    const cue=directionCue([direction.x,0,direction.z],target);
    this.onChange?.({fraction:this.position/this.route.length,remaining:this.route.length-this.position,cue,atEnd,atStart:this.position<=.01});
    this.viewer.dirty=true;return true;
  }
}
