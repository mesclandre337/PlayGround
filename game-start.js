import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

// Brassworks: a compact, first-person social deduction round.
const canvas = document.querySelector('#game-canvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171f1d);
scene.fog = new THREE.FogExp2(0x171f1d, 0.016);
const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, .08, 100);
camera.rotation.order = 'YXZ';
const clock = new THREE.Clock();
const world = new THREE.Group(); scene.add(world);
const solidBoxes = [], taskObjects = [], bodies = [], crew = [], sceneLights = [], steamMeshes = [], gearMeshes = [];
let running=false, paused=true, meeting=false, ended=false, role='crew', playerTasks=0, totalTasks=4;
let elapsed=0, roundSeconds=150, emergencyUsed=false, lastKillAt=-100, killCooldown=0, abilityCooldown=0;
let yaw=0, pitch=0, mouseLocked=false, mobile=false, moveForward=0, moveSide=0, sprinting=false;
let activeTask=null, meetingTimer=20, lastToast=0;
const clockDisplay=document.querySelector('#timer');
const crewNames=['Marlow','Ada','Bram','Iris','Otto'];
const colors=[0x3f8e93,0x7763a5,0xa9563e,0x8e9b55,0xb98242];
const player={pos:new THREE.Vector3(0,0,3),velocity:new THREE.Vector3(),height:1.62,alive:true};
function mat(color,rough=.72,metal=0){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});}
const M={floor:mat(0x343b35,.94),wall:mat(0x343b34,.78),dark:mat(0x171e1c,.65,.25),brass:mat(0xb78a4c,.38,.72),bright:mat(0xd0a457,.3,.76),rust:mat(0x874936,.75,.22),iron:mat(0x59645f,.42,.7),pipe:mat(0x816341,.38,.7),glass:new THREE.MeshStandardMaterial({color:0x50736a,roughness:.2,metalness:.3,emissive:0x15251d}),glow:new THREE.MeshStandardMaterial({color:0xe8a958,emissive:0xd77932,emissiveIntensity:1.6}),redGlow:new THREE.MeshStandardMaterial({color:0xc9573b,emissive:0x932b1b,emissiveIntensity:1.2})};
const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,16),sphereGeo=new THREE.SphereGeometry(1,16,12);
function addMesh(parent,geo,material,x,y,z,sx=1,sy=1,sz=1,cast=true){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;}
function addBox(parent,material,x,y,z,sx,sy,sz,solid=false){const m=addMesh(parent,boxGeo,material,x,y,z,sx,sy,sz);if(solid)solidBoxes.push({x,z,hx:sx/2,hz:sz/2,hy:sy});return m;}
function addCylinder(parent,material,x,y,z,r,h,rotX=0,rotZ=0){const m=addMesh(parent,cylGeo,material,x,y,z,r,h,r);m.rotation.x=rotX;m.rotation.z=rotZ;return m;}
function addLight(x,y,z,color,intensity,dist=10){const l=new THREE.PointLight(color,intensity,dist,2);l.position.set(x,y,z);scene.add(l);sceneLights.push(l);return l;}
function addLabel(text,x,y,z,tint='#d9b77d'){const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='rgba(15,20,17,.82)';ctx.fillRect(0,0,512,100);ctx.strokeStyle='rgba(208,164,87,.9)';ctx.lineWidth=4;ctx.strokeRect(3,3,506,94);ctx.fillStyle=tint;ctx.font='bold 34px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,50);const tex=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(2.5,.49,1);world.add(sprite);return sprite;}
function makeWorld(){
  scene.add(new THREE.HemisphereLight(0xa6b6a4,0x3a2920,1.05));const key=new THREE.DirectionalLight(0xffd49a,2.1);key.position.set(-7,16,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-24;key.shadow.camera.right=24;key.shadow.camera.top=24;key.shadow.camera.bottom=-24;scene.add(key);
  addBox(world,M.floor,0,-.28,0,38,.55,38);addBox(world,M.wall,0,2,-18.7,38,4,.7,true);addBox(world,M.wall,0,2,18.7,38,4,.7,true);addBox(world,M.wall,-18.7,2,0,.7,4,38,true);addBox(world,M.wall,18.7,2,0,.7,4,38,true);
  for(let i=-16;i<=16;i+=4){addBox(world,M.dark,i,3,-18.25,.18,2.2,.2);addBox(world,M.dark,i,3,18.25,.18,2.2,.2);addBox(world,M.dark,-18.25,3,i,.2,2.2,.18);addBox(world,M.dark,18.25,3,i,.2,2.2,.18);}
  for(let i=-16;i<=16;i+=4){addBox(world,M.brass,i,.015,0,.045,.03,34);addBox(world,M.brass,0,.016,i,34,.03,.045);}for(let x=-15;x<=15;x+=3)for(let z=-15;z<=15;z+=3)if((x+z)%6===0)addBox(world,M.dark,x,.012,z,2.7,.025,.025);
  for(const [x,z] of [[-7,-7],[7,-7],[-7,7],[7,7]]){addBox(world,M.dark,x,2.35,z,1.15,4.7,1.15,true);addBox(world,M.brass,x,4.8,z,1.3,.16,1.3);addCylinder(world,M.pipe,x+.68,2.4,z+.68,.12,4.5);addLight(x,4.15,z,0xffbd66,.8,6);}
  addCylinder(world,M.iron,0,1.45,0,2.35,2.9);addCylinder(world,M.brass,0,3.05,0,2.1,.22);addCylinder(world,M.dark,0,3.35,0,1.35,.4);addCylinder(world,M.bright,0,3.57,0,1.1,.08);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const pipe=addCylinder(world,i%2?M.brass:M.iron,Math.cos(a)*2.5,2.2,Math.sin(a)*2.5,.19,3.5);pipe.rotation.z=Math.PI/2;pipe.rotation.y=-a;}
  addCylinder(world,M.rust,0,4.2,0,.65,.7);addCylinder(world,M.bright,0,4.59,0,.9,.09);addLight(0,5,0,0xff9f49,2.4,11);
  for(const z of [-14,14]){addBox(world,M.iron,0,1.2,z,24,.2,.9);for(let x=-11;x<=11;x+=4)addBox(world,M.brass,x,2.1,z,.16,2,.16);}
  for(const z of [-16.6,16.6]){addCylinder(world,M.pipe,0,3.5,z,.16,31,0,Math.PI/2);for(let x=-14;x<=14;x+=4)addBox(world,M.brass,x,3.35,z,.12,.55,.3);}
  for(const x of [-16.6,16.6]){const p=addCylinder(world,M.pipe,x,3.5,0,.16,31);p.rotation.z=Math.PI/2;for(let z=-14;z<=14;z+=4)addBox(world,M.brass,x,3.35,z,.3,.55,.12);}
  for(const [x,z] of [[-18,0],[18,0],[0,-18],[0,18]])for(let k=-1;k<=1;k++){const px=x===0?k*8:x,pz=z===0?k*8:z,horizontal=x===0;addBox(world,M.dark,px,2.45,pz,horizontal?2.1:.18,1.25,horizontal?.18:2.1);for(let n=0;n<5;n++)addBox(world,M.iron,px+(horizontal?(n-2)*.34:0),2.45,pz+(horizontal?0:(n-2)*.34),horizontal?.06:1.8,.9,horizontal?1.8:.06);addLight(px+(x===0?0:(x>0?-1:1)),3.1,pz+(z===0?0:(z>0?-1:1)),0xd78e4c,.75,5);}
  buildStation(-12,-10,'PUMP CONTROL',0);buildStation(12,-10,'GEAR TRAIN',1);buildStation(-12,10,'COOLANT ARRAY',2);buildStation(12,10,'PRESSURE VALVE',3);
  for(const [x,z] of [[-15,-5],[15,-5],[-15,5],[15,5],[-5,-15],[5,-15],[-5,15],[5,15]]){addBox(world,M.dark,x,.7,z,1.3,1.4,1.3,true);addBox(world,M.brass,x,.15,z,1.45,.12,1.45);addBox(world,M.iron,x,1.45,z,1.45,.12,1.45);addBox(world,M.rust,x,.82,z,.7,.25,.7);}
  for(let x=-12;x<=12;x+=8){addCylinder(world,M.dark,x,6.1,0,.08,34,0,Math.PI/2);for(let z=-14;z<=14;z+=5)addCylinder(world,M.brass,x,4.9,z,.04,2.3);}
  for(const [x,z,r] of [[-4,-4,.8],[4,-4,.65],[-4,4,.65],[4,4,.8]]){const g=new THREE.Group();g.position.set(x,5,z);world.add(g);addCylinder(g,M.bright,0,0,0,r,.12,Math.PI/2);for(let n=0;n<10;n++){const a=n*Math.PI/5;addBox(g,M.brass,Math.cos(a)*r,0,Math.sin(a)*r,.16,.13,.36).rotation.y=-a;}gearMeshes.push(g);}
  for(const [x,z] of [[-8,0],[8,0],[0,-8],[0,8]]){addCylinder(world,M.iron,x,.1,z,.65,.14);addCylinder(world,M.brass,x,.2,z,.49,.12);const puff=new THREE.Mesh(new THREE.SphereGeometry(.5,8,7),new THREE.MeshBasicMaterial({color:0xc8d1c8,transparent:true,opacity:.08,depthWrite:false}));puff.position.set(x,1,z);puff.scale.set(1.6,1.2,1.6);world.add(puff);steamMeshes.push({mesh:puff,offset:Math.random()*6.28});}
}
function buildStation(x,z,name,index){const base=new THREE.Group();base.position.set(x,0,z);world.add(base);addBox(base,M.dark,0,.65,0,2.5,1.3,1.5,true);addBox(base,M.iron,0,1.35,0,2.25,.18,1.3);addBox(base,M.brass,0,1.55,-.48,1.6,.18,.12);addBox(base,M.glass,0,1.75,-.53,1.25,.48,.06);for(let i=0;i<3;i++){const dial=addCylinder(base,M.bright,-.65+i*.65,1.75,-.59,.16,.08,Math.PI/2);dial.rotation.z=i*.6;}addCylinder(base,M.rust,.88,1.62,.08,.09,.65);addCylinder(base,M.bright,.88,1.98,.08,.24,.1,Math.PI/2);for(let i=0;i<2;i++){const pipe=addCylinder(base,M.pipe,-.75+i*1.5,2.05,.42,.12,1.25);pipe.rotation.z=Math.PI/2;}addMesh(base,sphereGeo,index===1?M.redGlow:M.glow,0,2.25,-.6,.13,.13,.13,false);addLight(x,2.3,z-1,index===1?0xff6548:0xffb95e,.4,4);const label=addLabel(name,x,2.85,z-.2);taskObjects.push({name,index,position:new THREE.Vector3(x,0,z),base,label,done:false});}
