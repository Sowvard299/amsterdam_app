"use strict";
/* Ams · 27→30 — appli de voyage. Données : data.js (lieux, plan) et ess.js (essentiels figés). */

// ───────────── Outils ─────────────
const TZ = "Europe/Amsterdam";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MS = { sun: "sunny", moon: "bedtime", map: "map", list: "format_list_bulleted", cal: "calendar_month", info: "info", beer: "sports_bar", fork: "restaurant",
  music: "nightlife", cols: "museum", wc: "wc", euro: "local_atm", cart: "shopping_cart", plus: "local_pharmacy", loc: "my_location", follow: "navigation",
  layers: "layers", close: "close", check: "check", share: "share", walk: "directions_walk", go: "directions", rain: "rainy", cloud: "cloud",
  pcloud: "partly_cloudy_day", fog: "foggy", storm: "thunderstorm", snow: "weather_snowy", clock: "schedule", ticket: "confirmation_number",
  alert: "warning", chev: "chevron_right", home: "home", ferry: "directions_boat", phone: "call", doc: "description", up: "keyboard_arrow_up",
  down: "keyboard_arrow_down", skip: "skip_next", sunset: "wb_twilight", bike: "directions_bike", tram: "tram", subway: "subway", bus: "directions_bus",
  train: "train", copy: "content_copy", ext: "open_in_new", note: "edit_note", sure: "verified", maybe: "history", unsure: "help",
  thumb: "thumb_up", fuel: "local_gas_station", bed: "bed", law: "gavel", shield: "shield", kit: "backpack", lang: "translate",
  spark: "auto_awesome", story: "auto_stories" };
const icon = (n, cls = "i") => `<span class="ms${cls.replace(/^i\b/, "")}" aria-hidden="true">${MS[n] || n}</span>`;
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
const dmy = iso => iso.split("-").reverse().join("/"); // 2026-10-17 → 17/10/2026
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
  if (a.date === TRIP.leave && a.min >= 5 * 60 && a.min < 18 * 60) phase = "leave"; // la nuit de vendredi (N91 03:45, Garage Noord) reste vendredi
  else if (logical < DAYS[0].date) phase = "before";
  else if (idx >= 0) phase = "day";
  else if (logical === TRIP.leave && a.min < 18 * 60) phase = "leave";
  return { a, logical, lmin, idx, phase, day: phase === "day" ? DAYS[idx] : null };
}
// « 23:30 » → minutes du jour logique ; avant 06:00 on ajoute 24 h
function tmin(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); if (!m) return null; let v = +m[1] * 60 + +m[2]; if (v < 360) v += 1440; return v; }
const durTxt = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);
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
  curio: { label: "Insolite", one: "À voir en passant", glyph: "spark" },
};
const DAYBY = Object.fromEntries(DAYS.map(d => [d.id, d]));

// ───────────── État (par téléphone) ─────────────
const KEY = "ams-v2";
const DEF = {
  checked: {}, skipped: {}, ck: {}, notes: {}, theme: "system", text: "normal", nav: "google", radius: 40, dwell: 60,
  gps: false, gpsTested: false, mapSeen: false, onboarded: false, hideDone: false, leaveTime: "",
  layers: { visit: true, food: true, bar: true, party: true, curio: true, wc: false, atm: false, sm: false, ph: false, urinals: false },
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
  for (const m of $$('meta[name="theme-color"]')) { if (!m.dataset.media) m.dataset.media = m.media; m.media = state.theme === "system" ? m.dataset.media : (m.content === "#000000") === (state.theme === "dark") ? "all" : "not all"; }
  if (typeof drawMarkers === "function" && mapReady) drawMarkers(true); // la couleur du parcours vient du thème
}

// ───────────── Géographie ─────────────
let me = null; // {lat, lon, acc}
// En stop ou à Bruxelles, la position ne sert pas aux temps de marche (sinon « 3041 min depuis vous »)
const meNear = () => (me && dist(me, BASE) < 15000 ? me : null);
const from = () => meNear() || BASE;
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
    if (e == null) return lmin < s + 180 ? { k: "open", txt: "en cours (fin non affichée)" } : { k: "closed", txt: "sans doute terminé" };
    if (lmin < e) return { k: "open", txt: "jusqu'à " + fmtMin(e), until: e };
    return { k: "closed", txt: "terminé" };
  }
  if (p.cat === "curio" && !p.h) return p.when ? { k: "unknown", txt: p.when } : { k: "open", txt: "visible de la rue" };
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
const confBadge = c => !c ? "" : c === "sûr" ? `<span class="conf s" title="source récente et précise">${icon("sure")}sûr</span>`
  : c === "probable" ? `<span class="conf p" title="source ancienne ou indirecte">${icon("maybe")}probable</span>` : `<span class="conf v" title="sources en désaccord ou absentes">${icon("unsure")}à vérifier</span>`;
const SHAPES = {
  visit: '<path d="M3 12 14 2l11 10v13H3Z"/>',
  food: '<circle cx="14" cy="14" r="12"/>',
  bar: '<rect x="2" y="2" width="24" height="24" rx="5"/>',
  party: '<path d="M14 1.5 26.5 14 14 26.5 1.5 14Z"/>',
  base: '<path d="M1 13 14 1l13 12v14H1Z"/>',
};
const PIN_PATH = "M16 41C14.6 34.6 1 27.4 1 16a15 15 0 0 1 30 0c0 11.4-13.6 18.6-15 25Z";
const glyphOf = (cat, done) => (cat === "base" ? "home" : done ? "check" : MS[CATS[cat].glyph]);
function pinHTML(cat, { done = false, num = null, sel = false } = {}) {
  if (cat === "base") return `<div class="pin pin-base${sel ? " sel" : ""}"><span class="ms">home</span></div>`;
  const g = num != null ? `<b class="pin-n">${num}</b>` : `<span class="ms">${glyphOf(cat, done)}</span>`;
  return `<div class="pin${done ? " done" : ""}${sel ? " sel" : ""}" data-cat="${cat}"><svg viewBox="0 0 32 42" aria-hidden="true"><path d="${PIN_PATH}"/></svg>${g}</div>`;
}
const smallShape = (cat, done) => `<span class="shape${done ? " done" : ""}" data-cat="${cat}" aria-hidden="true"><span class="ms">${glyphOf(cat, done)}</span></span>`;

// ───────────── Plan ─────────────
const stepKey = (s, day) => (s.id === "base" ? "base-" + day : s.id);
const isDone = k => !!state.checked[k];
const isSkipped = (day, s) => state.skipped[day + ":" + s.id] === true;
function plan(day) { return (PLAN[day] || []).map(s => ({ ...s, p: BYID[s.id], t: tmin(s.at) })); }
// Une étape dont l'heure est largement dépassée est considérée comme manquée (sauf si on la coche)
// ou dont le lieu sera fermé à l'arrivée
function missed(s, lmin, day) {
  if (lmin == null || state.skipped[day + ":" + s.id] === false) return false; // remise à la main
  if (lmin > s.t + (s.dur || 60) + 15) return true;
  if (s.p.cat === "base" || lmin < s.t - 60) return false;
  return hoursState(s.p, day, lmin + walkMin(dist(originFor(day, s, lmin).o, s.p))).k === "closed";
}
// D'où part-on vers une étape : votre position, sinon l'étape précédente (faite ou dont l'heure est passée), sinon l'auberge
function originFor(day, s, lmin) {
  if (meNear()) return { o: me, label: "depuis vous" };
  const steps = plan(day), i = steps.findIndex(x => x.id === s.id);
  for (let j = i - 1; j >= 0; j--) {
    const q = steps[j];
    if (q.p.lat != null && (isDone(stepKey(q, day)) || (lmin != null && lmin >= q.t))) return { o: q.p, label: q.id === "base" ? "depuis l'auberge" : "depuis " + q.p.name };
  }
  return { o: BASE, label: "depuis l'auberge" };
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
  const r = await fetchTimeout(`https://api.transitous.org/api/v1/stoptimes?stopId=${FERRY[key]}&n=30&mode=FERRY`);
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
      const per = {};
      const rows = l.filter(x => (per[x.line] = (per[x.line] || 0) + 1) <= 3);
      el.innerHTML = rows.length ? rows.map(x => `<div class="tel"><span><b>${esc(x.line)}</b> → ${esc(x.to)}</span><span class="num">${hhmm(x.t)}</span></div>`).join("")
        : `<p class="small muted">Aucun départ trouvé.</p>`;
    } catch (e) { el.innerHTML = `<p class="small muted">Horaires indisponibles. F3 tourne jour et nuit, toutes les 4 à 12 min.</p>`; }
  }, 0);
  return `<div class="kv"><h4>${esc(title)}</h4><div id="${id}"><p class="small muted">Chargement…</p></div>
    <p class="xs muted">Horaires prévus GVB via <a href="https://transitous.org/sources" target="_blank" rel="noopener">Transitous</a>, pas de temps réel pour les ferries.</p></div>`;
}

