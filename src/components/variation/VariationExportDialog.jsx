import { C } from '../../utils/constants.js'
import {
  VO_FILE_FORMATS,
  VO_FILE_FORMAT_LABELS,
  VO_EXPORT_TYPES,
  VO_EXPORT_LABELS,
} from '../../utils/variationOrderTypes.js'
import { Button } from '../shared/Button.jsx'

export function VariationExportDialog({
  open,
  onClose,
  onExportFormat,
  onExportLegacy,
  exporting,
  showLegacyTypes = false,
}) {
  if (!open) return null

  const formatOptions = [
    { format: VO_FILE_FORMATS.PDF, label: 'A' },
    { format: VO_FILE_FORMATS.DOCX, label: 'B' },
    { format: VO_FILE_FORMATS.CSV, label: 'C' },
    { format: VO_FILE_FORMATS.HTML, label: 'D' },
  ]

  const legacyOptions = [
    { type: VO_EXPORT_TYPES.CLIENT_QUOTATION, label: 'A' },
    { type: VO_EXPORT_TYPES.INTERNAL_SCHEDULE, label: 'B' },
    { type: VO_EXPORT_TYPES.REVISED_ESTIMATE, label: 'C' },
    { type: VO_EXPORT_TYPES.ADDENDUM, label: 'D' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Export As
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
          Choose file format for this variation order:
        </div>

        {formatOptions.map(opt => (
          <button
            key={opt.format}
            disabled={exporting}
            onClick={() => onExportFormat?.(opt.format)}
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
            <span style={{ fontSize: 13 }}>{VO_FILE_FORMAT_LABELS[opt.format]}</span>
          </button>
        ))}

        {showLegacyTypes && onExportLegacy && (
          <>
            <div style={{ fontSize: 11, color: C.textFaint, margin: '14px 0 10px', fontFamily: 'IBM Plex Mono' }}>
              LEGACY DOCUMENT STYLES
            </div>
            {legacyOptions.map(opt => (
              <button
                key={opt.type}
                disabled={exporting}
                onClick={() => onExportLegacy(opt.type)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '10px 14px', marginBottom: 8, cursor: exporting ? 'not-allowed' : 'pointer',
                  color: C.textDim, fontSize: 12,
                }}
              >
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.textFaint, marginRight: 8 }}>{opt.label}.</span>
                {VO_EXPORT_LABELS[opt.type]}
              </button>
            ))}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Button variant="ghost" onClick={onClose} disabled={exporting}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
