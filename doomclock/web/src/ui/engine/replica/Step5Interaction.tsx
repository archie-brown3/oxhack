import { t } from './i18n.ts'

// Step 5 (chat with the report agent, survey the world) needs the live MiroFish backend. The replica shows
// MiroFish's own header and tool names, and says so.
export function Step5Interaction({ onBack }: { onBack: () => void }) {
  return (
    <div className="mf-step5">
      <div className="mf-step5-card">
        <div className="mf-step5-title">{t('step5.interactiveTools')}</div>
        <p>{t('step5.chatWithReportAgent')} · {t('step5.chatWithAgent')}</p>
        <p className="mf-step5-note">Available when running live. This recording has no backend to answer.</p>
        <button className="mf-btn" onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}