// ───────────── Essentiels ─────────────
const ESSDEF = {
  wc: { label: "WC", icon: "wc", one: "Toilettes" },
  atm: { label: "DAB", icon: "euro", one: "Distributeur" },
  sm: { label: "Super", icon: "cart", one: "Supermarché" },
  ph: { label: "Pharma", icon: "plus", one: "Pharmacie" },
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
  openSheet(`<div style="flex:1"><h2 id="sheetTitle">${v.one} les plus proches</h2><p class="small muted" style="margin:4px 0 0">${meNear() ? "depuis votre position" : me ? "depuis l'auberge (vous êtes loin d'Amsterdam)" : "depuis l'auberge (GPS coupé)"}</p></div>`,
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
  if (sh.contains(document.activeElement)) document.activeElement.blur();
  const back = lastFocus && lastFocus.isConnected ? lastFocus
    : lastFocus && lastFocus.dataset && lastFocus.dataset.id ? document.querySelector(`.screen.active [data-act="open"][data-id="${CSS.escape(lastFocus.dataset.id)}"]`) : null;
  if (back && back.focus) back.focus({ preventScroll: true });
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetOpen) closeSheet(); });
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

// Histoire courte d'un lieu (sources propres) et curiosités « en chemin » d'une étape
function storyBody(st) {
  const src = (st.src || []).map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join(" · ");
  return `<p>${esc(st.txt)}</p>${st.fun ? `<p class="fun">${icon("spark", "i s")}<span>${esc(st.fun)}</span></p>` : ""}
    <p class="xs muted ssrc">${st.conf === "probable" ? "Sources concordantes mais non officielles · " : ""}${src}</p>`;
}
const storyHTML = st => (st ? `<div class="kv story-kv"><h4>L'histoire</h4>${storyBody(st)}</div>` : "");
function enChips(s, { lead = "En chemin" } = {}) {
  const list = (s.en || []).map(e => BYID[e]).filter(Boolean);
  if (!list.length) return "";
  return `<div class="en"><span class="lead">${icon("spark", "i s")}${lead}</span>${list.map(q => `<button type="button" class="enc${isDone(q.id) ? " done" : ""}" data-act="open" data-id="${q.id}" data-cat="${q.cat}"><span>${esc(q.name)}</span></button>`).join("")}</div>`;
}
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
  for (const d of DAYS) for (const s of PLAN[d.id] || []) {
    if (s.id === id) planned.push(`${d.label} · ${s.at}${s.note ? " — " + esc(s.note) : ""}`);
    if ((s.en || []).includes(id)) planned.push(`${d.label} · en chemin vers ${esc(BYID[s.id].name)} (${s.at})`);
  }
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
  if (p.soldOut) know.push(`<b>Complet</b> au ${esc(p.ver || "15 oct.")}`);
  const src = (p.src || []).map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)} <span class="muted">(${esc(s.d)})</span></a>`).join("");
  const dist0 = p.lat != null ? dist(from(), p) : null;
  const content = `
    <div class="btns lg" style="margin-top:0">
      <a class="btn primary" href="${navUrl(p)}" target="_blank" rel="noopener">${icon("go")} Y aller</a>
      ${p.cat !== "base" ? `<label class="switch"><input type="checkbox" switch data-act="toggleDone" data-id="${id}" ${done ? "checked" : ""}> Fait</label>` : ""}
      <button type="button" class="btn icon" data-act="share" data-id="${id}" aria-label="Partager">${icon("share")}</button>
    </div>
    ${p.url ? `<div class="btns"><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${icon("ticket")} Billets et programme</a></div>` : ""}
    ${p.book && p.book.url ? `<div class="btns"><a class="btn" href="${esc(p.book.url)}" target="_blank" rel="noopener">${icon("ticket")} Réserver</a></div>` : ""}
    <p class="small muted" style="margin:10px 0 0">${icon("walk", "i s")} ${dist0 != null ? `${walkMin(dist0)} min · ${kmTxt(dist0)} ${meNear() ? "depuis vous" : "depuis l'auberge"}` : "adresse sur le billet"} · ${esc(p.addr || "")}</p>
    ${st ? `<p style="margin:8px 0 0">${stateTag(st)}</p>` : ""}
    ${p.why ? `<div class="kv"><h4>Pourquoi</h4><p>${esc(p.why)}</p></div>` : ""}
    ${storyHTML(p.story)}
    ${p.priceTxt ? `<div class="kv"><h4>Prix</h4><p>${esc(p.priceTxt)}</p></div>` : ""}
    ${know.length ? `<div class="kv"><h4>Bon à savoir</h4><p>${know.join("<br>")}</p></div>` : ""}
    ${hours ? `<div class="kv"><h4>Horaires</h4>${hours}</div>` : ""}
    ${p.id === "v-ferry" ? ferryBlock("centraal", "Prochains ferries depuis Centraal") : ""}
    ${p.id === "v-ndsm" ? ferryBlock("ndsm", "Prochains ferries depuis NDSM") : ""}
    ${p.id === "v-eye" || p.id === "v-lookout" ? ferryBlock("buiksloterweg", "Prochains ferries depuis Buiksloterweg") : ""}
    ${planned.length ? `<div class="kv"><h4>Prévu</h4><p>${planned.join("<br>")}</p></div>` : ""}
    ${p.cat !== "base" ? `<div class="kv"><h4>Fiabilité</h4><p>${confBadge(p.conf)} <span class="xs muted">vérifié le ${esc(p.ver || "15 oct.")}</span></p><div class="srcs">${src}</div></div>` : ""}
    ${p.cat !== "base" ? `<div class="kv"><h4>Mes notes</h4><textarea data-note="${id}" placeholder="Visible seulement sur ce téléphone">${esc(state.notes[id] || "")}</textarea></div>` : ""}`;
  openSheet(head, content);
  if (mapReady && p.lat != null && $("#s-map").classList.contains("active")) {
    selMarker = id; drawMarkers();
    const sheetTop = innerHeight * 0.38, mapTop = $("#map").getBoundingClientRect().top;
    const pt = map.latLngToContainerPoint([p.lat, p.lon]);
    map.panBy([pt.x - map.getSize().x / 2, pt.y - (sheetTop - mapTop) / 2], { animate: true });
  }
}

// ───────────── Composants de liste ─────────────
function placeRow(p, { dayId = null, lmin = 0, showDay = false } = {}) {
  const w = walkFrom(p);
  const st = dayId ? hoursState(p, dayId, lmin) : null;
  const done = isDone(p.id);
  const subs = [];
  if (w) subs.push(`<span>${w} min</span>`);
  if (p.cat === "party") subs.push(`<span>${DAYBY[p.date] && (showDay || p.date !== dayId) ? DAYBY[p.date].label + " · " : ""}${esc(p.start)}</span>`);
  if (st && p.cat !== "party") subs.push(stateTag(st));
  if (p.cat === "party") subs.push(`<span>${esc(p.venue)}</span>`);
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

// ───────────── Transports du jour ─────────────
const MODE = { walk: ["walk", "À pied"], tram: ["tram", "Tram"], ferry: ["ferry", "Ferry"], bus: ["bus", "Bus de nuit"], bike: ["bike", "Vélo"] };
const modeChips = m => m.modes.map(k => `<span class="mode">${icon(MODE[k][0], "i s")}${MODE[k][1]}</span>`).join("");
function moveCard(d, { home = true } = {}) {
  const m = d.move;
  if (!m) return "";
  return `<div class="card pad move"><div class="mhead">${modeChips(m)}<span class="grow"></span><span class="num kmc">${String(m.km).replace(".", ",")} km · ${esc(m.cost)}</span></div>
    <p>${esc(m.txt)}</p>${home ? `<p class="ret">${icon(m.home.m === "bus" ? "bus" : "home", "i s")}<span><b>Retour de nuit :</b> ${esc(m.home.t)}</span></p>` : ""}</div>`;
}
function timeline(day, { lmin = null, controls = false } = {}) {
  const steps = plan(day);
  const sun = tmin(SUN[day][1]);
  const nx = nextStep(day, lmin);
  let html = `<ol class="tl">`, sunDone = false, prev = BASE;
  for (const s of steps) {
    if (!sunDone && s.t > sun) {
      html += `<li class="sun"><span class="time num">${SUN[day][1]}</span><span class="rail"><span class="dot"></span></span><div class="body">${icon("sunset", "i s")} coucher du soleil</div></li>`;
      sunDone = true;
    }
    const k = stepKey(s, day), done = isDone(k), skipped = isSkipped(day, s) || (!done && missed(s, lmin, day));
    const w = prev && s.p.lat != null ? walkMin(dist(prev, s.p)) : null;
    const cls = [done ? "done" : "", skipped ? "skipped" : "", nx && nx.id === s.id && lmin != null ? "isnext" : ""].join(" ");
    html += `<li class="${cls}"><span class="time num">${s.at}</span><span class="rail"><span class="dot"></span></span><div class="body">
      ${s.via ? `<div class="walk">${icon(s.vm || "ferry", "i s")} ${esc(s.via)}</div>` : w && prev !== BASE ? `<div class="walk">${icon("walk", "i s")} ${w} min à pied${s.alt ? ` · ${esc(s.alt)}` : ""}</div>` : ""}
      ${enChips(s)}
      <button type="button" class="item" data-act="open" data-id="${s.id}">${smallShape(s.p.cat === "base" ? "base" : s.p.cat, done)}
        <span class="nm">${esc(s.id === "base" ? "Auberge : déposer les sacs" : s.p.name)}</span>
        <span class="num small" style="font-weight:700">${s.p.price != null ? euro(s.p.price) : ""}</span></button>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
      ${controls ? `<div class="tlctl"><button type="button" class="btn sm ghost" data-act="stepDone" data-day="${day}" data-id="${s.id}">${done ? "Annuler" : "Fait"}</button>
        <button type="button" class="btn sm ghost" data-act="stepSkip" data-day="${day}" data-id="${s.id}">${skipped ? "Remettre" : "Passer"}</button></div>` : ""}
      </div></li>`;
    if (s.p.lat != null) prev = s.p;
  }
  if (!sunDone) html += `<li class="sun"><span class="time num">${SUN[day][1]}</span><span class="rail"><span class="dot"></span></span><div class="body">${icon("sunset", "i s")} coucher du soleil</div></li>`;
  const mv = DAYBY[day].move;
  if (mv) html += `<li class="ret"><span class="time num">fin</span><span class="rail"><span class="dot"></span></span><div class="body">${icon(mv.home.m === "bus" ? "bus" : "home", "i s")}<span><b>Retour :</b> ${esc(mv.home.t)}</span></div></li>`;
  return html + "</ol>";
}

// ───────────── Stop : Paris → Bruxelles → Rotterdam → Amsterdam, retour Amsterdam → Paris ─────────────
const HLEGS = typeof HITCH !== "undefined" ? HITCH.legs : [];
const HLEG = Object.fromEntries(HLEGS.map(l => [l.id, l]));
const gmDir = (s, mode = "transit") => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=${mode}`;
const signs = list => `<div class="signs">${list.map(t => `<span class="signc">${esc(t)}</span>`).join("")}</div>`;
const hitchRow = l => `<button type="button" class="li" data-act="hitch" data-id="${l.id}">${icon("thumb")}<span style="flex:1;min-width:0"><span class="nm">${esc(l.label)} · ${esc(l.from)} → ${esc(l.to)}</span><span class="sub">${l.km} km · ${esc(l.duration)}</span></span>${icon("chev", "i s")}</button>`;
function hitchCard(l, { next = null } = {}) {
  const a = l.spots[0];
  return `<div class="card pad next hitch">
    <div class="when">${icon("thumb", "i s")}En stop · ${esc(l.from)} → ${esc(l.to)} · ${l.km} km</div>
    <h3>${esc(a.name)}</h3>
    <p class="why">${esc(a.access)}</p>
    <div class="meta row">${icon("clock", "i s")}<span class="grow">Départ conseillé ${esc(l.startBy)} · ${esc(a.wait)}</span>${confBadge(a.conf)}</div>
    ${signs(l.sign)}
    ${hitchWx(l)}
    <div class="alert warn">${icon("alert", "i s")}<span>Plan B : ${esc(l.noGo)}</span></div>
    <div class="btns lg"><a class="btn primary" href="${gmDir(a)}" target="_blank" rel="noopener">${icon("go")} Y aller</a>
      <button type="button" class="btn" data-act="hitch" data-id="${l.id}">${icon("info")} Détails</button>
      <button type="button" class="btn icon" data-act="sharePos" data-id="${l.id}" aria-label="Envoyer notre position">${icon("loc")}</button></div>
    ${next ? `<p class="small" style="margin:12px 0 0"><button type="button" class="btn sm ghost" data-act="hitch" data-id="${next.id}">Ensuite : ${esc(next.from)} → ${esc(next.to)}</button></p>` : ""}
  </div>`;
}
function hitchSection(title, legs) {
  if (!HLEGS.length) return "";
  return `<div class="sec"><h2>${esc(title)} <span class="grow"></span><button type="button" class="btn sm ghost" data-act="hitchRules">${icon("law", "i s")} Règles</button></h2>
    <div class="list">${legs.map(hitchRow).join("")}</div></div>`;
}
// Mardi 27 : carte du trajet tant que les sacs ne sont pas posés à l'auberge (GPS si disponible, sinon l'heure)
function hitchTuesday(c) {
  if (!HLEGS.length || c.day.id !== "mar" || c.lmin >= 20 * 60) return "";
  const b = plan("mar").find(st => st.id === "base");
  if (b && isDone(stepKey(b, "mar"))) return "";
  if (me && dist(me, BASE) < 3000) return "";
  const first = me ? me.lat < 51.75 : c.lmin < 12 * 60 + 30;
  const l = first ? HLEG.h2 : HLEG.h3;
  return `<div class="sec">${hitchCard(l, { next: first ? HLEG.h3 : null })}</div>`;
}
// Météo du jour du trajet : prévision Open-Meteo (CC BY 4.0) au départ et à l'arrivée, gardée hors ligne
const HWX_AT = { Paris: [48.86, 2.35], Bruxelles: [50.85, 4.35], Rotterdam: [51.92, 4.48], Amsterdam: [52.37, 4.9] };
const hwxBusy = {};
function hitchWx(l) {
  const c = (state.hwx || {})[l.id];
  const days = daysBetween(ams().date, l.date);
  if (days >= 0 && days <= 15 && navigator.onLine !== false && !hwxBusy[l.id] && (!c || Date.now() - c.ts > 3 * 3600e3)) {
    hwxBusy[l.id] = true;
    const pts = [l.from, l.to].map(n => HWX_AT[n]).filter(Boolean);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pts.map(x => x[0]).join(",")}&longitude=${pts.map(x => x[1]).join(",")}`
      + `&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FParis&start_date=${l.date}&end_date=${l.date}`)
      .then(r => r.json()).then(d => {
        const arr = Array.isArray(d) ? d : [d];
        const txt = arr.map((x, i) => { const y = x.daily; return `${[l.from, l.to][i]} : ${wmo(y.weather_code[0])[1]}, ${Math.round(y.temperature_2m_min[0])}–${Math.round(y.temperature_2m_max[0])} °C, pluie ${y.precipitation_probability_max[0]} %, vent ${Math.round(y.wind_speed_10m_max[0])} km/h`; }).join(" · ");
        state.hwx = { ...(state.hwx || {}), [l.id]: { ts: Date.now(), txt } }; save();
        document.querySelectorAll(`[data-hwx="${l.id}"]`).forEach(el => { el.outerHTML = hwxLine(l.id); });
      }).catch(() => {}).finally(() => { hwxBusy[l.id] = false; });
  }
  return hwxLine(l.id);
}
const hwxLine = id => { const c = (state.hwx || {})[id]; return `<p class="small hwx" data-hwx="${id}">${c ? `${icon("cloud", "i s")}<span>${esc(c.txt)} <span class="muted">(prévision du ${hhmm(new Date(c.ts))}${daysBetween(ams(new Date(c.ts)).date, ams().date) ? " " + ams(new Date(c.ts)).date.slice(8, 10) + "/" + ams(new Date(c.ts)).date.slice(5, 7) : ""})</span></span>` : ""}</p>`; };
// Sécurité à deux : envoyer la position avant de monter (plaque à compléter)
function sharePos(id) {
  const l = HLEG[id];
  const send = q => share(`Stop ${l.from} → ${l.to}, ${hhmm(now())} : ${q ? `on est ici https://maps.google.com/?q=${q.lat.toFixed(5)},${q.lon.toFixed(5)}` : "position indisponible"}. On monte dans : plaque ______, direction ______.`, "");
  if (me) return send(me);
  if (!navigator.geolocation) return send(null);
  navigator.geolocation.getCurrentPosition(pos => send({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => send(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
}
const COUNTRY = { FR: "France", BE: "Belgique", NL: "Pays-Bas" };
function openHitch(id) {
  const l = HLEG[id];
  if (!l) return;
  const spotHTML = (st, mid) => `<div class="hs">
      <div class="row"><span class="shape" data-cat="${mid ? "bar" : "visit"}" aria-hidden="true">${icon(mid ? "fuel" : "thumb")}</span><b class="grow">${esc(st.name)}</b>${confBadge(st.conf)}</div>
      <p>${esc(st.access)}</p><p class="small muted">${esc(st.wait)}</p>${st.tip ? `<p class="small">${esc(st.tip)}</p>` : ""}
      <div class="btns"><a class="btn${mid ? "" : " primary"}" href="${gmDir(st)}" target="_blank" rel="noopener">${icon("go")} ${mid ? "Carte" : "Y aller"}</a><span class="signc">${esc(st.sign)}</span></div></div>`;
  const srcs = [];
  for (const st of [...l.spots, ...(l.mid || [])]) for (const x of st.src || []) if (!srcs.some(y => y.u === x.u && y.t === x.t)) srcs.push(x);
  const head = `<span class="shape" data-cat="visit" aria-hidden="true">${icon("thumb")}</span><div style="flex:1;min-width:0"><h2 id="sheetTitle">${esc(l.from)} → ${esc(l.to)}</h2>
    <div class="small muted" style="margin-top:2px">${esc(l.label)} · ${l.km} km · ${esc(l.duration)}</div></div>`;
  const content = `<div class="alert warn" style="margin-top:0">${icon("alert", "i s")}<span>${esc(l.noGo)}</span></div>
    ${l.eve ? `<div class="kv"><h4>La veille</h4><p>${esc(l.eve)}</p></div>` : ""}
    <div class="kv"><h4>Départ conseillé</h4><p>${esc(l.startBy)} · ${esc((HITCH.sun || {})[l.date] || "")}</p>${hitchWx(l)}</div>
    <div class="btns"><button type="button" class="btn" data-act="sharePos" data-id="${l.id}">${icon("loc")} Envoyer notre position</button></div>
    <div class="kv"><h4>Pancartes</h4>${signs(l.sign)}</div>
    <div class="kv"><h4>Spots de départ, le meilleur d'abord</h4>${l.spots.map(st => spotHTML(st, false)).join("")}</div>
    ${(l.mid || []).length ? `<div class="kv"><h4>Où se faire déposer en route</h4>${l.mid.map(st => spotHTML(st, true)).join("")}</div>` : ""}
    <div class="kv"><h4>Itinéraire</h4><p>${esc(l.route)}</p></div>
    <div class="kv"><h4>À l'arrivée</h4><p>${esc(l.arrival)}</p></div>
    ${l.stop ? `<div class="kv"><h4>Pause à Rotterdam</h4><p>${esc(l.stop)}</p></div>` : ""}
    <div class="kv"><h4>Plan B</h4>${l.planB.map(b => `<p><b>${esc(b.mode)}</b> · ${esc(b.txt)} <a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""))}</a> <span class="muted">· ${esc(b.price)}</span></p>`).join("")}<p class="xs muted">Bus : prix FlixBus pour 2 adultes relevés le 17/10/2026, ils montent souvent le jour même.</p></div>
    ${l.sleep ? `<div class="kv"><h4>Dormir à Bruxelles (lundi 26)</h4>${l.sleep.map(b => `<p><b>${esc(b.name)}</b> · ${esc(b.addr)}<br><span class="small">${esc(b.price)}</span> · <a href="${gmDir(b)}" target="_blank" rel="noopener">itinéraire</a></p>`).join("")}<p class="xs muted">Prix Hostelworld pour la nuit du 26 au 27/10, relevés le 16/10/2026.</p></div>` : ""}
    <div class="kv"><h4>Sources</h4><div class="srcs">${srcs.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join("")}</div><p class="xs muted">${esc(HITCH.attribution)}</p></div>
    <div class="btns"><button type="button" class="btn" data-act="hitchRules">${icon("law")} Règles et sécurité</button></div>`;
  openSheet(head, content, { full: true });
}
function openHitchRules() {
  if (!HLEGS.length) return;
  const H = HITCH;
  const ul = a => `<ul>${a.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  const head = `<span class="shape" data-cat="visit" aria-hidden="true">${icon("law")}</span><div style="flex:1;min-width:0"><h2 id="sheetTitle">Le stop : règles et sécurité</h2>
    <div class="small muted" style="margin-top:2px">France, Belgique, Pays-Bas</div></div>`;
  const content = `<div class="kv" style="margin-top:0"><h4>Ce que dit la loi</h4>${H.law.map(x => `<p><b>${COUNTRY[x.country] || x.country}</b> · ${esc(x.txt)}<br><a class="small" href="${esc(x.src.u)}" target="_blank" rel="noopener">${esc(x.src.t)}</a></p>`).join("")}</div>
    <div class="kv"><h4>Sécurité à deux</h4>${ul(H.safety)}</div>
    <div class="kv"><h4>Technique</h4>${ul(H.technique)}</div>
    <div class="kv"><h4>Dans le sac</h4>${ul(H.kit)}</div>
    <div class="kv"><h4>En néerlandais</h4>${H.phrases.map(x => `<p>${esc(x.fr)}<br><b lang="nl">${esc(x.nl)}</b></p>`).join("")}</div>
    <div class="kv"><h4>Applis</h4>${H.apps.map(x => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a> · ${esc(x.txt)}</p>`).join("")}</div>
    <p class="xs muted">${esc(H.attribution)}</p>`;
  openSheet(head, content, { full: true });
}

// ───────────── Écran Aujourd'hui ─────────────
function statusLine(c) {
  const wx = state.wx && state.wx.d.current;
  const left = c.phase === "day" ? `${esc(c.day.long.split(" ")[0])} ${c.day.label.split(" ")[1]} oct. · Jour ${c.idx + 1}/4`
    : new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now());
  const w = wx && c.phase !== "before" ? `<span class="wxchip">${icon(wmo(wx.weather_code)[0], "i s")}${Math.round(wx.temperature_2m)}°</span>` : "";
  return `<div class="status"><span class="grow">${left}</span>${w}</div>`;
}
function renderToday() {
  const c = clock();
  const el = $("#s-today");
  $("#todayIcon").textContent = c.a.h >= 18 || c.a.h < 7 ? "bedtime" : "light_mode";
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
  return `<div class="ck${done ? " done" : ""}"><label class="cbx"><input type="checkbox" data-act="ck" data-id="${it.id}" ${done ? "checked" : ""} aria-label="Fait : ${esc(it.txt)}"></label>
    ${it.url ? `<a class="t" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.txt)} ${icon("ext", "i s")}</a>` : `<span class="t">${esc(it.txt)}</span>`}${done ? "" : dueBadge(it.due, today)}</div>`;
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
  ${HLEG.h1 && c.a.date === HLEG.h1.date ? `<div class="sec">${hitchCard(HLEG.h1)}</div>` : ""}
  ${hitchSection("En stop jusqu'à Amsterdam, et retour", HLEGS)}
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
    ${DAYS.map(d => { const pr = dayProgress(d.id); return `<button type="button" class="li" data-act="day" data-day="${d.id}">${icon("cal")}<span style="flex:1"><span class="nm">${d.label} · ${esc(d.theme)}</span><span class="sub">${esc(d.sector || d.sub)}</span>${d.move ? `<span class="modes">${modeChips(d.move)}</span>` : ""}</span><span class="pr num">${pr.done}/${pr.total}</span></button>`; }).join("")}
  </div></div>
  <div class="sec"><a class="btn" style="width:100%" href="${TRIP.guide}" target="_blank" rel="noopener" data-act="guideRead">${icon("doc")} Guide pratique (papiers, transports, règles, valise)</a></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}
function nextCard(c, s) {
  const day = c.day.id;
  if (!s) {
    return `<div class="card pad next"><div class="when">Programme terminé</div><h3>Bien joué</h3><p class="why">Tout le plan du jour est fait ou passé. Regardez « Ce soir » ou rentrez.</p></div>`;
  }
  const p = s.p, org = originFor(day, s, c.lmin), w = p.lat != null ? walkMin(dist(org.o, p)) : 0;
  const leave = s.t - w - 3;
  const arrive = Math.max(c.lmin + w, s.t);
  const stArr = p.cat !== "base" ? hoursState(p, day, arrive) : null;
  const late = c.lmin - s.t;
  const here = me && p.lat != null && dist(me, p) <= state.radius + 30;
  const alerts = [];
  if (stArr && (stArr.k === "closed")) alerts.push(`<div class="alert bad">${icon("alert", "i s")} ${p.cat === "party" ? "Terminé à votre arrivée" : "Fermé à votre arrivée"} (${esc(stArr.txt)})</div>`);
  else if (stArr && stArr.k === "later" && stArr.at - arrive > 20) alerts.push(`<div class="alert warn">${esc(stArr.txt)}</div>`);
  const end = s.t + (s.dur || 60);
  if (late > 15 && !here) alerts.push(c.lmin <= end
    ? `<div class="alert warn">Prévu ${s.at}–${fmtMin(end)} : déjà sur place ? Touchez « Fait ».</div>`
    : `<div class="alert warn">En retard de ${durTxt(late)} · passer à la suite ?</div>`);
  return `<div class="card pad next">
    <div class="when">${icon(here ? "loc" : "clock", "i s")}${here ? "Vous y êtes" : "Ensuite · " + s.at}</div>
    <div class="row" style="margin-top:6px">${smallShape(p.cat === "base" ? "base" : p.cat, false)}<h3 class="grow" style="margin:0">${esc(s.id === "base" ? "Auberge : déposer les sacs" : p.name)}</h3>
      ${p.price != null ? `<span class="price num">${euro(p.price)}</span>` : ""}</div>
    ${p.why ? `<p class="why">${esc(p.why)}</p>` : ""}
    ${s.note ? `<p class="why"><b>${esc(s.note)}</b></p>` : ""}
    ${p.story ? `<details class="story"><summary>${icon("story", "i s")}<span class="grow">L'histoire en 30 secondes</span>${icon("down", "i s chev")}</summary>${storyBody(p.story)}</details>` : ""}
    ${enChips(s, { lead: "Sur le chemin" })}
    <div class="meta row">${icon(s.via ? s.vm || "ferry" : "walk", "i s")}<span class="grow">${s.via ? esc(s.via) : `${w} min ${esc(org.label)}`}${!here && !s.via && leave > c.lmin ? ` · partez à <b class="num">${fmtMin(leave)}</b>` : ""}</span>${confBadge(p.conf)}</div>
    ${alerts.join("")}
    <div class="btns lg"><a class="btn primary" href="${navUrl(p)}" target="_blank" rel="noopener">${icon("go")} Y aller</a>
      <button type="button" class="btn" data-act="stepDone" data-day="${day}" data-id="${s.id}">${icon("check")} Fait</button>
      <button type="button" class="btn icon" data-act="stepSkip" data-day="${day}" data-id="${s.id}" aria-label="Passer">${icon("skip")}</button></div>
  </div>`;
}
function weatherStrip(c) {
  const sun = SUN[c.day.id][1];
  if (!state.wx) return `<div class="card wx">${icon("sunset", "i s")} Coucher du soleil ${sun}<span class="muted small">${navigator.onLine ? "Météo indisponible pour l'instant" : "Météo indisponible hors ligne"}</span></div>`;
  const cur = state.wx.d.current;
  const hrs = wxHours(now().getTime(), 8);
  let maxp = null;
  for (const h of hrs) if (h.pp != null && (!maxp || h.pp > maxp.pp)) maxp = h;
  const [ic, lab] = wmo(cur ? cur.weather_code : null);
  return `<button type="button" class="card wx" data-act="hourly" style="width:100%;text-align:left;border:1px solid var(--line)">
    ${icon(ic)}<b class="num">${cur ? Math.round(cur.temperature_2m) + "°" : "—"}</b><span>${esc(lab)}</span>
    ${maxp ? `<span>${icon("rain", "i s")} ${maxp.pp} % vers ${hhmm(new Date(maxp.t)).slice(0, 2)} h</span>` : ""}
    <span>${icon("sunset", "i s")} ${sun}</span><span class="xs muted">${wxAge()}</span></button>
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
  const tonight = PLACES.filter(p => p.cat === "party" && (p.date === day || p.date === "all")).map(p => ({ p, st: hoursState(p, day, c.lmin) }))
    .filter(x => x.st.k !== "closed").sort((a, b) => (tmin(a.p.start) || 0) - (tmin(b.p.start) || 0) || (a.p.price ?? 99) - (b.p.price ?? 99));
  const tonightHTML = `<div class="sec"><h2>Ce soir (${tonight.length}) <span class="grow"></span><button type="button" class="btn sm ghost" data-act="partiesDay" data-day="${day}">Tout voir</button></h2>
    ${tonight.length ? `<div class="carousel">${tonight.map(x => placeRow(x.p, { dayId: day, lmin: c.lmin })).join("")}</div>
    <p class="xs muted" style="margin:6px 0 0">Programmes vérifiés le ${dmy(TRIP.dataVersion).slice(0, 5)} : revérifiez la veille sur la page de la soirée.</p>` : `<p class="empty">Pas de soirée datée ce soir.</p>`}</div>`;
  const openNow = PLACES.filter(p => (p.cat === "bar" || p.cat === "food") && p.lat != null)
    .map(p => ({ p, st: hoursState(p, day, c.lmin), w: walkFrom(p) }))
    .filter(x => x.st.k === "open" && x.w <= 15).sort((a, b) => (priceOn(a.p, day) ?? 99) - (priceOn(b.p, day) ?? 99)).slice(0, 6);
  const others = PLACES.filter(p => p.cat !== "party" && p.cat !== "curio" && (p.days || []).includes(day) && !(PLAN[day] || []).some(st => st.id === p.id));
  const home = BASE, wHome = walkMin(dist(from(), home));
  const late = c.lmin >= 25 * 60 || (!s && c.lmin >= 22 * 60);
  const homeCard = late ? `<div class="sec"><div class="card pad next" style="border-left-color:var(--ok)"><div class="when" style="color:var(--ok)">Rentrer</div>
      <h3>${meNear() ? `Auberge · ${wHome} min à pied` : "Auberge · Warmoesstraat 129"}</h3><p class="why">${meNear() ? "" : me ? "" : "GPS coupé : activez-le pour voir le temps de marche. "}${c.day.move ? esc(c.day.move.home.t) : "Ferry F3 toute la nuit depuis Noord."}</p>
      <div class="btns"><a class="btn primary" href="${navUrl({ ...home, name: "Warmoesstraat 129" })}" target="_blank" rel="noopener">${icon("walk")} À pied</a>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${home.lat},${home.lon}&travelmode=transit" target="_blank" rel="noopener">${icon("bus")} Bus de nuit</a></div></div></div>` : "";
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1>${esc(c.day.theme)}</h1><p>Jour ${c.idx + 1}/4 · ${pr.done}/${pr.total} étapes · ${esc(c.day.sub)}</p></div>${xxx(pr.kinds)}</div>
  ${homeCard}
  ${hitchTuesday(c)}
  ${day === "ven" && c.lmin >= 18 * 60 && HLEG.h4 && HLEG.h4.eve ? `<div class="sec"><div class="alert warn" style="margin-top:0">${icon("thumb", "i s")}<span>Demain, ${esc(HLEG.h4.eve.replace(/^./, m => m.toLowerCase()))} <button type="button" class="btn sm ghost" data-act="hitch" data-id="h4">Détails</button></span></div></div>` : ""}
  <div class="sec">${nextCard(c, s)}</div>
  <div class="sec">${weatherStrip(c)}</div>
  <div class="sec"><h2>Se déplacer aujourd'hui</h2>${moveCard(c.day)}</div>
  ${c.lmin >= 22 * 60 ? tonightHTML : ""}
  <div class="sec"><h2>Le plan du jour <span class="grow"></span>${pr.done}/${pr.total}</h2><div class="card pad" style="padding-top:6px;padding-bottom:6px">${timeline(day, { lmin: c.lmin })}</div></div>
  ${c.lmin < 22 * 60 ? tonightHTML : ""}
  <div class="sec"><h2>Ouvert maintenant, à moins de 15 min</h2>
    ${openNow.length ? `<div class="list">${openNow.map(x => placeRow(x.p, { dayId: day, lmin: c.lmin })).join("")}</div>`
      : `<p class="empty">Aucun bar ni resto aux horaires connus n'est ouvert à moins de 15 min.</p>`}</div>
  <div class="sec"><h2>Près de vous</h2>${essGrid()}</div>
  <div class="sec"><details><summary class="label" style="cursor:pointer;min-height:var(--tap);display:flex;align-items:center">Aussi dans le coin (${others.length})${icon("chev", "i s chev")}</summary>
    <div class="list">${others.map(p => placeRow(p, { dayId: day, lmin: c.lmin })).join("")}</div></details></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}
