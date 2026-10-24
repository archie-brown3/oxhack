# Personalities for the MiroFish X simulation: 20 candidates

Research input, not design. Checked 24 Oct 2026. Positions below come from web-search results (secondary outlets unless
the URL is a primary page); each one has a date and a URL. **Anything marked "verify" is from my background knowledge or a
single aggregator and has not been checked against a primary source.** Dates are publication dates of the cited piece.

## Why these people matter in the sim

The big live storyline as of 24 Oct is the **September 2026 "pace the frontier" debate**. Amodei published *We Must Pace the
Frontier* on **2026-09-12**; Altman, Hassabis and Musk reacted publicly; Zuckerberg and Huang opposed coordination
(AP syndication, 2026-09-16). Anyone dropped into the sim needs a position on that. Where a person's reaction is not
documented below, a persona LLM will invent one, so fill it before T.

## How MiroFish uses a person

`oasis_profile_generator.py` turns each Zep entity into a `OasisAgentProfile`. For individuals the prompt asks for
**age, gender (male/female only), MBTI, country, profession, interested_topics**, a 200-char bio and a 2,000-char persona
covering background, personality, social-media behaviour, stance and a "personal memory" of the person's actions in the
event. Two consequences for real people:

- **MBTI, age, gender and "what angers them" will be invented** unless we pin them or the graph states them. An invented
  MBTI for a real named person is a fabrication shown as a profile field. Suggest: never display MBTI/personality fields
  in the UI; only use persona text internally.
- The context given to the persona LLM is cut to **3,000 chars** per entity, so 3–5 dated quotes per person is the
  budget. "Few dated positions" below is sized to that.

