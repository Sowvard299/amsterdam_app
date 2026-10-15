"use strict";
/* Ams · 27→30 — appli de voyage. Données : data.js (lieux, plan) et ess.js (essentiels figés). */

// ───────────── Outils ─────────────
const TZ = "Europe/Amsterdam";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const params = new URLSearchParams(location.search);
const FAKE_NOW = params.get("now"); // pour tester : ?now=2026-10-28T18:05:00%2B01:00
const now = () => (FAKE_NOW ? new Date(FAKE_NOW) : new Date());
const euro = v => (v == null ? "" : v === 0 ? "gratuit" : v.toLocaleString("fr-FR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €");

const partsFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function ams(d = now()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map(x => [x.type, x.value]));
  const h = +p.hour % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, h, m: +p.minute, min: h * 60 + +p.minute };
}
const hhmm = d => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
function addDays(dateStr, n) { const d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

// Une journée de voyage va de 06:00 à 06:00 : la soirée de mercredi reste « mercredi ».
function clock(d = now()) {
  const a = ams(d);
  const early = a.min < 360;
  const logical = early ? addDays(a.date, -1) : a.date;
  const lmin = early ? a.min + 1440 : a.min;
  const idx = DAYS.findIndex(x => x.date === logical);
  let phase = "after";
  if (logical < DAYS[0].date) phase = "before";
  else if (idx >= 0) phase = "day";
  else if (logical === TRIP.leave && a.min < 18 * 60) phase = "leave";
  return { a, logical, lmin, idx, phase, day: idx >= 0 ? DAYS[idx] : null };
}
// « 23:30 » → minutes du jour logique ; avant 06:00 on ajoute 24 h
function tmin(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); if (!m) return null; let v = +m[1] * 60 + +m[2]; if (v < 360) v += 1440; return v; }
const fmtMin = v => { v = ((Math.round(v) % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };

// ───────────── Données ─────────────
const BYID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const BASEP = { ...BASE, cat: "base", why: "Votre auberge, avec le bar Belushi's au rez-de-chaussée." };
BYID.base = BASEP;
const CATS = {
  visit: { label: "Visites", one: "Visite", glyph: "cols" },
  food: { label: "Manger", one: "Manger", glyph: "fork" },
  bar: { label: "Bars", one: "Bar", glyph: "beer" },
  party: { label: "Soirées", one: "Soirée", glyph: "music" },
};
const DAYBY = Object.fromEntries(DAYS.map(d => [d.id, d]));

// ───────────── État (par téléphone) ─────────────
const KEY = "ams-v2";
const DEF = {
  checked: {}, skipped: {}, ck: {}, notes: {}, theme: "system", text: "normal", nav: "google", radius: 40, dwell: 60,
  gps: false, gpsTested: false, mapSeen: false, onboarded: false, hideDone: false, leaveTime: "",
  layers: { visit: true, food: true, bar: true, party: true, wc: false, atm: false, sm: false, ph: false, urinals: false },
  mapFilter: "today", listCat: "bar", listSort: "price", lf: { open: false, near: false, cheap: false, todo: false },
  listDay: null, progDay: null, wx: null,
};
let state = JSON.parse(JSON.stringify(DEF));
try {
  const s = JSON.parse(localStorage.getItem(KEY) || "null");
  if (s) state = { ...state, ...s, layers: { ...DEF.layers, ...(s.layers || {}) }, lf: { ...DEF.lf, ...(s.lf || {}) } };
  else {
    const v1 = JSON.parse(localStorage.getItem("ams-trip-v1") || "null"); // coches de la v1
    if (v1 && v1.checked) {
      const ren = { "v-hoppe": "b-hoppe", "v-aepjen": "b-aepjen" };
      for (const k in v1.checked) { const id = ren[k] || k; if (BYID[id]) state.checked[id] = v1.checked[k]; }
    }
  }
} catch (e) { /* stockage indisponible : on continue sans */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* mode privé */ } }

function applyTheme() {
  const r = document.documentElement;
  if (state.theme === "system") r.removeAttribute("data-theme"); else r.dataset.theme = state.theme;
  if (state.text === "large") r.dataset.text = "large"; else r.removeAttribute("data-text");
}

// ───────────── Géographie ─────────────
let me = null; // {lat, lon, acc}
const from = () => me || BASE;
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Facteur 1,3 et 75 m/min : mesurés sur 8 trajets piétons OSRM depuis l'auberge
const walkMin = m => Math.max(1, Math.round(m * 1.3 / 75));
const walkFrom = p => (p && p.lat != null ? walkMin(dist(from(), p)) : null);
const kmTxt = m => (m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1).replace(".", ",") + " km");
function navUrl(p) {
  if (p.lat == null) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " Amsterdam")}`;
  return state.nav === "apple"
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
}

// ───────────── Horaires ─────────────
function hoursState(p, dayId, lmin) {
  if (p.cat === "party") {
    if (p.date !== dayId && p.date !== "all") return { k: "closed", txt: "pas ce soir" };
    const s = tmin(p.start), e0 = tmin(p.end);
    if (s == null) return { k: "unknown", txt: "horaire non affiché" };
    const e = e0 == null ? null : e0 <= s ? e0 + 1440 : e0;
    if (lmin < s) return { k: "later", txt: "commence à " + fmtMin(s), at: s };
    if (e == null || lmin < e) return { k: "open", txt: e ? "jusqu'à " + fmtMin(e) : "en cours", until: e };
    return { k: "closed", txt: "terminé" };
  }
  const h = p.h && p.h[dayId];
  if (h == null || h === "?") return { k: "unknown", txt: "horaires inconnus" };
  if (/^ferm/.test(h)) return { k: "closed", txt: "fermé ce jour" };
  if (h === "00:00-24:00") return { k: "open", txt: "ouvert 24 h/24", until: 1e9 };
  const m = /^(\d{2}):(\d{2})-(\d{2}:\d{2}|\?)$/.exec(h);
  if (!m) return { k: "unknown", txt: "horaires inconnus" };
  let o = +m[1] * 60 + +m[2];
  if (o < 360) o += 1440;
  if (m[3] === "?") return lmin >= o ? { k: "open?", txt: `ouvert dès ${m[1]}:${m[2]}, fermeture inconnue` } : { k: "later", txt: `ouvre à ${m[1]}:${m[2]}`, at: o };
  let c = +m[3].slice(0, 2) * 60 + +m[3].slice(3);
  if (c <= o) c += 1440;
  if (lmin < o) return { k: "later", txt: `ouvre à ${m[1]}:${m[2]}`, at: o };
  if (lmin < c) return { k: "open", txt: "ouvert jusqu'à " + fmtMin(c), until: c };
  return { k: "closed", txt: "fermé à " + fmtMin(c) };
}
const stateTag = st => {
  if (!st) return "";
  const cls = st.k === "open" ? "open" : st.k === "closed" ? "closed" : st.k === "later" ? "warn" : "";
  return `<span class="tag ${cls}">${esc(st.txt)}</span>`;
};

// ───────────── Badges, formes ─────────────
const confBadge = c => !c ? "" : c === "sûr" ? `<span class="conf s" title="source récente et précise">✓ sûr</span>`
  : c === "probable" ? `<span class="conf p" title="source ancienne ou indirecte">≈ probable</span>` : `<span class="conf v" title="sources en désaccord ou absentes">? à vérifier</span>`;
const SHAPES = {
  visit: '<path d="M3 12 14 2l11 10v13H3Z"/>',
  food: '<circle cx="14" cy="14" r="12"/>',
  bar: '<rect x="2" y="2" width="24" height="24" rx="5"/>',
  party: '<path d="M14 1.5 26.5 14 14 26.5 1.5 14Z"/>',
  base: '<path d="M1 13 14 1l13 12v14H1Z"/>',
};
function shapeSVG(cat, { done = false, num = null, size = 28 } = {}) {
  const k = cat === "base" ? "base" : cat;
  const fill = cat === "base" ? "var(--brand)" : done ? "var(--pin-done)" : `var(--pin-${cat})`;
  const ink = cat === "base" ? "#fff" : done ? "var(--pin-done-ink)" : `var(--pin-${cat}-ink)`;
  const glyph = num != null
    ? `<text x="14" y="${cat === "visit" ? 20 : 18.6}" text-anchor="middle" font-size="13" font-weight="700" font-family="IBM Plex Sans,system-ui,sans-serif" style="fill:${ink}">${num}</text>`
    : done ? `<path d="m8.5 14.5 4 4 7-8" style="stroke:${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<use href="#i-${cat === "base" ? "home" : CATS[cat].glyph}" x="7" y="${cat === "visit" ? 9 : 7}" width="14" height="14" style="color:${ink}" stroke="currentColor" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="-8 -8 44 44" width="${size + 16}" height="${size + 16}" aria-hidden="true">
    <g style="stroke:var(--pin-stroke-out,#1A1714)" stroke-width="5" fill="none">${SHAPES[k]}</g>
    <g stroke="#fff" stroke-width="2.5" style="fill:${fill}">${SHAPES[k]}</g>${glyph}</svg>`;
}
const smallShape = (cat, done) => `<span class="shape" aria-hidden="true">${shapeSVG(cat, { done, size: 12 }).replace('width="28" height="28"', "")}</span>`;

// ───────────── Plan ─────────────
const stepKey = (s, day) => (s.id === "base" ? "base-" + day : s.id);
const isDone = k => !!state.checked[k];
const isSkipped = (day, s) => !!state.skipped[day + ":" + s.id];
function plan(day) { return (PLAN[day] || []).map(s => ({ ...s, p: BYID[s.id], t: tmin(s.at) })); }
// Une étape dont l'heure est largement dépassée est considérée comme manquée (sauf si on la coche)
// ou dont le lieu sera fermé à l'arrivée
function missed(s, lmin, day) {
  if (lmin == null) return false;
  if (lmin > s.t + (s.dur || 60) + 15) return true;
  if (s.p.cat === "base" || lmin < s.t - 60) return false;
  return hoursState(s.p, day, lmin + (walkFrom(s.p) || 0)).k === "closed";
}
function nextStep(day, lmin = null) { return plan(day).find(s => !isDone(stepKey(s, day)) && !isSkipped(day, s) && !missed(s, lmin, day)); }
// Prix d'offre réservé à un jour (ex. jeudi étudiant) : inconnu les autres jours
const priceOn = (p, dayId) => (p.deal && dayId && p.deal !== dayId ? null : p.price);
function dayProgress(day) {
  const st = plan(day).filter(s => s.id !== "base");
  const done = st.filter(s => isDone(s.id)).length;
  const kinds = { voir: false, manger: false, sortir: false };
  for (const s of st) if (isDone(s.id)) {
    if (s.p.cat === "visit") kinds.voir = true;
    else if (s.p.cat === "food") kinds.manger = true;
    else kinds.sortir = true;
  }
  return { done, total: st.length, kinds };
}
function xxx(kinds) {
  const x = on => `<svg viewBox="0 0 26 26"><path class="x${on ? " on" : ""}" d="M5 5l16 16M21 5 5 21"/></svg>`;
  const k = kinds || {};
  const lab = `voir ${k.voir ? "fait" : "à faire"}, manger ${k.manger ? "fait" : "à faire"}, sortir ${k.sortir ? "fait" : "à faire"}`;
  return `<div class="xxx" role="img" aria-label="${lab}">${x(k.voir)}${x(k.manger)}${x(k.sortir)}</div>`;
}

// ───────────── Météo (Open-Meteo, CC BY 4.0) ─────────────
const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=52.374&longitude=4.8964"
  + "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day"
  + "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"
  + "&timezone=GMT&timeformat=unixtime&forecast_days=16&wind_speed_unit=kmh";
function wmo(c) {
  if (c == null) return ["cloud", "—"];
  if (c === 0) return ["sun", "dégagé"];
  if (c <= 2) return ["pcloud", "éclaircies"];
  if (c === 3) return ["cloud", "couvert"];
  if (c <= 48) return ["fog", "brouillard"];
  if (c <= 57) return ["rain", "bruine"];
  if (c <= 67) return ["rain", "pluie"];
  if (c <= 77) return ["snow", "neige"];
  if (c <= 82) return ["rain", "averses"];
  if (c <= 86) return ["snow", "neige"];
  return ["storm", "orage"];
}
async function fetchTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
}
async function loadWeather(force = false) {
  if (!force && state.wx && Date.now() - state.wx.ts < 60 * 60e3) return;
  if (!navigator.onLine) return;
  try {
    const r = await fetchTimeout(WX_URL);
    if (!r.ok) return;
    const d = await r.json();
    state.wx = { ts: Date.now(), d: { current: d.current, hourly: d.hourly, daily: d.daily } };
    save();
    renderActive();
  } catch (e) { /* réseau absent : on garde l'ancienne valeur */ }
}
function wxDay(dateStr) {
  const d = state.wx && state.wx.d.daily;
  if (!d) return null;
  const i = d.time.findIndex(t => new Date(t * 1000).toISOString().slice(0, 10) === dateStr);
  if (i < 0 || d.temperature_2m_max[i] == null) return null;
  return { code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], pp: d.precipitation_probability_max[i], mm: d.precipitation_sum[i] };
}
function wxHours(fromMs, hours) {
  const h = state.wx && state.wx.d.hourly;
  if (!h) return [];
  const out = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i] * 1000;
    if (t >= fromMs - 3600e3 && t <= fromMs + hours * 3600e3) out.push({ t, temp: h.temperature_2m[i], pp: h.precipitation_probability[i], code: h.weather_code[i] });
  }
  return out;
}
const wxAge = () => (state.wx ? "MAJ " + hhmm(new Date(state.wx.ts)) : "");

// ───────────── Ferries (Transitous, horaires GVB prévus) ─────────────
const ferryCache = {};
async function loadFerries(key) {
  const c = ferryCache[key];
  if (c && Date.now() - c.ts < 60e3) return c.list;
  const r = await fetchTimeout(`https://api.transitous.org/api/v1/stoptimes?stopId=${FERRY[key]}&n=10&mode=FERRY`);
  if (!r.ok) throw new Error("http " + r.status);
  const d = await r.json();
  const list = (d.stopTimes || []).map(st => ({ line: st.routeShortName || st.displayName || "", to: st.headsign, t: new Date(st.place.departure || st.place.scheduledDeparture) }))
    .filter(x => x.t.getTime() > Date.now() - 60e3);
  ferryCache[key] = { ts: Date.now(), list };
  return list;
}
function ferryBlock(key, title) {
  const id = "fer-" + key + "-" + Math.random().toString(36).slice(2, 7);
  setTimeout(async () => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!navigator.onLine) { el.innerHTML = `<p class="small muted">Hors ligne. F3 : toutes les 4 à 12 min, jour et nuit. F4 : toutes les 15 min, 30 min après 19:00.</p>`; return; }
    try {
      const l = await loadFerries(key);
      el.innerHTML = l.length ? l.slice(0, 6).map(x => `<div class="tel"><span><b>${esc(x.line)}</b> → ${esc(x.to)}</span><span class="num">${hhmm(x.t)}</span></div>`).join("")
        : `<p class="small muted">Aucun départ trouvé.</p>`;
    } catch (e) { el.innerHTML = `<p class="small muted">Horaires indisponibles. F3 tourne jour et nuit, toutes les 4 à 12 min.</p>`; }
  }, 0);
  return `<div class="kv"><h4>${esc(title)}</h4><div id="${id}"><p class="small muted">Chargement…</p></div>
    <p class="xs muted">Horaires prévus GVB via <a href="https://transitous.org/sources" target="_blank" rel="noopener">Transitous</a>, pas de temps réel pour les ferries.</p></div>`;
}

