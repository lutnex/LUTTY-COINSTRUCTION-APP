import { C } from '../../utils/constants.js'
import { VO_SOURCE_TYPES } from '../../utils/variationOrderTypes.js'
import { Button } from '../shared/Button.jsx'

export function VariationStartDialog({ open, onClose, onStart, savedDocuments = [], projects = [] }) {
  if (!open) return null

  const estimates = savedDocuments.filter(d =>
    ['estimate', 'quotation', 'boq'].includes(d.category),
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 520, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          New Variation Order
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 18 }}>
          Start from an existing estimate, uploaded document, or blank variation. The original estimate is never overwritten.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 8, letterSpacing: '1px' }}>A. FROM SAVED ESTIMATE / BOQ</div>
          {estimates.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textFaint, padding: '8px 0' }}>No saved estimates found — save one from Document Generator first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
              {estimates.slice(0, 12).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => onStart(VO_SOURCE_TYPES.ESTIMATE, { document: doc })}
                  style={{
                    textAlign: 'left', background: C.panel2, border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: '8px 12px', cursor: 'pointer', color: C.text,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{doc.name}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                    {doc.projectName || doc.snapshot?.meta?.projectTitle || '—'} · {doc.category}
                  </div>
                </button>
              ))}
            </div>
          )}
          {projects.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Or from active project BOQ:</div>
              {projects.slice(0, 5).map(p => (
                <button
                  key={p.id}
                  onClick={() => onStart(VO_SOURCE_TYPES.ESTIMATE, { project: p })}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'transparent', border: `1px dashed ${C.border}`,
                    borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                    color: C.textDim, fontSize: 12, marginBottom: 4,
                  }}
                >
                  📁 {p.name} ({p.boqRows?.length || 0} items)
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 8, letterSpacing: '1px' }}>B. FROM UPLOADED ESTIMATE</div>
          <Button variant="sky" onClick={() => onStart(VO_SOURCE_TYPES.UPLOAD)}>
            Upload Estimate PDF / Document
          </Button>
          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 6 }}>Upload an old estimate, then use AI to identify changes.</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 8, letterSpacing: '1px' }}>C. MANUAL BLANK VARIATION</div>
          <Button onClick={() => onStart(VO_SOURCE_TYPES.MANUAL)}>
            Start Blank Variation
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
