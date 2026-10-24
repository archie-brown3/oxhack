// Doom Clock phase-1 clickable mockup. Real data comes from data.js (window.DC); every
// invented value in this file is marked "mock" here and in the UI. Styling follows the Doom Clock
// design system (ds/): colours are read from ds/tokens.css, the clock face is DoomClock.face().
const DC = window.DC;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n.toLocaleString('en-GB');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim(); // Stage values
const rgb = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));

// ---------- time model ----------
const NOW = new Date('2026-10-24T12:00:00Z');
const DATE10 = new Date('2032-12-15T00:00:00Z'); // mock: the Lead's "Dec 2032" placeholder for date10
const decYear = d => d.getUTCFullYear() + (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / (365.25 * 864e5);
const NOW_Y = decYear(NOW);
const MIN_TO_MIDNIGHT = decYear(DATE10) - NOW_Y; // 1 minute = 1 year
const p10 = fan => { for (let i = 1; i < fan.length; i++) if (fan[i][1] >= .1) { const [y0, a] = fan[i - 1], [y1, b] = fan[i]; return y0 + (.1 - a) / (b - a) * (y1 - y0); } return Infinity; };
const LAG_RANGE = [p10(DC.fan.lag1.fan), p10(DC.fan.lag10.fan)]; // the 1-in-10 date if the gap is 1 y / 10 y
const BULLETIN_S = DC.bulletin.at(-1).s; // 85 s, Jan 2026 statement
const ym = y => new Date(Date.UTC(Math.floor(y), 0, 1) + (y % 1) * 365.25 * 864e5).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const MINUTES = Math.round(MIN_TO_MIDNIGHT);

const Q = []; // 2024Q4 .. 2035Q4
for (let y = 2024, q = 4; y < 2036; q === 4 ? (y++, q = 1) : q++) Q.push({ y, q, start: new Date(Date.UTC(y, (q - 1) * 3, 1)) });
const TODAY = Q.findIndex(x => x.y === 2026 && x.q === 4);
const qEnd = i => new Date(Date.UTC(Q[i].y, Q[i].q * 3, 1));
const qName = i => `Q${Q[i].q} ${Q[i].y}`;
const inQ = (y, i) => y >= decYear(Q[i].start) && y < decYear(qEnd(i));
const qOf = y => Q.findIndex((_, i) => inQ(y, i));

// Capability: a logistic fitted to two Kalshi prices (39% by 2028, 81% by 2030).
const capAt = t => 1 / (1 + Math.exp(-(t - 2028.47) / 1.054));
// Share of futures gone wrong by year t: the real sim.ts fan (gap 3 y), interpolated.
const pCatAt = (t, fan = DC.fan.lag3.fan) => { for (let i = 1; i < fan.length; i++) if (fan[i][0] >= t) { const [y0, p0] = fan[i - 1], [y1, p1] = fan[i]; return Math.max(0, p0 + (p1 - p0) * (t - y0) / (y1 - y0)); } return fan.at(-1)[1]; };
// Region shares: mock (the plan's unverified 0.58 / 0.30 / 0.12), drifting a little towards China after today.
const sharesAt = i => { const k = Math.max(0, i - TODAY) * .004; return { US: .58 - k, China: .30 + k * .8, rest: .12 + k * .2 }; };

// ---------- 10,000 futures: a line-for-line port of sim.ts (same seed, same three draws per path) ----------
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KX = [DC.fan.inputs.startYear, ...DC.fan.inputs.asi.map(a => a.year)], KP = [0, ...DC.fan.inputs.asi.map(a => a.p)];
const cdfAt = y => { if (y <= KX[0]) return 0; for (let i = 1; i < KX.length; i++) if (y <= KX[i]) return KP[i - 1] + (KP[i] - KP[i - 1]) * (y - KX[i - 1]) / (KX[i] - KX[i - 1]); return KP.at(-1); };
const arrival = u => { for (let i = 1; i < KX.length; i++) if (u < KP[i]) return KX[i - 1] + (u - KP[i - 1]) * (KX[i] - KX[i - 1]) / (KP[i] - KP[i - 1]); return Infinity; };
const N = 10000, LAG = 3, P_BAD = Math.min(1, DC.fan.inputs.pCat2100 / cdfAt(2100));
const PATHS = (() => { const r = mulberry32(1), out = [];
  for (let i = 0; i < N; i++) { const u1 = r(), u2 = r(), u3 = r(), asi = arrival(u1), lag = -LAG * Math.log(1 - u3), c = asi + lag;
    out.push({ id: i + 1, asi: asi > 2100 ? Infinity : asi, cat: (asi <= 2100 && u2 < P_BAD && c <= 2100) ? c : Infinity }); }
  return out; })();
// Ranked over ALL futures (owner, 24 Oct): no catastrophe by 2100 ranks last, then by superintelligence year.
const ORDER = PATHS.map((_, i) => i).sort((a, b) => (PATHS[a].cat - PATHS[b].cat) || (PATHS[a].asi - PATHS[b].asi) || a - b);
ORDER.forEach((pi, r) => PATHS[pi].rank = r);
const SHARE_NO_CAT = PATHS.filter(p => p.cat === Infinity).length / N;
const byPct = q => PATHS[ORDER[Math.min(N - 1, Math.floor(q * N))]];
// MiroFish ensemble: about 5 representative futures, each with its own society.
const ENSEMBLE = [.05, .10, .25, .50, .90].map((q, k) => ({ k: k + 1, q, path: byPct(q) }));
const memberFor = p => ENSEMBLE.reduce((best, m) => Math.abs(m.q - p.rank / N) < Math.abs(best.q - p.rank / N) ? m : best);
const pick = { early: .1, typical: .5, late: .9 };
let FUT = /^\d+$/.test(params.get('fut') || '') ? PATHS[+params.get('fut') - 1] : byPct(pick[params.get('fut')] ?? .1);

// ---------- the society's cast and places ----------
const ROLE = t => ({ GovernmentAgency: 'gov', Policymaker: 'gov', MediaOutlet: 'media', Journalist: 'media', Ailab: 'lab' }[t] || 'other');
const ROLENAME = { gov: 'Government', media: 'Media', lab: 'AI lab', other: 'Other' };
// The Stage is monochrome, so roles are told apart by lightness, never hue.
const ROLESHADE = { gov: tok('ink'), media: tok('ink-2'), lab: tok('ink-3'), other: tok('rule-strong') };
const castById = Object.fromEntries(DC.cast.map(c => [c.id, c]));
const PLACE = { 'Australian': [-27, 134], 'Delhi': [28.6, 77.2], 'Greek': [38, 23.7], 'New Jersey': [40.2, -74.5], 'Philadelphia': [40, -75.2], 'CNN': [33.7, -84.4],
  'Canad': [45.4, -75.7], 'Spanish': [40.4, -3.7], 'Argentine': [-34.6, -58.4], 'FBI': [38.9, -77], 'US government': [38.9, -77], 'D.C.': [38.9, -77], 'Meta': [37.5, -122.1],
  'OpenAI': [37.8, -122.4], 'Anthropic': [37.8, -122.4], 'Claude': [37.8, -122.4], 'DeepSeek': [30.3, 120.2], 'Alibaba': [30.3, 120.2], 'DeepMind': [51.5, -0.1], 'xAI': [37.4, -122.1],
  'Bulletin': [41.9, -87.6], 'Mother Jones': [37.8, -122.3], 'Clara': [37.8, -122.3], 'press': [40.7, -74], 'Incident Database': [47.6, -122.3], 'Safety': [51.75, -1.25] };
const placeOf = name => { for (const k in PLACE) if (name.includes(k)) return PLACE[k]; return [20, 0]; };
const postText = p => (p.quote && p.quote !== 'None' && p.quote !== 'null') ? p.quote : p.text;
const initials = n => n.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const av = c => `<div class="av">${esc(initials(c?.name || '?'))}</div>`;

// ---------- events per quarter ----------
// Real quarters: AIID incidents. Projected quarters: this future's milestones plus its society's posts.
const REAL = Q.map((_, i) => {
  if (i > TODAY) return [];
  const a = Q[i].start.toISOString().slice(0, 10), b = qEnd(i).toISOString().slice(0, 10);
  return DC.incidents.filter(x => x.d >= a && x.d < b).map(x => ({ kind: 'real', d: new Date(x.d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }), t: x.t, url: x.url, id: x.id, lat: x.lat, lng: x.lng }));
});
const SIMPOOL = DC.feed.filter(p => postText(p)?.length > 40);
function eventsFor(i) {
  if (i <= TODAY) return REAL[i];
  const out = [], m = memberFor(FUT), start = decYear(Q[i].start);
  if (FUT.cat < start) return out; // this future has already ended
  for (let k = 0; k < 5; k++) {
    const p = SIMPOOL[(i * 5 + k + m.k * 7) % SIMPOOL.length], c = castById[p.uid], [lat, lng] = placeOf(c.name);
    out.push({ kind: 'sim', d: qName(i), who: c, t: postText(p).replace(/\s+/g, ' '), lat: lat + (k % 2 ? 1.5 : -1.5), lng: lng + (k - 2) * 1.2 });
  }
  if (inQ(FUT.asi, i)) out.splice(1, 0, { kind: 'sim', milestone: 'asi', d: ym(FUT.asi), t: `In this future a lab builds superintelligence (${ym(FUT.asi)})`, lat: 37.8, lng: -122.4 });
  if (inQ(FUT.cat, i)) out.push({ kind: 'cat', milestone: 'cat', d: ym(FUT.cat), t: `In this future, AI catastrophe (${ym(FUT.cat)})`, lat: 33, lng: -112 });
  return out;
}

