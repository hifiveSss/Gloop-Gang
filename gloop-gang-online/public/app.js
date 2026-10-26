(() => {
'use strict';
const G=window.GloopCore, $=id=>document.getElementById(id), CARDS=G.CARDS;
const screens=['homeScreen','deckScreen','battleScreen'];
const MODALS=['queueOverlay','friendOverlay','rulesOverlay','resultOverlay'];
const STORAGE='gloop-rift-v2';
let saved={name:'',coins:200,trophies:0,wins:0,games:0,deck:[...G.DEFAULT_DECK],levels:{}};
try{const data=JSON.parse(localStorage.getItem(STORAGE));if(data&&typeof data==='object')saved={...saved,...data};}catch{}
if(!saved.name)saved.name='Glooper '+String(Math.floor(100+Math.random()*900));
for(const c in CARDS)saved.levels[c]=Math.max(1,Math.min(5,Number(saved.levels[c])||1));
const profile=()=>G.safeProfile(saved);
function store(){localStorage.setItem(STORAGE,JSON.stringify(saved));renderCurrencies();}
let selectedSlot=null,view='home',ws=null,connection='idle',selectedCard=null,game=null,previous=null,lastSnapshot=0,side=0,mode='online',localMode=false,localBotTick=0,localLast=0;
let pointer=null,drag=null,hover=null,toastTimer,arenaMsgTimer,emoteTimer,finishedLocal=false,gameWasActive=false,queueing=false,friendCode='',resultRecorded=false;
const canvas=$('arena'),ctx=canvas.getContext('2d',{alpha:false}),W=G.W,H=G.H;
function renderCurrencies(){$('coinCount').textContent=Math.floor(saved.coins);$('trophyCount').textContent=Math.floor(saved.trophies);}
function show(screen){view=screen;screens.forEach(s=>$(s).classList.toggle('hidden',s!==screen+'Screen'));$('bottomNav').classList.toggle('hidden',screen==='battle'); $('navBattle').classList.toggle('selected',screen==='home');$('navCards').classList.toggle('selected',screen==='deck');if(screen==='home')renderHome();if(screen==='deck')renderDeck();}
function modal(id){MODALS.forEach(m=>$(m).classList.toggle('hidden',m!==id));}
function toast(str,time=2600){const e=$('toast');e.textContent=str;e.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.add('hidden'),time);}
function arenaToast(str){const e=$('arenaToast');e.textContent=str;e.classList.remove('hidden');clearTimeout(arenaMsgTimer);arenaMsgTimer=setTimeout(()=>e.classList.add('hidden'),1300);}
function cleanTitle(card){return CARDS[card]?.name||'Unknown';}
function renderHome(){renderCurrencies();$('playerName').value=saved.name;const deck=profile().deck;$('homeDeck').innerHTML=deck.map(k=>`<div class="small-card" title="${CARDS[k].name}"><small>${CARDS[k].cost}</small><span>${CARDS[k].icon}</span></div>`).join('');$('deckAverage').textContent=(deck.reduce((a,k)=>a+CARDS[k].cost,0)/8).toFixed(1)+' avg goo';}
function costToUpgrade(k){return 90*saved.levels[k]+35*saved.levels[k]*saved.levels[k];}
function renderDeck(){const prof=profile(),deck=prof.deck; saved.deck=deck;
 $('deckSlots').innerHTML=deck.map((k,i)=>`<button class="deck-slot ${selectedSlot===i?'active':''}" data-slot="${i}" aria-label="Slot ${i+1}, ${cleanTitle(k)}"><span class="card-cost">${CARDS[k].cost}</span><span class="card-emoji">${CARDS[k].icon}</span><span class="card-name">${CARDS[k].name}</span></button>`).join('');
 $('deckCost').textContent=(deck.reduce((a,k)=>a+CARDS[k].cost,0)/8).toFixed(1)+' average goo';
 const available=Object.keys(CARDS).filter(k=>CARDS[k].unlock<=saved.trophies);
 $('unlockedCount').textContent=available.length+'/'+Object.keys(CARDS).length+' unlocked';
 $('collection').innerHTML=Object.entries(CARDS).map(([k,c])=>{const unlocked=c.unlock<=saved.trophies,level=saved.levels[k],upgrade=costToUpgrade(k),using=deck.includes(k);
 return `<div class="collection-card ${unlocked?'':'locked'} ${using?'selected-card':''}" data-key="${k}"><span class="cost-dot">${c.cost}</span><div class="collection-art">${unlocked?c.icon:'🔒'}</div><div class="collection-info"><b>${c.name}</b><p>${unlocked?c.desc:'Unlock at '+c.unlock+' trophies'}</p><small>${unlocked?'LEVEL '+level+(using?' · IN DECK':''):'LOCKED'}</small></div>${unlocked?`<button class="upgrade-btn" data-upgrade="${k}" ${level>=5||saved.coins<upgrade?'disabled':''}>${level>=5?'MAX':'🪙 '+upgrade}</button>`:''}</div>`;}).join('');
 $('deckInstruction').textContent=selectedSlot===null?'Tap a deck slot, then pick an unlocked card below to swap it in.':`Select a card below to replace ${cleanTitle(deck[selectedSlot])}.`;
}
$('deckSlots').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;const i=Number(b.dataset.slot);selectedSlot=selectedSlot===i?null:i;renderDeck();});
$('collection').addEventListener('click',e=>{
 const ub=e.target.closest('[data-upgrade]');if(ub){const k=ub.dataset.upgrade,price=costToUpgrade(k);if(saved.levels[k]>=5||saved.coins<price)return;saved.coins-=price;saved.levels[k]++;store();renderDeck();sound('upgrade');toast(`${CARDS[k].name} upgraded to level ${saved.levels[k]}!`);return;}
 const item=e.target.closest('[data-key]');if(!item)return;const k=item.dataset.key;if(CARDS[k].unlock>saved.trophies){toast(`Reach ${CARDS[k].unlock} trophies to unlock!`);return;}
 if(selectedSlot===null){const i=saved.deck.indexOf(k);if(i>=0){selectedSlot=i;renderDeck();toast('Selected this deck slot. Choose a different card to swap.');}else toast('Select a deck slot above first.');return;}
 const oldIndex=saved.deck.indexOf(k),old=saved.deck[selectedSlot];if(oldIndex>=0)saved.deck[oldIndex]=old;saved.deck[selectedSlot]=k;selectedSlot=null;store();renderDeck();sound('select');
});
$('playerName').addEventListener('change',e=>{saved.name=e.target.value.replace(/[<>]/g,'').trim().slice(0,16)||saved.name;store();});
$('playerName').addEventListener('blur',e=>e.target.dispatchEvent(new Event('change')));
$('editDeckBtn').onclick=()=>{selectedSlot=null;show('deck');};$('navCards').onclick=()=>{selectedSlot=null;show('deck');};$('navBattle').onclick=()=>show('home');$('deckBack').onclick=()=>show('home');
$('navRules').onclick=()=>modal('rulesOverlay');$('closeRules').onclick=()=>modal(null);$('rulesPlay').onclick=()=>{modal(null);begin('online');};
function socketConnect(){return new Promise((resolve,reject)=>{
 if(ws&&ws.readyState===1)return resolve(ws);
 if(ws&&(ws.readyState===0)){const started=Date.now();const wait=setInterval(()=>{if(ws.readyState===1){clearInterval(wait);resolve(ws);}else if(ws.readyState===3||Date.now()-started>5000){clearInterval(wait);reject(new Error('Connection unavailable'));}},80);return;}
 try{const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');ws=socket;const timer=setTimeout(()=>{if(socket.readyState!==1){socket.close();reject(new Error('Server unavailable'));}},6500);
 socket.onopen=()=>{clearTimeout(timer);connection='online';resolve(socket);};
 socket.onerror=()=>{clearTimeout(timer);reject(new Error('Connection failed'));};
 socket.onclose=()=>{if(ws!==socket)return;connection='offline';if(view==='battle'&&!localMode&&game?.phase!=='over'){modal(null);toast('Connection lost. Your match has ended.');setTimeout(()=>exitToHome(false),1500);}else if(queueing){queueing=false;modal(null);toast('Could not connect. Try VS Bot.');}};
 socket.onmessage=e=>{try{message(JSON.parse(e.data));}catch(err){console.warn('Invalid update',err);}};
 }catch(err){reject(err);}
 });}
