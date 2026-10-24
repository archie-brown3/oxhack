# OxHack 2026: briefs and judging criteria

Source: `Opening Ceremony Slides.pdf` (slide numbers below) and `swarm/brief.md`. Anything not
on a slide is marked as the team's inference.

## Event

- Hacking runs Sat 24 Oct 2026 12:00 to **Sun 25 Oct 2026 12:00** (Europe/London). About 18
  real build hours.
- Judges walk round tables on Sunday afternoon. Each table gets a short visit, so the demo must
  land in seconds.
- Theme: **TIME** (loose).
- Team goal: a strong live demo that solves a real problem, consumer-facing.

## Track 1: HRT, "Best use of Data for Predictions & Decision Making" (slide 21)

The slide gives the title only. No rubric was published.

Judges are HRT algorithm developers, software engineers and data scientists (slides 15 to 17).
Team's inference of what they reward (`swarm/brief.md`):

- An honest baseline, beaten out of sample.
- Calibrated probabilities, not just point predictions.
- A decision driven by the prediction, with a measurable cost or saving.
- Careful data work: provenance, licences, leakage, splits.

What they will not reward: stock-price prediction, overnight deep nets, accuracy measured on
training data.

## Track 2: Delta, "Built with Delta" (slides 27 to 29)

What they look for:

- Projects that feel fast: snappy UX, zero unnecessary friction.
- Projects that solve a real problem. "Not a demo. Something you'd actually open tomorrow."
- Projects that are thoughtful: clean code, smart architecture, good decisions.

How you win:

| Criterion | Weight | Question |
|---|---|---|
| Speed & Performance | 30% | Does it feel fast? Is the UX snappy and responsive? |
| Technical Implementation | 25% | Clean code, smart architecture, good use of collaboration features |
| Innovation | 25% | Fresh idea. Real problem. New angle. |
| Polish & Usability | 20% | Would you actually use this? Does it delight? |

Delta also asks teams to show collaboration through shared Delta threads. The team has not
decided whether to use Delta, so do not score thread usage.
