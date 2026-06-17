import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { StatusBadge } from '../shared/StatusBadge.jsx'
import { VariationStartDialog } from './VariationStartDialog.jsx'
import { VariationExportDialog } from './VariationExportDialog.jsx'
import {
  CHANGE_TYPE_OPTIONS,
  ITEM_STATUS_OPTIONS,
  VO_SOURCE_TYPES,
  VO_STATUSES,
  VO_STATUS_LABELS,
  createEmptyVariationItem,
  appendAuditEntry,
} from '../../utils/variationOrderTypes.js'
import {
  applyCalculationsToOrder,
  computeVariationTotals,
  recalcVariationItem,
} from '../../utils/variationCalculations.js'
import { createNewVariationOrder } from '../../utils/variationOrderStore.js'
import { buildVariationAIPrompt } from '../../utils/variationAIParser.js'
import {
  buildVariationExportHTML,
  getVariationExportFilename,
  downloadVariationHTML,
} from '../../utils/variationExport.js'
import { extractFileContent } from '../../utils/fileExtractor.js'
import { coerceFieldValue, readSelectValue, sanitizePatch } from '../../utils/safeSerialize.js'

function ghs(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n)) return '—'
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function loadFromSavedDocument(doc) {
  const snap = doc.snapshot || {}
  const meta = snap.meta || {}
  const boqRows = snap.boqRows || []
  const total = doc.contractSum || snap.contractSum || snap.totals?.grand || 0
  return {
    originalEstimateId: doc.id,
    originalEstimateRef: meta.quoteNum || doc.name,
    clientName: meta.clientName || '',
    clientContact: meta.clientContact || '',
    clientEmail: meta.clientEmail || '',
    projectName: meta.projectTitle || doc.projectName || '',
    projectLocation: meta.projectLocation || '',
    originalEstimateTotal: total,
    originalBoqSnapshot: JSON.parse(JSON.stringify(boqRows)),
  }
}

function loadFromProject(proj) {
  return {
    projectId: proj.id,
    projectName: proj.name,
    originalEstimateRef: proj.meta?.quoteNum || proj.name,
    originalEstimateTotal: proj.contractSum || 0,
    originalBoqSnapshot: JSON.parse(JSON.stringify(proj.boqRows || [])),
    clientName: proj.meta?.clientName || '',
    projectLocation: proj.meta?.location || '',
  }
}

const inputStyle = {
  background: 'transparent', border: 'none', outline: 'none',
  color: C.text, fontSize: 11.5, width: '100%', minWidth: 50,
}

const thStyle = {
  background: C.slate, color: C.amber, padding: '6px 7px', textAlign: 'left',
  border: `1px solid ${C.border}`, fontFamily: 'IBM Plex Mono', fontSize: 9,
  whiteSpace: 'nowrap',
}

const tdStyle = {
  border: `1px solid ${C.border}`, padding: '4px 6px', verticalAlign: 'top',
}

