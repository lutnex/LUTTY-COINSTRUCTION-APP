import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PRESENTATION_STYLES } from '../../utils/qsWorkflow.js'
import {
  WORKFLOW_ACTIONS,
  logWorkflowAction,
  validateWorkflowAction,
  presentationStyleLabel,
} from '../../utils/workflowActions.js'
import { logWorkflowMissing } from '../../utils/sessionDebug.js'

export default function WorkflowPanel({
  extract,
  onAction,
  workflowState = {},
  setTab,
  extractedPricesCount = 0,
  livePricesCount = 0,
}) {
  const toast = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [busyAction, setBusyAction] = useState(null)

  if (!extract) return null
  if (!extract.hasBOQ && !extract.hasEstimate && !extract.hasRisks && !extract.hasVariation) return null

  const actionContext = { workflowState, extractedPricesCount, livePricesCount }
  const selectedStyle = workflowState.presentationStyle || extract.presentationStyle
  const styleLabel = presentationStyleLabel(selectedStyle)
  const pricingLabel = workflowState.pricingSourceLabel || workflowState.pricingConfig?.profileName

  const checkAction = (actionId) => validateWorkflowAction(actionId, extract, actionContext)

  const finish = (actionId, result) => {
    logWorkflowAction(actionId, { result: result ?? 'ok' })
    if (result?.toast) toast[result.toast.kind]?.(result.toast.title, result.toast.body)
    if (result?.navigate) setTab?.(result.navigate)
  }

  const run = (actionId, opts = {}) => {
    if (busyAction) return
    const validation = checkAction(actionId)
    if (!validation.ok) {
      logWorkflowMissing(actionId, validation.reason)
      toast.warn('Action unavailable', validation.reason)
      return
    }
    if (!onAction) {
      toast.warn('Action unavailable', 'Workflow handler is not connected — refresh the page')
      logWorkflowAction(actionId, { error: 'no-handler' })
      return
    }
    logWorkflowAction(actionId, { phase: 'click', hasExtract: Boolean(extract), opts })
    setBusyAction(actionId)
    let asyncAction = false
    try {
      const result = onAction(actionId, extract, opts)
      if (result && typeof result.then === 'function') {
        asyncAction = true
        result
          .then(r => finish(actionId, r))
          .catch(err => {
            console.error(`[WorkflowAction] ${actionId} failed:`, err)
            toast.error('Action failed', err?.message || 'Something went wrong — chat state preserved')
          })
          .finally(() => setBusyAction(null))
        return
      }
      finish(actionId, result)
    } catch (err) {
      console.error(`[WorkflowAction] ${actionId} failed:`, err)
      toast.error('Action failed', err?.message || 'Something went wrong — chat state preserved')
    } finally {
      if (!asyncAction) setBusyAction(null)
    }
  }

  const handlePDF = () => {
    if (pdfBusy || busyAction) return
    const validation = checkAction(WORKFLOW_ACTIONS.EXPORT_PDF)
    if (!validation.ok) {
      logWorkflowMissing(WORKFLOW_ACTIONS.EXPORT_PDF, validation.reason)
      toast.warn('Action unavailable', validation.reason)
      return
    }
    if (!onAction) {
      toast.warn('Action unavailable', 'Workflow handler is not connected')
      return
    }
    setPdfBusy(true)
    logWorkflowAction(WORKFLOW_ACTIONS.EXPORT_PDF, { phase: 'click' })
    const result = onAction(WORKFLOW_ACTIONS.EXPORT_PDF, extract)
    const done = () => setPdfBusy(false)
    if (result && typeof result.then === 'function') {
      result.then(r => finish(WORKFLOW_ACTIONS.EXPORT_PDF, r)).catch(err => {
        console.error('[WorkflowAction] export-pdf failed:', err)
        toast.error('PDF export failed', err?.message || 'Try again or use Document Generator')
      }).finally(done)
    } else {
      finish(WORKFLOW_ACTIONS.EXPORT_PDF, result)
      done()
    }
  }

  const confColor = { high: C.green, medium: C.amber, low: C.red }[extract.confidence] || C.textDim
  const variationCount = extract.variationItems?.length || 0

  const btn = (actionId, props) => {
    const validation = checkAction(actionId)
    return (
      <ActionBtn
        {...props}
        busy={busyAction === actionId}
        disabled={!validation.ok || Boolean(busyAction)}
        title={!validation.ok ? validation.reason : undefined}
        onClick={() => run(actionId)}
      />
    )
  }

  return (
    <div style={{ marginTop: 10, background: 'linear-gradient(135deg,rgba(10,42,67,.94),rgba(30,40,56,.97))', border: `1px solid rgba(245,158,11,.3)`, borderRadius: 10, padding: '13px 15px', animation: 'fadeSlideIn .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, boxShadow: `0 0 8px ${C.amber}` }} />
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.amber, letterSpacing: '2px', textTransform: 'uppercase', flex: 1 }}>AI Workflow Actions</span>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${confColor}20`, border: `1px solid ${confColor}40`, color: confColor }}>
          {extract.confidence} confidence
        </span>
      </div>

      {(styleLabel || pricingLabel) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {styleLabel && (
            <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: C.sky, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, padding: '3px 8px' }}>
              Style: {styleLabel}
            </span>
          )}
          {pricingLabel && (
            <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: C.green, background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 6, padding: '3px 8px' }}>
              Pricing: {pricingLabel}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 11, flexWrap: 'wrap' }}>
        {extract.boqRows?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.amber, fontWeight: 500 }}>{extract.boqRows.length}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>BOQ lines</div>
          </div>
        )}
        {extract.contractSum > 0 && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.amber, fontWeight: 500 }}>GHS {(extract.contractSum / 1000).toFixed(0)}k</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>contract sum</div>
          </div>
        )}
        {variationCount > 0 && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color: C.sky, fontWeight: 500 }}>{variationCount}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 1 }}>variation lines</div>
          </div>
        )}
      </div>

      {extract.requiresApproval && (
        <div style={{ fontSize: 11, color: C.amber, marginBottom: 8 }}>
          QS workflow: confirm measurements and supply prices before final export.
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {btn(WORKFLOW_ACTIONS.IMPORT_BOQ, { label: '📋 Import to BOQ', color: 'green' })}
        {btn(WORKFLOW_ACTIONS.REVIEW, { label: '📄 Review', color: 'amber' })}
        {btn(WORKFLOW_ACTIONS.EXTRACT_PRICES, { label: '💰 Extract Prices from Chat', color: 'green' })}
        {btn(WORKFLOW_ACTIONS.SAVE_PRICES_PROFILE, { label: '💾 Save Prices to Profile', color: 'green' })}
        {btn(WORKFLOW_ACTIONS.CHOOSE_PRICING_SOURCE, { label: 'Choose Pricing Source', color: 'outline' })}
        {btn(WORKFLOW_ACTIONS.COMPARE_PROFILE_MARKET, { label: 'Compare Profile vs Market', color: 'outline' })}
        <ActionBtn
          label="A. Premium Quotation"
          color="sky"
          active={selectedStyle === PRESENTATION_STYLES.PREMIUM}
          busy={busyAction === WORKFLOW_ACTIONS.PREMIUM_QUOTATION}
          disabled={!checkAction(WORKFLOW_ACTIONS.PREMIUM_QUOTATION).ok || Boolean(busyAction)}
          title={checkAction(WORKFLOW_ACTIONS.PREMIUM_QUOTATION).reason}
          onClick={() => run(WORKFLOW_ACTIONS.PREMIUM_QUOTATION)}
        />
        <ActionBtn
          label="B. Detailed BOQ"
          color="outline"
          active={selectedStyle === PRESENTATION_STYLES.DETAILED}
          busy={busyAction === WORKFLOW_ACTIONS.DETAILED_BOQ}
          disabled={!checkAction(WORKFLOW_ACTIONS.DETAILED_BOQ).ok || Boolean(busyAction)}
          title={checkAction(WORKFLOW_ACTIONS.DETAILED_BOQ).reason}
          onClick={() => run(WORKFLOW_ACTIONS.DETAILED_BOQ)}
        />
        {btn(WORKFLOW_ACTIONS.EXPORT_DOCGEN, { label: '→ Export to Document Generator', color: 'amber' })}
        {btn(WORKFLOW_ACTIONS.IMPORT_VARIATION, {
          label: variationCount ? `📝 Import to Variation Order (${variationCount})` : '📝 Import to Variation Order',
          color: 'sky',
        })}
        {btn(WORKFLOW_ACTIONS.SAVE_PROJECT, { label: '💾 Save Project', color: 'purple' })}
        <ActionBtn
          label={pdfBusy ? 'Exporting…' : '⬇ Export PDF'}
          color="outline"
          disabled={pdfBusy || Boolean(busyAction) || !checkAction(WORKFLOW_ACTIONS.EXPORT_PDF).ok}
          title={checkAction(WORKFLOW_ACTIONS.EXPORT_PDF).reason}
          onClick={handlePDF}
        />
      </div>
    </div>
  )
}

function ActionBtn({ label, color, onClick, busy, disabled, active, title }) {
  const base = wBtn(color, active)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      style={{ ...base, opacity: disabled || busy ? 0.55 : 1, cursor: disabled || busy ? 'not-allowed' : 'pointer' }}
    >
      {busy ? '⏳ ' : ''}{label}
    </button>
  )
}

function wBtn(color, active) {
  const base = { padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: 'none' }
  const map = {
    amber:   { ...base, background: C.amber,  color: '#070A0D' },
    green:   { ...base, background: 'rgba(52,211,153,.12)',  border: '1px solid rgba(52,211,153,.32)',  color: '#34D399' },
    sky:     { ...base, background: 'rgba(56,189,248,.1)',   border: '1px solid rgba(56,189,248,.32)',  color: '#38BDF8' },
    purple:  { ...base, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.32)', color: '#A78BFA' },
    outline: { ...base, background: 'transparent',           border: `1px solid ${C.border}`,           color: C.textDim },
  }
  const style = map[color] || base
  if (active) {
    return { ...style, boxShadow: `0 0 0 2px ${C.amber}`, borderColor: C.amber }
  }
  return style
}
