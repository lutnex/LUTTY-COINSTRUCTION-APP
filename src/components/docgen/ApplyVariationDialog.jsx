import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { fmtGHS } from '../../utils/formatters.js'

export function ApplyVariationDialog({
  open,
  onClose,
  variationOrders = [],
  activeSavedDocId,
  activeDocName,
  onStartManual,
  onSelectOrder,
  onCreateNewOrder,
  onImportFromChat,
}) {
  const [selectedVoId, setSelectedVoId] = useState('')

  if (!open) return null

  const linked = variationOrders.filter(vo =>
    !activeSavedDocId || vo.originalEstimateId === activeSavedDocId,
  )
  const other = variationOrders.filter(vo =>
    activeSavedDocId && vo.originalEstimateId && vo.originalEstimateId !== activeSavedDocId,
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 560, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Apply Variation
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16, lineHeight: 1.5 }}>
          Add variations to {activeDocName ? <strong>{activeDocName}</strong> : 'this document'}.
          The original issued estimate is preserved — revisions are saved separately.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 8, letterSpacing: '1px' }}>
            SELECT EXISTING VARIATION ORDER
          </div>
          {linked.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textFaint, padding: '6px 0' }}>
              No variation orders linked to this document yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto', marginBottom: 8 }}>
              {linked.map(vo => (
                <button
                  key={vo.id}
                  type="button"
                  onClick={() => setSelectedVoId(vo.id)}
                  style={{
                    textAlign: 'left', background: selectedVoId === vo.id ? C.amberGlow : C.panel2,
                    border: `1px solid ${selectedVoId === vo.id ? C.amberLo : C.border}`,
                    borderRadius: 6, padding: '8px 12px', cursor: 'pointer', color: C.text,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{vo.variationNumber} — {vo.projectName || 'Variation'}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                    {vo.items?.length || 0} items · Net {fmtGHS(vo.calculations?.netVariation ?? 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
          {other.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 6 }}>Other variation orders:</div>
              <select
                value={selectedVoId}
                onChange={e => setSelectedVoId(e.target.value)}
                style={{ width: '100%', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 12 }}
              >
                <option value="">— Select —</option>
                {other.map(vo => (
                  <option key={vo.id} value={vo.id}>
                    {vo.variationNumber} — {vo.projectName || vo.originalEstimateRef || vo.id}
                  </option>
                ))}
              </select>
            </>
          )}
          <div style={{ marginTop: 10 }}>
            <Button
              variant="primary"
              disabled={!selectedVoId}
              onClick={() => {
                const vo = variationOrders.find(v => v.id === selectedVoId)
                if (vo) onSelectOrder?.(vo)
              }}
            >
              Apply Selected Variation Order
            </Button>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 4, letterSpacing: '1px' }}>OTHER OPTIONS</div>
          <Button variant="outline" onClick={() => onStartManual?.()}>Add variation items manually</Button>
          <Button variant="outline" onClick={() => onCreateNewOrder?.()}>Create new Variation Order from this document</Button>
          <Button variant="sky" onClick={() => onImportFromChat?.()}>Import variation items from AI chat</Button>
        </div>

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
