import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { fmtN } from '../../utils/formatters.js'
import { buildAuditPanelData } from '../../utils/projectEstimate.js'
import ConfirmDialog from './ConfirmDialog.jsx'

const SOURCE_LABELS = {
  'ai-chat': 'AI Chat',
  'boq-builder': 'BOQ Builder',
  'doc-generator': 'Document Generator',
  'variation-order': 'Variation Order',
  'user-override': 'User Override',
  project: 'Project',
}

export default function EstimateAuditPanel({ projectEstimate, compact = false, onUnlock }) {
  const [unlockConfirm, setUnlockConfirm] = useState(false)
  const audit = buildAuditPanelData(projectEstimate)
  if (!audit) return null

  const rows = [
    ['Materials Total', audit.materialsTotal],
    ['Labour Total', audit.labourTotal],
    ['Transport Total', audit.transportTotal],
    ['Preliminaries', audit.preliminariesTotal],
    audit.contingency > 0 && ['Contingency', audit.contingency],
    audit.overheads > 0 && ['Overheads', audit.overheads],
    audit.profit > 0 && ['Profit', audit.profit],
    audit.vat > 0 && ['VAT', audit.vat],
    audit.discount > 0 && ['Discount', -audit.discount],
    ['Final Total', audit.finalTotal, true],
  ].filter(Boolean)

  return (
    <div style={{
      background: compact ? C.carbon : C.panel,
      border: `1px solid ${audit.locked ? C.amberLo : C.border}`,
      borderRadius: 10,
      padding: compact ? 12 : 16,
      marginTop: compact ? 0 : 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.amber }}>
          Cost Audit Panel
        </div>
        {audit.locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, color: C.amber, background: C.amberGlow,
              padding: '3px 8px', borderRadius: 12, fontFamily: "'IBM Plex Mono'",
            }}>
              LOCKED
            </span>
            {onUnlock && (
              <button
                type="button"
                onClick={() => setUnlockConfirm(true)}
                style={{
                  fontSize: 10, color: C.textDim, background: 'transparent',
                  border: `1px solid ${C.border}`, borderRadius: 12, padding: '3px 10px',
                  cursor: 'pointer', fontFamily: 'DM Sans',
                }}
              >
                Unlock
              </button>
            )}
          </div>
        )}
      </div>

      {rows.map(([label, amount, bold]) => (
        <div
          key={label}
          style={{
            display: 'flex', justifyContent: 'space-between', padding: '5px 0',
            borderTop: bold ? `1px solid ${C.border}` : 'none',
            marginTop: bold ? 6 : 0,
            paddingTop: bold ? 10 : 5,
          }}
        >
          <span style={{ fontSize: 12, color: bold ? C.gold : C.textDim, fontWeight: bold ? 600 : 400 }}>{label}</span>
          <span style={{
            fontFamily: "'IBM Plex Mono'", fontSize: bold ? 14 : 12,
            color: bold ? C.gold : C.text, fontWeight: bold ? 700 : 400,
          }}>
            GHS {fmtN(amount)}
          </span>
        </div>
      ))}

      {audit.traceability?.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Cost Traceability
          </div>
          {audit.traceability.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0' }}>
              <span style={{ color: C.textDim }}>
                {row.category}
                <span style={{ color: C.textFaint, marginLeft: 6 }}>
                  ({SOURCE_LABELS[row.source] || row.source})
                </span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono'", color: row.isCommercial ? C.sky : C.textDim }}>
                GHS {fmtN(row.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={unlockConfirm}
        title="Unlock Estimate"
        message="Unlock this estimate for editing? Line items and adjustments stay in place, but totals will recalculate as you edit. PDF export stays blocked until you approve again."
        confirmLabel="Unlock Estimate"
        onConfirm={() => { setUnlockConfirm(false); onUnlock?.() }}
        onCancel={() => setUnlockConfirm(false)}
      />
    </div>
  )
}
