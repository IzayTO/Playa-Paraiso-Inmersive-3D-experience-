import * as THREE from 'three';
import {pointOnPath,clamp,distance} from './math.js?v=1.2';
export class RouteVisual {
  constructor(viewer){this.viewer=viewer;this.group=new THREE.Group();viewer.scene.add(this.group);this.route=null;}
  clear(){for(const child of [...this.group.children]){child.geometry?.dispose();child.material?.dispose();this.group.remove(child);}this.route=null;this.viewer.dirty=true;}
  show(route){
    this.clear();this.route=route;this.started=performance.now();this.reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const width=Math.max(this.viewer.span*.0045,.05),points=[];
    // Retain exact segments, sampling only height so ramps and steps stay on the path.
    for(let i=0;i<route.points.length-1;i++){const a=route.points[i],b=route.points[i+1],count=Math.max(1,Math.min(256,Math.ceil(distance(a,b)/(this.viewer.baseEyeHeight*.6))));for(let j=0;j<count;j++){const t=j/count,p=a.map((v,k)=>v+(b[k]-v)*t);p[1]=this.viewer.floorAt(p,this.viewer.baseEyeHeight)+width*.18;points.push(p);}}
    const last=[...route.points.at(-1)];last[1]=this.viewer.floorAt(last,this.viewer.baseEyeHeight)+width*.18;points.push(last);
    const positions=[],uvs=[],indices=[];let covered=0;
    for(let i=0;i<points.length;i++){
      const a=points[Math.max(0,i-1)],b=points[Math.min(i+1,points.length-1)];const dir=new THREE.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize();const normal=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(width);
      if(i>0)covered+=distance(points[i-1],points[i]);
      for(const sign of [-1,1]){positions.push(points[i][0]+normal.x*sign,points[i][1],points[i][2]+normal.z*sign);uvs.push(covered,sign);}
      if(i<points.length-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    this.uniforms={reveal:{value:0},time:{value:0},total:{value:covered},spacing:{value:width*13}};
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
      vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUV;uniform float reveal;uniform float time;uniform float total;uniform float spacing;
      void main(){if(vUV.x>reveal*total)discard;float edge=1.0-smoothstep(.8,1.0,abs(vUV.y));float phase=fract((vUV.x-time)/spacing);
      float arrow=1.0-smoothstep(.035,.085,abs(phase-(.60-abs(vUV.y)*.15)));arrow*=1.0-step(.70,abs(vUV.y));
      vec3 col=mix(vec3(0.0,.37,.43),vec3(.91,1.0,.98),arrow*.93);gl_FragColor=vec4(col,edge*.97);}`
    });const ribbon=new THREE.Mesh(geometry,material);ribbon.renderOrder=3;this.group.add(ribbon);
    const makePin=(p,color)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(width*2.3,width*2.3,width*.45,24),new THREE.MeshBasicMaterial({color}));mesh.position.set(p[0],p[1]+width*.25,p[2]);this.group.add(mesh);};makePin(points[0],0x00828a);makePin(points.at(-1),0x003c51);
    const marker=new THREE.Mesh(new THREE.ConeGeometry(width*1.6,width*3.5,3),new THREE.MeshBasicMaterial({color:0xffffff}));marker.geometry.rotateX(Math.PI/2);this.marker=marker;this.group.add(marker);
    this.bounds=new THREE.Box3().setFromPoints(points.map(p=>new THREE.Vector3(...p)));this.viewer.dirty=true;
  }
  update(){if(!this.route)return false;const t=(performance.now()-this.started)/1000;this.uniforms.reveal.value=this.reduced?1:clamp(t/1.7,0,1);this.uniforms.time.value=this.reduced?0:t*this.viewer.span*.018;
    const d=(t*this.viewer.span*.032)%this.route.length,p=pointOnPath(this.route.points,this.route.cumulative,d),q=pointOnPath(this.route.points,this.route.cumulative,Math.min(d+.05,this.route.length));
    this.marker.position.set(p[0],this.viewer.floorAt(p,this.viewer.baseEyeHeight)+this.viewer.span*.0025,p[2]);this.marker.rotation.y=Math.atan2(q[0]-p[0],q[2]-p[2]);this.marker.visible=!this.reduced&&this.uniforms.reveal.value===1&&!this.viewer.walking;
    return !this.reduced||t<1.7;
  }
}
