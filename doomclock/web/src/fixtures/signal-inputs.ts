import type { SignalInputs } from '../contracts.ts'

export const signalInputs: SignalInputs = {
  schema: 'doomclock.signal-inputs/1',
  regions: { US: 0.58, China: 0.3, rest: 0.12, metric: 'fixture metric', source: 'fixture' },
  warningRate: { perQuarter: 4.2, window: { from: '2025-01', to: '2026-09' }, source: 'AIID' },
  datacentres: [
    { name: 'Fixture Ashburn', lat: 39.04, lon: -77.49, region: 'US', hotel: true, source: 'https://example.com/dc' },
    { name: 'Fixture Shanghai', lat: 31.23, lon: 121.47, region: 'China', hotel: false, source: 'https://example.com/dc' },
  ],
  ticker: [{ title: 'Fixture ticker line', url: 'https://example.com/t', ts: '2026-10-24T08:00:00Z', source: 'aiid' }],
}