// ───────────── Essentiels ─────────────
const ESSDEF = {
  wc: { label: "WC", icon: "wc", one: "Toilettes" },
  atm: { label: "Distributeur", icon: "euro", one: "Distributeur" },
  sm: { label: "Supermarché", icon: "cart", one: "Supermarché" },
  ph: { label: "Pharmacie", icon: "plus", one: "Pharmacie" },
};
function essList(type) {
  return ESS[type].filter(e => type !== "wc" || state.layers.urinals || !e[5]).map(e => ({ lat: e[0], lon: e[1], e }));
}
function nearest(type, n = 3) {
  const f = from();
  return essList(type).map(x => ({ ...x, d: dist(f, x) })).sort((a, b) => a.d - b.d).slice(0, n);
}
function essGrid() {
  return `<div class="ess">${Object.entries(ESSDEF).map(([k, v]) => {
    const n = nearest(k, 1)[0];
    return `<button type="button" data-act="ess" data-type="${k}">${icon(v.icon)}${v.label}<span class="m">${n ? walkMin(n.d) + " min" : ""}</span></button>`;
  }).join("")}</div>`;
}
function openEss(type) {
  const v = ESSDEF[type];
  const list = nearest(type, 3);
  const rows = list.map((x, i) => {
    const e = x.e;
    const extra = type === "wc" ? `${e[3] ? euro(+e[3]) : "gratuit"}${e[4] ? " · " + esc(e[4]) : ""}${e[5] ? " · urinoir (hommes)" : ""}` : esc(e[3] || "");
    const p = { name: e[2] || v.one, lat: x.lat, lon: x.lon };
    return `<div class="tel"><span><b>${i + 1}. ${esc(e[2] || v.one)}</b><br><span class="xs muted">${walkMin(x.d)} min · ${kmTxt(x.d)}${extra ? " · " + extra : ""}</span></span>
      <a class="btn sm" href="${navUrl(p)}" target="_blank" rel="noopener">Y aller ${icon("go", "i s")}</a></div>`;
  }).join("");
  openSheet(`<div style="flex:1"><h2 id="sheetTitle">${v.one} les plus proches</h2><p class="small muted" style="margin:4px 0 0">${me ? "depuis votre position" : "depuis l'auberge (GPS coupé)"}</p></div>`,
    `${rows}<p class="xs muted">${type === "wc" ? "Toilettes publiques de la ville (Gemeente Amsterdam, open data)" : "© OpenStreetMap contributors"} · instantané du 15/10/2026.</p>
     <button type="button" class="btn" data-act="showEss" data-type="${type}">${icon("map")} Voir sur la carte</button>`);
}

