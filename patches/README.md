# MiroFish patches

Applied to the configured checkout at `~/dev/MiroFish` (same commit as `vendor/mirofish`, 7657031).
Re-apply after a fresh clone: `git -C ~/dev/MiroFish apply ~/dev/oxhack/patches/<name>.patch`, then restart the backend.

- `mirofish-english.patch`: English everywhere.
  - Default locale `en` (override with `MIROFISH_LOCALE`), so API calls without an `Accept-Language` header no longer get Chinese.
  - Stronger English instruction for the LLM, since MiroFish's prompts are written in Chinese.
  - Persona prompts ask for English country names from the entity's real location.
  - Fallback profiles no longer hard-code China (中国) for media, organisations and missing countries.
  - The web UI defaults to English.
  - The interview prefix (`backend/app/api/simulation.py:55`) is English, so interview answers come back in English.
- `mirofish-twitter-only-restart.patch`: a Twitter-only simulation can be restarted.
  - `_check_simulation_prepared` used to require `reddit_profiles.json`, which a Twitter-only prepare never writes.
  - It now requires profile files only for the platforms `state.json` enables.
  - Owner decision, 24 Oct: no Reddit.
