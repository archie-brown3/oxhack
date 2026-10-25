// The one provenance mark. Every provenance label on screen goes through this component, so each
// item carries exactly one of the seven kinds (data-label), drawn in one of the design system's
// three styles: REAL (solid dot), SIMULATED (hollow ring, italic) or a rule (open square).
import type { ReactNode } from 'react'
import type { Provenance } from '../contracts.ts'

export type LabelKind = 'real' | 'simulated' | 'recorded' | 'projected' | 'rules-only' | 'game-rule' | 'heuristic'

export const LABEL_TEXT: Record<LabelKind, string> = {
  real: 'Real', simulated: 'Simulated', recorded: 'Recorded', projected: 'Projected',
  'rules-only': 'Rules only', 'game-rule': 'Game rule', heuristic: 'Heuristic',
}
const STYLE: Record<LabelKind, 'real' | 'sim' | 'rule'> = {
  real: 'real', simulated: 'sim', recorded: 'sim', projected: 'sim',
  'rules-only': 'rule', 'game-rule': 'rule', heuristic: 'rule',
}

/** The label for an event or frame's provenance. */
export const labelOf = (p: Provenance): LabelKind => p

/** One label. `children` may reword it ("Real forecast"); the kind stays one of the seven. */
export function Label({ kind, children, title }: { kind: LabelKind; children?: ReactNode; title?: string }) {
  return <span className={`dc-label dc-label--${STYLE[kind]}`} data-label={kind} title={title}>{children ?? LABEL_TEXT[kind]}</span>
}
