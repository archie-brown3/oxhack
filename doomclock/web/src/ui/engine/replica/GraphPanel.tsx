// A 1:1 clone of MiroFish's GraphPanel.vue (d3 force graph, node and edge panels, legend, edge-label toggle,
// hints), plus "Show connections" on the node panel. The graph grows as the shell replays rounds: the force
// simulation lives across graph changes, positions stay put, and new nodes start beside a neighbour.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { t } from './i18n.ts'
import type { GraphPanelProps } from './props.ts'
import type { GraphEdge, GraphNode } from './types.ts'
import './GraphPanel.css'

const PALETTE = ['#FF6B35', '#004E89', '#7B2D8E', '#1A936F', '#C5283D', '#E9724C', '#3498db', '#9b59b6', '#27ae60', '#f39c12']
const typeOf = (n: GraphNode) => n.labels?.find((l) => l !== 'Entity') || 'Entity'

interface SimNode extends d3.SimulationNodeDatum { id: string; name: string; type: string; raw: GraphNode; _sx?: number; _sy?: number; _drag?: boolean }
interface SelfLoopGroup { isSelfLoopGroup: true; source_name: string; target_name: string; selfLoopCount: number; selfLoopEdges: EdgeRaw[] }
type EdgeRaw = GraphEdge & { source_name?: string; target_name?: string }
type EdgeData = EdgeRaw | SelfLoopGroup
interface SimEdge { key: string; source: string | SimNode; target: string | SimNode; name: string; curvature: number; isSelfLoop: boolean; pairTotal?: number; raw: EdgeData }

type Selected = { type: 'node'; node: GraphNode; entityType: string; color: string } | { type: 'edge'; key: string; data: EdgeData }

const nid = (x: string | SimNode) => (typeof x === 'string' ? x : x.id)

function formatDateTime(s: string | null | undefined) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(+d) ? s : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

