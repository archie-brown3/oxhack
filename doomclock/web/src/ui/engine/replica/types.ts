// The replica's data: the payloads of MiroFish's own GET endpoints, saved per step by the recorder
// (doomclock/pipeline/world). `data` of each response, unwrapped. Nothing here is ever fetched from the
// backend by the browser: it reads public/cache/replica/<future>/ (see load.ts).
// Fields we do not read are typed loosely on purpose; MiroFish may add more.

/** GET /api/graph/project/:id. Saved once per future (Step 1). */
export interface ReplicaProject {
  project_id: string
  name: string
  status: string
  graph_id: string
  created_at: string
  updated_at: string
  simulation_requirement: string
  analysis_summary: string
  total_text_length: number
  chunk_size: number
  chunk_overlap: number
  files: { filename: string; size: number }[]
  ontology: { entity_types: OntologyEntity[]; edge_types: OntologyEdge[] }
  graph_build_task_id?: string
  [k: string]: unknown
}
export interface OntologyEntity { name: string; description: string; attributes: { name: string; type?: string; description: string }[]; examples?: string[] }
export interface OntologyEdge { name: string; description: string; source_targets: { source: string; target: string }[]; attributes: { name: string; type?: string; description: string }[] }

/** GET /api/graph/data/:graph_id. Saved per step, after the graph memory drained: it holds everything
 *  up to the end of that step. Items carry created_at, which the replay uses to grow the graph. */
export interface GraphNode { uuid: string; name: string; labels: string[]; summary: string; attributes: Record<string, unknown>; created_at: string | null }
export interface GraphEdge {
  uuid: string; name: string; fact: string; fact_type: string
  source_node_uuid: string; target_node_uuid: string; source_node_name: string; target_node_name: string
  attributes: Record<string, unknown>; episodes: string[]
  created_at: string | null; valid_at: string | null; invalid_at: string | null; expired_at: string | null
}
export interface GraphData { graph_id: string; node_count: number; edge_count: number; nodes: GraphNode[]; edges: GraphEdge[] }

/** GET /api/simulation/:id */
export interface SimulationInfo {
  simulation_id: string; project_id: string; graph_id: string; status: string
  entities_count: number; profiles_count: number; entity_types: string[]
  config_generated: boolean; config_reasoning?: string
  enable_twitter: boolean; enable_reddit: boolean
  created_at: string; updated_at: string
  [k: string]: unknown
}

/** GET /api/simulation/:id/profiles?platform=twitter -> data.profiles (the OASIS profile). */
export interface Profile {
  user_id?: number; name: string; username?: string; user_name?: string; bio?: string; description?: string
  persona?: string; user_char?: string; profession?: string; interested_topics?: string[]
  age?: number; gender?: string; mbti?: string; country?: string
  karma?: number; follower_count?: number; friend_count?: number; statuses_count?: number
  [k: string]: unknown
}

/** GET /api/simulation/:id/config */
export interface SimConfig {
  simulation_id: string; generated_at: string; generation_reasoning?: string; simulation_requirement: string
  time_config: { total_simulation_hours: number; minutes_per_round: number; agents_per_hour_min: number; agents_per_hour_max: number; peak_hours: number[]; off_peak_hours: number[]; peak_activity_multiplier: number; off_peak_activity_multiplier: number; [k: string]: unknown }
  agent_configs: { agent_id: number; entity_name: string; entity_type: string; activity_level: number; posts_per_hour?: number; comments_per_hour?: number; response_delay_min?: number; response_delay_max?: number; sentiment_bias?: number; stance: string; influence_weight: number; active_hours: number[]; [k: string]: unknown }[]
  event_config: { initial_posts?: { content: string; poster_type?: string; poster_agent_id?: number }[]; hot_topics?: string[]; narrative_direction?: string; scheduled_events?: unknown[]; [k: string]: unknown }
  twitter_config?: Record<string, unknown>; reddit_config?: Record<string, unknown>
  [k: string]: unknown
}

/** GET /api/simulation/:id/run-status */
export interface RunStatus {
  simulation_id: string; runner_status: string; current_round: number; total_rounds: number; progress_percent: number
  simulated_hours: number; total_simulation_hours: number
  twitter_running: boolean; twitter_completed: boolean; twitter_current_round: number; twitter_simulated_hours: number; twitter_actions_count: number
  reddit_running: boolean; reddit_completed: boolean; reddit_current_round: number; reddit_simulated_hours: number; reddit_actions_count: number
  total_actions_count: number; started_at: string | null; updated_at: string | null; completed_at: string | null; error: string | null
  [k: string]: unknown
}

/** GET /api/simulation/:id/actions -> data.actions. */
export interface SimAction {
  round_num: number; timestamp: string; platform: 'twitter' | 'reddit'; agent_id: number; agent_name: string
  action_type: string; action_args: Record<string, unknown>; result: unknown; success: boolean
}
/** GET /api/simulation/:id/posts?platform=twitter -> data.posts. */
export interface SimPost { post_id: number; user_id: number; content: string; quote_content: string | null; original_post_id: number | null; created_at: number | string; num_likes: number; num_dislikes: number; num_shares: number; num_reports: number }
/** GET /api/simulation/:id/timeline -> data.timeline. */
export interface TimelineRound { round_num: number; twitter_actions: number; reddit_actions: number; total_actions: number; active_agents_count: number; active_agents: number[]; action_types: Record<string, number>; first_action_time: string; last_action_time: string }
/** GET /api/simulation/:id/agent-stats -> data.stats. */
export interface AgentStat { agent_id: number; agent_name: string; total_actions: number; twitter_actions: number; reddit_actions: number; action_types: Record<string, number>; first_action_time: string; last_action_time: string }

/** GET /api/report/:id */
export interface ReportInfo {
  report_id: string; simulation_id: string; graph_id: string; status: string
  simulation_requirement: string; markdown_content: string
  outline: { title?: string; summary?: string; sections: { title: string; content: string }[] } | null
  created_at: string; completed_at: string | null; error: string | null
}
/** GET /api/report/:id/sections -> data.sections. */
export interface ReportSection { section_index: number; filename: string; content: string }
/** GET /api/report/:id/agent-log -> data.logs. `details` varies by `action`. */
export interface AgentLogEntry {
  timestamp: string; report_id: string; elapsed_seconds: number
  action: 'report_start' | 'planning_start' | 'planning_complete' | 'section_start' | 'tool_call' | 'tool_result' | 'llm_response' | 'section_content' | 'section_complete' | 'report_complete' | string
  stage: string; section_index: number | null; section_title: string | null
  details: Record<string, unknown>
}

/** Everything one 6-month step of one future saved: the files public/cache/replica/<future>/step-<s>.json. */
export interface ReplicaStep {
  simulation: SimulationInfo
  profiles: Profile[]
  config: SimConfig
  runStatus: RunStatus
  actions: SimAction[]
  posts: SimPost[]
  timeline: TimelineRound[]
  agentStats: AgentStat[]
  graph: GraphData
  report: ReportInfo
  sections: ReportSection[]
  agentLog: AgentLogEntry[]
  /** GET /api/report/:id/console-log -> data.logs: "[hh:mm:ss] LEVEL: message". */
  consoleLog: string[]
}
