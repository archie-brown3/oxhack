// MiroFish's own English strings (locales/en.json, copied), so labels match 1:1. `t('step1.entityNodes')`;
// `{name}` placeholders are filled from `params`. A missing key shows the key.
import en from './en.json'

const get = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)

export function t(key: string, params: Record<string, string | number> = {}): string {
  const v = get(key)
  if (typeof v !== 'string') return key
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m))
}

/** An array of strings (vue-i18n's `tm`). */
export function tm(key: string): string[] {
  const v = get(key)
  return Array.isArray(v) ? (v as string[]) : []
}
