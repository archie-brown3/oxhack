# MiroFish HTTP API (as the Doom Clock pipeline calls it)

Pinned `7657031`. Source: `vendor/mirofish/backend/app/api/{graph,simulation,report}.py`. Base URL
`http://localhost:5001`. Blueprints: `/api/graph`, `/api/simulation`, `/api/report`, plus `GET /health`.
Every response is `{"success": bool, "data": {...}}` or `{"success": false, "error": "..."}` (4xx/5xx).
Long jobs return a `task_id` immediately; poll for completion. No auth.

Cost legend: **LLM** = spends LLM credits, **ZEP** = uses Zep Cloud, **free** = local only.

## One full run, in order

| # | Call | Cost | Purpose |
| --- | --- | --- | --- |
| 0 | `GET /health` | free | `{"service":"MiroFish Backend","status":"ok"}` |
| 1 | `POST /api/graph/ontology/generate` | **LLM** (1 call) | upload seed + requirement → `project_id`, ontology |
| 2 | `POST /api/graph/build` | **ZEP** (no LLM) | chunk the seed, build the graph → `task_id` |
| 3 | `GET /api/graph/task/<task_id>` (poll) | free | until `completed`; then `project.graph_id` is set |
| 4 | `POST /api/simulation/create` | free | new simulation on the project → `simulation_id` |
| 5 | `POST /api/simulation/prepare` | **LLM + ZEP** | personas and config → `task_id` |
| 6 | `POST /api/simulation/prepare/status` (poll) | free | until `completed` / `ready` |
| 7 | `POST /api/simulation/start` | **LLM** (the big spend) | run the simulation |
| 8 | `GET /api/simulation/<id>/run-status` (poll) | free | until `runner_status` = `completed` |
| 9 | `GET /api/simulation/<id>/posts`, `/actions`, `/timeline` | free | read the simulated world |
| 10 | `POST /api/report/generate` | **LLM + ZEP** | ReportAgent → `task_id` |
| 11 | `POST /api/report/generate/status` (poll), `GET /api/report/by-simulation/<id>` | free | the markdown report |
| 12 | `POST /api/simulation/close-env` | free | shut the simulation environment down |

Steps 9–11 are optional for the ticker (the posts alone can feed it); the report is what a "world alarm" reading is
most naturally taken from.

## Graph

### 1. `POST /api/graph/ontology/generate`
`multipart/form-data`:

- `files` (repeatable, required): `.pdf`, `.md`, `.markdown`, `.txt`. Other extensions are silently skipped; if none are
  usable → 400. Whole request ≤ 50 MB. Text is read with encoding detection.
- `simulation_requirement` (required): the prediction-requirement text.
- `project_name` (optional), `additional_context` (optional).

Creates a project, stores the files, runs the ontology LLM (reads up to 50,000 chars of the combined text; longer seeds
are excerpted). Response `data`:
`{project_id, project_name, ontology: {entity_types[], edge_types[]}, analysis_summary, files[{filename,size}], total_text_length}`.
Provider failures return 502 and the project is marked `failed`.

### 2. `POST /api/graph/build`
JSON `{project_id, graph_name?, chunk_size?=500, chunk_overlap?=50, force?=false}`. Needs project status
`ontology_generated`. Returns `{project_id, task_id, message}` (or `reused: true` if a build is already running; a
completed project returns its existing `graph_id` unless `force`). Background thread: creates a Zep graph, sets the
ontology, uploads chunks in batches of 350, waits for Zep to process them. Needs `ZEP_API_KEY`; **no LLM**.

### 3. `GET /api/graph/task/<task_id>`
`data`: `{task_id, status: pending|processing|completed|failed, progress, message, result?, error?}`.
Then `GET /api/graph/project/<project_id>` → `data.graph_id`, `data.status` (`graph_completed`).

Other graph routes: `GET /api/graph/project/list`, `GET|DELETE /api/graph/project/<id>`,
`POST /api/graph/project/<id>/reset`, `GET /api/graph/tasks`, `GET /api/graph/data/<graph_id>` (nodes and edges),
`DELETE /api/graph/delete/<graph_id>` (deletes the Zep graph).

## Simulation

### 4. `POST /api/simulation/create`
JSON `{project_id, graph_id?, enable_twitter?=true, enable_reddit?=true}`. `graph_id` defaults to the project's.
→ `data`: `{simulation_id, project_id, graph_id, status: "created", enable_twitter, enable_reddit, created_at}`.
Round count and agent activity are *not* parameters here: the LLM writes them during prepare.

