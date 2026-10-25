// Doom Clock - OxHack 2026 deck template. Seven layouts, one backdrop each, editable titles,
// speaker notes carrying the agenda. Backgrounds only: screenshots and copy go on top in PowerPoint.
const pptxgen = require("pptxgenjs");

const THEME = {
  name: "Doom Clock",
  headFontFace: "PT Serif",
  bodyFontFace: "Geist",
  colors: {
    dk1: "0B0B0B", // ground (stage)
    lt1: "F1F1F1", // ink (stage) / ground (paper)
    dk2: "161616", // raised
    lt2: "A8A8A8", // ink-2
    accent1: "851618", // oxblood
    accent2: "E5484D", // alarm
    accent3: "6EA8F5", // ward
    accent4: "B392F0", // sim
    accent5: "808080", // ink-3
    accent6: "2C2C2C", // rule
    hlink: "F1F1F1",
    folHlink: "A8A8A8",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in = 1920 x 1080 at 144 px/in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Doom Clock - OxHack 2026";
pres.author = "Archie Brown";
pres.company = "Doom Clock";
// Token colours as hex: PowerPoint for Mac rejects the rewritten theme, so no scheme colours.
const C = { background1: "F1F1F1", background2: "A8A8A8", text1: "1F1F1F", accent5: "808080" };
const px = (n) => n / 144;

const BG = "/home/claude/deck/bg/";
const SANS = "Geist", MONO = "Geist Mono", SERIF = "PT Serif";

// --- layouts: one frame per slide. Titles sit where the backdrop leaves room. ---
pres.defineSlideMaster({
  title: "1 Title - the terminator", background: { path: BG + "01-title.png" },
  objects: [
    { placeholder: { options: { name: "eyebrow", type: "body", x: px(100), y: px(560), w: px(900), h: px(30), margin: 0,
      fontFace: MONO, fontSize: 12, color: C.accent5, charSpacing: 2 }, text: "OXHACK 2026 · THEME: TIME · HRT TRACK" } },
    { placeholder: { options: { name: "title", type: "title", x: px(100), y: px(600), w: px(1000), h: px(240), margin: 0,
      fontFace: SERIF, fontSize: 88, color: C.background1, align: "left", valign: "top" }, text: "Doom Clock" } },
    { placeholder: { options: { name: "sub", type: "body", x: px(104), y: px(850), w: px(900), h: px(80), margin: 0,
      fontFace: SANS, fontSize: 20, color: C.background2, valign: "top" }, text: "AI risk made visible, run on real data." } },
  ],
});

const stageTitle = (name, bgFile, titleW) => pres.defineSlideMaster({
  title: name, background: { path: BG + bgFile },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: px(100), y: px(84), w: px(titleW), h: px(100), margin: 0,
      fontFace: SANS, fontSize: 36, bold: true, color: C.background1, charSpacing: -0.5, align: "left", valign: "top" }, text: "Title" } },
    { placeholder: { options: { name: "sub", type: "body", x: px(100), y: px(196), w: px(titleW), h: px(40), margin: 0,
      fontFace: MONO, fontSize: 13, color: C.accent5, align: "left", valign: "top" }, text: "subtitle" } },
  ],
});
stageTitle("2 Promise - the face", "02-promise.png", 1400);
stageTitle("3 Data - the spine", "03-data.png", 1500);
stageTitle("4 Model - the fan", "04-model.png", 820);
stageTitle("6 Track record - the cards", "06-track.png", 1500);

pres.defineSlideMaster({
  title: "5 Demo - the HUD", background: { path: BG + "05-demo.png" },
  objects: [
    { placeholder: { options: { name: "tabs", type: "body", x: px(760), y: px(20), w: px(400), h: px(44), margin: 0,
      fontFace: SANS, fontSize: 11, bold: true, color: C.background2, charSpacing: 1, align: "center", valign: "middle" },
      text: "INPUTS   ·   WORLD   ·   ENGINE" } },
    { placeholder: { options: { name: "title", type: "title", x: px(1500), y: px(36), w: px(380), h: px(40), margin: 0,
      fontFace: SANS, fontSize: 12, bold: true, color: C.accent5, charSpacing: 1.5, align: "left", valign: "top" }, text: "WATCHED FUTURE" } },
    { placeholder: { options: { name: "future", type: "body", x: px(1500), y: px(80), w: px(380), h: px(80), margin: 0,
      fontFace: SANS, fontSize: 16, color: C.background1, valign: "top" }, text: "Typical · the median of 10,000" } },
  ],
});

pres.defineSlideMaster({
  title: "7 Close - paper", background: { path: BG + "07-close.png" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: px(360), y: px(330), w: px(1200), h: px(290), margin: 0,
      fontFace: SERIF, fontSize: 52, color: C.text1, align: "center", valign: "middle" }, text: "A prediction, not a prophecy." } },
    { placeholder: { options: { name: "sub", type: "body", x: px(100), y: px(700), w: px(1000), h: px(60), margin: 0,
      fontFace: MONO, fontSize: 13, color: "6B6B6B", valign: "top" }, text: "doomclock-web.vercel.app" } },
  ],
});

// --- slides ---
pres.addSection({ title: "Doom Clock" });
const S = (masterName) => pres.addSlide({ masterName, sectionTitle: "Doom Clock" });

let s = S("1 Title - the terminator");
s.addText("OXHACK 2026 · THEME: TIME · HRT TRACK", { placeholder: "eyebrow" });
s.addText("Doom Clock", { placeholder: "title" });
s.addText("AI risk made visible, run on real data.", { placeholder: "sub" });
s.addNotes(`HOOK (5%). The clock reads 85 seconds to midnight: the Bulletin's setting, as a starting point. Say the one promise: a forecast of AI catastrophe built from dated, sourced data that anyone can inspect. Add team names to the sub-line.`);