// ───────────── Feuille du bas ─────────────
let sheetOpen = false, lastFocus = null;
function openSheet(head, content, { full = false } = {}) {
  lastFocus = document.activeElement;
  $("#sheetHead").innerHTML = head + `<button type="button" class="close" data-act="closeSheet" aria-label="Fermer">${icon("close")}</button>`;
  $("#sheetContent").innerHTML = content;
  $("#sheetContent").scrollTop = 0;
  const sh = $("#sheet");
  sh.classList.toggle("full", full);
  sh.classList.add("open");
  sh.setAttribute("aria-hidden", "false");
  sh.setAttribute("aria-modal", "true");
  $("#scrim").classList.add("on");
  if (!sheetOpen) history.pushState({ sheet: 1 }, "");
  sheetOpen = true;
  setTimeout(() => { const t = $("#sheetTitle"); if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); } }, 50);
}
function closeSheet(fromPop = false) {
  if (!sheetOpen) return;
  sheetOpen = false;
  const sh = $("#sheet");
  sh.classList.remove("open", "full");
  sh.setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("on");
  if (selMarker) { selMarker = null; drawMarkers(); }
  if (!fromPop) history.back();
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
window.addEventListener("popstate", () => { if (sheetOpen) closeSheet(true); });
$("#scrim").addEventListener("click", () => closeSheet());
$("#sheetGrab").addEventListener("click", () => $("#sheet").classList.toggle("full"));
(function dragSheet() {
  let y0 = null, dy = 0;
  const sh = $("#sheet");
  const start = e => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = "none"; };
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
  const end = () => {
    if (y0 == null) return;
    sh.style.transition = ""; sh.style.transform = "";
    if (dy > 90) { if (sh.classList.contains("full")) sh.classList.remove("full"); else closeSheet(); }
    y0 = null;
  };
  for (const el of [$("#sheetGrab"), $("#sheetHead")]) {
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
  }
})();

function placeSheet(id) {
  const p = BYID[id];
  if (!p) return;
  const c = clock();
  const dayId = c.phase === "day" ? c.day.id : null;
  const w = walkFrom(p);
  const done = isDone(id);
  const catLabel = p.cat === "base" ? "Auberge" : CATS[p.cat].one;
  const head = `${smallShape(p.cat === "base" ? "base" : p.cat, done)}<div style="flex:1;min-width:0">
      <h2 id="sheetTitle">${esc(p.name)}</h2>
      <div class="small muted" style="margin-top:2px">${catLabel}${p.venue ? " · " + esc(p.venue) : ""}${w ? ` · ${w} min à pied` : ""}</div></div>
      ${p.price != null ? `<div class="price" style="font-weight:700;font-size:var(--fs-lg)">${euro(p.price)}</div>` : ""}`;
  const planned = [];
  for (const d of DAYS) for (const s of PLAN[d.id] || []) if (s.id === id) planned.push(`${d.label} · ${s.at}${s.note ? " — " + esc(s.note) : ""}`);
  let hours = "";
  if (p.cat === "party") {
    hours = `<p><b>${DAYBY[p.date] ? DAYBY[p.date].long : "Tous les soirs"}</b> · ${esc(p.start)}${p.end && !/non/.test(p.end) ? "–" + esc(p.end) : ""}</p>`;
  } else if (p.h) {
    hours = `<table class="hrs">${DAYS.map(d => `<tr class="${d.id === dayId ? "today" : ""}"><td>${d.label}</td><td style="text-align:right">${esc(p.h[d.id] == null || p.h[d.id] === "?" ? "inconnu" : p.h[d.id].replace("-", "–").replace("00:00–24:00", "24 h/24"))}</td></tr>`).join("")}</table>`
      + (p.hNote ? `<p class="xs muted" style="margin-top:6px">${esc(p.hNote)}</p>` : "");
  }
  const st = dayId && p.cat !== "base" ? hoursState(p, dayId, c.lmin) : null;
  const know = [];
  if (p.tip) know.push(esc(p.tip));
  if (p.cash) know.push("Espèces conseillées.");
  if (p.book && p.book.txt) know.push(esc(p.book.txt));
  if (p.genre) know.push("Style : " + esc(p.genre));
  if (p.soldOut) know.push("<b>Complet</b> au 15/10.");
  const src = (p.src || []).map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)} <span class="muted">(${esc(s.d)})</span></a>`).join("");
  const dist0 = p.lat != null ? dist(from(), p) : null;
  const content = `
    <div class="btns" style="margin-top:0">
      <a class="btn primary" href="${navUrl(p)}" target="_blank" rel="noopener">${icon("go")} Y aller</a>
      ${p.cat !== "base" ? `<label class="switch"><input type="checkbox" switch data-act="toggleDone" data-id="${id}" ${done ? "checked" : ""}> Fait</label>` : ""}
      <button type="button" class="btn" data-act="share" data-id="${id}" aria-label="Partager">${icon("share")}</button>
    </div>
    ${p.url ? `<div class="btns"><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${icon("ticket")} Billets et programme</a></div>` : ""}
    ${p.book && p.book.url ? `<div class="btns"><a class="btn" href="${esc(p.book.url)}" target="_blank" rel="noopener">${icon("ticket")} Réserver</a></div>` : ""}
    <p class="small muted" style="margin:10px 0 0">${icon("walk", "i s")} ${dist0 != null ? `${walkMin(dist0)} min · ${kmTxt(dist0)} ${me ? "depuis vous" : "depuis l'auberge"}` : "adresse sur le billet"} · ${esc(p.addr || "")}</p>
    ${st ? `<p style="margin:8px 0 0">${stateTag(st)}</p>` : ""}
    ${p.why ? `<div class="kv"><h4>Pourquoi</h4><p>${esc(p.why)}</p></div>` : ""}
    ${p.priceTxt ? `<div class="kv"><h4>Prix</h4><p>${esc(p.priceTxt)}</p></div>` : ""}
    ${know.length ? `<div class="kv"><h4>Bon à savoir</h4><p>${know.join("<br>")}</p></div>` : ""}
    ${hours ? `<div class="kv"><h4>Horaires</h4>${hours}</div>` : ""}
    ${p.id === "v-ferry" ? ferryBlock("centraal", "Prochains ferries depuis Centraal") : ""}
    ${p.id === "v-ndsm" ? ferryBlock("ndsm", "Prochains ferries depuis NDSM") : ""}
    ${p.id === "v-eye" || p.id === "v-lookout" ? ferryBlock("buiksloterweg", "Prochains ferries depuis Buiksloterweg") : ""}
    ${planned.length ? `<div class="kv"><h4>Prévu</h4><p>${planned.join("<br>")}</p></div>` : ""}
    ${p.cat !== "base" ? `<div class="kv"><h4>Fiabilité</h4><p>${confBadge(p.conf)} <span class="xs muted">vérifié le 15 oct.</span></p><div class="srcs">${src}</div></div>` : ""}
    ${p.cat !== "base" ? `<div class="kv"><h4>Mes notes</h4><textarea data-note="${id}" placeholder="Visible seulement sur ce téléphone">${esc(state.notes[id] || "")}</textarea></div>` : ""}`;
  openSheet(head, content);
  if (mapReady && p.lat != null && $("#s-map").classList.contains("active")) { selMarker = id; drawMarkers(); }
}

// ───────────── Composants de liste ─────────────
function placeRow(p, { dayId = null, lmin = 0, showDay = false } = {}) {
  const w = walkFrom(p);
  const st = dayId ? hoursState(p, dayId, lmin) : null;
  const done = isDone(p.id);
  const subs = [];
  if (w) subs.push(`${w} min`);
  if (p.cat === "party") subs.push(`${showDay && DAYBY[p.date] ? DAYBY[p.date].label + " · " : ""}${esc(p.start)}`);
  if (st && p.cat !== "party") subs.push(stateTag(st));
  if (p.cat === "party") subs.push(esc(p.venue));
  subs.push(confBadge(p.conf));
  if (p.soldOut) subs.push(`<span class="tag closed">complet</span>`);
  const pr = priceOn(p, dayId);
  if (p.deal) subs.push(`<span class="tag warn">prix du ${DAYBY[p.deal].long.split(" ")[0].toLowerCase()}</span>`);
  const priceTxt = pr != null ? euro(pr) : p.cat === "party" || p.deal ? "?" : "";
  return `<button type="button" class="li${done ? " done" : ""}" data-act="open" data-id="${p.id}">
    ${smallShape(p.cat, done)}
    <span style="flex:1;min-width:0"><span class="nm">${esc(p.name)}</span><span class="sub">${subs.join("")}</span></span>
    <span class="pr num">${priceTxt}</span></button>`;
}

function timeline(day, { lmin = null, controls = false } = {}) {
  const steps = plan(day);
  const sun = tmin(SUN[day][1]);
  const nx = nextStep(day, lmin);
  let html = `<ol class="tl">`, sunDone = false, prev = BASE;
  for (const s of steps) {
    if (!sunDone && s.t > sun) {
      html += `<li class="sun"><span class="time num">${SUN[day][1]}</span><span class="rail"><span class="dot"></span></span><div class="body">${icon("moon", "i s")} coucher du soleil</div></li>`;
      sunDone = true;
    }
    const k = stepKey(s, day), done = isDone(k), skipped = isSkipped(day, s) || (!done && missed(s, lmin, day));
    const w = prev && s.p.lat != null ? walkMin(dist(prev, s.p)) : null;
    const cls = [done ? "done" : "", skipped ? "skipped" : "", nx && nx.id === s.id && lmin != null ? "isnext" : ""].join(" ");
    html += `<li class="${cls}"><span class="time num">${s.at}</span><span class="rail"><span class="dot"></span></span><div class="body">
      ${w && prev !== BASE ? `<div class="walk">${icon("walk", "i s")} ${w} min à pied</div>` : ""}
      <button type="button" class="item" data-act="open" data-id="${s.id}">${smallShape(s.p.cat === "base" ? "base" : s.p.cat, done)}
        <span class="nm">${esc(s.id === "base" ? "Auberge : déposer les sacs" : s.p.name)}</span>
        <span class="num small" style="font-weight:700">${s.p.price != null ? euro(s.p.price) : ""}</span></button>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
      ${controls ? `<div class="tlctl"><button type="button" class="btn sm ghost" data-act="stepDone" data-day="${day}" data-id="${s.id}">${done ? "Annuler" : "Fait"}</button>
        <button type="button" class="btn sm ghost" data-act="stepSkip" data-day="${day}" data-id="${s.id}">${skipped ? "Remettre" : "Passer"}</button></div>` : ""}
      </div></li>`;
    if (s.p.lat != null) prev = s.p;
  }
  if (!sunDone) html += `<li class="sun"><span class="time num">${SUN[day][1]}</span><span class="rail"><span class="dot"></span></span><div class="body">${icon("moon", "i s")} coucher du soleil</div></li>`;
  return html + "</ol>";
}

// ───────────── Écran Aujourd'hui ─────────────
function statusLine(c) {
  const wx = state.wx && state.wx.d.current;
  const left = c.phase === "day" ? `${esc(c.day.long.split(" ")[0])} ${c.day.label.split(" ")[1]} oct. · Jour ${c.idx + 1}/4`
    : new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now());
  const w = wx && c.phase !== "before" ? `${icon(wmo(wx.weather_code)[0], "i s")} ${Math.round(wx.temperature_2m)}°` : "";
  return `<div class="status"><span class="grow">${left}</span>${w}</div>`;
}
function renderToday() {
  const c = clock();
  const el = $("#s-today");
  $("#todayIcon").setAttribute("href", c.a.h >= 18 || c.a.h < 7 ? "#i-moon" : "#i-sun");
  if (c.phase === "before") el.innerHTML = todayBefore(c);
  else if (c.phase === "day") el.innerHTML = todayDay(c);
  else if (c.phase === "leave") el.innerHTML = todayLeave(c);
  else el.innerHTML = todayAfter(c);
}
function dueBadge(due, today) {
  const n = daysBetween(today, due);
  if (n < 0) return `<span class="due late">en retard</span>`;
  if (n === 0) return `<span class="due late">aujourd'hui</span>`;
  if (n <= 3) return `<span class="due soon">dans ${n} j</span>`;
  return `<span class="due ok">avant le ${due.slice(8)}/${due.slice(5, 7)}</span>`;
}
function ckRow(it, today) {
  const done = !!state.ck[it.id];
  return `<label class="ck${done ? " done" : ""}"><input type="checkbox" data-act="ck" data-id="${it.id}" ${done ? "checked" : ""}>
    <span class="t">${esc(it.txt)}${it.url ? ` · <a href="${esc(it.url)}" target="_blank" rel="noopener">ouvrir</a>` : ""}</span>${done ? "" : dueBadge(it.due, today)}</label>`;
}
function todayBefore(c) {
  const n = daysBetween(c.a.date, TRIP.start);
  const todo = CHECKLIST.filter(i => !state.ck[i.id]).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const prep = [
    { ok: standalone, txt: "Ajouter l'appli à l'écran d'accueil", act: "onboard" },
    { ok: state.gpsTested, txt: "Tester le GPS une fois", act: "gpsTest" },
    { ok: state.mapSeen, txt: "Ouvrir la carte une fois sur le Wi-Fi", act: "tab", s: "s-map" },
    { ok: !!state.ck.guide, txt: "Lire le guide pratique", url: TRIP.guide, id: "guide" },
  ];
  const nPrep = prep.filter(x => x.ok).length;
  const tiles = DAYS.map(d => {
    const w = wxDay(d.date);
    const [ic, lab] = w ? wmo(w.code) : ["cloud", ""];
    return `<div class="card wxday"><div class="d">${d.label}</div>${w ? icon(ic) + `<div class="num"><b>${Math.round(w.max)}°</b> <span class="muted">${Math.round(w.min)}°</span></div><div class="xs muted">${w.pp != null ? w.pp + " % pluie" : esc(lab)}</div>` : `<div class="xs muted" style="padding:14px 0">pas encore</div>`}</div>`;
  }).join("");
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1 class="big num">J-${n}</h1><p>Mar 27 → Ven 30 oct. · départ sam. 31 tôt</p></div>${xxx(null)}</div>
  <div class="sec"><h2>À faire maintenant</h2><div class="card pad" style="padding-top:4px;padding-bottom:4px">
    ${todo.length ? todo.map(i => ckRow(i, c.a.date)).join("") : `<p class="empty">Tout est prêt.</p>`}</div>
    <p class="small" style="margin:8px 0 0"><button type="button" class="btn sm ghost" data-act="tab" data-s="s-info">Toute la liste (${CHECKLIST.filter(i => state.ck[i.id]).length}/${CHECKLIST.length})</button></p></div>
  <div class="sec"><h2>Météo prévue <span class="grow"></span><span class="xs" style="text-transform:none;letter-spacing:0">${n > 7 ? "indicatif" : ""} ${wxAge()}</span></h2>
    <div class="wxdays">${tiles}</div>
    <p class="xs muted" style="margin:6px 0 0">Normales fin octobre : 7 à 13,5 °C, une averse par jour. Nuit vers 17:15. Météo : <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p></div>
  <div class="sec"><h2>Préparer le téléphone <span class="grow"></span>${nPrep}/4</h2><div class="card pad" style="padding-top:4px;padding-bottom:4px">
    ${prep.map(x => `<div class="ck${x.ok ? " done" : ""}">${x.ok ? icon("check") : icon("chev")}<span class="t">${x.url ? `<a href="${x.url}" target="_blank" rel="noopener" data-act="guideRead">${esc(x.txt)}</a>` : `<button type="button" class="btn sm ghost" data-act="${x.act}" ${x.s ? `data-s="${x.s}"` : ""}>${esc(x.txt)}</button>`}</span></div>`).join("")}
  </div></div>
  <div class="sec"><h2>Vos 4 jours</h2><div class="list">
    ${DAYS.map(d => { const pr = dayProgress(d.id); return `<button type="button" class="li" data-act="day" data-day="${d.id}">${icon("cal")}<span style="flex:1"><span class="nm">${d.label} · ${esc(d.theme)}</span><span class="sub">${esc(d.sub)}</span></span><span class="pr num">${pr.done}/${pr.total}</span></button>`; }).join("")}
  </div></div>
  <div class="sec"><a class="btn" style="width:100%" href="${TRIP.guide}" target="_blank" rel="noopener" data-act="guideRead">${icon("doc")} Guide pratique (papiers, transports, règles, valise)</a></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}