// Curves and labels, as in MiroFish.
function path(d: SimEdge) {
  const s = d.source as SimNode, tg = d.target as SimNode
  const sx = s.x ?? 0, sy = s.y ?? 0, tx = tg.x ?? 0, ty = tg.y ?? 0
  if (d.isSelfLoop) return `M${sx + 8},${sy - 4} A30,30 0 1,1 ${sx + 8},${sy + 4}`
  if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`
  const c = control(d, sx, sy, tx, ty)
  return `M${sx},${sy} Q${c[0]},${c[1]} ${tx},${ty}`
}
function control(d: SimEdge, sx: number, sy: number, tx: number, ty: number) {
  const dx = tx - sx, dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const base = Math.max(35, dist * (0.25 + (d.pairTotal || 1) * 0.05))
  return [(sx + tx) / 2 + (-dy / dist) * d.curvature * base, (sy + ty) / 2 + (dx / dist) * d.curvature * base]
}
function mid(d: SimEdge) {
  const s = d.source as SimNode, tg = d.target as SimNode
  const sx = s.x ?? 0, sy = s.y ?? 0, tx = tg.x ?? 0, ty = tg.y ?? 0
  if (d.isSelfLoop) return { x: sx + 70, y: sy }
  if (d.curvature === 0) return { x: (sx + tx) / 2, y: (sy + ty) / 2 }
  const c = control(d, sx, sy, tx, ty)
  return { x: 0.25 * sx + 0.5 * c[0] + 0.25 * tx, y: 0.25 * sy + 0.5 * c[1] + 0.25 * ty }
}

function buildEdges(nodes: GraphNode[], edgesData: GraphEdge[]): SimEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.uuid, n]))
  const ok = edgesData.filter((e) => nodeMap.has(e.source_node_uuid) && nodeMap.has(e.target_node_uuid))
  const pairCount: Record<string, number> = {}
  const loops: Record<string, EdgeRaw[]> = {}
  const named = (e: GraphEdge): EdgeRaw => ({ ...e, source_name: nodeMap.get(e.source_node_uuid)?.name, target_name: nodeMap.get(e.target_node_uuid)?.name })
  for (const e of ok) {
    if (e.source_node_uuid === e.target_node_uuid) (loops[e.source_node_uuid] ??= []).push(named(e))
    else { const k = [e.source_node_uuid, e.target_node_uuid].sort().join('_'); pairCount[k] = (pairCount[k] || 0) + 1 }
  }
  const pairIndex: Record<string, number> = {}
  const doneLoops = new Set<string>()
  const out: SimEdge[] = []
  for (const e of ok) {
    if (e.source_node_uuid === e.target_node_uuid) {
      if (doneLoops.has(e.source_node_uuid)) continue
      doneLoops.add(e.source_node_uuid)
      const all = loops[e.source_node_uuid]
      const name = nodeMap.get(e.source_node_uuid)?.name || 'Unknown'
      out.push({ key: `loop-${e.source_node_uuid}`, source: e.source_node_uuid, target: e.target_node_uuid, name: `Self Relations (${all.length})`, curvature: 0, isSelfLoop: true,
        raw: { isSelfLoopGroup: true, source_name: name, target_name: name, selfLoopCount: all.length, selfLoopEdges: all } })
      continue
    }
    const k = [e.source_node_uuid, e.target_node_uuid].sort().join('_')
    const total = pairCount[k]
    const i = pairIndex[k] || 0
    pairIndex[k] = i + 1
    let curvature = 0
    if (total > 1) {
      const range = Math.min(1.2, 0.6 + total * 0.15)
      curvature = (i / (total - 1) - 0.5) * range * 2
      if (e.source_node_uuid > e.target_node_uuid) curvature = -curvature
    }
    out.push({ key: e.uuid, source: e.source_node_uuid, target: e.target_node_uuid, name: e.name || e.fact_type || 'RELATED', curvature, isSelfLoop: false, pairTotal: total, raw: named(e) })
  }
  return out
}

interface Draw {
  sim: d3.Simulation<SimNode, SimEdge>
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  nodes: Map<string, SimNode>
  edges: SimEdge[]
  link?: d3.Selection<SVGPathElement, SimEdge, SVGGElement, unknown>
  bg?: d3.Selection<SVGRectElement, SimEdge, SVGGElement, unknown>
  label?: d3.Selection<SVGTextElement, SimEdge, SVGGElement, unknown>
  node?: d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown>
  nodeLabel?: d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown>
  linkG: d3.Selection<SVGGElement, unknown, null, undefined>
  nodeG: d3.Selection<SVGGElement, unknown, null, undefined>
  first: boolean
}

export function GraphPanel({ graph, currentPhase, isSimulating, loading = false, onToggleMaximize }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const D = useRef<Draw | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [conn, setConn] = useState<string | null>(null) // uuid whose connections are shown
  const [showEdgeLabels, setShowEdgeLabels] = useState(true)
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set())
  const [finishedHint, setFinishedHint] = useState(false)
  const [spin, setSpin] = useState(false)
  const was = useRef(isSimulating)
  const state = useRef({ selected, conn, showEdgeLabels })
  state.current = { selected, conn, showEdgeLabels }
  const color = useRef<Record<string, string>>({})

  const entityTypes = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const n of graph?.nodes ?? []) {
      const ty = typeOf(n)
      if (!map.has(ty)) map.set(ty, { name: ty, color: PALETTE[map.size % PALETTE.length] })
    }
    return [...map.values()]
  }, [graph])
  color.current = Object.fromEntries(entityTypes.map((e) => [e.name, e.color]))
  const getColor = (ty: string) => color.current[ty] || '#999'

  useEffect(() => {
    if (was.current && !isSimulating) setFinishedHint(true)
    was.current = isSimulating
  }, [isSimulating])

  // Paint selection, connections and label visibility onto the current elements.
  const paint = () => {
    const d = D.current
    if (!d?.node || !d.link || !d.label || !d.bg || !d.nodeLabel) return
    const { selected: sel, conn: cn, showEdgeLabels: labels } = state.current
    const selNode = sel?.type === 'node' ? sel.node.uuid : null
    const selEdge = sel?.type === 'edge' ? sel.key : null
    let keep: Set<string> | null = null
    if (cn) {
      keep = new Set([cn])
      for (const e of d.edges) { const a = nid(e.source), b = nid(e.target); if (a === cn) keep.add(b); else if (b === cn) keep.add(a) }
    }
    const dim = (id: string) => (keep && !keep.has(id) ? 0.12 : 1)
    const edgeDim = (e: SimEdge) => (keep && !(keep.has(nid(e.source)) && keep.has(nid(e.target))) ? 0.06 : 1)
    d.node
      .attr('stroke', (n) => (n.id === selNode ? '#E91E63' : keep?.has(n.id) && n.id !== cn ? '#E91E63' : '#fff'))
      .attr('stroke-width', (n) => (n.id === selNode ? 4 : keep?.has(n.id) && n.id !== cn ? 3 : 2.5))
      .style('opacity', (n) => dim(n.id))
    d.nodeLabel.style('opacity', (n) => dim(n.id))
    d.link
      .attr('stroke', (e) => (e.key === selEdge ? '#3498db' : selNode && (nid(e.source) === selNode || nid(e.target) === selNode) ? '#E91E63' : '#C0C0C0'))
      .attr('stroke-width', (e) => (e.key === selEdge ? 3 : selNode && (nid(e.source) === selNode || nid(e.target) === selNode) ? 2.5 : 1.5))
      .style('opacity', edgeDim)
    d.label.attr('fill', (e) => (e.key === selEdge ? '#3498db' : '#666')).style('display', labels ? 'block' : 'none').style('opacity', edgeDim)
    d.bg.attr('fill', (e) => (e.key === selEdge ? 'rgba(52, 152, 219, 0.1)' : 'rgba(255,255,255,0.95)')).style('display', labels ? 'block' : 'none').style('opacity', edgeDim)
  }

  // The simulation, once.
  useEffect(() => {
    const el = containerRef.current!
    const svg = d3.select(svgRef.current!)
    const w = el.clientWidth, h = el.clientHeight
    svg.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`)
    const g = svg.append('g')
    svg.call(d3.zoom<SVGSVGElement, unknown>().extent([[0, 0], [w, h]]).scaleExtent([0.1, 4]).on('zoom', (ev) => g.attr('transform', ev.transform)))
    const linkG = g.append('g').attr('class', 'links')
    const nodeG = g.append('g').attr('class', 'nodes')
    const sim = d3.forceSimulation<SimNode>([])
      .force('link', d3.forceLink<SimNode, SimEdge>([]).id((n) => n.id).distance((e) => 150 + ((e.pairTotal || 1) - 1) * 50))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(50))
      .force('x', d3.forceX(w / 2).strength(0.04))
      .force('y', d3.forceY(h / 2).strength(0.04))
    const d: Draw = { sim, g, linkG, nodeG, nodes: new Map(), edges: [], first: true }
    D.current = d
    sim.on('tick', () => {
      d.link?.attr('d', path)
      d.label?.each(function (e) { const m = mid(e); d3.select(this).attr('x', m.x).attr('y', m.y) })
      if (state.current.showEdgeLabels) {
        const texts = d.label?.nodes() ?? []
        d.bg?.each(function (e, i) {
          const m = mid(e)
          let bb = { width: 0, height: 0 }
          try { bb = texts[i].getBBox() } catch { /* not laid out yet */ }
          d3.select(this).attr('x', m.x - bb.width / 2 - 4).attr('y', m.y - bb.height / 2 - 2).attr('width', bb.width + 8).attr('height', bb.height + 4)
        })
      }
      d.node?.attr('cx', (n) => n.x ?? 0).attr('cy', (n) => n.y ?? 0)
      d.nodeLabel?.attr('x', (n) => n.x ?? 0).attr('y', (n) => n.y ?? 0)
    })
    svg.on('click', () => { setSelected(null); setConn(null); setExpanded(new Set()) })
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight
      if (!nw || !nh) return
      svg.attr('width', nw).attr('height', nh).attr('viewBox', `0 0 ${nw} ${nh}`)
      ;(sim.force('center') as d3.ForceCenter<SimNode>).x(nw / 2).y(nh / 2)
      ;(sim.force('x') as d3.ForceX<SimNode>).x(nw / 2)
      ;(sim.force('y') as d3.ForceY<SimNode>).y(nh / 2)
      sim.alpha(Math.max(sim.alpha(), 0.2)).restart()
    })
    ro.observe(el)
    return () => { ro.disconnect(); sim.stop(); svg.on('click', null); svg.on('.zoom', null); svg.selectAll('*').remove(); D.current = null }
  }, [])

  // The graph changed (a replay round, or a new step): update in place.
  useEffect(() => {
    const d = D.current
    if (!d) return
    const gnodes = graph?.nodes ?? []
    const edges = buildEdges(gnodes, graph?.edges ?? [])
    const ids = new Set(gnodes.map((n) => n.uuid))
    const fresh = new Set<string>()
    const keepNodes = new Map<string, SimNode>()
    const el = containerRef.current!
    for (const n of gnodes) {
      let s = d.nodes.get(n.uuid)
      if (!s) {
        s = { id: n.uuid, name: n.name || 'Unnamed', type: typeOf(n), raw: n }
        fresh.add(n.uuid)
      } else { s.raw = n; s.name = n.name || 'Unnamed'; s.type = typeOf(n) }
      keepNodes.set(n.uuid, s)
    }
    // New nodes start beside an existing neighbour (else near the middle), so they don't fly in from afar.
    for (const id of fresh) {
      const s = keepNodes.get(id)!
      const nb = edges.map((e) => (nid(e.source) === id ? nid(e.target) : nid(e.target) === id ? nid(e.source) : null)).find((o) => o && !fresh.has(o))
      const base = nb ? keepNodes.get(nb) : undefined
      const jig = () => (Math.random() - 0.5) * 60
      s.x = (base?.x ?? el.clientWidth / 2) + jig()
      s.y = (base?.y ?? el.clientHeight / 2) + jig()
    }
    d.nodes = keepNodes
    d.edges = edges
    const nodes = [...keepNodes.values()]
    d.sim.nodes(nodes)
    ;(d.sim.force('link') as d3.ForceLink<SimNode, SimEdge>).links(edges)

    d.linkG.selectAll('*').remove()
    d.link = d.linkG.selectAll<SVGPathElement, SimEdge>('path').data(edges).enter().append('path')
      .attr('stroke', '#C0C0C0').attr('stroke-width', 1.5).attr('fill', 'none').style('cursor', 'pointer')
    d.bg = d.linkG.selectAll<SVGRectElement, SimEdge>('rect').data(edges).enter().append('rect')
      .attr('fill', 'rgba(255,255,255,0.95)').attr('rx', 3).attr('ry', 3).style('cursor', 'pointer').style('pointer-events', 'all')
    d.label = d.linkG.selectAll<SVGTextElement, SimEdge>('text').data(edges).enter().append('text')
      .text((e) => e.name).attr('font-size', '9px').attr('fill', '#666').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .style('cursor', 'pointer').style('pointer-events', 'all').style('font-family', 'system-ui, sans-serif')
    const pick = (ev: Event, e: SimEdge) => { ev.stopPropagation(); setSelected({ type: 'edge', key: e.key, data: e.raw }) }
    d.link.on('click', pick); d.bg.on('click', pick); d.label.on('click', pick)

    // Nodes: keyed, so existing circles keep their elements.
    const sel = d.nodeG.selectAll<SVGCircleElement, SimNode>('circle').data(nodes, (n) => n.id)
    sel.exit().remove()
    const entered = sel.enter().append('circle').attr('r', 10).attr('stroke', '#fff').attr('stroke-width', 2.5).style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, SimNode>()
        .on('start', (_ev, n) => { n.fx = n.x; n.fy = n.y; n._sx = _ev.x; n._sy = _ev.y; n._drag = false })
        .on('drag', (ev, n) => {
          if (!n._drag && Math.hypot(ev.x - (n._sx ?? 0), ev.y - (n._sy ?? 0)) > 3) { n._drag = true; d.sim.alphaTarget(0.3).restart() }
          if (n._drag) { n.fx = ev.x; n.fy = ev.y }
        })
        .on('end', (_ev, n) => { if (n._drag) d.sim.alphaTarget(0); n.fx = null; n.fy = null; n._drag = false }))
      .on('click', (ev, n) => { ev.stopPropagation(); setSelected({ type: 'node', node: n.raw, entityType: n.type, color: getColor(n.type) }); setConn(null) })
      .on('mouseenter', function (_ev, n) { if (state.current.selected?.type !== 'node' || state.current.selected.node.uuid !== n.id) d3.select(this).attr('stroke', '#333').attr('stroke-width', 3) })
      .on('mouseleave', () => paint())
    if (!d.first) entered.each(function (n) {
      if (!fresh.has(n.id)) return
      const c = d3.select(this).classed('mf-g-new', true)
      setTimeout(() => c.classed('mf-g-new', false), 1600)
    })
    d.node = entered.merge(sel).attr('fill', (n) => getColor(n.type))
    d.node.order()
    d.nodeG.selectAll('text').remove()
    d.nodeLabel = d.nodeG.selectAll<SVGTextElement, SimNode>('text').data(nodes).enter().append('text')
      .text((n) => (n.name.length > 8 ? n.name.substring(0, 8) + '…' : n.name))
      .attr('font-size', '11px').attr('fill', '#333').attr('font-weight', '500').attr('dx', 14).attr('dy', 4)
      .style('pointer-events', 'none').style('font-family', 'system-ui, sans-serif')

    // A node that left the graph (a new step) must not stay selected.
    const s = state.current.selected
    if (s?.type === 'node' && !ids.has(s.node.uuid)) { setSelected(null); setConn(null) }
    if (s?.type === 'edge' && !edges.some((e) => e.key === s.key)) setSelected(null)
    if (nodes.length) {
      d.sim.alpha(d.first ? 1 : Math.max(d.sim.alpha(), fresh.size || edges.length ? 0.35 : 0)).restart()
      d.first = false
    }
    paint()
  }, [graph]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(paint, [selected, conn, showEdgeLabels])

  const refresh = () => { setSpin(true); D.current?.sim.alpha(1).restart(); setTimeout(() => setSpin(false), 700) }
  const close = () => { setSelected(null); setConn(null); setExpanded(new Set()) }
  const toggleLoop = (id: string | number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const neighbours = selected?.type === 'node' ? new Set(D.current?.edges.flatMap((e) => (nid(e.source) === selected.node.uuid ? [nid(e.target)] : nid(e.target) === selected.node.uuid ? [nid(e.source)] : [])) ?? []) : null
  neighbours?.delete(selected?.type === 'node' ? selected.node.uuid : '')

  return (
    <div className="mf-g">
      <div className="mf-g-header">
        <span className="mf-g-title">{t('graph.panelTitle')}</span>
        <div className="mf-g-tools">
          <button className="mf-g-tool" onClick={refresh} disabled={loading} title={t('graph.refreshGraph')}>
            <span className={`mf-g-icon-refresh${spin || loading ? ' spinning' : ''}`}>↻</span>
            <span className="mf-g-btn-text">Refresh</span>
          </button>
          <button className="mf-g-tool" onClick={onToggleMaximize} title={t('graph.toggleMaximize')}><span>⛶</span></button>
        </div>
      </div>

      <div className="mf-g-container" ref={containerRef}>
        <div className="mf-g-view" style={{ display: graph ? 'block' : 'none' }}>
          <svg ref={svgRef} className="mf-g-svg" />
        </div>
        {graph && (currentPhase === 1 || isSimulating) && (
          <div className="mf-g-hint">
            <div className="mf-g-memory-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mf-g-memory">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-4.04z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-4.04z" />
              </svg>
            </div>
            {isSimulating ? t('graph.graphMemoryRealtime') : t('graph.realtimeUpdating')}
          </div>
        )}
        {graph && finishedHint && (
          <div className="mf-g-hint finished">
            <div className="mf-g-hint-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mf-g-hint-icon"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </div>
            <span className="mf-g-hint-text">{t('graph.pendingContentHint')}</span>
            <button className="mf-g-hint-close" onClick={() => setFinishedHint(false)} title={t('graph.closeHint')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}

        {graph && selected && (
          <div className="mf-g-detail">
            <div className="mf-g-detail-head">
              <span className="mf-g-detail-title">{selected.type === 'node' ? t('graph.nodeDetails') : t('graph.relationship')}</span>
              {selected.type === 'node' && <span className="mf-g-badge" style={{ background: selected.color, color: '#fff' }}>{selected.entityType}</span>}
              <button className="mf-g-close" onClick={close}>×</button>
            </div>
            {selected.type === 'node' ? <NodeBody sel={selected} conn={conn} count={neighbours?.size ?? 0} onConn={() => setConn(conn ? null : selected.node.uuid)} /> : <EdgeBody data={selected.data} expanded={expanded} toggle={toggleLoop} />}
          </div>
        )}

        {!graph && (loading ? (
          <div className="mf-g-state"><div className="mf-g-spinner" /><p>{t('graph.graphDataLoading')}</p></div>
        ) : (
          <div className="mf-g-state"><div className="mf-g-empty-icon">❖</div><p>{t('graph.waitingOntology')}</p></div>
        ))}
      </div>

      {graph && entityTypes.length > 0 && (
        <div className="mf-g-legend">
          <span className="mf-g-legend-title">Entity Types</span>
          <div className="mf-g-legend-items">
            {entityTypes.map((e) => <div className="mf-g-legend-item" key={e.name}><span className="mf-g-legend-dot" style={{ background: e.color }} /><span className="mf-g-legend-label">{e.name}</span></div>)}
          </div>
        </div>
      )}

      {graph && (
        <div className="mf-g-toggle">
          <label className="mf-g-switch">
            <input type="checkbox" checked={showEdgeLabels} onChange={(e) => setShowEdgeLabels(e.target.checked)} />
            <span className="mf-g-slider" />
          </label>
          <span className="mf-g-toggle-label">Show Edge Labels</span>
        </div>
      )}
    </div>
  )
}

const Row = ({ label, value, cls = '' }: { label: string; value: string | number | null | undefined; cls?: string }) => (
  <div className="mf-g-row"><span className="mf-g-label">{label}</span><span className={`mf-g-value ${cls}`}>{value}</span></div>
)

function NodeBody({ sel, conn, count, onConn }: { sel: Extract<Selected, { type: 'node' }>; conn: string | null; count: number; onConn: () => void }) {
  const n = sel.node
  const attrs = Object.entries(n.attributes ?? {})
  return (
    <div className="mf-g-content">
      <Row label="Name:" value={n.name} />
      <Row label="UUID:" value={n.uuid} cls="uuid" />
      {n.created_at && <Row label="Created:" value={formatDateTime(n.created_at)} />}
      <div className="mf-g-conn">
        <button className={`mf-g-conn-btn${conn ? ' on' : ''}`} onClick={onConn}>{conn ? 'Clear connections' : 'Show connections'}</button>
        <span className="mf-g-conn-n">{count} connected {count === 1 ? 'node' : 'nodes'}</span>
      </div>
      {attrs.length > 0 && (
        <div className="mf-g-section">
          <div className="mf-g-section-title">Properties:</div>
          <div className="mf-g-props">{attrs.map(([k, v]) => <div className="mf-g-prop" key={k}><span className="mf-g-prop-key">{k}:</span><span className="mf-g-prop-value">{v ? String(v) : 'None'}</span></div>)}</div>
        </div>
      )}
      {n.summary && <div className="mf-g-section"><div className="mf-g-section-title">Summary:</div><div className="mf-g-summary">{n.summary}</div></div>}
      {n.labels?.length > 0 && <div className="mf-g-section"><div className="mf-g-section-title">Labels:</div><div className="mf-g-labels">{n.labels.map((l) => <span className="mf-g-label-tag" key={l}>{l}</span>)}</div></div>}
    </div>
  )
}

function EdgeBody({ data, expanded, toggle }: { data: EdgeData; expanded: Set<string | number>; toggle: (id: string | number) => void }) {
  if ('isSelfLoopGroup' in data) {
    return (
      <div className="mf-g-content">
        <div className="mf-g-rel-head self">{data.source_name} - Self Relations<span className="mf-g-loop-count">{data.selfLoopCount} items</span></div>
        <div className="mf-g-loops">
          {data.selfLoopEdges.map((loop, idx) => {
            const id = loop.uuid || idx
            const open = expanded.has(id)
            return (
              <div key={id} className={`mf-g-loop${open ? ' expanded' : ''}`}>
                <div className="mf-g-loop-head" onClick={() => toggle(id)}>
                  <span className="mf-g-loop-index">#{idx + 1}</span>
                  <span className="mf-g-loop-name">{loop.name || loop.fact_type || 'RELATED'}</span>
                  <span className="mf-g-loop-toggle">{open ? '−' : '+'}</span>
                </div>
                {open && (
                  <div className="mf-g-loop-body">
                    {loop.uuid && <Row label="UUID:" value={loop.uuid} cls="uuid" />}
                    {loop.fact && <Row label="Fact:" value={loop.fact} cls="fact" />}
                    {loop.fact_type && <Row label="Type:" value={loop.fact_type} />}
                    {loop.created_at && <Row label="Created:" value={formatDateTime(loop.created_at)} />}
                    {loop.episodes?.length > 0 && <div className="mf-g-loop-eps"><span className="mf-g-label">Episodes:</span><div className="mf-g-episodes compact">{loop.episodes.map((ep) => <span className="mf-g-episode small" key={ep}>{ep}</span>)}</div></div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <div className="mf-g-content">
      <div className="mf-g-rel-head">{data.source_name} → {data.name || 'RELATED_TO'} → {data.target_name}</div>
      <Row label="UUID:" value={data.uuid} cls="uuid" />
      <Row label="Label:" value={data.name || 'RELATED_TO'} />
      <Row label="Type:" value={data.fact_type || 'Unknown'} />
      {data.fact && <Row label="Fact:" value={data.fact} cls="fact" />}
      {data.episodes?.length > 0 && <div className="mf-g-section"><div className="mf-g-section-title">Episodes:</div><div className="mf-g-episodes">{data.episodes.map((ep) => <span className="mf-g-episode" key={ep}>{ep}</span>)}</div></div>}
      {data.created_at && <Row label="Created:" value={formatDateTime(data.created_at)} />}
      {data.valid_at && <Row label="Valid From:" value={formatDateTime(data.valid_at)} />}
    </div>
  )
}