Gender is binary in the prompt; real people should have it set from their own public pronouns, not guessed. (I have used
"they" for everyone below because pronouns aren't stated in our sources.)

## Keeping them current without the paid X API

All of these were fetched keyless on 24 Oct 2026:

| Route | Works for | Check |
| --- | --- | --- |
| **Bluesky public API** `public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<did-or-handle>` | anyone with an active account; each post has `createdAt` (ISO, our `ts`) | HTTP 200 without auth. Last post seen: Yoshua Bengio 2026-10-21, Karen Hao 2026-10-21, Casey Newton 2026-10-23, Gary Marcus 2026-09-19, Stuart Russell 2026-09-13. **Yann LeCun's account has not posted since 2024-12-15**; Kevin Roose since 2025-06-17. Altman, Hassabis, Amodei, Hinton: no posts found. **Do not trust `searchActors`**: it returned plausible-looking handles for Yudkowsky and Kokotajlo that I could not confirm are theirs. Confirm each handle by hand. |
| **Personal blog / Substack RSS** | Bengio `yoshuabengio.org/feed/`, Marcus `garymarcus.substack.com/feed`, AI Futures `blog.ai-futures.org/feed`, LessWrong user feeds (200, RSS) | `blog.samaltman.com/posts.atom` returned 200 but as `text/html`, so it is not a valid feed URL (needs a check). `darioamodei.com/rss.xml` is 404; the essays are on the site itself. |
| **Outlet RSS** | Guardian AI section, BBC Technology, NYT Technology feeds all 200 | gives recent headlines naming people; no archive. |
| **News-archive name queries** | any person | see `news-archives.md` (GDELT, Guardian, NYT). The cheapest "what did X say" source is `"Name" AND (AI)` over a dated window. |
| **Transcripts / hearings** | policymakers | Hansard, congress.gov, EU Parliament plenary pages, gov.uk press releases are public; slower but primary. |
| **Lab blogs** | lab leaders | Posts are public and dated. |

Treat a person's X posts as unavailable except via news quoting them. Quotes taken from news reports are secondary: date
the *report*, not the post.

## The list

Stance codes: **Alarm** (extinction/catastrophic risk is real and near), **Concern** (serious, wants rules), **Pace**
(supports slowing or coordinated limits), **Accel** (against slowdown/regulation), **Skeptic** (doubts the risk or the
hype). Region: US / UK / EU / CN / other.

### Lab leaders

| # | Person | Role | Region | Stance | Why in the sim |
| --- | --- | --- | --- | --- | --- |
| 1 | **Sam Altman** | CEO, OpenAI | US | Pace (backs "pacing", warns of extinction risk, resists hard limits) | Biggest AI brand; also the most-tracked market subject (best-model, IPO). |
| 2 | **Dario Amodei** | CEO, Anthropic | US | Pace / Concern | Author of the September 2026 pacing proposal; the sim's natural escalation voice. |
| 3 | **Demis Hassabis** | CEO, Google DeepMind | UK | Concern, "direction is right" | Scientist-CEO; neutral broker. |
| 4 | **Mark Zuckerberg** | CEO, Meta | US | Accel / market-led | Principal public dissenter against coordination. |
| 5 | **Elon Musk** | Owner, xAI (SpaceX) | US | Mixed: backs pause rhetoric, ships fast | High volatility; the most reply-generating account. |
| 6 | **Liang Wenfeng** | Founder, DeepSeek | CN | Accel / open source, AGI-first | The only Chinese lab-founder voice; rarely posts publicly, so quote from interviews. |
| 7 | **Jensen Huang** | CEO, Nvidia | US | Accel / market-led | Compute supplier; strongest "no new regulation" voice. |

Positions:

- **Altman.** 2026-09-13: said even a 10% chance of AI-driven extinction by the end of the decade is "unacceptable", and
  "I would say not 2026" on an IPO ([Khaleej Times / Reuters](https://www.khaleejtimes.com/openais-altman-wont-do-ipo-this-year-calls-ai-extinction-risk-unacceptable)).
  2026-09-16: backs "pacing" without stopping it, "it should be slower than it otherwise could be; interventions like
  safety cases and monitoring have significant costs" ([AP via OPB](https://www.opb.org/article/2026/09/16/divisions-emerge-in-the-tech-industry-over-calls-for-a-coordinated-ai-slowdown/)).
  Within hours of the Amodei essay (about 2026-09-12) posted agreement on X and promised OpenAI would grant evaluators
  access ([tech-insider summary](https://tech-insider.org/what-amodei-actually-proposed-in-we-must-pace-the-frontier/); aggregator, verify).
  2023-05-30: signed the CAIS extinction statement ([safe.ai](https://safe.ai/work/statement-on-ai-risk)).
- **Amodei.** 2026-09-12: essay *We Must Pace the Frontier* on his own site: "We must slow the pace at which we improve the
  capabilities of AI models"; three steps: independent third-party evaluation, shared industry safety standards, limited
  international coordination ([AP via OPB](https://www.opb.org/article/2026/09/16/divisions-emerge-in-the-tech-industry-over-calls-for-a-coordinated-ai-slowdown/);
  [summary](https://tech-insider.org/what-amodei-actually-proposed-in-we-must-pace-the-frontier/)). Acknowledged China's
  cooperation would be hard. 2026 (date to verify): Yann LeCun called his warnings "deluded"
  ([dealroom](https://dealroom.co/news/159797-yann-lecun-calls-dario-amodei-deluded-and-ai-doom-the-worst-marketing-ca/)).
- **Hassabis.** Reacted to the essay on social media: details to be worked out but "direction is correct"; DeepMind had
  recently put out a proposal for an industry standards body for frontier AI ([tech-insider](https://tech-insider.org/what-amodei-actually-proposed-in-we-must-pace-the-frontier/); aggregator, verify). 2023-05-30: signed
  the CAIS statement.
- **Zuckerberg.** 2026-09-16: "Every lab has the responsibility and incentive to move at the pace required to train its
  models safely"; rejects industry-wide coordination ([AP via OPB](https://www.opb.org/article/2026/09/16/divisions-emerge-in-the-tech-industry-over-calls-for-a-coordinated-ai-slowdown/);
  NBC quote via [aiweekly.co](https://aiweekly.co/alerts/zuckerberg-breaks-with-amodei-altman-musk-on-ai-slowdown-after-un-briefing-no), secondary, verify).
- **Musk.** Posted "Dario is right" on X after the essay ([tech-insider summary](https://tech-insider.org/what-amodei-actually-proposed-in-we-must-pace-the-frontier/); aggregator, verify).
  2026-02-27: in a deposition said xAI prioritizes safety better than OpenAI ([TechCrunch](https://techcrunch.com/2026/02/27/musk-bashes-openai-in-deposition-saying-nobody-committed-suicide-because-of-grok/)).
  Early 2026: reporting of xAI departures and safety criticism ([the-decoder](https://the-decoder.com/xais-founder-exodus-reportedly-tied-to-safety-concerns-and-frustration-over-groks-failure-to-catch-up/)): second-hand accounts from former staff, not Musk's own words.
- **Liang.** Late July 2026: transcript (Tencent Tech, reported by NYU Shanghai RITS) of a near four-hour investor meeting
  describing an AGI-first, compute-bound strategy ([RITS](https://rits.shanghai.nyu.edu/ai/deepseek-founder-details-agi-first-compute-bound-strategy-in-investor-meeting/)).
  July–Aug 2026: first external fundraise reported at more than ¥50bn, amounts vary by outlet. Has reaffirmed open-source
  models ([same RITS piece](https://rits.shanghai.nyu.edu/ai/deepseek-founder-details-agi-first-compute-bound-strategy-in-investor-meeting/)).
- **Huang.** 2026-09-16: "The market forces are already there — we don't need any new laws, we don't need new
  regulations" ([AP via OPB](https://www.opb.org/article/2026/09/16/divisions-emerge-in-the-tech-industry-over-calls-for-a-coordinated-ai-slowdown/)).

### Researchers

| # | Person | Role | Region | Stance | Why in the sim |
| --- | --- | --- | --- | --- | --- |
| 8 | **Yann LeCun** | Exec. chair, AMI Labs (ex-Meta) | EU/US | Skeptic | The principal named risk-skeptic; alive and loud. |
| 9 | **Geoffrey Hinton** | Emeritus, Toronto; Nobel 2024 | UK/CA | Alarm | Most credible alarm voice for the public. |
| 10 | **Yoshua Bengio** | Prof., Mila; LawZero | CA | Alarm / Concern | Most active alarm voice on a keyless feed. |
| 11 | **Stuart Russell** | Prof., Berkeley; CHAI | US/UK | Alarm / Concern | Policy-facing academic; treaty and testimony voice. |

- **LeCun.** March 10, 2026: AMI Labs raised $1.03bn at a $3.5bn pre-money valuation; LeBrun is CEO, LeCun executive chair
  ([techloy](https://techloy.com/former-meta-ai-chief-yann-lecun-raises-1-03b-for-12-employee-startup-ami-labs)). Says he
  has "zero concerns" about extinction and that rules framed around extreme risk entrench large firms
  ([dealroom](https://dealroom.co/news/159797-yann-lecun-calls-dario-amodei-deluded-and-ai-doom-the-worst-marketing-ca/); dated Oct 2026 per the search summary, verify date). Told the BBC that ChatGPT, Claude and Gemini
  "are not a path towards human level or human-like intelligence" (date not confirmed).
  **His Bluesky account has been silent since 2024-12-15**; use news/talks only.
- **Hinton.** 2023-05-30 signed the CAIS statement ([safe.ai](https://safe.ai/work/statement-on-ai-risk)). A trade-press
  item titled "Godfather of AI joins calls to slow artificial intelligence" appeared around the pacing debate
  ([Insurance Business](https://www.insurancebusinessmag.com/us/news/technology/godfather-of-ai-joins-calls-to-slow-artificial-intelligence-589567.aspx)):
  I saw only the title; open it to confirm it is Hinton and the date before use. No Bluesky posts found.
- **Bengio.** 2023-05-30 signed the CAIS statement. Blog feed `yoshuabengio.org/feed/` and Bluesky (last post
  2026-10-21) are both live. Specific 2026 statements: **none gathered, verify** from his feed.
- **Russell.** 2023-05-30 listed alongside the CAIS signatories (the press release lists him as textbook author; signature
  itself unconfirmed here, verify). Bluesky last post 2026-09-13. Specific 2026 statements: **none gathered, verify**.

### Safety voices

| # | Person | Role | Region | Stance | Why in the sim |
| --- | --- | --- | --- | --- | --- |
| 12 | **Eliezer Yudkowsky** | MIRI | US | Alarm (stop everything) | The hard-line position; calibrates the left edge. |
| 13 | **Daniel Kokotajlo** | AI Futures Project; *AI 2027* | US | Concern with timelines | A forecaster, close to the Doom Clock's own premise. |

Both from background knowledge; **no 2026 positions collected, verify before use.** Yudkowsky's co-authored book
*If Anyone Builds It, Everyone Dies* (Sept 2025) and Kokotajlo's *AI 2027* scenario (Apr 2025) are the dated anchors I
remember. RSS: AI Futures `blog.ai-futures.org/feed` (200); LessWrong feeds (200). MIRI also published memos on Chinese AI
governance in April and July 2026 ([MIRI, Jul 2026](https://intelligence.org/wp-content/uploads/Promising-Signals-on-AI-Governance-from-China-MIRI-July-2026.pdf)).

### Policymakers

| # | Person | Role | Region | Stance | Why in the sim |
| --- | --- | --- | --- | --- | --- |
| 14 | **David Sacks** | White House AI & crypto adviser | US | Accel / preemption | The US government's pro-industry voice. **Verify he still holds the role.** |
| 15 | **Michael Kratsios** | OSTP Director | US | Accel / framework | Co-author of the federal framework. |
| 16 | **Henna Virkkunen** | EU Commission EVP, tech sovereignty | EU | Concern, "support tools first" | The EU AI Act delay voice. |
| 17 | **Kanishka Narayan** | UK AI minister | UK | Concern | Latest government warning to labs (Oct 2026). |
| 18 | **Xi Jinping** (or an academic voice) | PRC head of state | CN | Governance-first, state-led | Only region-level voice for China; see flag 2. |

- **US.** 2025-12-11: executive order targeting state AI laws and tasking DOJ with an AI Litigation Task Force, Sacks
  central ([Akin Gump](https://www.akingump.com/en/insights/alerts/president-trump-unveils-ai-eo-advancing-federal-preemption-of-state-laws)).
  2026-03-26: Kratsios urged Congress to adopt the National Policy Framework for AI, pairing preemption with carve-outs
  ([Morgan Lewis, Mar 2026](https://www.morganlewis.com/de/pubs/2026/03/white-house-ai-framework-puts-federal-preemption-at-the-center-of-the-debate)).
  2026-06-02: EO 14409 *Promoting Advanced Artificial Intelligence Innovation and Security*, a voluntary pre-release
  framework for frontier developers ([Reed Smith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102mnyd/decoding-the-2026-white-house-ai-blueprint-u-s-ai-policy-starts-to-take-shape/); secondary, verify the number). Sacks's own words
  were not found this session.
- **EU.** 2025-11: Commission proposed the Digital Omnibus on AI; Virkkunen: "It is about ensuring support tools like
  standards, specifications, and guidelines are in place before high-risk rules apply". 2026-05-07: provisional deal
  delaying high-risk rules to 2027-12-02 ([JD Supra](https://www.jdsupra.com/legalnews/eu-legislators-agree-to-delay-for-high-5617765/));
  a plenary vote on 2026-06-16 is reported by one source only; final adoption not confirmed.
- **UK.** 2026-10-12: Narayan to frontier labs, "Investigate unexpected behaviour. And if you cannot adequately control the
  risks, do not release the system" ([tech.eu](https://tech.eu/2026/10/12/ai-minister-calls-on-ai-frontier-labs-to-ramp-up-safety-as-uk-ups-cyber-defences/)).
  A "Frontier AI Bill" is mentioned by one unreliable source only; the Cyber Security and Resilience Bill is in the Lords.
- **China.** July 2026 (World AI Conference): Xi called for laws, technological monitoring, early warning and emergency
  response to keep AI under human control; the World AI Cooperation Organisation launched with 29 members
  ([von.gov.ng](https://von.gov.ng/china-hosts-2026-world-ai-conference-on-ai-governance/); [MIRI memo, advocacy source](https://intelligence.org/wp-content/uploads/Promising-Signals-on-AI-Governance-from-China-MIRI-July-2026.pdf)).
  Safer alternative to modelling Xi: an institution account (e.g. a Chinese AI Governance forum) or a named academic;
  I could not verify the academic names I had in mind (Andrew Yao, Zhang Ya-Qin) this session.

### Commentators and journalists

| # | Person | Role | Region | Stance | Why in the sim |
| --- | --- | --- | --- | --- | --- |
| 19 | **Gary Marcus** | Author, *Marcus on AI* | US | Skeptic of hype, pro-regulation | The "AI is overhyped *and* needs rules" voice; adds a third axis. |
| 20 | **Karen Hao** | Journalist, *Empire of AI* | US | Critical of labs | The critical-journalism voice; active on Bluesky (2026-10-21). |

Alternatives: **Kevin Roose** (NYT; Bluesky silent since 2025-06-17, so only via NYT archive) and **Casey Newton**
(Platformer; Bluesky active 2026-10-23). Both are good if we want the NYT outlet to be present as a person. Dated 2026
positions for all four: **none gathered, verify** from their feeds or the NYT/Guardian archives.

## Balance check

- Region: US about 12, UK 2 (Hassabis, Narayan), EU 2 (Virkkunen, LeCun based in Paris), CN 2 (Liang, Xi), plus Hinton/Bengio in Canada.
  China is thin and relies on state and company voices; a Chinese independent researcher would help but I could not
  source one.
- Stance: Alarm 4 (Hinton, Bengio, Russell, Yudkowsky), Concern/Pace 6, Accel 5 (Zuckerberg, Huang, Sacks, Kratsios,
  Liang), Skeptic 3 (LeCun, Marcus, partly Hao). Roughly balanced; Concern/Pace is the heaviest bucket.
- Women: Virkkunen, Hao only. The list is male-skewed because the field is; options: add Fei-Fei Li, Timnit Gebru,
  Helen Toner, Mira Murati (all unverified here).

## Sensitive: questions for Archie

1. **Real people as agents.** The sim puts invented words in the mouths of named, living people. Even labelled
   "simulation", a generated tweet reading like Altman or Hinton endorsing something can be screenshotted out of context.
   Options: (a) keep real names but show a persistent "simulated, not real quotes" badge; (b) use roles ("AI lab CEO,
   safety-leaning") instead of names, as the plan already does with 12 fictional archetypes; (c) name them only in the
   *seed* (facts) and give agents fictional handles. Which? This is the biggest call.
2. **Heads of state and sitting government officials.** Xi, Sacks, Kratsios, Virkkunen, Narayan. Simulated statements
   from a head of state, a US official or an EU Commissioner carry more risk (misreading, diplomatic) than a CEO's. Do we
   include any, or use institutional accounts ("the White House OSTP", "the EU Commission")?
3. **Invented personal traits.** The profile generator fills MBTI, age and personality for real people. Do we suppress those
   fields in the output and the UI? I'd suggest yes.
4. **Real companies' alleged conduct.** The incident feed (AIID) contains allegations against named firms (e.g. Anthropic
   #1751, Meta #1649, Google #1700 as titled in AIID). An agent "recalling" them is stating a fact about a real company. OK
   with attribution to the AIID record only?
5. **Vulnerable subjects.** AIID also includes harms to named private individuals (e.g. a teen hiker, a lawsuit plaintiff).
   Suggest the sim never names private individuals from AIID.
6. **Journalists.** Putting named journalists in the sim implies they would post in the game's voice. Prefer outlets
   (as accounts) over bylines?
7. **Impersonation on X.** The sim runs on a simulated platform, not X. Make sure nothing posts to or looks like a real
   X account (handles, avatars, blue ticks).
