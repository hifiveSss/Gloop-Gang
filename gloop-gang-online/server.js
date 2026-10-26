'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const Game = require('./public/core.js');

const PUBLIC = path.join(__dirname, 'public');
const MAX_ROOM = 2;
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();
const queue = [];
const connections = new Set();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8'};

const server = http.createServer((req, res) => {
  let pathname, filePath;
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,rooms:rooms.size,queue:queue.length}));}
  try {pathname = new URL(req.url, 'http://localhost').pathname; filePath = path.resolve(PUBLIC, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));}
  catch {res.writeHead(400); return res.end('Invalid path');}
  if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== PUBLIC) {res.writeHead(403); return res.end('Forbidden');}
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {res.writeHead(404); return res.end('Not found');}
    res.writeHead(200, {'Content-Type':mime[path.extname(filePath)] || 'application/octet-stream','Cache-Control':path.extname(filePath)==='.html' ? 'no-cache' : 'public, max-age=3600','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(filePath).pipe(res);
  });
});
// Dependency-free WebSocket transport: modern browsers speak WebSocket natively.
// Handles masked client frames, fragmentation of TCP packets, ping/pong, and large snapshots.
const wss = { clients:new Set() };
class SocketClient extends EventEmitter {
  constructor(socket,head){
    super();this.socket=socket;this.buffer=Buffer.alloc(0);this.alive=true;this.readyState=1;
    socket.on('data',b=>this.consume(b));socket.on('error',err=>this.emit('error',err));
    socket.on('close',()=>{this.readyState=3;wss.clients.delete(this);this.emit('close');});
    if(head?.length)this.consume(head);
  }
  frame(op,payload=Buffer.alloc(0)){
    if(this.readyState!==1)return;
    const data=Buffer.isBuffer(payload)?payload:Buffer.from(payload);
    let header;
    if(data.length<126){header=Buffer.from([0x80|op,data.length]);}
    else if(data.length<65536){header=Buffer.allocUnsafe(4);header[0]=0x80|op;header[1]=126;header.writeUInt16BE(data.length,2);}
    else{header=Buffer.allocUnsafe(10);header[0]=0x80|op;header[1]=127;header.writeBigUInt64BE(BigInt(data.length),2);}
    this.socket.write(Buffer.concat([header,data]));
  }
  send(text){this.frame(1,String(text));}
  ping(){this.frame(9);}
  terminate(){this.socket.destroy();}
  consume(chunk){
    if(this.readyState!==1)return;
    this.buffer=Buffer.concat([this.buffer,chunk]);
    if(this.buffer.length>650000){this.terminate();return;}
    while(this.buffer.length>=2){
      const a=this.buffer[0],b=this.buffer[1],opcode=a&15,masked=!!(b&128);
      if(!(a&128)||!masked){this.terminate();return;}
      let len=b&127,offset=2;
      if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);offset=4;}
      if(len===127){if(this.buffer.length<10)return;const n=this.buffer.readBigUInt64BE(2);if(n>300000n){this.terminate();return;}len=Number(n);offset=10;}
      if(len>300000){this.terminate();return;}
      if(this.buffer.length<offset+4+len)return;
      const mask=this.buffer.subarray(offset,offset+4),payload=Buffer.from(this.buffer.subarray(offset+4,offset+4+len));
      for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
      this.buffer=this.buffer.subarray(offset+4+len);
      if(opcode===8){this.terminate();return;}
      if(opcode===9){this.frame(10,payload);continue;}
      if(opcode===10){this.emit('pong');continue;}
      if(opcode===1)this.emit('message',payload);
    }
  }
}
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||!req.headers['sec-websocket-key']){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const ws=new SocketClient(socket,head);wss.clients.add(ws);onConnection(ws);
});
function send(ws,obj){if(ws&&ws.readyState===1)ws.send(JSON.stringify(obj));}
function broadcast(room,obj){for(const player of room.sockets)if(player)send(player,obj);}
function code(){for(let t=0;t<20;t++){let s=crypto.randomBytes(5).toString('hex').slice(0,6).toUpperCase();if(!rooms.has(s))return s;}return crypto.randomUUID().slice(0,6).toUpperCase();}
function profile(p){return Game.safeProfile(p);}
function queueRemove(ws){const i=queue.indexOf(ws);if(i>=0)queue.splice(i,1);}
function clearRoom(ws){
 queueRemove(ws);const room=ws.room;ws.room=null;
 if(!room)return;
 if(room.phase==='waiting') {rooms.delete(room.code);broadcast(room,{type:'notice',message:'Your friend left the party.'});for(const s of room.sockets)if(s)s.room=null;}
 else if(room.phase==='playing'&&room.game){if(!room.game.bot&&room.game.phase==='playing'){
   const side=room.sockets.indexOf(ws);if(side>=0){room.game.phase='over';room.game.winner=1-side;room.game.reason='FORFEIT';}
   emitState(room);finishRound(room);
 } else if(room.game.bot){rooms.delete(room.code);}}
 else if(room.phase==='over'){if(room.sockets.every(s=>!s||s.readyState!==1))rooms.delete(room.code);}
}
function start(room,versusBot=false){
 room.phase='playing';room.again=new Set();room.bot=versusBot;
 let sockets=room.sockets;
 const a=room.profiles[0]||profile({name:'Player 1'}),b=versusBot?profile({name:'Glooptron',trophies:200,deck:Game.DEFAULT_DECK}):(room.profiles[1]||profile({name:'Player 2'}));
 room.game=Game.newGame(a,b,versusBot);
 room.updated=Date.now();room.elapsed=0;room.lastState=0;room.lastBot=0;
 for(let i=0;i<2;i++)if(sockets[i])send(sockets[i],{type:'start',code:room.code,side:i,mode:room.mode,bot:versusBot,state:Game.snapshot(room.game)});
}
function emitState(room){if(!room.game)return;broadcast(room,{type:'state',state:Game.snapshot(room.game)});}
function finishRound(room){if(!room.game||room.sentResult||room.game.phase!=='over')return;
 room.phase='over';room.sentResult=true;
 for(let i=0;i<2;i++)if(room.sockets[i]){
  const win=room.game.winner===i,draw=room.game.winner===-1;
  send(room.sockets[i],{type:'result',winner:room.game.winner,reason:room.game.reason,coins:draw?45:win?100:40,trophies:room.bot?(win?12:0):(draw?0:win?28:-12),xp:draw?35:win?80:45});
 }
}
function newRoom(ws,mode){const id=code();const room={code:id,mode,sockets:[ws,null],profiles:[ws.profile,null],phase:'waiting',created:Date.now(),sentResult:false};rooms.set(id,room);ws.room=room;return room;}
function queueJoin(ws,p){clearRoom(ws);ws.profile=profile(p);const match=queue.find(c=>c!==ws&&c.readyState===1&&!c.room);
 if(match){queueRemove(match);const room=newRoom(match,'online');room.sockets[1]=ws;room.profiles[1]=ws.profile;ws.room=room;start(room,false);}
 else {queue.push(ws);ws.queuedAt=Date.now();send(ws,{type:'queue',message:'Searching for another player…'});}}