// ---------- clock: the system's quarter face ----------
const RANGE = LAG_RANGE.map(y => Math.min(15, y - NOW_Y));
const clockFace = o => DoomClock.face({ minutes: MIN_TO_MIDNIGHT, range: RANGE, ghost: BULLETIN_S / 60, label: `It is ${MINUTES} minutes to midnight`, ...o });
function countdown() {
  const d = new Date(), t = DATE10; let y = 0;
  const at = k => new Date(Date.UTC(d.getUTCFullYear() + k, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  while (at(y + 1) <= t) y++;
  let s = Math.max(0, Math.floor((t - at(y)) / 1000)); const days = Math.floor(s / 86400); s %= 86400;
  const p = n => String(n).padStart(2, '0');
  return `${y}y ${String(days).padStart(3, '0')}d ${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
const renderClock = () => { $('#face').innerHTML = clockFace(); $('#reading').textContent = `${MINUTES} Minutes to Midnight`; };
const tickClock = () => { $('#cd').textContent = countdown(); };
setInterval(tickClock, 1000);

// ---------- globe ----------
const feats = window.NE_COUNTRIES.features.filter(f => f.properties.ADM0_A3 !== 'ATA');
const regionOf = f => f.properties.ADM0_A3 === 'USA' ? 'US' : f.properties.ADM0_A3 === 'CHN' ? 'China' : 'rest';
const g = new Globe($('#globe'), { animateIn: false })
  .backgroundColor('rgba(0,0,0,0)').showAtmosphere(true).atmosphereColor(tok('ink-3')).atmosphereAltitude(.08);
const mat = g.globeMaterial(); mat.color.set(tok('raised')); mat.emissive?.set(tok('ground')); mat.shininess = 0;
g.hexPolygonsData(feats).hexPolygonResolution(3).hexPolygonMargin(.3).hexPolygonUseDots(true).hexPolygonAltitude(.004).hexPolygonsTransitionDuration(0);
g.ringColor(r => t => `rgba(${r.c},${(1 - t) * .9})`).ringMaxRadius(r => r.max).ringPropagationSpeed(r => r.speed).ringRepeatPeriod(r => r.period).ringAltitude(.012);
g.htmlElementsData([]).htmlLat('lat').htmlLng('lng').htmlAltitude(.015).htmlElement(d => d.el).htmlTransitionDuration(0);
const ctl = g.controls(); ctl.enableZoom = false; ctl.autoRotate = !REDUCED; ctl.autoRotateSpeed = .3;
g.pointOfView({ lat: 26, lng: -40 });
// The globe fills about 78% of the screen height. Solve the camera altitude for that size.
function fit() {
  const W = innerWidth, H = innerHeight - 150; g.width(W).height(H);
  const f = Math.min(.78 * innerHeight / H, .6 * W / H), fov = (g.camera().fov || 50) / 2 * Math.PI / 180;
  g.pointOfView({ altitude: 1 / Math.sin(Math.atan(f * Math.tan(fov))) - 1 });
}
addEventListener('resize', () => { fit(); placeSociety(); });

// Land runs ink-3 to ink-2: the system says ink-3 to ink, but also to keep land below ink-2 wherever rings sit.
const LAND = [rgb(tok('ink-3')), rgb(tok('ink-2'))], ALARM = rgb(tok('alarm'));
const land = t => `rgb(${LAND[0].map((a, k) => Math.round(a + (LAND[1][k] - a) * Math.min(1, t))).join(',')})`;
function paintGlobe(i) {
  const sh = sharesAt(i), cap = FUT.asi <= decYear(qEnd(i)) ? 1 : capAt(decYear(qEnd(i)));
  if (ended(i)) return g.hexPolygonColor(f => `rgba(${ALARM},${(.35 + sh[regionOf(f)] * .9).toFixed(2)})`);
  g.hexPolygonColor(f => land(sh[regionOf(f)] * 1.6 * (.3 + .7 * cap)));
}

// Datacentre houses, borrowed from globe-options.html (globe.gl doesn't expose THREE).
const dcs = DC.dcs.map((d, k) => ({ ...d, lng: d.lon, hotel: (d.h100_equivalents || 0) > 300000, start: new Date(d.ts), rot: (k * 47) % 90 }));
function houseKit() {
  let gm; g.scene().traverse(o => { if (!gm && o.isMesh && o.geometry?.getAttribute('position')) gm = o; });
  if (!gm) return null;
  const Mesh = gm.constructor, Geo = gm.geometry.constructor, Mat = g.globeMaterial().constructor, Attr = gm.geometry.getAttribute('position').constructor;
  const Group = Object.getPrototypeOf(Mesh.prototype).constructor;
  const geo = tris => { const x = new Geo(); x.setIndex(null); x.deleteAttribute('normal'); x.deleteAttribute('uv'); x.setAttribute('position', new Attr(new Float32Array(tris.flat()), 3)); x.computeVertexNormals(); return x; };
  const shape = (w, d, h, r, o) => { const [x, y] = [w / 2, d / 2];
    const A = [-x, -y, 0], B = [x, -y, 0], C = [x, y, 0], D = [-x, y, 0], E = [-x, -y, h], F = [x, -y, h], G = [x, y, h], H = [-x, y, h], quad = (a, b, c, e) => [a, b, c, a, c, e];
    const [ex, ey] = [x + o, y + o], E2 = [-ex, -ey, h], F2 = [ex, -ey, h], G2 = [ex, ey, h], H2 = [-ex, ey, h], R1 = [-ex, 0, h + r], R2 = [ex, 0, h + r];
    return { walls: geo([...quad(A, B, F, E), ...quad(B, C, G, F), ...quad(C, D, H, G), ...quad(D, A, E, H), H, E, [-x, 0, h + r * x / ex], F, G, [x, 0, h + r * x / ex]]), roof: geo([...quad(E2, F2, R2, R1), ...quad(G2, H2, R1, R2)]) }; };
  const geos = { house: shape(1, 1, .65, .6, .08), hotel: shape(1.9, 1, .95, .45, .08) };
  return d => { const k = geos[d.hotel ? 'hotel' : 'house'], m = () => new Mat({ flatShading: true, shininess: 8, side: 2 });
    const grp = new Group(), walls = new Mesh(k.walls, m()), roof = new Mesh(k.roof, m()); grp.add(walls, roof); grp.scale.setScalar(d.hotel ? 1.25 : 1);
    const c = tok(d.status === 'planned' ? 'ink-3' : 'ink-2');
    walls.material.color.set(c); walls.material.emissive.set(c).multiplyScalar(.3); roof.material.color.set(c).multiplyScalar(.55); roof.material.emissive.set(c).multiplyScalar(.12);
    return grp; };
}
const dcLabel = d => `<div class="dc-panel" style="padding:8px 12px;max-width:260px"><b>${esc(d.name)}</b><br>${esc(d.operator)} · ${esc(d.country)}<br><span class="dc-dim">${d.power_mw ? d.power_mw + ' MW · ' : ''}${d.h100_equivalents ? Math.round(d.h100_equivalents / 1000) + 'k H100e · ' : ''}${esc(d.status)}</span><br><span class="dc-faint">Publicly mapped site (Epoch AI), not compute share</span></div>`;
let house = null;
function placeHouses(i) { const end = qEnd(i), vis = dcs.filter(d => d.start < end);
  if (house) g.objectsData(vis); else g.pointsData(vis).pointLng('lng').pointColor(() => tok('ink-2')).pointAltitude(.01).pointRadius(.3).pointLabel(dcLabel); }
const tryHouses = () => { try { house = houseKit(); } catch (e) { console.warn('houses unavailable', e); }
  if (!house) return false; g.pointsData([]).objectLng('lng').objectThreeObject(house).objectAltitude(.005).objectRotation(d => ({ z: d.rot })).objectLabel(dcLabel); placeHouses(cur); return true; };
g.onGlobeReady(() => tryHouses() || setTimeout(tryHouses, 400));

// pings and marks: solid ink ring = real, dashed sim ring = simulated, alarm diamond = catastrophe
let rings = [], bubs = [];
const RING = { real: rgb(tok('ink')).join(','), sim: rgb(tok('sim')).join(','), cat: ALARM.join(',') };
function ping(e) {
  const r = { lat: e.lat, lng: e.lng, c: RING[e.kind], max: e.milestone ? 16 : 5, speed: e.milestone ? 5 : 2.5, period: 1100 };
  rings.push(r); g.ringsData([...rings]);
  setTimeout(() => { rings = rings.filter(x => x !== r); g.ringsData([...rings]); }, e.milestone ? 3200 : 2000);
}
function bubble(e) {
  const el = document.createElement('div');
  el.className = `bub ${e.kind}`;
  el.innerHTML = `<button class="b" aria-label="${esc(e.t.slice(0, 80))}">${e.milestone === 'asi' ? '◇' : e.who ? esc(initials(e.who.name)) : ''}</button>`;
  el.onclick = ev => { ev.stopPropagation(); openPop(e, el); };
  bubs.push({ lat: e.lat, lng: e.lng, el }); if (bubs.length > 9) bubs.shift();
  g.htmlElementsData([...bubs]);
}
const clearBubs = () => { bubs = []; g.htmlElementsData([]); closePop(); };
const SIM = '<span class="dc-label dc-label--sim">Simulated</span>', REALL = '<span class="dc-label dc-label--real">Real</span>';
function openPop(e, anchor) {
  const p = $('#pop'), c = e.who, r = anchor.getBoundingClientRect();
  p.innerHTML = e.kind === 'real'
    ? `<div class="h">${REALL}<span class="dc-data">${esc(e.d)}</span></div><p>${esc(e.t)}</p>
       <div class="f"><span class="dc-data">aiid #${esc(e.id)}</span><a class="dc-btn dc-btn--sm" href="${esc(e.url)}" target="_blank" rel="noopener">Read the incident ↗</a></div>`
    : e.milestone
      ? `<div class="h">${SIM}<span class="dc-data">${esc(e.d)}</span></div><p>${esc(e.t)}</p><div class="f"><span class="dc-faint">One of 10,000 futures, not the forecast</span></div>`
      : `<div class="h">${av(c)}<div><b>${esc(c.name)}</b><span class="dc-faint">${ROLENAME[ROLE(c.type)]} · @${esc(c.handle)}</span></div></div><p>${esc(e.t.length > 320 ? e.t.slice(0, 320) + '…' : e.t)}</p>
         <div class="f">${SIM}<span class="dc-data">${esc(e.d)}</span><button class="dc-btn dc-btn--sm" data-goengine>Open in Engine</button></div>`;
  p.classList.add('on');
  const x = Math.min(innerWidth - 316, Math.max(16, r.right + 10)), y = Math.min(innerHeight - p.offsetHeight - 200, Math.max(16, r.top - 20));
  p.style.left = x + 'px'; p.style.top = y + 'px';
  p.querySelector('[data-goengine]')?.addEventListener('click', () => { closePop(); setView('engine'); });
}
const closePop = () => $('#pop').classList.remove('on');

// ---------- newsflash: turning points only; closes itself after 4 s, never needs an OK ----------
function flash({ band = 'Turning point', title, body, label = '', at }) {
  const f = $('#flash');
  $('#fband').textContent = band; $('#fq').textContent = qName(cur);
  $('#fh').textContent = title; $('#fp').textContent = body; $('#fshift').innerHTML = label;
  f.classList.remove('on', 'run'); void f.offsetWidth; f.classList.add('on');
  if (!REDUCED) f.classList.add('run'); // with reduced motion it stays until dismissed
  if (at && !REDUCED) g.pointOfView({ lat: at[0], lng: at[1] }, 1200);
}
const closeFlash = () => $('#flash').classList.remove('on', 'run');
$('#flash .timer i').addEventListener('animationend', closeFlash);
$('#flash').onclick = closeFlash;
function milestoneFlashes(i) {
  const b = DC.bulletin.find(x => +x.year === Q[i].y && Q[i].q === 1 && i <= TODAY);
  if (b) flash({ band: 'On the record', title: `The Doomsday Clock moves to ${b.s} seconds`, body: `The Bulletin of the Atomic Scientists, January ${b.year}. It covers every risk and is set once a year by experts. Our clock covers AI alone and is set by markets daily.`, label: REALL, at: [41.9, -87.6] });
  if (i === TODAY) flash({ band: 'Today', title: 'The real record ends here', body: 'From here on you are watching one of 10,000 simulated futures. The clock in the corner is the real forecast, and no future moves it.' });
  if (i > TODAY && inQ(FUT.asi, i)) flash({ title: `A lab builds superintelligence in ${ym(FUT.asi)}`, body: `In this future. The date is drawn from the market curve: ${Math.round(KP[1] * 100)}% by the end of 2030 and ${Math.round(KP[2] * 100)}% by the end of 2040.`, label: SIM, at: [37.8, -122.4] });
  if (i > TODAY && inQ(FUT.cat, i)) flash({ band: 'Catastrophe · this future', title: `AI catastrophe, ${ym(FUT.cat)}`, body: `${(FUT.cat - FUT.asi).toFixed(1)} years after superintelligence. One sampled future, not the forecast: by this date ${Math.round(pCatAt(FUT.cat) * 100)}% of all futures have gone wrong.`, label: SIM, at: [33, -112] });
}

// ---------- quarter state, ticker, time spine ----------
let cur = 0, playing = false, speed = 1, timer = null, intro = !params.has('q');
const QMS = 2400;
const ended = i => i > TODAY && FUT.cat <= decYear(qEnd(i));
function renderTicker(i) {
  const evs = eventsFor(i), real = i <= TODAY, run = $('#trun'), lab = $('#tlab');
  lab.className = 'lab dc-label dc-label--' + (real ? 'real' : 'sim'); lab.textContent = real ? 'Real news' : 'Simulated';
  const item = e => `<span class="it${real ? '' : ' sim'}"><span class="dc-data">${esc(e.d)}</span>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.t)}</a>` : `${e.who ? `<span>@${esc(e.who.handle)}:</span>` : ''}<span>${esc(e.t.length > 150 ? e.t.slice(0, 150) + '…' : e.t)}</span>`}</span>`;
  const after = i > TODAY && FUT.cat < decYear(Q[i].start);
  const list = after ? `<span class="it dc-dim">This future ended in ${ym(FUT.cat)}. Roll another to watch a different one.</span>`
    : evs.length ? evs.slice(0, 14).map(item).join('') : '<span class="it dc-dim">No events this quarter</span>';
  const go = !REDUCED && !after && evs.length > 0;
  run.innerHTML = go ? list + list : list; run.classList.toggle('go', go);
  if (go) run.style.animationDuration = Math.max(20, run.scrollWidth / 2 / 70) + 's';
}
const pos = i => (i / (Q.length - 1) * 100) + '%';
// The Bulletin's spine on its side: solid ink up to today, dashed sim after, one big year at a time.
function buildSpine() {
  const ai = qOf(FUT.asi), ci = qOf(FUT.cat), keyYears = new Set([ai > TODAY && Q[ai].y, ci > TODAY && Q[ci].y]);
  let s = `<div class="axis" style="width:${pos(TODAY)}"></div><div class="proj" style="left:${pos(TODAY)}"></div>`;
  if (ci > TODAY) s += `<div class="ended" style="left:${pos(ci)}"></div>`;
  Q.forEach((x, i) => { if (x.q !== 1) return; const k = keyYears.has(x.y) ? ' key' : '';
    s += `<div class="node${k}" style="left:${pos(i)}"></div><div class="yr${k}" style="left:${pos(i)}">${x.y}</div>`; });
  s += `<div class="node today" style="left:${pos(TODAY)}"></div><div class="tag today" data-i="${TODAY}" style="left:${pos(TODAY)}">Today</div>`;
  if (ai > TODAY) s += `<div class="node key" style="left:${pos(ai)}" title="This future: superintelligence, ${ym(FUT.asi)}"></div>`;
  if (ci > TODAY) s += `<div class="node end" style="left:${pos(ci)}" title="This future: catastrophe, ${ym(FUT.cat)}"></div><div class="tag cat" data-i="${ci}" style="left:${pos(ci)}">✕ Catastrophe, this future</div>`;
  s += '<div class="node on"></div><div class="big"></div>';
  $('#scrub').innerHTML = s;
  placeHead();
}
function placeHead() {
  const s = $('#scrub'), pct = cur / (Q.length - 1) * 100;
  s.querySelector('.node.on').style.left = pct + '%';
  const big = s.querySelector('.big');
  big.style.left = pct + '%'; big.style.transform = `translateX(-${pct}%)`; // stays inside the spine at both ends
  big.innerHTML = `<small>Q${Q[cur].q}${cur === TODAY ? ' · today' : ''}</small>${Q[cur].y}`;
  s.querySelectorAll('.tag').forEach(t => t.style.visibility = Math.abs(+t.dataset.i - cur) < 4 ? 'hidden' : '');
  s.setAttribute('aria-valuetext', qName(cur));
}
function setQuarter(i, { live = false } = {}) {
  cur = Math.max(0, Math.min(Q.length - 1, i));
  document.body.classList.toggle('ended', ended(cur));
  paintGlobe(cur); placeHouses(cur); renderTicker(cur); placeHead();
  if (document.body.classList.contains('engine')) { renderEngineHead(); renderSociety(); }
  clearBubs();
  const evs = eventsFor(cur).filter(e => e.lat != null).slice(0, 8);
  if (live) {
    evs.forEach((e, k) => setTimeout(() => { if (cur === i) { ping(e); bubble(e); } }, (k + .3) / evs.length * QMS / speed * .9));
    milestoneFlashes(cur);
  } else evs.forEach(bubble);
}
function wireSpine() {
  const s = $('#scrub'), at = ev => { const r = s.getBoundingClientRect(); return Math.round((ev.clientX - r.left) / r.width * (Q.length - 1)); };
  let drag = false;
  s.addEventListener('pointerdown', e => { drag = true; s.classList.add('drag'); s.setPointerCapture(e.pointerId); pause(); hideCoach(); setQuarter(at(e)); });
  s.addEventListener('pointermove', e => { if (drag) { const i = at(e); if (i !== cur) setQuarter(i); } });
  s.addEventListener('pointerup', () => { drag = false; s.classList.remove('drag'); });
}
const PLAY = '<svg viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z"/></svg>', PAUSE = '<svg viewBox="0 0 14 14"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z"/></svg>';
function step() {
  if (cur >= Q.length - 1) return pause();
  setQuarter(cur + 1, { live: true });
  if (cur === TODAY && intro) { intro = false; pause(); setTimeout(() => coach('Press <b>Space</b> to play this future, or <b>R</b> to roll another'), 4300); }
  if (cur > TODAY && inQ(FUT.cat, cur)) pause(); // the watched future ends here
}
function play() { if (cur >= Q.length - 1 || (cur > TODAY && FUT.cat < decYear(Q[cur].start))) setQuarter(TODAY); playing = true; $('#play').innerHTML = PAUSE; $('#play').setAttribute('aria-label', 'Pause'); clearInterval(timer); timer = setInterval(step, QMS / speed); }
function pause() { playing = false; $('#play').innerHTML = PLAY; $('#play').setAttribute('aria-label', 'Play'); clearInterval(timer); }
$('#play').onclick = () => { hideCoach(); playing ? pause() : play(); };
const press = (sel, on) => $$(sel).forEach(b => b.setAttribute('aria-pressed', String(on(b))));
const setSpeed = s => { speed = s; press('#speed button', b => +b.dataset.s === s); if (playing) play(); };
$('#speed').onclick = e => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.s); };
const coach = h => { const c = $('#coach'); c.innerHTML = h; c.classList.remove('hide'); };
const hideCoach = () => $('#coach').classList.add('hide');

// ---------- the watched future ----------
function renderFuture() {
  const p = FUT, later = Math.round((1 - (p.rank + 1) / N) * 100);
  $('#fname').textContent = `Future #${fmt(p.id)}`;
  $('#fsub').textContent = p.cat < Infinity ? `Earlier than ${later}% of futures.` : `No catastrophe by 2100, like ${Math.round(SHARE_NO_CAT * 100)}% of futures.`;
  $('#fms').innerHTML = `<div><span class="dc-dim">Superintelligence</span><b>${p.asi < Infinity ? ym(p.asi) : 'not by 2100'}</b></div>`
    + (p.cat < Infinity ? `<div><span style="color:var(--alarm)">✕ Catastrophe</span><b>${ym(p.cat)}</b></div>` : `<div class="none"><span>✕ Catastrophe</span><b>none by 2100</b></div>`);
  $('#fseed').textContent = `sim.ts · seed 1 · path ${p.id}`;
  press('#fpick button', b => Math.abs(+b.dataset.q - p.rank / N) < .0002);
}
function watch(p) { FUT = p; renderFuture(); buildSpine(); renderSociety(); if (document.body.classList.contains('engine')) renderEngineHead(); setQuarter(Math.min(cur, TODAY)); }
$('#roll').onclick = () => { hideCoach(); watch(PATHS[Math.floor(Math.random() * N)]); };
$('#fpick').onclick = e => { const b = e.target.closest('button'); if (b) { hideCoach(); watch(byPct(+b.dataset.q)); } };

// ---------- engine: the MiroFish society for the watched future ----------
const ROLEORDER = { gov: 0, media: 1, lab: 2, other: 3 };
function renderSociety() {
  const m = memberFor(FUT), q = Math.max(cur, TODAY + 1), r = DC.runs[(q - TODAY - 1) % DC.runs.length];
  const mx = Math.max(...r.rounds.map(x => x.actions)), acts = r.rounds.slice(1).reduce((a, x) => a + x.actions, 0);
  $('#society').innerHTML = `
    <h3 class="eyebrow">Society <span class="dc-data">nearest of 5</span></h3>
    <div class="members">${ENSEMBLE.map(e => `<button data-k="${e.k}" aria-pressed="${e === m}"><span class="dc-data">#${e.k}</span><span>${Math.round(e.q * 100)}th pct · ${e.path.cat < Infinity ? 'ends ' + ym(e.path.cat) : 'no catastrophe'}</span></button>`).join('')}</div>
    <h3 class="eyebrow">Run stats <span class="dc-data">${qName(q)}</span></h3>
    <div class="run"><div class="nums"><div><b>${r.rounds.length - 1}</b>rounds</div><div><b>${acts}</b>actions</div><div><b>${Math.round(r.wall_s)} s</b>time</div><div><b>$${r.cost.toFixed(3)}</b>cost</div></div>
      <div class="rounds" title="Actions per round (round 0 = seed posts)">${r.rounds.map(x => `<i style="height:${x.actions / mx * 100}%"></i>`).join('')}</div></div>
    <div class="dc-faint">Mockup: two real spike runs stand in for every quarter and future.</div>`;
  $('#society .members').onclick = e => { const b = e.target.closest('button'); if (b) watch(ENSEMBLE[+b.dataset.k - 1].path); };
}
const placeSociety = () => document.body.style.setProperty('--soc-top', ($('#clock').getBoundingClientRect().bottom + 12) + 'px');
function renderEngineHead() {
  const q = Math.max(cur, TODAY + 1);
  $('#ehead').textContent = `The society under Future #${fmt(FUT.id)}, ${qName(q)}${cur <= TODAY ? ' (the first simulated quarter)' : ''}`;
}
function postHTML(p, { seed = '' } = {}) {
  const c = castById[p.uid], quote = p.quote && p.quote !== 'None' && p.quote !== 'null';
  return `<div class="post${seed ? ' seed' : ''}" data-uid="${p.uid}">${av(c)}<div style="min-width:0">
    <div class="who"><b>${esc(c?.name)}</b><span>${ROLENAME[ROLE(c?.type)]}</span><span>${seed ? esc(seed) : 'round ' + esc(p.round)}</span></div>
    <div class="tx">${esc(quote ? p.quote : p.text)}</div>${quote ? `<div class="qt">${esc(p.text)}</div>` : ''}
    ${seed ? '' : `<div class="meta dc-data"><span>♡ ${p.likes ?? 0}</span><span>↻ ${p.shares ?? 0}</span></div>`}</div></div>`;
}
function renderEngine() {
  const x = [...DC.feed].sort((a, b) => b.round - a.round);
  const carry = DC.injected.filter(e => e.kind === 'carry_over');
  $('#xfeed').innerHTML = x.map(p => postHTML(p)).join('') + carry.map(p => postHTML(p, { seed: 'carried over from last quarter' })).join('');
  $('#nx').textContent = `${x.length} posts`;
  const seeds = DC.injected.filter(e => e.kind !== 'carry_over'), gn = DC.feed.filter(p => ['gov', 'media'].includes(ROLE(castById[p.uid]?.type)));
  $('#gnfeed').innerHTML = seeds.map(p => postHTML(p, { seed: "this future's event, seeded" })).join('') + gn.map(p => postHTML(p)).join('');
  $('#ngn').textContent = `${seeds.length} seeded · ${gn.length} posts`;
  const cast = [...DC.cast].sort((a, b) => ROLEORDER[ROLE(a.type)] - ROLEORDER[ROLE(b.type)] || b.influence - a.influence);
  $('#cast').innerHTML = cast.map(c => `<div class="ag" data-uid="${c.id}" title="${esc(c.bio)}"><i style="background:${ROLESHADE[ROLE(c.type)]}"></i><div style="min-width:0"><b>${esc(c.name)}</b>${esc(c.type)} · ${esc(c.stance)}</div><span class="dc-data">${c.influence.toFixed(1)}</span></div>`).join('');
  $('#ncast').textContent = `${DC.cast.length} accounts`;
  $$('.ag').forEach(a => {
    a.onmouseenter = () => { hlName = castById[a.dataset.uid]?.name; drawKG(); $$(`.post[data-uid="${a.dataset.uid}"]`).forEach(p => p.classList.add('hl')); };
    a.onmouseleave = () => { hlName = null; drawKG(); $$('.post.hl').forEach(p => p.classList.remove('hl')); };
  });
  $('#kglegend').innerHTML = ['gov', 'media', 'lab', 'other'].map(r => `<span><i style="background:${ROLESHADE[r]}"></i>${ROLENAME[r]}</span>`).join('') + `<span><i style="border:1.5px solid ${tok('sim')}"></i>MiroFish account</span>`;
}
$('#etabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#engine').dataset.tab = b.dataset.t; press('#etabs button', x => x === b); requestAnimationFrame(drawKG); };

