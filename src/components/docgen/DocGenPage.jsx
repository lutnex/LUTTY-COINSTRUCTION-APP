import { useRef, useState } from 'react'
import { C, DOC_TYPES } from '../../utils/constants.js'
import { fmtN } from '../../utils/formatters.js'
import FinancialAdjustmentsPanel from '../shared/FinancialAdjustmentsPanel.jsx'
import EstimateAuditPanel from '../shared/EstimateAuditPanel.jsx'
import PaymentTermsEditor from './PaymentTermsEditor.jsx'
import MaterialsPanel from './MaterialsPanel.jsx'
import ConfirmDialog from '../shared/ConfirmDialog.jsx'
import SaveDocumentDialog from './SaveDocumentDialog.jsx'
import DocumentSectionBlock from './DocumentSectionBlock.jsx'
import SectionManager from './SectionManager.jsx'
import { createSection } from '../../utils/documentSections.js'
import { ApplyVariationDialog } from './ApplyVariationDialog.jsx'
import { DocGenVariationPanel } from './DocGenVariationPanel.jsx'
import { VariationPreviewDialog } from './VariationPreviewDialog.jsx'
import { VariationExportStyleDialog } from './VariationExportStyleDialog.jsx'
import { formatRevisionLabel, nextRevisionNumber } from '../../utils/docGenVariationTypes.js'
import { nextRevisionForDocument } from '../../utils/savedDocuments.js'

