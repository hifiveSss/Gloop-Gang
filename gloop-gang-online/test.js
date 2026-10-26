'use strict';
const assert=require('assert/strict');
const G=require('./public/core.js');
const {server,rooms,queue}=require('./server.js');
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function connect(port){const s=new WebSocket(`ws://127.0.0.1:${port}/ws`);await new Promise((ok,no)=>{s.addEventListener('open',ok,{once:true});s.addEventListener('error',no,{once:true})});s.inbox=[];s.addEventListener('message',e=>{s.inbox.push(JSON.parse(e.data))});return s;}
async function wait(s,type,ms=2000){const end=Date.now()+ms;while(Date.now()<end){const i=s.inbox.findIndex(m=>m.type===type);if(i>=0)return s.inbox.splice(i,1)[0];await sleep(10);}throw new Error('Timed out waiting for '+type+' ('+JSON.stringify(s.inbox.map(m=>m.type))+')');}
const send=(s,m)=>s.send(JSON.stringify(m));
(async()=>{
 const profile={name:'Tester',trophies:0,deck:G.DEFAULT_DECK};
 assert.equal(G.safeProfile({deck:['bogus','tank'],trophies:0}).deck.length,8);
 assert.equal(G.CARDS.sprouts.cost,2);
 let g=G.newGame(profile,profile);const firstCard=g.players[0].hand[0],energy=g.players[0].energy;let r=G.play(g,0,firstCard,200,690);
 assert.equal(r.ok,true);assert.equal(g.players[0].energy,energy-G.CARDS[firstCard].cost);assert.equal(g.players[0].hand.length,4);
 assert.equal(G.play(g,0,'bogus',200,690).ok,false);assert.equal(G.play(g,1,g.players[1].hand[0],250,670).ok,false);
 for(let i=0;i<3500&&g.phase==='playing';i++){
  if(i%10===0){G.aiMove(g,0);G.aiMove(g,1);}G.step(g,.05);
 }
 assert.equal(g.phase,'over');console.log('✓ Game engine: combat, cards, energy, AI, match end');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const raw=await fetch(`http://127.0.0.1:${port}/health`);assert.equal((await raw.json()).ok,true);
 const homepage=await fetch(`http://127.0.0.1:${port}/`);assert((await homepage.text()).includes('RIFT RUMBLE'));
 console.log('✓ HTTP: homepage and health endpoint');
 const a=await connect(port),b=await connect(port);await wait(a,'hello');await wait(b,'hello');
 send(a,{type:'queue',profile:{...profile,name:'One'}});await wait(a,'queue');send(b,{type:'queue',profile:{...profile,name:'Two'}});
 const startedA=await wait(a,'start'),startedB=await wait(b,'start');assert.equal(startedA.side,0);assert.equal(startedB.side,1);assert.equal(startedA.bot,false);assert.equal(startedB.bot,false);
 let key=startedA.state.players[0].hand[0];send(a,{type:'play',card:key,x:182,y:620});await wait(a,'played');await wait(b,'played');await wait(b,'state');
 const one=rooms.get(startedA.code);one.game.t=G.DURATION+.05;await wait(a,'result');await wait(b,'result');
 console.log('✓ Matchmaking: find opponent, shared plays, timed result');
 const c=await connect(port),d=await connect(port);await wait(c,'hello');await wait(d,'hello');send(c,{type:'friend',profile:profile});const invite=await wait(c,'friend');assert.match(invite.code,/^[0-9A-Z]{6}$/);
 send(d,{type:'join',code:invite.code,profile:profile});assert.equal((await wait(d,'start')).bot,false);await wait(c,'start');
 console.log('✓ Invites: six-character link code and automatic start');
 const e=await connect(port);await wait(e,'hello');send(e,{type:'bot',profile});const bot=await wait(e,'start');assert.equal(bot.bot,true);const botRoom=rooms.get(bot.code);botRoom.game.t=G.DURATION+.05;await wait(e,'result');
 console.log('✓ Practice: playable bot match, results');
 for(const s of [a,b,c,d,e])s.close();await sleep(90);server.close();console.log('ALL TESTS PASSED');
})().catch(e=>{console.error(e);process.exit(1)});
