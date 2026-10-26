'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const PUBLIC = path.join(__dirname, 'public');
const MAX_ROOM = 4;
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8'};

const server = http.createServer((req, res) => {
  let pathname, filePath;
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
function send(ws, msg) { if (ws?.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
function code() {
  for (let j=0;j<100;j++) {
    const b=crypto.randomBytes(6); const id=Array.from(b, v=>alphabet[v%alphabet.length]).join('');
    if (!rooms.has(id)) return id;
  }
  return crypto.randomUUID().slice(0,6).toUpperCase();
}
function safeProfile(p) {
  return {name:String(p?.name || 'Glooper').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,14)||'Glooper',color:['mint','berry','sun','blue','purple'].includes(p?.color)?p.color:'mint',perks: Object.fromEntries(['heart','power','sneakers','magnet'].map(k=>[k, Math.max(0,Math.min(5,Number(p?.perks?.[k])||0))]))};
}
function members(room) {return [...room.members].map(c=>({id:c.pid,profile:c.profile}));}
function broadcast(room, data, except) {const encoded=JSON.stringify(data); for(const c of room.members) if(c!==except) send(c,encoded);}
function leave(ws) {
  const room=ws.room; if (!room) return;
  ws.room=null;
  room.members.delete(ws);
  if (room.host === ws) {
    if(room.public && room.members.size) {
      room.host=[...room.members][0];
      broadcast(room,{type:'host_changed',id:room.host.pid,left:ws.pid,players:members(room)});
    } else {
      broadcast(room,{type:'room_closed',message:'The host left the party.'});
      for(const c of room.members) c.room=null;
      rooms.delete(room.code);
    }
  } else broadcast(room,{type:'player_left',id:ws.pid,players:members(room)});
  if(!room.members.size)rooms.delete(room.code);
}
function onConnection(ws){
  ws.alive=true; ws.on('pong',()=>ws.alive=true);
  ws.on('message',(raw)=>{
    let m; try{m=JSON.parse(raw.toString());}catch{return send(ws,{type:'error',message:'Invalid message.'});}
    if(!m || typeof m.type!=='string') return;
    // One-tap matchmaking. Public matches start instantly, and other players can drop in mid-run.
    if(m.type==='match') {
      if(ws.room)return send(ws,{type:'error',message:'Already playing.'});
      const profile=safeProfile(m.profile);
      const available=[...rooms.values()].filter(r=>r.public && r.phase==='game' && r.members.size<MAX_ROOM && (r.elapsed||0)<145);
      available.sort((a,b)=>b.members.size-a.members.size||a.born-b.born);
      let room=available[0];
      if(!room) {
        const id=code();
        room={code:id,host:ws,members:new Set([ws]),nextId:2,phase:'game',public:true,elapsed:0,born:Date.now()};
        ws.room=room;ws.pid='p1';ws.profile=profile;rooms.set(id,room);
        return send(ws,{type:'matched',role:'host',code:id,id:ws.pid,players:members(room),phase:'game'});
      }
      ws.room=room;ws.pid='p'+room.nextId++;ws.profile=profile;room.members.add(ws);
      send(ws,{type:'matched',role:'guest',code:room.code,id:ws.pid,players:members(room),phase:'game'});
      return broadcast(room,{type:'player_joined',players:members(room),id:ws.pid,profile},ws);
    }
    if(m.type==='create') {
      if(ws.room) return send(ws,{type:'error',message:'Already in a room.'});
      const id=code(), profile=safeProfile(m.profile);
      const room={code:id,host:ws,members:new Set([ws]),nextId:2,phase:'lobby',born:Date.now()};
      ws.room=room;ws.pid='p1';ws.profile=profile;rooms.set(id,room);
      return send(ws,{type:'created',code:id,id:ws.pid,players:members(room)});
    }
    if(m.type==='join') {
      if(ws.room) return send(ws,{type:'error',message:'Already in a room.'});
      const id=String(m.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      const room=rooms.get(id);
      if(!room) return send(ws,{type:'error',message:'Party not found. Double-check the code.'});
      if(room.phase!=='lobby' && !(room.public&&room.phase==='game')) return send(ws,{type:'error',message:'That party is not accepting players right now.'});
      if(room.members.size>=MAX_ROOM) return send(ws,{type:'error',message:'That party is full (4 players max).'});
      ws.room=room;ws.pid='p'+room.nextId++;ws.profile=safeProfile(m.profile);room.members.add(ws);
      send(ws,{type:'joined',code:id,id:ws.pid,players:members(room),phase:room.phase,public:!!room.public});
      return broadcast(room,{type:'player_joined',players:members(room),id:ws.pid,profile:ws.profile},ws);
    }
    const room=ws.room;
    if(!room) return;
    if(m.type==='profile' && room.phase==='lobby') {ws.profile=safeProfile(m.profile);return broadcast(room,{type:'players',players:members(room)});}
    if(m.type==='start' && room.host===ws && room.phase==='lobby') {room.phase='game';return broadcast(room,{type:'started',players:members(room)},ws);}
    if(m.type==='input' && room.host!==ws && room.phase==='game') {
      const i=m.input||{};
      return send(room.host,{type:'remote_input',from:ws.pid,input:{x:Math.max(-1,Math.min(1,Number(i.x)||0)),y:Math.max(-1,Math.min(1,Number(i.y)||0)),dash:!!i.dash,blast:!!i.blast}});
    }
    if(m.type==='choice' && room.host!==ws && room.phase==='game') return send(room.host,{type:'remote_choice',from:ws.pid,index:Math.max(0,Math.min(2,Number(m.index)||0))});
    if(m.type==='snapshot' && room.host===ws && room.phase==='game' && m.state) {
      if(room.public)room.elapsed=Number(m.state.t)||0;
      return broadcast(room,{type:'snapshot',state:m.state},ws);
    }
    if(m.type==='ended' && room.host===ws && room.phase==='game') {room.phase='results';return broadcast(room,{type:'ended',results:m.results},ws);}
    if(m.type==='restart' && room.host===ws && room.phase==='results') {
      room.phase=room.public?'game':'lobby';room.elapsed=0;
      return broadcast(room,{type:'restarted',auto:!!room.public,players:members(room)},ws);
    }
  });
  ws.on('close',()=>leave(ws));
  ws.on('error',()=>leave(ws));
}
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);
server.on('close',()=>clearInterval(heartbeat));
if(require.main===module) server.listen(PORT,'0.0.0.0',()=>console.log(`Gloop Gang running at http://localhost:${PORT}`));
module.exports={server,rooms};
