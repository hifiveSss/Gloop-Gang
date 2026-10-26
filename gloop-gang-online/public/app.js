(() => {
'use strict';
const $=id=>document.getElementById(id);
const WORLD={w:2800,h:2200};
const PALETTE={mint:['#ceff5c','#79b83e'],berry:['#ff84b4','#bb417c'],sun:['#ffdf69','#c49131'],blue:['#7fd9ff','#4389c2'],purple:['#c79bff','#754ebc']};
const PERKS=[{id:'heart',icon:'❤',title:'EXTRA HEARTS',desc:'+12 starting max health per level.'},{id:'power',icon:'💥',title:'MORE BOOM',desc:'+3 starting damage per level.'},{id:'sneakers',icon:'👟',title:'ZOOM ZOOM',desc:'+10 starting speed per level.'},{id:'magnet',icon:'🧲',title:'LOOT LOVER',desc:'+15 pickup range per level.'}];
const UPS=[
{id:'speed',icon:'💨',name:'SPEEDY GLOOP',desc:'Move 18% faster.',rarity:'COMMON'},
{id:'damage',icon:'🥊',name:'BIG OUCH',desc:'Deal 28% more bullet damage.',rarity:'COMMON'},
{id:'rapid',icon:'⚡',name:'PEW PEW PEW',desc:'Shoot 28% faster.',rarity:'COMMON'},
{id:'health',icon:'💚',name:'EXTRA SQUISH',desc:'+35 max health. Heal 35 HP.',rarity:'COMMON'},
{id:'magnet',icon:'🧲',name:'LOOT VACUUM',desc:'Pull XP and hearts from farther away.',rarity:'COMMON'},
{id:'size',icon:'🌕',name:'BIG BULLETS',desc:'Bullets grow 30% and hit harder.',rarity:'COMMON'},
{id:'multi',icon:'🔱',name:'TRIPLE TROUBLE',desc:'Fire an extra projectile.',rarity:'RARE'},
{id:'crit',icon:'🎯',name:'LUCKY SHOT',desc:'+14% chance for triple damage.',rarity:'RARE'},
{id:'pierce',icon:'🗡️',name:'PASS THROUGH',desc:'Bullets pass through one more enemy.',rarity:'RARE'},
{id:'orbit',icon:'🪐',name:'ORBITAL BUDDY',desc:'Gain a spinning defender orb.',rarity:'EPIC'},
{id:'blast',icon:'💣',name:'MEGA BLAST',desc:'Shockwave grows and hits 50% harder.',rarity:'RARE'},
{id:'heal',icon:'🍓',name:'SNACK ATTACK',desc:'Regenerate 1.5 health per second.',rarity:'RARE'},
{id:'slow',icon:'🧊',name:'STICKY SHOTS',desc:'Your shots slow enemies.',rarity:'RARE'},
{id:'xp',icon:'🌟',name:'BIG BRAIN',desc:'Get 30% more XP from gems.',rarity:'COMMON'},
{id:'dash',icon:'🥷',name:'NINJA ROLL',desc:'Dash cools down 25% faster.',rarity:'RARE'}
];
const ENEMY_TYPES={nibble:{r:16,hp:38,speed:100,damage:10,xp:6,fill:'#fd779f'},zip:{r:13,hp:25,speed:169,damage:9,xp:7,fill:'#fbb751'},brute:{r:30,hp:175,speed:65,damage:19,xp:19,fill:'#a78bfa'},spit:{r:20,hp:68,speed:76,damage:11,xp:12,fill:'#68dfe0'},boss:{r:58,hp:1450,speed:59,damage:29,xp:130,fill:'#ffcb54'}};
const defaultProfile={name:'Glooper',color:'mint',coins:0,perks:{heart:0,power:0,sneakers:0,magnet:0}};
let profile;
try{profile={...defaultProfile,...JSON.parse(localStorage.getItem('gloop-gang-v1')||'{}')};}catch{profile={...defaultProfile};}
profile.perks={...defaultProfile.perks,...(profile.perks||{})};
profile.name=String(profile.name||'Glooper').slice(0,14);profile.color=PALETTE[profile.color]?profile.color:'mint';profile.coins=Math.max(0,Number(profile.coins)||0);
const persist=()=>{try{localStorage.setItem('gloop-gang-v1',JSON.stringify(profile));}catch{}};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
const rnd=(a,b)=>Math.floor(rand(a,b+1));
const distance=(x1,y1,x2,y2)=>Math.hypot(x1-x2,y1-y2);
const screenIds=['menuScreen','lobbyScreen','gameScreen','resultScreen'];
const showScreen=(id)=>{for(const key of screenIds)$(key).classList.toggle('active',key===id);};
const showToast=(msg)=>{const el=$('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('visible'),2900);};
const linkFor=code=>`${location.origin}${location.pathname}?join=${code}`;
let net=null,game=null,hostMode=false,paused=false,gameIsSolo=true,localId='p1',myResultPaid=false;
let camera={x:WORLD.w/2,y:WORLD.h/2},fx=[],visualCache=new Map(),visFrames=0,lastFrame=performance.now(),lastSent=0,lastMini=0,lastUpSelection='',announceTimer=0;
let canvas=$('gameCanvas'),ctx=canvas.getContext('2d',{alpha:false}),vw=0,vh=0,dpr=1;
let keySet=new Set(),joystick={active:false,pointer:null,x:0,y:0},action={dash:false,blast:false};
let audioContext=null,soundOn=true,lastShootSound=0;
function sound(kind){if(!soundOn)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime;const config={shoot:[410,290,.045,.025],hit:[160,85,.09,.055],pickup:[560,860,.1,.035],dash:[200,580,.13,.07],blast:[90,45,.28,.11],level:[430,910,.25,.08],win:[650,1050,.35,.11],hurt:[155,85,.14,.07]}[kind]||[280,350,.08,.05];osc.type=['blast','hurt'].includes(kind)?'sawtooth':'sine';osc.frequency.setValueAtTime(config[0],at);osc.frequency.exponentialRampToValueAtTime(Math.max(1,config[1]),at+config[2]);gain.gain.setValueAtTime(config[3],at);gain.gain.exponentialRampToValueAtTime(.001,at+config[2]);osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+config[2]+.015);}catch{}}
function syncProfile(){profile.name=$('nameInput').value.trim().replace(/[<>]/g,'').slice(0,14)||'Glooper';$('nameInput').value=profile.name;persist();}
function perkCost(id){const level=profile.perks[id];return Math.round(45*Math.pow(1.6,level));}
function renderGarage(){
 $('coinCount').textContent=Math.floor(profile.coins);
 $('perksGrid').innerHTML=PERKS.map(p=>{const lvl=clamp(profile.perks[p.id]||0,0,5),cost=perkCost(p.id);return `<article class="perk-card"><div class="perk-top"><span class="perk-icon">${p.icon}</span><span class="perk-level">LVL ${lvl}/5</span></div><h3>${p.title}</h3><p>${p.desc}</p><button class="perk-buy ${profile.coins>=cost&&lvl<5?'affordable':''}" data-perk="${p.id}" ${lvl===5||profile.coins<cost?'disabled':''}>${lvl===5?'MAXED OUT':`🟡 ${cost} · UPGRADE`}</button></article>`;}).join('');
 document.querySelectorAll('[data-perk]').forEach(el=>el.onclick=()=>{const id=el.dataset.perk,cost=perkCost(id);if(profile.coins<cost||profile.perks[id]>=5)return;profile.coins-=cost;profile.perks[id]++;sound('level');persist();renderGarage();showToast('Upgrade purchased! ✦');});
}
function refreshSkins(){document.querySelectorAll('.skin').forEach(el=>el.classList.toggle('selected',el.dataset.color===profile.color));}
$('nameInput').value=profile.name;refreshSkins();renderGarage();
$('nameInput').addEventListener('change',syncProfile);
document.querySelectorAll('.skin').forEach(el=>el.addEventListener('click',()=>{profile.color=el.dataset.color;refreshSkins();persist();sound('pickup');}));
document.querySelectorAll('.sound-toggle').forEach(el=>el.addEventListener('click',()=>{soundOn=!soundOn;el.textContent=soundOn?'♫':'♪̸';showToast(soundOn?'Sound on':'Sound off');}));

function serverProfile(){syncProfile();return {name:profile.name,color:profile.color,perks:profile.perks};}
function wsSend(data){if(net?.ws?.readyState===WebSocket.OPEN)net.ws.send(JSON.stringify(data));}
function openSocket(actionType,code){
 if(location.protocol==='file:'){showToast('Online parties need the website server. Solo works right here!');return;}
 if(net?.ws){net.ws.onclose=null;net.ws.close();}
 let ws;try{ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws');}catch{showToast('Could not connect to party server.');return;}
 net={ws,role:actionType==='create'?'host':'guest',public:actionType==='match',code:'',players:[],id:'',intentional:false};
 $('onlineBtn').disabled=$('hostBtn').disabled=$('joinBtn').disabled=true;
 ws.onopen=()=>{wsSend({type:actionType,code,profile:serverProfile()});};
 ws.onerror=()=>showToast('Party server unavailable. Try again shortly.');
 ws.onclose=()=>{if(!net||net.ws!==ws)return;const intentional=net.intentional;net=null;$('onlineBtn').disabled=$('hostBtn').disabled=$('joinBtn').disabled=false;if(!intentional){if($('lobbyScreen').classList.contains('active')||$('gameScreen').classList.contains('active')){showScreen('menuScreen');game=null;}showToast('Disconnected from party server.');}};
 ws.onmessage=evt=>{let m;try{m=JSON.parse(evt.data);}catch{return;}receiveMessage(m);};
}
function leaveRoom(){if(net){net.intentional=true;net.ws.close();net=null;}$('onlineBtn').disabled=$('hostBtn').disabled=$('joinBtn').disabled=false;game=null;paused=false;$('upgradeModal').classList.add('hidden');$('pauseModal').classList.add('hidden');showScreen('menuScreen');renderGarage();history.replaceState({},'',location.pathname);}
function receiveMessage(m){
 if(!net)return;
 switch(m.type){
  case 'error':showToast(m.message||'Could not join party.');$('onlineBtn').disabled=$('hostBtn').disabled=$('joinBtn').disabled=false;net.intentional=true;net.ws.close();net=null;break;
  case 'matched':
   net.code=m.code;net.id=m.id;localId=m.id;net.players=m.players;net.public=true;
   gameIsSolo=false;hostMode=m.role==='host';
   if(hostMode)initGame(net.players);
   else game={phase:'game',players:[],enemies:[],bullets:[],gems:[],shots:[],pickups:[],t:0,duration:180,wave:1,countdown:0};
   beginScreen();updateOnlineStatus();
   showToast(hostMode?'Online game started! Other players can jump in.':'Joined an online game!');
   break;
  case 'created':case 'joined':
   net.code=m.code;net.id=m.id;localId=m.id;net.players=m.players;gameIsSolo=false;hostMode=m.type==='created';net.public=!!m.public;
   if(m.phase==='game'&&net.public){
    game={phase:'game',players:[],enemies:[],bullets:[],gems:[],shots:[],pickups:[],t:0,duration:180,wave:1,countdown:0};
    beginScreen();updateOnlineStatus();showToast('Joined your friend’s game!');
   }else displayLobby();
   break;
  case 'players':case 'player_joined':case 'player_left':
   net.players=m.players;
   if(hostMode&&game?.phase==='game'){
    if(m.type==='player_left')game.players=game.players.filter(p=>p.id!==m.id);
    if(m.type==='player_joined'&&!game.players.some(p=>p.id===m.id)){
     const entry=m.players.find(p=>p.id===m.id);
     if(entry){const newcomer=newPlayer(entry,game.players.length);const anchor=me()||game.players[0];
      if(anchor){newcomer.x=clamp(anchor.x+rand(-70,70),45,WORLD.w-45);newcomer.y=clamp(anchor.y+rand(-70,70),45,WORLD.h-45);}
      newcomer.invuln=4;game.players.push(newcomer);
     }
    }
   }
   if($('lobbyScreen').classList.contains('active'))renderLobbyPlayers();
   if(m.type==='player_joined'){sound('level');if(net.public)showToast('A new blob joined your team!');}
   updateOnlineStatus();break;
  case 'host_changed':
   net.players=m.players;hostMode=m.id===localId;
   if(game?.phase==='game')game.players=game.players.filter(p=>p.id!==m.left);
   if(hostMode&&game?.phase==='game'){game.events||=[];game.finished=false;showToast('You are now leading the squad!');}
   else if(game?.phase==='game')showToast('Host changed. Keep playing!');
   if(game?.phase==='finished')showResultsIfHostChanged();
   updateOnlineStatus();break;
  case 'started':net.players=m.players||net.players;hostMode=false;gameIsSolo=false;game={phase:'game',players:[],enemies:[],bullets:[],gems:[],shots:[],pickups:[],t:0,duration:180,wave:1,countdown:0};beginScreen();break;
  case 'snapshot':if(!hostMode&&m.state){const old=game;game=m.state;if(old?.wave&&old.wave!==game.wave)announce('WAVE '+game.wave+'!');if(game.events){for(const e of game.events)spawnFx(e);}}break;
  case 'remote_input':if(hostMode&&game){const p=game.players.find(v=>v.id===m.from);if(p){const prev=p.input||{};p.input={...m.input,dash:m.input.dash||prev.dash,blast:m.input.blast||prev.blast};}}break;
  case 'remote_choice':if(hostMode&&game){const p=game.players.find(v=>v.id===m.from);if(p)chooseUpgrade(p,m.index);}break;
  case 'room_closed':showToast(m.message||'The host left.');leaveRoom();break;
  case 'ended':if(!hostMode){showResults(m.results);}break;
  case 'restarted':
   net.players=m.players;
   if(m.auto){game={phase:'game',players:[],enemies:[],bullets:[],gems:[],shots:[],pickups:[],t:0,duration:180,wave:1,countdown:0};beginScreen();updateOnlineStatus();}
   else {game=null;displayLobby();}
   break;
 }
}
function updateOnlineStatus(){
 const status=$('onlineStatus');
 if(!status)return;
 status.classList.toggle('hidden',!net?.public);
 $('inviteGame').classList.toggle('hidden',!net?.public);
 if(net?.public)status.textContent=`🌐 ONLINE • ${net.players.length}/4 PLAYERS`;
}
function showResultsIfHostChanged(){
 if(!$('resultScreen').classList.contains('active'))return;
 $('againBtn').disabled=!net?.public&&!hostMode;
 $('againBtn').textContent=net?.public?'⚡ PLAY AGAIN':hostMode?'⚡ NEXT ROUND':'WAIT FOR HOST';
}
function quickMatch(){if(net)leaveRoom();openSocket('match');}
function displayLobby(){showScreen('lobbyScreen');$('lobbyCode').textContent=net.code;$('startBtn').style.display=hostMode?'block':'none';$('lobbyStatus').textContent=hostMode?'You’re the host. Start whenever you’re ready.':'Waiting for the host to start...';renderLobbyPlayers();}
function renderLobbyPlayers(){
 const arr=net?.players||[];
 $('lobbyPlayers').innerHTML=[...arr,...Array.from({length:Math.max(0,4-arr.length)},()=>null)].map(p=>p?`<div class="player-slot"><span class="player-avatar" style="background:${PALETTE[p.profile.color]?.[0]||'#cbff54'}">●</span><span>${escapeHtml(p.profile.name)} ${p.id===net.id?'(you)':''}</span></div>`:`<div class="player-slot empty">◌ &nbsp; Empty slot</div>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[a]));}
$('onlineBtn').onclick=quickMatch;
$('hostBtn').onclick=()=>openSocket('create');
$('joinBtn').onclick=()=>{const code=$('roomInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6){showToast('Enter a six-character party code.');return;}openSocket('join',code);};
$('roomInput').addEventListener('input',()=>{$('roomInput').value=$('roomInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
$('roomInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinBtn').click();});
$('soloBtn').onclick=()=>{serverProfile();if(net)leaveRoom();gameIsSolo=true;hostMode=true;localId='p1';initGame([{id:'p1',profile:serverProfile()}]);beginScreen();};
$('startBtn').onclick=()=>{if(!hostMode||!net)return;wsSend({type:'start'});gameIsSolo=false;initGame(net.players);beginScreen();};
$('leaveLobby').onclick=leaveRoom;
$('copyCode').onclick=()=>copyText(net?.code||'');
$('copyLink').onclick=()=>copyText(linkFor(net.code));
$('shareLink').onclick=async()=>{
 if(navigator.share){try{await navigator.share({title:'Join my Gloop Gang!',text:'Come survive the chaos with me!',url:linkFor(net.code)});}catch{}}
 else copyText(linkFor(net.code));
};
$('inviteGame').onclick=()=>{
 if(!net?.code)return;
 if(navigator.share)navigator.share({title:'Join my Gloop Gang!',text:'Tap to jump into my game!',url:linkFor(net.code)}).catch(()=>{});
 else copyText(linkFor(net.code));
};
async function copyText(s){try{await navigator.clipboard.writeText(s);showToast('Copied! Send it to your friend ✦');}catch{showToast('Copy this: '+s);}}

function newPlayer(entry,index){
 const perks=entry.profile.perks||{};
 return {id:entry.id,name:entry.profile.name,color:entry.profile.color,x:WORLD.w/2+(index%2?80:-80),y:WORLD.h/2+(index>=2?90:-90),r:19,hp:100+12*(perks.heart||0),maxHp:100+12*(perks.heart||0),speed:224+10*(perks.sneakers||0),damage:21+3*(perks.power||0),rate:2.5,magnet:108+15*(perks.magnet||0),size:8,multi:1,crit:.06,pierce:0,orbit:0,slow:false,regen:0,bonusXp:1,blastScale:1,blastDamage:57,dashCD:3.8,dashLeft:0,blastLeft:0,shootLeft:0,invuln:0,level:1,xp:0,nextXp:22,pendingLevels:0,kills:0,dead:false,revive:0,choices:[],face:1,spin:0,hitLeft:0,input:{x:0,y:0,dash:false,blast:false}};
}
function initGame(entries){
 game={phase:'game',t:0,duration:180,wave:1,countdown:2.9,players:entries.map(newPlayer),enemies:[],bullets:[],gems:[],shots:[],pickups:[],events:[],spawnClock:.7,pickupClock:24,seq:0,finished:false};fx=[];camera={x:WORLD.w/2,y:WORLD.h/2};lastUpSelection='';myResultPaid=false;paused=false;announceTimer=0;}
function beginScreen(){updateOnlineStatus();showScreen('gameScreen');$('pauseModal').classList.add('hidden');$('upgradeModal').classList.add('hidden');resizeCanvas();camera={x:WORLD.w/2,y:WORLD.h/2};visualCache.clear();fx=[];lastUpSelection='';myResultPaid=false;paused=false;lastFrame=performance.now();}
function me(){return game?.players?.find(p=>p.id===localId);}
function randomTarget(){const live=game.players.filter(p=>!p.dead);return live[Math.floor(Math.random()*live.length)]||null;}
function spawnEnemy(typeName){if(game.enemies.length>=140)return;const target=randomTarget();if(!target)return;let x,y;const a=rand(0,Math.PI*2),dist=rand(370,590);x=clamp(target.x+Math.cos(a)*dist,45,WORLD.w-45);y=clamp(target.y+Math.sin(a)*dist,45,WORLD.h-45);
 const typ=ENEMY_TYPES[typeName],waveScale=1+(game.wave-1)*.19,partyScale=1+Math.max(0,game.players.length-1)*.28;
 game.enemies.push({id:++game.seq,x,y,type:typeName,r:typ.r,hp:typ.hp*waveScale*partyScale,maxHp:typ.hp*waveScale*partyScale,speed:typ.speed*(1+game.wave*.025),atk:rand(0,.8),fire:rand(.7,2.2),hit:0,slow:0,angle:rand(0,6.28),knockX:0,knockY:0});
 if(typeName==='boss'){eventFx('blast',x,y,'#ffd55b',18);announce('MEGA GLOOP INCOMING!');}
}
function spawnGem(x,y,value){game.gems.push({id:++game.seq,x:x+rand(-8,8),y:y+rand(-8,8),v:value,r:value>15?9:6});}
function spawnHeart(){const target=randomTarget();if(!target)return;game.pickups.push({id:++game.seq,x:clamp(target.x+rand(-270,270),35,WORLD.w-35),y:clamp(target.y+rand(-270,270),35,WORLD.h-35),type:'heart',r:17});}
function eventFx(type,x,y,color,count,value){const e={id:++game.seq,type,x,y,color,count:count||10,value};if(!gameIsSolo)game.events.push(e);spawnFx(e);}
function spawnFx(e){if(e.type==='number'){fx.push({kind:'number',x:e.x,y:e.y,text:String(e.value),life:.68,dur:.68,color:e.color});return;}if(e.type==='ring'){fx.push({kind:'ring',x:e.x,y:e.y,life:.43,dur:.43,color:e.color});return;}
 const count=e.count||8;for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),v=rand(50,200);fx.push({kind:'bit',x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.65),dur:.65,r:rand(2,5),color:e.color});}if(fx.length>450)fx.splice(0,fx.length-450);
}
function dealDamage(enemy,damage,p,critical=false){
 if(enemy.hp<=0)return;
 enemy.hp-=damage;enemy.hit=.1;
 if(p?.slow)enemy.slow=1.7;
 if(critical||damage>=65)eventFx('number',enemy.x,enemy.y-20,critical?'#ffe36b':'#ffffff',0,Math.ceil(damage));
 if(enemy.hp<=0){p.kills++;const base=ENEMY_TYPES[enemy.type],value=base.xp;eventFx('burst',enemy.x,enemy.y,base.fill,enemy.type==='boss'?38:10);spawnGem(enemy.x,enemy.y,value);if(p.regen>0)p.hp=Math.min(p.maxHp,p.hp+.45);if(enemy.type==='boss'){for(let i=0;i<9;i++)spawnGem(enemy.x+rand(-60,60),enemy.y+rand(-60,60),18);spawnHeart();}if(p.id===localId)sound('hit');}
}
function addXp(amount){
 for(const p of game.players){if(p.dead)continue;p.xp+=amount*p.bonusXp;let safety=0;while(p.xp>=p.nextXp&&safety++<2){p.xp-=p.nextXp;p.level++;p.nextXp=Math.floor(p.nextXp*1.29+8);p.pendingLevels++;if(!p.choices.length){p.choices=generateChoices();p.pendingLevels--;}p.invuln=Math.max(p.invuln,1.2);eventFx('ring',p.x,p.y,'#cdff63');if(p.id===localId)sound('level');}}
}
function generateChoices(){return [...UPS].sort(()=>Math.random()-.5).slice(0,3).map(v=>v.id);}
function chooseUpgrade(p,index){if(!p?.choices?.length)return;const id=p.choices[clamp(index,0,2)];switch(id){
 case 'speed':p.speed*=1.18;break;case 'damage':p.damage*=1.28;break;case 'rapid':p.rate*=1.28;break;case 'health':p.maxHp+=35;p.hp=Math.min(p.maxHp,p.hp+35);break;case 'magnet':p.magnet+=90;break;case 'size':p.size*=1.3;p.damage*=1.10;break;
 case 'multi':p.multi=Math.min(7,p.multi+1);break;case 'crit':p.crit=Math.min(.85,p.crit+.14);break;case 'pierce':p.pierce+=1;break;case 'orbit':p.orbit=Math.min(6,p.orbit+1);break;
 case 'blast':p.blastScale*=1.26;p.blastDamage*=1.5;break;case 'heal':p.regen+=1.5;break;case 'slow':p.slow=true;break;case 'xp':p.bonusXp*=1.3;break;case 'dash':p.dashCD*=.75;break;
 }p.choices=p.pendingLevels>0?generateChoices():[];if(p.pendingLevels>0)p.pendingLevels--;p.invuln=2.1;eventFx('burst',p.x,p.y,PALETTE[p.color][0],15);
}
function performDash(p,dx,dy){if(p.dead||p.dashLeft>0)return;const len=Math.hypot(dx,dy);if(len<.01){dx=p.face||1;dy=0;}else{dx/=len;dy/=len;}p.x=clamp(p.x+dx*137,25,WORLD.w-25);p.y=clamp(p.y+dy*137,25,WORLD.h-25);p.dashLeft=p.dashCD;p.invuln=.48;eventFx('ring',p.x,p.y,'#d6ff65');if(p.id===localId)sound('dash');}
function performBlast(p){if(p.dead||p.blastLeft>0)return;p.blastLeft=11;p.invuln=Math.max(p.invuln,.35);const range=195*p.blastScale;for(const e of game.enemies){if(e.hp<=0)continue;const d=distance(p.x,p.y,e.x,e.y);if(d<range+e.r){dealDamage(e,p.blastDamage,p);const a=Math.atan2(e.y-p.y,e.x-p.x);e.knockX+=Math.cos(a)*210;e.knockY+=Math.sin(a)*210;}}for(const b of game.shots){if(distance(b.x,b.y,p.x,p.y)<range)b.life=0;}eventFx('ring',p.x,p.y,'#bd92ff');if(p.id===localId)sound('blast');}
function shootFrom(p){let best=null,ds=420*420;for(const e of game.enemies){if(e.hp<=0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<ds){ds=d;best=e;}}if(!best)return;
 const base=Math.atan2(best.y-p.y,best.x-p.x);for(let n=0;n<p.multi;n++){const a=base+(n-(p.multi-1)/2)*.17,critical=Math.random()<p.crit;game.bullets.push({id:++game.seq,x:p.x+Math.cos(a)*22,y:p.y+Math.sin(a)*22,vx:Math.cos(a)*640,vy:Math.sin(a)*640,life:.86,r:p.size,dmg:p.damage*(critical?3:1),critical,owner:p.id,pierce:p.pierce,hitIds:[]});}p.face=Math.cos(base)>0?1:-1;
 if(p.id===localId&&performance.now()-lastShootSound>130){sound('shoot');lastShootSound=performance.now();}}
function damagePlayer(p,amount){if(p.dead||p.invuln>0||p.choices.length)return;p.hp=Math.max(0,p.hp-amount);p.invuln=.72;p.hitLeft=.18;eventFx('number',p.x,p.y-25,'#ff7da4',0,'-'+Math.ceil(amount));if(p.id===localId){sound('hurt');try{navigator.vibrate?.(35);}catch{}}if(p.hp<=0){p.dead=true;p.revive=0;eventFx('burst',p.x,p.y,PALETTE[p.color][0],24);}}
function updateGame(dt){
 if(!game||game.phase!=='game'||paused&&gameIsSolo)return;
 if(game.countdown>0){game.countdown=Math.max(0,game.countdown-dt);return;}
 game.t+=dt;
 const wave=Math.min(6,Math.floor(game.t/30)+1);
 if(wave!==game.wave){game.wave=wave;announce('WAVE '+wave+'!');if([3,5,6].includes(wave))spawnEnemy('boss');sound('level');}
 game.spawnClock-=dt;const spawnRate=Math.max(.11,1.04-(game.wave-1)*.14)/Math.sqrt(game.players.length);
 if(game.spawnClock<=0){game.spawnClock+=spawnRate;const v=Math.random();spawnEnemy(game.wave>=3&&v<.15?'spit':game.wave>=2&&v<.40?'zip':game.wave>=2&&v<.54?'brute':'nibble');}
 game.pickupClock-=dt;if(game.pickupClock<=0){spawnHeart();game.pickupClock+=27;}
 // Players, automatic guns, orbiting buddies, revival.
 for(const p of game.players){
  p.invuln=Math.max(0,p.invuln-dt);p.hitLeft=Math.max(0,p.hitLeft-dt);p.dashLeft=Math.max(0,p.dashLeft-dt);p.blastLeft=Math.max(0,p.blastLeft-dt);p.shootLeft-=dt;p.spin+=dt*3;
  if(p.dead)continue;
  const input=p.input||{x:0,y:0};let dx=input.x,dy=input.y;const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
  if(input.dash)performDash(p,dx,dy);if(input.blast)performBlast(p);
  p.input.dash=false;p.input.blast=false;
  const speedFactor=p.choices?.length?.5:1;p.x=clamp(p.x+dx*p.speed*dt*speedFactor,p.r,WORLD.w-p.r);p.y=clamp(p.y+dy*p.speed*dt*speedFactor,p.r,WORLD.h-p.r);
  if(Math.abs(dx)>.07)p.face=dx>0?1:-1;
  if(p.regen)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
  if(p.shootLeft<=0){shootFrom(p);p.shootLeft=1/p.rate;}
  if(p.orbit){for(let i=0;i<p.orbit;i++){const a=p.spin+(i/p.orbit)*Math.PI*2,ox=p.x+Math.cos(a)*66,oy=p.y+Math.sin(a)*66;for(const e of game.enemies){if(e.hp>0&&distance(ox,oy,e.x,e.y)<e.r+13&&e.atk<=0){dealDamage(e,23+p.damage*.25,p);e.atk=.22;}}}}
 }
 // Enemy AI and contact damage.
 for(const e of game.enemies){if(e.hp<=0)continue;e.atk=Math.max(0,e.atk-dt);e.hit=Math.max(0,e.hit-dt);e.slow=Math.max(0,e.slow-dt);e.fire-=dt;let nearest=null,best=Infinity;
  for(const p of game.players){if(p.dead)continue;const d=distance(e.x,e.y,p.x,p.y);if(d<best){best=d;nearest=p;}}
  if(!nearest)continue;
  const angle=Math.atan2(nearest.y-e.y,nearest.x-e.x);e.angle=angle;
  const spd=e.speed*(e.slow>0?.52:1),retreat=e.type==='spit'?(best<185?-.7:best<390?0:1):1;
  e.x=clamp(e.x+(Math.cos(angle)*spd*retreat+e.knockX)*dt,e.r,WORLD.w-e.r);
  e.y=clamp(e.y+(Math.sin(angle)*spd*retreat+e.knockY)*dt,e.r,WORLD.h-e.r);
  e.knockX*=Math.max(0,1-7*dt);e.knockY*=Math.max(0,1-7*dt);
  if(e.type==='spit'&&best<530&&e.fire<=0){e.fire=2.6;game.shots.push({id:++game.seq,x:e.x,y:e.y,vx:Math.cos(angle)*255,vy:Math.sin(angle)*255,r:8,life:3,damage:14});}
  if(e.type==='boss'&&e.fire<=0){e.fire=3.4;for(let n=0;n<12;n++){const a=n*Math.PI/6+game.t*.4;game.shots.push({id:++game.seq,x:e.x,y:e.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,r:11,life:4,damage:18});}eventFx('ring',e.x,e.y,'#ffbe58');}
  for(const p of game.players){if(!p.dead&&distance(e.x,e.y,p.x,p.y)<e.r+p.r-3)damagePlayer(p,ENEMY_TYPES[e.type].damage);}
 }
 // Friendly bullets.
 for(const b of game.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0)continue;for(const e of game.enemies){if(e.hp<=0||b.hitIds.includes(e.id))continue;if(distance(b.x,b.y,e.x,e.y)<b.r+e.r){b.hitIds.push(e.id);const p=game.players.find(v=>v.id===b.owner);if(p)dealDamage(e,b.dmg,p,b.critical);eventFx('burst',b.x,b.y,b.critical?'#ffde68':'#dcff9c',3);if(--b.pierce<0){b.life=0;break;}}}}
 game.bullets=game.bullets.filter(b=>b.life>0&&b.x>0&&b.x<WORLD.w&&b.y>0&&b.y<WORLD.h);
 // Enemy projectiles.
 for(const b of game.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0)continue;for(const p of game.players){if(!p.dead&&distance(b.x,b.y,p.x,p.y)<b.r+p.r){damagePlayer(p,b.damage);b.life=0;break;}}}
 game.shots=game.shots.filter(b=>b.life>0);
 // Loot magnetises to any live player.
 for(const g of game.gems){let closest=null,best=Infinity;for(const p of game.players){if(p.dead)continue;const d=distance(g.x,g.y,p.x,p.y);if(d<best){best=d;closest=p;}}if(closest){if(best<closest.magnet){const a=Math.atan2(closest.y-g.y,closest.x-g.x),v=clamp(390+(closest.magnet-best)*3,390,980);g.x+=Math.cos(a)*Math.min(best,v*dt);g.y+=Math.sin(a)*Math.min(best,v*dt);}if(best<closest.r+g.r+8){g.collected=true;addXp(g.v);if(closest.id===localId&&Math.random()<.3)sound('pickup');}}}
 game.gems=game.gems.filter(g=>!g.collected).slice(-190);
 for(const h of game.pickups){for(const p of game.players){if(p.dead)continue;if(distance(p.x,p.y,h.x,h.y)<p.r+h.r+9){p.hp=Math.min(p.maxHp,p.hp+38);h.collected=true;eventFx('burst',h.x,h.y,'#ff6d96',14);if(p.id===localId)sound('level');break;}}}
 game.pickups=game.pickups.filter(p=>!p.collected);
 // Stand close to an eliminated friend to revive.
 for(const p of game.players){if(!p.dead)continue;const helper=game.players.find(q=>!q.dead&&distance(p.x,p.y,q.x,q.y)<75);p.revive=helper?p.revive+dt:Math.max(0,p.revive-dt*.8);if(p.revive>=3){p.dead=false;p.hp=p.maxHp*.5;p.invuln=3;p.revive=0;eventFx('blast',p.x,p.y,'#cbff54',27);announce(`${p.name.toUpperCase()} IS BACK!`);}}
 game.enemies=game.enemies.filter(e=>e.hp>0);
 if(game.t>=game.duration||game.players.every(p=>p.dead))finishGame(game.t>=game.duration);
}
function announce(text){$('announcement').textContent=text;$('announcement').classList.add('show');announceTimer=2.0;}
function finishGame(won){if(game.finished)return;game.finished=true;game.phase='finished';const results={won,t:game.t,wave:game.wave,players:game.players.map(p=>({id:p.id,name:p.name,color:p.color,kills:p.kills,level:p.level}))};if(!gameIsSolo)wsSend({type:'ended',results});showResults(results);}
function showResults(results){if(!results)return;game?.phase&&(game.phase='finished');showScreen('resultScreen');$('upgradeModal').classList.add('hidden');$('pauseModal').classList.add('hidden');$('resultEyebrow').textContent=results.won?'✦ THE GANG SURVIVED':'✦ THE GANG GOT SQUISHED';$('resultTitle').textContent=results.won?'GLOOP-TASTIC!':'SO CLOSE!';$('resultSubtitle').textContent=results.won?'You survived the full 3-minute chaos. Legends.':'Even the best blobs get squished. Upgrade and bounce back!';$('resultTime').textContent=formatTime(results.t);$('resultWave').textContent=results.wave;
 const player=results.players.find(p=>p.id===localId)||{kills:0,level:1};const coins=Math.floor(12+player.kills*.75+results.t/8+results.wave*6+(results.won?65:0));$('resultKills').textContent=player.kills;$('resultCoins').textContent='+'+coins;
 if(!myResultPaid){profile.coins+=coins;persist();myResultPaid=true;}renderGarage();$('scoreboard').innerHTML=[...results.players].sort((a,b)=>b.kills-a.kills).map((p,i)=>`<div class="score-row"><span>${i+1}. ${escapeHtml(p.name)} ${p.id===localId?'(you)':''}</span><span>LVL ${p.level} · <strong>${p.kills} KOs</strong></span></div>`).join('');$('againBtn').textContent=gameIsSolo?'⚡ ANOTHER RUN':net?.public?'⚡ PLAY AGAIN':'⚡ '+(hostMode?'NEXT ROUND':'WAIT FOR HOST');$('againBtn').disabled=!gameIsSolo&&!net?.public&&!hostMode;sound(results.won?'win':'hurt');}
function formatTime(t){const s=Math.max(0,Math.ceil(t));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
$('againBtn').onclick=()=>{
 if(gameIsSolo){initGame([{id:'p1',profile:serverProfile()}]);beginScreen();}
 else if(net?.public){
  if(hostMode){wsSend({type:'restart'});initGame(net.players);beginScreen();updateOnlineStatus();}
  else quickMatch();
 }else if(hostMode&&net){wsSend({type:'restart'});game=null;displayLobby();}
};
$('resultMenuBtn').onclick=leaveRoom;
$('pauseBtn').onclick=()=>togglePause();
$('resumeBtn').onclick=()=>{$('pauseModal').classList.add('hidden');paused=false;};
$('quitBtn').onclick=leaveRoom;
function togglePause(){if(!$('gameScreen').classList.contains('active'))return;if(!$('pauseModal').classList.contains('hidden')){paused=false;$('pauseModal').classList.add('hidden');return;}paused=gameIsSolo;$('pauseMessage').textContent=gameIsSolo?'Game paused. Your gloop is safe.':'Online games cannot pause. Your gloop is still in danger!';$('pauseModal').classList.remove('hidden');}

function inputState(){let x=0,y=0;if(keySet.has('a')||keySet.has('arrowleft'))x--;if(keySet.has('d')||keySet.has('arrowright'))x++;if(keySet.has('w')||keySet.has('arrowup'))y--;if(keySet.has('s')||keySet.has('arrowdown'))y++;if(joystick.active){x=joystick.x;y=joystick.y;}const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}const o={x,y,dash:action.dash,blast:action.blast};action.dash=false;action.blast=false;return o;}
function sampleInput(){const i=inputState();if(hostMode){const p=me();if(p){p.input=i;} // Host simulation should consume these inputs in its next tick, not lose one-shot actions.
   return i;}
 return i;}
function controlsTick(dt){if(!$('gameScreen').classList.contains('active')||!game||game.phase!=='game')return;
 // Host collects input once per frame, guest sends latest movement and skill taps at 20 Hz.
 if(hostMode){const p=me();if(p){const prior=p.input||{};const next=sampleInput();p.input={...next,dash:next.dash||prior.dash,blast:next.blast||prior.blast};}}else{lastSent+=dt;if(lastSent>=.05){lastSent=0;wsSend({type:'input',input:inputState()});}}
}
function joystickChange(e){const rect=$('joystickArea').getBoundingClientRect();const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;const dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),mag=Math.min(1,len/51);joystick.x=len?dx/len*mag:0;joystick.y=len?dy/len*mag:0;$('joystickKnob').style.transform=`translate(${joystick.x*36}px, ${joystick.y*36}px)`;}
$('joystickArea').addEventListener('pointerdown',e=>{e.preventDefault();joystick.active=true;joystick.pointer=e.pointerId;$('joystickArea').setPointerCapture(e.pointerId);joystickChange(e);});
$('joystickArea').addEventListener('pointermove',e=>{if(joystick.active&&e.pointerId===joystick.pointer)joystickChange(e);});
function releaseStick(e){if(e.pointerId!==joystick.pointer)return;joystick.active=false;joystick.x=0;joystick.y=0;joystick.pointer=null;$('joystickKnob').style.transform='translate(0,0)';}
$('joystickArea').addEventListener('pointerup',releaseStick);$('joystickArea').addEventListener('pointercancel',releaseStick);
$('dashBtn').addEventListener('pointerdown',e=>{e.preventDefault();action.dash=true;});
$('blastBtn').addEventListener('pointerdown',e=>{e.preventDefault();action.blast=true;});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)&&$('gameScreen').classList.contains('active'))e.preventDefault();if(['input','textarea'].includes(document.activeElement.tagName.toLowerCase()))return;keySet.add(k);if(!e.repeat&&k===' '){action.dash=true;}if(!e.repeat&&k==='e'){action.blast=true;}if(!e.repeat&&k==='escape')togglePause();if(['1','2','3'].includes(k)&&!$('upgradeModal').classList.contains('hidden'))pickUpgrade(Number(k)-1);});
window.addEventListener('keyup',e=>keySet.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keySet.clear();joystick.active=false;joystick.x=0;joystick.y=0;$('joystickKnob').style.transform='translate(0,0)';});
function pickUpgrade(index){const p=me();if(!p?.choices?.length)return;if(hostMode)chooseUpgrade(p,index);else wsSend({type:'choice',index});lastUpSelection='';sound('level');}
function updateUpgradeUI(){const p=me(),ids=p?.choices||[];if(!ids.length){$('upgradeModal').classList.add('hidden');lastUpSelection='';return;}
 const signature=ids.join(',');if(signature===lastUpSelection)return;lastUpSelection=signature;$('upgradeCards').innerHTML=ids.map((id,i)=>{const v=UPS.find(u=>u.id===id);return `<button class="upgrade-card" data-idx="${i}"><span class="up-emoji">${v.icon}</span><span class="up-name">${v.name}</span><span class="up-description">${v.desc}</span><span class="up-rarity">${v.rarity==='EPIC'?'✦ ✦ ✦':v.rarity==='RARE'?'✦ ✦':'✦'} ${v.rarity}</span></button>`;}).join('');document.querySelectorAll('.upgrade-card').forEach(el=>el.addEventListener('click',()=>pickUpgrade(+el.dataset.idx)));$('upgradeModal').classList.remove('hidden');}
function updateHud(dt){if(!game||game.phase!=='game')return;const p=me();if(!p)return;const ratio=clamp(p.hp/p.maxHp,0,1);$('hpFill').style.width=(ratio*100)+'%';$('hpText').textContent=Math.ceil(p.hp)+'/'+Math.ceil(p.maxHp);$('xpFill').style.width=clamp(p.xp/p.nextXp*100,0,100)+'%';$('levelText').textContent='LVL '+p.level;$('waveText').textContent='WAVE '+game.wave;$('timeText').textContent=formatTime(Math.max(0,game.duration-game.t));$('killText').textContent=p.kills;
 const dl=Math.ceil(p.dashLeft),bl=Math.ceil(p.blastLeft);$('dashLabel').textContent=dl?dl+'s':'DASH';$('blastLabel').textContent=bl?bl+'s':'BLAST';$('dashBtn').classList.toggle('cooldown',!!dl);$('blastBtn').classList.toggle('cooldown',!!bl);$('dashBtn').classList.toggle('ready',!dl);$('blastBtn').classList.toggle('ready',!bl);
 const friends=game.players.filter(v=>v.id!==localId);lastMini+=dt;if(lastMini>.35){lastMini=0;$('playersMini').innerHTML=friends.map(v=>`<div class="mini-player">${v.dead?'💀':'●'} ${escapeHtml(v.name)} · ${v.dead?'REVIVE':Math.ceil(v.hp)+' HP'}</div>`).join('');}
 const down=p.dead?game.players.some(v=>!v.dead)?'YOU GOT SQUISHED! A friend can revive you.':'THE WHOLE GANG IS DOWN!':game.players.some(v=>v.dead)?'Move near a downed friend to revive them!':'';$('reviveHint').textContent=down;updateUpgradeUI();
 if(game.countdown>0){$('announcement').textContent=String(Math.ceil(game.countdown));$('announcement').classList.add('show');}else if(announceTimer>0){announceTimer-=dt;if(announceTimer<=0)$('announcement').classList.remove('show');}else $('announcement').classList.remove('show');
}

function resizeCanvas(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;vw=rect.width;vh=rect.height;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
window.addEventListener('resize',resizeCanvas);
let scale=1;
function smoothEntity(e,kind,dt){
 if(hostMode)return e;
 const key=kind+e.id;let v=visualCache.get(key);if(!v){v={x:e.x,y:e.y,seen:0};visualCache.set(key,v);}
 const diff=distance(v.x,v.y,e.x,e.y);
 if(diff>240){v.x=e.x;v.y=e.y;}else{const factor=1-Math.exp(-dt*18);v.x+=(e.x-v.x)*factor;v.y+=(e.y-v.y)*factor;}
 v.seen=performance.now();return {...e,x:v.x,y:v.y};
}
function render(dt){if(!game||!$('gameScreen').classList.contains('active'))return;if(!vw||!vh)resizeCanvas();
 if(!hostMode&&++visFrames%120===0){const now=performance.now();for(const [k,v] of visualCache)if(now-v.seen>3600)visualCache.delete(k);}
 const p=me()||game.players?.[0];if(!p)return;
 scale=clamp(Math.min(vw/480,vh/820),.76,1.3);if(vw>800)scale=clamp(Math.min(vw/1200,vh/720)*1.05,.82,1.22);
 const drawnSelf=smoothEntity(p,'player',dt);const targetX=drawnSelf.x,targetY=drawnSelf.y;camera.x+=(targetX-camera.x)*Math.min(1,dt*8);camera.y+=(targetY-camera.y)*Math.min(1,dt*8);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#151326';ctx.fillRect(0,0,vw,vh);
 ctx.save();ctx.translate(vw/2-camera.x*scale,vh/2-camera.y*scale);ctx.scale(scale,scale);
 const bounds={left:camera.x-vw/scale/2,top:camera.y-vh/scale/2,right:camera.x+vw/scale/2,bottom:camera.y+vh/scale/2};drawArena(bounds);
 for(const gem of game.gems)drawGem(smoothEntity(gem,'gem',dt));
 for(const pickup of game.pickups)drawHeart(smoothEntity(pickup,'pickup',dt));
 for(const e of game.enemies)drawEnemy(smoothEntity(e,'enemy',dt));
 for(const b of game.shots)drawEnemyBullet(smoothEntity(b,'shot',dt));
 for(const b of game.bullets)drawBullet(smoothEntity(b,'bullet',dt));
 for(const pl of game.players)drawPlayer(pl.id===p.id?drawnSelf:smoothEntity(pl,'player',dt));
 updateFx(dt);ctx.restore();
 // Screen-edge damage flash.
 if(p.hitLeft>0){ctx.fillStyle=`rgba(255,72,117,${p.hitLeft*.42})`;ctx.fillRect(0,0,vw,vh);}
 if(p.dead){ctx.fillStyle='rgba(18,10,28,.35)';ctx.fillRect(0,0,vw,vh);}
}
function drawArena(bounds){
 ctx.fillStyle='#19182d';ctx.fillRect(0,0,WORLD.w,WORLD.h);
 // Soft floor checker, flecks, decorative puddles.
 const startX=Math.max(0,Math.floor(bounds.left/92)*92),endX=Math.min(WORLD.w,bounds.right+92),startY=Math.max(0,Math.floor(bounds.top/92)*92),endY=Math.min(WORLD.h,bounds.bottom+92);
 ctx.strokeStyle='#ffffff09';ctx.lineWidth=1;ctx.beginPath();for(let x=startX;x<endX;x+=92){ctx.moveTo(x,Math.max(0,bounds.top));ctx.lineTo(x,Math.min(WORLD.h,bounds.bottom));}for(let y=startY;y<endY;y+=92){ctx.moveTo(Math.max(0,bounds.left),y);ctx.lineTo(Math.min(WORLD.w,bounds.right),y);}ctx.stroke();
 const cStart=Math.max(0,Math.floor(bounds.left/160)),cEnd=Math.min(Math.ceil(WORLD.w/160),Math.ceil(bounds.right/160));const rStart=Math.max(0,Math.floor(bounds.top/160)),rEnd=Math.min(Math.ceil(WORLD.h/160),Math.ceil(bounds.bottom/160));
 for(let i=cStart;i<=cEnd;i++)for(let j=rStart;j<=rEnd;j++){const hash=(i*928371+j*192827)&0xffffff,ox=i*160+(hash%103),oy=j*160+((hash>>7)%113);if(hash%5===0){ctx.fillStyle='#343053';ctx.beginPath();ctx.ellipse(ox,oy,14+hash%26,7+hash%16,hash%6,0,Math.PI*2);ctx.fill();}else if(hash%3===0){ctx.fillStyle=hash%2?'#69617d':'#777b87';ctx.beginPath();ctx.arc(ox,oy,1.5+hash%3,0,7);ctx.fill();}}
 ctx.strokeStyle='#a58ac0';ctx.lineWidth=16;ctx.strokeRect(5,5,WORLD.w-10,WORLD.h-10);ctx.strokeStyle='#baff5a33';ctx.lineWidth=3;ctx.strokeRect(17,17,WORLD.w-34,WORLD.h-34);
}
function ell(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function drawBlob(x,y,r,main,dark,t,face=1,dead=false){
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*4+x*.003)*.055);ell(0,r*.68,r*.96,r*.42,'#06061359');
 const wob=Math.sin(t*5+x*.025)*.065;ctx.beginPath();for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,rr=r*(1+wob*Math.cos(a*3)+.055*Math.sin(a*5+t));const px=Math.cos(a)*rr,py=Math.sin(a)*rr*.94;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();const grad=ctx.createRadialGradient(-r*.4,-r*.55,r*.15,0,0,r*1.5);grad.addColorStop(0,'#ffffff');grad.addColorStop(.16,main);grad.addColorStop(1,dark);ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#ffffff55';ctx.lineWidth=2;ctx.stroke();
 if(dead){ctx.strokeStyle='#232039';ctx.lineWidth=2.5;for(const a of [-.32,.32]){const ex=a*r;ctx.beginPath();ctx.moveTo(ex-4,-5);ctx.lineTo(ex+4,3);ctx.moveTo(ex+4,-5);ctx.lineTo(ex-4,3);ctx.stroke();}}
 else{ell(-r*.33,-r*.1,r*.115,r*.18,'#24213c');ell(r*.33,-r*.1,r*.115,r*.18,'#24213c');ell(-r*.37,-r*.17,r*.04,r*.065,'white');ell(r*.29,-r*.17,r*.04,r*.065,'white');ctx.strokeStyle='#29233e';ctx.lineWidth=Math.max(1.5,r*.08);ctx.lineCap='round';ctx.beginPath();ctx.arc(0,r*.2,r*.24,.15,Math.PI-.15);ctx.stroke();ell(-r*.58,r*.19,r*.13,r*.07,'#ff709155');ell(r*.58,r*.19,r*.13,r*.07,'#ff709155');}
 ctx.restore();}
function drawPlayer(p){const pal=PALETTE[p.color]||PALETTE.mint;const now=game.t||0;if(p.dead){ctx.globalAlpha=.65;drawBlob(p.x,p.y,p.r,pal[0],pal[1],now,p.face,true);ctx.globalAlpha=1;ctx.strokeStyle='#d6ff65';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.r+12,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.revive/3,0,1));ctx.stroke();return;}
 if(p.invuln>.05&&Math.sin(performance.now()*.025)>0.5)ctx.globalAlpha=.65;
 if(p.id===localId){ctx.strokeStyle='#d6ff6599';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r+7,0,Math.PI*2);ctx.stroke();}
 drawBlob(p.x,p.y+Math.sin(now*6+p.x)*1.8,p.r,pal[0],pal[1],now,p.face);ctx.globalAlpha=1;
 if(p.orbit){for(let i=0;i<p.orbit;i++){const a=p.spin+i/p.orbit*Math.PI*2,x=p.x+Math.cos(a)*66,y=p.y+Math.sin(a)*66;ctx.fillStyle='#c3a1ff';ctx.shadowColor='#bf9aff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ell(x-3,y-2,2.5,2,'#ffffff');}}
 if(p.hp<p.maxHp){ctx.fillStyle='#0007';ctx.fillRect(p.x-26,p.y-p.r-18,52,6);ctx.fillStyle='#8ef05c';ctx.fillRect(p.x-26,p.y-p.r-18,52*clamp(p.hp/p.maxHp,0,1),6);}
 ctx.textAlign='center';ctx.font='900 12px DM Sans, sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#1a162e';ctx.strokeText(p.name,p.x,p.y-p.r-25);ctx.fillStyle='#ffffff';ctx.fillText(p.name,p.x,p.y-p.r-25);
 if(p.choices?.length){ctx.fillStyle='#fff78f';ctx.font='900 19px sans-serif';ctx.fillText('✦',p.x,p.y-p.r-40);}
}
function drawEnemy(e){const d=ENEMY_TYPES[e.type];ctx.save();if(e.hit>0)ctx.globalAlpha=.75;drawBlob(e.x,e.y,e.r,e.hit>0?'#ffffff':d.fill,e.type==='boss'?'#c57421':'#703a80',game.t+e.id*.2,1);if(e.type==='boss'){ctx.strokeStyle='#f3bc5688';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r+9,0,7);ctx.stroke();}if(e.hp<e.maxHp&&(e.type==='boss'||e.type==='brute')){ctx.fillStyle='#0009';ctx.fillRect(e.x-e.r,e.y-e.r-14,e.r*2,6);ctx.fillStyle='#ff719a';ctx.fillRect(e.x-e.r,e.y-e.r-14,e.r*2*clamp(e.hp/e.maxHp,0,1),6);}if(e.type==='boss'){ctx.font='900 13px DM Sans,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('MEGA GLOOP',e.x,e.y-e.r-22);}if(e.slow>0){ctx.strokeStyle='#7ce0ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+3,0,7);ctx.stroke();}ctx.restore();}
function drawGem(g){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(performance.now()*.002+g.id);ctx.shadowColor='#cbff54';ctx.shadowBlur=10;ctx.fillStyle=g.v>15?'#ffdb64':'#bcff5c';ctx.beginPath();ctx.moveTo(0,-g.r*1.3);ctx.lineTo(g.r,0);ctx.lineTo(0,g.r*1.3);ctx.lineTo(-g.r,0);ctx.closePath();ctx.fill();ctx.restore();}
function drawHeart(p){ctx.save();ctx.translate(p.x,p.y+Math.sin(performance.now()*.005+p.id)*5);ctx.shadowColor='#ff6e98';ctx.shadowBlur=16;ctx.fillStyle='#ff6e98';ctx.font='28px sans-serif';ctx.textAlign='center';ctx.fillText('❤',0,9);ctx.restore();}
function drawBullet(b){ctx.save();ctx.strokeStyle=b.critical?'#ffde68':'#c7ff6f';ctx.lineWidth=b.r*1.6;ctx.lineCap='round';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();}
function drawEnemyBullet(b){ctx.save();ctx.shadowColor='#ff8aa8';ctx.shadowBlur=12;ctx.fillStyle='#ff83b0';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();ctx.fillStyle='#fff2';ctx.beginPath();ctx.arc(b.x-2,b.y-2,b.r*.45,0,7);ctx.fill();ctx.restore();}
function updateFx(dt){for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;if(f.life<=0){fx.splice(i,1);continue;}const alpha=clamp(f.life/f.dur,0,1);ctx.save();ctx.globalAlpha=alpha;if(f.kind==='bit'){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=.96;f.vy*=.96;ell(f.x,f.y,f.r,f.r,f.color);}else if(f.kind==='ring'){const r=(1-alpha)*195;ctx.strokeStyle=f.color;ctx.lineWidth=5*alpha+1;ctx.beginPath();ctx.arc(f.x,f.y,r,0,7);ctx.stroke();}else{ctx.font='900 21px Barlow Condensed, Impact, sans-serif';ctx.fillStyle=f.color;ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y-(1-alpha)*38);}ctx.restore();}}
function tick(now){const dt=clamp((now-lastFrame)/1000,0,.05);lastFrame=now;requestAnimationFrame(tick);
 if(!$('gameScreen').classList.contains('active'))return;
 if(!vw||!vh)resizeCanvas();
 controlsTick(dt);
 if(hostMode&&game?.phase==='game'){
  if(gameIsSolo&&me()?.choices?.length){ // Freeze the arena during solo upgrade picks.
   // Visual effects still animate.
  }else updateGame(dt);
  if(!gameIsSolo&&net){lastSent+=dt;if(lastSent>.095){lastSent=0;const snapshots={...game,events:game.events.slice(-70)};wsSend({type:'snapshot',state:snapshots});game.events=[];}}
 }
 render(dt);updateHud(dt);
}
requestAnimationFrame(tick);
const params=new URLSearchParams(location.search);const joinCode=(params.get('join')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(joinCode.length===6){$('roomInput').value=joinCode;openSocket('join',joinCode);}
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();