s = S("2 Promise - the face");
s.addText("Nobody can inspect the forecast", { placeholder: "title" });
s.addText("the promise", { placeholder: "sub" });
s.addNotes(`THE PROMISE (10%). Dated: every record carries the time it became public. Sourced: every number links to its market, incident or run. Labelled: REAL / SIMULATED / GAME RULE beside every claim. Lineage: looks like the Bulletin's clock, plays like Plague Inc. Today's hand is pinned to the Bulletin's 85 s as a display scale; the model sets the pace and the 1-in-10 date.`);

s = S("3 Data - the spine");
s.addText("What the engine knows", { placeholder: "title" });
s.addText("asOf(T): nothing with ts ≥ T is ever returned", { placeholder: "sub" });
s.addNotes(`DATA (20%). Inputs: 4 Manifold anchors (ASI by 2030 / 2040 / 2100, AI kills ≥10% by 2100), the Kalshi KXAGICO ladder as the capability curve (cummax'd, real money), the AI Incident Database, government actions, Epoch's 77 datacentres. Rules: raw API bodies saved before parsing; point-in-time reads filter ts < T, times compared as numbers; T is truncated to the second (can only drop data, never leak it). Admit the thin market: cat2100 has 19 traders and 7 daily closes - shown beside the result, never hidden. Data freeze T = 2026-10-24T20:51:00Z. Polymarket and Kalshi feed the backtest, not the forecast.`);

s = S("4 Model - the fan");
s.addText("One model, two views", { placeholder: "title" });
s.addText("the clock reads it · 10,000 futures sample it", { placeholder: "sub" });
s.addNotes(`MODEL (20%). ASI arrival: a piecewise-linear CDF with knots at the market deadlines, pool-adjacent-violators monotonised when markets disagree. p_bad = P(cat by 2100) / P(ASI by 2100) = 0.297 / 0.864 ≈ 0.34. Lag ASI → catastrophe: exponential - the one assumption no market backs, labelled a GAME RULE. The hand: the first year P(catastrophe) ≥ 1 in 10, by bisection on the continuous CDF. The globe: a seeded Monte Carlo (mulberry32) of 10,000 futures drawn from the same distribution - tested to agree with the hand within 1 pt per quarter. Why it moved: leave-one-out drivers per anchor, the rest held; events are context, never causes. Backdrop: the fan over the CDF, 1-in-10 in red, the crossing year marked.`);

s = S("5 Demo - the HUD");
s.addText("INPUTS   ·   WORLD   ·   ENGINE", { placeholder: "tabs" });
s.addText("WATCHED FUTURE", { placeholder: "title" });
s.addText("Typical · the median of 10,000", { placeholder: "future" });
s.addText("Open the live demo →", {
  x: px(560), y: px(500), w: px(800), h: px(90), margin: 0, isTextBox: true, objectName: "demo link",
  fontFace: SANS, fontSize: 28, bold: true, color: C.background1, align: "center", valign: "middle",
  hyperlink: { url: "https://doomclock-web.vercel.app", tooltip: "doomclock-web.vercel.app" },
});
s.addText("doomclock-web.vercel.app", {
  x: px(560), y: px(590), w: px(800), h: px(30), margin: 0, isTextBox: true, objectName: "demo url",
  fontFace: MONO, fontSize: 13, color: C.accent5, align: "center",
});
s.addNotes(`LIVE DEMO (20%). Path: Inputs with the as-of slider (prove no leakage) → Replay one future on the globe, read the driver callout under the clock → Engine: MiroFish's screens on the 24 Oct spike, labelled stand-in, not a recorded future → Why this time? and Track record. The two futures are an illustrative stand-in. Replace the centre with screenshots or switch to the browser; the link opens the live site, which may be an older build until the Vercel root is doomclock/web.`);

s = S("6 Track record - the cards");
s.addText("Track record: are the inputs any good?", { placeholder: "title" });
s.addText("2,371 resolved questions · T = resolution − 30 d · time-split at the median T (1 Mar 2026)", { placeholder: "sub" });
s.addNotes(`TRACK RECORD (20%). Out of sample, Brier (lower is better), test half n = 1,186: Market 0.085 (95% CI 0.071–0.101) · 50% coin 0.250 · Base rate 0.183 (0.162–0.210) · Blind Gemini 2.5 Flash 0.185 (0.166–0.208). The blend weight w was picked on train from 0…1 and w = 0 won: we report it. 5 of 5 leakage checks pass, computed from the data on every run. LLM spend $0.14. Caveats: this scores the market inputs, never the countdown date; Manifold is play money; Polymarket events and Kalshi ladders are clustered in the 2,000-resample bootstrap; survivorship (only resolved YES/NO count). Four cards: one per method.`);

s = S("7 Close - paper");
s.addText("A prediction, not a prophecy.", { placeholder: "title" });
s.addText("doomclock-web.vercel.app  ·  github.com/archie-brown3/oxhack", { placeholder: "sub" });
s.addNotes(`CLOSE (5%). Three labels: REAL (the record: markets, incidents, government actions), SIMULATED (MiroFish's X feed, events and news), GAME RULE (the lag, and any effect no market backs). One line on what a decision could buy. End on the verdict.`);

(async () => {
  const out = "/home/claude/deck/doom-clock-deck.pptx";
  await pres.writeFile({ fileName: out });
  console.log("wrote", out);
})();
