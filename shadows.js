import * as THREE from 'three';

// Current solar projection, independent of the viewing camera. Separate maps
// prevent a translucent roof from hiding an opaque blocker behind it.
const RECEIVER = `
uniform sampler2D solarOpaque;
uniform sampler2D solarGlass;
uniform mat4 solarMatrix;
uniform vec3 solarDirection;
uniform vec3 solarPlaneX;
uniform vec3 solarPlaneY;
uniform float solarEnabled;
uniform float solarTexel;
uniform float solarNormalBias;
uniform float solarDepthBias;
varying vec3 vSolarWorld;
float solarSample(sampler2D tex, vec2 uv, vec3 p, vec2 slope) {
  vec4 s = texture2D(tex, uv);
  float stored = dot(s.rgb, vec3(1.0/65536.0, 1.0/256.0, 1.0) * (255.0/256.0));
  float receiver = p.z + dot(slope, uv-p.xy);
  return 1.0 - s.a * step(stored + solarDepthBias, receiver);
}
float solarBilinear(sampler2D tex, vec2 uv, vec3 p, vec2 slope) {
  vec2 coord = uv / solarTexel - 0.5;
  vec2 base = (floor(coord) + 0.5) * solarTexel;
  vec2 f = fract(coord);
  return mix(mix(solarSample(tex,base,p,slope),solarSample(tex,base+vec2(solarTexel,0.0),p,slope),f.x),
             mix(solarSample(tex,base+vec2(0.0,solarTexel),p,slope),solarSample(tex,base+vec2(solarTexel),p,slope),f.x),f.y);
}
float solarFiltered(sampler2D tex, vec3 p, vec2 slope) {
  vec2 o = vec2(solarTexel * 0.6, 0.0);
  return .25 * (solarBilinear(tex,p.xy-o.xy,p,slope)+solarBilinear(tex,p.xy+o.xy,p,slope)
              +solarBilinear(tex,p.xy-o.yx,p,slope)+solarBilinear(tex,p.xy+o.yx,p,slope));
}
float solarVisibility(vec3 worldNormal) {
  if (solarEnabled < .5) return 1.0;
  float facing = max(dot(worldNormal,solarDirection),0.0);
  if(facing<.015)return 1.0;
  vec3 world = vSolarWorld + worldNormal * solarNormalBias * (1.0-facing);
  vec3 p = (solarMatrix * vec4(world,1.0)).xyz;
  if(p.x<=0.0||p.x>=1.0||p.y<=0.0||p.y>=1.0||p.z<=0.0||p.z>=1.0)return 1.0;
  // Compare each tap against the receiver's local plane, not one constant
  // depth. This removes striped self-shadows without detaching the shadows.
  vec2 slope=vec2(dot(worldNormal,solarPlaneX),dot(worldNormal,solarPlaneY))/facing;
  float visibility=solarFiltered(solarOpaque,p,slope)*solarFiltered(solarGlass,p,slope);
  float edge=min(min(p.x,1.0-p.x),min(p.y,1.0-p.y));
  return mix(1.0,visibility,smoothstep(0.0,.025,edge));
}
`;

