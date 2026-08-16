const CACHE='palais-mental-pwa-v1';
const CORE=[
  './v5.html',
  './styles.css',
  './house-quiz.css',
  './app.js',
  './house-quiz.js',
  './install.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './data/notions-001-050.json',
  './data/notions-051-100.json',
  './data/notions-101-150.json',
  './data/notions-151-200.json',
  './data/notions-201-250.json',
  './data/notions-251-300.json'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const fresh=await fetch(event.request);
      if(fresh && fresh.ok)cache.put(event.request,fresh.clone());
      return fresh;
    }catch(err){
      const hit=await cache.match(event.request,{ignoreSearch:true});
      if(hit)return hit;
      if(event.request.mode==='navigate'){
        const shell=await cache.match('./v5.html');
        if(shell)return shell;
      }
      throw err;
    }
  })());
});
