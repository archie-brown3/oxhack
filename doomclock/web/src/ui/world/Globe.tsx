// The globe: hex-dot land tinted by frontier activity, flat datacentre markers, rings and
// clickable bubbles for the quarter's events, and a country flare for major events.
// Monochrome Stage: land runs ink-3 to ink-2 (capped so solid ink event rings stay visible).
import Globe, { type GlobeInstance } from 'globe.gl'
import { useEffect, useRef, useState } from 'react'
import type { WorldEvent, WorldFrame } from '../../contracts.ts'
import type { Countries, Datacentre } from '../../app/data.ts'
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

export interface Located extends WorldEvent { lat: number; lng: number }
export interface Flare { iso3: string[]; sim: boolean }

/** Where an event sits on the map: its `where` country, else its region's main country. */
export function locate(e: WorldEvent, centroids: Map<string, [number, number]>): Located | null {
  const iso = e.where ?? (e.region === 'US' ? 'USA' : e.region === 'China' ? 'CHN' : null)
  const c = iso && centroids.get(iso)
  if (!c) return null
  let h = 0
  for (const ch of e.title) h = (h * 31 + ch.charCodeAt(0)) | 0
  const j = e.where ? 0 : 1 // spread region-only events a little so they don't stack
  return { ...e, lat: c[0] + j * (((h & 255) / 255) * 8 - 4), lng: c[1] + j * ((((h >> 8) & 255) / 255) * 14 - 7) }
}

interface Props {
  hidden?: boolean
  countries: Countries
  dcs: Datacentre[]
  frame: WorldFrame
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

export function GlobeView({ hidden, countries, dcs, frame, ended, events, spanMs, flare, focus, rotate, onPick }: Props) {
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
    mat.color.set(tok('raised')); mat.emissive?.set(tok('ground')); mat.shininess = 0
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

  // Land tint: ink-3 → ink-2 by this future's frontier activity; alarm once it has ended.
  useEffect(() => {
    const globe = g.current
    if (!globe) return
    const lo = rgb('ink-3'), hi = rgb('ink-2'), alarm = rgb('alarm').join(',')
    const fl = flare && new Set(flare.iso3), flc = flare && tok(flare.sim ? 'sim' : 'ink')
    const share = (iso: string) => (iso === 'USA' ? frame.regions.US : iso === 'CHN' ? frame.regions.China : frame.regions.rest)
    globe.hexPolygonColor((f) => {
      const iso = (f as { properties: { ADM0_A3: string } }).properties.ADM0_A3
      if (fl?.has(iso)) return flc!
      if (ended) return `rgba(${alarm},${(0.35 + share(iso) * 0.9).toFixed(2)})`
      const t = Math.min(1, share(iso) * 1.6 * (0.3 + 0.7 * frame.capability))
      return `rgb(${lo.map((a, k) => Math.round(a + (hi[k] - a) * t)).join(',')})`
    })
  }, [frame, ended, flare])

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
    const ringRgb = { real: rgb('ink').join(','), sim: rgb('sim').join(',') }
    let rings: object[] = [], bubs: object[] = []
    const timers: number[] = []
    const add = (e: Located) => {
      const real = e.provenance === 'real'
      const r = { lat: e.lat, lng: e.lng, c: real ? ringRgb.real : ringRgb.sim, max: e.major ? 14 : 5 }
      rings = [...rings, r]; globe.ringsData(rings)
      timers.push(window.setTimeout(() => { rings = rings.filter((x) => x !== r); globe.ringsData(rings) }, 2000))
      const el = document.createElement('div')
      el.className = `bub ${real ? 'real' : 'sim'}${e.major ? ' major' : ''}`
      el.innerHTML = `<button class="b" aria-label="${e.title.replace(/"/g, '&quot;').slice(0, 90)}"></button>`
      el.onclick = (ev) => { ev.stopPropagation(); pick.current(e, el) }
      bubs = [...bubs, { lat: e.lat, lng: e.lng, el }].slice(-10); globe.htmlElementsData(bubs)
    }
    globe.htmlElementsData([]); globe.ringsData([])
    const list = events.slice(0, 10)
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
