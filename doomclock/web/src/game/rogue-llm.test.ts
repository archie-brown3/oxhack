// Task 124: the LLM Rogue falls back to the labelled heuristic on a timeout, bad JSON or an illegal move.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { llmRogue } from './rogue-llm.ts'
import { newGame } from './reducer.ts'

const reply = (content: string, status = 200) =>
  (async () => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { cost: 0.0004 } }), { status })) as unknown as typeof fetch

test('a legal reply is used and labelled RECORDED', async () => {
  const r = await llmRogue(newGame(1), { apiKey: 'test', fetch: reply('{"moves":[{"id":"R1","target":null}],"sock_text":"x","taunt":"y","rationale":"grow"}') })
  assert.equal(r.ok, true)
  assert.equal(r.play.label, 'RECORDED')
  assert.deepEqual(r.play.moves, [{ id: 'R1' }])
  assert.equal(r.costUsd, 0.0004)
})

test('a timeout falls back to the heuristic', async () => {
  const hang = ((_: unknown, init: RequestInit) =>
    new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
  const r = await llmRogue(newGame(1), { apiKey: 'test', fetch: hang, timeoutMs: 20 })
  assert.equal(r.ok, false)
  assert.equal(r.error, 'timeout')
  assert.equal(r.play.label, 'HEURISTIC')
  assert.ok(r.play.moves.length > 0)
})

test('invalid JSON, an illegal move and an HTTP error fall back to the heuristic', async () => {
  for (const [f, why] of [
    [reply('not json'), 'bad JSON'],
    [reply('{"moves":[{"id":"R2","target":3}]}'), 'illegal'],
    [reply('{"moves":[{"id":"R1"},{"id":"R4"},{"id":"R6"}]}'), 'illegal'],
    [reply('{}', 500), 'HTTP 500'],
  ] as const) {
    const r = await llmRogue(newGame(1), { apiKey: 'test', fetch: f })
    assert.equal(r.ok, false)
    assert.ok(r.error!.startsWith(why), r.error)
    assert.equal(r.play.label, 'HEURISTIC')
  }
})
