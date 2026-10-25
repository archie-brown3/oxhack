# Lab weights (`data/lab-weights.json`)

**What / feeds:** each of the game's 8 labs' share of Epoch AI's notable models in the two years to the data freeze,
normalised over the 8 (game plan §4, the lab personas). A count of published models, not compute or capability.

- **Script:** `node doomclock/pipeline/derive/weights.ts [--asOf=ISO]` (default: `data/state.json`'s `asOf`). Reads
  `data/clean/epoch.jsonl` through `asOf(T)`, so only models published before T count.
- **Counting:** a model counts for a lab when its Epoch `org` is exactly one of the lab's names. Google DeepMind
  includes the 2 models listed as "Google". Multi-org rows (a lab plus universities) count for no lab.
- **Shape:** `{schema: "doomclock.lab-weights/1", asOf, window: {from, to}, metric, source, labs: [{lab, region, orgs, count, weight}]}`.
- **On 24 Oct 2026:** OpenAI 44 (0.34), Google DeepMind 22 (0.17), Alibaba 21 (0.16), Anthropic 16 (0.12), Meta 8
  (0.06), DeepSeek 8 (0.06), xAI 7 (0.05), Nvidia 4 (0.03). `fetch/assert-p2.ts` checks each within 0.01.