function todayLeave(c) {
  const trains = ["03:46", "04:46", "05:05", "05:18", "05:29", "05:49"].filter(t => +t.slice(0, 2) * 60 + +t.slice(3) >= c.a.min);
  const items = ["Pièce d'identité et cartes bancaires", "Chargeurs et batterie externe chargée", "Casier de l'auberge vidé, cadenas repris", "Carte-clé rendue à la réception (départ avant 11:00)", "Pancartes UTRECHT, BREDA, PARIS et gilet réfléchissant"];
  const h4 = HLEG.h4;
  return `${statusLine(c)}
  <div class="flag"><div class="t"><h1>Retour</h1><p>Samedi 31 octobre · ${h4 ? "en stop jusqu'à Paris" : "Centraal à 7 min à pied"}</p></div>${xxx({ voir: true, manger: true, sortir: true })}</div>
  ${h4 ? `<div class="sec">${hitchCard(h4)}</div>` : ""}
  <div class="sec"><h2>Avant de fermer la porte</h2><div class="card pad" style="padding-top:4px;padding-bottom:4px">
    ${items.map((t, i) => { const id = "leave-" + i; const done = !!state.ck[id]; return `<label class="ck${done ? " done" : ""}"><input type="checkbox" data-act="ck" data-id="${id}" ${done ? "checked" : ""}><span class="t">${esc(t)}</span></label>`; }).join("")}
  </div></div>
  <div class="sec"><details><summary class="label" style="cursor:pointer;min-height:var(--tap);display:flex;align-items:center">Ceux qui rentrent en train ou en avion${icon("chev", "i s chev")}</summary>
    <div class="card pad"><div class="when">Trains Centraal → Schiphol (prévus)</div>
    <p class="num" style="font-size:var(--fs-lg);font-weight:600;margin:8px 0">${trains.length ? trains.join(" · ") : "Un train toutes les 10 à 15 min"}</p>
    <p class="why">13 à 17 min de trajet. Schiphol demande 2 h d'avance pour un vol Schengen. Vérifiez dans l'appli NS. Badgez votre carte au portique.</p>
    <div class="btns"><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=52.3791,4.9003&travelmode=walking" target="_blank" rel="noopener">${icon("walk")} Vers Centraal</a></div></div></details></div>`;
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
  const others = PLACES.filter(p => (p.days || []).includes(day) && p.cat !== "party" && p.cat !== "curio" && !(PLAN[day] || []).some(s => s.id === p.id));
  const pr = dayProgress(day);
  $("#s-plan").innerHTML = `<div class="status"><span class="grow">Programme</span></div>
  <div class="sec" style="padding-top:0"><div class="seg" role="group" aria-label="Jour">${DAYS.map(x => `<button type="button" data-act="day" data-day="${x.id}" aria-pressed="${x.id === day}">${x.label}</button>`).join("")}</div></div>
  <div class="sec"><h1 class="dayh">${esc(d.theme)}</h1><p class="small muted" style="margin:4px 0 0">${esc(d.long)} · ${esc(d.sector || d.sub)} · ${pr.done}/${pr.total} faits</p></div>
  <div class="sec" style="padding-top:8px">${moveCard(d, { home: false })}</div>
  <div class="sec"><div class="card pad">${timeline(day, { controls: true, lmin: c.phase === "day" && c.day.id === day ? c.lmin : null })}</div>
    <div class="btns"><button type="button" class="btn" data-act="mapDay" data-day="${day}">${icon("map")} Voir le parcours</button>
    <button type="button" class="btn" data-act="sharePlan" data-day="${day}">${icon("share")} Partager</button></div></div>
  <div class="sec"><h2>Soirées ce soir-là <span class="grow"></span><button type="button" class="btn sm ghost" data-act="partiesDay" data-day="${day}">Tout voir</button></h2>
    <div class="carousel">${PLACES.filter(p => p.cat === "party" && (p.date === day || p.date === "all")).sort((a, b) => (a.price ?? 99) - (b.price ?? 99)).slice(0, 8).map(p => placeRow(p)).join("")}</div></div>
  <div class="sec"><h2>Aussi dans le coin (${others.length})</h2><div class="list">${others.map(p => placeRow(p, { dayId: day, lmin: 18 * 60 })).join("")}</div>
    <p class="xs muted" style="margin:6px 0 0">Les horaires affichés dans cette liste sont ceux de 18:00 ce jour-là.</p></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}

// ───────────── Écran Lieux ─────────────
const CHEAP = { bar: 3, food: 10, party: 10, visit: 10, curio: 10 };
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
    curio: "Gratuit, sur vos trajets : 1 à 5 min chacun, rien à réserver. Chaque fiche raconte l'histoire du lieu.",
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
  <div class="sec" style="padding-top:4px"><p class="xs muted" style="margin:0 0 8px">${notes[cat]} ${meNear() ? "Distances depuis vous." : "Distances depuis l'auberge."}</p>
    <div class="list">${items.length ? items.map(p => placeRow(p, { dayId, lmin: c.lmin, showDay: pday === "all" })).join("") : `<p class="empty">Rien avec ces filtres. Enlevez-en un.</p>`}</div></div>
  <svg class="gables" aria-hidden="true"><use href="#i-gables"/></svg>`;
}