export default function DocGenPage({
  docGen, onDownload, onPrint, onPreview, onSaveDocument, onClearForm, onStartNewDocument,
  onUnlockEstimate,
  onApproveEstimate,
  onAIFill, pdfStatus, activeProjName, companyLogo, aiBusy, toast,
  variationOrders = [],
  onApplyVariationFromOrder,
  onCreateVariationFromDocument,
  onImportVariationFromChat,
  onSaveRevisedDocument,
  onDownloadRevisedPdf,
  onSaveVariationSeparately,
  onFinalizeVariation,
}) {
  const [clearConfirm, setClearConfirm] = useState(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveRevisionOpen, setSaveRevisionOpen] = useState(false)
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false)
  const [applyVariationOpen, setApplyVariationOpen] = useState(false)
  const [previewVariationOpen, setPreviewVariationOpen] = useState(false)
  const [exportStyleOpen, setExportStyleOpen] = useState(false)
  const [discardVariationConfirm, setDiscardVariationConfirm] = useState(false)
  const {
    docType, setDocType, meta, setMeta,
    paymentTerms, setPaymentTerms,
    documentSections, setDocumentSections, updateSection, acceptSectionSuggestion, removeSection,
    mats, matCategories, updateMat, addMat, addMatCategory, removeMat,
    renameMatCategory, deleteMatCategory, reorderMatCategories, moveMat,
    boqRows, updateBoqRow,
    labor, updateLabor, addLabor, removeLabor,
    prelims, updatePrelim, addPrelim, removePrelim,
    preview, setPreview, busy, totals, pricing,
    transferSource, hasBOQData,
    financialAdjustments, setFinancialAdjustments,
    projectEstimate,
    lastAutoSaved, activeSavedDocId,
    variationDraft, variationCalculations, hasVariationDraft,
    startVariationDraft, addVariationItem, updateVariationItem, removeVariationItem,
    undoVariationDraft, canUndoVariation, updateVariationDraftMeta,
    buildVariationPreviewPayload, clearVariationWorkflow,
  } = docGen

  const adjustmentLines = pricing?.adjustmentResult?.enabledLines || []
  const visibleSections = documentSections.filter(s => s.status !== 'deleted')

  const renderSectionBlock = (section, children, showEditor = true) => (
    <DocumentSectionBlock
      key={section.id}
      section={section}
      onUpdate={patch => updateSection(section.id, patch)}
      onAccept={() => acceptSectionSuggestion(section.id)}
      onDelete={() => removeSection(section.id)}
      showEditor={showEditor}
    >
      {children}
    </DocumentSectionBlock>
  )

  const RICHTEXT_TYPES = new Set(['project_scope', 'takeoff', 'assumptions', 'exclusions', 'notes', 'custom'])

  const renderSectionBody = (section) => {
    switch (section.type) {
      case 'client_info':
        return (
          <>
            {['clientName', 'clientContact', 'clientEmail', 'projectLocation', 'projectTitle'].map(k => (
              <Field key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}>
                <input value={meta[k] || ''} onChange={e => setMeta(k, e.target.value)} style={inputStyle} />
              </Field>
            ))}
            <Field label="Valid Days"><input value={meta.validDays} onChange={e => setMeta('validDays', e.target.value)} style={inputStyle} /></Field>
          </>
        )
      case 'payment_terms':
        return (
          <>
            <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 12, lineHeight: 1.5 }}>
              Edit payment terms for this estimate. Wording here is exported exactly as written.
            </div>
            <PaymentTermsEditor
              terms={paymentTerms}
              onChange={setPaymentTerms}
              onSavedDefault={() => toast?.success?.('Default saved', 'Your payment terms will load on new estimates')}
              onReset={() => toast?.info?.('Template restored', 'Sample payment terms loaded — edit or remove as needed')}
            />
          </>
        )
      case 'boq':
        if (!showBOQ || !boqRows.length) return null
        return (
          <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['Section', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'].map(h => (
                    <th key={h} style={{ background: C.slate, color: C.amber, padding: '5px 7px', textAlign: 'left', border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono'", fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boqRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px', color: C.textDim, fontSize: 10 }}>{r.section}</td>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px' }}>
                      <input value={r.desc} onChange={e => updateBoqRow(r.id, 'desc', e.target.value)} style={{ ...inputStyle, fontSize: 11 }} />
                    </td>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px' }}>
                      <input value={r.unit} onChange={e => updateBoqRow(r.id, 'unit', e.target.value)} style={{ ...inputStyle, width: 50, fontSize: 11 }} />
                    </td>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px' }}>
                      <input value={r.qty} onChange={e => updateBoqRow(r.id, 'qty', e.target.value)} style={{ ...inputStyle, width: 50, textAlign: 'right', fontSize: 11 }} />
                    </td>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px' }}>
                      <input value={r.clientSupplied ? '0' : r.rate} disabled={r.clientSupplied} onChange={e => updateBoqRow(r.id, 'rate', e.target.value)} style={{ ...inputStyle, width: 60, textAlign: 'right', fontSize: 11 }} />
                    </td>
                    <td style={{ border: `1px solid ${C.border}`, padding: '3px 5px', fontFamily: "'IBM Plex Mono'", fontSize: 11, color: r.clientSupplied ? C.sky : C.amber, textAlign: 'right' }}>
                      {r.amount ? fmtN(parseFloat(r.amount)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'materials':
        return (
          <MaterialsPanel
            categories={matCategories}
            materials={mats}
            onAddMaterial={addMat}
            onAddCategory={addMatCategory}
            onUpdateMaterial={updateMat}
            onRemoveMaterial={removeMat}
            onRenameCategory={renameMatCategory}
            onDeleteCategory={deleteMatCategory}
            onReorderCategories={reorderMatCategories}
            onMoveMaterial={moveMat}
          />
        )
      case 'labor':
        return (
          <>
            {labor.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
                <input value={r.trade} onChange={e => updateLabor(r.id, 'trade', e.target.value)} placeholder="Trade" style={{ ...inputStyle, width: 100 }} />
                <input value={r.qty} onChange={e => updateLabor(r.id, 'qty', e.target.value)} placeholder="Days" style={{ ...inputStyle, width: 55, textAlign: 'right' }} />
                <input value={r.rate} onChange={e => updateLabor(r.id, 'rate', e.target.value)} placeholder="Rate" style={{ ...inputStyle, width: 80, textAlign: 'right' }} />
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.amber, width: 75, textAlign: 'right', flexShrink: 0 }}>{r.amount ? `GHS ${fmtN(parseFloat(r.amount))}` : '—'}</span>
                <button onClick={() => removeLabor(r.id)} style={delBtn}>✕</button>
              </div>
            ))}
            <button onClick={addLabor} style={addBtnStyle}>+ Add Labour</button>
          </>
        )
      case 'prelims':
        return (
          <>
            {prelims.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
                <input value={r.item} onChange={e => updatePrelim(r.id, 'item', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input value={r.amount} onChange={e => updatePrelim(r.id, 'amount', e.target.value)} placeholder="0.00" style={{ ...inputStyle, width: 90, textAlign: 'right', fontFamily: "'IBM Plex Mono'" }} />
                <button onClick={() => removePrelim(r.id)} style={delBtn}>✕</button>
              </div>
            ))}
            <button onClick={addPrelim} style={addBtnStyle}>+ Add Prelim</button>
          </>
        )
      case 'commercial':
        return (
          <>
            <Card title="📊 DIRECT COSTS" compact>
              {boqRows.length > 0 && (
                <div style={costRow}>
                  <span style={{ color: C.textDim }}>BOQ Works</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", color: C.text }}>GHS {fmtN(totals.boq)}</span>
                </div>
              )}
              {totals.mat > 0 && (
                <div style={costRow}>
                  <span style={{ color: C.textDim }}>Materials</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", color: C.text }}>GHS {fmtN(totals.mat)}</span>
                </div>
              )}
              {totals.labour > 0 && (
                <div style={costRow}>
                  <span style={{ color: C.textDim }}>Labour</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", color: C.text }}>GHS {fmtN(totals.labour)}</span>
                </div>
              )}
              {totals.prelims > 0 && (
                <div style={costRow}>
                  <span style={{ color: C.textDim }}>Preliminaries</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", color: C.text }}>GHS {fmtN(totals.prelims)}</span>
                </div>
              )}
              <div style={{ ...costRow, paddingTop: 10, marginTop: 4, borderTop: `1px solid ${C.border}` }}>
                <span style={{ color: C.amber, fontWeight: 600 }}>Project Subtotal</span>
                <span style={{ fontFamily: "'IBM Plex Mono'", color: C.amber, fontWeight: 600 }}>GHS {fmtN(totals.projectSubtotal)}</span>
              </div>
            </Card>
            <FinancialAdjustmentsPanel
              adjustments={financialAdjustments}
              onChange={setFinancialAdjustments}
              projectSubtotal={totals.projectSubtotal}
              adjustmentLines={adjustmentLines}
              finalTotal={totals.grand}
              locked={Boolean(projectEstimate?.locked)}
              compact
            />
            <EstimateAuditPanel
              projectEstimate={projectEstimate}
              compact
              onUnlock={onUnlockEstimate}
              onApprove={onApproveEstimate}
            />
          </>
        )
      default:
        return null
    }
  }

  const showBOQ = docType === 'boq' || boqRows.length > 0
  const isEmpty = !hasBOQData && !meta.projectTitle?.trim()
  const canApplyVariation = hasBOQData || Boolean(activeSavedDocId)
  const activeDocName = meta.projectTitle || activeProjName || ''
  const previewPayload = previewVariationOpen || exportStyleOpen
    ? buildVariationPreviewPayload?.(variationDraft?.exportStyle)
    : null
  const logoInputRef = useRef(null)

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await companyLogo?.uploadLogo(file)
    } catch (err) {
      alert(err.message || 'Logo upload failed')
    }
    e.target.value = ''
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Stat bar */}
      <div style={{ display: 'flex', gap: 20, padding: '10px 20px', background: C.carbon, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {[['DE-LUTEROITS', 'Construction', C.sky], [`GHS ${fmtN(totals.grand)}`, 'Doc Total'], [boqRows.length || mats.length, 'BOQ Lines'], [labor.length, 'Labor Lines']].map(([val, lbl, col]) => (
          <div key={lbl}><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: col || C.amber, fontWeight: 500 }}>{val}</div><div style={{ fontSize: 9.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div></div>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>DOCUMENT GENERATOR</div>
        <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 16 }}>Generate branded De-Luteroits Construction PDF documents.</div>

        {transferSource && (
          <div style={{ background: 'rgba(52,211,153,.07)', border: '1px solid rgba(52,211,153,.35)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.green, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            ✓ BOQ data loaded from {transferSource === 'boq-builder' ? 'BOQ Builder' : transferSource === 'ai-chat' ? 'AI Estimator' : 'project'}
            {boqRows.length > 0 && <span style={{ color: C.textDim }}>— {boqRows.length} line items</span>}
          </div>
        )}

        {isEmpty && (
          <div style={{ background: 'rgba(251,146,60,.07)', border: '1px solid rgba(251,146,60,.35)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: C.orange, marginBottom: 14 }}>
            ⚠ No document data yet. Use <strong>BOQ Builder → Send to Document Generator</strong> or fill fields manually.
          </div>
        )}

        {/* Company logo */}
        {companyLogo && (
          <Card title="🏢 COMPANY LOGO">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{
                width: 72, height: 72, background: '#fff', borderRadius: 8,
                border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                <img src={companyLogo.logoUrl} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
                  {companyLogo.isCustom ? 'Custom logo (used on PDF & print)' : 'Default logo — upload PNG, JPG, or SVG'}
                </div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" hidden onChange={handleLogoUpload} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => logoInputRef.current?.click()} style={btn('primary', true)}>Upload logo</button>
                  {companyLogo.isCustom && (
                    <button type="button" onClick={() => companyLogo.resetLogo()} style={btn('outline', true)}>Reset to default</button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {lastAutoSaved && (
          <div style={{ fontSize: 11, color: C.textFaint, fontFamily: "'IBM Plex Mono'", marginBottom: 10 }}>
            Draft auto-saved {new Date(lastAutoSaved).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            {activeSavedDocId && <span style={{ color: C.green, marginLeft: 8 }}>· linked to saved document</span>}
            {hasVariationDraft && <span style={{ color: C.amber, marginLeft: 8 }}>· variation draft in progress</span>}
          </div>
        )}

        {hasVariationDraft && variationDraft?.status === 'finalized' && (
          <div style={{ background: 'rgba(52,211,153,.07)', border: '1px solid rgba(52,211,153,.35)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.green, marginBottom: 14 }}>
            ✓ Variation applied — {formatRevisionLabel(variationDraft.revisionNumber)}
            {variationDraft.variationNumber ? ` (${variationDraft.variationNumber})` : ''}. Save or download the revised document below.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={onDownload} disabled={isEmpty} style={{ ...btn('primary'), opacity: isEmpty ? .5 : 1 }}>⬇ Download PDF</button>
          <button onClick={onPrint} disabled={isEmpty} style={{ ...btn('sky'), opacity: isEmpty ? .5 : 1 }}>🖨️ Print</button>
          {onApproveEstimate && !projectEstimate?.locked && (
            <button onClick={onApproveEstimate} disabled={isEmpty} style={{ ...btn('amber'), opacity: isEmpty ? .5 : 1 }}>
              ✓ Approve &amp; Lock
            </button>
          )}
          <button onClick={onPreview} disabled={isEmpty} style={{ ...btn('green'), opacity: isEmpty ? .5 : 1 }}>👁 Preview</button>
          <button onClick={() => setSaveOpen(true)} disabled={isEmpty} style={{ ...btn('outline'), opacity: isEmpty ? .5 : 1 }}>💾 Save Document</button>
          <button
            onClick={() => setApplyVariationOpen(true)}
            disabled={!canApplyVariation}
            style={{ ...btn('amber'), opacity: !canApplyVariation ? .5 : 1 }}
            title={!canApplyVariation ? 'Open or create a document first' : 'Apply variation to this document'}
          >
            ± Apply Variation
          </button>
          <button onClick={() => setSectionManagerOpen(true)} style={btn('outline')}>Manage Sections</button>
          <button onClick={() => setClearConfirm('clear')} style={btn('outline')}>Clear Form</button>
          <button onClick={() => setClearConfirm('new')} style={btn('outline')}>Start New Document</button>
          <button onClick={onAIFill} disabled={aiBusy} style={{ ...btn('purple'), opacity: aiBusy ? .6 : 1, cursor: aiBusy ? 'not-allowed' : 'pointer' }}>
            {aiBusy ? '⏳ AI working…' : '🤖 AI Auto-Fill'}
          </button>
        </div>

        {hasVariationDraft && variationDraft?.status === 'finalized' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setSaveRevisionOpen(true)} style={btn('primary')}>💾 Save Revised Document</button>
            <button onClick={() => onSaveRevisedDocument?.({ asNewRevision: true })} style={btn('outline')}>Save as New Revision</button>
            <button onClick={onDownloadRevisedPdf} style={btn('sky')}>⬇ Download Revised PDF</button>
            <button onClick={onDownload} style={btn('outline')}>Export Revised PDF</button>
            <button onClick={onSaveVariationSeparately} style={btn('outline')}>Save Variation Separately</button>
            <button onClick={() => setExportStyleOpen(true)} style={btn('green')}>Change Export Style</button>
          </div>
        )}

        {hasVariationDraft && variationDraft?.status !== 'finalized' && (
          <DocGenVariationPanel
            variationDraft={variationDraft}
            calculations={variationCalculations}
            onAddItem={addVariationItem}
            onUpdateItem={updateVariationItem}
            onRemoveItem={removeVariationItem}
            onUndo={undoVariationDraft}
            canUndo={canUndoVariation}
            onUpdateNotes={notes => updateVariationDraftMeta({ userNotes: notes })}
            onPreview={() => {
              if (!variationDraft?.items?.length) {
                toast?.warn?.('No items', 'Add at least one variation line before preview')
                return
              }
              setPreviewVariationOpen(true)
            }}
            onClear={() => setDiscardVariationConfirm(true)}
          />
        )}

        {pdfStatus && (
          <div style={{ background: C.amberGlow, border: `1px solid ${C.amberLo}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.amber, fontFamily: "'IBM Plex Mono'", marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, border: `2px solid ${C.amberLo}`, borderTop: `2px solid ${C.amber}`, borderRadius: '50%', animation: 'rot .6s linear infinite' }} />
            {pdfStatus}
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 1, color: C.amber }}>DOCUMENT PREVIEW</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onDownload} style={btn('primary', true)}>⬇ PDF</button>
                <button onClick={onPrint} style={btn('sky', true)}>🖨️ Print</button>
                <button onClick={() => setPreview(null)} style={btn('outline', true)}>✕</button>
              </div>
            </div>
            <div style={{ border: `2px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}>
              <iframe srcDoc={preview} style={{ width: '100%', height: 800, border: 'none', background: '#F7F9FC' }} title="Document Preview" />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
          <Card title="📄 DOCUMENT TYPE">
            <Field label="Type">
              <select value={docType} onChange={e => setDocType(e.target.value)} style={inputStyle}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <Field label="Reference No."><input value={meta.quoteNum} onChange={e => setMeta('quoteNum', e.target.value)} style={inputStyle} /></Field>
              <Field label="Date"><input type="date" value={meta.date} onChange={e => setMeta('date', e.target.value)} style={inputStyle} /></Field>
            </div>
          </Card>

          {visibleSections.map(section => {
            const body = renderSectionBody(section)
            const isRichText = RICHTEXT_TYPES.has(section.type)
            if (!isRichText && body === null) return null
            return renderSectionBlock(section, body, isRichText)
          })}
        </div>
      </div>

      <SectionManager
        open={sectionManagerOpen}
        sections={documentSections}
        onChange={setDocumentSections}
        onClose={() => setSectionManagerOpen(false)}
        onAddCustom={() => setDocumentSections(prev => [...prev, createSection('custom', { title: 'Custom Section', enabled: true })])}
      />

      <ConfirmDialog
        open={Boolean(clearConfirm)}
        title={clearConfirm === 'new' ? 'Start New Document' : 'Clear Form'}
        message="Are you sure you want to clear this document? All unsaved changes will be lost."
        confirmLabel="Yes"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          if (clearConfirm === 'new') onStartNewDocument?.()
          else onClearForm?.()
          setClearConfirm(null)
        }}
        onCancel={() => setClearConfirm(null)}
      />

      <SaveDocumentDialog
        open={saveOpen}
        defaultName={meta.projectTitle || ''}
        defaultProject={meta.projectTitle || activeProjName || ''}
        defaultCategory={docType === 'boq' ? 'boq' : docType === 'invoice' ? 'invoice' : 'estimate'}
        onSave={(fields) => {
          onSaveDocument?.(fields)
          setSaveOpen(false)
        }}
        onCancel={() => setSaveOpen(false)}
      />

      <SaveDocumentDialog
        open={saveRevisionOpen}
        defaultName={`${meta.projectTitle || activeDocName || 'Document'} — Revision ${variationDraft?.revisionNumber || 1}`}
        defaultProject={meta.projectTitle || activeProjName || ''}
        defaultCategory={docType === 'boq' ? 'boq' : 'quotation'}
        title="Save Revised Document"
        onSave={(fields) => {
          onSaveRevisedDocument?.(fields)
          setSaveRevisionOpen(false)
        }}
        onCancel={() => setSaveRevisionOpen(false)}
      />

      <ApplyVariationDialog
        open={applyVariationOpen}
        onClose={() => setApplyVariationOpen(false)}
        variationOrders={variationOrders}
        activeSavedDocId={activeSavedDocId}
        activeDocName={activeDocName}
        onStartManual={() => {
          const rev = activeSavedDocId
            ? nextRevisionForDocument(activeSavedDocId)
            : nextRevisionNumber([variationDraft?.revisionNumber].filter(Boolean))
          startVariationDraft({ revisionNumber: rev })
          setApplyVariationOpen(false)
          toast?.success?.('Variation started', 'Add variation lines in the schedule below')
        }}
        onSelectOrder={(vo) => {
          onApplyVariationFromOrder?.(vo)
          setApplyVariationOpen(false)
        }}
        onCreateNewOrder={() => {
          onCreateVariationFromDocument?.()
          setApplyVariationOpen(false)
        }}
        onImportFromChat={() => {
          const ok = onImportVariationFromChat?.()
          if (ok !== false) setApplyVariationOpen(false)
        }}
      />

      <VariationPreviewDialog
        open={previewVariationOpen}
        onClose={() => setPreviewVariationOpen(false)}
        calculations={variationCalculations}
        variationDraft={variationDraft}
        previewPayload={previewPayload}
        onApprove={() => {
          setPreviewVariationOpen(false)
          setExportStyleOpen(true)
        }}
      />

      <VariationExportStyleDialog
        open={exportStyleOpen}
        onClose={() => setExportStyleOpen(false)}
        defaultStyle={variationDraft?.exportStyle}
        onConfirm={(style) => {
          setExportStyleOpen(false)
          onFinalizeVariation?.(style)
        }}
      />

      <ConfirmDialog
        open={discardVariationConfirm}
        title="Discard Variation Draft"
        message="Discard this variation draft? Your original document is unchanged. This cannot be undone after clearing."
        confirmLabel="Discard Draft"
        cancelLabel="Keep Editing"
        danger
        onConfirm={() => {
          clearVariationWorkflow()
          setDiscardVariationConfirm(false)
          toast?.info?.('Variation discarded', 'Original document preserved')
        }}
        onCancel={() => setDiscardVariationConfirm(false)}
      />
    </div>
  )
}

function Card({ title, children, compact = false }) {
  return (
    <div style={{ background: compact ? 'transparent' : C.panel, border: compact ? 'none' : `1px solid ${C.border}`, borderRadius: 10, padding: compact ? 0 : 16 }}>
      {!compact && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.amber, marginBottom: 10 }}>{title}</div>}
      {compact && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: 1, color: C.amber, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { background: '#141B24', border: `1px solid #253040`, borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 12.5, padding: '7px 9px', outline: 'none', width: '100%' }
const costRow = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 13 }
const delBtn    = { background: 'transparent', border: `1px solid #253040`, color: '#F87171', fontSize: 11.5, padding: '3px 7px', cursor: 'pointer', borderRadius: 4 }
const addBtnStyle = { background: 'transparent', border: `1px solid #253040`, color: '#6E84A3', fontSize: 11, padding: '5px 11px', cursor: 'pointer', borderRadius: 6, marginTop: 4, fontFamily: 'DM Sans' }

function btn(variant = 'outline', sm = false) {
  const p = sm ? '5px 11px' : '7px 14px'
  const fs = sm ? 11.5 : 12.5
  const base = { padding: p, borderRadius: 6, fontSize: fs, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s' }
  const map = {
    primary: { ...base, background: '#F59E0B', color: '#070A0D' },
    sky:     { ...base, background: 'transparent', border: `1px solid #38BDF8`, color: '#38BDF8' },
    green:   { ...base, background: 'transparent', border: `1px solid #34D399`, color: '#34D399' },
    purple:  { ...base, background: 'transparent', border: `1px solid #A78BFA`, color: '#A78BFA' },
    amber:   { ...base, background: 'transparent', border: `1px solid #F59E0B`, color: '#F59E0B' },
    outline: { ...base, background: 'transparent', border: `1px solid #253040`, color: '#6E84A3' },
  }
  return map[variant] || base
}
