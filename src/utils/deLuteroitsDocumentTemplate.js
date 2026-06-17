/**
 * DE-LUTEROITS CONSTRUCTION — canonical export document template.
 * Design standard: VO-006-addendum reference (navy header, red accents, grey meta cards).
 * All HTML / PDF / DOCX exports must use this module — do not duplicate styles elsewhere.
 */

import { COMPANY } from './constants.js'

/** Exact stylesheet from VO-006-addendum reference — do not modify without design approval. */
export const DELUTEROITS_DOCUMENT_STYLES = `
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
table.data tr.section-row td{background:#eef2f8;font-weight:700;color:#0A2A43}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:10.5px}
.sum-row.grand{background:#0A2A43;color:#FCD34D;padding:10px 12px;border-radius:5px;margin-top:6px;font-weight:800}
.notes{font-size:10px;line-height:1.55;padding:10px;background:#fafbfc;border:1px solid #e0e8f0;border-radius:4px}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}
.sig-box{border-top:1px solid #333;padding-top:6px;font-size:10px}
.pos{color:#666;font-size:9px;margin-top:2px}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e0e8f0;font-size:8px;color:#888;text-align:center}
.export-section{margin-bottom:14px}
.scope{background:#f4f7fb;border-left:3px solid #0A2A43;padding:10px 12px;margin-bottom:14px;font-size:10.5px;line-height:1.55}
@media print{html,body{background:#fff;margin:0}.document{margin:0;box-shadow:none;width:100%}table.data thead{display:table-header-group}}
`

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return String(d)
  }
}

