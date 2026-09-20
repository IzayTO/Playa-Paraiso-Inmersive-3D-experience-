import * as THREE from 'three';
import {clamp} from './math.js?v=1.1-flat';

const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Art-directed clear-sky palettes, not predictions of local weather.
export function solarAtmosphere(position,enabled=true) {
  const dawn=enabled?1-smooth(0,.30,position):0,dusk=enabled?smooth(.70,1,position):0;
  return {dawn,dusk,day:1-dawn-dusk};
}
export class Atmosphere {
  constructor(scene) {
    this.uniforms={inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},
      sunDirection:{value:new THREE.Vector3(0,1,0)},skyOn:{value:0},sunOn:{value:0},dawn:{value:0},dusk:{value:0}};
    // Clip-space background: no oversized object can intersect the model.
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const material=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,toneMapped:false,uniforms:this.uniforms,
      vertexShader:`uniform mat4 inverseProjection;uniform mat4 cameraWorld;varying vec3 vSkyDirection;
      void main(){vec4 ray=inverseProjection*vec4(position.xy,1.0,1.0);vSkyDirection=mat3(cameraWorld)*ray.xyz;
      gl_Position=vec4(position.xy,1.0,1.0);}`,
      fragmentShader:`varying vec3 vSkyDirection;uniform vec3 sunDirection;
      uniform float skyOn;uniform float sunOn;uniform float dawn;uniform float dusk;
      void main(){
        vec3 d=normalize(vSkyDirection);float h=max(d.y,0.0);
        vec3 zenith=mix(vec3(.065,.39,.78),vec3(.20,.25,.53),dawn);
        zenith=mix(zenith,vec3(.18,.11,.34),dusk);
        vec3 horizon=mix(vec3(.76,.88,.94),vec3(.94,.59,.60),dawn);
        horizon=mix(horizon,vec3(.90,.36,.20),dusk);
        vec3 sky=mix(horizon,zenith,pow(h,.47));
        vec2 azimuth=sunDirection.xz/max(length(sunDirection.xz),.001);
        float toward=clamp(dot(d.xz,azimuth)*.5+.5,0.0,1.0);
        float lowBand=exp(-abs(d.y-.065)*7.0);
        sky=mix(sky,vec3(1.0,.75,.57),dawn*lowBand*pow(toward,3.0)*.68);
        sky=mix(sky,vec3(1.0,.40,.11),dusk*lowBand*pow(toward,3.0)*.78);
        float oppositeBand=exp(-pow((d.y-.14)*7.0,2.0))*(1.0-toward);
        sky=mix(sky,vec3(.72,.46,.63),oppositeBand*(dawn*.32+dusk*.47));
        if(d.y<0.0)sky=mix(horizon,horizon*.70,min(1.0,-d.y*3.0));
        vec3 col=mix(vec3(.89,.935,.945),sky,skyOn);
        float alignment=max(0.0,dot(d,sunDirection));
        float halo=pow(alignment,90.0)*.17,disk=smoothstep(.99964,.99982,alignment);
        vec3 sunshine=mix(vec3(1.0,.97,.83),vec3(1.0,.65,.39),dawn);
        sunshine=mix(sunshine,vec3(1.0,.36,.12),dusk);
        col+=sunOn*sunshine*(halo+disk*1.8);
        gl_FragColor=vec4(col,1.0);
        #include <colorspace_fragment>
      }`
    });
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.renderOrder=-10000;this.mesh.frustumCulled=false;scene.add(this.mesh);
  }
  update(camera,direction,position,skyEnabled,sunEnabled) {
    camera.updateMatrixWorld();this.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.uniforms.cameraWorld.value.copy(camera.matrixWorld);this.uniforms.sunDirection.value.copy(direction);
    this.uniforms.skyOn.value=skyEnabled?1:0;this.uniforms.sunOn.value=sunEnabled?1:0;
    const color=solarAtmosphere(position,sunEnabled);this.uniforms.dawn.value=color.dawn;this.uniforms.dusk.value=color.dusk;
  }
}
