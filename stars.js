import * as THREE from 'three';

const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function starVisibility(sunHeight,skyEnabled,sunEnabled){
  return skyEnabled&&sunEnabled?1-smooth(.075,.43,sunHeight):0;
}

// One fixed, non-repeating field over the upper hemisphere. No lower half,
// spherical shell, time noise or per-frame geometry generation is needed.
export function createStarGeometry(count=1400,seed=82147){
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const positions=[],sizes=[],brightness=[],colors=[];

  // Campo estelar base: conserva el aspecto original, con un poco más de presencia.
  for(let i=0;i<count;i++){
    const y=.018+random()*.982,phi=random()*Math.PI*2,r=Math.sqrt(1-y*y);
    positions.push(Math.cos(phi)*r,y,Math.sin(phi)*r);
    const light=.17+Math.pow(random(),3.7)*.83,tint=random();
    brightness.push(light);sizes.push(1.65+light*2.25);
    const color=tint<.18?[1,.86,.73]:tint>.73?[.76,.86,1]:[.94,.96,1];colors.push(...color);
  }

  // Vía Láctea procedural y tenue.
  // No usa textura ni una banda uniforme: alterna densidad, huecos,
  // una franja oscura central y pequeños sectores más ricos.
  const milkyCount=Math.round(count*1.45);
  const galacticNormal=new THREE.Vector3(.34,.56,-.755).normalize();
  const axisHint=Math.abs(galacticNormal.y)>.9
    ?new THREE.Vector3(1,0,0)
    :new THREE.Vector3(0,1,0);
  const galacticU=new THREE.Vector3().crossVectors(galacticNormal,axisHint).normalize();
  const galacticV=new THREE.Vector3().crossVectors(galacticNormal,galacticU).normalize();
  const direction=new THREE.Vector3();
  const galacticCenter=4.82;
  let added=0,attempts=0;

  while(added<milkyCount&&attempts<milkyCount*12){
    attempts++;
    const theta=random()*Math.PI*2;

    // Distribución aproximadamente gaussiana alrededor del plano galáctico.
    const latitude=(random()+random()+random()+random()+random()+random()-3)*.072;
    const cosB=Math.cos(latitude),sinB=Math.sin(latitude);
    direction.set(0,0,0)
      .addScaledVector(galacticU,Math.cos(theta)*cosB)
      .addScaledVector(galacticV,Math.sin(theta)*cosB)
      .addScaledVector(galacticNormal,sinB)
      .normalize();

    if(direction.y<.02)continue;

    // Estructura irregular para evitar una línea artificial.
    const structure=THREE.MathUtils.clamp(
      .48+
      .18*Math.sin(theta*3.17+.8)+
      .13*Math.sin(theta*7.31+2.2)+
      .08*Math.sin(theta*12.73-1.1),
      .12,.86
    );

    const delta=Math.atan2(
      Math.sin(theta-galacticCenter),
      Math.cos(theta-galacticCenter)
    );
    const bulge=Math.exp(-(delta*delta)/(2*.42*.42));

    const keepChance=THREE.MathUtils.clamp(.34+structure*.43+bulge*.16,.22,.88);
    if(random()>keepChance)continue;

    // Carril de polvo: el centro queda parcialmente vacío y más oscuro.
    const lane=Math.abs(latitude);
    if(lane<.018&&random()<.64)continue;
    if(lane<.038&&random()<.28)continue;

    let light=.028+Math.pow(random(),2.0)*(.055+structure*.09+bulge*.12);
    if(lane<.055)light*=.60+.40*smooth(.018,.055,lane);
    light=THREE.MathUtils.clamp(light,.018,.27);

    positions.push(direction.x,direction.y,direction.z);
    brightness.push(light);
    sizes.push(.75+light*4.1+random()*.42);

    const tint=random();
    const color=bulge>.35&&tint<.34
      ?[1,.88,.74]
      :tint>.78
        ?[.73,.84,1]
        :[.91,.94,1];
    colors.push(...color);
    added++;
  }

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('starSize',new THREE.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('starBrightness',new THREE.Float32BufferAttribute(brightness,1));
  geometry.setAttribute('starColor',new THREE.Float32BufferAttribute(colors,3));
  return geometry;
}

export class Stars {
  constructor(scene){
    this.uniforms={sunDirection:{value:new THREE.Vector3(0,1,0)},visibility:{value:0},pixelScale:{value:1}};
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,depthWrite:false,depthTest:false,
      transparent:false,blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:`attribute float starSize;attribute float starBrightness;attribute vec3 starColor;
        uniform vec3 sunDirection;uniform float visibility;uniform float pixelScale;
        varying vec3 vStarColor;varying float vStarAlpha;
        void main(){
          vec3 direction=normalize(position);
          vec3 viewDirection=mat3(viewMatrix)*direction;
          vec4 projected=projectionMatrix*vec4(viewDirection,1.0);
          gl_Position=projected.w>0.0?vec4(projected.xy,projected.w*.99999,projected.w):vec4(2.0,2.0,2.0,1.0);
          gl_PointSize=starSize*pixelScale;
          vec2 sunAzimuth=sunDirection.xz/max(length(sunDirection.xz),.001);
          float away=clamp(.5-.5*dot(direction.xz,sunAzimuth),0.0,1.0);
          float heightFade=smoothstep(.03,.25,direction.y);
          vStarAlpha=visibility*starBrightness*heightFade*(.24+.76*away)*1.06;
          vStarColor=starColor;
        }`,
      fragmentShader:`varying vec3 vStarColor;varying float vStarAlpha;
        void main(){
          vec2 p=gl_PointCoord*2.0-1.0;float r2=dot(p,p);
          float glow=exp(-3.8*r2)*(1.0-smoothstep(.55,1.0,r2));
          gl_FragColor=vec4(vStarColor,glow*vStarAlpha);
          #include <colorspace_fragment>
        }`
    });
    this.mesh=new THREE.Points(createStarGeometry(),material);this.mesh.frustumCulled=false;
    // Kept in the opaque queue so it is drawn immediately after the sky and
    // before the ground/buildings. Translucent objects still show the sky.
    this.mesh.renderOrder=-9999;this.mesh.visible=false;scene.add(this.mesh);
  }
  update(camera,direction,skyEnabled,sunEnabled){
    this.uniforms.visibility.value=starVisibility(direction.y,skyEnabled,sunEnabled);
    this.uniforms.sunDirection.value.copy(direction);
    this.mesh.visible=this.uniforms.visibility.value>0;
    const ratio=Math.min(globalThis.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.65:2);
    this.uniforms.pixelScale.value=ratio*THREE.MathUtils.clamp(70/camera.fov,.75,1.55);
  }
}