function send(obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
async function begin(which){sound('select');resultRecorded=false;finishedLocal=false;localMode=false;game=null;previous=null;selectedCard=null;gameWasActive=false;
 mode=which;modal(which==='friend'?'friendOverlay':'queueOverlay');queueing=true;
 if(which==='friend'){$('inviteLink').textContent='Creating a private match…';$('roomCode').textContent='······';}
 if(which==='online')$('queueOverlay').querySelector('h2').textContent='Finding your rival…';
 if(which==='bot'){$('queueOverlay').querySelector('h2').textContent='Waking up Glooptron…';}
 try{await socketConnect();if(!queueing)return;send({type:which==='online'?'queue':which==='friend'?'friend':'bot',profile:profile()});}
 catch(err){queueing=false;modal(null);if(which==='bot')startLocal();else toast('Server unavailable. Try VS Bot instead.');}
}
function startLocal(){localMode=true;mode='practice';startMatch({side:0,bot:true,mode:'practice',state:G.snapshot(G.newGame(profile(),{name:'Glooptron',deck:G.DEFAULT_DECK,levels:{}},true))});localEngine=G.newGame(profile(),{name:'Glooptron',deck:G.DEFAULT_DECK,levels:{}},true);game=G.snapshot(localEngine);previous=null;localLast=performance.now();toast('Offline practice match!');}
let localEngine=null;
function message(m){switch(m.type){
 case 'hello':break;
 case 'queue':break;
 case 'friend':friendCode=m.code;{const url=location.origin+location.pathname+'?join='+m.code;$('inviteLink').textContent=url;$('roomCode').textContent=m.code;}break;
 case 'start':queueing=false;startMatch(m);break;
 case 'state':if(!localMode){previous=game;game=m.state;lastSnapshot=performance.now();refreshHUD();}break;
 case 'played':if(m.side===side){sound('deploy');}else sound('enemy');break;
 case 'result':receiveResult(m);break;
 case 'rematch_status':toast('Rematch ready: '+m.count+'/2 players',2200);break;
 case 'notice':toast(m.message);break;
 case 'rejected':arenaToast(m.message);sound('error');break;
 case 'emote':showEmote(m.emote);break;
 case 'error':queueing=false;modal(null);toast(m.message);break;
 }}
function startMatch(m){queueing=false;modal(null);show('battle');localMode=!!localMode;side=m.side;mode=m.mode||mode;previous=null;game=m.state;lastSnapshot=performance.now();selectedCard=null;resultRecorded=false;gameWasActive=true;
 $('fieldTip').classList.remove('hidden');setTimeout(()=>$('fieldTip').classList.add('hidden'),5000);refreshHUD();resizeArena();sound('start');}
function refreshHUD(){if(!game)return;const me=game.players[side],enemy=game.players[1-side];if(!me||!enemy)return;
 const sec=Math.max(0,Math.ceil(game.duration-game.t));$('battleClock').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
 $('enemyName').textContent=enemy.name+(game.bot?' 🤖':'');$('myName').textContent=me.name;
 $('energyText').textContent=me.energy.toFixed(1);$('energyFill').style.width=Math.min(100,me.energy*10)+'%';
 const owned=game.rifts.filter(r=>side===0?r.progress>.62:r.progress<-.62).length;
 $('energyBonus').textContent=game.t>game.duration-45?'⚡ DOUBLE GOO':owned?'✳ +'+owned+' RIFT BOOST':'✳ CAPTURE RIFTS FOR +GOO';
 $('nextCardIcon').textContent=CARDS[me.nextCard]?.icon||'✨';
 const hand=me.hand;let html=hand.map(k=>{const c=CARDS[k],enough=me.energy>=c.cost;
 return `<button class="hand-card ${selectedCard===k?'picked':''} ${enough?'':'not-enough'}" data-card="${k}" aria-label="${c.name}, ${c.cost} goo"><span class="cost">${c.cost}</span><span class="icon">${c.icon}</span><span class="title">${c.name}</span><span class="level">LV ${saved.levels[k]||1}</span></button>`;}).join('');
 if($('hand').innerHTML!==html)$('hand').innerHTML=html;
 $('handHint').textContent=selectedCard?`DEPLOY ${CARDS[selectedCard].name.toUpperCase()}`:'SELECT A CARD';
 if(selectedCard&&!hand.includes(selectedCard)){selectedCard=null;}
}
function showEmote(emoji){const el=$('emoteBubble');el.textContent=emoji;el.classList.remove('hidden');clearTimeout(emoteTimer);emoteTimer=setTimeout(()=>el.classList.add('hidden'),1700);}
$('emoteBtn').onclick=()=>{const list=['👋','😈','😱','💚','GG'];const idx=(Number($('emoteBtn').dataset.n)||0)%list.length;const emoji=list[idx];$('emoteBtn').dataset.n=idx+1;send({type:'emote',emote:emoji});showEmote(emoji);};
$('onlineBtn').onclick=()=>begin('online');$('friendBtn').onclick=()=>begin('friend');$('practiceBtn').onclick=()=>begin('bot');
$('cancelQueue').onclick=()=>{queueing=false;send({type:'cancel'});modal(null);};
$('cancelFriend').onclick=()=>{queueing=false;send({type:'cancel'});modal(null);};
$('shareInvite').onclick=async()=>{const text=$('inviteLink').textContent;if(!text.startsWith('http'))return;
 try{if(navigator.share)await navigator.share({title:'Join my Gloop Gang battle!',text:'Challenge me in Rift Rumble!',url:text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Invite link copied!');}else{prompt('Copy this invite link:',text);}}
 catch(e){if(e.name!=='AbortError')toast('Copy the invite link above.');}};
$('exitBattle').onclick=()=>{if(confirm('Leave this battle? Leaving an online 1v1 counts as a loss.'))exitToHome(true);};
function exitToHome(sendCancel=true){if(sendCancel)send({type:'cancel'});queueing=false;game=null;localMode=false;localEngine=null;modal(null);show('home');}
$('resultHome').onclick=()=>exitToHome(true);
$('rematchBtn').onclick=()=>{if(localMode){finishedLocal=false;startLocal();return;}
 if(mode==='online'&&game?.bot){send({type:'rematch'});modal('queueOverlay');$('queueOverlay').querySelector('h2').textContent='Setting up rematch…';}
 else if(mode==='practice'){send({type:'rematch'});modal('queueOverlay');$('queueOverlay').querySelector('h2').textContent='Getting your bot ready…';}
 else if(mode==='online'&&!game?.bot){send({type:'rematch'});modal('queueOverlay');$('queueOverlay').querySelector('h2').textContent='Waiting for rival to rematch…';}
 else{send({type:'rematch'});modal('queueOverlay');$('queueOverlay').querySelector('h2').textContent='Waiting for your friend…';}
};
function receiveResult(m){if(resultRecorded)return;resultRecorded=true;const win=m.winner===side,draw=m.winner===-1;const old=saved.trophies;
 saved.coins=Math.max(0,saved.coins+(m.coins||0));saved.trophies=Math.max(0,saved.trophies+(m.trophies||0));saved.games++;if(win)saved.wins++;store();
 $('resultIcon').textContent=draw?'🤝':win?'🏆':'💥';$('resultTitle').textContent=draw?'DRAW!':win?'VICTORY!':'DEFEAT!';$('resultTitle').style.color=win?'var(--mint)':draw?'var(--aqua)':'var(--pink)';
 $('resultMessage').textContent=draw?'Both sides held their ground.':win?'That was tactical genius. Your gloops are proud.':m.reason==='FORFEIT'?'You left the arena.':'Shuffle your strategy and strike back!';
 $('rewardCoins').textContent='+'+(m.coins||0);$('rewardTrophies').textContent=((m.trophies||0)>=0?'+':'')+(m.trophies||0);
 const unlocked=Object.entries(CARDS).filter(([k,c])=>c.unlock>old&&c.unlock<=saved.trophies);
 if(unlocked.length)$('resultMessage').textContent+=' NEW CARD: '+unlocked.map(([k,c])=>c.icon+' '+c.name).join(', ');
 modal('resultOverlay');sound(win?'win':'lose');}
// Game actions
function cast(k,x,y){if(!game||game.phase!=='playing')return;const me=game.players[side];if(!me.hand.includes(k))return;
 if(me.energy+.01<CARDS[k].cost){arenaToast('Not enough goo!');sound('error');return;}
 if(CARDS[k].type!=='spell'&&((side===0&&y<510)||(side===1&&y>430))){arenaToast('Deploy troops on your half!');sound('error');return;}
 if(localMode&&localEngine){const result=G.play(localEngine,side,k,x,y);if(!result.ok){arenaToast(result.reason);sound('error');return;}game=G.snapshot(localEngine);refreshHUD();sound('deploy');}
 else send({type:'play',card:k,x,y});
 selectedCard=null;refreshHUD();}
function viewToWorld(clientX,clientY){const r=canvas.getBoundingClientRect();let x=(clientX-r.left)/r.width*W,y=(clientY-r.top)/r.height*H;
 if(side===1)y=H-y;return {x,y};}
function inArena(x,y){const r=canvas.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
$('hand').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-card]');if(!b)return;pointer={key:b.dataset.card,x:e.clientX,y:e.clientY,moved:false};hover=null;drag=null;});
window.addEventListener('pointermove',e=>{if(pointer){if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>15){pointer.moved=true;drag={card:pointer.key,cx:e.clientX,cy:e.clientY};if(inArena(e.clientX,e.clientY))hover=viewToWorld(e.clientX,e.clientY);else hover=null;}}});
window.addEventListener('pointerup',e=>{if(!pointer)return;const p=pointer;pointer=null;drag=null;if(!game||game.phase!=='playing')return;
 if(p.moved&&inArena(e.clientX,e.clientY)){const pt=viewToWorld(e.clientX,e.clientY);cast(p.key,pt.x,pt.y);hover=null;return;}
 if(!p.moved){selectedCard=selectedCard===p.key?null:p.key;refreshHUD();sound('select');}hover=null;});
canvas.addEventListener('pointermove',e=>{if(selectedCard||drag)hover=viewToWorld(e.clientX,e.clientY);});
canvas.addEventListener('pointerleave',()=>{if(!drag)hover=null;});
canvas.addEventListener('pointerdown',e=>{if(!selectedCard)return; e.preventDefault();const point=viewToWorld(e.clientX,e.clientY);cast(selectedCard,point.x,point.y);});
window.addEventListener('keydown',e=>{if(view!=='battle'||!game||game.phase!=='playing')return;if(/^[1-4]$/.test(e.key)&&!e.repeat){const key=game.players[side].hand[Number(e.key)-1];selectedCard=selectedCard===key?null:key;refreshHUD();sound('select');}
 if(e.key==='Escape'){selectedCard=null;refreshHUD();}});
function resizeArena(){if(view!=='battle')return;const wrap=$('arenaOuter');const parent=wrap.parentElement;const maxW=parent.clientWidth;
 const avail=Math.max(260,window.innerHeight-(window.innerWidth<600?268:310));const useW=Math.min(maxW,avail*W/H,475);
 wrap.style.width=Math.round(useW)+'px';wrap.style.height=Math.round(useW*H/W)+'px';}
window.addEventListener('resize',resizeArena);
// Board art
const color0='#a8ff8e',color1='#ff8db6',aqua='#76ece0';
function col(side){return side===0?color0:color1;}
function rr(x,y,w,h,r,fill,stroke=null,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function circle(x,y,r,fill,stroke=null,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function label(str,x,y,size=16,clr='#fff',weight=800,align='center'){ctx.font=`${weight} ${size}px system-ui,Segoe UI Emoji,Apple Color Emoji,sans-serif`;ctx.fillStyle=clr;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y);}
function poly(points,color,stroke=null,lw=1){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function board(now){const t=now/1000;
 ctx.fillStyle='#164446';ctx.fillRect(0,0,W,H);
 const gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#304953');gr.addColorStop(.48,'#225d5c');gr.addColorStop(.52,'#236063');gr.addColorStop(1,'#1e5c4f');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
 for(let i=0;i<30;i++){const x=((i*173)%W),y=((i*397)%H);circle(x,y,3+(i%4),i%2?'#d1fc9938':'#72d0c535');}
 for(let l=0;l<2;l++){const x=G.LANES[l];rr(x-125,0,250,H,95,'#ffffff08','#c7ffc521',3);
 ctx.setLineDash([18,24]);ctx.strokeStyle='#dcfff32a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.setLineDash([]);
 }
 for(let i=0;i<8;i++) {let w=(i%2?42:58),y=40+i*132;rr(i%2===0?7:W-w-7,y,w,28,12,i%2===0?'#2d6665':'#28515d','#7be1cf33',2);}
 // Energy river and bridges
 const river=ctx.createLinearGradient(0,440,0,500);river.addColorStop(0,'#3ba9bc');river.addColorStop(.5,'#66d2da');river.addColorStop(1,'#2992ac');ctx.fillStyle=river;ctx.fillRect(0,436,W,68);
 for(let i=0;i<9;i++){const y=442+i*7,phase=(t*14+i*44)%100;ctx.strokeStyle='#dbffff34';ctx.lineWidth=2;ctx.beginPath();for(let x=-80;x<W+80;x+=100){ctx.moveTo(x+phase,y);ctx.quadraticCurveTo(x+phase+20,y-5,x+phase+40,y);}ctx.stroke();}
 for(const x of G.LANES){rr(x-79,429,158,82,15,'#446c67','#d8ffb777',6);for(let i=0;i<5;i++)rr(x-68+i*28,437,20,66,5,'#7a9f75','#183f3d8c',2);}
 for(let x=0;x<W;x+=22){circle(x,436,3,'#cbfff36e');circle(x,504,3,'#cbfff36e');}
 // big side markers
 label('RIVAL TERRITORY',360,18,13,'#ffc1d8a9',900);label('YOUR TERRITORY',360,922,13,'#c9ffb29e',900);
}
function rift(g,t){for(const r of g.rifts){const x=G.LANES[r.lane],y=470,owner=r.progress>.62?0:r.progress<-.62?1:-1;
 const c=owner<0?'#ffe2ac':col(owner);circle(x,y,48+Math.sin(t*3+r.lane)*3,'#071a264c',c+'aa',4);
 ctx.save();ctx.translate(x,y);ctx.rotate(t*.6*(r.lane?1:-1));for(let j=0;j<8;j++){ctx.rotate(Math.PI/4);rr(-3,-58,6,14,3,c);}ctx.restore();
 circle(x,y,27,'#1c3541',c,4);label('✳',x,y+1,32,c,900);
 rr(x-57,y+53,114,9,5,'#0c2731','#ffffff45',2);const amt=Math.abs(r.progress);rr(r.progress>0?x-55:x+55-110*amt,y+55,110*amt,5,4,owner===-1?'#bdafca':c);}
}
function towerDraw(t,ours,worldt){const x=t.x,y=t.y,isCore=t.kind==='core',c=col(t.side);if(t.hp<=0){circle(x,y,44,'#0a242bbd','#31444d',3);label('✖',x,y,36,'#536b6f');return;}
 ctx.save();ctx.translate(x,y);const r=isCore?49:37;
 circle(0,9,r+12,'#061e2788');circle(0,2,r+8,'#183d4b',c+'6b',5);
 if(isCore){poly([[0,-r-17],[r-1,-r/2],[r-2,r/2],[0,r+15],[-r+2,r/2],[-r+1,-r/2]],'#16313d',c,5);circle(0,0,34,c);circle(-10,-4,5,'#132c31');circle(11,-4,5,'#132c31');ctx.strokeStyle='#193338';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,3,13,.2,Math.PI-.2);ctx.stroke();}
 else {rr(-34,-33,68,70,15,c,'#e8ffffa3',4);rr(-24,-45,19,20,5,c);rr(5,-45,19,20,5,c);circle(-11,-5,6,'#16343a');circle(13,-5,6,'#16343a');ctx.strokeStyle='#16343a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,4,11,.15,Math.PI-.15);ctx.stroke();}
 ctx.restore();
 const bw=isCore?98:82,by=y+r+16;rr(x-bw/2,by,bw,12,6,'#091c28','#e2ffff88',2);rr(x-bw/2+2,by+2,(bw-4)*Math.max(0,t.hp/t.maxHp),8,4,t.hp/t.maxHp<.3?'#ff576b':c);
 if(isCore){label('CORE',x,y-r-31,15,'#edf9ff',1000);}else label('LVL 1',x,y-r-28,10,'#d4fff0b6',700);
}
function unitDraw(u,t){const x=u.x,y=u.y,r=u.radius,c=col(u.side);const st=Math.sin(t*5+Number(u.id.slice(1))*.8)*2;
 ctx.save();ctx.translate(x,y);ctx.scale(1,1+.04*Math.sin(t*5+x));
 circle(2,r*.82,r*.93,'#00121b74');
 if(u.stun>0){label('✦',-r,-r-15,14,'#e6e4ff');label('✦',r,-r-24,12,'#e6e4ff');}
 if(u.boost>0)circle(0,0,r+7,null,'#ffeaa4',3);
 if(u.slow>0)circle(0,0,r+7,null,'#8ce7ff',3);
 const grad=ctx.createRadialGradient(-r*.4,-r*.7,1,0,0,r*1.4);grad.addColorStop(0,'#f6ffeb');grad.addColorStop(.25,c);grad.addColorStop(1,u.side===0?'#328e74':'#c24c87');
 ctx.beginPath();ctx.moveTo(-r*.92,0);ctx.bezierCurveTo(-r*1.1,-r*.6,-r*.6,-r*1.2,0,-r);ctx.bezierCurveTo(r*.68,-r*1.25,r*1.2,-r*.45,r*.96,r*.45);ctx.bezierCurveTo(r*.77,r*1.18,-r*.85,r*.96,-r*.92,0);ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#f5ffff7c';ctx.lineWidth=2;ctx.stroke();
 if(u.key==='turret'){rr(-r*.65,-r*.9,r*1.3,r*.6,8,'#23364f','#fcfaff',3);circle(0,-r*.8,6,'#c8fff6');}
 else{circle(-r*.33,-r*.15,Math.max(2,r*.125),'#092a31');circle(r*.37,-r*.15,Math.max(2,r*.125),'#092a31');ctx.strokeStyle='#144143';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,r*.1,r*.25,.16,Math.PI-.16);ctx.stroke();}
 ctx.restore();
 if(u.key==='tank'||u.key==='guardian')label(CARDS[u.key].icon,x,y-r-3,21);
 else if(u.key==='healer'||u.key==='sniper'||u.key==='spit'||u.key==='boom')label(CARDS[u.key].icon,x,y-r-2,16);
 if(u.hp<u.maxHp){rr(x-r,y-r-14,r*2,6,3,'#102a2c','#e7fffc5a',1);rr(x-r+1,y-r-13,(r*2-2)*Math.max(0,u.hp/u.maxHp),4,2,c);}
}
function shotDraw(s){if(s.kind==='falling'){circle(s.x,s.y,s.radius,'#ffcd6b20','#ffd696',4);label('☄️',s.x,s.y-20,29);return;}
 const c=col(s.side);ctx.save();ctx.shadowColor=c;ctx.shadowBlur=19;circle(s.x,s.y,s.tower?10:7,c,'#ffffff',2);ctx.restore();}
function fxDraw(f){const life=Math.max(0,f.life/f.max);ctx.save();ctx.globalAlpha=Math.min(1,life);
 if(f.kind==='summon'){circle(f.x,f.y,Math.max(6,f.rad*(1-life)),'#bfffee22',col(f.side),3);}
 else if(f.kind==='hit'){circle(f.x,f.y,f.rad*(1.2-life),'#ffffff15','#fff6bb',3);}
 else if(f.kind==='heal'){circle(f.x,f.y,f.rad*(1.3-life),'#6cff8d24','#aeff9e',4);label('✚',f.x,f.y-18,21,'#cdffcb');}
 else if(f.kind==='zappy'){circle(f.x,f.y,f.rad*(1.15-life*.2),'#b993ff28','#c7aeff',7);label('⚡',f.x,f.y,65,'#e9d5ff');}
 else if(f.kind==='frost'){circle(f.x,f.y,f.rad*(1.15-life*.2),'#c6f9ff18','#b7e6ff',7);label('❄',f.x,f.y,58,'#efffff');}
 else if(f.kind==='haste'){circle(f.x,f.y,f.rad*(1.15-life*.2),'#fff39d18','#ffdc8d',6);label('✦',f.x,f.y,58,'#fff7bd');}
 else if(f.kind==='meteor'||f.kind==='impact'){circle(f.x,f.y,f.rad*(1.3-life*.35),'#ffc46b20','#ffc47c',8);label('💥',f.x,f.y,45);}
 else if(f.kind==='finish'){circle(f.x,f.y,f.rad*(1.3-life),'#eeff7722','#efff9a',8);}
 ctx.restore();}
function drawPlacement(g){const key=drag?.card||selectedCard;if(!key||!CARDS[key])return;
 // On screen, our own half is always bottom (this group has already been rotated by the caller).
 const c=CARDS[key];ctx.fillStyle='#c6ff7f14';if(c.type!=='spell')ctx.fillRect(0,520,720,347);
 ctx.strokeStyle='#baff7c77';ctx.setLineDash([12,12]);ctx.lineWidth=4;if(c.type!=='spell')ctx.strokeRect(8,520,704,347);ctx.setLineDash([]);
 if(!hover)return;const world=hover,x=world.x,y=world.y;const allowed=c.type==='spell'||(side===0?y>=510&&y<=857:y<=430&&y>=83);
 circle(x,side===1?H-y:y,c.spellRadius||45,allowed?'#c5ffc41b':'#ff3a5b16',allowed?'#d2ffb1':'#ff687f',4);label(c.icon,x,side===1?H-y:y,39,allowed?'#fff':'#ffaac2');}
function animate(now){requestAnimationFrame(animate);if(view!=='battle'||!game)return;
 if(localMode&&localEngine&&localEngine.phase==='playing'){
  const dt=Math.min(.06,Math.max(0,(now-localLast)/1000));localLast=now;
  localBotTick+=dt;if(localBotTick>.12){G.aiMove(localEngine,1,1.2);localBotTick=0;}
  G.step(localEngine,dt);previous=game;game=G.snapshot(localEngine);lastSnapshot=now;
  if(Math.floor(now/120)!==Math.floor((now-16)/120))refreshHUD();
  if(localEngine.phase==='over'&&!finishedLocal){finishedLocal=true;receiveResult({winner:localEngine.winner,reason:localEngine.reason,coins:localEngine.winner===0?100:40,trophies:localEngine.winner===0?12:0});}
 }
 ctx.save();ctx.clearRect(0,0,W,H);
 board(now);rift(game,now/1000);
 for(const p of game.players)for(const tw of p.towers)towerDraw(side===1?{...tw,y:H-tw.y}:tw,p.side===side,now/1000);
 const blend=Math.min(1,(now-lastSnapshot)/100);
 const older=new Map(previous?.units?.map(u=>[u.id,u])||[]);
 for(const u of game.units||[]){const p=older.get(u.id),renderU=p?{...u,x:p.x+(u.x-p.x)*blend,y:p.y+(u.y-p.y)*blend}:u;unitDraw(side===1?{...renderU,y:H-renderU.y}:renderU,now/1000);}
 for(const s of game.shots||[])shotDraw(side===1?{...s,y:H-s.y}:s);
 for(const f of game.fx||[])fxDraw(side===1?{...f,y:H-f.y}:f);
 drawPlacement(game);
 ctx.restore();
}
requestAnimationFrame(animate);
let audio=null;function sound(kind){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const t=audio.currentTime,osc=audio.createOscillator(),vol=audio.createGain();osc.connect(vol);vol.connect(audio.destination);
 const tones={select:[470,600,.06],deploy:[280,510,.15],enemy:[210,170,.1],start:[400,730,.2],upgrade:[400,880,.25],win:[550,980,.35],lose:[270,110,.32],error:[160,110,.09]};const [a,b,d]=tones[kind]||tones.select;
 osc.type=kind==='win'?'triangle':'sine';osc.frequency.setValueAtTime(a,t);osc.frequency.exponentialRampToValueAtTime(b,t+d);vol.gain.setValueAtTime(.085,t);vol.gain.exponentialRampToValueAtTime(.0001,t+d);osc.start(t);osc.stop(t+d+.02);
 }catch{}}
// Auto-join deep-links: a friend only needs to open the shared URL.
const join=new URLSearchParams(location.search).get('join');if(join&&/^[a-z0-9]{6}$/i.test(join)){
 history.replaceState(null,'',location.pathname);
 modal('queueOverlay');$('queueOverlay').querySelector('h2').textContent='Joining your friend…';queueing=true;
 socketConnect().then(()=>{if(queueing)send({type:'join',code:join,profile:profile()});}).catch(()=>{queueing=false;modal(null);toast('Could not connect to the game server.');});
}
renderHome();
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
 navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
})();
