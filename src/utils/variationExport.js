/** HTML builders for Variation Order export documents — uses DeLuteroitsDocumentTemplate. */

import {
  esc,
  fmtDate,
  ghsAmount,
  ghsTableDiff,
  wrapDeLuteroitsDocument,
  buildMetaGrid,
  buildSection,
  buildNotesBox,
  buildVariationSummaryBlock,
  buildApprovalSignatureBlock,
  buildSignatureBlock,
  DELUTEROITS_DOCUMENT_STYLES,
} from './deLuteroitsDocumentTemplate.js'
import {
  CHANGE_TYPE_LABELS,
  ITEM_STATUS_LABELS,
  VO_EXPORT_LABELS,
  VO_FILE_FORMATS,
} from './variationOrderTypes.js'
import { computeVariationTotals } from './variationCalculations.js'
import { downloadHtmlAsPdf } from './htmlToPdf.js'

function compactScheduleTable(items) {
  if (!items?.length) return '<p style="font-size:10px">No variation items.</p>'
  return `<table class="data"><thead><tr>
      <th>#</th><th>Description</th><th>Type</th><th class="num">Difference</th><th>Status</th>
    </tr></thead><tbody>${items.map(i => `<tr>
      <td>${i.itemNo}</td>
      <td>${esc(i.description)}</td>
      <td>${esc(CHANGE_TYPE_LABELS[i.changeType] || i.changeType)}</td>
      <td class="num">${ghsTableDiff(i.difference)}</td>
      <td>${esc(ITEM_STATUS_LABELS[i.status] || i.status)}</td>
    </tr>`).join('')}</tbody></table>`
}

function fullItemTable(items) {
  if (!items?.length) return '<p style="font-size:10px">No variation items.</p>'
  return `<table class="data"><thead><tr>
    <th>#</th><th>Orig Ref</th><th>Description</th><th>Type</th>
    <th>Orig Qty</th><th>Rev Qty</th><th>Unit</th>
    <th class="num">Orig Rate</th><th class="num">Rev Rate</th>
    <th class="num">Orig Amt</th><th class="num">Rev Amt</th><th class="num">Diff</th>
    <th>Reason</th><th>Status</th><th>Notes</th>
  </tr></thead><tbody>${items.map(i => `<tr>
    <td>${i.itemNo}</td>
    <td>${esc(i.originalItemRef)}</td>
    <td>${esc(i.description)}</td>
    <td>${esc(CHANGE_TYPE_LABELS[i.changeType] || i.changeType)}</td>
    <td>${esc(i.originalQty)}</td>
    <td>${esc(i.revisedQty)}</td>
    <td>${esc(i.unit)}</td>
    <td class="num">${ghsAmount(i.originalRate)}</td>
    <td class="num">${ghsAmount(i.revisedRate)}</td>
    <td class="num">${ghsAmount(i.originalAmount)}</td>
    <td class="num">${ghsAmount(i.revisedAmount)}</td>
    <td class="num">${ghsTableDiff(i.difference)}</td>
    <td>${esc(i.reason)}</td>
    <td>${esc(ITEM_STATUS_LABELS[i.status] || i.status)}</td>
    <td>${esc(i.notes)}</td>
  </tr>`).join('')}</tbody></table>`
}

function additionsSummary(items) {
  const adds = items.filter(i => i.difference > 0 && i.status !== 'rejected')
  if (!adds.length) return '<p style="font-size:10px;color:#666">No additions in this variation.</p>'
  return `<ul style="font-size:10px;line-height:1.6;padding-left:16px">${adds.map(i =>
    `<li>${esc(i.description)} — ${ghsAmount(i.difference)}</li>`,
  ).join('')}</ul>`
}

function omissionsSummary(items) {
  const omits = items.filter(i => i.difference < 0 && i.status !== 'rejected')
  if (!omits.length) return '<p style="font-size:10px;color:#666">No omissions or reductions in this variation.</p>'
  return `<ul style="font-size:10px;line-height:1.6;padding-left:16px">${omits.map(i =>
    `<li>${esc(i.description)} — ${ghsAmount(Math.abs(i.difference))}</li>`,
  ).join('')}</ul>`
}

