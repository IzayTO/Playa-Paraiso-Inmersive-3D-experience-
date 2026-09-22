import * as THREE from 'three';

export function mapPoint(point,center,heading=0,scale=1){const dx=point[0]-center[0],dz=point[2]-center[2],c=Math.cos(heading),s=Math.sin(heading);return [(c*dx+s*dz)*scale,(-s*dx+c*dz)*scale];}

// One cached aerial canvas; no second WebGL view or additional shadow pass.
export class Minimap {
  constructor(viewer,canvas){this.viewer=viewer;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.base=document.createElement('canvas');this.base.width=this.base.height=900;this.headingUp=false;this.opacity=.9;}
  setProject(project){
    this.project=project;const v=this.viewer;this.center=v.center.toArray();this.span=v.span*1.18;const ctx=this.base.getContext('2d');ctx.clearRect(0,0,900,900);ctx.fillStyle='#eef2eb';ctx.fillRect(0,0,900,900);const scale=900/this.span,triangles=[];
    for(const mesh of v.meshes){const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),count=index?index.count:positions.count;
      for(let i=0;i<count&&triangles.length<90000;i+=3){a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
        ab.subVectors(b,a);ac.subVectors(c,a);if(Math.abs(ab.cross(ac).y)<.00001)continue;
        triangles.push({p:[a.toArray(),b.toArray(),c.toArray()],y:(a.y+b.y+c.y)/3,opacity:mesh.userData.record.opacity,path:mesh.userData.record.propType==='path'});
      }
    }
    triangles.sort((a,b)=>a.y-b.y);
    for(const triangle of triangles){ctx.globalAlpha=triangle.opacity;ctx.beginPath();triangle.p.forEach((p,i)=>{const [x,y]=mapPoint(p,this.center,0,scale);i?ctx.lineTo(450+x,450+y):ctx.moveTo(450+x,450+y);});ctx.closePath();ctx.fillStyle=triangle.path?'#d2dcd6':'#ffffff';ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.55;ctx.stroke();}ctx.globalAlpha=1;
  }
  draw(point,yaw,route,destination){
    if(!this.project)return;const canvas=this.canvas,ctx=this.ctx,size=220,dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==size*dpr){canvas.width=canvas.height=size*dpr;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);ctx.save();ctx.beginPath();ctx.arc(110,110,104,0,Math.PI*2);ctx.clip();ctx.fillStyle='#edf3ef';ctx.fillRect(0,0,size,size);
    const heading=this.headingUp?yaw:0,range=Math.max(this.span*.48,this.viewer.baseEyeHeight*16),scale=200/range;
    ctx.save();ctx.translate(110,110);ctx.rotate(-heading);ctx.drawImage(this.base,(this.center[0]-point[0]-this.span/2)*scale,(this.center[2]-point[2]-this.span/2)*scale,this.span*scale,this.span*scale);ctx.restore();
    const plot=p=>mapPoint(p,point,heading,scale).map(v=>v+110);
    const nodes=new Map(this.project.network.nodes.map(n=>[n.id,n]));ctx.strokeStyle='#739e9b';ctx.lineWidth=2;ctx.beginPath();if(this.showRoutes!==false)for(const e of this.project.network.edges){const a=plot(nodes.get(e.a).position),b=plot(nodes.get(e.b).position);ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();
    if(route&&this.showRoutes!==false){ctx.beginPath();route.points.forEach((p,i)=>{const q=plot(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.lineWidth=4;ctx.strokeStyle='#00858b';ctx.stroke();}
    for(const p of this.project.places){if(!p.visible||(this.filter&&!this.filter(p)&&p.id!==destination?.id))continue;const q=plot(p.position);ctx.beginPath();ctx.arc(...q,p.id===destination?.id?5:3,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();ctx.save();ctx.translate(110,110);ctx.rotate(this.headingUp?0:yaw);ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,8);ctx.lineTo(0,5);ctx.lineTo(-7,8);ctx.closePath();ctx.fillStyle='#003c51';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.font='600 11px Outfit,Arial';ctx.textAlign='center';ctx.textBaseline='middle';for(const [label,angle]of [['N',0],['E',Math.PI/2],['S',Math.PI],['O',Math.PI*1.5]]){const a=angle-heading,x=110+Math.sin(a)*99,y=110-Math.cos(a)*99;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#fffdf5';ctx.fill();ctx.fillStyle='#003c51';ctx.fillText(label,x,y);}
    canvas.style.opacity=String(this.opacity);
  }
}