function onConnection(ws){connections.add(ws);ws.profile=profile({});send(ws,{type:'hello'});
 ws.alive=true;ws.on('pong',()=>ws.alive=true);
 ws.on('message',raw=>{
  if(raw.length>6000)return;
  let m;try{m=JSON.parse(raw.toString());}catch{return;}
  if(!m||typeof m.type!=='string')return;
  if(m.type==='queue')return queueJoin(ws,m.profile);
  if(m.type==='bot') {clearRoom(ws);ws.profile=profile(m.profile);const room=newRoom(ws,'practice');start(room,true);return;}
  if(m.type==='friend') {clearRoom(ws);ws.profile=profile(m.profile);const room=newRoom(ws,'friend');send(ws,{type:'friend',code:room.code,url:`?join=${room.code}`});return;}
  if(m.type==='join') {
   clearRoom(ws);const id=String(m.code||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,6);const room=rooms.get(id);
   if(!room||room.phase!=='waiting'||room.sockets[1])return send(ws,{type:'error',message:'That invite is expired or the match already started.'});
   ws.profile=profile(m.profile);ws.room=room;room.sockets[1]=ws;room.profiles[1]=ws.profile;start(room,false);return;
  }
  if(m.type==='cancel'){clearRoom(ws);send(ws,{type:'cancelled'});return;}
  const room=ws.room;if(!room)return;
  if(m.type==='play'&&room.phase==='playing'){
   const side=room.sockets.indexOf(ws);if(side<0||!room.game)return;
   const result=Game.play(room.game,side,String(m.card||''),Number(m.x),Number(m.y));
   if(result.ok){emitState(room);broadcast(room,{type:'played',side,card:m.card,x:Number(m.x),y:Number(m.y)});}
   else send(ws,{type:'rejected',message:result.reason});return;
  }
  if(m.type==='emote'&&room.phase==='playing'){
   const idx=room.sockets.indexOf(ws);const allowed=['👋','😈','😱','💚','GG'];if(idx>=0&&allowed.includes(m.emote)){broadcast(room,{type:'emote',side:idx,emote:m.emote});}return;
  }
  if(m.type==='rematch'&&room.phase==='over'){
   if(room.bot){room.sentResult=false;start(room,true);return;}
   const idx=room.sockets.indexOf(ws);if(idx<0)return;room.again.add(idx);broadcast(room,{type:'rematch_status',count:room.again.size});
   if(room.again.size===2){room.sentResult=false;start(room,false);}return;
  }
 });
 ws.on('close',()=>{clearRoom(ws);connections.delete(ws);});
 ws.on('error',()=>{clearRoom(ws);connections.delete(ws);});
}
const heartbeat=setInterval(()=>{for(const ws of connections){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);
const tick=setInterval(()=>{
 const now=Date.now();
 for(const ws of [...queue]){
  if(ws.readyState!==1||ws.room){queueRemove(ws);continue;}
  // If nobody else is online, start against an explicitly named bot instead of making people wait.
  if(now-ws.queuedAt>=8500){queueRemove(ws);const room=newRoom(ws,'online');start(room,true);send(ws,{type:'notice',message:'No human opponent found. Facing Glooptron instead!'});}
 }
 for(const room of rooms.values()){
  if(room.phase==='waiting'&&now-room.created>300000){rooms.delete(room.code);broadcast(room,{type:'notice',message:'Invite expired.'});for(const s of room.sockets)if(s)s.room=null;}
  if(room.phase!=='playing'||!room.game)continue;
  let dt=Math.min((now-room.updated)/1000,.12);room.updated=now;
  if(room.bot){room.lastBot+=dt;if(room.lastBot>=.12){Game.aiMove(room.game,1,1.2);room.lastBot=0;}}
  Game.step(room.game,dt);
  if(now-room.lastState>100){room.lastState=now;emitState(room);}
  if(room.game.phase==='over'){emitState(room);finishRound(room);}
 }
},50);
server.on('close',()=>{clearInterval(heartbeat);clearInterval(tick);});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`Gloop Gang Rift Rumble http://localhost:${PORT}`));
module.exports={server,rooms,queue};
