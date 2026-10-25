// Step 2 of MiroFish's workbench (Step2EnvSetup.vue), on a recording: every card is in its finished state, and only
// the Twitter platform is shown (owner decision: no Reddit).
import { useEffect, useRef, useState } from 'react'
import { t } from './i18n.ts'
import type { Step2Props } from './props.ts'
import type { Profile } from './types.ts'
import './Step2EnvSetup.css'

const cx = (s: string) => s.split(' ').map((c) => `mf-s2-${c}`).join(' ')
const hrs = (a?: number[]) => (a?.length ? `${a[0]}:00-${a[a.length - 1]}:00` : '-')

export function Step2EnvSetup({ project, step, logs, onBack, onNext }: Step2Props) {
  const [sel, setSel] = useState<Profile | null>(null)
  const [custom, setCustom] = useState(false)
  const cfg = step.config, tc = cfg.time_config
  const profiles = step.profiles
  const total = tc?.total_simulation_hours && tc?.minutes_per_round ? Math.max(Math.floor((tc.total_simulation_hours * 60) / tc.minutes_per_round), 40) : null
  const [rounds, setRounds] = useState(total ?? 40)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [logs.length])

  const topics = profiles.reduce((s, p) => s + (p.interested_topics?.length || 0), 0)
  // The recorder's profiles come from the cast: description/user_char stand in for bio/persona, the config's entity type for profession.
  const bio = (p: Profile) => p.bio || p.description
  const persona = (p: Profile) => p.persona || p.user_char
  const profession = (p: Profile, i: number) => p.profession || cfg.agent_configs?.[i]?.entity_type
  const username = (id: number) => profiles[id]?.username || `agent_${id}`
  const tw = cfg.twitter_config as Record<string, unknown> | undefined
  const ev = cfg.event_config
  const n = (x: number | undefined, d = 1) => (typeof x === 'number' ? x.toFixed(d) : '-')

  const periods: [string, number[] | undefined, number | undefined][] = [
    [t('step2.peakHours'), tc?.peak_hours, tc?.peak_activity_multiplier],
    [t('step2.workHours'), tc?.work_hours as number[] | undefined, tc?.work_activity_multiplier as number | undefined],
    [t('step2.morningHours'), tc?.morning_hours as number[] | undefined, tc?.morning_activity_multiplier as number | undefined],
    [t('step2.offPeakHours'), tc?.off_peak_hours, tc?.off_peak_activity_multiplier],
  ]

  return (
    <div className={cx('env-setup-panel')}>
      <div className={cx('scroll-container')}>
        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>01</span><span className={cx('step-title')}>{t('step2.simInstanceInit')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('common.completed')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/create</p>
            <p className={cx('description')}>{t('step2.simInstanceDesc')}</p>
            <div className={cx('info-card')}>
              {([['Project ID', project.project_id], ['Graph ID', project.graph_id], ['Simulation ID', step.simulation.simulation_id], ['Task ID', t('step2.asyncTaskDone')]] as const).map(([k, v]) => (
                <div key={k} className={cx('info-row')}><span className={cx('info-label')}>{k}</span><span className={cx('info-value mono')}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>02</span><span className={cx('step-title')}>{t('step2.generateAgentPersona')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('common.completed')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/prepare</p>
            <p className={cx('description')}>{t('step2.generateAgentPersonaDesc')}</p>
            {profiles.length > 0 && (
              <>
                <div className={cx('stats-grid')}>
                  <div className={cx('stat-card')}><span className={cx('stat-value')}>{profiles.length}</span><span className={cx('stat-label')}>{t('step2.currentAgentCount')}</span></div>
                  <div className={cx('stat-card')}><span className={cx('stat-value')}>{step.simulation.entities_count || '-'}</span><span className={cx('stat-label')}>{t('step2.expectedAgentTotal')}</span></div>
                  <div className={cx('stat-card')}><span className={cx('stat-value')}>{topics}</span><span className={cx('stat-label')}>{t('step2.relatedTopicsCount')}</span></div>
                </div>
                <div className={cx('profiles-preview')}>
                  <div className={cx('preview-header')}><span className={cx('preview-title')}>{t('step2.generatedAgentPersonas')}</span></div>
                  <div className={cx('profiles-list')}>
                    {profiles.map((p, i) => (
                      <div key={i} className={cx('profile-card')} onClick={() => setSel(p)}>
                        <div className={cx('profile-header')}>
                          <span className={cx('profile-realname')}>{p.username || p.name || 'Unknown'}</span>
                          <span className={cx('profile-username')}>@{p.username ? p.name : `agent_${i}`}</span>
                        </div>
                        <div className={cx('profile-meta')}><span className={cx('profile-profession')}>{profession(p, i) || t('step2.unknownProfession')}</span></div>
                        <p className={cx('profile-bio')}>{bio(p) || t('step2.noBio')}</p>
                        {!!p.interested_topics?.length && (
                          <div className={cx('profile-topics')}>
                            {p.interested_topics.slice(0, 3).map((x) => <span key={x} className={cx('topic-tag')}>{x}</span>)}
                            {p.interested_topics.length > 3 && <span className={cx('topic-more')}>+{p.interested_topics.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>03</span><span className={cx('step-title')}>{t('step2.dualPlatformConfig')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('common.completed')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/prepare</p>
            <p className={cx('description')}>{t('step2.dualPlatformConfigDesc')}</p>
            <div className={cx('config-detail-panel')}>
              <div className={cx('config-block')}>
                <div className={cx('config-grid')}>
                  <div className={cx('config-item')}><span className={cx('config-item-label')}>{t('step2.simulationDuration')}</span><span className={cx('config-item-value')}>{tc?.total_simulation_hours || '-'} {t('common.hours')}</span></div>
                  <div className={cx('config-item')}><span className={cx('config-item-label')}>{t('step2.roundDuration')}</span><span className={cx('config-item-value')}>{tc?.minutes_per_round || '-'} {t('common.minutes')}</span></div>
                  <div className={cx('config-item')}><span className={cx('config-item-label')}>{t('step2.totalRounds')}</span><span className={cx('config-item-value')}>{Math.floor((tc?.total_simulation_hours * 60) / tc?.minutes_per_round) || '-'} {t('common.rounds')}</span></div>
                  <div className={cx('config-item')}><span className={cx('config-item-label')}>{t('step2.activePerHour')}</span><span className={cx('config-item-value')}>{tc?.agents_per_hour_min}-{tc?.agents_per_hour_max}</span></div>
                </div>
                <div className={cx('time-periods')}>
                  {periods.map(([label, h, m], i) => (
                    <div key={i} className={cx('period-item')}>
                      <span className={cx('period-label')}>{label}</span>
                      <span className={cx('period-hours')}>{i === 0 ? (h?.length ? h.join(':00, ') + ':00' : '-') : hrs(h)}</span>
                      <span className={cx('period-multiplier')}>×{m ?? '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cx('config-block')}>
                <div className={cx('config-block-header')}>
                  <span className={cx('config-block-title')}>{t('step2.agentConfig')}</span>
                  <span className={cx('config-block-badge')}>{cfg.agent_configs?.length || 0} {t('common.items')}</span>
                </div>
                <div className={cx('agents-cards')}>
                  {cfg.agent_configs?.map((a) => (
                    <div key={a.agent_id} className={cx('agent-card')}>
                      <div className={cx('agent-card-header')}>
                        <div className={cx('agent-identity')}><span className={cx('agent-id')}>Agent {a.agent_id}</span><span className={cx('agent-name')}>{a.entity_name}</span></div>
                        <div className={cx('agent-tags')}><span className={cx('agent-type')}>{a.entity_type}</span><span className={cx(`agent-stance stance-${a.stance}`)}>{a.stance}</span></div>
                      </div>
                      <div className={cx('agent-timeline')}>
                        <span className={cx('timeline-label')}>{t('step2.activeTimePeriod')}</span>
                        <div className={cx('mini-timeline')}>
                          {Array.from({ length: 24 }, (_, h) => <div key={h} className={cx(a.active_hours?.includes(h) ? 'timeline-hour active' : 'timeline-hour')} title={`${h}:00`} />)}
                        </div>
                        <div className={cx('timeline-marks')}>{[0, 6, 12, 18, 24].map((m) => <span key={m}>{m}</span>)}</div>
                      </div>
                      <div className={cx('agent-params')}>
                        <div className={cx('param-group')}>
                          <div className={cx('param-item')}><span className={cx('param-label')}>{t('step2.postsPerHour')}</span><span className={cx('param-value')}>{a.posts_per_hour}</span></div>
                          <div className={cx('param-item')}><span className={cx('param-label')}>{t('step2.commentsPerHour')}</span><span className={cx('param-value')}>{a.comments_per_hour}</span></div>
                          <div className={cx('param-item')}><span className={cx('param-label')}>{t('step2.responseDelay')}</span><span className={cx('param-value')}>{a.response_delay_min}-{a.response_delay_max}min</span></div>
                        </div>
                        <div className={cx('param-group')}>
                          <div className={cx('param-item')}>
                            <span className={cx('param-label')}>{t('step2.activityLevel')}</span>
                            <span className={cx('param-value with-bar')}><span className={cx('mini-bar')} style={{ width: `${a.activity_level * 100}%` }} />{(a.activity_level * 100).toFixed(0)}%</span>
                          </div>
                          <div className={cx('param-item')}>
                            <span className={cx('param-label')}>{t('step2.sentimentBias')}</span>
                            <span className={cx(`param-value ${(a.sentiment_bias ?? 0) > 0 ? 'positive' : (a.sentiment_bias ?? 0) < 0 ? 'negative' : 'neutral'}`)}>{(a.sentiment_bias ?? 0) > 0 ? '+' : ''}{n(a.sentiment_bias)}</span>
                          </div>
                          <div className={cx('param-item')}><span className={cx('param-label')}>{t('step2.influenceWeight')}</span><span className={cx('param-value highlight')}>{n(a.influence_weight)}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {tw && (
                <div className={cx('config-block')}>
                  <div className={cx('config-block-header')}><span className={cx('config-block-title')}>{t('step2.recommendAlgoConfig')}</span></div>
                  <div className={cx('platforms-grid')}>
                    <div className={cx('platform-card')}>
                      <div className={cx('platform-card-header')}><span className={cx('platform-name')}>{t('step2.platform1Name')}</span></div>
                      <div className={cx('platform-params')}>
                        {([['recencyWeight', 'recency_weight'], ['popularityWeight', 'popularity_weight'], ['relevanceWeight', 'relevance_weight'], ['viralThreshold', 'viral_threshold'], ['echoChamberStrength', 'echo_chamber_strength']] as const).map(([k, f]) => (
                          <div key={k} className={cx('param-row')}><span className={cx('param-label')}>{t(`step2.${k}`)}</span><span className={cx('param-value')}>{String(tw[f] ?? '')}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {cfg.generation_reasoning && (
                <div className={cx('config-block')}>
                  <div className={cx('config-block-header')}><span className={cx('config-block-title')}>{t('step2.llmConfigReasoning')}</span></div>
                  <div className={cx('reasoning-content')}>
                    {cfg.generation_reasoning.split('|').slice(0, 2).map((r, i) => <div key={i} className={cx('reasoning-item')}><p className={cx('reasoning-text')}>{r.trim()}</p></div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>04</span><span className={cx('step-title')}>{t('step2.initialActivation')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('common.completed')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/prepare</p>
            <p className={cx('description')}>{t('step2.initialActivationDesc')}</p>
            {ev && (
              <div className={cx('orchestration-content')}>
                <div className={cx('narrative-box')}>
                  <span className={cx('box-label narrative-label')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={cx('special-icon')}>
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#mf-s2-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z" fill="url(#mf-s2-grad)" stroke="url(#mf-s2-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <defs><linearGradient id="mf-s2-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#FF5722" /><stop offset="1" stopColor="#FF9800" /></linearGradient></defs>
                    </svg>
                    {t('step2.narrativeDirection')}
                  </span>
                  <p className={cx('narrative-text')}>{ev.narrative_direction}</p>
                </div>
                <div className={cx('topics-section')}>
                  <span className={cx('box-label')}>{t('step2.initialHotTopics')}</span>
                  <div className={cx('hot-topics-grid')}>{ev.hot_topics?.map((x) => <span key={x} className={cx('hot-topic-tag')}># {x}</span>)}</div>
                </div>
                <div className={cx('initial-posts-section')}>
                  <span className={cx('box-label')}>{t('step2.initialActivationSeq', { count: ev.initial_posts?.length ?? 0 })}</span>
                  <div className={cx('posts-timeline')}>
                    {ev.initial_posts?.map((p, i) => (
                      <div key={i} className={cx('timeline-item')}>
                        <div className={cx('timeline-marker')} />
                        <div className={cx('timeline-content')}>
                          <div className={cx('post-header')}>
                            <span className={cx('post-role')}>{p.poster_type}</span>
                            <span className={cx('post-agent-info')}><span className={cx('post-id')}>Agent {p.poster_agent_id}</span><span className={cx('post-username')}>@{username(p.poster_agent_id ?? -1)}</span></span>
                          </div>
                          <p className={cx('post-text')}>{p.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={cx('step-card active')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>05</span><span className={cx('step-title')}>{t('step2.setupComplete')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge processing')}>{t('step1.inProgress')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/start</p>
            <p className={cx('description')}>{t('step2.setupCompleteDesc')}</p>
            {total && (
              <div className={cx('rounds-config-section')}>
                <div className={cx('rounds-header')}>
                  <div className={cx('header-left')}>
                    <span className={cx('section-title')}>{t('step2.roundsConfig')}</span>
                    <span className={cx('section-desc')}>{t('step2.roundsConfigDesc', { hours: tc?.total_simulation_hours || '-', minutesPerRound: tc?.minutes_per_round || '-' })}</span>
                  </div>
                  <label className={cx('switch-control')}>
                    <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
                    <span className={cx('switch-track')} />
                    <span className={cx('switch-label')}>{t('step2.customToggle')}</span>
                  </label>
                </div>
                {custom ? (
                  <div className={cx('rounds-content custom')}>
                    <div className={cx('slider-display')}>
                      <div className={cx('slider-main-value')}><span className={cx('val-num')}>{rounds}</span><span className={cx('val-unit')}>{t('step2.roundsUnit')}</span></div>
                      <div className={cx('slider-meta-info')}><span>{t('step2.estimatedDuration', { minutes: Math.round(rounds * 0.6) })}</span></div>
                    </div>
                    <div className={cx('range-wrapper')}>
                      <input type="range" min={10} max={total} step={5} value={rounds} onChange={(e) => setRounds(+e.target.value)} className={cx('minimal-slider')} style={{ ['--percent' as string]: `${((rounds - 10) / (total - 10)) * 100}%` }} />
                      <div className={cx('range-marks')}>
                        <span>10</span>
                        <span className={cx(rounds === 40 ? 'mark-recommend active' : 'mark-recommend')} onClick={() => setRounds(40)} style={{ position: 'absolute', left: `calc(${((40 - 10) / (total - 10)) * 100}% - 30px)` }}>{t('step2.recommendedRounds', { rounds: 40 })}</span>
                        <span>{total}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cx('rounds-content auto')}>
                    <div className={cx('auto-info-card')}>
                      <div className={cx('auto-value')}><span className={cx('val-num')}>{total}</span><span className={cx('val-unit')}>{t('step2.roundsUnit')}</span></div>
                      <div className={cx('auto-content')}>
                        <div className={cx('auto-meta-row')}>
                          <span className={cx('duration-badge')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {t('step2.estimatedDurationFull', { minutes: Math.round(total * 0.6) })}
                          </span>
                        </div>
                        <div className={cx('auto-desc')}><p className={cx('highlight-tip')} onClick={() => setCustom(true)}>{t('step2.customTip')} ➝</p></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className={cx('action-group dual')}>
              <button className={cx('action-btn secondary')} onClick={onBack}>← {t('step2.backToGraphBuild')}</button>
              <button className={cx('action-btn primary')} onClick={onNext}>{t('step2.startDualWorldSim')} ➝</button>
            </div>
          </div>
        </div>
      </div>

      {sel && (
        <div className={cx('profile-modal-overlay')} onClick={(e) => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className={cx('profile-modal')}>
            <div className={cx('modal-header')}>
              <div className={cx('modal-header-info')}>
                <div className={cx('modal-name-row')}><span className={cx('modal-realname')}>{sel.username || sel.name}</span><span className={cx('modal-username')}>@{sel.name}</span></div>
                <span className={cx('modal-profession')}>{profession(sel, profiles.indexOf(sel))}</span>
              </div>
              <button className={cx('close-btn')} onClick={() => setSel(null)}>×</button>
            </div>
            <div className={cx('modal-body')}>
              <div className={cx('modal-info-grid')}>
                <div className={cx('info-item')}><span className={cx('info-label')}>{t('step2.profileModalAge')}</span><span className={cx('info-value')}>{sel.age || '-'} {t('step2.yearsOld')}</span></div>
                <div className={cx('info-item')}><span className={cx('info-label')}>{t('step2.profileModalGender')}</span><span className={cx('info-value')}>{({ male: t('step2.genderMale'), female: t('step2.genderFemale'), other: t('step2.genderOther') } as Record<string, string>)[sel.gender ?? ''] || sel.gender || '-'}</span></div>
                <div className={cx('info-item')}><span className={cx('info-label')}>{t('step2.profileModalCountry')}</span><span className={cx('info-value')}>{sel.country || '-'}</span></div>
                <div className={cx('info-item')}><span className={cx('info-label')}>{t('step2.profileModalMbti')}</span><span className={cx('info-value mbti')}>{sel.mbti || '-'}</span></div>
              </div>
              <div className={cx('modal-section')}><span className={cx('section-label')}>{t('step2.profileModalBio')}</span><p className={cx('section-bio')}>{bio(sel) || t('step2.noBio')}</p></div>
              {!!sel.interested_topics?.length && (
                <div className={cx('modal-section')}><span className={cx('section-label')}>{t('step2.profileModalTopics')}</span><div className={cx('topics-grid')}>{sel.interested_topics.map((x) => <span key={x} className={cx('topic-item')}>{x}</span>)}</div></div>
              )}
              {persona(sel) && (
                <div className={cx('modal-section')}>
                  <span className={cx('section-label')}>{t('step2.profileModalPersona')}</span>
                  <div className={cx('persona-dimensions')}>
                    {(['Experience', 'Behavior', 'Memory', 'Social'] as const).map((d) => <div key={d} className={cx('dimension-card')}><span className={cx('dim-title')}>{t(`step2.personaDim${d}`)}</span><span className={cx('dim-desc')}>{t(`step2.personaDim${d}Desc`)}</span></div>)}
                  </div>
                  <div className={cx('persona-content')}><p className={cx('section-persona')}>{persona(sel)}</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={cx('system-logs')}>
        <div className={cx('log-header')}><span className={cx('log-title')}>SYSTEM DASHBOARD</span><span className={cx('log-id')}>{step.simulation.simulation_id || 'NO_SIMULATION'}</span></div>
        <div className={cx('log-content')} ref={logRef}>
          {logs.map((l, i) => <div key={i} className={cx('log-line')}><span className={cx('log-time')}>{l.time}</span><span className={cx('log-msg')}>{l.msg}</span></div>)}
        </div>
      </div>
    </div>
  )
}
