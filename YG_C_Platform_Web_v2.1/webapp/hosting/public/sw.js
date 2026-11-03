const CACHE='yuguang-shell-v10';const FILES=['/','/style.css','/records.css','/practice.css','/release.css','/device-panel.css','/device-panel.js','/rest-ui.js','/visuals.js','/app.js','/records.js','/records-ui.js','/live-breathing-ui.js','/practice-model.js','/practice-ui.js','/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
