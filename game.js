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
let yaw=0, pitch=0, mouseLocked=false, mobile=false, moveForward=0, moveSide=0, sprinting=false, lookPointerId=null, lookLastX=0, lookLastY=0, stickPointerId=null;
let activeTask=null, meetingTimer=20, lastToast=0;
const clockDisplay=document.querySelector('#timer');
const crewNames=['Marlow','Ada','Bram','Iris','Otto'];
const colors=[0x3f8e93,0x7763a5,0xa9563e,0x8e9b55,0xb98242];
const player={pos:new THREE.Vector3(0,0,8),velocity:new THREE.Vector3(),height:1.62,alive:true};
function mat(color,rough=.72,metal=0){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});}
const M={floor:mat(0x343b35,.94),wall:mat(0x343b34,.78),dark:mat(0x171e1c,.65,.25),brass:mat(0xb78a4c,.38,.72),bright:mat(0xd0a457,.3,.76),rust:mat(0x874936,.75,.22),iron:mat(0x59645f,.42,.7),pipe:mat(0x816341,.38,.7),glass:new THREE.MeshStandardMaterial({color:0x50736a,roughness:.2,metalness:.3,emissive:0x15251d}),glow:new THREE.MeshStandardMaterial({color:0xe8a958,emissive:0xd77932,emissiveIntensity:1.6}),redGlow:new THREE.MeshStandardMaterial({color:0xc9573b,emissive:0x932b1b,emissiveIntensity:1.2})};
const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,16),sphereGeo=new THREE.SphereGeometry(1,16,12);
function addMesh(parent,geo,material,x,y,z,sx=1,sy=1,sz=1,cast=true){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;}
function addBox(parent,material,x,y,z,sx,sy,sz,solid=false){const m=addMesh(parent,boxGeo,material,x,y,z,sx,sy,sz);if(solid)solidBoxes.push({x,z,hx:sx/2,hz:sz/2,hy:sy});return m;}
function addCylinder(parent,material,x,y,z,r,h,rotX=0,rotZ=0){const m=addMesh(parent,cylGeo,material,x,y,z,r,h,r);m.rotation.x=rotX;m.rotation.z=rotZ;return m;}
function addLight(x,y,z,color,intensity,dist=10){const l=new THREE.PointLight(color,intensity,dist,2);l.position.set(x,y,z);scene.add(l);sceneLights.push(l);return l;}
function addLabel(text,x,y,z,tint='#d9b77d'){const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='rgba(15,20,17,.82)';ctx.fillRect(0,0,512,100);ctx.strokeStyle='rgba(208,164,87,.9)';ctx.lineWidth=4;ctx.strokeRect(3,3,506,94);ctx.fillStyle=tint;ctx.font='bold 34px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,50);const tex=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(1.35,.27,1);world.add(sprite);return sprite;}
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

function makeCrew(){
  crew.length=0;
  const spots=[[-3,10],[4,10],[-3,-4],[4,-4],[0,14]];
  const allNames=['YOU',...crewNames];
  for(let i=0;i<6;i++){
    const group=new THREE.Group();world.add(group);
    const color=i===0?0x3e9190:colors[(i-1)%colors.length];
    const suit=mat(color,.55,.08);const dark=mat(0x26302d,.53,.2);const visor=new THREE.MeshStandardMaterial({color:0x9bd0cc,metalness:.55,roughness:.2,emissive:0x183330,emissiveIntensity:.3});
    addMesh(group,cylGeo,suit,0,.76,0,.36,1.05,.34);
    addMesh(group,sphereGeo,suit,0,1.45,0,.36,.38,.35);
    addMesh(group,sphereGeo,visor,0,1.47,.29,.26,.18,.1);
    addMesh(group,boxGeo,dark,-.25,.25,0,.23,.35,.3);addMesh(group,boxGeo,dark,.25,.25,0,.23,.35,.3);
    addMesh(group,boxGeo,suit,-.43,.83,0,.18,.58,.2);addMesh(group,boxGeo,suit,.43,.83,0,.18,.58,.2);
    const pack=addMesh(group,boxGeo,dark,0,.84,-.35,.42,.55,.2);
    const label=addLabel(allNames[i],0,2.1,0,i===0?'#ead391':'#d7c9a9');group.add(label);label.position.set(0,2.2,0);
    const [x,z]=i===0?[0,10]:spots[i-1];group.position.set(x,0,z);
    group.userData={name:allNames[i],index:i,alive:true,group,label,baseX:x,baseZ:z,phase:Math.random()*6.28, speed:.65+Math.random()*.35, taskIndex:-1};
    crew.push(group);
  }
  crew[0].visible=false;
}
function addBodyAt(pos,name){
  const g=new THREE.Group();world.add(g);g.position.copy(pos);g.position.y=.12;g.rotation.y=Math.random()*6.28;g.rotation.z=Math.PI/2;
  const suit=mat(name==='YOU'?0x3e9190:colors[(crew.find(c=>c.userData.name===name)?.userData.index-1||0)%colors.length],.7);
  addMesh(g,cylGeo,suit,0,.22,0,.32,.72,.3);addMesh(g,sphereGeo,suit,0,.62,0,.32,.3,.3);addMesh(g,sphereGeo,M.redGlow,0,.65,.25,.2,.13,.08);
  addMesh(g,boxGeo,M.rust,0,.34,.12,.1,.48,.12);const badge=addLabel('BODY / REPORT',pos.x,1.5,pos.z,'#e08067');
  const item={group:g,name,badge,position:new THREE.Vector3(pos.x,0,pos.z),reported:false};bodies.push(item);return item;
}
makeWorld();makeCrew();
const raycaster=new THREE.Raycaster();raycaster.far=3.2;const center=new THREE.Vector2(0,0);

function setScreen(id){document.querySelectorAll('.screen').forEach(e=>e.classList.remove('visible'));if(id){const screen=document.querySelector(id);screen.classList.remove('hidden');screen.classList.add('visible');}}
function resetTouchInput(){resetStick();lookPointerId=null;lookLastX=0;lookLastY=0;moveForward=0;moveSide=0;sprinting=false;}
function pauseGameplay(){resetTouchInput();keys.clear();}
function showToast(msg,duration=2300){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');lastToast=performance.now()+duration;}
function setObjective(msg){document.querySelector('#objective').textContent=msg;}
function updateTaskMeter(){document.querySelector('#task-count').textContent=`${playerTasks} / ${totalTasks}`;document.querySelector('#task-meter-fill').style.width=`${Math.min(100,playerTasks/totalTasks*100)}%`;}
function setRole(newRole){role=newRole;const chip=document.querySelector('#role-chip');chip.classList.toggle('impostor',role==='impostor');document.querySelector('#role-name').textContent=role==='impostor'?'SABOTEUR':'CREWMATE';document.querySelector('#role-sub').textContent=role==='impostor'?'DISRUPT. DECEIVE. SURVIVE.':'KEEP THE BOILER RUNNING';document.querySelector('#ability-label').textContent=role==='impostor'?'SABOTAGE':'EMERGENCY';document.querySelector('#touch-use').textContent=role==='impostor'?'KILL':'USE';document.querySelector('#touch-ability').textContent=role==='impostor'?'SABOTAGE':'ALARM';document.querySelector('#report-button').classList.toggle('hidden',false);}
function startGame(){
  if(running)return;
  running=true;paused=false;ended=false;meeting=false;elapsed=0;roundSeconds=150;emergencyUsed=false;lastKillAt=-100;playerTasks=0;totalTasks=4;killCooldown=0;abilityCooldown=0;player.alive=true;resetTouchInput();keys.clear();
  for(const t of taskObjects)t.done=false;
  for(const b of bodies){world.remove(b.group);world.remove(b.badge);}bodies.length=0;
  setRole(Math.random()<.32?'impostor':'crew');
  crew.forEach((c,i)=>{c.userData.alive=true;c.visible=i!==0;c.position.set(i===0?0:[-3,4,-3,4,0][i-1],0,i===0?10:[10,10,-4,-4,14][i-1]);c.userData.baseX=c.position.x;c.userData.baseZ=c.position.z;});
  player.pos.set(0,0,10);yaw=0;pitch=0;camera.rotation.set(0,0,0);camera.position.set(0,player.height,10);
  setObjective(role==='impostor'?'Blend in. Eliminate the crew.':'Restore the foundry. Stay with the crew.');updateTaskMeter();updateCrewHud();
  document.querySelector('#hud').classList.remove('hidden');document.querySelector('#end-screen').classList.add('hidden');document.querySelector('#title-screen').classList.remove('visible');
  if(matchMedia('(pointer:coarse)').matches){mobile=true;document.querySelector('#mobile-controls').classList.remove('hidden');resetStick();}else{mobile=false;document.querySelector('#mobile-controls').classList.add('hidden');canvas.requestPointerLock?.();}
  showToast(role==='impostor'?'You are the saboteur. They must not discover you.':'Four systems are failing. Find the stations and repair them.',3500);
}
function updateCrewHud(){
  const el=document.querySelector('#crew-list');el.innerHTML='';let alive=0;
  for(let i=1;i<crew.length;i++){const c=crew[i],dead=!c.userData.alive;if(!dead)alive++;const row=document.createElement('div');row.className='crew-row'+(dead?' dead':'');row.innerHTML=`<i class="crew-dot"></i><span>${c.userData.name}</span><small class="crew-state">${dead?'LOST':'ON SITE'}</small>`;el.append(row);}
  document.querySelector('#crew-alive').textContent=`${alive+(player.alive?1:0)} ACTIVE`;
}
function roundEnd(won,reason){
  if(ended)return;ended=true;running=false;paused=true;meeting=false;pauseGameplay();document.exitPointerLock?.();document.querySelectorAll('.modal-screen').forEach(x=>x.classList.add('hidden'));document.querySelector('#hud').classList.add('hidden');document.querySelector('#mobile-controls').classList.add('hidden');
  setScreen('#end-screen');document.querySelector('#end-kicker').textContent=won?'GUILD SECURITY / ROUND CLEAR':'GUILD SECURITY / ROUND LOST';
  document.querySelector('#end-title').innerHTML=won?'THE FOUNDRY<br><span>STANDS</span>':'THE FOUNDRY<br><span>FALLS</span>';
  document.querySelector('#end-description').textContent=reason;
  document.querySelector('#end-stats').innerHTML=`SYSTEMS RESTORED <b>${playerTasks} / ${totalTasks}</b><br>CREW STILL STANDING <b>${crew.filter(c=>c.userData.alive).length} / 6</b><br>ROUND TIME <b>${formatTime(elapsed)}</b>`;
}
function formatTime(seconds){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.max(0,Math.floor(seconds%60))).padStart(2,'0')}`;}
function openTask(task){if(!running||meeting||role==='impostor'||task.done)return;activeTask=task;paused=true;pauseGameplay();document.querySelector('#task-title').textContent=task.name;document.querySelector('#task-description').textContent=task.index===0?'Prime the pump. Stop the gauge in the green band.':task.index===1?'Route the power. Flip every switch to restore the drive.':task.index===2?'Calibrate the coolant pressure before it boils over.':'Set the regulator to the marked pressure band.';
  const box=document.querySelector('#task-game');box.innerHTML='';
  if(task.index%2===0){box.innerHTML='<div class="task-side"><div class="dial-game"><div class="dial-center">PRESSURE</div><div class="dial-needle"></div></div><div class="task-instruction">PRESS <b>SPACE</b> OR CLICK WHEN THE NEEDLE HITS THE GREEN BAND</div></div>';const needle=box.querySelector('.dial-needle');let phase=Math.random()*Math.PI*2;const move=()=>{if(activeTask!==task)return;phase+=.055;needle.style.transform=`rotate(${Math.sin(phase)*118}deg)`;requestAnimationFrame(move);};move();box.querySelector('.dial-game').addEventListener('click',completeTask);}
  else{box.innerHTML='<div class="task-side"><div class="switch-row"></div><div class="task-instruction">FLIP EVERY BREAKER TO RESTORE THE DRIVE</div></div>';const row=box.querySelector('.switch-row');for(let i=0;i<4;i++){const b=document.createElement('button');b.className='switch-tile';b.innerHTML=`<i></i>LINE 0${i+1}`;b.onclick=()=>{b.classList.toggle('on');if(box.querySelectorAll('.switch-tile.on').length===4)completeTask();};row.append(b);}}
  document.querySelector('#task-screen').classList.remove('hidden');}
function completeTask(){if(!activeTask||activeTask.done)return;activeTask.done=true;playerTasks++;world.remove(activeTask.label);addLight(activeTask.position.x,2.25,activeTask.position.z,0x88ce8a,1.2,5);updateTaskMeter();document.querySelector('#task-screen').classList.add('hidden');activeTask=null;paused=false;resetTouchInput();showToast('SYSTEM ONLINE — FOUNDRY STABILIZED');if(playerTasks>=totalTasks&&role==='crew')roundEnd(true,'Every system is back online. The remaining saboteur is locked out.');}
function closeTask(){if(!activeTask)return;document.querySelector('#task-screen').classList.add('hidden');activeTask=null;paused=false;resetTouchInput();}
function openMeeting(reason='Emergency alarm sounded.'){if(!running||meeting)return;meeting=true;paused=true;pauseGameplay();meetingTimer=20;document.exitPointerLock?.();document.querySelector('#meeting-reason').textContent=reason;document.querySelector('#meeting-screen').classList.remove('hidden');document.querySelector('#vote-result').classList.add('hidden');fillVotes();showToast('EMERGENCY CONCLAVE CALLED',1800);}
function fillVotes(){const options=document.querySelector('#vote-options');options.innerHTML='';for(const c of crew){if(!c.userData.alive)continue;const button=document.createElement('button');button.className='vote-card';button.innerHTML=`<b>${c.userData.name}</b><small>${c.userData.index===0?'YOU':'GUILD CREW'}</small>`;button.onclick=()=>castVote(c);options.append(button);}const skip=document.createElement('button');skip.className='vote-card';skip.innerHTML='<b>ABSTAIN</b><small>NO ELIMINATION</small>';skip.onclick=()=>castVote(null);options.append(skip);}
function castVote(target){if(!meeting)return;meeting=false;document.querySelector('#vote-options').classList.add('hidden');const result=document.querySelector('#vote-result');result.classList.remove('hidden');let ejected=target;
  if(target?.userData.index===0){player.alive=false;result.textContent='YOU WERE EJECTED. THE CREW MUST FINISH THE ROUND.';setTimeout(()=>{if(role==='impostor')roundEnd(false,'The crew found the saboteur, but the round was already lost.');else roundEnd(false,'You were voted out. The crew must finish the repairs.');},2200);return;}
  if(target){target.userData.alive=false;target.visible=false;updateCrewHud();const isBad=target.userData.index===2;if((isBad&&role==='crew')||(!isBad&&role==='impostor')){result.innerHTML=`<b>${target.userData.name}</b> WAS THE SABOTEUR`;setTimeout(()=>{document.querySelector('#meeting-screen').classList.add('hidden');if(role==='crew')roundEnd(true,'The saboteur was exposed and the crew survived.');else roundEnd(true,'The crew ejected an innocent. The foundry belongs to you.');},2200);return;}result.innerHTML=`<b>${target.userData.name}</b> WAS NOT THE SABOTEUR`;
  }else result.textContent='THE CREW ABSTAINED. NO ONE WAS EJECTED.';
  setTimeout(()=>{document.querySelector('#meeting-screen').classList.add('hidden');document.querySelector('#vote-options').classList.remove('hidden');paused=false;if(!crew.slice(1).some(c=>c.userData.alive))roundEnd(role==='impostor','The foundry has gone quiet.');},2100);
}
function reportBody(){if(!running||meeting)return;let nearest=null,dist=2.8;for(const b of bodies){const d=player.pos.distanceTo(b.position);if(d<dist){dist=d;nearest=b;}}if(nearest){nearest.reported=true;openMeeting(`${nearest.name} was found near ${nearest.position.x<0?'the west':'the east'} gantry.`);}else showToast('NO REPORTABLE BODY IN RANGE');}
function useAbility(){if(!running||paused||meeting)return;if(role==='impostor'){if(abilityCooldown>0){showToast(`SABOTAGE RECHARGING — ${Math.ceil(abilityCooldown)}s`);return;}const systems=['BOILER PRESSURE','COOLANT FLOW','FOUNDRY LIGHTING'];const choice=systems[Math.floor(Math.random()*systems.length)];abilityCooldown=27;showAlert(`SABOTAGE — ${choice} FAILURE`);setTimeout(()=>document.querySelector('#alert-banner').classList.add('hidden'),4200);showToast(`${choice} SABOTAGED. Keep them distracted.`);}else{if(emergencyUsed){showToast('EMERGENCY ALREADY USED');return;}emergencyUsed=true;openMeeting('Emergency meeting called by you.');}}
function showAlert(message){const a=document.querySelector('#alert-banner');a.textContent=message;a.classList.remove('hidden');}
function tryKill(){if(role!=='impostor'||killCooldown>0)return;let target=null,d=2.5;for(const c of crew.slice(1)){if(!c.userData.alive)continue;const dist=player.pos.distanceTo(c.position);if(dist<d){d=dist;target=c;}}if(!target){showToast('NO CREW IN ELIMINATION RANGE');return;}target.userData.alive=false;target.visible=false;addBodyAt(target.position,target.userData.name);lastKillAt=elapsed;killCooldown=17;updateCrewHud();showAlert('CREW MEMBER LOST');setTimeout(()=>document.querySelector('#alert-banner').classList.add('hidden'),2200);showToast(`${target.userData.name} eliminated. Get clear.`,2400);if(crew.slice(1).filter(c=>c.userData.alive).length<=1)roundEnd(true,'Only one crew member remains. The foundry is yours.');}
function collide(nx,nz){const r=.32;if(Math.abs(nx)>17.7||Math.abs(nz)>17.7)return true;for(const b of solidBoxes){if(Math.abs(nx-b.x)<b.hx+r&&Math.abs(nz-b.z)<b.hz+r&&b.hy>1.3)return true;}return false;}
function updatePlayer(dt){if(!running||paused||!player.alive)return;const f=moveForward, s=moveSide, length=Math.hypot(f,s)||1;const speed=(sprinting?5.3:3.3)*dt;const nf=f/Math.max(1,length),ns=s/Math.max(1,length);const dx=(Math.sin(yaw)*nf+Math.cos(yaw)*ns)*speed;const dz=(-Math.cos(yaw)*nf+Math.sin(yaw)*ns)*speed;const nx=player.pos.x+dx,nz=player.pos.z+dz;if(!collide(nx,player.pos.z))player.pos.x=nx;if(!collide(player.pos.x,nz))player.pos.z=nz;camera.position.set(player.pos.x,player.height+Math.sin(elapsed*10)*.018*(Math.abs(nf)+Math.abs(ns)),player.pos.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
function updateCrew(dt){if(!running)return;for(const c of crew.slice(1)){if(!c.userData.alive)continue;const u=c.userData;u.phase+=dt*u.speed;const target=taskObjects[(Math.floor(elapsed/12)+u.index)%taskObjects.length];let tx=target?.done?u.baseX:target.position.x+(u.index%2?1.7:-1.7),tz=target?.done?u.baseZ:target.position.z+(u.index%2?-1.7:1.7);if(role==='impostor'&&elapsed-lastKillAt<10){tx=12;tz=10;}const dx=tx-c.position.x,dz=tz-c.position.z,d=Math.hypot(dx,dz);if(d>.65){c.position.x+=dx/d*dt*u.speed;c.position.z+=dz/d*dt*u.speed;c.rotation.y=Math.atan2(dx,dz);}else{c.rotation.y=Math.sin(u.phase)*.18;}c.position.y=Math.abs(Math.sin(u.phase*3))*.035;}}
function updateInteraction(){if(!running||paused||role==='impostor'){document.querySelector('#interaction-hint').classList.add('hidden');return;}raycaster.setFromCamera(center,camera);let nearest=null,dist=2.6;for(const t of taskObjects){if(t.done)continue;const d=camera.position.distanceTo(new THREE.Vector3(t.position.x,1,t.position.z));if(d<dist){dist=d;nearest=t;}}document.querySelector('#interaction-hint').classList.toggle('hidden',!nearest);if(nearest)document.querySelector('#interaction-hint').innerHTML='<span class="keycap">E</span> <b>REPAIR '+nearest.name+'</b>';}
function interact(){if(!running||paused)return;if(role==='impostor'){tryKill();return;}let best=null,d=2.65;for(const t of taskObjects){if(t.done)continue;const dd=player.pos.distanceTo(t.position);if(dd<d){d=dd;best=t;}}if(best)openTask(best);else showToast('NO SYSTEM IN REACH');}
function updateMap(){const inner=document.querySelector('#map-inner');if(!inner.dataset.ready){inner.dataset.ready='1';const stations=[['PUMP',-12,-10],['GEAR',12,-10],['COOLANT',-12,10],['VALVE',12,10]];for(const [name,x,z] of stations){const r=document.createElement('i');r.className='map-room map-station';r.textContent=name;r.style.cssText=`left:${50+x/38*47-9}%;top:${50+z/38*47-6.5}%;width:18%;height:13%`;inner.append(r);}const boiler=document.createElement('i');boiler.className='map-room map-boiler';boiler.textContent='BOILER';boiler.style.cssText='left:40%;top:40%;width:20%;height:20%';inner.append(boiler);for(const [left,top,width,height] of [['20%','30%','60%','1px'],['20%','69%','60%','1px'],['30%','24%','1px','52%'],['69%','24%','1px','52%']]){const path=document.createElement('i');path.className='map-corridor';path.style.cssText=`left:${left};top:${top};width:${width};height:${height}`;inner.append(path);}}
  inner.querySelectorAll('.map-dot').forEach(x=>x.remove());const addDot=(x,z,cls)=>{const d=document.createElement('i');d.className='map-dot '+cls;d.style.left=`${50+x/38*47}%`;d.style.top=`${50+z/38*47}%`;inner.append(d);};addDot(player.pos.x,player.pos.z,'you');for(const c of crew.slice(1))if(c.userData.alive)addDot(c.position.x,c.position.z,role==='impostor'&&c===crew[2]?'suspect':'');}
function update(dt){if(running&&!paused){elapsed+=dt;roundSeconds-=dt;killCooldown=Math.max(0,killCooldown-dt);abilityCooldown=Math.max(0,abilityCooldown-dt);if(roundSeconds<=0){roundSeconds=0;roundEnd(role==='impostor','The clock ran out before the foundry could be secured.');}if(role==='impostor'&&elapsed-lastKillAt>0&&elapsed>42&&crew.slice(1).filter(c=>c.userData.alive).length>0){/* pressure builds naturally; no forced kill */}}
  if(meeting){meetingTimer-=dt;document.querySelector('#meeting-timer').textContent=formatTime(meetingTimer);if(meetingTimer<=0)castVote(null);}
  clockDisplay.textContent=formatTime(roundSeconds);updatePlayer(dt);updateCrew(dt);updateInteraction();updateMap();
  for(const g of gearMeshes)g.rotation.y+=dt*(g.position.x>0?-0.32:.32);
  for(const p of steamMeshes){const v=(elapsed*1.1+p.offset)%3;p.mesh.position.y=.8+v*1.05;p.mesh.material.opacity=Math.max(0,.14-v*.045);p.mesh.scale.setScalar(.7+v*.45);}
  if(lastToast&&performance.now()>lastToast){document.querySelector('#toast').classList.remove('show');lastToast=0;}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);update(dt);renderer.render(scene,camera);}animate();

// Inputs: pointer lock on desktop, soft touch controls on phones/tablets.
canvas.addEventListener('click',()=>{if(running&&!paused&&!mobile&&!mouseLocked)canvas.requestPointerLock?.();});document.addEventListener('pointerlockchange',()=>{mouseLocked=document.pointerLockElement===canvas;});document.addEventListener('mousemove',e=>{if(mouseLocked&&running&&!paused){yaw-=e.movementX*.0022;pitch-=e.movementY*.0019;pitch=Math.max(-1.25,Math.min(1.25,pitch));}});
const keys=new Set();window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE'||e.code==='Space'){if(!document.querySelector('#task-screen').classList.contains('hidden'))completeTask();else interact();}if(e.code==='KeyR')reportBody();if(e.code==='KeyQ')useAbility();if(e.code==='Escape'){if(activeTask)closeTask();else if(meeting){document.querySelector('#meeting-screen').classList.add('hidden');meeting=false;paused=false;}}});window.addEventListener('keyup',e=>keys.delete(e.code));
function readKeys(){if(!mobile){moveForward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);moveSide=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');}else{sprinting=false;}requestAnimationFrame(readKeys);}readKeys();
document.querySelector('#start-button').onclick=startGame;document.querySelector('#restart-button').onclick=()=>{setScreen('#title-screen');document.querySelector('#hud').classList.add('hidden');startGame();};document.querySelector('#report-button').onclick=reportBody;document.querySelector('#ability-button').onclick=useAbility;document.querySelector('#map-toggle').onclick=()=>document.querySelector('#mini-map').classList.toggle('collapsed');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeTask);
document.querySelector('#task-screen').addEventListener('click',e=>{if(e.target.id==='task-screen')closeTask();});document.querySelector('#meeting-screen').addEventListener('click',e=>{if(e.target.id==='meeting-screen'&&meeting){showToast('CAST YOUR VOTE TO CONTINUE');}});
const moveStick=document.querySelector('#move-stick'),stickKnob=document.querySelector('#stick-knob');
function resetStick(){moveForward=0;moveSide=0;stickPointerId=null;stickKnob.style.transform='translate(0,0)';}
function updateStick(e){const rect=moveStick.getBoundingClientRect(),radius=rect.width*.34,cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const length=Math.hypot(dx,dy);if(length>radius){dx=dx/length*radius;dy=dy/length*radius;}stickKnob.style.transform=`translate(${dx}px,${dy}px)`;const magnitude=Math.hypot(dx,dy)/radius,deadzone=.16;if(magnitude<deadzone){moveForward=0;moveSide=0;return;}const power=Math.min(1,(magnitude-deadzone)/(1-deadzone));moveSide=dx/radius*power;moveForward=-dy/radius*power;}
moveStick.addEventListener('pointerdown',e=>{if(!mobile||paused)return;e.preventDefault();stickPointerId=e.pointerId;moveStick.setPointerCapture(e.pointerId);updateStick(e);});
moveStick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointerId)updateStick(e);});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])moveStick.addEventListener(ev,e=>{if(e.pointerId===stickPointerId)resetStick();});
canvas.addEventListener('pointerdown',e=>{if(!mobile||e.pointerType!=='touch'||paused)return;e.preventDefault();lookPointerId=e.pointerId;lookLastX=e.clientX;lookLastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointerId||paused)return;const dx=e.clientX-lookLastX,dy=e.clientY-lookLastY;lookLastX=e.clientX;lookLastY=e.clientY;yaw-=dx*.0045;pitch=Math.max(-1.1,Math.min(1.1,pitch-dy*.0035));});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{if(e.pointerId===lookPointerId){lookPointerId=null;lookLastX=0;lookLastY=0;}});
window.addEventListener('blur',pauseGameplay);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGameplay();});
document.querySelector('#touch-use').onclick=interact;document.querySelector('#touch-report').onclick=reportBody;document.querySelector('#touch-ability').onclick=useAbility;
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
updateMap();
