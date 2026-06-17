import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import {
  REVISED_EXPORT_STYLES,
  REVISED_EXPORT_LABELS,
  REVISED_EXPORT_DESCRIPTIONS,
} from '../../utils/docGenVariationTypes.js'

const STYLE_ORDER = [
  REVISED_EXPORT_STYLES.PREMIUM,
  REVISED_EXPORT_STYLES.DETAILED,
  REVISED_EXPORT_STYLES.ADDENDUM,
  REVISED_EXPORT_STYLES.FULL,
]

export function VariationExportStyleDialog({ open, onClose, onConfirm, defaultStyle }) {
  const [style, setStyle] = useState(defaultStyle || REVISED_EXPORT_STYLES.FULL)

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 520, maxWidth: '94vw',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Choose Final Document Style
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
          Select how the revised document should be presented for export and saving.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {STYLE_ORDER.map(key => (
            <label
              key={key}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                background: style === key ? C.amberGlow : C.panel2,
                border: `1px solid ${style === key ? C.amberLo : C.border}`,
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="exportStyle"
                checked={style === key}
                onChange={() => setStyle(key)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{REVISED_EXPORT_LABELS[key]}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 3, lineHeight: 1.4 }}>
                  {REVISED_EXPORT_DESCRIPTIONS[key]}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant="primary" onClick={() => onConfirm?.(style)}>Apply Style &amp; Finalize</Button>
        </div>
      </div>
    </div>
  )
}