// knowledge graph: a small force layout, computed once
const KGROLE = l => ({ GovernmentAgency: 'gov', Policymaker: 'gov', MediaOutlet: 'media', Journalist: 'media', Ailab: 'lab' }[l] || 'other');
const KN = DC.graph.nodes.map((n, i) => ({ ...n, x: Math.cos(i * 2.4) * (30 + i % 50), y: Math.sin(i * 2.4) * (30 + i % 50), vx: 0, vy: 0 }));
const KI = Object.fromEntries(KN.map((n, i) => [n.id, i]));
const KE = DC.graph.edges.map(e => [KI[e.s], KI[e.t]]).filter(([a, b]) => a != null && b != null);
const castNames = new Set(DC.cast.map(c => c.name));
const deg = KN.map(() => 0); KE.forEach(([a, b]) => { deg[a]++; deg[b]++; });
(function layout() {
  for (let it = 0; it < 260; it++) {
    const cool = 1 - it / 260;
    for (let i = 0; i < KN.length; i++) for (let j = i + 1; j < KN.length; j++) {
      const a = KN[i], b = KN[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01; if (d2 > 40000) continue;
      const f = 140 / d2; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
    KE.forEach(([i, j]) => { const a = KN[i], b = KN[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + .01, f = (d - 26) * .02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; });
    KN.forEach(n => { n.vx -= n.x * .004; n.vy -= n.y * .004; n.x += n.vx * cool; n.y += n.vy * cool; n.vx *= .55; n.vy *= .55; });
  }
})();
let hlName = null, kgHover = null, kgMap = null;
const KGC = { edge: tok('rule'), lit: tok('ink'), entity: tok('rule'), sim: tok('sim'), ink: tok('ink') };
function drawKG() {
  const cv = $('#kg'), r = cv.getBoundingClientRect(); if (!r.width) return;
  const dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, r.width, r.height);
  const xs = KN.map(n => n.x), ys = KN.map(n => n.y), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 16, sc = Math.min((r.width - 2 * pad) / (x1 - x0), (r.height - 2 * pad - 22) / (y1 - y0));
  const ox = (r.width - (x1 - x0) * sc) / 2, P = n => [ox + (n.x - x0) * sc, pad + (n.y - y0) * sc];
  kgMap = { P };
  const hi = hlName ? KN.findIndex(n => n.name === hlName) : kgHover, on = hi != null && hi >= 0;
  const nb = new Set(); if (on) KE.forEach(([a, b]) => { if (a === hi) nb.add(b); if (b === hi) nb.add(a); });
  KE.forEach(([a, b]) => { const [ax, ay] = P(KN[a]), [bx, by] = P(KN[b]), lit = hi === a || hi === b;
    c.strokeStyle = lit ? KGC.lit : KGC.edge; c.lineWidth = lit ? 1.2 : .7; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); });
  KN.forEach((n, i) => { const [x, y] = P(n), cast = castNames.has(n.name), rad = (cast ? 4 : 2) + Math.min(3.5, deg[i] * .3);
    c.globalAlpha = on && i !== hi && !nb.has(i) ? .2 : 1;
    c.fillStyle = n.label === 'Entity' ? KGC.entity : ROLESHADE[KGROLE(n.label)]; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
    if (cast) { c.strokeStyle = KGC.sim; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, rad + 2.5, 0, 7); c.stroke(); }
    if (i === hi || (on && nb.has(i) && cast)) { c.fillStyle = KGC.ink; c.font = '12px -apple-system,system-ui'; c.fillText(n.name.slice(0, 30), x + rad + 5, y + 4); }
    c.globalAlpha = 1; });
}
$('#kg').addEventListener('mousemove', e => {
  if (!kgMap) return; const r = e.currentTarget.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bd = 120; KN.forEach((n, i) => { const [x, y] = kgMap.P(n), d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = i; } });
  if (best !== kgHover) { kgHover = best; drawKG(); }
  const tt = $('#tooltip'); if (best == null) { tt.style.display = 'none'; return; }
  const n = KN[best]; tt.innerHTML = `<b>${esc(n.name)}</b> <span class="dc-faint">${esc(n.label)}</span><br><span class="dc-dim">${esc((n.summary || '').slice(0, 220))}</span>`;
  tt.style.display = 'block'; tt.style.left = Math.min(innerWidth - 320, e.clientX + 14) + 'px'; tt.style.top = (e.clientY + 12) + 'px';
});
$('#kg').addEventListener('mouseleave', () => { kgHover = null; $('#tooltip').style.display = 'none'; drawKG(); });

