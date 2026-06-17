import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { fmtGHS, fmtN } from '../../utils/formatters.js'
import { CHANGE_TYPE_LABELS } from '../../utils/variationOrderTypes.js'
import { formatRevisionLabel } from '../../utils/docGenVariationTypes.js'

export function VariationPreviewDialog({
  open,
  onClose,
  onApprove,
  calculations,
  variationDraft,
  previewPayload,
}) {
  if (!open || !calculations) return null

  const items = variationDraft?.items || []
  const additions = items.filter(i => i.difference > 0 && i.includeInTotal !== false)
  const removals = items.filter(i => i.difference < 0 && i.includeInTotal !== false)
  const optional = items.filter(i => i.includeInTotal === false || i.changeType === 'optional' || i.changeType === 'provisional')
  const substituted = items.filter(i => i.changeType === 'substitution')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 640, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Preview Revised Document
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
          Review totals and changes before finalizing. The original document will not be overwritten.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            ['Original Total', calculations.originalEstimateTotal],
            ['Total Additions', calculations.totalAdditions, C.green],
            ['Total Omissions', calculations.totalOmissions, C.red, true],
            ['Total Reductions', calculations.totalReductions, C.red, true],
            ['Total Increases', calculations.totalIncreases, C.green],
            ['Net Variation', calculations.netVariation, calculations.netVariation >= 0 ? C.green : C.red],
            ['Revised Total', calculations.revisedTotal, C.amber],
          ].map(([label, val, color, negate]) => (
            <div key={label} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: color || C.text }}>
                {negate && val ? '− ' : ''}{fmtGHS(val)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
          {formatRevisionLabel(variationDraft?.revisionNumber || 1)}
          {variationDraft?.variationNumber ? ` · ${variationDraft.variationNumber}` : ''}
          {previewPayload?.meta?.originalQuoteRef ? ` · Original ref: ${previewPayload.meta.originalQuoteRef}` : ''}
        </div>

        {[
          ['Items Added / Increased', additions],
          ['Items Removed / Reduced', removals],
          ['Substitutions', substituted],
          ['Optional / Excluded from total', optional],
        ].map(([title, list]) => list.length > 0 && (
          <div key={title} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 6 }}>{title.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: C.textDim, maxHeight: 100, overflowY: 'auto' }}>
              {list.map(item => (
                <div key={item.id} style={{ padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.text }}>{item.description || '—'}</span>
                  {' '}
                  <span style={{ color: C.textFaint }}>({CHANGE_TYPE_LABELS[item.changeType] || item.changeType})</span>
                  {' — '}
                  <span style={{ fontFamily: 'IBM Plex Mono', color: item.difference >= 0 ? C.green : C.red }}>
                    {item.difference > 0 ? '+' : ''}{fmtN(item.difference)}
                  </span>
                  {item.includeInTotal === false && <span style={{ color: C.orange, marginLeft: 6 }}>excluded</span>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {variationDraft?.userNotes && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 6 }}>NOTES</div>
            <div style={{ fontSize: 12, color: C.textDim, whiteSpace: 'pre-wrap' }}>{variationDraft.userNotes}</div>
          </div>
        )}

        <div style={{
          background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.35)',
          borderRadius: 8, padding: '10px 12px', fontSize: 11, color: C.orange, marginBottom: 16,
        }}>
          By approving, you confirm included/excluded items and authorize applying this variation to produce a revised document.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={onClose}>Back to Edit</Button>
          <Button variant="primary" onClick={onApprove}>Approve &amp; Choose Export Style</Button>
        </div>
      </div>
    </div>
  )
}
