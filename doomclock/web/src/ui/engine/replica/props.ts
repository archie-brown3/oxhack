// The props each replica component takes. The shell (EngineScreen.tsx) owns state; the components only render.
import type { GraphData, ReplicaProject, ReplicaStep } from './types.ts'

export interface LogLine { time: string; msg: string }

export interface GraphPanelProps {
  /** The graph as it stood at the current replay round (already cut by replay.ts graphAt). */
  graph: GraphData | null
  /** MiroFish's currentPhase: 2 = build complete, 3 = simulating. */
  currentPhase: number
  isSimulating: boolean
  /** Bumps when the replay adds nodes or edges; the clone may pulse or re-heat. */
  loading?: boolean
  /** A saved recording. Refresh only rearranges the drawing, and the live "still processing" toast stays off. */
  recorded?: boolean
  /** Show the Entity Types legend (off in the half-width Split view, where it covered the graph). */
  legend?: boolean
  onToggleMaximize: () => void
}
export interface Step1Props { project: ReplicaProject; graph: GraphData | null; logs: LogLine[]; onNext: () => void }
export interface Step2Props { project: ReplicaProject; step: ReplicaStep; graph: GraphData | null; logs: LogLine[]; onBack: () => void; onNext: () => void; onLog: (msg: string) => void }
export interface Step3Props {
  step: ReplicaStep
  /** A recorded run: its report already exists, so the button opens it instead of generating one. */
  recorded?: boolean
  /** Replay position: 0 = before round 1 .. rounds = finished. Show only what happened by then. */
  round: number
  rounds: number
  logs: LogLine[]
  onBack: () => void
  onNext: () => void
  onLog: (msg: string) => void
}
export interface Step4Props { step: ReplicaStep; project: ReplicaProject; logs: LogLine[]; spike?: boolean; /** The report was written after an earlier step of this run. */ reused?: boolean; onBack: () => void; onNext: () => void; onLog: (msg: string) => void }
