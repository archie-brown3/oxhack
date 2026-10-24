# MiroFish patches

Applied to the configured checkout at `~/dev/MiroFish` (same commit as `vendor/mirofish`, 7657031).
Re-apply after a fresh clone: `git -C ~/dev/MiroFish apply ~/dev/oxhack/patches/<name>.patch`, then restart the backend.

- `mirofish-english.patch`: English everywhere.
  - Default locale `en` (override with `MIROFISH_LOCALE`), so API calls without an `Accept-Language` header no longer get Chinese.
  - Stronger English instruction for the LLM, since MiroFish's prompts are written in Chinese.
  - Persona prompts ask for English country names from the entity's real location.
  - Fallback profiles no longer hard-code China (中国) for media, organisations and missing countries.
  - The web UI defaults to English.
