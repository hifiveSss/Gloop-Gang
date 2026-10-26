'use strict';
const assert=require('node:assert/strict');
const {server,rooms}=require('./server');
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const timeout=p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Matchmaking test timed out')),3000))]);
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`ws://127.0.0.1:${server.address().port}/ws`;
 let sockets=[];
 function next(ws){const state=ws.__queue;if(state.messages.length)return Promise.resolve(state.messages.shift());return timeout(new Promise(resolve=>state.waiters.push(resolve)));}
 async function connect(){const ws=new WebSocket(url);await timeout(new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});}));ws.__queue={messages:[],waiters:[]};ws.addEventListener('message',e=>{let m=JSON.parse(e.data),q=ws.__queue;if(q.waiters.length)q.waiters.shift()(m);else q.messages.push(m);});sockets.push(ws);return ws;}
 function send(ws,msg){ws.send(JSON.stringify(msg));}
 try {
  const a=await connect();send(a,{type:'match',profile:{name:'Alpha'}});const ma=await next(a);
  assert.equal(ma.type,'matched');assert.equal(ma.role,'host');assert.equal(ma.players.length,1);
  const b=await connect();send(b,{type:'match',profile:{name:'Beta'}});const mb=await next(b);
  assert.equal(mb.type,'matched');assert.equal(mb.role,'guest');assert.equal(mb.code,ma.code);assert.equal((await next(a)).type,'player_joined');
  const c=await connect();send(c,{type:'match',profile:{name:'Gamma'}});const mc=await next(c);
  assert.equal(mc.code,ma.code);assert.equal((await next(a)).type,'player_joined');assert.equal((await next(b)).type,'player_joined');
  const d=await connect();send(d,{type:'match',profile:{name:'Delta'}});const md=await next(d);
  assert.equal(md.code,ma.code);assert.equal(md.players.length,4);for(const ws of [a,b,c])assert.equal((await next(ws)).type,'player_joined');
  const e=await connect();send(e,{type:'match',profile:{name:'Epsilon'}});const me=await next(e);
  assert.equal(me.role,'host');assert.notEqual(me.code,ma.code);
  const f=await connect();send(f,{type:'join',code:me.code,profile:{name:'FriendFromLink'}});
  const friend=await next(f);assert.equal(friend.type,'joined');assert.equal(friend.phase,'game');assert.equal(friend.public,true);
  assert.equal((await next(e)).type,'player_joined');
  send(a,{type:'snapshot',state:{phase:'game',t:55,players:[{id:'p1'},{id:'p2'}]}});
  for(const ws of [b,c,d]){const snap=await next(ws);assert.equal(snap.type,'snapshot');assert.equal(snap.state.t,55);}
  a.close();const promote=await next(b);
  assert.equal(promote.type,'host_changed');assert.equal(promote.id,mb.id);assert.equal(promote.players.length,3);
  for(const ws of [c,d])assert.equal((await next(ws)).type,'host_changed');
  send(c,{type:'input',input:{x:1,y:0}});const inp=await next(b);assert.equal(inp.type,'remote_input');assert.equal(inp.from,mc.id);
  send(b,{type:'snapshot',state:{phase:'game',t:57,players:[{id:'p2'},{id:'p3'},{id:'p4'}]}});
  for(const ws of [c,d])assert.equal((await next(ws)).state.t,57);
  send(b,{type:'ended',results:{won:false,players:[]}});for(const ws of [c,d])assert.equal((await next(ws)).type,'ended');
  send(b,{type:'restart'});for(const ws of [c,d]){const msg=await next(ws);assert.equal(msg.type,'restarted');assert.equal(msg.auto,true);}
  assert.equal(rooms.get(ma.code).phase,'game');
  console.log('PASS: instant matches, auto room fill, late joins, full-room overflow, host migration, inputs, snapshots and auto rematches');
 }finally{for(const ws of sockets)if(ws.readyState===1)ws.close();await delay(80);await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exit(1);});
