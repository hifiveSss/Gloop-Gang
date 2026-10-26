// Network-first PWA cache. Online multiplayer always uses the network/WebSocket.
const CACHE='gloop-rift-rumble-v2';
const SHELL=['/','/index.html','/style.css','/core.js','/app.js','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(res=>{if(res.ok){const clone=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,clone)).catch(()=>{}));}return res;}).catch(()=>caches.match(event.request)));});