function nextCard(c, s) {
  const day = c.day.id;
  if (!s) {
    return `<div class="card pad next"><div class="when">Programme terminé</div><h3>Bien joué</h3><p class="why">Tout le plan du jour est fait ou passé. Regardez « Ce soir » ou rentrez.</p></div>`;
  }
  const p = s.p, w = walkFrom(p) || 0;
  const leave = s.t - w - 3;
  const arrive = Math.max(c.lmin + w, s.t);
  const stArr = p.cat !== "base" ? hoursState(p, day, arrive) : null;
  const late = c.lmin - s.t;
  const here = me && p.lat != null && dist(me, p) <= state.radius + 30;
  const alerts = [];
  if (stArr && (stArr.k === "closed")) alerts.push(`<div class="alert bad">${icon("alert", "i s")} ${p.cat === "party" ? "Terminé à votre arrivée" : "Fermé à votre arrivée"} (${esc(stArr.txt)})</div>`);
  else if (stArr && stArr.k === "later" && stArr.at - arrive > 20) alerts.push(`<div class="alert warn">${esc(stArr.txt)}</div>`);
  if (late > 15) alerts.push(`<div class="alert warn">En retard de ${late} min · passer à la suite ?</div>`);
  return `<div class="card pad next">
    <div class="when">${here ? "Vous y êtes" : "Ensuite · " + s.at}</div>
    <div class="row" style="margin-top:6px">${smallShape(p.cat === "base" ? "base" : p.cat, false)}<h3 class="grow" style="margin:0">${esc(s.id === "base" ? "Auberge : déposer les sacs" : p.name)}</h3>
      ${p.price != null ? `<span class="price num">${euro(p.price)}</span>` : ""}</div>
    ${p.why ? `<p class="why">${esc(p.why)}</p>` : ""}
    ${s.note ? `<p class="why"><b>${esc(s.note)}</b></p>` : ""}
    <div class="meta row">${icon("walk", "i s")}<span class="grow">${w} min ${me ? "depuis vous" : "depuis l'auberge"}${!here && leave > c.lmin ? ` · partez à <b class="num">${fmtMin(leave)}</b>` : ""}</span>${confBadge(p.conf)}</div>
    ${alerts.join("")}
    <div class="btns"><a class="btn primary" href="${navUrl(p)}" target="_blank" rel="noopener">${icon("go")} Y aller</a>
      <button type="button" class="btn" data-act="stepDone" data-day="${day}" data-id="${s.id}">${icon("check")} Fait</button>
      <button type="button" class="btn" data-act="stepSkip" data-day="${day}" data-id="${s.id}" aria-label="Passer">${icon("skip")}</button></div>
  </div>`;
}
function weatherStrip(c) {
  const sun = SUN[c.day.id][1];
  if (!state.wx) return `<div class="card wx">${icon("moon", "i s")} Coucher du soleil ${sun}<span class="muted small">${navigator.onLine ? "Météo indisponible pour l'instant" : "Météo indisponible hors ligne"}</span></div>`;
  const cur = state.wx.d.current;
  const hrs = wxHours(now().getTime(), 8);
  let maxp = null;
  for (const h of hrs) if (h.pp != null && (!maxp || h.pp > maxp.pp)) maxp = h;
  const [ic, lab] = wmo(cur ? cur.weather_code : null);
  return `<button type="button" class="card wx" data-act="hourly" style="width:100%;text-align:left;border:1px solid var(--line)">
    ${icon(ic)}<b class="num">${cur ? Math.round(cur.temperature_2m) + "°" : "—"}</b><span>${esc(lab)}</span>
    ${maxp ? `<span>${icon("rain", "i s")} ${maxp.pp} % vers ${hhmm(new Date(maxp.t)).slice(0, 2)} h</span>` : ""}
    <span>${icon("moon", "i s")} ${sun}</span><span class="xs muted">${wxAge()}</span></button>
    <div id="hourly" hidden></div>`;
}
function hourlyHTML() {
  const hrs = wxHours(now().getTime(), 12);
  if (!hrs.length) return "";
  return `<div class="card pad" style="margin-top:8px"><div class="hours">${hrs.map(h => `<div><div class="num">${hhmm(new Date(h.t)).slice(0, 2)}h</div>
    <div class="bar"><span style="height:${Math.max(2, (h.pp || 0) * 0.36)}px"></span></div><div class="num">${h.pp ?? "–"}%</div><div class="num"><b>${Math.round(h.temp)}°</b></div></div>`).join("")}</div>
    <p class="xs muted" style="margin:6px 0 0">Risque de pluie heure par heure · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p></div>`;
}
function todayDay(c) {
  const day = c.day.id;
  const pr = dayProgress(day);
  const s = nextStep(day, c.lmin);
  const tonight = PLACES.filter(p => p.cat === "party" && p.date === day).map(p => ({ p, st: hoursState(p, day, c.lmin) }))
    .filter(x => x.st.k !== "closed").sort((a, b) => (tmin(a.p.start) || 0) - (tmin(b.p.start) || 0) || (a.p.price ?? 99) - (b.p.price ?? 99));
  const tonightHTML = `<div class="sec"><h2>Ce soir (${tonight.length}) <span class="grow"></span><button type="button" class="btn sm ghost" data-act="partiesDay" data-day="${day}">Tout voir</button></h2>
    ${tonight.length ? `<div class="carousel">${tonight.map(x => placeRow(x.p, { dayId: day, lmin: c.lmin })).join("")}</div>
    <p class="xs muted" style="margin:6px 0 0">Programmes vérifiés le 15/10 : revérifiez la veille sur la page de la soirée.</p>` : `<p class="empty">Pas de soirée datée ce soir.</p>`}</div>`;
  const openNow = PLACES.filter(p => (p.cat === "bar" || p.cat === "food") && p.lat != null)
    .map(p => ({ p, st: hoursState(p, day, c.lmin), w: walkFrom(p) }))
    .filter(x => x.st.k === "open" && x.w <= 15).sort((a, b) => (priceOn(a.p, day) ?? 99) - (priceOn(b.p, day) ?? 99)).slice(0, 6);
  const others = PLACES.filter(p => p.cat !== "party" && (p.days || []).includes(day) && !(PLAN[day] || []).some(st => st.id === p.id));
  const home = BASE, wHome = walkMin(dist(from(), home));
  const late = c.lmin >= 25 * 60 || (!s && c.lmin >= 22 * 60);
  const homeCard = late ? `<div class="sec"><div class="card pad next" style="border-left-color:var(--ok)"><div class="when" style="color:var(--ok)">Rentrer</div>
      <h3>Auberge · ${wHome} min à pied</h3><p class="why">Bus de nuit 5,70 € (N81–N93) si vous êtes loin. Ferry F3 toute la nuit depuis Noord.</p>
      <div class="btns"><a class="btn primary" href="${navUrl({ ...home, name: "Warmoesstraat 129" })}" target="_blank" rel="noopener">${icon("walk")} À pied</a>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${home.lat},${home.lon}&travelmode=transit" target="_blank" rel="noopener">Bus de nuit</a></div></div></div>` : "";
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1>${esc(c.day.theme)}</h1><p>Jour ${c.idx + 1}/4 · ${pr.done}/${pr.total} étapes · ${esc(c.day.sub)}</p></div>${xxx(pr.kinds)}</div>
  ${homeCard}
  <div class="sec">${nextCard(c, s)}</div>
  <div class="sec">${weatherStrip(c)}</div>
  ${c.lmin >= 22 * 60 ? tonightHTML : ""}
  <div class="sec"><h2>Le plan du jour <span class="grow"></span>${pr.done}/${pr.total}</h2><div class="card pad" style="padding-top:6px;padding-bottom:6px">${timeline(day, { lmin: c.lmin })}</div></div>
  ${c.lmin < 22 * 60 ? tonightHTML : ""}
  <div class="sec"><h2>Ouvert maintenant, à moins de 15 min</h2>
    ${openNow.length ? `<div class="list">${openNow.map(x => placeRow(x.p, { dayId: day, lmin: c.lmin })).join("")}</div>`
      : `<p class="empty">Aucun bar ni resto aux horaires connus n'est ouvert à moins de 15 min.</p>`}</div>
  <div class="sec"><h2>Près de vous</h2>${essGrid()}</div>
  <div class="sec"><details><summary class="label" style="cursor:pointer;min-height:var(--tap);display:flex;align-items:center">Aussi dans le coin (${others.length})</summary>
    <div class="list">${others.map(p => placeRow(p, { dayId: day, lmin: c.lmin })).join("")}</div></details></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}
