/* build.cjs replaces the revision with a hash of the complete offline app. */
const REVISION='__BUILD_VERSION__';
const PREFIX='balloon-game:'+self.registration.scope+':';
const CACHE=PREFIX+REVISION;
const FILES=['./','index.html','style.css','game.js','engine.js','sound.js','audio-assets.js','pwa.js','manifest.webmanifest','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/icon-maskable-512.png','assets/icons/apple-touch-icon.png','AUDIO-CREDITS.md','THIRD_PARTY_NOTICES.md','LICENSE'];
const URLS=FILES.map(file=>new URL(file,self.registration.scope).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);url.search='';url.hash='';
  if(!URLS.includes(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(url.href);
    if(cached)return cached;
    return fetch(event.request);
  })());
});
