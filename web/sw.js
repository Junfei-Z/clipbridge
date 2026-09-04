const CACHE="clipbridge-0.6.2";
const ASSETS=["./","./index.html","./styles.css","./app.js","./vendor/qrcode.js","./manifest.webmanifest","./assets/brand-icon-96.png","./assets/icon-192.png","./assets/icon-512.png","./assets/apple-touch-icon.png","./assets/favicon.ico"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(response=>response||caches.match("./index.html"))))});
