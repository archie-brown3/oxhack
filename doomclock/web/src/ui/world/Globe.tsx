// The globe: hex-dot land tinted by frontier activity, flat datacentre markers, rings and
// clickable bubbles for the quarter's events, and a country flare for major events.
// Monochrome Stage: land runs ink-3 to ink-2 (capped so solid ink event rings stay visible).
import Globe, { type GlobeInstance } from 'globe.gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorldFrame } from '../../contracts.ts'
import type { Countries, Datacentre } from '../../app/data.ts'
import type { Flare, Located } from './locate.ts'
import { bySeverity, MAX_MAJOR_TITLES, severityOf, shortLabel } from './severity.ts'
import './globe-zoom.css'

// A token's colour as [r, g, b], resolved by the browser (the minifier may write #808080 as "gray").
const rgb = (n: string) => {
  const el = document.createElement('i')
  el.style.color = `var(--${n})`
  document.body.append(el)
  const c = getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number)
  el.remove()
  return c
}
const tok = (n: string) => `rgb(${rgb(n).join(',')})`
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_ALTITUDE = 0.35
const ZOOM_STEP = 1.25
const TEX_W = 512, TEX_H = 256

type Vec = [number, number, number]
const unit = (lat: number, lng: number): Vec => {
  const a = (lat * Math.PI) / 180, b = (lng * Math.PI) / 180
  return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]
}

// The red grows out of the datacentre sites: a disc of radius R° around each, soft at the edge.
// R is a few degrees at today's setting and passes 180° at midnight, so the whole map is red.
function redField(sites: Vec[], closeness: number) {
  const R = 2 + 300 * closeness ** 12
  const strength = 0.55 + 0.45 * closeness
  return ([x, y, z]: Vec) => {
    let best = -1
    for (const [a, b, c] of sites) best = Math.max(best, a * x + b * y + c * z)
    const d = (Math.acos(Math.min(1, best)) * 180) / Math.PI
    return Math.max(0, Math.min(1, (R - d) / (0.35 * R))) * strength
  }
}

let pixels: Float32Array | null = null // unit vector of every texture pixel, built once
const pixelVectors = () => {
  if (pixels) return pixels
  pixels = new Float32Array(TEX_W * TEX_H * 3)
  for (let y = 0; y < TEX_H; y++) for (let x = 0; x < TEX_W; x++) {
    const v = unit(90 - ((y + 0.5) / TEX_H) * 180, ((x + 0.5) / TEX_W) * 360 - 180)
    pixels.set(v, (y * TEX_W + x) * 3)
  }
  return pixels
}

/** Up to ~30 vertices of a country's outline, to average the red field over it. */
const outline = ({ geometry: g }: Countries['features'][number]): Vec[] => {
  const rings = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
  const pts = rings.flatMap((poly) => poly[0] ?? [])
  const step = Math.max(1, Math.floor(pts.length / 30))
  return pts.filter((_, i) => i % step === 0).map(([lng, lat]) => unit(lat, lng))
}


interface Props {
  hidden?: boolean
  countries: Countries
  dcs: Datacentre[]
  frame: WorldFrame
  /** How close the clock the user sees is to midnight, 0..1. The red grows from the datacentres with it. */
  closeness: number
  /** Catastrophe has happened in the watched future by the end of this frame. */
  ended: boolean
  events: Located[]
  /** Stagger the pings across `spanMs` (playing) or show them at once (scrubbing). */
  spanMs: number | null
  flare: Flare | null
  focus: [number, number] | null
  rotate: boolean
  onPick: (e: Located, anchor: HTMLElement) => void
}