export function VariationOrderPage({
  variationOrders = [],
  onRefresh,
  onSave,
  onDelete,
  savedDocuments = [],
  projects = [],
  intelligence,
  onAIAssist,
  aiBusy,
  initialAction,
  onClearInitialAction,
}) {
  const [activeVO, setActiveVO] = useState(null)
  const [view, setView] = useState('list')
  const [startOpen, setStartOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadText, setUploadText] = useState('')
  const [clientChanges, setClientChanges] = useState('')
  const fileRef = useRef(null)

  const calculations = useMemo(() => {
    if (!activeVO) return null
    return computeVariationTotals(activeVO.items, activeVO.originalEstimateTotal)
  }, [activeVO])

  const openNew = useCallback(() => setStartOpen(true), [])

  const handleStart = useCallback((sourceType, payload = {}) => {
    setStartOpen(false)
    let partial = { sourceType, items: [] }

    if (sourceType === VO_SOURCE_TYPES.ESTIMATE) {
      if (payload.document) {
        partial = { ...partial, ...loadFromSavedDocument(payload.document) }
      } else if (payload.project) {
        partial = { ...partial, ...loadFromProject(payload.project) }
      } else if (intelligence?.data?.boqItems?.length) {
        partial = {
          ...partial,
          projectName: intelligence.data.projectInfo?.title || '',
          clientName: intelligence.data.client?.name || '',
          originalEstimateRef: intelligence.data.projectInfo?.quoteNum || 'Current BOQ',
          originalEstimateTotal: intelligence.data.pricing?.summary?.grand || 0,
          originalBoqSnapshot: JSON.parse(JSON.stringify(intelligence.data.boqItems)),
        }
      }
    }

    const vo = createNewVariationOrder(partial, variationOrders)
    setActiveVO(vo)
    setView('editor')

    if (sourceType === VO_SOURCE_TYPES.UPLOAD) {
      setTimeout(() => fileRef.current?.click(), 100)
    }
  }, [intelligence, variationOrders])

  const updateVO = useCallback((patch) => {
    const safePatch = sanitizePatch(patch)
    if (!Object.keys(safePatch).length) return
    setActiveVO(prev => applyCalculationsToOrder({ ...prev, ...safePatch }))
  }, [])

  const updateItem = useCallback((id, field, value) => {
    const safeVal = coerceFieldValue(value)
    if (safeVal === undefined) return
    setActiveVO(prev => {
      const items = prev.items.map(item => {
        if (item.id !== id) return item
        const updated = recalcVariationItem({ ...item, [field]: safeVal })
        return updated
      })
      return applyCalculationsToOrder({ ...prev, items })
    })
  }, [])

  const addItem = useCallback(() => {
    setActiveVO(prev => applyCalculationsToOrder({
      ...appendAuditEntry(prev, 'item_added', `Line item ${(prev.items?.length || 0) + 1} added`),
      items: [...(prev.items || []), createEmptyVariationItem((prev.items?.length || 0) + 1)],
    }))
  }, [])

  const removeItem = useCallback((id) => {
    setActiveVO(prev => applyCalculationsToOrder({
      ...appendAuditEntry(prev, 'item_removed', 'Variation line item removed'),
      items: (prev.items || []).filter(i => i.id !== id),
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!activeVO) return
    setSaving(true)
    const withAudit = appendAuditEntry(activeVO, 'saved', `Variation ${activeVO.variationNumber} saved`)
    const result = await onSave?.(withAudit)
    if (result?.ok) {
      setActiveVO(result.order || withAudit)
    }
    setSaving(false)
  }, [activeVO, onSave])

  const handleExport = useCallback(async (exportType) => {
    if (!activeVO || !calculations) return
    setExporting(true)
    try {
      const vo = applyCalculationsToOrder(activeVO)
      const html = buildVariationExportHTML(vo, exportType, calculations)
      const filename = getVariationExportFilename(vo, exportType)
      downloadVariationHTML(html, filename)
      setExportOpen(false)
    } finally {
      setExporting(false)
    }
  }, [activeVO, calculations])

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const extracted = await extractFileContent(file)
      const text = extracted.text || extracted.content || ''
      setUploadText(text)
      updateVO({
        originalEstimateRef: file.name,
        auditTrail: [
          ...(activeVO?.auditTrail || []),
          { at: new Date().toISOString(), action: 'upload', detail: `Uploaded ${file.name}`, user: 'user' },
        ],
      })
    } catch (err) {
      console.error('[VO] upload failed', err)
    }
    e.target.value = ''
  }, [activeVO, updateVO])

  const handleAIAssist = useCallback(() => {
    const prompt = buildVariationAIPrompt({
      estimateText: uploadText || activeVO?.originalBoqSnapshot?.map(r =>
        `${r.itemRef || ''}|${r.desc}|${r.qty}|${r.unit}|${r.rate}|${r.amount}`,
      ).join('\n'),
      clientChanges,
      existingItems: activeVO?.items || [],
    })
    onAIAssist?.(prompt)
  }, [uploadText, clientChanges, activeVO, onAIAssist])

  const openVO = useCallback((vo) => {
    setActiveVO(applyCalculationsToOrder(vo))
    setView('editor')
  }, [])

  // Handle initial action from Quick Launch
  useEffect(() => {
    if (!initialAction) return
    if (initialAction === 'new') setStartOpen(true)
    if (initialAction === 'review' && variationOrders.length) openVO(variationOrders[0])
    if (initialAction === 'export' && variationOrders.length) {
      openVO(variationOrders[0])
      setExportOpen(true)
    }
    onClearInitialAction?.()
  }, [initialAction, variationOrders, openVO, onClearInitialAction])

  if (view === 'list') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileUpload} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: '2px', color: C.amber }}>VARIATION ORDER</div>
            <div style={{ fontSize: 12.5, color: C.textDim }}>Estimate revisions — additions, omissions, adjustments &amp; revised totals</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={openNew}>+ New Variation</Button>
            <Button variant="outline" onClick={onRefresh}>↻ Refresh</Button>
          </div>
        </div>

        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 11, color: C.textDim,
        }}>
          Original estimates are preserved as issued. Each variation is saved as a separate record (VO-001, VO-002…).
        </div>

        {variationOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: C.textFaint }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No variation orders yet</div>
            <Button onClick={openNew}>Create First Variation</Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['VO No.', 'Project', 'Client', 'Original Ref', 'Status', 'Net Variation', 'Revised Total', 'Date', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variationOrders.map(vo => (
                  <tr key={vo.id}>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', color: C.amber }}>{vo.variationNumber}</td>
                    <td style={tdStyle}>{vo.projectName || '—'}</td>
                    <td style={tdStyle}>{vo.clientName || '—'}</td>
                    <td style={tdStyle}>{vo.originalEstimateRef || '—'}</td>
                    <td style={tdStyle}><StatusBadge status={vo.status} label={VO_STATUS_LABELS[vo.status] || vo.status} /></td>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', textAlign: 'right' }}>{ghs(vo.netVariation)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', textAlign: 'right', color: C.green }}>{ghs(vo.revisedTotal)}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: C.textDim }}>{vo.date}</td>
                    <td style={tdStyle}>
                      <Button size="sm" onClick={() => openVO(vo)}>Open</Button>
                      <Button size="sm" variant="red" onClick={() => onDelete?.(vo.id)} style={{ marginLeft: 4 }}>✕</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <VariationStartDialog
          open={startOpen}
          onClose={() => setStartOpen(false)}
          onStart={handleStart}
          savedDocuments={savedDocuments}
          projects={projects}
        />
      </div>
    )
  }

  const calc = calculations || {}

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, background: C.carbon }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px' }}>
              {activeVO?.variationNumber} — VARIATION ORDER
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              Original: {activeVO?.originalEstimateRef || '—'} · {activeVO?.projectName || 'No project'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => { setView('list'); setActiveVO(null) }}>← Back</Button>
            <Button variant="outline" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button>
            <Button variant="sky" onClick={() => setExportOpen(true)}>📄 Export</Button>
          </div>
        </div>

        {/* Meta fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
          {[
            ['Client', 'clientName'], ['Project', 'projectName'], ['Location', 'projectLocation'],
            ['Original Ref', 'originalEstimateRef'], ['Date', 'date', 'date'],
            ['Status', 'status', 'select', Object.entries(VO_STATUS_LABELS)],
          ].map(([label, field, type, options]) => (
            <div key={field} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: C.textFaint, marginBottom: 3 }}>{label}</div>
              {type === 'select' ? (
                <select
                  value={activeVO?.[field] || ''}
                  onChange={e => updateVO({ [field]: e.target.value })}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input
                  type={type === 'date' ? 'date' : 'text'}
                  value={activeVO?.[field] || ''}
                  onChange={e => updateVO({ [field]: e.target.value })}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: C.textFaint, marginBottom: 3 }}>Reason for Variation / Client Instruction</div>
          <textarea
            value={activeVO?.reasonForVariation || ''}
            onChange={e => updateVO({ reasonForVariation: e.target.value })}
            rows={2}
            style={{
              width: '100%', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '8px 10px', color: C.text, fontSize: 12, resize: 'vertical', outline: 'none',
            }}
            placeholder="Describe what the client requested and who instructed the change…"
          />
        </div>
      </div>

      {/* AI Assist panel */}
      <div style={{ padding: '10px 20px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 6, letterSpacing: '1px' }}>AI-ASSISTED VARIATION</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={clientChanges}
            onChange={e => setClientChanges(e.target.value)}
            rows={2}
            style={{
              flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '8px 10px', color: C.text, fontSize: 12, resize: 'none', outline: 'none',
            }}
            placeholder="Describe client changes: what was added, removed, reduced, substituted…"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Button variant="sky" disabled={aiBusy} onClick={handleAIAssist}>
              {aiBusy ? '⏳ AI…' : '🤖 AI Build Schedule'}
            </Button>
            {activeVO?.sourceType === VO_SOURCE_TYPES.UPLOAD && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>📎 Re-upload</Button>
            )}
          </div>
        </div>
        {uploadText && (
          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
            Uploaded estimate text loaded ({uploadText.length.toLocaleString()} chars)
          </div>
        )}
      </div>

      {/* Main content: table + summary */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Button size="sm" onClick={() => addItem()}>+ Add Line</Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {[
                    '#', 'Orig Ref', 'Description', 'Change Type',
                    'Orig Qty', 'Rev Qty', 'Unit', 'Orig Rate', 'Rev Rate',
                    'Orig Amt', 'Rev Amt', 'Diff', 'Reason', 'Status', 'Notes', '',
                  ].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(activeVO?.items || []).map(item => (
                  <tr key={item.id} style={{ background: item.status === 'tbc' ? `${C.amberGlow}` : 'transparent' }}>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.textFaint }}>{item.itemNo}</td>
                    <td style={tdStyle}><input value={item.originalItemRef} onChange={e => updateItem(item.id, 'originalItemRef', e.target.value)} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, minWidth: 140 }}><input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} style={inputStyle} placeholder="Description…" /></td>
                    <td style={tdStyle}>
                      <select value={item.changeType} onChange={e => updateItem(item.id, 'changeType', readSelectValue(e))} style={{ ...inputStyle, minWidth: 110 }}>
                        {CHANGE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}><input value={item.originalQty} onChange={e => updateItem(item.id, 'originalQty', e.target.value)} style={{ ...inputStyle, width: 50 }} /></td>
                    <td style={tdStyle}><input value={item.revisedQty} onChange={e => updateItem(item.id, 'revisedQty', e.target.value)} style={{ ...inputStyle, width: 50 }} /></td>
                    <td style={tdStyle}><input value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{ ...inputStyle, width: 40 }} /></td>
                    <td style={tdStyle}><input value={item.originalRate} onChange={e => updateItem(item.id, 'originalRate', e.target.value)} style={{ ...inputStyle, width: 60 }} /></td>
                    <td style={tdStyle}><input value={item.revisedRate} onChange={e => updateItem(item.id, 'revisedRate', e.target.value)} style={{ ...inputStyle, width: 60 }} /></td>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, textAlign: 'right' }}>{ghs(item.originalAmount)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, textAlign: 'right' }}>{ghs(item.revisedAmount)}</td>
                    <td style={{
                      ...tdStyle, fontFamily: 'IBM Plex Mono', fontSize: 10, textAlign: 'right',
                      color: item.difference > 0 ? C.green : item.difference < 0 ? C.red : C.textDim,
                    }}>
                      {item.difference > 0 ? '+' : ''}{ghs(item.difference)}
                    </td>
                    <td style={tdStyle}><input value={item.reason} onChange={e => updateItem(item.id, 'reason', e.target.value)} style={inputStyle} placeholder="Client instruction…" /></td>
                    <td style={tdStyle}>
                      <select value={item.status} onChange={e => updateItem(item.id, 'status', readSelectValue(e))} style={inputStyle}>
                        {ITEM_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}><input value={item.notes} onChange={e => updateItem(item.id, 'notes', e.target.value)} style={inputStyle} /></td>
                    <td style={tdStyle}><Button size="sm" variant="red" onClick={() => removeItem(item.id)}>✕</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit trail */}
          {(activeVO?.auditTrail || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 8 }}>AUDIT TRAIL</div>
              <div style={{ fontSize: 11, color: C.textDim, maxHeight: 100, overflowY: 'auto' }}>
                {activeVO.auditTrail.slice().reverse().map((e, i) => (
                  <div key={i} style={{ padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.textFaint, fontFamily: 'IBM Plex Mono', fontSize: 9 }}>
                      {new Date(e.at).toLocaleString()}
                    </span>
                    {' — '}
                    <span style={{ color: C.amber }}>{e.action}</span>: {e.detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div style={{
          width: 260, flexShrink: 0, borderLeft: `1px solid ${C.border}`,
          background: C.panel, padding: 16, overflowY: 'auto',
        }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, marginBottom: 12, letterSpacing: '1px' }}>CALCULATIONS</div>
          {[
            ['Total Additions', calc.totalAdditions, C.green],
            ['Total Omissions', calc.totalOmissions, C.red, true],
            ['Total Reductions', calc.totalReductions, C.red, true],
            ['Total Increases', calc.totalIncreases, C.green],
            ['Net Variation', calc.netVariation, calc.netVariation >= 0 ? C.green : C.red],
          ].map(([label, val, color, negate]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: C.textDim }}>{label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', color, fontSize: 11 }}>
                {negate && val > 0 ? '− ' : ''}{ghs(Math.abs(val || 0))}
              </span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: C.textDim }}>Original Total</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{ghs(calc.originalEstimateTotal)}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
              background: C.panel2, borderRadius: 8, border: `1px solid ${C.amber}40`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.amber }}>Revised Total</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: C.gold, fontWeight: 700 }}>
                {ghs(calc.revisedTotal)}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 10, color: C.textFaint, lineHeight: 1.5 }}>
            Revised Total = Original + Additions − Omissions ± Adjustments
          </div>
        </div>
      </div>

      <VariationStartDialog
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onStart={handleStart}
        savedDocuments={savedDocuments}
        projects={projects}
      />

      <VariationExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  )
}

export default VariationOrderPage
