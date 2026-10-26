/* GLOOP GANG: RIFT RUMBLE - shared deterministic-ish combat rules.
   Authoritative simulation runs on the server for PvP. The same engine runs locally for practice. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GloopCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const W=720,H=940,LANES=[182,538],DURATION=165,MAX_ENERGY=10;
const CARDS={
 sprouts:{name:'Sprout Swarm',icon:'🌱',cost:2,type:'unit',rarity:'common',unlock:0,desc:'Three tiny troublemakers. Excellent at surrounding big units.',n:3,hp:145,dmg:27,range:42,rate:.65,speed:94,radius:15},
 thump:{name:'Thump',icon:'🥊',cost:3,type:'unit',rarity:'common',unlock:0,desc:'Reliable bruiser. Strong against light troops.',hp:570,dmg:91,range:56,rate:.95,speed:60,radius:26},
 spit:{name:'Spitshot',icon:'🎯',cost:3,type:'unit',rarity:'common',unlock:0,desc:'Long range goo artillery. Keep it behind a tank!',hp:255,dmg:76,range:218,rate:1.1,speed:65,radius:20,projectile:true},
 boom:{name:'Boom Slug',icon:'💣',cost:4,type:'unit',rarity:'rare',unlock:0,desc:'Slow splash damage. Explodes on defeat.',hp:490,dmg:104,range:65,rate:1.25,speed:52,radius:25,splash:85,deathBlast:115},
 zappy:{name:'Zap!',icon:'⚡',cost:2,type:'spell',rarity:'common',unlock:0,desc:'Instant area zap. Stuns and damages enemies.',damage:145,spellRadius:118,stun:1.65},
 healer:{name:'Glow Nurse',icon:'💚',cost:3,type:'unit',rarity:'rare',unlock:0,desc:'Heals nearby friendlies. Protect this one!',hp:300,dmg:22,range:170,rate:1.2,speed:57,radius:20,heal:90},
 turret:{name:'Pop Turret',icon:'🗼',cost:4,type:'structure',rarity:'rare',unlock:0,desc:'Placeable defensive tower. Lasts 24 seconds.',hp:720,dmg:59,range:230,rate:.68,speed:0,radius:24,projectile:true,lifespan:24},
 rush:{name:'Razor Rush',icon:'🦊',cost:4,type:'unit',rarity:'rare',unlock:0,desc:'Two speedy melee attackers for surprise pushes.',n:2,hp:285,dmg:93,range:46,rate:.65,speed:125,radius:17},
 tank:{name:'Gloop Goliath',icon:'🪨',cost:6,type:'unit',rarity:'epic',unlock:50,desc:'Huge hit points. Targets enemy towers first.',hp:1770,dmg:155,range:58,rate:1.4,speed:34,radius:35,towerFocus:true},
 frost:{name:'Frost Cloud',icon:'❄️',cost:3,type:'spell',rarity:'rare',unlock:90,desc:'Freezes an area, slowing enemies for 5 seconds.',damage:76,spellRadius:132,slow:5},
 sniper:{name:'Prism Eye',icon:'🔮',cost:4,type:'unit',rarity:'epic',unlock:145,desc:'Very long range, heavy single-target damage.',hp:205,dmg:184,range:265,rate:1.85,speed:44,radius:20,projectile:true},
 meteor:{name:'Meteor Jam',icon:'☄️',cost:5,type:'spell',rarity:'epic',unlock:215,desc:'A devastating impact after a short warning.',damage:370,spellRadius:137,delay:.72},
 haste:{name:'Sugar Rush',icon:'🍬',cost:2,type:'spell',rarity:'rare',unlock:300,desc:'Boosts your troops’ attack and movement for 6 seconds.',spellRadius:155,boost:6},
 splitter:{name:'Bubble Twins',icon:'🫧',cost:3,type:'unit',rarity:'epic',unlock:395,desc:'Splits into four mini goobers when defeated.',n:2,hp:255,dmg:59,range:48,rate:.9,speed:74,radius:21,splits:2},
 guardian:{name:'Shellguard',icon:'🛡️',cost:5,type:'unit',rarity:'legendary',unlock:510,desc:'Resilient defender with reduced incoming damage.',hp:1150,dmg:74,range:55,rate:1.15,speed:45,radius:29,armor:.32}
};
const DEFAULT_DECK=['sprouts','thump','spit','boom','zappy','healer','turret','rush'];
const valid=Object.keys(CARDS);
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function rnd(min,max){return min+Math.random()*(max-min);}
function safeProfile(profile={}){
 const points=clamp(Number(profile.trophies)||0,0,9999);const available=valid.filter(k=>CARDS[k].unlock<=points);
 let deck=Array.isArray(profile.deck)?profile.deck.filter((k,i,a)=>available.includes(k)&&a.indexOf(k)===i):[];
 for(const k of DEFAULT_DECK)if(!deck.includes(k))deck.push(k);
 for(const k of available)if(deck.length<8&&!deck.includes(k))deck.push(k);
 deck=deck.slice(0,8);
 const levels={};for(const k of valid)levels[k]=clamp(Math.floor(Number(profile.levels?.[k])||1),1,5);
 return {name:String(profile.name||'Glooper').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,16)||'Glooper',deck,levels,trophies:points};
}
function makePlayer(profile,i){const p=safeProfile(profile); const deck=p.deck.slice();for(let a=deck.length-1;a>0;a--){const j=Math.floor(Math.random()*(a+1));[deck[a],deck[j]]=[deck[j],deck[a]];}
 return {side:i,name:p.name,deck:deck,hand:deck.slice(0,4),next:4,energy:5,towers:[{id:'t'+i+'0',side:i,kind:'tower',lane:0,x:LANES[0],y:i?190:750,hp:1900,maxHp:1900,dmg:91,rate:.84,range:186,cd:0},{id:'t'+i+'1',side:i,kind:'tower',lane:1,x:LANES[1],y:i?190:750,hp:1900,maxHp:1900,dmg:91,rate:.84,range:186,cd:0},{id:'core'+i,side:i,kind:'core',lane:-1,x:360,y:i?75:865,hp:2700,maxHp:2700,dmg:84,rate:.85,range:205,cd:0}],levels:p.levels,castCount:0};}
let globalUnitId=1;
function newGame(a,b,bot=false){globalUnitId=1;return {version:1,t:0,duration:DURATION,players:[makePlayer(a,0),makePlayer(b,1)],units:[],shots:[],fx:[],rifts:[{lane:0,progress:0},{lane:1,progress:0}],phase:'playing',winner:null,bot:!!bot,lastAction:'',id:Math.random().toString(36).slice(2,8)};}
function byId(g,id){return g.units.find(u=>u.id===id)||g.players[0].towers.find(t=>t.id===id)||g.players[1].towers.find(t=>t.id===id);}
function fx(g,x,y,kind,side,rad=60,dur=.5){g.fx.push({x,y,kind,side,rad,life:dur,max:dur,id:'f'+Math.random().toString(36).slice(2,8)});}
function hurt(g,v,damage,source,stun=0,slow=0){if(!v||v.hp<=0)return;if(v.kind==='core'&&g.players[v.side].towers.some(t=>t.kind==='tower'&&t.hp>0))return;const n=damage*(1-(v.armor||0));v.hp=Math.max(0,v.hp-n); if(stun)v.stun=Math.max(v.stun||0,stun);if(slow)v.slow=Math.max(v.slow||0,slow);if(v.hp<=0&&v.kind==='core')finish(g,1-v.side,'CORE');}
function area(g,x,y,r,side,damage,stun=0,slow=0,hitTowers=true){for(const u of g.units)if(u.side!==side&&u.hp>0&&dist(u,{x,y})<=r+u.radius)hurt(g,u,damage,side,stun,slow);
 if(hitTowers)for(const tw of g.players[1-side].towers)if(tw.hp>0&&dist(tw,{x,y})<=r+(tw.kind==='core'?55:40))hurt(g,tw,damage*.43,side);}
function makeUnit(g,player,key,lane,x,y,level,extra={}){const card=CARDS[key];const factor=1+(.075*(level-1));const u={id:'u'+globalUnitId++,key,side:player,lane,x,y,kind:card.type==='structure'?'structure':'unit',hp:(card.hp||100)*factor,maxHp:(card.hp||100)*factor,dmg:(card.dmg||0)*factor,range:card.range||60,rate:card.rate||1,speed:card.speed||0,radius:card.radius||20,cd:rnd(.15,.5),stun:0,slow:0,boost:0,armor:card.armor||0,life:card.lifespan||0,heal:card.heal||0,projectile:!!card.projectile,splash:card.splash||0,deathBlast:card.deathBlast||0,towerFocus:!!card.towerFocus,splits:card.splits||0,...extra};g.units.push(u);fx(g,x,y,'summon',player,28,.3);}
function play(g,side,key,x,y){if(g.phase!=='playing')return {ok:false,reason:'Match finished'};const p=g.players[side],c=CARDS[key];if(!c||!p.hand.includes(key))return {ok:false,reason:'Card not in your hand'};
 if(p.energy+0.001<c.cost)return {ok:false,reason:'Not enough goo!'};
 x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>W||y<0||y>H)return {ok:false,reason:'Invalid location'};
 const lane=x<W/2?0:1,center=LANES[lane];
 if(c.type!=='spell'){
 if(side===0&&(y<510||y>857)||side===1&&(y>430||y<83))return {ok:false,reason:'Deploy on your half of the arena'};
 x=clamp(x,center-112,center+112);
 } else {x=clamp(x,65,W-65);y=clamp(y,68,H-68);}
 p.energy-=c.cost;p.castCount++;const at=p.hand.indexOf(key);p.hand[at]=p.deck[p.next%8];p.next++;
 if(c.type==='spell'){
  fx(g,x,y,key,side,c.spellRadius||145,c.delay?c.delay+.36:.74);
  if(c.delay){g.shots.push({id:'s'+globalUnitId++,kind:'falling',side,x,y,delay:c.delay,damage:c.damage,radius:c.spellRadius});}
  else if(key==='haste'){for(const u of g.units)if(u.side===side&&dist(u,{x,y})<=c.spellRadius)u.boost=Math.max(u.boost,c.boost);}
  else area(g,x,y,c.spellRadius,side,c.damage||0,c.stun||0,c.slow||0);
 } else {
   const count=c.n||1;
   for(let j=0;j<count;j++){const off=(j-(count-1)/2)*44;makeUnit(g,side,key,lane,clamp(x+off,center-112,center+112),y+(side===0?1:-1)*((j%2)*24),p.levels[key]);}
 }
 return {ok:true};}
function getTargets(g,attacker){const enemies=g.units.filter(u=>u.side!==attacker.side&&u.hp>0&&u.lane===attacker.lane&&u.kind!=='dead');
 if(attacker.heal){const friendlies=g.units.filter(u=>u.side===attacker.side&&u.id!==attacker.id&&u.hp>0&&u.hp<u.maxHp*.97&&u.lane===attacker.lane&&dist(u,attacker)<attacker.range+u.radius);if(friendlies.length)return {target:friendlies.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0],healing:true};}
 if(!attacker.towerFocus){const near=enemies.filter(e=>dist(e,attacker)<attacker.range+attacker.radius+e.radius);if(near.length)return {target:near.sort((a,b)=>dist(a,attacker)-dist(b,attacker))[0]};}
 const towers=g.players[1-attacker.side].towers;const laneTower=towers[attacker.lane];const target=laneTower.hp>0?laneTower:towers[2];
 if(target.hp>0&&dist(target,attacker)<attacker.range+attacker.radius+(target.kind==='core'?35:28))return {target};
 if(!attacker.towerFocus&&enemies.length){const near=enemies.sort((a,b)=>dist(a,attacker)-dist(b,attacker))[0];if(dist(near,attacker)<attacker.range+135)return {follow:near};}
 return {follow:target};}
function shoot(g,u,target,healing=false){u.cd=u.rate/((u.boost>0)?1.28:1);const speed=u.projectile?570:1040;
 if(healing){target.hp=Math.min(target.maxHp,target.hp+u.heal);fx(g,target.x,target.y,'heal',u.side,44,.45);return;}
 if(!u.projectile&&u.range<110){hurt(g,target,u.dmg,u.side);fx(g,target.x,target.y,'hit',u.side,26,.2);if(u.splash)area(g,target.x,target.y,u.splash,u.side,u.dmg*.45);}
 else {g.shots.push({id:'s'+globalUnitId++,kind:'bullet',side:u.side,x:u.x,y:u.y,target:target.id,damage:u.dmg,splash:u.splash||0,speed,life:1.3,heal:false});}}
function towerTick(g,t,dt){if(t.hp<=0)return;t.cd=Math.max(0,t.cd-dt);if(t.cd>0)return;
 const enemy=g.units.filter(u=>u.side!==t.side&&u.hp>0&&dist(u,t)<t.range+u.radius);
 if(!enemy.length)return;enemy.sort((a,b)=>dist(a,t)-dist(b,t));t.cd=t.rate;
 g.shots.push({id:'s'+globalUnitId++,kind:'bullet',side:t.side,x:t.x,y:t.y,target:enemy[0].id,damage:t.dmg,speed:750,life:.9,tower:true});}
function finish(g,winner,why){if(g.phase!=='playing')return;g.phase='over';g.winner=winner;g.reason=why;fx(g,360,470,'finish',winner,400,2);}
function step(g,dt){if(g.phase!=='playing')return;dt=clamp(dt,0,.08);g.t+=dt;
 for(const p of g.players){let boost=0;for(const r of g.rifts)if((p.side===0&&r.progress>.62)||(p.side===1&&r.progress<-.62))boost+=.12;
 p.energy=clamp(p.energy+dt*(.88+boost)*(g.t>DURATION-45?1.8:1),0,MAX_ENERGY);for(const t of p.towers)towerTick(g,t,dt);}
 for(const r of g.rifts){const near=g.units.filter(u=>u.kind==='unit'&&u.hp>0&&u.lane===r.lane&&Math.abs(u.y-470)<115);
 const p0=near.filter(u=>u.side===0).length,p1=near.filter(u=>u.side===1).length;
 if(p0&&!p1)r.progress=clamp(r.progress+dt*.55,-1,1);else if(p1&&!p0)r.progress=clamp(r.progress-dt*.55,-1,1);}
 for(const u of g.units){if(u.hp<=0)continue;
  u.stun=Math.max(0,u.stun-dt);u.slow=Math.max(0,u.slow-dt);u.boost=Math.max(0,u.boost-dt);u.cd=Math.max(0,u.cd-dt);
  if(u.kind==='structure'){u.life-=dt;if(u.life<=0)u.hp=0;}
  if(u.hp<=0||u.stun>0)continue;
  const {target,follow,healing}=getTargets(g,u);
  if(target){if(u.cd<=0)shoot(g,u,target,healing);} else if(follow&&u.speed){const dx=follow.x-u.x,dy=follow.y-u.y,d=Math.hypot(dx,dy)||1;
   let vx=dx/d,vy=dy/d;
   // A slight tendency to stay within the two tactical lanes.
   vx+=(LANES[u.lane]-u.x)*.003;
   const m=Math.hypot(vx,vy)||1;const speed=u.speed*(u.slow>0?.46:1)*(u.boost>0?1.44:1);
   u.x=clamp(u.x+vx/m*speed*dt,LANES[u.lane]-127,LANES[u.lane]+127);u.y=clamp(u.y+vy/m*speed*dt,42,H-42);
  }
 }
 for(const shot of g.shots){if(shot.kind==='falling'){shot.delay-=dt;if(shot.delay<=0){area(g,shot.x,shot.y,shot.radius,shot.side,shot.damage);fx(g,shot.x,shot.y,'impact',shot.side,shot.radius,.5);shot.dead=true;}continue;}
 const target=byId(g,shot.target);if(!target||target.hp<=0){shot.dead=true;continue;}
 const dx=target.x-shot.x,dy=target.y-shot.y,d=Math.hypot(dx,dy)||1,travel=shot.speed*dt;
 if(d<=travel+target.radius){hurt(g,target,shot.damage,shot.side);if(shot.splash)area(g,target.x,target.y,shot.splash,shot.side,shot.damage*.5);fx(g,target.x,target.y,'hit',shot.side,23,.21);shot.dead=true;}
 else {shot.x+=dx/d*travel;shot.y+=dy/d*travel;shot.life-=dt;if(shot.life<0)shot.dead=true;}}
 g.shots=g.shots.filter(s=>!s.dead);
 const dead=g.units.filter(u=>u.hp<=0);for(const u of dead){if(u.deathBlast){area(g,u.x,u.y,u.deathBlast,u.side,155);fx(g,u.x,u.y,'impact',u.side,u.deathBlast,.45);}
 if(u.splits){for(let j=0;j<u.splits;j++)makeUnit(g,u.side,'sprouts',u.lane,u.x+(j?25:-25),u.y,g.players[u.side].levels[u.key],{hp:105,maxHp:105,radius:12,dmg:25,speed:110,key:'mini'});}}
 g.units=g.units.filter(u=>u.hp>0).slice(-230);
 for(const f of g.fx)f.life-=dt;g.fx=g.fx.filter(f=>f.life>0).slice(-90);
 if(g.t>=DURATION){const score=i=>{const a=g.players[i].towers;return a.reduce((s,t)=>s+(t.hp>0?1:0),0)*10000+a.reduce((s,t)=>s+Math.max(0,t.hp)/t.maxHp,0)*1000;};const a=score(0),b=score(1);finish(g,a===b?-1:a>b?0:1,'TIME');}
}
function aiMove(g,side,skill=1){if(g.phase!=='playing')return;
 const p=g.players[side],opp=g.players[1-side];if(p.aiCd>0){p.aiCd-=.12;return;}p.aiCd=rnd(.48,.9)/(skill||1);
 const threatening=g.units.filter(u=>u.side!==side&&u.hp>0&&((side===1&&u.y<365)||(side===0&&u.y>575)));
 let lane=threatening.length?threatening.sort((a,b)=>b.dmg-a.dmg)[0].lane:Math.random()<.5?0:1;
 if(Math.random()<.37)lane=1-lane;
 let affordable=p.hand.filter(k=>CARDS[k].cost<=p.energy-.2);
 if(!affordable.length)return;
 const priority=affordable.map(k=>{let score=Math.random()*1.5;const c=CARDS[k];if(c.type==='spell'&&threatening.some(u=>u.lane===lane))score+=1.6;if(k==='tank'&&p.energy>6)score+=2;if(k==='healer'&&g.units.some(u=>u.side===side&&u.hp<u.maxHp*.6))score+=2;if(k==='turret'&&threatening.length)score+=1.4;if(k==='sprouts'&&p.energy>8)score+=1.5;return {k,score};}).sort((a,b)=>b.score-a.score);
 const k=priority[0].k,c=CARDS[k];let y=side===1?rnd(242,360):rnd(590,700);let x=LANES[lane]+rnd(-36,36);
 if(c.type==='spell'){const target=threatening.find(u=>u.lane===lane)||g.units.find(u=>u.side!==side&&u.hp>0);if(target){x=target.x;y=target.y;}else{y=side===1?665:270;}}
 play(g,side,k,x,y);
}
function snapshot(g){return {t:g.t,duration:g.duration,phase:g.phase,winner:g.winner,reason:g.reason,players:g.players.map(p=>({side:p.side,name:p.name,energy:p.energy,hand:p.hand,nextCard:p.deck[p.next%8],towers:p.towers})),units:g.units,shots:g.shots,fx:g.fx,rifts:g.rifts,bot:g.bot,id:g.id};}
return {W,H,LANES,CARDS,DEFAULT_DECK,DURATION,MAX_ENERGY,safeProfile,newGame,play,step,aiMove,snapshot,clamp};
});
