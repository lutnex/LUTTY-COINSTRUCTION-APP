import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function WorkflowPanel({ extract, onImportBOQ, onSendToDocGen, onPDFExport, onSaveToProject, projState, dispatch, setTab }) {
  const toast = useToast()
  const [saving,  setSaving]  = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!extract) return null
  if (!extract.hasBOQ && !extract.hasEstimate && !extract.hasRisks) return null

  const activeProj = projState?.projects?.find(p => p.id === projState.activeId)

  const handleSaveProject = async () => {
    if (!projState?.activeId) {
      toast.warn('No active project', 'Select a project first', { label: 'View Projects', fn: () => setTab?.('projects') })
      return
    }
    setSaving(true)
    try {
      if (onSaveToProject) {
        await onSaveToProject(extract, projState.activeId)
      } else {
        if (extract.boqRows?.length > 0) dispatch?.({ type: 'MERGE_BOQ', id: projState.activeId, rows: extract.boqRows })
        if (extract.risks?.length > 0) dispatch?.({ type: 'MERGE_RISKS', id: projState.activeId, risks: extract.risks })
        if (extract.contractSum) dispatch?.({ type: 'UPDATE', id: projState.activeId, patch: { contractSum: extract.contractSum } })
      }
      await new Promise(r => setTimeout(r, 200))
      toast.success(`Saved to "${activeProj?.name}"`, `${extract.boqRows?.length || 0} BOQ rows · ${extract.risks?.length || 0} risks`)
    } catch (e) {
      toast.fail('Save failed', e?.message || 'Could not persist project data')
    }
    setSaving(false)
  }

  const handlePDF = async () => {
    setPdfBusy(true)
    await onPDFExport?.(extract)
    setPdfBusy(false)
  }

  const confColor = { high: C.green, medium: C.amber, low: C.red }[extract.confidence] || C.textDim

  return (
    <div style={{ marginTop: 10, background: 'linear-gradient(135deg,rgba(10,42,67,.94),rgba(30,40,56,.97))', border: `1px solid rgba(245,158,11,.3)`, borderRadius: 10, padding: '13px 15px', animation: 'fadeSlideIn .3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, boxShadow: `0 0 8px ${C.amber}` }} />
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.amber, letterSpacing: '2px', textTransform: 'uppercase', flex: 1 }}>AI Workflow Actions</span>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${confColor}20`, border: `1px solid ${confColor}40`, color: confColor }}>
          {extract.confidence} confidence
        </span>
      </div>

      {/* Stats */}
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
        {extract.hasRisks && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.amber, fontWeight: 500 }}>{extract.risks?.length || 0}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>risks detected</div>
          </div>
        )}
        {extract.projectTitle && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10.5, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extract.projectTitle.slice(0, 35)}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>project title</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {extract.hasBOQ && (
          <button onClick={() => { onImportBOQ?.(extract.boqRows); setTab?.('boq') }}
            style={wBtn('green')}>📋 Import to BOQ</button>
        )}
        {(extract.hasEstimate || extract.hasBOQ) && (
          <button onClick={() => { onSendToDocGen?.(extract); setTab?.('docgen') }}
            style={wBtn('amber')}>📄 Create Estimate</button>
        )}
        <button onClick={() => { onSendToDocGen?.(extract); setTab?.('docgen') }}
          style={wBtn('sky')}>🖨️ Send to DocGen</button>
        <button onClick={() => void handleSaveProject()} disabled={saving}
          style={{ ...wBtn('purple'), opacity: saving ? .7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? <>
            <div style={{ width: 10, height: 10, border: '2px solid rgba(167,139,250,.2)', borderTop: `2px solid ${C.purple}`, borderRadius: '50%', animation: 'rot .6s linear infinite' }} /> Saving…
          </> : '💾 Save to Project'}
        </button>
        <button onClick={() => void handlePDF()} disabled={pdfBusy}
          style={{ ...wBtn('outline'), opacity: pdfBusy ? .7 : 1, cursor: pdfBusy ? 'not-allowed' : 'pointer' }}>
          {pdfBusy ? <>
            <div style={{ width: 10, height: 10, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.textDim}`, borderRadius: '50%', animation: 'rot .6s linear infinite' }} /> Exporting…
          </> : '⬇ Export PDF'}
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

// C is used inline — import from constants at top
const C_local = {
  amber: '#F59E0B', green: '#34D399', sky: '#38BDF8', purple: '#A78BFA',
  red: '#F87171', text: '#DDE5F0', textFaint: '#334155', border: '#253040', textDim: '#6E84A3',
}
