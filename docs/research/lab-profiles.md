# Lab profiles for MiroFish agents: fields, sources, gaps

Research input, not design. Checked 24 Oct 2026 against `data/clean/{aiid,epoch,metr}.jsonl`, `data/raw/polymarket/`
and `vendor/mirofish` at the pinned `7657031`.

## 1. What a MiroFish agent needs

From `oasis_profile_generator.py`. An agent is an `OasisAgentProfile`; the Twitter run reads a CSV with five columns
(`user_id, name, username, user_char, description`, line 1114). `user_char` = `bio + persona`, injected into the agent's
system prompt, so it is the only part that steers behaviour. `description` = `bio`, shown to other agents.

| Field | Written by | Notes for us |
| --- | --- | --- |
| `name`, `user_name` | entity name / generated handle | We should pin both. |
| `bio` | LLM, "200 chars" | One-line public positioning. |
| `persona` | LLM, "2000 chars", one paragraph | Sections the prompt asks for (org version, line 770): formal identity and founding; account positioning; **voice** (style, stock phrases, taboo topics); **posting pattern**; **stance** on core topics and how it handles controversy; special notes; **"institutional memory"**: what the org has already done in the events and how it reacted. |
| `age`, `gender`, `mbti`, `country`, `profession`, `interested_topics` | LLM | For org accounts the prompt forces age 30, gender `other`, an MBTI "for style", country, a one-line function, and a topic list. |
| `follower_count`, `friend_count`, `statuses_count` | defaults 150 / 100 / 500 | Not generated. Defaults make a lab look like a nobody; set real order-of-magnitude values if influence is to matter. |

What the persona LLM *sees*: `entity_summary`, entity attributes (JSON), and a context block built from the Zep graph
(edges/facts, related nodes, hybrid search; line 457), **truncated to 3,000 chars** (`context[:3000]`). Two consequences:

1. Only about 3 KB of facts per agent reach the persona. Dated facts have to be few, dense and already worded as
   sentences, e.g. "On 2026-09-22 OpenAI released GPT-6 Sol."
2. The persona LLM invents anything the graph lacks. For labs that is mostly harmless; for real people see
   `personalities.md`.

Dates: nothing in the profile code is date-aware. A fact is "as of T" only because the seed said so. Every fact we feed
needs its own `ts < T` date in the sentence.

### Proposed per-lab record (research suggestion, not a design)

`name`, `handle`, `type` (lab), `country`, `profession` (one line), `stance_on_risk`, `openness`, `latest_models[]`
(name, ts), `incidents[]` (id, ts, one line), `public_commitments[]` (text, ts, url), `funding/ownership` (text, ts),
`regulatory_posture`, `voice` (tone, taboo), `followers` (rough). Each array item carries `ts` and `url`.

## 2. Which of our sources fills what

Counts from our clean files (window 2024-10-24 → 2026-10-11 for AIID, → 2026-09-30 for Epoch).

| Lab | Epoch models (frontier) / latest | AIID incidents (as developer) / latest | METR | Notes |
| --- | --- | --- | --- | --- |
| OpenAI | 44 (5) / GPT-6.1 Sol 2026-09-29 | 109 / #1731 2026-09-29 | 8 (o1 … GPT-5.3-Codex) | Richest on every axis. |
| Anthropic | 16 (0) / Claude Sonnet 5.5 2026-09-28 | 37 / #1751 2026-10-09 | 7 (3.7 Sonnet … Opus 4.6) | Epoch marks `frontier` false for all of its models (flag looks stale, not a fact about the lab). |
| Google DeepMind | 22 (0) + Google 3 / Gemini 4 Argon 2026-09-30 | 46 as "google" / #1700 2026-09-18 | 2 (Gemini 2.5 Pro Preview, Gemini 3 Pro) | AIID slug is `google`, not DeepMind. Many of Epoch's 22 are science models (WeatherNext). |
| Meta | 9 (1) / Muse Spark 1.3 2026-09-02 | 25 / #1649 2026-08-05 | 0 | Epoch lists "Meta AI"; AIID slug `meta`. Llama-era lab has shifted to "Muse Spark". |
| xAI | 7 (2) / Grok 4.7 2026-09-21 | 25 / #1721 2026-10-01 | 1 (Grok 4) | Incidents mostly Grok image/deepfake misuse. |
| DeepSeek | 8 (0) / V4.1 Flash 2026-09-09 (open weights) | **1** / #1188 2025-06-25 | 4 (V3, R1, V3-0324, R1-0528) | AIID thin: most DeepSeek mentions are not tagged as developer. |
| Alibaba (Qwen) | 21 (0) / Qwen3.8-2.4T-A95B 2026-08-08 (open) | **3** / latest #1186 2025-08-01 | 0 | Epoch org is "Alibaba". |
| Mistral | **2** / last entry Mistral OCR 2025-03-06 | **2** / #859 2024-10-30 | 0 | Epoch has not listed a Mistral model for 19 months; web searches say Mistral Large 4 is in preview (unverified, aggregator sources). |

Other Epoch orgs worth noting for swaps: ByteDance 7, Moonshot 7, Z.ai 7, Tencent 5, Nvidia 8, LG 7, MiniMax 3.

