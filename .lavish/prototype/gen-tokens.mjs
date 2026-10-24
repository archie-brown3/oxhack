// Generates ds/tokens.css from the Doom Clock design system (context/design-system/tokens.json).
// Run from anywhere: node .lavish/prototype/gen-tokens.mjs [out.css] (default: the prototype's ds/tokens.css).
// Don't edit the output by hand.
import { readFileSync, writeFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('../../context/design-system/tokens.json', import.meta.url), 'utf8'));
const first = t.color.themes[0].id;
const decl = (n, v) => `  --${n}: ${v};`;
const themed = (k, id) => typeof k.value === 'string' ? k.value : k.value[id] ?? k.value[first];
const theme = (sel, id) => `${sel} {\n  color-scheme: ${id === 'paper' ? 'light' : 'dark'};\n${[...t.color.tokens, ...t.shadow.tokens].map(k => decl(k.name, themed(k, id))).join('\n')}\n}`;
const type = t.type.groups.flatMap(g => g.styles.flatMap(s => [
  decl(`type-${s.name}`, `${s.fontStyle ?? 'normal'} ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family})`),
  decl(`tracking-${s.name}`, s.letterSpacing ?? 'normal')]));
const shared = [...Object.entries(t.type.families).map(([k, v]) => decl(`font-${k}`, v)),
  ...t.spacing.tokens.map(k => decl(k.name, k.value)), ...t.radius.tokens.map(k => decl(k.name, k.value)), ...type];
writeFileSync(process.argv[2] ?? new URL('ds/tokens.css', import.meta.url), [
  `/* ${t.name} — generated from tokens.json by gen-tokens.mjs. Don't edit by hand. */`,
  theme(`:root, [data-theme="${first}"]`, first),
  ...t.color.themes.slice(1).map(x => theme(`[data-theme="${x.id}"]`, x.id)),
  `:root {\n${shared.join('\n')}\n}`].join('\n\n') + '\n');
