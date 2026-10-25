# Doom Clock — judging deck template

`doom-clock-deck.pptx` — 7 slides, 16:9, one layout per slide (View → Slide Master shows the seven
layouts, each with its backdrop and title placeholders). Speaker notes on every slide carry the
agenda and the technical talking points; the slides themselves are backgrounds plus a title, ready
for real UI screenshots.

- `backdrops/` — the seven 1920×1080 backgrounds, drawn from `context/design-system/tokens.json`
  (Stage theme, Paper for the close), pixelated and Bayer-dithered.
- `fonts/` — Geist, Geist Mono and PT Serif. Install them (double-click → Install Font) or the
  deck falls back to system fonts.
- `build/backdrops.py` regenerates the backgrounds; `build/build.js` (pptxgenjs) rebuilds the deck.

Slide 5's centre is a hyperlink to https://doomclock-web.vercel.app.
