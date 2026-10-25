// Amendments 2 of the coupled-loop spec, as pure recorder steps. One project and one Zep graph
// per future. Each run writes actions back to that graph. After the run, MiroFish's report agent
// writes the situation report. The rubric is scored from that report plus the saved events.
// The graph file is saved only after two settled reads agree. Nothing here opens a socket.

export interface FutureProject {
  future: number
  project_id: string
  graph_id: string
}

/** `data/world/futures/<id>/step1/project.json`, written by step1.ts on a successful build. */
export function futureProject(raw: unknown, future: number): FutureProject {
  const p = raw as { project_id?: unknown; graph_id?: unknown; future?: unknown }
  if (typeof p?.project_id !== "string" || typeof p?.graph_id !== "string" || !p.project_id || !p.graph_id)
    throw new Error(`future ${future}: step1/project.json has no project_id and graph_id`)
  if (p.future !== undefined && p.future !== future) throw new Error(`future ${future}: project.json says future ${String(p.future)}`)
  return { future, project_id: p.project_id, graph_id: p.graph_id }
}

export function simulationCreateBody(p: FutureProject) {
  return { project_id: p.project_id, graph_id: p.graph_id, enable_twitter: true, enable_reddit: false }
}

/** `POST /api/simulation/start`. Graph memory stays on so the future's Zep graph keeps the run. */
export function startBody(simulation_id: string, max_rounds: number) {
  // GRAPH_MEMORY=0 skips Zep ingestion of the posts: on 25 Oct Zep timed out draining them and MiroFish failed the runs.
  return { simulation_id, platform: "parallel" as const, max_rounds, enable_graph_memory_update: process.env.GRAPH_MEMORY !== "0", force: true }
}

export type Api = (method: "GET" | "POST", path: string, body?: unknown) => Promise<any>

export async function fetchReport(api: Api, simulation_id: string, poll: () => Promise<void>, maxPolls = 60) {
  // force_regenerate: false returned the first step's report for every step of a run (25 Oct).
  // MiroFish answers 409 while the runner is still stopping or its Zep updater is draining; wait it out.
  let started: { task_id?: string; status?: string; report_id?: string } | undefined
  for (let i = 0; !started; i++) {
    try { started = await api("POST", "/api/report/generate", { simulation_id, force_regenerate: true }) }
    catch (e) { if (i >= maxPolls || !String(e).includes("HTTP 409")) throw e; await poll() }
  }
  let status = started.status
  let report_id = started.report_id
  for (let i = 0; i < maxPolls && !(status === "completed" && report_id) && status !== "failed"; i++) {
    await poll()
    const s = await api("POST", "/api/report/generate/status", { simulation_id, ...(started.task_id ? { task_id: started.task_id } : {}) }) as { status?: string; report_id?: string }
    status = s.status
    report_id = s.report_id ?? report_id
  }
  if (status !== "completed" || !report_id) throw new Error(`report for ${simulation_id}: ${status ?? "no report_id"}`)
  const report = await api("GET", `/api/report/by-simulation/${simulation_id}`)
  const agentLog = await api("GET", `/api/report/${report_id}/agent-log`)
  const consoleLog = await api("GET", `/api/report/${report_id}/console-log`)
  return { report, agentLog, consoleLog, report_id }
}

export interface GraphCounts { nodes: number; edges: number; busy: boolean }

/** Counts from `GET /api/graph/data/:graph_id`. Busy while Zep still lists pending work. */
export function graphCounts(g: unknown): GraphCounts | null {
  if (!g || typeof g !== "object") return null
  const o = g as Record<string, unknown>
  const nodes = typeof o.node_count === "number" ? o.node_count : Array.isArray(o.nodes) ? o.nodes.length : null
  const edges = typeof o.edge_count === "number" ? o.edge_count : Array.isArray(o.edges) ? o.edges.length : null
  if (nodes === null || edges === null) return null
  const pending = Number(o.pending ?? o.processing ?? o.pending_episodes ?? 0) || 0
  const status = o.status
  const busy = status === "processing" || status === "pending" || status === "running" || pending > 0
  return { nodes, edges, busy }
}

/** Two settled reads with the same node and edge counts. One read is not enough: Zep can still be writing. */
export async function fetchGraphWhenDrained(api: Api, graph_id: string, poll: () => Promise<void>, maxPolls = 90): Promise<unknown> {
  const path = `/api/graph/data/${graph_id}`
  let prev: GraphCounts | null = null
  let last: unknown = null
  for (let i = 0; i < maxPolls; i++) {
    last = await api("GET", path)
    const c = graphCounts(last)
    if (c && !c.busy && prev && !prev.busy && c.nodes === prev.nodes && c.edges === prev.edges) return last
    prev = c
    await poll()
  }
  throw new Error(`graph ${graph_id}: Zep still processing after ${maxPolls} polls`)
}

/** What the rubric model reads. Figures inside the report stay prose; the event list is the data. */
export function rubricPrompt(reportMarkdown: string, formattedEvents: string): string {
  return `MIROFISH REPORT (prose only; do not treat figures in it as data):\n${reportMarkdown.trim()}\n\nEVENTS:\n${formattedEvents}`
}

/** A short plain line for the feed, from the report as written. Not a new summary call. */
export function summaryFromReport(markdown: string, max = 480): string {
  const plain = markdown.replace(/```[\s\S]*?```/g, " ").replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim()
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).trimEnd()}…`
}
