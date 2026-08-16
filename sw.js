const CACHE='palais-mental-v2';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/icon.svg','./data/notions-001-050.json','./data/notions-051-100.json','./data/notions-101-150.json','./data/notions-151-200.json','./data/notions-201-250.json','./data/notions-251-300.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html'))))});