export class LiveShadows {
  constructor(viewer) {
    this.viewer=viewer;this.ready=false;this.lastDirection=new THREE.Vector3(Infinity,Infinity,Infinity);
    this.fallback=new THREE.DataTexture(new Uint8Array([255,255,255,0]),1,1);this.fallback.needsUpdate=true;
    this.uniforms={solarOpaque:{value:this.fallback},solarGlass:{value:this.fallback},solarMatrix:{value:new THREE.Matrix4()},
      solarDirection:{value:new THREE.Vector3(0,1,0)},solarPlaneX:{value:new THREE.Vector3()},solarPlaneY:{value:new THREE.Vector3()},solarEnabled:{value:0},solarTexel:{value:1/1024},solarNormalBias:{value:0},solarDepthBias:{value:.00002}};
    this.camera=new THREE.OrthographicCamera();
    this.biasMatrix=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  }
  decorate(material) {
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='varying vec3 vSolarWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvSolarWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <packing>','#include <packing>\n'+RECEIVER);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        float visibility=solarVisibility(inverseTransformDirection(normal,viewMatrix));
        reflectedLight.directDiffuse*=visibility;reflectedLight.directSpecular*=visibility;`);
    };
    material.customProgramCacheKey=()=>'paraiso-live-shadows-1.1';
  }
  makeDepthMaterial(opacity) {
    const material=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide,blending:THREE.NoBlending});
    material.onBeforeCompile=shader=>{
      shader.uniforms.casterOpacity={value:opacity};
      shader.fragmentShader='uniform float casterOpacity;\n'+shader.fragmentShader;
      // Keep the 24 most significant depth bits; alpha stores transmission.
      shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = packDepthToRGBA( fragCoordZ );',
        'gl_FragColor=vec4(packDepthToRGBA(fragCoordZ).yzw,casterOpacity);');
    };
    material.customProgramCacheKey=()=>'paraiso-depth-opacity-1.1';return material;
  }
  prepare() {
    this.dispose();const viewer=this.viewer,coarse=matchMedia('(pointer:coarse)').matches;
    this.resolution=Math.min(coarse?1024:1536,viewer.renderer.capabilities.maxTextureSize);
    this.uniforms.solarTexel.value=1/this.resolution;
    this.center=viewer.bounds.getCenter(new THREE.Vector3());this.size=viewer.bounds.getSize(new THREE.Vector3());
    this.extent=Math.max(this.size.x,this.size.y,this.size.z,4);
    const box=viewer.bounds.clone().expandByScalar(this.extent*.3);box.min.y=Math.min(box.min.y,viewer.groundY);
    this.corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])this.corners.push(new THREE.Vector3(x,y,z));
    this.opaque=new THREE.Scene();this.glass=new THREE.Scene();this.materials=new Map();viewer.group.updateMatrixWorld(true);
    for(const source of viewer.meshes){
      const opacity=source.userData.record.opacity;if(opacity<=.001)continue;
      if(!this.materials.has(opacity))this.materials.set(opacity,this.makeDepthMaterial(opacity));
      const proxy=new THREE.Mesh(source.geometry,this.materials.get(opacity));proxy.matrixAutoUpdate=false;proxy.matrix.copy(source.matrixWorld);
      (opacity>=.999?this.opaque:this.glass).add(proxy);
    }
    const target=()=>new THREE.WebGLRenderTarget(this.resolution,this.resolution,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false,generateMipmaps:false});
    this.opaqueTarget=target();this.glassTarget=this.glass.children.length?target():null;
    this.uniforms.solarOpaque.value=this.opaqueTarget.texture;this.uniforms.solarGlass.value=this.glassTarget?.texture||this.fallback;this.ready=true;
  }
  render(direction) {
    if(!this.ready||this.lastDirection.distanceToSquared(direction)<1e-18)return;
    const renderer=this.viewer.renderer,camera=this.camera;
    camera.position.copy(this.center).addScaledVector(direction,this.extent*4);
    // Perpendicular to both arc variants, avoiding a camera roll flip at noon.
    camera.up.set(0,0,1);camera.lookAt(this.center);camera.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromPoints(this.corners.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse)));
    camera.left=b.min.x;camera.right=b.max.x;camera.bottom=b.min.y;camera.top=b.max.y;
    camera.near=Math.max(.01,-b.max.z-this.extent*.2);camera.far=-b.min.z+this.extent*.2;camera.updateProjectionMatrix();
    this.uniforms.solarMatrix.value.copy(this.biasMatrix).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);this.uniforms.solarDirection.value.copy(direction);
    this.uniforms.solarPlaneX.value.setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar((camera.right-camera.left)/(camera.far-camera.near));
    this.uniforms.solarPlaneY.value.setFromMatrixColumn(camera.matrixWorld,1).multiplyScalar((camera.top-camera.bottom)/(camera.far-camera.near));
    const texel=Math.max(camera.right-camera.left,camera.top-camera.bottom)/this.resolution;
    this.uniforms.solarNormalBias.value=texel*.75;this.uniforms.solarDepthBias.value=Math.max(.000006,texel*.12/(camera.far-camera.near));
    const oldTarget=renderer.getRenderTarget(),oldTone=renderer.toneMapping,oldClear=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear;
    try{
      renderer.toneMapping=THREE.NoToneMapping;renderer.autoClear=true;renderer.setClearColor(0xffffff,0);
      renderer.setRenderTarget(this.opaqueTarget);renderer.render(this.opaque,camera);
      if(this.glassTarget){renderer.setRenderTarget(this.glassTarget);renderer.render(this.glass,camera);}
      this.lastDirection.copy(direction);
    }finally{renderer.setRenderTarget(oldTarget);renderer.toneMapping=oldTone;renderer.setClearColor(oldClear,oldAlpha);renderer.autoClear=oldAuto;}
  }
  dispose() {
    this.ready=false;this.uniforms.solarEnabled.value=0;this.uniforms.solarOpaque.value=this.fallback;this.uniforms.solarGlass.value=this.fallback;
    this.opaqueTarget?.dispose();this.glassTarget?.dispose();this.opaqueTarget=null;this.glassTarget=null;
    for(const material of this.materials?.values()||[])material.dispose();
    this.materials?.clear();this.opaque?.clear();this.glass?.clear();this.lastDirection.set(Infinity,Infinity,Infinity);
  }
}
