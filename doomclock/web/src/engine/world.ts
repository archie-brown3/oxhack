// Builds the engine's one input, World, from the data files. Pure: the caller reads the files
// (fetch in the browser, fs in node) and passes the parsed JSON.
import type { AnchorHistory, IsoTime, EventsFile, MarketInputs, MarketsFile, NodeId, Prob, SignalInputs, StateFile, World } from "../contracts.ts";

export interface DataFiles {
  state: StateFile; // data/state.json
  marketInputs: MarketInputs; // data/market-inputs.json
  signalInputs: SignalInputs; // data/signal-inputs.json
  events: EventsFile; // data/events.json
  markets?: MarketsFile; // doomclock/pipeline/markets.json, for the market questions
  bulletin: BulletinSetting[]; // data/clean/doomsday_clock.jsonl rows (cache/bulletin.json)
}

export interface BulletinSetting {
  ts: IsoTime;
  seconds_to_midnight: number;
}

// lagMeanYears: a default (spec §4), not market-backed.
export function worldFrom({ state, marketInputs, signalInputs, events, markets, bulletin }: DataFiles, lagMeanYears = 3): World {
  const asOf = Date.parse(state.asOf);
  const setting = bulletin.filter((b) => Date.parse(b.ts) < asOf).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)).at(-1);
  if (!setting) throw new Error(`worldFrom: no Bulletin setting before ${state.asOf}`);
  const anchors = {} as Record<NodeId, Prob>;
  const anchorHistory = {} as Record<NodeId, AnchorHistory>;
  for (const n of state.nodes) {
    const pin = markets?.manifold.find((m) => m.id === n.marketId);
    anchors[n.id] = n.p;
    anchorHistory[n.id] = {
      question: pin?.question ?? n.label,
      url: n.url,
      traders: n.traders,
      pRange12m: n.pRange12m,
      lastTradeTs: n.lastTradeTs,
      history: n.history,
    };
  }
  return {
    schema: "doomclock.world-input/1",
    asOf: state.asOf,
    anchors,
    anchorHistory,
    capabilityCurve: marketInputs.capabilityCurve,
    regions: signalInputs.regions,
    warningRate: signalInputs.warningRate,
    events: events.events,
    lagMeanYears,
    bulletinSeconds: setting.seconds_to_midnight,
  };
}
