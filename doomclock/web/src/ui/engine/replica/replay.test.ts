// Graph growth across rounds: nodes dated during the run appear as their round ends.
// A graph whose nodes pre-date the run (the 24 Oct spike) is fully visible at round 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutoffAt, graphAt, roundsOf } from './replay.ts'
import type { GraphData, GraphEdge, GraphNode, ReplicaStep, SimAction } from './types.ts'

const T0 = '2027-01-01T00:00:00Z'
const at = (sec: number) => new Date(Date.parse(T0) + sec * 1000).toISOString()

function step(actions: Pick<SimAction, 'round_num' | 'timestamp'>[], rounds = 2): ReplicaStep {
  return {
    runStatus: { total_rounds: rounds, started_at: T0 },
    actions,
  } as ReplicaStep
}

function node(uuid: string, created_at: string | null): GraphNode {
  return { uuid, name: uuid, labels: [], summary: '', attributes: {}, created_at }
}

function edge(uuid: string, source: string, target: string, created_at: string): GraphEdge {
  return {
    uuid, name: uuid, fact: '', fact_type: '', source_node_uuid: source, target_node_uuid: target,
    source_node_name: source, target_node_name: target, attributes: {}, episodes: [],
    created_at, valid_at: null, invalid_at: null, expired_at: null,
  }
}

const actions = [
  { round_num: 0, timestamp: at(10) },
  { round_num: 1, timestamp: at(20) },
]

test('a graph dated during the rounds grows, and the last round shows all of it', () => {
  const s = step(actions)
  assert.equal(roundsOf(s), 2)
  const g: GraphData = {
    graph_id: 'g', node_count: 3, edge_count: 1,
    nodes: [node('early', at(-86400)), node('r0', at(5)), node('r1', at(15))],
    edges: [edge('e', 'r0', 'r1', at(15))],
  }
  const at0 = graphAt(g, cutoffAt(s, 0))
  assert.deepEqual(at0.nodes.map((n) => n.uuid), ['early'])
  assert.equal(at0.edges.length, 0)
  const at1 = graphAt(g, cutoffAt(s, 1))
  assert.deepEqual(at1.nodes.map((n) => n.uuid), ['early', 'r0'])
  assert.equal(at1.edges.length, 0)
  const done = graphAt(g, cutoffAt(s, 2))
  assert.equal(done, g)
})

test('nodes created before the run are visible at round 0, so that graph does not grow', () => {
  const s = step(actions)
  const g: GraphData = {
    graph_id: 'spike', node_count: 2, edge_count: 1,
    nodes: [node('a', at(-86400)), node('b', at(-3600))],
    edges: [edge('e', 'a', 'b', at(-3600))],
  }
  const at0 = graphAt(g, cutoffAt(s, 0))
  const at1 = graphAt(g, cutoffAt(s, 1))
  assert.equal(at0.nodes.length, 2)
  assert.equal(at0.edges.length, 1)
  assert.equal(at1.nodes.length, at0.nodes.length)
  assert.equal(at1.edges.length, at0.edges.length)
})