function todayLeave(c) {
  const trains = ["03:46", "04:46", "05:05", "05:18", "05:29", "05:49"];
  const items = ["Pièce d'identité et cartes bancaires", "Chargeurs et batterie externe", "Casier de l'auberge vidé, cadenas repris", "Carte-clé rendue à la réception (départ avant 11:00)", "Billet de train ou d'avion dans le téléphone"];
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1>Départ</h1><p>Samedi 31 octobre · Centraal à 7 min à pied</p></div>${xxx({ voir: true, manger: true, sortir: true })}</div>
  <div class="sec"><div class="card pad next"><div class="when">Trains Centraal → Schiphol (prévus)</div>
    <p class="num" style="font-size:var(--fs-lg);font-weight:700;margin:8px 0">${trains.join(" · ")}</p>
    <p class="why">13 à 17 min de trajet. Schiphol demande 2 h d'avance pour un vol Schengen. Vérifiez dans l'appli NS. Badgez votre carte au portique.</p>
    <div class="btns"><a class="btn primary" href="https://www.google.com/maps/dir/?api=1&destination=52.3791,4.9003&travelmode=walking" target="_blank" rel="noopener">${icon("walk")} Vers Centraal</a></div></div></div>
  <div class="sec"><h2>Avant de fermer la porte</h2><div class="card pad" style="padding-top:4px;padding-bottom:4px">
    ${items.map((t, i) => { const id = "leave-" + i; const done = !!state.ck[id]; return `<label class="ck${done ? " done" : ""}"><input type="checkbox" data-act="ck" data-id="${id}" ${done ? "checked" : ""}><span class="t">${esc(t)}</span></label>`; }).join("")}
  </div></div>`;
}
function todayAfter(c) {
  const all = PLACES.filter(p => p.cat !== "party");
  const n = all.filter(p => isDone(p.id)).length;
  const per = DAYS.map(d => dayProgress(d.id));
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1>Bilan</h1><p>${n} lieux cochés sur ${all.length}</p></div>${xxx({ voir: true, manger: true, sortir: true })}</div>
  <div class="sec"><div class="list">${DAYS.map((d, i) => `<button type="button" class="li" data-act="day" data-day="${d.id}">${icon("cal")}<span style="flex:1"><span class="nm">${d.label} · ${esc(d.theme)}</span></span><span class="pr num">${per[i].done}/${per[i].total}</span></button>`).join("")}</div>
  <div class="btns"><button type="button" class="btn primary" data-act="shareRecap">${icon("share")} Partager le récap</button></div></div>`;
}

