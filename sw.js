// Hors ligne : l'appli (coquille + données) est servie depuis le cache puis rafraîchie en arrière-plan.
// Tuiles OSM : seulement celles déjà affichées (aucun préchargement massif, politique d'OSM), 2 000 au plus.
// Polices : préchargées à l'installation (sinon, hors ligne, les icônes s'affichent en toutes lettres).
const VERSION = "ams-v11-bxl-2026-10-22";
const SHELL = ["./", "index.html", "app.css", "app.js", "data.js", "ess.js", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png"];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css"];
const TILES = "ams-tiles", FONTS = "ams-fonts", MAX_TILES = 2000;

// cache: "reload" : sans lui, le cache HTTP de GitHub Pages (max-age=600) peut remettre l'ancien data.js dans la nouvelle version
// La coquille doit entrer en entier ; Leaflet et les polices au mieux : un CDN lent ne bloque plus l'installation
async function precacheFonts() {
  const c = await caches.open(FONTS);
  const html = await (await fetch("index.html", { cache: "reload" })).text();
  const css = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, "&"));
  const files = new Set(["https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2"]); // « Chiffres » d'app.css
  for (const u of css) {
    const r = await fetch(u, { mode: "cors" });
    if (!r.ok) continue;
    await c.put(u, r.clone());
    const txt = await r.text();
    for (const m of txt.matchAll(/\/\* (latin|latin-ext) \*\/[^}]*?url\((https:[^)]+)\)/g)) files.add(m[2]);
    if (!/\/\* latin/.test(txt)) for (const m of txt.matchAll(/url\((https:[^)]+)\)/g)) files.add(m[1]); // Material Symbols : un seul fichier
  }
  await Promise.allSettled([...files].map(u => c.match(u).then(hit => hit || fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)))));
}
self.addEventListener("install", e => e.waitUntil(
  caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))
    .then(() => Promise.allSettled([...CDN.map(u => c.add(u)), precacheFonts()])))
    .then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ams-v") && k !== VERSION || k === "ams-trip-v1").map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // API en direct : l'appli gère son propre cache
  if (/open-meteo\.com|transitous\.org/.test(url.host)) return;
  if (url.host === "tile.openstreetmap.org") {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) { c.put(req, r.clone()); trimTiles(); }
      return r;
    }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.open(FONTS).then(async c => (await c.match(req, { ignoreVary: true })) || fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; })));
    return;
  }
  // Coquille et données : cache d'abord, mise à jour en arrière-plan
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin, ignoreVary: true });
    const fresh = url.origin === location.origin ? new Request(url.href, { cache: "no-cache", credentials: "same-origin" }) : req; // revalide auprès du serveur
    const net = fetch(fresh).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