function buildAddendumBody(vo, calculations) {
  return `
${buildMetaGrid([
  ['Original Estimate Ref', vo.originalEstimateRef],
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Addendum Date', fmtDate(vo.date)],
  ['Variation No.', vo.variationNumber],
])}
<div class="notes" style="margin-bottom:14px">
  This addendum forms part of the original estimate <strong>${esc(vo.originalEstimateRef)}</strong> dated as issued.
  The original estimate remains valid except as modified herein. No items in the original estimate are deleted from record.
</div>
${buildSection('Client Instruction')}
${buildNotesBox(vo.reasonForVariation || '—')}
${buildSection('Variation Schedule')}
${compactScheduleTable(vo.items)}
${buildVariationSummaryBlock(calculations)}
${buildApprovalSignatureBlock(vo.paymentNote)}`
}

/** Build addendum to original estimate — canonical client-facing variation layout. */
export function buildAddendumHTML(vo, calculations) {
  return wrapDeLuteroitsDocument({
    pageTitle: `${vo.variationNumber} — Addendum`,
    docTitle: 'ADDENDUM TO ORIGINAL ESTIMATE',
    subtitle: vo.variationNumber || 'Variation Addendum',
    bodyHtml: buildAddendumBody(vo, calculations),
  })
}

/** Build client-facing variation quotation HTML. */
export function buildClientVariationHTML(vo, calculations) {
  const body = `
${buildMetaGrid([
  ['Original Estimate Ref', vo.originalEstimateRef],
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Location', vo.projectLocation],
  ['Date', fmtDate(vo.date)],
  ['Variation No.', vo.variationNumber],
])}
${buildSection('Reason for Variation')}
${buildNotesBox(vo.reasonForVariation || 'As instructed by client.')}
${buildSection('Summary of Additions')}
${additionsSummary(vo.items)}
${buildSection('Summary of Omissions / Reductions')}
${omissionsSummary(vo.items)}
${buildVariationSummaryBlock(calculations)}
${buildSection('Payment & Approval')}
${buildNotesBox(vo.paymentNote || 'This variation is subject to written client approval before additional works commence.')}
${buildSignatureBlock()}`

  return wrapDeLuteroitsDocument({
    pageTitle: `${vo.variationNumber} — Variation Quotation`,
    docTitle: 'VARIATION QUOTATION',
    subtitle: vo.variationNumber || 'Variation Order',
    bodyHtml: body,
  })
}

/** Build internal QS detailed variation schedule HTML. */
export function buildInternalVariationHTML(vo, calculations) {
  const auditHtml = (vo.auditTrail || []).length ? `
${buildSection('Audit Trail')}
<table class="data"><thead><tr><th>Date/Time</th><th>Action</th><th>Detail</th></tr></thead>
<tbody>${vo.auditTrail.map(e => `<tr>
  <td>${esc(new Date(e.at).toLocaleString())}</td>
  <td>${esc(e.action)}</td>
  <td>${esc(e.detail)}</td>
</tr>`).join('')}</tbody></table>` : ''

  const body = `
${buildMetaGrid([
  ['Original Estimate Ref', vo.originalEstimateRef],
  ['Original Estimate ID', vo.originalEstimateId],
  ['Project ID', vo.projectId],
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Date', fmtDate(vo.date)],
  ['Status', vo.status],
])}
${buildSection('Reason for Variation')}
${buildNotesBox(vo.reasonForVariation || '—')}
${buildSection('Detailed Variation Line Items')}
${fullItemTable(vo.items)}
${buildVariationSummaryBlock(calculations)}
${buildSection('Assumptions & Notes')}
${buildNotesBox(`Original estimate preserved as issued. This variation is recorded separately as ${vo.variationNumber}. All amounts in GHS unless stated otherwise.`)}
${auditHtml}`

  return wrapDeLuteroitsDocument({
    pageTitle: `${vo.variationNumber} — Internal Schedule`,
    docTitle: 'INTERNAL QS VARIATION SCHEDULE',
    subtitle: vo.variationNumber || 'Variation Order',
    bodyHtml: body,
  })
}

