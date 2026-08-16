// V3 : ce service worker se désinstalle lui-même afin qu'aucune ancienne interface ne reste bloquée en cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
// Aucun fetch n'est intercepté en V3 : le navigateur récupère toujours les fichiers actuels depuis GitHub Pages.
