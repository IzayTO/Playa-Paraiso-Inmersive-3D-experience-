import * as THREE from 'three';
import {clamp,pointOnPath,directionCue} from './math.js?v=1.2';
export class WalkController {
  constructor(viewer,onChange){
    this.viewer=viewer;this.onChange=onChange;this.active=false;this.keys=new Set();this.joy={x:0,y:0};this.drag=null;this.position=0;this.eye=.35;this.yaw=0;this.pitch=0;this.fov=70;this.joystickPointer=null;
    const canvas=viewer.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{if(!this.active||this.suspended||this.drag||e.button!==0)return;this.focusScene();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};canvas.setPointerCapture(e.pointerId);e.preventDefault();});
    canvas.addEventListener('pointermove',e=>{if(!this.active||this.suspended||this.drag?.id!==e.pointerId)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.yaw+=dx*.004;this.pitch=clamp(this.pitch-dy*.004,-1.45,1.45);this.drag.distance+=Math.hypot(dx,dy);this.drag.x=e.clientX;this.drag.y=e.clientY;if(!this.hasLooked&&this.drag.distance>=8){this.hasLooked=true;this.onLook?.();}viewer.dirty=true;e.preventDefault();});
    const release=e=>{if(this.drag?.id===e.pointerId)this.drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
    window.addEventListener('keydown',e=>{
      if(!this.active||this.suspended||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
      const target=e.target,tag=target.tagName;
      const typing=target.isContentEditable||tag==='TEXTAREA'||(tag==='INPUT'&&!['range','checkbox','radio','button','submit'].includes(target.type));
      // WASD can resume after any range/button. Arrow keys retain native control
      // behavior while a keyboard user is adjusting an input or a select.
      if(typing||tag==='SELECT'||(e.code.startsWith('Arrow')&&tag==='INPUT'))return;
      if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){
        e.preventDefault();this.viewer.container.focus({preventScroll:true});this.keys.add(e.code);
      }
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.resetInput());window.addEventListener('pagehide',()=>this.resetInput());document.addEventListener('visibilitychange',()=>this.resetInput());
  }
  focusScene(){if(document.activeElement!==this.viewer.container)this.viewer.container.focus({preventScroll:true});}
  bindJoystick(element,thumb){
    this.joyElement=element;this.joyThumb=thumb;
    // Only vertical displacement controls progress. A diagonal push has the
    // same speed as its vertical component; it can never steer the camera.
    const update=e=>{const rect=element.getBoundingClientRect();const y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.35),-1,1);this.joy={x:0,y};thumb.style.transform=`translate(0px,${-y*rect.height*.27}px)`;};
    element.addEventListener('pointerdown',e=>{if(!this.active||this.suspended||this.joystickPointer!==null||e.button!==0)return;this.focusScene();this.joystickPointer=e.pointerId;element.setPointerCapture(e.pointerId);update(e);e.preventDefault();});
    element.addEventListener('pointermove',e=>{if(this.active&&!this.suspended&&e.pointerId===this.joystickPointer){update(e);e.preventDefault();}});
    const release=e=>{if(this.joystickPointer===e.pointerId)this.releaseJoystick();};for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,release);
    // Safari fallback: prevent the native long-press/drag gesture only on this
    // control. Native panel scrolling, selects and range inputs remain usable.
    for(const event of ['touchstart','touchmove'])element.addEventListener(event,e=>{if(this.active)e.preventDefault();},{passive:false});
  }
  releaseJoystick(){const id=this.joystickPointer;this.joystickPointer=null;this.joy={x:0,y:0};if(this.joyThumb)this.joyThumb.style.transform='';if(id!==null&&this.joyElement?.hasPointerCapture?.(id))this.joyElement.releasePointerCapture(id);}
  setFov(value){const n=Number(value);if(!Number.isFinite(n))return this.fov;this.fov=clamp(n,45,100);if(this.active){this.viewer.camera.fov=this.fov;this.viewer.camera.updateProjectionMatrix();this.viewer.dirty=true;}return this.fov;}
  start(route,from,to){
    if(!route?.points?.length)throw new Error('Primero elige una ruta.');
    this.saved={position:this.viewer.camera.position.clone(),target:this.viewer.controls.target.clone(),near:this.viewer.camera.near,fov:this.viewer.camera.fov};this.route=route;this.from=from;this.to=to;this.position=0;this.eye=this.viewer.baseEyeHeight;this.pitch=0;this.hasLooked=false;
    const [a,b]=route.points;this.yaw=Math.atan2(b[0]-a[0],-(b[2]-a[2]));
    this.active=true;this.viewer.walking=true;this.viewer.transition=null;this.viewer.controls.enabled=false;this.viewer.camera.fov=this.fov;this.viewer.camera.near=Math.max(.001,this.eye*.05);this.viewer.resize();this.resetInput();this.focusScene();this.update(0);
  }
  stop(){
    if(!this.active)return;this.active=false;this.viewer.walking=false;this.resetInput();this.viewer.camera.fov=this.saved.fov;this.viewer.camera.near=this.saved.near;this.viewer.camera.position.copy(this.saved.position);this.viewer.controls.target.copy(this.saved.target);this.viewer.controls.enabled=true;this.viewer.resize();this.viewer.controls.update();
  }
  resetInput(){this.keys.clear();this.releaseJoystick();const id=this.drag?.id;this.drag=null;const canvas=this.viewer.renderer.domElement;if(id!==undefined&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}
  seek(value){if(!this.active)return;this.position=clamp(value,0,1)*this.route.length;this.viewer.dirty=true;this.update(0);}
  update(dt){
    if(!this.active||this.suspended)return false;
    const forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)+(Math.abs(this.joy.y)>.12?this.joy.y:0);
    const turn=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);
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