// ───────────── Écran Programme ─────────────
function renderPlan() {
  const c = clock();
  const day = state.progDay || (c.phase === "day" ? c.day.id : "mar");
  const d = DAYBY[day];
  const others = PLACES.filter(p => (p.days || []).includes(day) && p.cat !== "party" && !(PLAN[day] || []).some(s => s.id === p.id));
  const pr = dayProgress(day);
  $("#s-plan").innerHTML = `<div class="status"><span class="grow">Programme</span></div>
  <div class="sec" style="padding-top:0"><div class="seg" role="group" aria-label="Jour">${DAYS.map(x => `<button type="button" data-act="day" data-day="${x.id}" aria-pressed="${x.id === day}">${x.label}</button>`).join("")}</div></div>
  <div class="sec"><h1 style="font-size:var(--fs-2xl);color:var(--brick)">${esc(d.theme)}</h1><p class="small muted" style="margin:4px 0 0">${esc(d.long)} · ${esc(d.sub)} · ${pr.done}/${pr.total} faits</p></div>
  <div class="sec"><div class="card pad">${timeline(day, { controls: true, lmin: c.phase === "day" && c.day.id === day ? c.lmin : null })}</div>
    <div class="btns"><button type="button" class="btn" data-act="mapDay" data-day="${day}">${icon("map")} Voir le parcours</button>
    <button type="button" class="btn" data-act="sharePlan" data-day="${day}">${icon("share")} Partager</button></div></div>
  <div class="sec"><h2>Soirées ce soir-là <span class="grow"></span><button type="button" class="btn sm ghost" data-act="partiesDay" data-day="${day}">Tout voir</button></h2>
    <div class="carousel">${PLACES.filter(p => p.cat === "party" && p.date === day).sort((a, b) => (a.price ?? 99) - (b.price ?? 99)).slice(0, 8).map(p => placeRow(p)).join("")}</div></div>
  <div class="sec"><h2>Aussi dans le coin (${others.length})</h2><div class="list">${others.map(p => placeRow(p, { dayId: day, lmin: 18 * 60 })).join("")}</div>
    <p class="xs muted" style="margin:6px 0 0">Les horaires affichés dans cette liste sont ceux de 18:00 ce jour-là.</p></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}

// ───────────── Écran Lieux ─────────────
const CHEAP = { bar: 3, food: 10, party: 10, visit: 10 };
function renderPlaces() {
  const c = clock();
  const cat = state.listCat;
  const dayId = c.phase === "day" ? c.day.id : null;
  const pday = cat === "party" ? (state.listDay || dayId || "mar") : null;
  let items = PLACES.filter(p => p.cat === cat);
  if (cat === "party") items = items.filter(p => pday === "all" ? true : p.date === pday || p.date === "all");
  const lf = state.lf;
  if (lf.todo) items = items.filter(p => !isDone(p.id));
  if (lf.cheap) items = items.filter(p => priceOn(p, dayId) != null && priceOn(p, dayId) <= CHEAP[cat]);
  if (lf.near) items = items.filter(p => (walkFrom(p) ?? 99) <= 15);
  if (lf.open && dayId) items = items.filter(p => { const k = hoursState(p, dayId, c.lmin).k; return k === "open" || k === "open?"; });
  const byPrice = (a, b) => (priceOn(a, dayId) ?? 99) - (priceOn(b, dayId) ?? 99) || (walkFrom(a) ?? 99) - (walkFrom(b) ?? 99);
  const byDist = (a, b) => (walkFrom(a) ?? 999) - (walkFrom(b) ?? 999);
  const byTime = (a, b) => (tmin(a.start) ?? 9999) - (tmin(b.start) ?? 9999);
  items.sort(state.listSort === "dist" ? byDist : state.listSort === "time" && cat === "party" ? byTime : byPrice);
  const notes = {
    bar: "Prix du plus petit verre de pression (20–25 cl), tel que publié, avec son année. Un prix de 2023 a sans doute pris 0,30 à 0,70 €.",
    food: "Prix du repas complet le moins cher ou du plat phare.",
    party: "Prix en prévente quand il existe. Les programmes peuvent bouger : revérifiez la veille.",
    visit: "Prix étudiant quand il existe (carte de l'UE).",
  };
  $("#s-places").innerHTML = `<div class="status"><span class="grow">Lieux</span></div>
  <div class="sec" style="padding-top:0"><div class="seg" role="group" aria-label="Catégorie">${Object.entries(CATS).map(([k, v]) => `<button type="button" data-act="cat" data-cat="${k}" aria-pressed="${k === cat}">${v.label}</button>`).join("")}</div></div>
  ${cat === "party" ? `<div class="sec" style="padding-top:10px"><div class="chips">${[...DAYS.map(d => [d.id, d.label]), ["all", "Tous"]].map(([k, l]) => `<button type="button" class="chip" data-act="lday" data-day="${k}" aria-pressed="${k === pday}">${l}</button>`).join("")}</div></div>` : ""}
  <div class="sec" style="padding-top:${cat === "party" ? 0 : 10}px"><div class="chips">
    ${dayId ? `<button type="button" class="chip" data-act="lf" data-f="open" aria-pressed="${lf.open}">Ouvert maintenant</button>` : ""}
    <button type="button" class="chip" data-act="lf" data-f="near" aria-pressed="${lf.near}">&lt; 15 min</button>
    <button type="button" class="chip" data-act="lf" data-f="cheap" aria-pressed="${lf.cheap}">Pas cher (≤ ${CHEAP[cat]} €)</button>
    <button type="button" class="chip" data-act="lf" data-f="todo" aria-pressed="${lf.todo}">À faire</button>
    <span style="width:8px;flex:none"></span>
    <button type="button" class="chip" data-act="sort" data-v="price" aria-pressed="${state.listSort === "price"}">Prix</button>
    <button type="button" class="chip" data-act="sort" data-v="dist" aria-pressed="${state.listSort === "dist"}">Distance</button>
    ${cat === "party" ? `<button type="button" class="chip" data-act="sort" data-v="time" aria-pressed="${state.listSort === "time"}">Heure</button>` : ""}
  </div></div>
  <div class="sec" style="padding-top:4px"><p class="xs muted" style="margin:0 0 8px">${notes[cat]} ${me ? "Distances depuis vous." : "Distances depuis l'auberge."}</p>
    <div class="list">${items.length ? items.map(p => placeRow(p, { dayId, lmin: c.lmin, showDay: pday === "all" })).join("") : `<p class="empty">Rien avec ces filtres. Enlevez-en un.</p>`}</div></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}

// ───────────── Écran Infos ─────────────
function renderInfo() {
  const c = clock();
  const done = CHECKLIST.filter(i => state.ck[i.id]).length;
  const tels = [
    ["Urgences (police, ambulance)", "112", "112"],
    ["Police hors urgence", "0900 8844", "+31343578844"],
    ["Médecin pour touristes", "+31 20 427 5011", "+31204275011"],
    ["Médecin de garde (soir, nuit)", "088 00 30 600", "+31880030600"],
    ["Consulat de France (lun.–ven.)", "+31 20 2499 164", "+31202499164"],
    ["Urgence consulaire grave", "+31 6 51 59 69 48", "+31651596948"],
  ];
  $("#s-info").innerHTML = `<div class="status"><span class="grow">Infos</span></div>
  <div class="sec" style="padding-top:0"><h2>Avant de partir <span class="grow"></span>${done}/${CHECKLIST.length}</h2>
    <div class="progress"><span style="width:${Math.round(done / CHECKLIST.length * 100)}%"></span></div>
    <div class="card pad" style="padding-top:4px;padding-bottom:4px">${CHECKLIST.map(i => ckRow(i, c.a.date)).join("")}</div></div>
  <div class="sec"><a class="btn primary" style="width:100%" href="${TRIP.guide}" target="_blank" rel="noopener" data-act="guideRead">${icon("doc")} Guide pratique complet</a></div>
  <div class="sec"><h2>Urgences</h2><div class="card pad" style="padding-top:2px;padding-bottom:2px">
    ${tels.map(([l, t, n]) => `<div class="tel"><span>${esc(l)}</span><a href="tel:${n}">${icon("phone", "i s")} ${esc(t)}</a></div>`).join("")}</div></div>
  <div class="sec"><h2>L'auberge</h2><div class="card pad small">
    <b>St Christopher's The Winston</b><br>Warmoesstraat 129, 1012 JA Amsterdam<br>Arrivée dès 15:00 · départ avant 11:00 · pièce d'identité obligatoire
    <div class="btns"><button type="button" class="btn" data-act="copyAddr">Copier l'adresse</button><button type="button" class="btn" data-act="open" data-id="base">Voir la fiche</button></div></div></div>
  <div class="sec"><h2>Transports</h2><div class="card pad small">
    Passez votre carte bancaire sans contact <b>en montant et en descendant</b>, toujours la même carte. Plafond GVB : 10,50 € par jour. Bus de nuit : 5,70 € (hors plafond). Ferries gratuits. Derniers trams vers 00:35–00:50.
    ${ferryBlock("centraal", "Prochains ferries depuis Centraal")}</div></div>
  <div class="sec"><h2>Réglages</h2><div class="card pad" style="padding-top:2px;padding-bottom:2px">
    <div class="setrow"><span>Thème</span><select data-set="theme"><option value="system">Système</option><option value="light">Clair</option><option value="dark">Sombre</option></select></div>
    <div class="setrow"><span>Taille du texte</span><select data-set="text"><option value="normal">Normale</option><option value="large">Grande</option></select></div>
    <div class="setrow"><span>Appli d'itinéraire</span><select data-set="nav"><option value="google">Google Maps</option><option value="apple">Plans (Apple)</option></select></div>
    <div class="setrow"><span>Rayon de coche GPS</span><select data-set="radius">${[25, 40, 60, 100].map(v => `<option value="${v}">${v} m</option>`).join("")}</select></div>
    <div class="setrow"><span>Temps sur place avant de cocher</span><select data-set="dwell">${[[0, "immédiat"], [60, "1 min"], [180, "3 min"], [300, "5 min"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div class="setrow"><span>Masquer les lieux faits sur la carte</span><input type="checkbox" data-set="hideDone" ${state.hideDone ? "checked" : ""} style="width:22px;height:22px"></div>
    <div class="setrow"><span>Mes coches</span><span><button type="button" class="btn sm" data-act="export">Exporter</button> <button type="button" class="btn sm" data-act="import">Importer</button></span></div>
    <div class="setrow"><span>Tout remettre à zéro</span><button type="button" class="btn sm" data-act="reset">Effacer</button></div>
  </div></div>
  <div class="sec"><h2>Données</h2><div class="card pad small">
    Données vérifiées le 15/10/2026 · version 2. Chaque prix et chaque soirée garde sa source et sa date.<br>
    <p style="margin:8px 0">${confBadge("sûr")} source officielle ou récente et précise<br>${confBadge("probable")} source ancienne ou indirecte<br>${confBadge("à vérifier")} sources en désaccord ou absentes</p>
    Carte © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · Météo <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0) · Ferries <a href="https://transitous.org/sources" target="_blank" rel="noopener">Transitous</a> · WC : Gemeente Amsterdam open data.<br>
    Code : <a href="https://github.com/Sowvard299/amsterdam_app" target="_blank" rel="noopener">github.com/Sowvard299/amsterdam_app</a>. Appli personnelle, non officielle.
  </div></div>`;
  for (const sel of $$("#s-info [data-set]")) if (sel.tagName === "SELECT") sel.value = String(state[sel.dataset.set]);
}