export function GlobeView({ hidden, countries, dcs, frame, closeness, ended, events, spanMs, flare, focus, rotate, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const g = useRef<GlobeInstance | null>(null)
  const fittedAltitude = useRef(1)
  const maxAltitude = useRef(1)
  const [zoomLimits, setZoomLimits] = useState({ near: false, far: false })
  const pick = useRef(onPick)
  pick.current = onPick

  const zoom = (direction: 'in' | 'out' | 'reset') => {
    const globe = g.current
    if (!globe) return
    const current = globe.pointOfView().altitude
    const altitude = direction === 'reset' ? fittedAltitude.current
      : current * (direction === 'in' ? 1 / ZOOM_STEP : ZOOM_STEP)
    // Direct manipulation: no camera tween, including with reduced motion.
    globe.pointOfView({ altitude: Math.max(MIN_ALTITUDE, Math.min(maxAltitude.current, altitude)) })
  }

  useEffect(() => {
    const el = host.current!
    const globe = new Globe(el, { animateIn: false })
      .backgroundColor('rgba(0,0,0,0)').showAtmosphere(true).atmosphereColor(tok('ink-3')).atmosphereAltitude(0.08)
      .hexPolygonsData(countries.features.filter((f) => f.properties.ADM0_A3 !== 'ATA'))
      .hexPolygonResolution(3).hexPolygonMargin(0.3).hexPolygonUseDots(true).hexPolygonAltitude(0.004).hexPolygonsTransitionDuration(0)
      .pointLat('lat').pointLng('lon').pointAltitude(0.008).pointRadius(0.28).pointColor(() => tok('ink-2'))
      .pointLabel((d) => { const x = d as Datacentre; return `<div class="dc-panel" style="padding:8px 12px;max-width:260px"><b>${x.name}</b><br>${x.operator} · ${x.country}<br><span class="dc-faint">Publicly mapped site (Epoch AI), not compute share</span></div>` })
      .ringColor((r: object) => (t: number) => `rgba(${(r as { c: string }).c},${(1 - t) * 0.9})`).ringMaxRadius((r) => (r as { max: number }).max)
      .ringPropagationSpeed(2.5).ringRepeatPeriod(1100).ringAltitude(0.012)
      .htmlLat('lat').htmlLng('lng').htmlAltitude(0.015).htmlElement((d) => (d as { el: HTMLElement }).el).htmlTransitionDuration(0)
      .pointOfView({ lat: 26, lng: -40 })
    const mat = globe.globeMaterial() as unknown as { color: { set: (c: string) => void }; emissive?: { set: (c: string) => void }; shininess: number }
    mat.color.set('#ffffff'); mat.emissive?.set(tok('ground')); mat.shininess = 0
    const ctl = globe.controls()
    ctl.enableZoom = true; ctl.autoRotateSpeed = 0.3
    ctl.minDistance = globe.getGlobeRadius() * (1 + MIN_ALTITUDE)
    // A wheel/pinch/drag takes over from any event-focus camera sweep.
    const takeControl = () => globe.pointOfView(globe.pointOfView())
    ctl.addEventListener('start', takeControl)
    globe.onZoom(({ altitude }) => {
      const near = altitude <= MIN_ALTITUDE + 0.001
      const far = altitude >= maxAltitude.current - 0.001
      setZoomLimits((previous) => previous.near === near && previous.far === far ? previous : { near, far })
    })
    // The globe fills about 78% of the screen height: solve the camera altitude for that size.
    let fitted = false
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight
      if (!W || !H) return
      const relativeZoom = fitted ? globe.pointOfView().altitude / fittedAltitude.current : 1
      globe.width(W).height(H)
      const f = Math.min((0.78 * innerHeight) / H, (0.6 * W) / H, 0.92)
      const fov = (((globe.camera() as unknown as { fov?: number }).fov ?? 50) / 2) * (Math.PI / 180)
      fittedAltitude.current = 1 / Math.sin(Math.atan(f * Math.tan(fov))) - 1
      maxAltitude.current = fittedAltitude.current * 1.8
      ctl.maxDistance = globe.getGlobeRadius() * (1 + maxAltitude.current)
      globe.pointOfView({ altitude: Math.max(MIN_ALTITUDE, Math.min(maxAltitude.current, fittedAltitude.current * relativeZoom)) })
      fitted = true
    }
    fit()
    addEventListener('resize', fit)
    g.current = globe
    return () => { removeEventListener('resize', fit); ctl.removeEventListener('start', takeControl); globe._destructor(); el.replaceChildren(); g.current = null }
  }, [countries])

  useEffect(() => {
    const ctl = g.current?.controls()
    if (!ctl) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { ctl.autoRotate = rotate && !motion.matches; ctl.enableDamping = !motion.matches }
    sync()
    motion.addEventListener('change', sync)
    return () => motion.removeEventListener('change', sync)
  }, [rotate, countries])

  const sites = useMemo(() => {
    const end = Date.parse(frame.start) + 92 * 864e5
    return dcs.filter((d) => Date.parse(d.ts) < end).map((d) => unit(d.lat, d.lon))
  }, [frame.start, dcs])
  const field = useMemo(() => redField(sites, closeness), [sites, closeness])
  const outlines = useMemo(() => new Map(countries.features.map((f) => [f.properties.ADM0_A3, outline(f)])), [countries])

  // The sphere: the raised tone with the red field painted on it as a texture (offline, no image file).
  useEffect(() => {
    const globe = g.current
    if (!globe) return
    const base = rgb('raised'), red = rgb('alarm').map((v) => v * 0.55)
    const cv = document.createElement('canvas'); cv.width = TEX_W; cv.height = TEX_H
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(TEX_W, TEX_H), px = pixelVectors()
    for (let i = 0; i < TEX_W * TEX_H; i++) {
      const a = field([px[i * 3], px[i * 3 + 1], px[i * 3 + 2]])
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.round(base[k] + (red[k] - base[k]) * a)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    globe.globeImageUrl(cv.toDataURL())
  }, [field, countries])

  // Land tint: ink-3 → ink-2 by this future's frontier activity; alarm once it has ended.
  useEffect(() => {
    const globe = g.current
    if (!globe) return
    const lo = rgb('ink-3'), hi = rgb('ink-2'), redFull = rgb('alarm'), alarm = redFull.join(',')
    const fl = flare && new Set(flare.iso3), flc = flare && tok(flare.sim ? 'sim' : 'ink')
    const share = (iso: string) => (iso === 'USA' ? frame.regions.US : iso === 'CHN' ? frame.regions.China : frame.regions.rest)
    globe.hexPolygonColor((f) => {
      const iso = (f as { properties: { ADM0_A3: string } }).properties.ADM0_A3
      if (fl?.has(iso)) return flc!
      if (ended) return `rgba(${alarm},${(0.35 + share(iso) * 0.9).toFixed(2)})`
      const t = Math.min(1, share(iso) * 1.6 * (0.3 + 0.7 * frame.capability))
      const o = outlines.get(iso) ?? [], m = o.length ? o.reduce((n, v) => n + field(v), 0) / o.length : 0
      return `rgb(${lo.map((a, k) => { const grey = a + (hi[k] - a) * t; return Math.round(grey + (redFull[k] - grey) * m) }).join(',')})`
    })
  }, [frame, ended, flare, field, outlines])

  // Datacentres appear on the date they became public.
  useEffect(() => {
    const end = Date.parse(frame.start) + 92 * 864e5
    g.current?.pointsData(dcs.filter((d) => Date.parse(d.ts) < end))
  }, [frame, dcs])

  useEffect(() => {
    if (focus) g.current?.pointOfView({ lat: focus[0], lng: focus[1] }, REDUCED() ? 0 : 1200)
  }, [focus])

  // Rings and bubbles: solid ink = real, dashed sim = simulated or projected.
  useEffect(() => {
    const globe = g.current
    if (!globe) return
    const ringRgb = { real: rgb('ink').join(','), sim: rgb('sim').join(','), major: rgb('alarm').join(',') }
    let rings: object[] = [], bubs: object[] = []
    const timers: number[] = []
    // Severity drives legibility: major = title beside a large red ping (3 at most), moderate = a short
    // label (5 at most, so a busy real quarter stays readable), minor = a dot you hover or click.
    const sev = (e: Located) => severityOf(e)
    const list = [...events].sort(bySeverity).slice(0, 24)
    const majorTitled = new Set(list.filter((e) => sev(e) === 'major').slice(0, MAX_MAJOR_TITLES))
    const labelled = new Set(list.filter((e) => sev(e) === 'moderate').slice(0, 5))
    const add = (e: Located) => {
      const real = e.provenance === 'real'
      const s = sev(e)
      const kind = ['incident', 'government', 'news', 'post'].includes(e.kind) ? e.kind : 'news'
      const r = { lat: e.lat, lng: e.lng, c: s === 'major' ? ringRgb.major : real ? ringRgb.real : ringRgb.sim, max: s === 'major' ? 14 : s === 'moderate' ? 5 : 2.5 }
      rings = [...rings, r]; globe.ringsData(rings)
      timers.push(window.setTimeout(() => { rings = rings.filter((x) => x !== r); globe.ringsData(rings) }, 2000))
      const el = document.createElement('div')
      el.className = `bub kind-${kind} ${real ? 'real' : 'sim'} sev-${s}${s === 'major' ? ' major' : ''}`
      const label = `${kind}: ${e.title}`.replace(/"/g, '&quot;').slice(0, 110)
      const text = majorTitled.has(e) ? (e.title.length > 64 ? e.title.slice(0, 62) + '…' : e.title) : labelled.has(e) ? shortLabel(e.title) : ''
      el.innerHTML = `<button class="b" aria-label="${label}" title="${label}"><span aria-hidden="true"></span></button>`
      if (text) { const t = document.createElement('span'); t.className = 'lbl'; t.textContent = text; el.append(t) }
      el.onclick = (ev) => { ev.stopPropagation(); pick.current(e, el) }
      bubs = [...bubs, { lat: e.lat, lng: e.lng, el }].slice(-24); globe.htmlElementsData(bubs)
    }
    globe.htmlElementsData([]); globe.ringsData([])
    if (spanMs == null) list.forEach(add)
    else list.forEach((e, k) => timers.push(window.setTimeout(() => add(e), ((k + 0.3) / list.length) * spanMs * 0.9)))
    return () => timers.forEach(clearTimeout)
  }, [events, spanMs])

  return <>
    <div id="globe" ref={host} style={hidden ? { visibility: 'hidden' } : undefined} />
    <div className="globe-zoom" role="group" aria-label="Globe zoom" hidden={hidden}>
      <button type="button" aria-label="Zoom out" title={zoomLimits.far ? 'Minimum zoom reached' : 'Zoom out'} disabled={zoomLimits.far} onClick={() => zoom('out')}>−</button>
      <button type="button" aria-label="Zoom in" title={zoomLimits.near ? 'Maximum zoom reached' : 'Zoom in'} disabled={zoomLimits.near} onClick={() => zoom('in')}>+</button>
      <button type="button" aria-label="Reset globe zoom" title="Reset globe zoom" onClick={() => zoom('reset')}>Reset</button>
    </div>
  </>
}