/** Build revised full estimate combining original snapshot + variations. */
export function buildRevisedEstimateHTML(vo, calculations) {
  const originalRows = (vo.originalBoqSnapshot || []).map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.itemRef || r.section)}</td>
    <td>${esc(r.desc)}</td>
    <td>${esc(r.qty)}</td>
    <td>${esc(r.unit)}</td>
    <td class="num">${ghsAmount(r.rate)}</td>
    <td class="num">${ghsAmount(r.amount)}</td>
    <td>Original</td>
  </tr>`).join('')

  const variationRows = vo.items.filter(i => i.status !== 'rejected').map(i => `<tr>
    <td>V${i.itemNo}</td>
    <td>${esc(i.originalItemRef)}</td>
    <td>${esc(i.description)}</td>
    <td>${esc(i.revisedQty || i.originalQty)}</td>
    <td>${esc(i.unit)}</td>
    <td class="num">${ghsAmount(i.revisedRate || i.originalRate)}</td>
    <td class="num">${ghsAmount(i.revisedAmount)}</td>
    <td>${esc(CHANGE_TYPE_LABELS[i.changeType] || i.changeType)}</td>
  </tr>`).join('')

  const body = `
${buildMetaGrid([
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Location', vo.projectLocation],
  ['Original Ref', vo.originalEstimateRef],
  ['Variation', vo.variationNumber],
  ['Date', fmtDate(vo.date)],
])}
${buildSection('Original Estimate Items (Preserved)')}
<table class="data"><thead><tr>
  <th>#</th><th>Ref</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th><th>Status</th>
</tr></thead><tbody>${originalRows || '<tr><td colspan="8">No original items snapshot</td></tr>'}</tbody></table>
${buildSection('Variation Adjustments')}
<table class="data"><thead><tr>
  <th>#</th><th>Ref</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th><th>Change</th>