// ───────────── Écran Infos ─────────────
const MOVE_RULES = [
  ["walk", "Moins de 2 km : à pied", "Centre, Jordaan, canaux, Leidseplein, Rembrandtplein. En groupe, 1 km ≈ 15 min : ajoutez 10 à 20 % aux temps des applis. Pas de tram pour 1 ou 2 arrêts."],
  ["tram", "2,5 à 4 km de jour : tram, métro ou bus", "Museumplein, De Pijp, Ouest, Oost : 20 à 35 min porte à porte, environ 1,60–1,80 € le trajet. Chacun badge sa carte sans contact <b>à la montée et à la descente</b>, toujours la même : plafond GVB Max 10,50 €/jour."],
  ["ferry", "Noord : ferry gratuit", "Derrière Centraal, sans badge. F3 (Buiksloterweg) 24 h/24, toutes les 12 min la nuit. Dernier F4 depuis NDSM à 02:00, 03:30 la nuit de vendredi."],
  ["bus", "La nuit : à pied ou bus de nuit", "Plus de tram ni métro après 00:30–00:50. Nuits de mardi et mercredi : seulement N85 et N87 (Rembrandtplein → Dam). Nuits de jeudi et vendredi : N81 à N93, environ 1 par heure, 5,70 €."],
  ["bike", "Vélo : l'après-midi seulement", "Utile pour l'Ouest ou Noord (13–22 min), mais à rendre avant la soirée (Yellow Bike Centraal 20:00, Rent a Bike Damstraat 18:00). Jamais après avoir bu : au-delà de 0,5 ‰ (≈ 2 verres), c'est un délit (≈ 200 €, casier possible)."],
  ["go", "Taxi : Bolt XL à 5 ou 6", "Environ 31 € pour 5 km, soit 5–6 € par personne. Taxis à plaque bleue seulement, aux stations (Dam, Leidseplein, Rembrandtplein, Nieuwmarkt)."],
  ["alert", "Piétons", "Jamais sur la piste cyclable (55 € d'amende) ; regardez des deux côtés, vélos et trams arrivent sans bruit. Pickpockets à Centraal, au Dam et dans les trams 2 et 5."],
];
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
  ${hitchSection("En stop", HLEGS)}
  <div class="sec"><h2>Se déplacer</h2><div class="list">${MOVE_RULES.map(([ic, t, b]) => `<div class="li rule">${icon(ic)}<span style="flex:1;min-width:0"><span class="nm">${t}</span><span class="sub">${b}</span></span></div>`).join("")}</div>
    <div class="card pad small" style="margin-top:8px">${ferryBlock("centraal", "Prochains ferries depuis Centraal")}</div></div>
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
    Données vérifiées le ${dmy(TRIP.dataVersion)}. Chaque prix et chaque soirée garde sa source et sa date.<br>
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
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  essLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  map.on("dragstart", () => { if (follow) { follow = false; updateLocBtn(); } });
  mapReady = true;
  if (me) drawMe(true);
}
function drawMe(center) {
  if (!mapReady || !me) return;
  if (!meMarker) {
    const meCol = getComputedStyle(document.documentElement).getPropertyValue("--me").trim() || "#4285f4";
    meCircle = L.circle([me.lat, me.lon], { radius: me.acc, color: meCol, weight: 1, opacity: 0.35, fillColor: meCol, fillOpacity: 0.12, interactive: false }).addTo(map);
    meMarker = L.marker([me.lat, me.lon], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false, zIndexOffset: 3000 }).addTo(map);
  } else { meMarker.setLatLng([me.lat, me.lon]); meCircle.setLatLng([me.lat, me.lon]).setRadius(me.acc); }
  if (center) map.setView([me.lat, me.lon], center === true ? Math.max(map.getZoom(), 16) : map.getZoom());
}
function mapFilterDay() {
  const c = clock();
  if (state.mapFilter === "today") return c.phase === "day" ? c.day.id : c.phase === "before" ? "mar" : null;
  if (state.mapFilter.startsWith("d:")) return state.mapFilter.slice(2);
  return null;
}
let markerSig = "";
const cluster = () => (L.markerClusterGroup ? L.markerClusterGroup({ maxClusterRadius: 36, disableClusteringAtZoom: 17, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
  iconCreateFunction: g => L.divIcon({ className: "", html: `<div class="clu">${g.getChildCount()}</div>`, iconSize: [48, 48], iconAnchor: [24, 24] }) }) : L.layerGroup());
