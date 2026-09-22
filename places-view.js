import * as THREE from 'three';

// Opaque cutouts write depth like a real sign. Transparent architecture is
// blended afterwards: glass in front tints the sign, glass behind cannot.
export function makePinMaterial(texture){return new THREE.SpriteMaterial({map:texture,transparent:false,alphaTest:.12,alphaToCoverage:true,depthTest:true,depthWrite:true,toneMapped:false,fog:false});}
function pinTexture(color){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=160;const c=canvas.getContext('2d');
  const g=c.createLinearGradient(20,12,108,130);g.addColorStop(0,'#ffffff');g.addColorStop(.13,color);g.addColorStop(.82,color);g.addColorStop(1,'#193f50');
  c.beginPath();c.moveTo(64,150);c.bezierCurveTo(58,138,20,89,20,59);c.bezierCurveTo(20,0,108,0,108,59);c.bezierCurveTo(108,89,70,138,64,150);c.closePath();c.fillStyle=g;c.fill();c.lineWidth=4;c.strokeStyle='#ffffff';c.stroke();
  c.beginPath();c.arc(64,56,17,0,Math.PI*2);c.fillStyle='#fff9ef';c.fill();c.beginPath();c.arc(64,55,8,0,Math.PI*2);c.fillStyle=color;c.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export class PlacesView {
  constructor(viewer,onPick){this.viewer=viewer;this.onPick=onPick;this.group=new THREE.Group();this.group.name='Lugares';viewer.scene.add(this.group);this.materials=new Map();this.ray=new THREE.Raycaster();this.down=null;
    const canvas=viewer.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{if(e.button===0)this.down={id:e.pointerId,x:e.clientX,y:e.clientY};});
    canvas.addEventListener('pointermove',e=>{if(this.down?.id===e.pointerId&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>8)this.down=null;});
    canvas.addEventListener('pointercancel',()=>this.down=null);
    canvas.addEventListener('pointerup',e=>{if(this.down?.id!==e.pointerId)return;this.down=null;if(this.suspended?.())return;const r=canvas.getBoundingClientRect(),ndc=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(ndc,viewer.camera);
      if(this.onPlacePosition){const p=new THREE.Vector3();if(this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p))this.onPlacePosition(p.toArray());return;}
      const hits=this.ray.intersectObjects(this.group.children,false);
      for(const hit of hits){if(!hit.object.visible||!hit.object.userData.place.visible||hit.uv?.x<.15||hit.uv?.x>.85)continue;
        const blockers=this.ray.intersectObjects(viewer.meshes,false),seen=new Set();let transmission=1;
        for(const b of blockers){if(b.distance>=hit.distance)break;const record=b.object.userData.record;if(!record||seen.has(record.id))continue;seen.add(record.id);transmission*=1-record.opacity;}
        if(transmission>.04){this.onPick(hit.object.userData.place);break;}
      }
    });
  }
  setPlaces(places){
    this.group.clear();for(const m of this.materials.values()){m.map.dispose();m.dispose();}this.materials.clear();
    for(const place of places){if(place.visible===false)continue;if(!this.materials.has(place.color)){this.materials.set(place.color,makePinMaterial(pinTexture(place.color||'#59656f')));}
      const pin=new THREE.Sprite(this.materials.get(place.color));pin.center.set(.5,.03);pin.userData.place=place;pin.castShadow=false;pin.receiveShadow=false;pin.renderOrder=1;
      pin.position.fromArray(place.position);pin.position.y+=this.viewer.baseEyeHeight*1.35;this.group.add(pin);
    }this.viewer.dirty=true;
  }
  update(){const v=this.viewer,h=v.container.clientHeight||600,factor=2*Math.tan(v.camera.fov*Math.PI/360)/h;
    for(const pin of this.group.children){pin.visible=!this.filter||this.filter(pin.userData.place);const d=v.camera.position.distanceTo(pin.position),worldSize=THREE.MathUtils.clamp(d*factor*34,v.baseEyeHeight*.34,v.span*.045);pin.scale.set(worldSize*.8,worldSize,1);}
  }
}

export function destinationProjection(camera,position,width,height){
  camera.updateMatrixWorld();const p=new THREE.Vector3(...position),view=p.clone().applyMatrix4(camera.matrixWorldInverse),ndc=p.clone().project(camera),behind=view.z>=0;
  let x=ndc.x,y=-ndc.y;const finite=Number.isFinite(x)&&Number.isFinite(y);if(!finite){x=view.x||1;y=-view.y;const length=Math.max(Math.abs(x),Math.abs(y),.001);x=x/length*2;y=y/length*2;}
  if(behind){if(finite){x=-x;y=-y;}if(Math.abs(x)<.02)x=1;}
  const edge=behind||Math.abs(x)>.82||Math.abs(y)>.70;
  if(edge){const k=Math.max(Math.abs(x)/.82,Math.abs(y)/.70,1);x/=k;y/=k;}
  return {x:THREE.MathUtils.clamp((x+1)*width/2,92,Math.max(92,width-92)),y:THREE.MathUtils.clamp((y+1)*height/2,115,Math.max(115,height-180)),edge,angle:Math.atan2(x,-y)};
}