</tr></thead><tbody>${variationRows || '<tr><td colspan="8">No variation items</td></tr>'}</tbody></table>
${buildVariationSummaryBlock(calculations)}`

  return wrapDeLuteroitsDocument({
    pageTitle: `${vo.variationNumber} — Revised Estimate`,
    docTitle: 'REVISED FULL ESTIMATE',
    subtitle: `${vo.originalEstimateRef} + ${vo.variationNumber}`,
    bodyHtml: body,
  })
}

/** Client-facing formal variation order — matches addendum reference layout. */
export function buildFormalVariationOrderHTML(vo, calculations) {
  return buildAddendumHTML(vo, calculations)
}

export function buildVariationExportHTML(vo, exportType, calculations) {
  switch (exportType) {
    case 'client_quotation': return buildClientVariationHTML(vo, calculations)
    case 'internal_schedule': return buildInternalVariationHTML(vo, calculations)
    case 'revised_estimate': return buildRevisedEstimateHTML(vo, calculations)
    case 'addendum': return buildAddendumHTML(vo, calculations)
    default: return buildAddendumHTML(vo, calculations)
  }
}

export function getVariationExportFilename(vo, exportType) {
  const slug = (vo.variationNumber || 'VO').replace(/\s+/g, '-')
  const typeSlug = {
    client_quotation: 'client-quotation',
    internal_schedule: 'internal-schedule',
    revised_estimate: 'revised-estimate',
    addendum: 'addendum',
  }[exportType] || 'variation'
  return `${slug}-${typeSlug}.pdf`
}

export function getVariationExportTitle(exportType) {
  return VO_EXPORT_LABELS[exportType] || 'Variation Order'
}

export function downloadVariationHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.replace(/\.pdf$/i, '.html')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export function printVariationHTML(html) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100')
  if (!win) throw new Error('Print blocked — allow popups for this site')
  win.document.open()
  win.document.write(html)
  win.document.close()
  return new Promise((resolve) => {
    const doPrint = () => {
      try {
        win.focus()
        win.print()
        resolve(true)
      } catch {
        resolve(false)
      }
    }
    if (win.document.readyState === 'complete') {
      setTimeout(doPrint, 500)
    } else {
      win.onload = () => setTimeout(doPrint, 500)
    }
  })
}

function totalsMatch(a, b, tolerance = 0.02) {
  const keys = [
    'originalEstimateTotal', 'totalAdditions', 'totalOmissions',
    'totalReductions', 'totalIncreases', 'netVariation', 'revisedTotal',
  ]
  return keys.every((key) => Math.abs((a[key] || 0) - (b[key] || 0)) <= tolerance)
}

export function validateVariationForExport(vo, calculations) {
  const errors = []
  const title = (vo?.projectName || vo?.projectTitle || '').trim()
  if (!title) errors.push('Document title (project name) is required')
  if (!vo?.variationNumber?.trim()) errors.push('Variation number is required')
  if (!vo?.items?.length) errors.push('At least one variation item is required')

  const fresh = computeVariationTotals(vo.items || [], vo.originalEstimateTotal)
  const calc = calculations || fresh
  if (!totalsMatch(fresh, calc)) {
    errors.push('Totals are out of date — review calculations before continuing')
  }

  const expectedRevised = Math.round((calc.originalEstimateTotal + calc.netVariation) * 100) / 100
  if (Math.abs(expectedRevised - calc.revisedTotal) > 0.02) {
    errors.push('Revised total does not match original + net variation')
  }

  return { ok: errors.length === 0, errors }
}

export function getVariationFileBasename(vo) {
  return (vo.variationNumber || 'VO').replace(/\s+/g, '-')
}

export function getVariationFormatFilename(vo, format) {
  const slug = getVariationFileBasename(vo)
  const ext = {
    [VO_FILE_FORMATS.PDF]: 'pdf',
    [VO_FILE_FORMATS.DOCX]: 'docx',
    [VO_FILE_FORMATS.CSV]: 'csv',
    [VO_FILE_FORMATS.HTML]: 'html',
  }[format] || 'html'
  return `${slug}-variation-order.${ext}`
}

function triggerBlobDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildVariationCSV(vo) {
  const headers = [
    'Item No', 'Original Ref', 'Change Type', 'Description',
    'Original Qty', 'Revised Qty', 'Unit', 'Original Rate', 'Revised Rate',
    'Original Amount', 'Revised Amount', 'Difference', 'Reason', 'Status',
  ]
  const rows = (vo.items || []).map(item => [
    item.itemNo,
    item.originalItemRef,
    CHANGE_TYPE_LABELS[item.changeType] || item.changeType,
    item.description,
    item.originalQty,
    item.revisedQty,
    item.unit,
    item.originalRate,
    item.revisedRate,
    item.originalAmount,
    item.revisedAmount,
    item.difference,
    item.reason,
    ITEM_STATUS_LABELS[item.status] || item.status,
  ])
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')
}

export function downloadVariationCSV(vo) {
  const csv = buildVariationCSV(vo)
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  triggerBlobDownload(blob, getVariationFormatFilename(vo, VO_FILE_FORMATS.CSV))
}

export function downloadVariationDOCX(html, vo) {
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  const body = bodyMatch ? bodyMatch[1] : html
  const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(vo.variationNumber)}</title><style>${DELUTEROITS_DOCUMENT_STYLES}</style></head><body>${body}</body></html>`
  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' })
  triggerBlobDownload(blob, getVariationFormatFilename(vo, VO_FILE_FORMATS.DOCX))
}

export async function downloadVariationPDF(vo, calculations, onProgress) {
  const html = buildFormalVariationOrderHTML(vo, calculations)
  onProgress?.('Generating PDF…')
  const result = await downloadHtmlAsPdf(html, getVariationFormatFilename(vo, VO_FILE_FORMATS.PDF), onProgress)
  if (result.ok) return result

  downloadVariationHTML(html, getVariationFormatFilename(vo, VO_FILE_FORMATS.PDF))
  return {
    ok: true,
    method: 'html',
    message: 'PDF engine unavailable — HTML downloaded. Open and Print → Save as PDF.',
  }
}

export async function exportVariationFormat(vo, format, calculations, onProgress) {
  const html = buildFormalVariationOrderHTML(vo, calculations)
  switch (format) {
    case VO_FILE_FORMATS.PDF:
      return downloadVariationPDF(vo, calculations, onProgress)
    case VO_FILE_FORMATS.DOCX:
      downloadVariationDOCX(html, vo)
      return { ok: true, method: 'docx' }
    case VO_FILE_FORMATS.CSV:
      downloadVariationCSV(vo)
      return { ok: true, method: 'csv' }
    case VO_FILE_FORMATS.HTML:
    default:
      downloadVariationHTML(html, getVariationFormatFilename(vo, VO_FILE_FORMATS.HTML))
      return { ok: true, method: 'html' }
  }
}