Per-field fill:

| Profile field | Filled by | Gap |
| --- | --- | --- |
| Identity, country, profession | Epoch `org`, `country`; hand-written | – |
| Latest models + dates (voice: "we just shipped") | Epoch `model, ts, parameters, open_weights, frontier`; METR `model, ts, time_horizon_50_min` | Epoch `ts` is the publication date, rows get added late; METR stops at **2026-02-05** (public repo), so no horizons for GPT-6 / Claude 5 / Gemini 4. |
| Capability standing | METR horizon (e.g. Claude Opus 4.6 ≈ 720 min, GPT-5.3-Codex), Polymarket best-model | METR is recomputed by us, not METR's published figure (`docs/data/metr.md`). |
| Open vs closed posture | Epoch `open_weights` | – |
| Safety record / incidents (the "memory" section) | AIID `title, description, event_date, ts, developers, deployers` | Slugs are mostly generic categories (`large-language-model-developers` 118, `deepfake-technology-developers` 325). A per-lab filter needs the lab slugs *and* a title/description text match. Chinese and French labs are nearly absent. Last ~month incomplete. |
| Competitive standing | Polymarket best-model | See below. |
| Stated risk stance, commitments (RSP, frontier frameworks, signatories) | News (BBC, Guardian, NYT…) + lab blogs/policy pages | **No source yet.** This is the biggest gap and the main reason to add news. |
| Funding, valuation, ownership, compute deals | News | No source. Examples to find: DeepSeek's first external round (reports of > ¥50bn, July–Aug 2026, figures vary by outlet); AMI Labs $1.03bn (Mar 2026). |
| Regulatory posture (EU AI Act, US preemption, China rules) | News, official registers | No source. |
| Voice, taboos, posting style | Their actual X/blog output | No source. Needs a manual pass; do not let the LLM guess. |
| Followers | public profile pages | No keyless API. Hand-enter once. |
| Leadership churn | News | No source (e.g. xAI cofounder/engineer departures reported early 2026, per The Verge via TechCrunch/the-decoder). |

### Polymarket best-model

`data/raw/polymarket/events/*.json` holds the event JSON (e.g. `727231` "Second-best AI Lab end of August?", `1040636`
"#2 AI Lab end of November? (Style Control On)", `1024961` "US x China agree to pace the AI frontier in 2026?"), but
**there is no `data/clean/polymarket.jsonl` yet**, so I could not check `ts` coverage. Once cleaned, it gives each lab
a dated "probability it is top-1/top-2 model" line, which is the only market-implied lab ranking we have. The pace
market (`1024961`) matters because of the September 2026 slowdown debate (see `personalities.md`).

## 3. Lab list: keep, swap, add

Keep all eight as the core; they are the right set by Epoch counts and by AIID mentions except where noted.

| # | Lab | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | OpenAI | keep | Densest data; most AIID incidents. |
| 2 | Anthropic | keep | 37 incidents, 7 METR points; the author of the "We Must Pace the Frontier" essay (2026-09-12, see personalities). |
| 3 | Google DeepMind | keep | Name it "Google DeepMind" but filter AIID on `google`. |
| 4 | Meta | keep | Open-vs-closed and "market-led" counterweight (Zuckerberg opposed a coordinated slowdown, Sept 2026). Verify its current open-weights stance: its newest line (Muse Spark) is listed `open_weights: No` in Epoch. |
| 5 | xAI | keep | 25 incidents; Musk is a voice on both sides. |
| 6 | DeepSeek | keep | The China open-weights lab. Data is Epoch + METR only; incidents need news. |
| 7 | Alibaba Qwen | keep, **low priority** | 21 Epoch rows but 3 AIID rows and no METR. Could be folded into a single "Chinese open-weights lab" account to save an agent slot. |
| 8 | Mistral | **swap or demote** | Two Epoch rows, last one 2025-03-06; two AIID rows. We can't date its recent facts from our sources. Swap for **Microsoft AI** or **Nvidia** (8 Epoch rows; Nvidia's CEO is the loudest "no new rules" voice in the Sept 2026 coverage), or keep Mistral only as the EU voice if the personalities list needs one. |
| + | Moonshot / Z.ai / ByteDance | optional | 7 Epoch rows each; one would give a second Chinese voice if Qwen is folded. Same AIID problem. |
| + | Safety/eval orgs (UK AISI, METR, CAIS, FLI) | **not labs** | Better modelled as institutions in the personalities file. |

## 4. Open points

- Persona text is generated in the language set by `get_language_instruction()` from a Chinese-language prompt; check
  the output language before relying on 2,000-char English personas.
- `followers/friend/statuses` stay at defaults unless we write the CSV ourselves. Influence in OASIS depends on them.
- If real people lead the agents (see `personalities.md`), the lab accounts could be *derived* from their leaders'
  public positions rather than modelled separately; decide whether labs and people are separate agents.
- The plan's current M1 task is **12 fictional archetypes with fictional names** (`docs/superpowers/plans/2026-10-24-doom-clock-build-plan.md`,
  line 66/214). Real-lab and real-person agents contradict that decision; flagged in the final report.