// ---------- Why this time? (a Paper sheet, one step at a time) ----------
function fanSVG() {
  const W = 600, H = 250, L = 40, B = 26, T = 14, Rr = 10, X0 = 2026.8, X1 = 2046;
  const x = y => L + (y - X0) / (X1 - X0) * (W - L - Rr), yv = p => T + (1 - p / .3) * (H - T - B);
  const pts = f => [[X0, 0], ...f.filter(([yy]) => yy > X0 && yy <= X1)];
  const line = f => pts(f).map(([yy, p], i) => `${i ? 'L' : 'M'}${x(yy).toFixed(1)},${yv(p).toFixed(1)}`).join('');
  const band = line(DC.fan.lag1.fan) + pts(DC.fan.lag10.fan).reverse().map(([yy, p]) => `L${x(yy).toFixed(1)},${yv(p).toFixed(1)}`).join('') + 'Z';
  const txt = 'style="fill:var(--ink-3);font:400 12px var(--font-sans)"';
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" id="fansvg" role="img" aria-label="Share of futures gone wrong by year">`;
  [0, .1, .2, .3].forEach(p => s += `<line x1="${L}" x2="${W - Rr}" y1="${yv(p)}" y2="${yv(p)}" style="stroke:${p === .1 ? 'var(--ink-3)' : 'var(--rule)'}" ${p === .1 ? 'stroke-dasharray="4 3"' : ''}/><text x="${L - 8}" y="${yv(p) + 4}" ${txt} text-anchor="end">${p * 100}%</text>`);
  [2030, 2035, 2040, 2045].forEach(yy => s += `<text x="${x(yy)}" y="${H - 6}" ${txt} text-anchor="middle">${yy}</text>`);
  const cx = x(decYear(DATE10));
  s += `<path d="${band}" style="fill:var(--ink);fill-opacity:.1"/><path d="${line(DC.fan.lag3.fan)}" style="stroke:var(--ink);stroke-width:2;fill:none;stroke-linejoin:round"/>
    <line x1="${cx}" x2="${cx}" y1="${yv(.1)}" y2="${H - B}" style="stroke:var(--ink-3)" stroke-dasharray="2 3"/><circle cx="${cx}" cy="${yv(.1)}" r="5" style="fill:var(--ink);stroke:var(--ground);stroke-width:2"/>
    <text x="${cx - 9}" y="${yv(.1) - 9}" style="fill:var(--ink);font:600 12px var(--font-sans)" text-anchor="end">1 in 10</text>
    <line id="fanx" x1="0" x2="0" y1="${T}" y2="${H - B}" style="stroke:var(--ink-2)" visibility="hidden"/><circle id="fand" r="4" style="fill:var(--ink)" visibility="hidden"/>
    <rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - B}" fill="transparent" id="fanhit"/></svg>`;
  return { s, x, yv, X0, X1, L, W, Rr };
}
const anchors = () => [
  ['Superintelligence by the end of 2030', KP[1], 'Manifold · if no catastrophe comes first'],
  ['Superintelligence by the end of 2040', KP[2], 'Manifold'],
  ['Superintelligence by 2100', KP[3], 'Manifold'],
  ['AI kills at least 10% of people by 2100', DC.fan.inputs.pCat2100, 'Manifold · only 19 traders, the thinnest input'],
];
const STEPS = {
  anchors: () => `<div class="lede">${REALL}<span class="dc-data">read 24 Oct 2026</span></div>
    <h3>Real money sets the anchors</h3>
    <p>Four prediction-market prices go in. No model and no opinion is added at this step.</p>
    <div>${anchors().map(([q, p, s]) => `<div class="anc"><div>${q}</div><b>${Math.round(p * 100)}%</b><span>${s}</span></div>`).join('')}
      <div class="anc"><div>Gap from superintelligence to catastrophe</div><b>3 y</b><span><span class="dc-label dc-label--rule">Game rule</span> No market backs it, so the clock shows 1 to 10 years as a range.</span></div></div>
    <a class="next" href="#" data-go="fan">Next: 10,000 futures</a>`,
  fan: () => { const f = fanSVG(); return `<div class="lede">${REALL.replace('Real', 'Real forecast')}<span class="dc-data">sim.ts · seed 1 · 10,000 paths</span></div>
    <h3>10,000 futures</h3>
    <p>Each future draws when superintelligence arrives, whether it goes wrong, and how long the gap is. The line is the share that have gone wrong by each year. The shading is a gap of 1 to 10 years.</p>
    <div class="fan">${f.s}<div class="tip dc-panel" id="fantip"></div></div>
    <p class="dc-dim" style="font:var(--type-body)">By 2100, ${Math.round(DC.fan.lag3.pCat2100 * 100)}% of futures go wrong and ${Math.round(SHARE_NO_CAT * 100)}% never do. The globe plays one of these futures at a time.</p>
    <a class="next" href="#" data-go="date">Next: the date</a>`; },
  date: () => `<div class="lede">${REALL.replace('Real', 'Real forecast')}</div>
    <h3>December 2032<span class="dc-mock">mock</span></h3>
    <p>The first date on which 1 in 10 futures has gone wrong. Below, 400 squares stand for the 10,000 futures, 25 each. By then, 40 are red.</p>
    <div class="waffle" role="img" aria-label="40 of 400 squares red">${Array.from({ length: 400 }, (_, i) => `<i class="${i < 40 ? 'c' : ''}"></i>`).join('')}</div>
    <p class="dc-dim" style="font:var(--type-body)">With a gap of 1 year it is ${ym(LAG_RANGE[0])}, and with 10 years it is ${ym(LAG_RANGE[1])}. This mockup's own run crosses in ${ym(p10(DC.fan.lag3.fan))}.</p>
    <a class="next" href="#" data-go="hand">Next: the hand</a>`,
  hand: () => `<div class="lede">${REALL.replace('Real', 'Real forecast')}<span class="dc-faint">1 min = 1 year</span></div>
    <div style="width:240px">${clockFace()}</div>
    <h3>${MINUTES} Minutes to Midnight</h3>
    <p>December 2032 is ${MIN_TO_MIDNIGHT.toFixed(1)} years away, so the hand sits ${MIN_TO_MIDNIGHT.toFixed(1)} minutes from midnight. The grey band is the 1 to 10 year range.</p>
    <p>The dashed tick is the Bulletin's ${BULLETIN_S} seconds from January 2026. They cover every risk and meet once a year. Our hand covers AI alone and moves with the markets every day.</p>
    <a href="#" data-go="track">See the track record</a>
    <p class="verdict">A prediction, not a prophecy.</p>`,
};
function showStep(k) {
  press('#whytabs button', b => b.dataset.s === k);
  $('#story').innerHTML = STEPS[k]();
  $('#why .sheet').scrollTop = 0;
  if (k === 'fan') wireFan();
}
function wireFan() {
  const svg = $('#fansvg'), hit = $('#fanhit'), tip = $('#fantip'), f = fanSVG();
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), k = f.W / r.width, px = (e.clientX - r.left) * k;
    const yr = Math.max(f.X0, Math.min(f.X1, f.X0 + (px - f.L) / (f.W - f.L - f.Rr) * (f.X1 - f.X0)));
    const p = pCatAt(yr), lo = pCatAt(yr, DC.fan.lag10.fan), hi = pCatAt(yr, DC.fan.lag1.fan), X = f.x(yr);
    $('#fanx').setAttribute('x1', X); $('#fanx').setAttribute('x2', X); $('#fanx').setAttribute('visibility', 'visible');
    $('#fand').setAttribute('cx', X); $('#fand').setAttribute('cy', f.yv(p)); $('#fand').setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${ym(yr)}</b> · ${(p * 100).toFixed(1)}% of futures gone wrong<br><span class="dc-dim">${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}% if the gap is 10 or 1 years</span>`;
    tip.style.display = 'block'; tip.style.left = Math.min(r.width - 280, Math.max(0, X / k - 130)) + 'px';
  });
  hit.addEventListener('pointerleave', () => { tip.style.display = 'none'; $('#fanx').setAttribute('visibility', 'hidden'); $('#fand').setAttribute('visibility', 'hidden'); });
}
$('#whytabs').onclick = e => { const b = e.target.closest('button'); if (b) showStep(b.dataset.s); };
$('#story').onclick = e => { const a = e.target.closest('[data-go]'); if (!a) return; e.preventDefault();
  if (a.dataset.go === 'track') { closeAll(); openModal('#track'); } else showStep(a.dataset.go); };

// ---------- Track record (Paper, fixture cards) ----------
function renderTrack() {
  const rows = [['1 Nov 2025', 6.5, '0.197', '0.206'], ['1 Jul 2025', 6.9, '0.221', '0.219'], ['1 Mar 2025', 7.4, '0.208', '0.214']]; // fixture, newest first
  $('#cards').innerHTML = rows.map(([t, m, panel, market]) => `<article class="dc-card"><div class="glyph">${DoomClock.face({ minutes: m, labels: false })}</div>
    <div class="yr">${t}</div><div class="read">It read ${Math.round(m)} minutes to midnight</div>
    <div class="score">Panel ${panel} · market ${market} · coin 0.250 Brier<span class="dc-mock">mock</span></div>
    <button class="dc-btn dc-btn--outline">Open this checkpoint</button></article>`).join('');
}

// ---------- wiring ----------
function setView(v) {
  document.body.classList.toggle('engine', v === 'engine');
  press('#viewseg button', b => b.dataset.view === v);
  ctl.autoRotate = !REDUCED && v === 'world';
  if (v === 'engine') { renderEngineHead(); renderSociety(); placeSociety(); requestAnimationFrame(drawKG); }
  closePop(); hideCoach();
}
const setVariant = v => { document.body.classList.toggle('ov', v === 'ov'); press('#evar button', b => b.dataset.v === v); requestAnimationFrame(drawKG); };
$('#viewseg').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); };
$('#evar').onclick = e => { const b = e.target.closest('button'); if (b) { setVariant(b.dataset.v); setView('engine'); } };
const openModal = (id, step) => { if (id === '#why') showStep(step || 'anchors'); $(id).classList.add('on'); pause(); closeFlash(); };
const closeAll = () => { $$('.scrim').forEach(s => s.classList.remove('on')); $$('.pop').forEach(p => p.classList.remove('on')); closePop(); };
$('#clock').onclick = () => openModal('#why');
$('#clock').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openModal('#why'); } };
$$('.scrim').forEach(s => s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) s.classList.remove('on'); }));
const toggle = (id, e) => { e.stopPropagation(); const on = !$(id).classList.contains('on'); $$('.pop').forEach(p => p.classList.remove('on')); $(id).classList.toggle('on', on); };
$('#keybtn').onclick = e => toggle('#keypop', e);
$('#review').onclick = e => toggle('#revpop', e);
document.addEventListener('click', e => { if (!e.target.closest('.pop, #pop, .bub')) { $$('.pop').forEach(p => p.classList.remove('on')); closePop(); } });
$('#jumps').onclick = e => { const b = e.target.closest('button'); if (!b) return; const j = b.dataset.j; pause(); hideCoach(); intro = false;
  if (j === 'start') setQuarter(0); if (j === 'today') setQuarter(TODAY);
  if (j === 'asi' && qOf(FUT.asi) > TODAY) { setQuarter(qOf(FUT.asi) - 1); setSpeed(1); play(); }
  if (j === 'cat' && qOf(FUT.cat) > TODAY) { setQuarter(qOf(FUT.cat) - 1); setSpeed(1); play(); }
  if (j === 'why') openModal('#why'); if (j === 'track') openModal('#track'); };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input,textarea')) return;
  if (e.key === 'Escape') return closeAll();
  if ($$('.scrim.on').length) return;
  const k = e.key.toLowerCase();
  if (k === 'e') setView(document.body.classList.contains('engine') ? 'world' : 'engine');
  else if (k === 'w') setView('world');
  else if (k === 'r') $('#roll').click();
  else if (e.key === ' ' && !e.target.closest('button,[role=button]')) { e.preventDefault(); hideCoach(); playing ? pause() : play(); }
  else if (e.key === 'ArrowRight') { pause(); hideCoach(); setQuarter(cur + 1, { live: true }); }
  else if (e.key === 'ArrowLeft') { pause(); hideCoach(); setQuarter(cur - 1); }
});
addEventListener('resize', () => document.body.classList.contains('engine') && drawKG());

// ---------- start ----------
$('#play').innerHTML = PLAY;
$('#thumb').innerHTML = DoomClock.face({ minutes: MIN_TO_MIDNIGHT, labels: false });
$('#thumbcap').textContent = `It is ${MINUTES} minutes to midnight`;
fit(); renderFuture(); renderClock(); tickClock(); renderTrack(); renderSociety(); renderEngine(); buildSpine(); wireSpine();
setQuarter(0);
if (params.has('q')) setQuarter(+params.get('q'));
else { setSpeed(2); play(); } // opening: replay the real record at 2x, then stop at today
if (params.get('layout') === 'overlay') setVariant('ov');
if (params.get('view') === 'engine') setView('engine');
if (params.get('tab')) $(`#etabs [data-t="${params.get('tab')}"]`)?.click();
if (params.has('why')) openModal('#why', params.get('why'));
if (params.has('track')) openModal('#track');
if (params.get('flash')) milestoneFlashes(cur);
