// A small JSON Schema checker for the three game schemas (doomclock.cast/1, cards/1, node/1).
// It covers the subset the schemas use: type, enum, const, required, properties,
// additionalProperties: false, items, min/max, minItems/maxItems, maxLength, pattern, $ref to
// #/$defs. No dependency; runs in the browser, under node, and in the pipeline.

export interface Schema {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  required?: string[]
  properties?: Record<string, Schema>
  additionalProperties?: boolean | Schema
  items?: Schema
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  maxLength?: number
  pattern?: string
  $ref?: string
  $defs?: Record<string, Schema>
  [k: string]: unknown
}

/** Returns a list of errors, each "path: problem"; empty means valid. */
export function validate(schema: Schema, value: unknown): string[] {
  const errors: string[] = []
  walk(schema, schema, value, '$', errors)
  return errors
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function walk(root: Schema, s: Schema, v: unknown, path: string, errors: string[]): void {
  if (s.$ref) {
    const name = s.$ref.replace('#/$defs/', '')
    const def = root.$defs?.[name]
    if (!def) return void errors.push(`${path}: unknown $ref ${s.$ref}`)
    return walk(root, def, v, path, errors)
  }
  const t = typeOf(v)
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type]
    const ok = types.some((x) => x === t || (x === 'number' && t === 'integer'))
    if (!ok) return void errors.push(`${path}: expected ${types.join('|')}, got ${t}`)
  }
  if (s.enum && !s.enum.some((e) => e === v)) errors.push(`${path}: ${JSON.stringify(v)} not in enum`)
  if ('const' in s && s.const !== v) errors.push(`${path}: expected ${JSON.stringify(s.const)}`)
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errors.push(`${path}: ${v} < ${s.minimum}`)
    if (s.maximum !== undefined && v > s.maximum) errors.push(`${path}: ${v} > ${s.maximum}`)
  }
  if (typeof v === 'string') {
    if (s.maxLength !== undefined && v.length > s.maxLength) errors.push(`${path}: longer than ${s.maxLength}`)
    if (s.pattern && !new RegExp(s.pattern).test(v)) errors.push(`${path}: does not match ${s.pattern}`)
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errors.push(`${path}: fewer than ${s.minItems} items`)
    if (s.maxItems !== undefined && v.length > s.maxItems) errors.push(`${path}: more than ${s.maxItems} items`)
    if (s.items) v.forEach((x, i) => walk(root, s.items!, x, `${path}[${i}]`, errors))
  }
  if (t === 'object') {
    const o = v as Record<string, unknown>
    for (const k of s.required ?? []) if (!(k in o)) errors.push(`${path}: missing ${k}`)
    for (const [k, x] of Object.entries(o)) {
      const p = s.properties?.[k]
      if (p) walk(root, p, x, `${path}.${k}`, errors)
      else if (s.additionalProperties === false) errors.push(`${path}: unexpected key ${k}`)
      else if (typeof s.additionalProperties === 'object') walk(root, s.additionalProperties, x, `${path}.${k}`, errors)
    }
  }
}