function drawMarkers(force = false) {
  if (!mapReady) return;
  const day = mapFilterDay();
  const c0 = clock();
  const sig = JSON.stringify([state.checked, state.mapFilter, state.layers, state.hideDone, selMarker, day, c0.day && c0.day.id, document.documentElement.dataset.theme || ""]);
  if (!force && sig === markerSig) return;
  markerSig = sig;
  markersLayer.clearLayers(); routeLayer.clearLayers(); essLayer.clearLayers();
  const grp = day ? markersLayer : cluster();
  if (!day) markersLayer.addLayer(grp);
  const add = (p, opts = {}) => {
    const done = p.cat !== "base" && isDone(opts.key || p.id);
    const html = pinHTML(p.cat, { done, num: opts.num, sel: selMarker === p.id });
    const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html, iconSize: [48, 48], iconAnchor: p.cat === "base" ? [24, 24] : [24, 46] }), keyboard: true, title: p.name, zIndexOffset: p.cat === "base" ? 1000 : selMarker === p.id ? 2000 : 0 });
    m.on("click", () => placeSheet(p.id));
    m.on("add", () => { const el = m.getElement(); if (el) el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); placeSheet(p.id); } }); });
    m.addTo(p.cat === "base" ? markersLayer : grp);
  };
  add({ ...BASEP, cat: "base" });
  if (day) {
    const steps = plan(day).filter(s => s.p.lat != null && s.id !== "base");
    const pts = [[BASE.lat, BASE.lon], ...steps.map(s => [s.p.lat, s.p.lon])];
    L.polyline(pts, { color: getComputedStyle(document.documentElement).getPropertyValue("--route").trim() || "#333", weight: 4, dashArray: "2 8", lineCap: "round" }).addTo(routeLayer);
    steps.forEach((s, i) => add(s.p, { num: i + 1, key: s.id }));
    if (state.layers.curio) for (const s of steps) for (const e of s.en || []) if (BYID[e] && BYID[e].lat != null && !steps.some(x => x.id === e)) add(BYID[e]);
  } else {
    for (const p of PLACES) {
      if (p.lat == null || !state.layers[p.cat]) continue;
      if (p.cat === "party") { const c = clock(); if (c.phase === "day" && p.date !== c.day.id && p.date !== "all") continue; }
      if (state.mapFilter === "todo" && isDone(p.id)) continue;
      if (state.hideDone && isDone(p.id)) continue;
      add(p);
    }
  }
  const essGrp = cluster();
  essLayer.addLayer(essGrp);
  for (const [k, v] of Object.entries(ESSDEF)) {
    if (!state.layers[k]) continue;
    for (const x of essList(k)) {
      const html = `<div style="width:48px;height:48px;display:grid;place-items:center"><div class="pin-ess">${icon(v.icon)}</div></div>`;
      L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "", html, iconSize: [48, 48], iconAnchor: [24, 24] }), title: x.e[2] || v.one })
        .on("click", () => openEss(k)).addTo(essGrp);
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
    ${s ? `<button type="button" class="li" style="min-height:56px;padding:8px 10px;box-shadow:none" data-act="open" data-id="${s.id}">${smallShape(s.p.cat === "base" ? "base" : s.p.cat)}<span style="flex:1;min-width:0"><span class="sub" style="margin:0">Ensuite · ${s.at}</span><span class="nm">${esc(s.id === "base" ? "Auberge" : s.p.name)}</span></span><span class="pr num">${s.via ? icon(s.vm || "ferry") : s.p.lat != null ? walkMin(dist(originFor(c.day.id, s, c.lmin).o, s.p)) + " min" : ""}</span></button>` : ""}
    <div class="chips" style="margin:8px 0 0;padding:0">${ess}</div>`;
  document.documentElement.style.setProperty("--peek", ($("#mapPeek").offsetHeight || 120) + "px");
}
function renderMap() {
  const first = !mapReady;
  initMap();
  renderMapChrome();
  drawMarkers();
  setTimeout(() => map.invalidateSize(), 60);
  if (first) fitFilter();
  if (!state.mapSeen) { state.mapSeen = true; save(); }
}
function layersSheet() {
  const row = (k, l) => `<label class="setrow"><span>${l}</span><input type="checkbox" data-layer="${k}" ${state.layers[k] ? "checked" : ""} style="width:22px;height:22px"></label>`;
  openSheet(`<div style="flex:1"><h2 id="sheetTitle">Calques</h2></div>`,
    `${row("visit", "Visites")}${row("food", "Manger")}${row("bar", "Bars")}${row("party", "Soirées (du jour pendant le voyage)")}${row("curio", "Insolite (curiosités en chemin)")}
     <div class="kv"><h4>Essentiels</h4></div>${row("wc", "Toilettes publiques")}${row("urinals", "Inclure les urinoirs (hommes)")}${row("atm", "Distributeurs")}${row("sm", "Supermarchés")}${row("ph", "Pharmacies")}
     <p class="xs muted">Les calques Visites à Insolite s'appliquent aux vues « Tout » et « À faire » ; dans la vue d'un jour, Insolite montre les curiosités du trajet.</p>`);
}

// ───────────── GPS ─────────────
let watchId = null, lastRender = 0, gpsWarned = false;
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
  drawMe(follow ? "keep" : false);
  if (first && mapReady && $("#s-map").classList.contains("active") && !mapFilterDay()) drawMe(true);
  if (acc <= 100) autoCheck(lat, lon, acc);
  if (Date.now() - lastRender > 15000) { lastRender = Date.now(); renderActive(); }
}
function onPosErr(e) {
  const msg = { 1: "Position refusée. Les distances partent de l'auberge. Réactivez la localisation pour ce site dans les réglages du navigateur.", 2: "Position introuvable pour l'instant.", 3: "Le GPS met du temps à répondre." }[e.code] || "GPS indisponible.";
  if (e.code === 1) { toast(msg); stopGps(); return; }
  // Perte de signal passagère (intérieur, tunnel) : on le dit une fois, sans écraser un message utile
  if (!me && !gpsWarned) { gpsWarned = true; toast(msg, { low: true }); }
}
// Jour où un lieu est une étape du plan
const PLAN_DAY = {};
for (const d in PLAN) for (const s of PLAN[d]) PLAN_DAY[s.id] = d;
function autoCheck(lat, lon, acc) {
  const c = clock();
  if (c.phase !== "day") return;
  const here = { lat, lon }, r = state.radius + Math.min(acc, 30), t = Date.now(), day = c.day.id;
  const step = id => plan(day).find(s => s.id === id);
  // Candidats : étapes d'aujourd'hui, ou lieux hors plan ; jamais une étape d'un autre jour (coche manuelle)
  const near = PLACES.filter(p => p.lat != null && dist(here, p) <= r
      && (p.cat !== "party" || p.date === day || p.date === "all")
      && (!PLAN_DAY[p.id] || PLAN_DAY[p.id] === day))
    .sort((a, b) => { const da = dist(here, a), db = dist(here, b); return Math.abs(da - db) < 15 ? !!step(b.id) - !!step(a.id) || da - db : da - db; }); // le plus proche gagne ; même adresse : l'étape du jour
  for (const id in inside) if (!near.some(p => p.id === id)) delete inside[id]; // sorti du rayon : réarmé
  const p = near[0];
  if (!p || isDone(p.id)) return;
  const s = step(p.id);
  // Au pied de l'auberge (Belushi's) : seulement comme étape du jour, à partir d'1 h avant
  if (dist(BASE, p) < 60 && !(s && c.lmin >= s.t - 60)) return;
  inside[p.id] = inside[p.id] || t;
  if (t - inside[p.id] >= state.dwell * 1000) {
    state.checked[p.id] = t; save();
    toast(`Visité : ${p.name}`, { undo: p.id });
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([10, 40, 10]);
    renderActive();
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
      <button type="button" class="btn primary" data-act="ob2">Continuer</button>
      <button type="button" class="btn" style="margin-top:8px" data-act="obDone">Passer</button>`;
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
function toast(msg, { undo = null, action = null, low = false } = {}) {
  const t = $("#toast");
  if (low && t.classList.contains("on") && t.querySelector("button")) return; // ne jamais écraser un message avec Annuler
  t.innerHTML = esc(msg) + (undo ? `<button type="button" data-act="undo" data-id="${esc(undo)}">Annuler</button>` : "") + (action ? `<button type="button" data-act="${action.act}"${action.id ? ` data-id="${esc(action.id)}"` : ""}>${esc(action.label)}</button>` : "");
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), action || undo ? 8000 : 4000);
}

