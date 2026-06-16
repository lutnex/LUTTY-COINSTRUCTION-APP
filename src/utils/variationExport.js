/** HTML builders for Variation Order export documents. */

import { COMPANY } from './constants.js'
import {
  CHANGE_TYPE_LABELS,
  ITEM_STATUS_LABELS,
  VO_EXPORT_LABELS,
} from './variationOrderTypes.js'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ghs(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n)) return '—'
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return String(d)
  }
}

const BASE_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:Helvetica,Arial,sans-serif;background:#e8ecf2;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.document{width:210mm;min-height:297mm;background:#fff;margin:12px auto;box-shadow:0 4px 20px rgba(0,0,0,.1)}
.hdr{background:#0A2A43;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.cn{font-size:15px;font-weight:800;color:#fff}
.cd{font-size:9px;color:rgba(255,255,255,.75);line-height:1.5;margin-top:5px}
.logo-fb{width:44px;height:44px;background:#B00020;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff}
.ac{height:3px;background:linear-gradient(90deg,#B00020,#0A2A43)}
.bd{padding:24px 28px 32px}
.dt{font-size:19px;font-weight:800;color:#0A2A43}
.ds{font-size:11px;color:#B00020;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:6px 0 14px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:16px}
.meta-cell{background:#f4f7fb;border:1px solid #d0d8e8;padding:7px 9px;border-radius:4px}
.meta-lbl{font-size:8px;font-weight:700;color:#B00020;text-transform:uppercase}
.meta-val{font-size:10px;font-weight:700;color:#0A2A43;margin-top:2px}
.sec{font-size:11px;font-weight:800;color:#0A2A43;text-transform:uppercase;margin:16px 0 7px;border-bottom:2px solid #B00020;padding-bottom:3px}
table.data{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9px}
table.data thead tr{background:#0A2A43}
table.data th{padding:6px 7px;text-align:left;font-size:7.5px;color:#fff;text-transform:uppercase}
table.data td{padding:5px 7px;border-bottom:1px solid #e0e8f0;vertical-align:top}
table.data td.num{text-align:right}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:10.5px}
.sum-row.grand{background:#0A2A43;color:#FCD34D;padding:10px 12px;border-radius:5px;margin-top:6px;font-weight:800}
.notes{font-size:10px;line-height:1.55;padding:10px;background:#fafbfc;border:1px solid #e0e8f0;border-radius:4px}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}
.sig-box{border-top:1px solid #333;padding-top:6px;font-size:10px}
.pos{color:#666;font-size:9px;margin-top:2px}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e0e8f0;font-size:8px;color:#888;text-align:center}
`

function buildHeader(docTitle, subtitle) {
  return `
<div class="document">
  <div class="hdr">
    <div>
      <div class="cn">${esc(COMPANY.name)}</div>
      <div class="cd">${esc(COMPANY.tagline)}<br/>${esc(COMPANY.address)}<br/>Tel: ${esc(COMPANY.phone1)} | ${esc(COMPANY.email)}</div>
    </div>
    <div class="logo-fb">${esc(COMPANY.initials)}</div>
  </div>
  <div class="ac"></div>
  <div class="bd">
    <div class="dt">${esc(docTitle)}</div>
    <div class="ds">${esc(subtitle)}</div>`
}

function buildFooter() {
  return `
    <div class="footer">${esc(COMPANY.name)} | Reg: ${esc(COMPANY.registration)} | ${esc(COMPANY.website)}</div>
  </div>
</div>`
}

function metaGrid(pairs) {
  return `<div class="meta">${pairs.map(([l, v]) =>
    `<div class="meta-cell"><div class="meta-lbl">${esc(l)}</div><div class="meta-val">${esc(v || '—')}</div></div>`,
  ).join('')}</div>`
}

function summaryBlock(calculations) {
  return `
<div class="sec">Variation Summary</div>
<div class="sum-row"><span>Total Additions</span><span>${ghs(calculations.totalAdditions)}</span></div>
<div class="sum-row"><span>Total Omissions</span><span>− ${ghs(calculations.totalOmissions)}</span></div>
<div class="sum-row"><span>Total Reductions</span><span>− ${ghs(calculations.totalReductions)}</span></div>
<div class="sum-row"><span>Total Increases</span><span>${ghs(calculations.totalIncreases)}</span></div>
<div class="sum-row"><span>Net Variation Amount</span><span>${calculations.netVariation >= 0 ? '' : '− '}${ghs(Math.abs(calculations.netVariation))}</span></div>
<div class="sum-row"><span>Original Estimate Total</span><span>${ghs(calculations.originalEstimateTotal)}</span></div>
<div class="sum-row grand"><span>REVISED CONTRACT / ESTIMATE TOTAL</span><span>${ghs(calculations.revisedTotal)}</span></div>`
}

function additionsSummary(items) {
  const adds = items.filter(i => i.difference > 0 && i.status !== 'rejected')
  if (!adds.length) return '<p style="font-size:10px;color:#666">No additions in this variation.</p>'
  return `<ul style="font-size:10px;line-height:1.6;padding-left:16px">${adds.map(i =>
    `<li>${esc(i.description)} — ${ghs(i.difference)}</li>`,
  ).join('')}</ul>`
}

function omissionsSummary(items) {
  const omits = items.filter(i => i.difference < 0 && i.status !== 'rejected')
  if (!omits.length) return '<p style="font-size:10px;color:#666">No omissions or reductions in this variation.</p>'
  return `<ul style="font-size:10px;line-height:1.6;padding-left:16px">${omits.map(i =>
    `<li>${esc(i.description)} — ${ghs(Math.abs(i.difference))}</li>`,
  ).join('')}</ul>`
}

function fullItemTable(items, detailed = true) {
  if (!items.length) return '<p style="font-size:10px">No variation items.</p>'

  if (!detailed) {
    return `<table class="data"><thead><tr>
      <th>#</th><th>Description</th><th>Type</th><th class="num">Difference</th><th>Status</th>
    </tr></thead><tbody>${items.map(i => `<tr>
      <td>${i.itemNo}</td>
      <td>${esc(i.description)}</td>
      <td>${esc(CHANGE_TYPE_LABELS[i.changeType] || i.changeType)}</td>
      <td class="num">${i.difference >= 0 ? '' : '−'}${ghs(Math.abs(i.difference))}</td>
      <td>${esc(ITEM_STATUS_LABELS[i.status] || i.status)}</td>
    </tr>`).join('')}</tbody></table>`
  }

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
    <td class="num">${ghs(i.originalRate)}</td>
    <td class="num">${ghs(i.revisedRate)}</td>
    <td class="num">${ghs(i.originalAmount)}</td>
    <td class="num">${ghs(i.revisedAmount)}</td>
    <td class="num">${i.difference >= 0 ? '' : '−'}${ghs(Math.abs(i.difference))}</td>
    <td>${esc(i.reason)}</td>
    <td>${esc(ITEM_STATUS_LABELS[i.status] || i.status)}</td>
    <td>${esc(i.notes)}</td>
  </tr>`).join('')}</tbody></table>`
}

function signatureBlock() {
  return `
<div class="sig">
  <div>
    <div class="sig-box">Client Authorised Signature</div>
    <div class="pos">Name &amp; Date</div>
  </div>
  <div>
    <div class="sig-box">${esc(COMPANY.authorizedBy)} — ${esc(COMPANY.position)}</div>
    <div class="pos">${esc(COMPANY.name)} | Date</div>
  </div>
</div>`
}

/** Build client-facing variation quotation HTML. */
export function buildClientVariationHTML(vo, calculations) {
  const body = `
${buildHeader('VARIATION QUOTATION', vo.variationNumber || 'Variation Order')}
${metaGrid([
  ['Original Estimate Ref', vo.originalEstimateRef],
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Location', vo.projectLocation],
  ['Date', fmtDate(vo.date)],
  ['Variation No.', vo.variationNumber],
])}
<div class="sec">Reason for Variation</div>
<div class="notes">${esc(vo.reasonForVariation || 'As instructed by client.').replace(/\n/g, '<br/>')}</div>
<div class="sec">Summary of Additions</div>
${additionsSummary(vo.items)}
<div class="sec">Summary of Omissions / Reductions</div>
${omissionsSummary(vo.items)}
${summaryBlock(calculations)}
<div class="sec">Payment &amp; Approval</div>
<div class="notes">${esc(vo.paymentNote || 'This variation is subject to written client approval before additional works commence.')}</div>
${signatureBlock()}
${buildFooter()}`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(vo.variationNumber)} — Variation Quotation</title><style>${BASE_STYLES}</style></head><body>${body}</body></html>`
}

/** Build internal QS detailed variation schedule HTML. */
export function buildInternalVariationHTML(vo, calculations) {
  const auditHtml = (vo.auditTrail || []).length ? `
<div class="sec">Audit Trail</div>
<table class="data"><thead><tr><th>Date/Time</th><th>Action</th><th>Detail</th></tr></thead>
<tbody>${vo.auditTrail.map(e => `<tr>
  <td>${esc(new Date(e.at).toLocaleString())}</td>
  <td>${esc(e.action)}</td>
  <td>${esc(e.detail)}</td>
</tr>`).join('')}</tbody></table>` : ''

  const body = `
${buildHeader('INTERNAL QS VARIATION SCHEDULE', vo.variationNumber || 'Variation Order')}
${metaGrid([
  ['Original Estimate Ref', vo.originalEstimateRef],
  ['Original Estimate ID', vo.originalEstimateId],
  ['Project ID', vo.projectId],
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Date', fmtDate(vo.date)],
  ['Status', vo.status],
])}
<div class="sec">Reason for Variation</div>
<div class="notes">${esc(vo.reasonForVariation || '—').replace(/\n/g, '<br/>')}</div>
<div class="sec">Detailed Variation Line Items</div>
${fullItemTable(vo.items, true)}
${summaryBlock(calculations)}
<div class="sec">Assumptions &amp; Notes</div>
<div class="notes">Original estimate preserved as issued. This variation is recorded separately as ${esc(vo.variationNumber)}. All amounts in GHS unless stated otherwise.</div>
${auditHtml}
${buildFooter()}`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(vo.variationNumber)} — Internal Schedule</title><style>${BASE_STYLES}</style></head><body>${body}</body></html>`
}

/** Build revised full estimate combining original snapshot + variations. */
export function buildRevisedEstimateHTML(vo, calculations) {
  const originalRows = (vo.originalBoqSnapshot || []).map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.itemRef || r.section)}</td>
    <td>${esc(r.desc)}</td>
    <td>${esc(r.qty)}</td>
    <td>${esc(r.unit)}</td>
    <td class="num">${ghs(r.rate)}</td>
    <td class="num">${ghs(r.amount)}</td>
    <td>Original</td>
  </tr>`).join('')

  const variationRows = vo.items.filter(i => i.status !== 'rejected').map(i => `<tr>
    <td>V${i.itemNo}</td>
    <td>${esc(i.originalItemRef)}</td>
    <td>${esc(i.description)}</td>
    <td>${esc(i.revisedQty || i.originalQty)}</td>
    <td>${esc(i.unit)}</td>
    <td class="num">${ghs(i.revisedRate || i.originalRate)}</td>
    <td class="num">${ghs(i.revisedAmount)}</td>
    <td>${esc(CHANGE_TYPE_LABELS[i.changeType] || i.changeType)}</td>
  </tr>`).join('')

  const body = `
${buildHeader('REVISED FULL ESTIMATE', `${vo.originalEstimateRef} + ${vo.variationNumber}`)}
${metaGrid([
  ['Client', vo.clientName],
  ['Project', vo.projectName],
  ['Location', vo.projectLocation],
  ['Original Ref', vo.originalEstimateRef],
  ['Variation', vo.variationNumber],
  ['Date', fmtDate(vo.date)],
])}
<div class="sec">Original Estimate Items (Preserved)</div>
<table class="data"><thead><tr>
  <th>#</th><th>Ref</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th><th>Status</th>
</tr></thead><tbody>${originalRows || '<tr><td colspan="8">No original items snapshot</td></tr>'}</tbody></table>
<div class="sec">Variation Adjustments</div>
<table class="data"><thead><tr>
  <th>#</th><th>Ref</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th><th>Change</th>
</tr></thead><tbody>${variationRows || '<tr><td colspan="8">No variation items</td></tr>'}</tbody></table>
${summaryBlock(calculations)}
${buildFooter()}`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(vo.variationNumber)} — Revised Estimate</title><style>${BASE_STYLES}</style></head><body>${body}</body></html>`
}

/** Build addendum to original estimate. */
export function buildAddendumHTML(vo, calculations) {
  const body = `
${buildHeader('ADDENDUM TO ORIGINAL ESTIMATE', vo.variationNumber || 'Variation Addendum')}
${metaGrid([
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
<div class="sec">Client Instruction</div>
<div class="notes">${esc(vo.reasonForVariation || '—').replace(/\n/g, '<br/>')}</div>
<div class="sec">Variation Schedule</div>
${fullItemTable(vo.items, false)}
${summaryBlock(calculations)}
<div class="sec">Approval</div>
<div class="notes">${esc(vo.paymentNote || 'Approved variations to be confirmed in writing before execution.')}</div>
${signatureBlock()}
${buildFooter()}`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(vo.variationNumber)} — Addendum</title><style>${BASE_STYLES}</style></head><body>${body}</body></html>`
}

export function buildVariationExportHTML(vo, exportType, calculations) {
  switch (exportType) {
    case 'client_quotation': return buildClientVariationHTML(vo, calculations)
    case 'internal_schedule': return buildInternalVariationHTML(vo, calculations)
    case 'revised_estimate': return buildRevisedEstimateHTML(vo, calculations)
    case 'addendum': return buildAddendumHTML(vo, calculations)
    default: return buildClientVariationHTML(vo, calculations)
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
