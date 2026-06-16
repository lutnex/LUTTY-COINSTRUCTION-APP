import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PRESENTATION_STYLES } from '../../utils/qsWorkflow.js'

export default function WorkflowPanel({
  extract,
  onImportBOQ,
  onSendToDocGen,
  onOpenQSWorkflow,
  onOpenSaveProject,
  onExtractPrices,
  onSavePricesToProfile,
  onChoosePricingSource,
  onPDFExport,
  onImportVariation,
  projState,
  dispatch,
  setTab,
}) {
  const toast = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!extract) return null
  if (!extract.hasBOQ && !extract.hasEstimate && !extract.hasRisks && !extract.hasVariation) return null

  const openWorkflow = (opts = {}) => {
    if (onOpenQSWorkflow) onOpenQSWorkflow(extract, opts)
    else onSendToDocGen?.(extract)
  }

  const handlePDF = async () => {
    setPdfBusy(true)
    await onPDFExport?.(extract)
    setPdfBusy(false)
  }

  const confColor = { high: C.green, medium: C.amber, low: C.red }[extract.confidence] || C.textDim

  return (
    <div style={{ marginTop: 10, background: 'linear-gradient(135deg,rgba(10,42,67,.94),rgba(30,40,56,.97))', border: `1px solid rgba(245,158,11,.3)`, borderRadius: 10, padding: '13px 15px', animation: 'fadeSlideIn .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, boxShadow: `0 0 8px ${C.amber}` }} />
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.amber, letterSpacing: '2px', textTransform: 'uppercase', flex: 1 }}>AI Workflow Actions</span>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${confColor}20`, border: `1px solid ${confColor}40`, color: confColor }}>
          {extract.confidence} confidence
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 11, flexWrap: 'wrap' }}>
        {extract.hasBOQ && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.amber, fontWeight: 500 }}>{extract.boqRows?.length || 0}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>BOQ lines</div>
          </div>
        )}
        {extract.contractSum && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.amber, fontWeight: 500 }}>GHS {(extract.contractSum / 1000).toFixed(0)}k</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>contract sum</div>
          </div>
        )}
      </div>

      {extract.requiresApproval && (
        <div style={{ fontSize: 11, color: C.amber, marginBottom: 8 }}>
          QS workflow: confirm measurements and supply prices before final export.
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {extract.hasBOQ && (
          <button onClick={() => { onImportBOQ?.(extract.boqRows); setTab?.('boq') }} style={wBtn('green')}>📋 Import to BOQ</button>
        )}
        <button onClick={() => openWorkflow({ initialStep: 0 })} style={wBtn('amber')}>📄 Review</button>
        <button onClick={() => onExtractPrices?.(extract)} style={wBtn('green')}>💰 Extract Prices from Chat</button>
        <button onClick={() => onSavePricesToProfile?.(extract)} style={wBtn('green')}>💾 Save Prices to Profile</button>
        <button onClick={() => onChoosePricingSource?.(extract)} style={wBtn('outline')}>Choose Pricing Source</button>
        <button onClick={() => openWorkflow({ initialStep: 1 })} style={wBtn('outline')}>Compare Profile vs Market</button>
        <button onClick={() => openWorkflow({ initialStep: 3, initialStyle: PRESENTATION_STYLES.PREMIUM })} style={wBtn('sky')}>A. Premium Quotation</button>
        <button onClick={() => openWorkflow({ initialStep: 3, initialStyle: PRESENTATION_STYLES.DETAILED })} style={wBtn('outline')}>B. Detailed BOQ</button>
        <button onClick={() => openWorkflow({ initialStep: 4 })} style={wBtn('amber')}>→ Export to Document Generator</button>
        {extract.hasVariation && extract.variationItems?.length > 0 && (
          <button onClick={() => { onImportVariation?.(extract.variationItems); setTab?.('variation') }} style={wBtn('sky')}>
            📝 Import to Variation Order ({extract.variationItems.length})
          </button>
        )}
        <button onClick={() => onOpenSaveProject?.(extract)} style={wBtn('purple')}>💾 Save Project</button>
        <button onClick={() => void handlePDF()} disabled={pdfBusy} style={{ ...wBtn('outline'), opacity: pdfBusy ? .7 : 1 }}>
          {pdfBusy ? 'Exporting…' : '⬇ Export PDF'}
        </button>
      </div>
    </div>
  )
}

function wBtn(color) {
  const base = { padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: 'none' }
  const map = {
    amber:   { ...base, background: C.amber,  color: '#070A0D' },
    green:   { ...base, background: 'rgba(52,211,153,.12)',  border: '1px solid rgba(52,211,153,.32)',  color: '#34D399' },
    sky:     { ...base, background: 'rgba(56,189,248,.1)',   border: '1px solid rgba(56,189,248,.32)',  color: '#38BDF8' },
    purple:  { ...base, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.32)', color: '#A78BFA' },
    outline: { ...base, background: 'transparent',           border: `1px solid ${C.border}`,           color: C.textDim },
  }
  return map[color] || base
}