// ───────────── Carte ─────────────
let map = null, mapReady = false, markersLayer = null, essLayer = null, routeLayer = null, meMarker = null, meCircle = null, selMarker = null, follow = false;
function initMap() {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([BASE.lat, BASE.lon], 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  essLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  map.on("dragstart", () => { if (follow) { follow = false; updateLocBtn(); } });
  mapReady = true;
}
function mapFilterDay() {
  const c = clock();
  if (state.mapFilter === "today") return c.phase === "day" ? c.day.id : c.phase === "before" ? "mar" : null;
  if (state.mapFilter.startsWith("d:")) return state.mapFilter.slice(2);
  return null;
}
function drawMarkers() {
  if (!mapReady) return;
  markersLayer.clearLayers(); routeLayer.clearLayers(); essLayer.clearLayers();
  const day = mapFilterDay();
  const add = (p, opts = {}) => {
    const done = p.cat !== "base" && isDone(opts.key || p.id);
    const html = `<div class="pin${selMarker === p.id ? " sel" : ""}">${shapeSVG(p.cat, { done, num: opts.num })}</div>`;
    const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html, iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: true, title: p.name, zIndexOffset: p.cat === "base" ? 1000 : selMarker === p.id ? 2000 : 0 });
    m.on("click", () => placeSheet(p.id));
    m.addTo(markersLayer);
  };
  add({ ...BASEP, cat: "base" });
  if (day) {
    const steps = plan(day).filter(s => s.p.lat != null && s.id !== "base");
    const pts = [[BASE.lat, BASE.lon], ...steps.map(s => [s.p.lat, s.p.lon])];
    L.polyline(pts, { color: getComputedStyle(document.documentElement).getPropertyValue("--route").trim() || "#333", weight: 4, dashArray: "2 8", lineCap: "round" }).addTo(routeLayer);
    steps.forEach((s, i) => add(s.p, { num: i + 1, key: s.id }));
  } else {
    for (const p of PLACES) {
      if (p.lat == null || !state.layers[p.cat]) continue;
      if (p.cat === "party") { const c = clock(); if (c.phase === "day" && p.date !== c.day.id && p.date !== "all") continue; }
      if (state.mapFilter === "todo" && isDone(p.id)) continue;
      if (state.hideDone && isDone(p.id)) continue;
      add(p);
    }
  }
  for (const [k, v] of Object.entries(ESSDEF)) {
    if (!state.layers[k]) continue;
    for (const x of essList(k)) {
      const html = `<div class="pin-ess" style="width:24px;height:24px;border-radius:50%;background:var(--pin-ess);border:2px solid #fff;box-shadow:0 0 0 1.5px #1A1714;display:grid;place-items:center;color:#1A1714"><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><use href="#i-${v.icon}"/></svg></div>`;
      L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "", html, iconSize: [24, 24], iconAnchor: [12, 12] }), title: x.e[2] || v.one })
        .on("click", () => openEss(k)).addTo(essLayer);
    }
  }
}
function renderMapChrome() {
  const c = clock();
  const opts = [["today", "Aujourd'hui"], ["all", "Tout"], ["todo", "À faire"], ...DAYS.map(d => ["d:" + d.id, d.label])];
  $("#mapChips").innerHTML = opts.map(([v, l]) => `<button type="button" class="chip" data-act="mapf" data-v="${v}" aria-pressed="${state.mapFilter === v}">${l}</button>`).join("");
  const s = c.phase === "day" ? nextStep(c.day.id, c.lmin) : null;
  const ess = Object.entries(ESSDEF).map(([k, v]) => { const n = nearest(k, 1)[0]; return `<button type="button" class="chip" data-act="ess" data-type="${k}">${icon(v.icon, "i s")} ${n ? walkMin(n.d) + "′" : ""}</button>`; }).join("");
  $("#mapPeek").innerHTML = `<div class="handle"></div>
    ${s ? `<button type="button" class="li" style="min-height:56px;padding:8px 10px;box-shadow:none" data-act="open" data-id="${s.id}">${smallShape(s.p.cat === "base" ? "base" : s.p.cat)}<span style="flex:1;min-width:0"><span class="sub" style="margin:0">Ensuite · ${s.at}</span><span class="nm">${esc(s.id === "base" ? "Auberge" : s.p.name)}</span></span><span class="pr num">${walkFrom(s.p)} min</span></button>` : ""}
    <div class="chips" style="margin:8px 0 0;padding:0">${ess}</div>`;
  document.documentElement.style.setProperty("--peek", ($("#mapPeek").offsetHeight || 120) + "px");
}
function renderMap() {
  initMap();
  renderMapChrome();
  drawMarkers();
  setTimeout(() => map.invalidateSize(), 60);
  if (!state.mapSeen) { state.mapSeen = true; save(); }
}
function layersSheet() {
  const row = (k, l) => `<label class="setrow"><span>${l}</span><input type="checkbox" data-layer="${k}" ${state.layers[k] ? "checked" : ""} style="width:22px;height:22px"></label>`;
  openSheet(`<div style="flex:1"><h2 id="sheetTitle">Calques</h2></div>`,
    `${row("visit", "Visites")}${row("food", "Manger")}${row("bar", "Bars")}${row("party", "Soirées (du jour pendant le voyage)")}
     <div class="kv"><h4>Essentiels</h4></div>${row("wc", "Toilettes publiques")}${row("urinals", "Inclure les urinoirs (hommes)")}${row("atm", "Distributeurs")}${row("sm", "Supermarchés")}${row("ph", "Pharmacies")}
     <p class="xs muted">Les calques Visites à Soirées s'appliquent aux vues « Tout » et « À faire ».</p>`);
}

// ───────────── GPS ─────────────
let watchId = null, lastRender = 0;
const inside = {};
function updateLocBtn() {
  const b = $("#btnLocate");
  b.setAttribute("aria-pressed", String(watchId != null));
  b.innerHTML = icon(follow ? "follow" : "loc");
}
function startGps() {
  if (!("geolocation" in navigator)) { toast("Pas de GPS sur ce navigateur"); return; }
  if (!window.isSecureContext) { toast("Le GPS demande une adresse https://"); return; }
  if (watchId != null) return;
  watchId = navigator.geolocation.watchPosition(onPos, onPosErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
  state.gps = true; save(); updateLocBtn();
}
function stopGps() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null; follow = false; state.gps = false; save(); updateLocBtn();
}
function onPos(pos) {
  const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
  const first = !me;
  me = { lat, lon, acc };
  if (!state.gpsTested) { state.gpsTested = true; save(); }
  if (mapReady) {
    if (!meMarker) {
      meCircle = L.circle([lat, lon], { radius: acc, color: "#1F6FEB", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
      meMarker = L.marker([lat, lon], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, zIndexOffset: 3000 }).addTo(map);
    } else { meMarker.setLatLng([lat, lon]); meCircle.setLatLng([lat, lon]).setRadius(acc); }
    if (first || follow) map.setView([lat, lon], first ? 16 : map.getZoom());
  }
  if (acc <= 100) autoCheck(lat, lon, acc);
  if (Date.now() - lastRender > 15000) { lastRender = Date.now(); renderActive(); }
}
function onPosErr(e) {
  const msg = { 1: "Position refusée. Les distances partent de l'auberge. Réactivez la localisation pour ce site dans les réglages du navigateur.", 2: "Position introuvable pour l'instant.", 3: "Le GPS met du temps à répondre." }[e.code] || "GPS indisponible.";
  toast(msg);
  if (e.code === 1) stopGps();
}
function autoCheck(lat, lon, acc) {
  const c = clock();
  const t = Date.now();
  for (const p of PLACES) {
    if (p.lat == null || isDone(p.id)) continue;
    if (p.cat === "party" && !(c.phase === "day" && (p.date === c.day.id || p.date === "all"))) continue;
    const d = dist({ lat, lon }, p);
    if (d <= state.radius + Math.min(acc, 30)) {
      inside[p.id] = inside[p.id] || t;
      if (t - inside[p.id] >= state.dwell * 1000) {
        state.checked[p.id] = t; save();
        toast(`Visité : ${p.name}`, { undo: p.id });
        if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
        renderActive();
      }
    } else delete inside[p.id];
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (state.gps && watchId == null) startGps();
    loadWeather();
    renderActive();
  }
});

// ───────────── Accueil ─────────────
function onboard(step = 1) {
  const ob = $("#onboard");
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (step === 1) {
    ob.innerHTML = `<div class="ob"><svg viewBox="0 0 90 30" width="90" height="30" aria-hidden="true">${[0, 1, 2].map(i => `<path d="M${6 + i * 30} 4l18 22M${24 + i * 30} 4 ${6 + i * 30} 26" stroke="var(--flag)" stroke-width="5" stroke-linecap="round"/>`).join("")}</svg>
      <h1 id="obTitle">Votre voyage, prêt sans réseau</h1>
      <p>Le plan de chaque jour, les bars pas chers, les soirées, la carte et la coche automatique par GPS.</p>
      <p><b>Pour l'installer :</b></p>
      <ol>${ios ? "<li>Dans Safari, touchez Partager (le carré avec une flèche).</li><li>Choisissez « Sur l'écran d'accueil », puis Ajouter.</li>" : "<li>Touchez ⋮ en haut à droite de Chrome.</li><li>Choisissez « Installer l'application ».</li>"}</ol></div>
      <button type="button" class="btn primary" data-act="ob2">Continuer</button>`;
  } else {
    ob.innerHTML = `<div class="ob">${icon("loc")}<h1 id="obTitle">Cocher les lieux tout seul</h1>
      <p>Quand vous restez 1 minute à moins de 40 m d'un lieu, l'appli le coche. Votre position reste sur ce téléphone : rien n'est envoyé.</p>
      <p class="small muted">Le téléphone va demander l'autorisation. Le suivi ne marche que quand l'appli est ouverte.</p></div>
      <button type="button" class="btn primary" data-act="obGps">Activer le GPS</button>
      <button type="button" class="btn" style="margin-top:8px" data-act="obDone">Plus tard</button>`;
  }
  ob.classList.add("on");
  setTimeout(() => { const b = ob.querySelector("button"); if (b) b.focus(); }, 30);
}

