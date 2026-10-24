The quarter face, the reading and the countdown, always in the top-left corner of World and Engine.

- **Provide:** `minutes` (years from today to date10), `range` (the 1–10 y lag crossings in minutes), `ghost` (the Bulletin's seconds ÷ 60), the countdown string and the date line. In phase 2 also provide `yours`.
- **Draw:** `DoomClock.face({ minutes, range, ghost, yours })` returns the SVG. Wrap it in `.dc-panel.dc-clock`. The thumbnail (`.dc-thumb`) calls `face({ minutes, labels: false })` with a `caption` line: "It is 6 minutes to midnight".
- The whole panel is one button that opens Why this time?.
- **Do:** label the panel REAL forecast and keep "1 min = 1 year" in the caption row.
- **Don't:** move the white hand for any game move. That's what `yours` is for. Don't draw the Bulletin's arc-and-dots mark.
