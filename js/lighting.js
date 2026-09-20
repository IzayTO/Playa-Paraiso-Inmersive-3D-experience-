import * as THREE from 'three';
import {sunDirection,clamp,advanceSun} from './math.js';

const SHADOW_GLSL=`
uniform sampler2D bakedMap0;
uniform sampler2D bakedMap1;
uniform mat4 bakedMatrix0;
uniform mat4 bakedMatrix1;
uniform float bakedBlend;
uniform float bakedEnabled;
uniform float bakedTexel;
varying vec3 vBakedWorld;
float cachedVisibility(sampler2D tex, mat4 matrix, vec3 world) {
  vec4 q=matrix*vec4(world,1.0); vec3 p=q.xyz/q.w;
  if(p.x<=0.002||p.x>=0.998||p.y<=0.002||p.y>=0.998||p.z<=0.0||p.z>=1.0)return 1.0;
  float result=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
    float stored=unpackRGBAToDepth(texture2D(tex,p.xy+vec2(float(x),float(y))*bakedTexel));
    result+=step(p.z-0.00028,stored);
  }
  return result/9.0;
}
`;

export class Lighting {
  constructor(viewer) {
    this.viewer=viewer;this.enabled=false;this.skyEnabled=false;this.path='diagonal';
    this.phase=.5;this.position=.5;this.playing=true;this.duration=10;this.cache=null;this.abort=null;
    this.mapsCount=49;
    this.resolution=matchMedia('(pointer:coarse)').matches?512:768;
    const fallback=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);fallback.needsUpdate=true;
    this.uniforms={bakedMap0:{value:fallback},bakedMap1:{value:fallback},bakedMatrix0:{value:new THREE.Matrix4()},bakedMatrix1:{value:new THREE.Matrix4()},bakedBlend:{value:0},bakedEnabled:{value:0},bakedTexel:{value:1/this.resolution}};
    this.fallback=fallback;
    this.sun=new THREE.DirectionalLight(0xfff3dc,0);this.sun.position.set(1,1,1);viewer.scene.add(this.sun,this.sun.target);
    this.ambient=new THREE.HemisphereLight(0xffffff,0x97aeb7,2.5);viewer.scene.add(this.ambient);
    this.fill=new THREE.DirectionalLight(0xffffff,1.5);this.fill.position.set(-4,7,5);viewer.scene.add(this.fill);
    this.skyUniforms={sunDirection:{value:new THREE.Vector3(0,1,0)},skyOn:{value:0},sunOn:{value:0}};
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1,32,18),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,uniforms:this.skyUniforms,
      vertexShader:'varying vec3 vSkyDirection; void main(){vSkyDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec3 vSkyDirection;uniform vec3 sunDirection;uniform float skyOn;uniform float sunOn;
      void main(){vec3 d=normalize(vSkyDirection);float h=max(d.y,0.0);
      vec3 zenith=vec3(.065,.39,.78), horizon=vec3(.76,.88,.94);
      vec3 blue=mix(horizon,zenith,pow(h,.47));
      if(d.y<0.0)blue=mix(horizon,vec3(.48,.66,.72),min(1.0,-d.y*3.0));
      vec3 col=mix(vec3(.89,.935,.945),blue,skyOn);
      float alignment=max(0.0,dot(d,sunDirection));
      float halo=pow(alignment,75.0)*.22;
      float disk=smoothstep(.99964,.9998,alignment);
      vec3 sunshine=mix(vec3(1.0,.55,.22),vec3(1.0,.97,.83),smoothstep(.05,.65,sunDirection.y));
      col+=sunOn*(sunshine*halo+sunshine*disk*2.0);
      gl_FragColor=vec4(col,1.0);
      #include <colorspace_fragment>
      }`
    }));this.sky.renderOrder=-1000;this.sky.frustumCulled=false;viewer.scene.add(this.sky);
  }
  decorate(material){
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='varying vec3 vBakedWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBakedWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <packing>','#include <packing>\n'+SHADOW_GLSL);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      float visibility=mix(1.0,mix(cachedVisibility(bakedMap0,bakedMatrix0,vBakedWorld),cachedVisibility(bakedMap1,bakedMatrix1,vBakedWorld),bakedBlend),bakedEnabled);
      reflectedLight.directDiffuse*=visibility; reflectedLight.directSpecular*=visibility;`);
    };
    material.customProgramCacheKey=()=> 'paraiso-cached-shadows-v1';
  }
  invalidate(){this.abort?.abort();this.abort=null;this.enabled=false;this.uniforms.bakedEnabled.value=0;this.disposeCache();this.update(0);}
  disposeCache(){if(this.cache){for(const frame of this.cache.frames)frame.target.dispose();this.cache=null;}this.uniforms.bakedMap0.value=this.fallback;this.uniforms.bakedMap1.value=this.fallback;}
  async prepare(path,onProgress=()=>{}) {
    if(this.cache?.path===path)return;
    this.abort?.abort();const controller=new AbortController();this.abort=controller;
    this.disposeCache();
    const viewer=this.viewer,renderer=viewer.renderer;
    const box=viewer.bounds.clone(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const extent=Math.max(size.x,size.z,2),pad=extent*.20;
    box.expandByVector(new THREE.Vector3(pad,Math.max(.1,size.y*.1),pad));box.min.y=Math.min(box.min.y,viewer.groundY);
    const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
    const localMaterials=[];
    // Copy world matrices only; shared vertex buffers are not duplicated.
    for(const source of viewer.meshes){
      const opacity=Array.isArray(source.material)?source.material[0].opacity:source.material.opacity;
      if(opacity<=.001)continue;
      const mat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
      mat.onBeforeCompile=shader=>{shader.uniforms.bakeOpacity={value:opacity};shader.fragmentShader='uniform float bakeOpacity;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>bakeOpacity) discard;`);};
      mat.customProgramCacheKey=()=>`cached-depth-${opacity}`;
      localMaterials.push(mat);const mesh=new THREE.Mesh(source.geometry,mat);mesh.matrixAutoUpdate=false;mesh.matrix.copy(source.matrixWorld);scene.add(mesh);
    }
    const camera=new THREE.OrthographicCamera(-extent,extent,extent,-extent,.1,extent*8);
    const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
    // One temporary depth buffer is reused for the entire sequence; retained frames
    // contain only packed RGBA depth. Mobile cache: 49 MiB, rather than 98 MiB.
    const scratch=new THREE.WebGLRenderTarget(this.resolution,this.resolution,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false});
    const copyOrigin=new THREE.Vector2(0,0);
    const frames=[];const oldTone=renderer.toneMapping;const oldTarget=renderer.getRenderTarget();const oldClear=renderer.getClearColor(new THREE.Color());const oldAlpha=renderer.getClearAlpha();
    try{
      for(let i=0;i<this.mapsCount;i++){
        if(controller.signal.aborted)throw new DOMException('Cancelado','AbortError');
        const dir=new THREE.Vector3(...sunDirection(i/(this.mapsCount-1),path));
        camera.position.copy(center).addScaledVector(dir,extent*3+size.y*2);camera.up.set(0,1,0);if(dir.y>.9999)camera.up.set(0,0,-1);camera.lookAt(center);camera.updateMatrixWorld(true);
        const lightBounds=new THREE.Box3().setFromPoints(corners.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse)));
        camera.left=lightBounds.min.x;camera.right=lightBounds.max.x;camera.bottom=lightBounds.min.y;camera.top=lightBounds.max.y;
        camera.near=Math.max(.01,-lightBounds.max.z-extent*.1);camera.far=-lightBounds.min.z+extent*.2;camera.updateProjectionMatrix();
        const texture=new THREE.FramebufferTexture(this.resolution,this.resolution);texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
        const target={texture,dispose:()=>texture.dispose()};
        const matrix=bias.clone().multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
        // Color packing must bypass tone mapping. Restore before yielding to the visible scene.
        renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(scratch);renderer.render(scene,camera);renderer.copyFramebufferToTexture(copyOrigin,texture);renderer.setRenderTarget(oldTarget);renderer.toneMapping=oldTone;
        frames.push({target,matrix});onProgress((i+1)/this.mapsCount);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      this.cache={path,frames};this.path=path;this.abort=null;
    }catch(error){for(const frame of frames)frame.target.dispose();throw error;}
    finally{renderer.setRenderTarget(oldTarget);renderer.toneMapping=oldTone;renderer.setClearColor(oldClear,oldAlpha);scratch.dispose();for(const mat of localMaterials)mat.dispose();scene.clear();}
  }
  setEnabled(enabled){this.enabled=enabled&&!!this.cache;this.uniforms.bakedEnabled.value=this.enabled?1:0;this.update(0);}
  setSky(enabled){this.skyEnabled=enabled;this.skyUniforms.skyOn.value=enabled?1:0;this.update(0);}
  seek(p){this.position=clamp(p,0,1);this.phase=this.position;this.playing=false;this.update(0);}
  update(dt){
    if(this.enabled&&this.playing){const next=advanceSun(this.phase,dt,this.duration);this.phase=next.phase;this.position=next.position;}
    const dir=new THREE.Vector3(...sunDirection(this.position,this.path));
    this.sun.position.copy(this.viewer.center||new THREE.Vector3()).addScaledVector(dir,100);this.sun.target.position.copy(this.viewer.center||new THREE.Vector3());
    this.sun.intensity=this.enabled?2.7*(.4+.6*Math.sqrt(dir.y)):0;
    this.sun.color.setRGB(1,.69+.25*dir.y,.40+.48*dir.y);
    this.ambient.intensity=this.enabled?1.35:2.15;this.fill.intensity=this.enabled?0:1.15;
    this.ambient.color.set(this.skyEnabled?0xd4eaff:0xffffff);
    this.skyUniforms.sunOn.value=this.enabled?1:0;this.skyUniforms.sunDirection.value.copy(dir);
    this.sky.position.copy(this.viewer.camera.position);this.sky.scale.setScalar(this.viewer.camera.far*.7);
    if(this.enabled&&this.cache){const at=this.position*(this.mapsCount-1),a=Math.floor(at),b=Math.min(this.mapsCount-1,a+1);const fa=this.cache.frames[a],fb=this.cache.frames[b];
      this.uniforms.bakedMap0.value=fa.target.texture;this.uniforms.bakedMap1.value=fb.target.texture;
      this.uniforms.bakedMatrix0.value.copy(fa.matrix);this.uniforms.bakedMatrix1.value.copy(fb.matrix);this.uniforms.bakedBlend.value=at-a;
    }
  }
}