// ───────────── Toast ─────────────
let toastT = null;
function toast(msg, { undo = null, action = null } = {}) {
  const t = $("#toast");
  t.innerHTML = esc(msg) + (undo ? `<button type="button" data-act="undo" data-id="${undo}">Annuler</button>` : "") + (action ? `<button type="button" data-act="${action.act}">${esc(action.label)}</button>` : "");
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), action ? 9000 : 4000);
}

// ───────────── Navigation ─────────────
function activeScreen() { const s = $(".screen.active"); return s ? s.id : "s-today"; }
function show(id) {
  for (const s of $$(".screen")) s.classList.toggle("active", s.id === id);
  for (const b of $$("nav.tabs button")) b.setAttribute("aria-selected", String(b.dataset.s === id));
  renderScreen(id);
  if (id !== "s-map") $("#" + id).scrollTop = 0;
}
function renderScreen(id) {
  if (id === "s-today") renderToday();
  else if (id === "s-map") renderMap();
  else if (id === "s-places") renderPlaces();
  else if (id === "s-plan") renderPlan();
  else if (id === "s-info") renderInfo();
}
function renderActive() {
  const id = activeScreen();
  const el = $("#" + id);
  const y = el.scrollTop;
  renderScreen(id);
  if (id !== "s-map") el.scrollTop = y;
  updateBadge();
}
function updateBadge() {
  const today = ams().date;
  const late = CHECKLIST.filter(i => !state.ck[i.id] && i.due < today).length;
  const b = $("#infoBadge");
  b.hidden = !late || clock().phase !== "before";
  b.textContent = late;
}
$$("nav.tabs button").forEach(b => b.addEventListener("click", () => show(b.dataset.s)));

// ───────────── Actions (délégation) ─────────────
function toggleDone(id, val) {
  const on = val ?? !isDone(id);
  if (on) state.checked[id] = Date.now(); else delete state.checked[id];
  save();
  if (on && navigator.vibrate) navigator.vibrate(10);
}
const copy = txt => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject(new Error("no clipboard")));
async function share(text, url) {
  try { if (navigator.share) { await navigator.share({ title: "Amsterdam", text, url }); return; } } catch (e) { return; }
  try { await copy(text + (url ? " " + url : "")); toast("Copié dans le presse-papiers"); } catch (e) { toast("Partage indisponible"); }
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case "open": placeSheet(id); break;
    case "closeSheet": closeSheet(); break;
    case "tab": closeSheet(); show(el.dataset.s); break;
    case "day": state.progDay = el.dataset.day; save(); closeSheet(); show("s-plan"); break;
    case "stepDone": {
      const day = el.dataset.day, s = (PLAN[day] || []).find(x => x.id === id);
      toggleDone(stepKey(s, day)); renderActive(); break;
    }
    case "stepSkip": {
      const k = el.dataset.day + ":" + id;
      if (state.skipped[k]) delete state.skipped[k]; else state.skipped[k] = true;
      save(); renderActive(); break;
    }
    case "undo": delete state.checked[id]; save(); $("#toast").classList.remove("on"); renderActive(); break;
    case "share": { const p = BYID[id]; share(`${p.name} — ${p.why || ""}`, navUrl(p)); break; }
    case "sharePlan": {
      const day = el.dataset.day;
      share(`${DAYBY[day].long} : ` + plan(day).map(s => `${s.at} ${s.id === "base" ? "auberge" : s.p.name}`).join(" → "), location.origin + location.pathname);
      break;
    }
    case "shareRecap": {
      const n = PLACES.filter(p => isDone(p.id)).length;
      share(`Amsterdam du 27 au 30 octobre : ${n} lieux cochés.`, "");
      break;
    }
    case "cat": state.listCat = el.dataset.cat; if (state.listSort === "time" && state.listCat !== "party") state.listSort = "price"; save(); renderPlaces(); break;
    case "lday": state.listDay = el.dataset.day; save(); renderPlaces(); break;
    case "lf": state.lf[el.dataset.f] = !state.lf[el.dataset.f]; save(); renderPlaces(); break;
    case "sort": state.listSort = el.dataset.v; save(); renderPlaces(); break;
    case "partiesDay": state.listCat = "party"; state.listDay = el.dataset.day; state.listSort = "time"; save(); closeSheet(); show("s-places"); break;
    case "mapf": state.mapFilter = el.dataset.v; save(); renderMapChrome(); drawMarkers(); fitFilter(); break;
    case "mapDay": state.mapFilter = "d:" + el.dataset.day; save(); show("s-map"); fitFilter(); break;
    case "ess": openEss(el.dataset.type); break;
    case "showEss": state.layers[el.dataset.type] = true; save(); closeSheet(); show("s-map"); {
      const n = nearest(el.dataset.type, 3); if (n.length) map.fitBounds(L.latLngBounds([[from().lat, from().lon], ...n.map(x => [x.lat, x.lon])]).pad(0.3));
    } break;
    case "hourly": { const h = $("#hourly"); if (h) { h.hidden = !h.hidden; if (!h.hidden) h.innerHTML = hourlyHTML(); } break; }
    case "gpsTest": closeSheet(); onboard(2); break;
    case "onboard": onboard(1); break;
    case "ob2": onboard(2); break;
    case "obGps": state.onboarded = true; save(); $("#onboard").classList.remove("on"); startGps(); show("s-map"); break;
    case "obDone": state.onboarded = true; save(); $("#onboard").classList.remove("on"); renderActive(); break;
    case "guideRead": state.ck.guide = true; save(); setTimeout(renderActive, 300); break;
    case "copyAddr": copy("Warmoesstraat 129, 1012 JA Amsterdam").then(() => toast("Adresse copiée"), () => toast("Copie impossible")); break;
    case "export": {
      const data = JSON.stringify({ checked: state.checked, skipped: state.skipped, ck: state.ck, notes: state.notes });
      copy(data).then(() => toast("Coches copiées : collez-les sur l'autre téléphone"), () => toast("Copie impossible"));
      break;
    }
    case "import": {
      const txt = prompt("Collez ici les coches exportées depuis un autre téléphone :");
      if (!txt) break;
      try { const d = JSON.parse(txt); for (const k of ["checked", "skipped", "ck", "notes"]) Object.assign(state[k], d[k] || {}); save(); renderActive(); toast("Coches importées"); }
      catch (err) { toast("Texte illisible"); }
      break;
    }
    case "reset": if (confirm("Effacer toutes les coches, notes et réglages de ce téléphone ?")) { const wx = state.wx; state = JSON.parse(JSON.stringify(DEF)); state.wx = wx; state.onboarded = true; save(); applyTheme(); renderActive(); } break;
    case "reload": location.reload(); break;
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.act === "toggleDone") { toggleDone(el.dataset.id, el.checked); drawMarkers(); renderActive(); return; }
  if (el.dataset.act === "ck") { if (el.checked) state.ck[el.dataset.id] = true; else delete state.ck[el.dataset.id]; save(); setTimeout(renderActive, 150); return; }
  if (el.dataset.layer) { state.layers[el.dataset.layer] = el.checked; save(); drawMarkers(); return; }
  if (el.dataset.set) {
    const k = el.dataset.set;
    state[k] = el.type === "checkbox" ? el.checked : ["radius", "dwell"].includes(k) ? +el.value : el.value;
    save(); applyTheme(); if (k === "hideDone") drawMarkers();
  }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.note) { state.notes[el.dataset.note] = el.value; save(); }
});
function fitFilter() {
  if (!mapReady) return;
  const day = mapFilterDay();
  setTimeout(() => {
    map.invalidateSize();
    if (day) {
      const pts = [[BASE.lat, BASE.lon], ...plan(day).filter(s => s.p.lat != null).map(s => [s.p.lat, s.p.lon])];
      map.fitBounds(L.latLngBounds(pts).pad(0.15), { paddingBottomRight: [0, 120] });
    }
  }, 80);
}
$("#btnZoomIn").addEventListener("click", () => map && map.zoomIn());
$("#btnZoomOut").addEventListener("click", () => map && map.zoomOut());
$("#btnLayers").addEventListener("click", layersSheet);
$("#btnLocate").addEventListener("click", () => {
  if (watchId == null) { if (!state.onboarded || !state.gpsTested) onboard(2); else startGps(); return; }
  if (me) { follow = !follow; map.setView([me.lat, me.lon], Math.max(map.getZoom(), 16)); }
  updateLocBtn();
});

// ───────────── Réseau et service worker ─────────────
function netState() { document.body.classList.toggle("is-offline", !navigator.onLine); }
window.addEventListener("online", () => { netState(); loadWeather(true); });
window.addEventListener("offline", netState);
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w && w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) toast("Nouvelle version des données", { action: { act: "reload", label: "Recharger" } });
        else if (w.state === "activated" && !navigator.serviceWorker.controller) toast("Prête hors ligne");
      });
    });
  }).catch(() => {});
}

// ───────────── Démarrage ─────────────
applyTheme();
netState();
show("s-today");
updateBadge();
loadWeather();
if (state.gps) startGps();
if (!state.onboarded && !FAKE_NOW) onboard(1);
setInterval(() => { if (document.visibilityState === "visible" && !sheetOpen) renderActive(); }, 60000);
