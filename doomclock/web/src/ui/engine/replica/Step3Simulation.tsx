// 1:1 clone of MiroFish's Step3Simulation.vue on recorded data. The recorded rounds replay: only actions
// before `round` exist, and the counters, status and elapsed time follow. Nothing is started, stopped or polled.
import { useEffect, useMemo, useRef } from 'react'
import { t } from './i18n.ts'
import type { Step3Props } from './props.ts'
import type { SimAction } from './types.ts'
import { actionsBy } from './replay.ts'
import './Step3Simulation.css'

const LABELS: Record<string, string> = {
  CREATE_POST: 'POST', REPOST: 'REPOST', LIKE_POST: 'LIKE', CREATE_COMMENT: 'COMMENT', LIKE_COMMENT: 'LIKE', DO_NOTHING: 'IDLE',
  FOLLOW: 'FOLLOW', SEARCH_POSTS: 'SEARCH', QUOTE_POST: 'QUOTE', UPVOTE_POST: 'UPVOTE', DOWNVOTE_POST: 'DOWNVOTE',
}
const CLASSES: Record<string, string> = {
  CREATE_POST: 'badge-post', REPOST: 'badge-action', LIKE_POST: 'badge-action', CREATE_COMMENT: 'badge-comment', LIKE_COMMENT: 'badge-action',
  QUOTE_POST: 'badge-post', FOLLOW: 'badge-meta', SEARCH_POSTS: 'badge-meta', UPVOTE_POST: 'badge-action', DOWNVOTE_POST: 'badge-action', DO_NOTHING: 'badge-idle',
}
const HANDLED = ['CREATE_POST', 'QUOTE_POST', 'REPOST', 'LIKE_POST', 'CREATE_COMMENT', 'SEARCH_POSTS', 'FOLLOW', 'UPVOTE_POST', 'DOWNVOTE_POST', 'DO_NOTHING']
const trunc = (s: unknown, n = 100) => { const x = typeof s === 'string' ? s : ''; return x.length > n ? x.slice(0, n) + '...' : x }
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
const clock = (ts: string) => { try { return new Date(ts.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(ts) ? ts : ts + 'Z').toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '' } }
const elapsed = (round: number, mpr: number) => { if (!round || round <= 0) return '0h 0m'; const m = round * mpr; return `${Math.floor(m / 60)}h ${m % 60}m` }

const P = 'mf-s3-'
const c = (...n: string[]) => n.map((x) => P + x).join(' ')
const Globe = ({ s = 14, cls = '' }: { s?: number; cls?: string }) => <svg className={cls} viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
const Chat = ({ s = 14, cls = '' }: { s?: number; cls?: string }) => <svg className={cls} viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
const Check = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
const Ico = ({ s = 14, filled = false, children }: { s?: number; filled?: boolean; children: React.ReactNode }) => (
  <svg className={c('icon-small') + (filled ? ' ' + c('filled') : '')} viewBox="0 0 24 24" width={s} height={s} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">{children}</svg>
)

function Platform({ kind, name, round, rounds, mpr, acts, done, tip }: { kind: string; name: string; round: number; rounds: number; mpr: number; acts: number; done: boolean; tip: string[] }) {
  const running = round > 0 && !done
  return (
    <div className={c('platform-status', kind) + (running ? ' ' + c('active') : '') + (done ? ' ' + c('completed') : '')}>
      <div className={c('platform-header')}>
        {kind === 'twitter' ? <Globe cls={c('platform-icon')} /> : <Chat cls={c('platform-icon')} />}
        <span className={c('platform-name')}>{name}</span>
        {done && <span className={c('status-badge')}><Check /></span>}
      </div>
      <div className={c('platform-stats')}>
        <span className={c('stat')}><span className={c('stat-label')}>ROUND</span><span className={c('stat-value', 'mono')}>{round}<span className={c('stat-total')}>/{rounds || '-'}</span></span></span>
        <span className={c('stat')}><span className={c('stat-label')}>TIME</span><span className={c('stat-value', 'mono')}>{elapsed(round, mpr)}</span></span>
        <span className={c('stat')}><span className={c('stat-label')}>ACTS</span><span className={c('stat-value', 'mono')}>{acts}</span></span>
      </div>
      <div className={c('actions-tooltip')}>
        <div className={c('tooltip-title')}>Available Actions</div>
        <div className={c('tooltip-actions')}>{tip.map((a) => <span key={a} className={c('tooltip-action')}>{a}</span>)}</div>
      </div>
    </div>
  )
}

