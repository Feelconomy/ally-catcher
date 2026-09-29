import * as THREE from 'three';

function clipWidth(poly, limit, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = sign * (a.z - limit), db = sign * (b.z - limit);
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) out.push(a.clone().lerp(b, da / (da - db)));
  }
  return out;
}

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
  const step=.008;
  const probes = fingers.map((finger,i) => {
    const radial=new THREE.Vector3(axes[i].z,0,-axes[i].x), envelope=new Map(), points=[];
    for(const triangle of triangles){
      let poly=triangle.map(p=>new THREE.Vector3(p.dot(radial),p.y,p.dot(axes[i])));
      poly=clipWidth(clipWidth(poly,.055,1),-.055,-1);
      if(!poly.length)continue;
      const radius=Math.max(...poly.map(p=>p.x));
      if(radius<=0)continue;
      const low=Math.floor((Math.min(...poly.map(p=>p.y))-.006)/step);
      const high=Math.floor((Math.max(...poly.map(p=>p.y))+.006)/step);
      for(let j=low;j<=high;j++)envelope.set(j,Math.max(envelope.get(j)||0,radius+.006));
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
      const boundary=probes[i].envelope.get(Math.floor((p.y+lift)/step));
      return boundary!==undefined && p.dot(probes[i].radial)<boundary;
    });
  };
  // If even the open claw overlaps, stop its descent higher, not stretch it.
  let lift=0;
  while(lift<1 && fingers.some((_,i)=>overlaps(i,open,lift)))lift+=.01;
  const limits=fingers.map((_,i)=>{
    let safe=open;
    for(let angle=open-.01;angle>=closed-.01;angle-=.01){
      const next=Math.max(closed,angle);
      if(overlaps(i,next,lift))break;
      safe=next;
      if(next===closed)break;
    }
    return safe;
  });
  return {lift,limits};
}
