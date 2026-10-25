// The LLM Rogue (task 124, plan §5): one OpenRouter call per turn over the hidden-information view.
// Used by the recorder (Node) only; the browser plays the labelled heuristic. Any failure (timeout,
// HTTP error, bad JSON, an illegal move) falls back to the heuristic, labelled HEURISTIC.
import { rngFor } from './paths.ts'
import { heuristicRogue, roguePrompt, validateRogue } from './rogue.ts'
import type { GameState, RogueCardId, RoguePlay } from './types.ts'

export const ROGUE_MODEL = 'deepseek/deepseek-v4.1-flash-1017'

export interface LlmOptions {
  apiKey: string
  fetch?: typeof fetch
  model?: string
  timeoutMs?: number
  /** Called with the raw response body before parsing (the recorder saves it to data/raw). */
  onRaw?: (body: unknown) => void
}

export interface LlmResult {
  play: RoguePlay
  ok: boolean
  /** Why it fell back, when it did. */
  error?: string
  ms: number
  costUsd?: number
}

const words = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ')

export async function llmRogue(s: GameState, o: LlmOptions): Promise<LlmResult> {
  const t0 = performance.now()
  const fallback = (error: string, costUsd?: number): LlmResult => ({
    play: heuristicRogue(s, rngFor(s.seed, s.key, 'rogue')),
    ok: false,
    error,
    ms: Math.round(performance.now() - t0),
    costUsd,
  })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 15_000)
  let body: { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } }
  try {
    const res = await (o.fetch ?? fetch)('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: o.model ?? ROGUE_MODEL,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        usage: { include: true },
        messages: [{ role: 'user', content: roguePrompt(s) }],
      }),
    })
    if (!res.ok) return fallback(`HTTP ${res.status}`)
    body = await res.json()
  } catch (e) {
    return fallback(ctrl.signal.aborted ? 'timeout' : String(e))
  } finally {
    clearTimeout(timer)
  }
  o.onRaw?.(body)
  const cost = body.usage?.cost
  let out: { moves?: { id?: string; target?: number | null }[]; sock_text?: string; taunt?: string; rationale?: string }
  try {
    out = JSON.parse(body.choices?.[0]?.message?.content ?? '')
  } catch {
    return fallback('bad JSON', cost)
  }
  const moves = (Array.isArray(out.moves) ? out.moves : []).map((m) => ({
    id: String(m?.id) as RogueCardId,
    ...(m?.target === null || m?.target === undefined ? {} : { target: Number(m.target) }),
  }))
  const errors = moves.length ? validateRogue(s, moves) : ['no moves']
  if (errors.length) return fallback(`illegal: ${errors.join('; ')}`, cost)
  return {
    play: {
      moves,
      label: 'RECORDED',
      rationale: words(String(out.rationale ?? ''), 40),
      sock_text: String(out.sock_text ?? '').slice(0, 280),
      taunt: String(out.taunt ?? '').slice(0, 140),
    },
    ok: true,
    ms: Math.round(performance.now() - t0),
    costUsd: cost,
  }
}
