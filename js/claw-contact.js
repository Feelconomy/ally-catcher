import * as THREE from 'three';

// Calculate hinge stops only. Never modify the GLB's geometry or finger scale.
export function clawContacts(claw, fingers, axes, toy, open, closed) {
  claw.updateWorldMatrix(true, true); toy.updateWorldMatrix(true, true);
  const inverse = claw.matrixWorld.clone().invert(), triangles = [];
  toy.traverse(mesh => {
    if (!mesh.isMesh) return;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const vertices = Array.from({length:p.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));
    for(let i=0;i<(index?.count ?? p.count);i+=3)
      triangles.push([0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]));
  });
  const step=.01;
  const probes = fingers.map((finger,i) => {
    const radial=new THREE.Vector3(axes[i].z,0,-axes[i].x), envelope=new Map(), points=[];
    for(const triangle of triangles){
      const poly=triangle.map(p=>new THREE.Vector3(p.dot(radial),p.y,p.dot(axes[i])));
      if(Math.max(...poly.map(p=>p.x))<=0)continue;
      const low=Math.floor(Math.min(...poly.map(p=>p.y))/step);
      const high=Math.floor(Math.max(...poly.map(p=>p.y))/step);
      const left=Math.max(-6,Math.floor(Math.min(...poly.map(p=>p.z))/step));
      const right=Math.min(6,Math.floor(Math.max(...poly.map(p=>p.z))/step));
      for(let y=low;y<=high;y++)for(let z=left;z<=right;z++){
        const key=y*32+z;
        if(!envelope.has(key))envelope.set(key,[]);
        envelope.get(key).push(poly);
      }
    }
    const local=finger.matrixWorld.clone().invert();
    finger.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const matrix=local.clone().multiply(mesh.matrixWorld), p=mesh.geometry.attributes.position, index=mesh.geometry.index;
      const vertices=Array.from({length:p.count},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(matrix));
      points.push(...vertices);
      // Long rod triangles need interior probes as well as their end vertices.
      for(let j=0;j<(index?.count??p.count);j+=3){
        const a=vertices[index?index.getX(j):j],b=vertices[index?index.getX(j+1):j+1],c=vertices[index?index.getX(j+2):j+2];
        for(const t of [.25,.5,.75])points.push(a.clone().lerp(b,t),b.clone().lerp(c,t),c.clone().lerp(a,t));
      }
    });
    return {radial,envelope,points};
  });
  const overlaps=(i,angle,lift)=>{
    const q=new THREE.Quaternion().setFromAxisAngle(axes[i],angle), p=new THREE.Vector3();
    return probes[i].points.some(point=>{
      p.copy(point).applyQuaternion(q).add(fingers[i].position);
      const y=p.y+lift,z=p.dot(axes[i]),radius=p.dot(probes[i].radial);
      const candidates=probes[i].envelope.get(Math.floor(y/step)*32+Math.floor(z/step))||[];
      // Exact radial intersection at this probe's height AND lateral position.
      // Grid cells only accelerate lookup; they do not inflate the surface.
      return candidates.some(([a,b,c])=>{
        const by=b.y-a.y,bz=b.z-a.z,cy=c.y-a.y,cz=c.z-a.z;
        const det=by*cz-bz*cy;
        if(Math.abs(det)<1e-12)return false;
        const u=((y-a.y)*cz-(z-a.z)*cy)/det;
        const v=(by*(z-a.z)-bz*(y-a.y))/det;
        if(u<0||v<0||u+v>1)return false;
        return radius<a.x+u*(b.x-a.x)+v*(c.x-a.x)+.0008;
      });
    });
  };
  // If even the open claw overlaps, stop its descent higher, not stretch it.
  let lift=0;
  while(lift<1 && fingers.some((_,i)=>overlaps(i,open,lift)))lift+=.01;
  const limits=fingers.map((_,i)=>{
    let safe=open;
    for(let angle=open-.01;angle>=closed-.01;angle-=.01){
      const next=Math.max(closed,angle);
      if(overlaps(i,next,lift)){
        let blocked=next;
        for(let j=0;j<8;j++){
          const mid=(safe+blocked)/2;
          if(overlaps(i,mid,lift))blocked=mid;else safe=mid;
        }
        break;
      }
      safe=next;
      if(next===closed)break;
    }
    return safe;
  });
  return {lift,limits};
}