### 5. `POST /api/simulation/prepare`
JSON `{simulation_id, entity_types?, use_llm_for_profiles?=true, parallel_profile_count?=5, force_regenerate?=false}`.
Reads entities from the Zep graph, writes one persona per entity (LLM, plus Zep searches), then has the LLM write the
simulation config (simulated hours, minutes per round, activity levels, initial posts, per-agent behaviour).
→ `data`: `{simulation_id, task_id, status: "preparing"}`; if already prepared and not forced:
`{status: "ready", already_prepared: true}` (no spend).

### 6. `POST /api/simulation/prepare/status`
JSON `{task_id?, simulation_id?}` → `data`: `{status: processing|completed|ready, progress 0–100, message, already_prepared}`.
Helpers while waiting: `GET /api/simulation/<id>/profiles/realtime`, `/config/realtime`; afterwards
`GET /api/simulation/<id>/config` (read `time_config.total_simulation_hours` and `minutes_per_round` to know the
round count before paying for step 7).

### 7. `POST /api/simulation/start`
JSON `{simulation_id, platform?="parallel" (twitter|reddit|parallel), max_rounds?, enable_graph_memory_update?=false, force?=false}`.
**`max_rounds` is the cost cap**: the run is truncated to `min(configured rounds, max_rounds)`; without it a default
config runs 72 rounds. `enable_graph_memory_update: true` writes every agent action back to Zep (more ZEP spend;
keep it off). `force` stops and clears a previous run. Launches a subprocess (`run_parallel_simulation.py`).
→ `data`: `{simulation_id, runner_status: "running", process_pid, twitter_running, reddit_running, started_at}`.

### 8. `GET /api/simulation/<id>/run-status`
`data`: `{runner_status: idle|starting|running|paused|stopping|stopped|completed|failed, current_round, total_rounds, progress_percent, simulated_hours, twitter_actions_count, reddit_actions_count, total_actions_count, started_at, updated_at}`.
Poll every few seconds until `completed` (or `failed`). `GET .../run-status/detail` adds recent actions.
`POST /api/simulation/stop` `{simulation_id}` aborts.

### 9. Reading results (all free)

- `GET /api/simulation/<id>/posts?platform=twitter|reddit&limit=50&offset=0` (from the run's SQLite DB)
- `GET /api/simulation/<id>/comments` (Reddit)
- `GET /api/simulation/<id>/actions?limit&offset&platform&agent_id&round_num`
- `GET /api/simulation/<id>/timeline`, `/agent-stats`
- `POST /api/simulation/interview`, `/interview/batch`, `/interview/all` `{simulation_id, ...}`: ask agents questions
  (**LLM**; needs the environment alive, see `/env-status`). Not needed for the ticker.

### 12. `POST /api/simulation/close-env`
JSON `{simulation_id}`. Also `POST /api/simulation/env-status`. Other: `GET /api/simulation/list`, `GET /api/simulation/history`,
`GET /api/simulation/<id>`, `GET /api/simulation/entities/<graph_id>[...]`.

## Report

### 10. `POST /api/report/generate`
JSON `{simulation_id, force_regenerate?=false}` → `data`: `{simulation_id, task_id, status: "generating"}` (or the
existing completed report). The ReportAgent plans 2–5 sections and writes each with tool calls into the Zep graph and
the simulation (default budget 5 tool calls and 2 reflection rounds per section). **LLM + ZEP.**

### 11. Reading the report
- `POST /api/report/generate/status` `{task_id?, simulation_id?}` → `{status: processing|completed|failed, progress, report_id}`
- `GET /api/report/by-simulation/<simulation_id>` or `GET /api/report/<report_id>` →
  `{report_id, simulation_id, status, outline, markdown_content, created_at, completed_at}`
- `GET /api/report/<report_id>/sections`, `/progress`, `/download`, `/agent-log`, `/console-log`
- `POST /api/report/chat` (**LLM**), `POST /api/report/tools/search`, `/tools/statistics`

## Gotchas for the pipeline

- Everything is stateful on the backend's disk (`backend/uploads/`). Keep ids (`project_id`, `graph_id`,
  `simulation_id`, `report_id`) in our own state file.
- One Zep graph per project. Delete finished rounds' graphs (`DELETE /api/graph/delete/<graph_id>`) to stay inside the Zep
  quota; a graph can't be deleted while a simulation or report is still using it.
- **Send `Accept-Language: en` on every request.** The locale defaults to `zh` (`utils/locale.py`) and is also
  captured for the background threads, so messages and LLM prompts come back in Chinese otherwise.
- A restart of the backend loses in-memory task state (`/api/graph/task/...`, held in memory); the project and simulation files on disk remain.