function Card({ a }: { a: SimAction }) {
  const g = a.action_args ?? {}
  const type = a.action_type
  return (
    <div className={c('timeline-item', a.platform)}>
      <div className={c('timeline-marker')}><div className={c('marker-dot')} /></div>
      <div className={c('timeline-card')}>
        <div className={c('card-header')}>
          <div className={c('agent-info')}>
            <div className={c('avatar-placeholder')}>{(a.agent_name || 'A')[0]}</div>
            <span className={c('agent-name')}>{a.agent_name}</span>
          </div>
          <div className={c('header-meta')}>
            <div className={c('platform-indicator')}>{a.platform === 'twitter' ? <Globe s={12} /> : <Chat s={12} />}</div>
            <div className={c('action-badge', CLASSES[type] ?? 'badge-default')}>{LABELS[type] ?? type ?? 'UNKNOWN'}</div>
          </div>
        </div>
        <div className={c('card-body')}>
          {type === 'CREATE_POST' && !!g.content && <div className={c('content-text', 'main-text')}>{str(g.content)}</div>}
          {type === 'QUOTE_POST' && <>
            {!!g.quote_content && <div className={c('content-text')}>{str(g.quote_content)}</div>}
            {!!g.original_content && <div className={c('quoted-block')}>
              <div className={c('quote-header')}><Ico s={12}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Ico><span className={c('quote-label')}>@{str(g.original_author_name) || 'User'}</span></div>
              <div className={c('quote-text')}>{trunc(g.original_content, 150)}</div>
            </div>}
          </>}
          {type === 'REPOST' && <>
            <div className={c('repost-info')}><Ico><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Ico><span className={c('repost-label')}>Reposted from @{str(g.original_author_name) || 'User'}</span></div>
            {!!g.original_content && <div className={c('repost-content')}>{trunc(g.original_content, 200)}</div>}
          </>}
          {type === 'LIKE_POST' && <>
            <div className={c('like-info')}><Ico filled><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></Ico><span className={c('like-label')}>Liked @{str(g.post_author_name) || 'User'}'s post</span></div>
            {!!g.post_content && <div className={c('liked-content')}>"{trunc(g.post_content, 120)}"</div>}
          </>}
          {type === 'CREATE_COMMENT' && <>
            {!!g.content && <div className={c('content-text')}>{str(g.content)}</div>}
            {!!g.post_id && <div className={c('comment-context')}><Chat s={12} cls={c('icon-small')} /><span>Reply to post #{str(g.post_id)}</span></div>}
          </>}
          {type === 'SEARCH_POSTS' && <div className={c('search-info')}><Ico><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ico><span className={c('search-label')}>Search Query:</span><span className={c('search-query')}>"{str(g.query)}"</span></div>}
          {type === 'FOLLOW' && <div className={c('follow-info')}><Ico><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></Ico><span className={c('follow-label')}>Followed @{str(g.target_user) || str(g.target_user_name) || str(g.user_id) || str(g.follow_id) || 'User'}</span></div>}
          {(type === 'UPVOTE_POST' || type === 'DOWNVOTE_POST') && <>
            <div className={c('vote-info')}><Ico>{type === 'UPVOTE_POST' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}</Ico><span className={c('vote-label')}>{type === 'UPVOTE_POST' ? 'Upvoted' : 'Downvoted'} Post</span></div>
            {!!g.post_content && <div className={c('voted-content')}>"{trunc(g.post_content, 120)}"</div>}
          </>}
          {type === 'DO_NOTHING' && <div className={c('idle-info')}><Ico><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Ico><span className={c('idle-label')}>Action Skipped</span></div>}
          {!HANDLED.includes(type) && !!g.content && <div className={c('content-text')}>{str(g.content)}</div>}
        </div>
        <div className={c('card-footer')}><span className={c('time-tag')}>R{a.round_num} • {clock(a.timestamp)}</span></div>
      </div>
    </div>
  )
}

export function Step3Simulation({ step, round, rounds, logs, onBack, onNext }: Step3Props) {
  const shown = useMemo(() => actionsBy(step, round), [step, round])
  const tw = shown.filter((a) => a.platform === 'twitter').length
  const rd = shown.filter((a) => a.platform === 'reddit').length
  const cur = Math.min(round, rounds)
  const done = round >= rounds
  const mpr = step.config?.time_config?.minutes_per_round ?? 60
  const scroll = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const e = scroll.current; if (e) e.scrollTop = e.scrollHeight }, [shown.length])
  useEffect(() => { const e = logRef.current; if (e) e.scrollTop = e.scrollHeight }, [logs.length])

  return (
    <div className={c('simulation-panel')}>
      <div className={c('control-bar')}>
        <div className={c('status-group')}>
          <Platform kind="twitter" name="Info Plaza" round={cur} rounds={rounds} mpr={mpr} acts={tw} done={done} tip={['POST', 'LIKE', 'REPOST', 'QUOTE', 'FOLLOW', 'IDLE']} />
          <Platform kind="reddit" name="Topic Community" round={0} rounds={rounds} mpr={mpr} acts={rd} done={false} tip={['POST', 'COMMENT', 'LIKE', 'DISLIKE', 'SEARCH', 'TREND', 'FOLLOW', 'MUTE', 'REFRESH', 'IDLE']} />
        </div>
        <div className={c('action-controls')}>
          <button className={c('back')} onClick={onBack}>{t('common.back')}</button>
          <button className={c('action-btn', 'primary')} disabled={!done} onClick={onNext}>
            {t('step3.startGenerateReportBtn')}<span className={c('arrow-icon')}>→</span>
          </button>
        </div>
      </div>

      <div className={c('main-content-area')} ref={scroll}>
        {shown.length > 0 && (
          <div className={c('timeline-header')}>
            <div className={c('timeline-stats')}>
              <span className={c('total-count')}>TOTAL EVENTS: <span className={c('mono')}>{shown.length}</span></span>
              <span className={c('platform-breakdown')}>
                <span className={c('breakdown-item', 'twitter')}><Globe s={12} cls={c('mini-icon')} /><span className={c('mono')}>{tw}</span></span>
                <span className={c('breakdown-divider')}>/</span>
                <span className={c('breakdown-item', 'reddit')}><Chat s={12} cls={c('mini-icon')} /><span className={c('mono')}>{rd}</span></span>
              </span>
            </div>
          </div>
        )}
        <div className={c('timeline-feed')}>
          <div className={c('timeline-axis')} />
          {shown.map((a, i) => <Card key={`${a.timestamp}-${a.agent_id}-${i}`} a={a} />)}
          {shown.length === 0 && <div className={c('waiting-state')}><div className={c('pulse-ring')} /><span>{t('step3.waitingForActions')}</span></div>}
        </div>
      </div>

      <div className={c('system-logs')}>
        <div className={c('log-header')}><span className={c('log-title')}>SIMULATION MONITOR</span><span className={c('log-id')}>{step.simulation.simulation_id || 'NO_SIMULATION'}</span></div>
        <div className={c('log-content')} ref={logRef}>
          {logs.map((l, i) => <div className={c('log-line')} key={i}><span className={c('log-time')}>{l.time}</span><span className={c('log-msg')}>{l.msg}</span></div>)}
        </div>
      </div>
    </div>
  )
}