function parseAmount(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Positive GHS amount — e.g. GHS 3,880.00 */
export function ghsAmount(v) {
  const n = parseAmount(v)
  if (n == null) return '—'
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Table difference column — negative: −GHS 14,500.00 (no space) */
export function ghsTableDiff(v) {
  const n = parseAmount(v)
  if (n == null) return '—'
  const formatted = n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `−GHS ${formatted.replace(/^-/, '')}` : `GHS ${formatted}`
}

/** Summary row negative — e.g. − GHS 148,003.00 (space after minus) */
export function ghsSummaryNeg(v) {
  const n = parseAmount(v)
  if (n == null) return '—'
  return `− GHS ${Math.abs(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Summary row signed net variation */
export function ghsSummarySigned(v) {
  const n = parseAmount(v)
  if (n == null) return '—'
  if (n < 0) return ghsSummaryNeg(n)
  return ghsAmount(n)
}

export function buildCompanyHeader(company = COMPANY) {
  return `
  <div class="hdr">
    <div>
      <div class="cn">${esc(company.name)}</div>
      <div class="cd">${esc(company.tagline)}<br/>${esc(company.address)}<br/>Tel: ${esc(company.phone1)} | ${esc(company.email)}</div>
    </div>
    <div class="logo-fb">${esc(company.initials || 'DLC')}</div>
  </div>
  <div class="ac"></div>`
}

export function buildDocumentTitle(title, subtitle) {
  return `
    <div class="dt">${esc(title)}</div>
    <div class="ds">${esc(subtitle || '')}</div>`
}

export function buildMetaGrid(pairs) {
  return `<div class="meta">${pairs.map(([l, v]) =>
    `<div class="meta-cell"><div class="meta-lbl">${esc(l)}</div><div class="meta-val">${esc(v || '—')}</div></div>`,
  ).join('')}</div>`
}

export function buildSection(title) {
  return `<div class="sec">${esc(title)}</div>`
}

export function buildNotesBox(content, extraStyle = '') {
  const html = typeof content === 'string'
    ? esc(content).replace(/\n/g, '<br/>')
    : content
  return `<div class="notes"${extraStyle ? ` style="${extraStyle}"` : ''}>${html}</div>`
}

export function buildDataTable(headers, rows) {
  const head = headers.map(h => {
    if (typeof h === 'string') return `<th${h === 'Difference' || h.endsWith('Amt') || h === 'Amount' || h === 'Rate' || h === 'Qty' ? ' class="num"' : ''}>${esc(h)}</th>`
    return `<th${h.class ? ` class="${h.class}"` : ''}>${esc(h.label)}</th>`
  }).join('')
  const body = rows.map(row => `<tr>${row.map((cell, i) => {
    const hdr = headers[i]
    const cls = (typeof hdr === 'object' && hdr.class) || (typeof hdr === 'string' && /amt|amount|rate|qty|difference|diff/i.test(hdr) ? 'num' : '')
    const val = cell == null ? '' : (typeof cell === 'number' ? String(cell) : cell)
    return `<td${cls ? ` class="${cls}"` : ''}>${typeof val === 'string' && val.includes('<') ? val : esc(val)}</td>`
  }).join('')}</tr>`).join('')
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

export function buildVariationSummaryBlock(calculations) {
  const c = calculations || {}
  return `
${buildSection('Variation Summary')}
<div class="sum-row"><span>Total Additions</span><span>${ghsAmount(c.totalAdditions)}</span></div>
<div class="sum-row"><span>Total Omissions</span><span>${ghsSummaryNeg(c.totalOmissions)}</span></div>
<div class="sum-row"><span>Total Reductions</span><span>${ghsSummaryNeg(c.totalReductions)}</span></div>
<div class="sum-row"><span>Total Increases</span><span>${ghsAmount(c.totalIncreases)}</span></div>
<div class="sum-row"><span>Net Variation Amount</span><span>${ghsSummarySigned(c.netVariation)}</span></div>
<div class="sum-row"><span>Original Estimate Total</span><span>${ghsAmount(c.originalEstimateTotal)}</span></div>
<div class="sum-row grand"><span>REVISED CONTRACT / ESTIMATE TOTAL</span><span>${ghsAmount(c.revisedTotal)}</span></div>`
}

export function buildApprovalSignatureBlock(paymentNote) {
  return `
${buildSection('Approval')}
${buildNotesBox(paymentNote || 'This variation is subject to client written approval before commencement of additional works.')}
${buildSignatureBlock()}`
}

export function buildSignatureBlock(company = COMPANY) {
  return `
<div class="sig">
  <div>
    <div class="sig-box">Client Authorised Signature</div>
    <div class="pos">Name &amp; Date</div>
  </div>
  <div>
    <div class="sig-box">${esc(company.authorizedBy)} — ${esc(company.position)}</div>
    <div class="pos">${esc(company.name)} | Date</div>
  </div>
</div>`
}

export function buildDocumentFooter(company = COMPANY) {
  return `<div class="footer">${esc(company.name)} | Reg: ${esc(company.registration)} | ${esc(company.website)}</div>`
}

/**
 * Wrap body content in the full DE-LUTEROITS document shell.
 * @param {{ pageTitle: string, docTitle: string, subtitle: string, bodyHtml: string, company?: object }} opts
 */
export function wrapDeLuteroitsDocument({ pageTitle, docTitle, subtitle, bodyHtml, company = COMPANY }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(pageTitle)}</title><style>${DELUTEROITS_DOCUMENT_STYLES}</style></head><body>
<div class="document">
${buildCompanyHeader(company)}
  <div class="bd">
${buildDocumentTitle(docTitle, subtitle)}
${bodyHtml}
${buildDocumentFooter(company)}
  </div>
</div></body></html>`
}

/** Commercial summary rows for estimates / quotations */
export function buildCommercialSummaryBlock(summaryRows, grandTotal, grandLabel = 'FINAL CONTRACT SUM') {
  const rows = (summaryRows || []).filter(a => a.layer && !a.bold)
  if (!rows.length && !grandTotal) return ''
  return `
${buildSection('Commercial Summary')}
${rows.map(a => `<div class="sum-row"><span>${esc(a.layer)}</span><span>${a.isDeduction ? ghsSummaryNeg(a.amount) : ghsAmount(a.amount)}</span></div>`).join('')}
<div class="sum-row grand"><span>${esc(grandLabel)}</span><span>${ghsAmount(grandTotal)}</span></div>`
}
