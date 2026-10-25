// Step 1 of MiroFish's workbench (Step1GraphBuild.vue), on a recording: all three cards are in their finished state.
import { useEffect, useRef, useState } from 'react'
import { t } from './i18n.ts'
import type { Step1Props } from './props.ts'
import type { OntologyEdge, OntologyEntity } from './types.ts'
import './Step1GraphBuild.css'

const cx = (s: string) => s.split(' ').map((c) => `mf-s1-${c}`).join(' ')
type Item = (OntologyEntity & { itemType: 'entity' }) | (OntologyEdge & { itemType: 'relation' })

export function Step1GraphBuild({ project, graph, logs, onNext }: Step1Props) {
  const [sel, setSel] = useState<Item | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [logs.length])

  const ent = project.ontology?.entity_types, rel = project.ontology?.edge_types
  const nodes = graph?.node_count || graph?.nodes.length || 0
  const edges = graph?.edge_count || graph?.edges.length || 0
  const entity = sel?.itemType === 'entity' ? sel : null
  const relation = sel?.itemType === 'relation' ? sel : null

  return (
    <div className={cx('workbench-panel')}>
      <div className={cx('scroll-container')}>
        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>01</span><span className={cx('step-title')}>{t('step1.ontologyGeneration')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('step1.ontologyCompleted')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/graph/ontology/generate</p>
            <p className={cx('description')}>{t('step1.ontologyDesc')}</p>

            {sel && (
              <div className={cx('ontology-detail-overlay')}>
                <div className={cx('detail-header')}>
                  <div className={cx('detail-title-group')}>
                    <span className={cx('detail-type-badge')}>{sel.itemType === 'entity' ? 'ENTITY' : 'RELATION'}</span>
                    <span className={cx('detail-name')}>{sel.name}</span>
                  </div>
                  <button className={cx('close-btn')} onClick={() => setSel(null)}>×</button>
                </div>
                <div className={cx('detail-body')}>
                  <div className={cx('detail-desc')}>{sel.description}</div>
                  {!!sel.attributes?.length && (
                    <div className={cx('detail-section')}>
                      <span className={cx('section-label')}>ATTRIBUTES</span>
                      <div className={cx('attr-list')}>
                        {sel.attributes.map((a) => (
                          <div key={a.name} className={cx('attr-item')}>
                            <span className={cx('attr-name')}>{a.name}</span>
                            <span className={cx('attr-type')}>({a.type})</span>
                            <span className={cx('attr-desc')}>{a.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!entity?.examples?.length && (
                    <div className={cx('detail-section')}>
                      <span className={cx('section-label')}>EXAMPLES</span>
                      <div className={cx('example-list')}>{entity.examples.map((ex) => <span key={ex} className={cx('example-tag')}>{ex}</span>)}</div>
                    </div>
                  )}
                  {!!relation?.source_targets?.length && (
                    <div className={cx('detail-section')}>
                      <span className={cx('section-label')}>CONNECTIONS</span>
                      <div className={cx('conn-list')}>
                        {relation.source_targets.map((c, i) => (
                          <div key={i} className={cx('conn-item')}><span className={cx('conn-node')}>{c.source}</span><span className={cx('conn-arrow')}>→</span><span className={cx('conn-node')}>{c.target}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {ent && (
              <div className={cx(sel ? 'tags-container dimmed' : 'tags-container')}>
                <span className={cx('tag-label')}>GENERATED ENTITY TYPES</span>
                <div className={cx('tags-list')}>
                  {ent.map((e) => <span key={e.name} className={cx('entity-tag clickable')} onClick={() => setSel({ ...e, itemType: 'entity' })}>{e.name}</span>)}
                </div>
              </div>
            )}
            {rel && (
              <div className={cx(sel ? 'tags-container dimmed' : 'tags-container')}>
                <span className={cx('tag-label')}>GENERATED RELATION TYPES</span>
                <div className={cx('tags-list')}>
                  {rel.map((r) => <span key={r.name} className={cx('entity-tag clickable')} onClick={() => setSel({ ...r, itemType: 'relation' })}>{r.name}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={cx('step-card completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>02</span><span className={cx('step-title')}>{t('step1.graphRagBuild')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge success')}>{t('step1.ontologyCompleted')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/graph/build</p>
            <p className={cx('description')}>{t('step1.graphRagDesc')}</p>
            <div className={cx('stats-grid')}>
              <div className={cx('stat-card')}><span className={cx('stat-value')}>{nodes}</span><span className={cx('stat-label')}>{t('step1.entityNodes')}</span></div>
              <div className={cx('stat-card')}><span className={cx('stat-value')}>{edges}</span><span className={cx('stat-label')}>{t('step1.relationEdges')}</span></div>
              <div className={cx('stat-card')}><span className={cx('stat-value')}>{ent?.length || 0}</span><span className={cx('stat-label')}>{t('step1.schemaTypes')}</span></div>
            </div>
          </div>
        </div>

        <div className={cx('step-card active completed')}>
          <div className={cx('card-header')}>
            <div className={cx('step-info')}><span className={cx('step-num')}>03</span><span className={cx('step-title')}>{t('step1.buildComplete')}</span></div>
            <div className={cx('step-status')}><span className={cx('badge accent')}>{t('step1.inProgress')}</span></div>
          </div>
          <div className={cx('card-content')}>
            <p className={cx('api-note')}>POST /api/simulation/create</p>
            <p className={cx('description')}>{t('step1.buildCompleteDesc')}</p>
            <button className={cx('action-btn')} onClick={onNext}>{t('step1.enterEnvSetup') + ' ➝'}</button>
          </div>
        </div>
      </div>

      <div className={cx('system-logs')}>
        <div className={cx('log-header')}><span className={cx('log-title')}>SYSTEM DASHBOARD</span><span className={cx('log-id')}>{project.project_id || 'NO_PROJECT'}</span></div>
        <div className={cx('log-content')} ref={logRef}>
          {logs.map((l, i) => <div key={i} className={cx('log-line')}><span className={cx('log-time')}>{l.time}</span><span className={cx('log-msg')}>{l.msg}</span></div>)}
        </div>
      </div>
    </div>
  )
}