// ───────────── Navigation ─────────────
function activeScreen() { const s = $(".screen.active"); return s ? s.id : "s-today"; }
function show(id) {
  for (const s of $$(".screen")) s.classList.toggle("active", s.id === id);
  for (const b of $$("nav.tabs button")) b.setAttribute("aria-selected", String(b.dataset.s === id));
  renderScreen(id);
  if (id !== "s-map") $("#" + id).scrollTop = 0;
}
function dayRollover() {
  const c = clock();
  if (state.selOn === c.logical) return;
  state.selOn = c.logical;
  if (c.phase === "day") { state.progDay = null; state.listDay = null; }
  save();
}
function renderScreen(id) {
  dayRollover();
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
  const det = $$("details", el).map(d => d.open), car = $$(".carousel", el).map(c => c.scrollLeft);
  const hr = $("#hourly"), hourlyOpen = !!(hr && !hr.hidden && el.contains(hr));
  renderScreen(id);
  $$("details", el).forEach((d, i) => { if (det[i]) d.open = true; });
  $$(".carousel", el).forEach((c, i) => { c.scrollLeft = car[i] || 0; });
  if (hourlyOpen && $("#hourly")) { $("#hourly").hidden = false; $("#hourly").innerHTML = hourlyHTML(); }
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
$$(".screen").forEach(s => s.addEventListener("scroll", () => s.classList.toggle("scrolled", s.scrollTop > 4), { passive: true }));

// ───────────── Actions (délégation) ─────────────
function toggleDone(id, val) {
  const on = val ?? !isDone(id);
  if (on) state.checked[id] = Date.now(); else { delete state.checked[id]; inside[id] = Infinity; } // pas de re-coche avant d'être sorti du rayon
  save();
  if (on && navigator.vibrate) navigator.vibrate(10);
}
const copy = txt => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject(new Error("no clipboard")));
async function share(text, url) {
  try { if (navigator.share) { await navigator.share({ title: "Amsterdam", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; } // refus hors geste (après le GPS) : on copie
  try { await copy(text + (url ? " " + url : "")); toast("Copié dans le presse-papiers"); } catch (e) { toast("Partage indisponible"); }
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case "open": placeSheet(id); break;
    case "hitch": openHitch(id); break;
    case "hitchRules": openHitchRules(); break;
    case "closeSheet": closeSheet(); break;
    case "tab": closeSheet(); show(el.dataset.s); break;
    case "day": state.progDay = el.dataset.day; save(); closeSheet(); show("s-plan"); break;
    case "stepDone": {
      const day = el.dataset.day, s = (PLAN[day] || []).find(x => x.id === id), k = stepKey(s, day);
      toggleDone(k); renderActive();
      if (isDone(k) && el.closest(".next")) toast(`Fait : ${s.id === "base" ? "l'auberge" : BYID[s.id].name}`, { undo: k });
      break;
    }
    case "stepSkip": {
      const day = el.dataset.day, k = day + ":" + id, s = plan(day).find(x => x.id === id), c = clock();
      const lmin = c.phase === "day" && c.day.id === day ? c.lmin : null;
      const shownSkipped = state.skipped[k] === true || (!isDone(stepKey(s, day)) && missed(s, lmin, day));
      state.skipped[k] = !shownSkipped;
      save(); renderActive();
      if (!shownSkipped && el.closest(".next")) toast("Étape passée", { undo: k });
      break;
    }
    case "undo":
      if (id.includes(":")) delete state.skipped[id];
      else { delete state.checked[id]; inside[id] = Infinity; }
      save(); $("#toast").classList.remove("on"); renderActive(); break;
    case "unck": delete state.ck[id]; save(); $("#toast").classList.remove("on"); renderActive(); break;
    case "sharePos": sharePos(id); break;
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
    case "reset": if (confirm("Effacer toutes les coches, notes et réglages de ce téléphone ?")) { stopGps(); me = null; const wx = state.wx; state = JSON.parse(JSON.stringify(DEF)); state.wx = wx; state.onboarded = true; save(); applyTheme(); renderActive(); } break;
    case "reload": location.reload(); break;
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.act === "toggleDone") {
    toggleDone(el.dataset.id, el.checked);
    const h = $("#sheetHead .shape"), p = BYID[el.dataset.id];
    if (h && p) h.outerHTML = smallShape(p.cat, el.checked);
    drawMarkers(); renderActive(); return;
  }
  if (el.dataset.act === "ck") {
    const id = el.dataset.id;
    if (el.checked) { state.ck[id] = true; const it = CHECKLIST.find(x => x.id === id); if (it) toast("Coché : " + it.txt.slice(0, 40) + (it.txt.length > 40 ? "…" : ""), { action: { act: "unck", label: "Annuler", id } }); }
    else delete state.ck[id];
    save(); setTimeout(renderActive, 150); return;
  }
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
      const peekH = $("#mapPeek").offsetHeight || 120;
      map.fitBounds(L.latLngBounds(pts).pad(0.1), { paddingTopLeft: [16, 64], paddingBottomRight: [64, peekH + 16] });
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
function netState() {
  document.body.classList.toggle("is-offline", !navigator.onLine);
  $("#offlineBar").textContent = "Hors ligne · plan et lieux disponibles · carte : zones déjà vues" + (state.wx ? " · météo de " + hhmm(new Date(state.wx.ts)) : "");
}
window.addEventListener("online", () => { netState(); loadWeather(true); });
window.addEventListener("offline", netState);
if ("serviceWorker" in navigator && window.isSecureContext) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w && w.addEventListener("statechange", () => {
        if (w.state === "installed" && hadController) toast("Nouvelle version des données", { action: { act: "reload", label: "Recharger" } });
        else if (w.state === "activated" && !hadController) toast("Prête hors ligne", { low: true });
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
