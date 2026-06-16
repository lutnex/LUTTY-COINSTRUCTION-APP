import { C } from '../../utils/constants.js'
import { VO_EXPORT_TYPES, VO_EXPORT_LABELS } from '../../utils/variationOrderTypes.js'
import { Button } from '../shared/Button.jsx'

export function VariationExportDialog({ open, onClose, onExport, exporting }) {
  if (!open) return null

  const options = [
    { type: VO_EXPORT_TYPES.CLIENT_QUOTATION, label: 'A', desc: VO_EXPORT_LABELS[VO_EXPORT_TYPES.CLIENT_QUOTATION] },
    { type: VO_EXPORT_TYPES.INTERNAL_SCHEDULE, label: 'B', desc: VO_EXPORT_LABELS[VO_EXPORT_TYPES.INTERNAL_SCHEDULE] },
    { type: VO_EXPORT_TYPES.REVISED_ESTIMATE, label: 'C', desc: VO_EXPORT_LABELS[VO_EXPORT_TYPES.REVISED_ESTIMATE] },
    { type: VO_EXPORT_TYPES.ADDENDUM, label: 'D', desc: VO_EXPORT_LABELS[VO_EXPORT_TYPES.ADDENDUM] },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 480, maxWidth: '92vw',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Export Variation
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
          Choose variation document type before export:
        </div>

        {options.map(opt => (
          <button
            key={opt.type}
            disabled={exporting}
            onClick={() => onExport(opt.type)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '12px 14px', marginBottom: 8, cursor: exporting ? 'not-allowed' : 'pointer',
              color: C.text, transition: 'border-color .15s',
            }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.borderColor = C.amber }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}
          >
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: C.amber, marginRight: 8 }}>{opt.label}.</span>
            <span style={{ fontSize: 13 }}>{opt.desc}</span>
          </button>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Button variant="ghost" onClick={onClose} disabled={exporting}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
