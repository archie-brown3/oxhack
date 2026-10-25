// Rounds replay inside a step: the graph is saved once, after the step drained, but every node and edge carries
// the time Zep created it, and every action the time it happened. Round r shows what existed by the end of round r.
import type { GraphData, ReplicaStep } from './types.ts'

const ms = (s: string | null | undefined) => (s ? Date.parse(s.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') : NaN)

/** Rounds in the step: run-status says, else the highest round in the actions. */
export function roundsOf(step: ReplicaStep): number {
  return step.runStatus.total_rounds || Math.max(0, ...step.actions.map((a) => a.round_num + 1))
}

/** Epoch ms up to which graph items exist at the end of round `round` (0 = before the first round,
 *  `rounds` = after the drain). Timestamps of the actions are compared with Zep's created_at; the drain
 *  runs after the last action, so the last round shows everything. */
export function cutoffAt(step: ReplicaStep, round: number): number {
  const rounds = roundsOf(step)
  if (round >= rounds) return Infinity
  const start = ms(step.runStatus.started_at) || Math.min(...step.actions.map((a) => ms(a.timestamp)))
  if (round <= 0) return start
  const ts = step.actions.filter((a) => a.round_num < round).map((a) => ms(a.timestamp))
  return ts.length ? Math.max(...ts) : start
}

/** The graph as it stood at `cutoff`: nodes and edges created by then, edges whose ends both exist. */
export function graphAt(g: GraphData, cutoff: number): GraphData {
  if (cutoff === Infinity) return g
  const nodes = g.nodes.filter((n) => !(ms(n.created_at) > cutoff))
  const have = new Set(nodes.map((n) => n.uuid))
  const edges = g.edges.filter((e) => !(ms(e.created_at) > cutoff) && have.has(e.source_node_uuid) && have.has(e.target_node_uuid))
  return { ...g, nodes, edges, node_count: nodes.length, edge_count: edges.length }
}

/** Actions up to and including round `round - 1` (what has happened by the end of round `round`). */
export const actionsBy = (step: ReplicaStep, round: number) => step.actions.filter((a) => a.round_num < round)
