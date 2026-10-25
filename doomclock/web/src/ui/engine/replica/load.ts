// Loads the replica's recorded data: public/cache/replica/<future>/{project,step-<s>}.json (one file per
// step, fetched when the step is first shown). Until the recorder writes real futures, `spike` holds one real
// MiroFish step (24-25 Oct) and stands in for any future and step, labelled as such.
import type { ReplicaProject, ReplicaStep } from './types.ts'

const base = 'cache/replica'
const cache = new Map<string, Promise<unknown>>()

function json<T>(path: string): Promise<T | null> {
  let p = cache.get(path)
  if (!p) cache.set(path, (p = fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
  return p as Promise<T | null>
}

export interface ReplicaData { project: ReplicaProject; step: ReplicaStep; /** True when this is the stand-in spike data, not this future's recording. */ spike: boolean }

/** The project (Step 1) and the saved step `step` (1-based) of future `future`; the spike when absent. */
export async function loadReplica(future: number, step: number): Promise<ReplicaData | null> {
  const [project, s] = await Promise.all([json<ReplicaProject>(`${base}/${future}/project.json`), json<ReplicaStep>(`${base}/${future}/step-${step}.json`)])
  if (project && s) return { project, step: s, spike: false }
  const [sp, ss] = await Promise.all([json<ReplicaProject>(`${base}/spike/project.json`), json<ReplicaStep>(`${base}/spike/step-1.json`)])
  return sp && ss ? { project: sp, step: ss, spike: true } : null
}
