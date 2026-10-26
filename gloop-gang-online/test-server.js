'use strict';
const assert=require('assert/strict');
const { server }=require('./server');
const timeout=(p)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Test timed out')),3000))]);
async function main(){
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port;
 function connect(){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);ws.addEventListener('open',()=>resolve(ws),{once:true});ws.addEventListener('error',reject,{once:true});});}
 const pending=new Map();
 function track(ws){const queue=[],wait=[];pending.set(ws,{queue,wait});ws.addEventListener('message',evt=>{const m=JSON.parse(evt.data);if(wait.length)wait.shift()(m);else queue.push(m);});}
 function next(ws){const p=pending.get(ws);return timeout(p.queue.length?Promise.resolve(p.queue.shift()):new Promise(resolve=>p.wait.push(resolve)));}
 function send(ws,msg){ws.send(JSON.stringify(msg));}
 let a,b,c;
 try{
  a=await connect();track(a);send(a,{type:'create',profile:{name:'Host',color:'mint'}});let msg=await next(a);assert.equal(msg.type,'created');assert.equal(msg.code.length,6);const code=msg.code;
  b=await connect();track(b);send(b,{type:'join',code,profile:{name:'Friend',color:'berry'}});const joined=await next(b);assert.equal(joined.type,'joined');assert.equal(joined.players.length,2);assert.equal((await next(a)).type,'player_joined');
  send(a,{type:'start'});assert.equal((await next(b)).type,'started');
  send(b,{type:'input',input:{x:0.2,y:0.5,dash:true,blast:false}});const inp=await next(a);assert.equal(inp.type,'remote_input');assert.equal(inp.input.dash,true);
  send(b,{type:'choice',index:2});const choice=await next(a);assert.equal(choice.type,'remote_choice');assert.equal(choice.index,2);
  const state={phase:'game',t:17,players:[],debug:'a'.repeat(70000)};send(a,{type:'snapshot',state});const snap=await next(b);assert.equal(snap.type,'snapshot');assert.equal(snap.state.debug.length,70000);
  c=await connect();track(c);send(c,{type:'join',code,profile:{name:'Late'}});assert.equal((await next(c)).type,'error');
  send(a,{type:'ended',results:{won:true,players:[]}});assert.equal((await next(b)).type,'ended');
  send(a,{type:'restart'});assert.equal((await next(b)).type,'restarted');
  b.close();const gone=await next(a);assert.equal(gone.type,'player_left');
  console.log('PASS: rooms, room codes, friend joining, host start, inputs, upgrade choices, large snapshots, late join protection, results, rematches and leaving');
 }finally{for(const ws of [a,b,c])if(ws&&ws.readyState===1)ws.close();await new Promise(r=>setTimeout(r,50));server.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
