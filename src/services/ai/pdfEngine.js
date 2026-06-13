import { COMPANY, DOC_TYPES } from '../../utils/constants.js'
import { fmtN, fmtDate, validUntil } from '../../utils/formatters.js'
import { resolveLogoUrl, getDefaultLogoDataUrl } from '../../utils/logoStore.js'
import { computePricing } from '../pricing/pricingEngine.js'
import {
  hasPaymentTerms,
  paymentTermsToHtml,
  paymentTermsToPlainText,
} from '../../utils/paymentTerms.js'
import {
  groupMaterialsByCategory,
  categorySubtotal,
  materialsGrandTotal,
  normalizeMaterialState,
} from '../../utils/materialCategories.js'
import { normalizeDocumentSections, getEnabledSections, stripHtml } from '../../utils/documentSections.js'
import { buildOrderedSectionsHtml } from '../../utils/sectionRenderer.js'

const LOG_PREFIX = '[pdf-export]'

function exportLog(stage, detail) {
  const payload = detail === undefined ? '' : detail
  console.log(`${LOG_PREFIX}[${stage}]`, payload)
}

let jsPDFReady = false

async function ensureJsPDF() {
  if (jsPDFReady || window.jspdf) { jsPDFReady = true; return true }
  exportLog('pdf-generation', 'Loading jsPDF + autoTable libraries…')
  return new Promise(resolve => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
      s2.onload = () => { jsPDFReady = true; exportLog('pdf-generation', 'jsPDF libraries ready'); resolve(true) }
      s2.onerror = () => { exportLog('pdf-generation', 'autoTable failed to load'); resolve(false) }
      document.head.appendChild(s2)
    }
    s.onerror = () => { exportLog('pdf-generation', 'jsPDF failed to load'); resolve(false) }
    document.head.appendChild(s)
  })
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ghs(v) {
  const n = parseFloat(v)
  return isFinite(n) ? `GHS ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
}

function enrichExportData(data, logoUrl) {
  return {
    ...data,
    logoUrl: logoUrl || data.logoUrl || resolveLogoUrl(),
    exportedAt: data.exportedAt || new Date().toISOString(),
    company: { ...COMPANY, ...(data.company || {}) },
  }
}

function computeTotals(data) {
  if (data.pricing?.layers?.finalEstimate != null) {
    const p = data.pricing
    return {
      matTotal: (data.materials || []).reduce((s, r) => s + (r.clientSupply ? 0 : parseFloat(r.amount) || 0), 0),
      boqTotal: (data.boqRows || []).reduce((s, r) => s + (r.clientSupplied ? 0 : parseFloat(r.amount) || 0), 0),
      labTotal: (data.labor || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
      preTotal: (data.prelims || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
      works: p.layers.rawWorks || p.summary.sub,
      grand: p.layers.finalEstimate,
      audit: p.audit || [],
    }
  }

  const pricing = computePricing({
    boqRows: data.boqRows,
    materials: data.materials,
    labor: data.labor,
    prelims: data.prelims,
    financialAdjustments: data.financialAdjustments,
  })

  return {
    matTotal: (data.materials || []).reduce((s, r) => s + (r.clientSupply ? 0 : parseFloat(r.amount) || 0), 0),
    boqTotal: (data.boqRows || []).reduce((s, r) => s + (r.clientSupplied ? 0 : parseFloat(r.amount) || 0), 0),
    labTotal: (data.labor || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    preTotal: (data.prelims || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    works: pricing.layers.rawWorks,
    grand: pricing.layers.finalEstimate,
    audit: pricing.audit,
  }
}

/** Compare preview HTML section markers with export data (debug / validation). */
export function validateExportDocument(data, html) {
  const errors = []
  const d = enrichExportData(data)
  const text = html || ''

  const required = [
    [d.company.name, 'company letterhead'],
    [DOC_TYPES[d.type] || 'CONSTRUCTION', 'document title'],
    ['Prepared by', 'signature block'],
  ]

  if (hasPaymentTerms(d.meta?.paymentTerms) && !text.includes('Payment Terms')) {
    errors.push('Missing: payment terms')
  }

  for (const [needle, label] of required) {
    if (needle && !text.includes(needle)) errors.push(`Missing: ${label}`)
  }

  if (d.boqRows?.length && !text.includes('Bill of Quantities')) errors.push('Missing: BOQ section')
  if (d.materials?.length && !text.includes('Materials') && !text.includes('Material')) errors.push('Missing: materials')
  if (d.labor?.length && !text.includes('Labour')) errors.push('Missing: labour')
  if (d.prelims?.length && !text.includes('Preliminaries')) errors.push('Missing: preliminaries')

  const { grand, audit } = computeTotals(d)
  if ((grand > 0 || audit?.length) && !text.includes('Commercial Summary')) {
    errors.push('Missing: commercial summary')
  }

  return { ok: errors.length === 0, errors }
}

function buildTableRows(rows, cols) {
  return rows.map(r => `<tr>${cols.map(c => c(r)).join('')}</tr>`).join('')
}

function resolveMaterialGroups(data) {
  const { categories, materials } = normalizeMaterialState(data.materials || [], data.matCategories || [])
  return groupMaterialsByCategory(categories, materials).filter(g => g.items.length > 0)
}

function buildGroupedMaterialsHtml(data, title) {
  const groups = resolveMaterialGroups(data)
  if (!groups.length) return ''

  let rows = ''
  for (const { category, items } of groups) {
    rows += `<tr class="section-row"><td colspan="5">${esc(category.name.toUpperCase())}</td></tr>`
    for (const r of items) {
      rows += `<tr>
        <td>${esc(r.desc)}</td><td>${esc(r.unit)}</td><td class="num">${esc(r.qty)}</td>
        <td class="num">${r.clientSupply ? '—' : ghs(r.rate)}</td>
        <td class="num">${r.clientSupply ? 'CLIENT' : ghs(r.amount)}</td></tr>`
    }
    rows += `<tr class="subtotal-row"><td colspan="4"><strong>Subtotal — ${esc(category.name)}</strong></td>
      <td class="num"><strong>${ghs(categorySubtotal(items))}</strong></td></tr>`
  }
  const grand = materialsGrandTotal(groups.flatMap(g => g.items))
  rows += `<tr class="grand-row"><td colspan="4"><strong>TOTAL MATERIAL COST</strong></td>
    <td class="num"><strong>${ghs(grand)}</strong></td></tr>`

  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2>
    <table class="data"><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`
}

function buildGroupedMaterialsPdfBody(data) {
  const groups = resolveMaterialGroups(data)
  if (!groups.length) return []

  const body = []
  for (const { category, items } of groups) {
    body.push([{
      content: category.name.toUpperCase(),
      colSpan: 5,
      styles: { fontStyle: 'bold', fillColor: [238, 242, 248] },
    }])
    for (const r of items) {
      body.push([
        r.desc || '',
        r.unit || '',
        r.qty || '',
        r.clientSupply ? '—' : fmtN(parseFloat(r.rate)),
        r.clientSupply ? 'CLIENT' : fmtN(parseFloat(r.amount)),
      ])
    }
    body.push([
      { content: `Subtotal — ${category.name}`, colSpan: 4, styles: { fontStyle: 'bold' } },
      { content: fmtN(categorySubtotal(items)), styles: { fontStyle: 'bold', halign: 'right' } },
    ])
  }
  const grand = materialsGrandTotal(groups.flatMap(g => g.items))
  body.push([
    { content: 'TOTAL MATERIAL COST', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [10, 42, 67], textColor: 255 } },
    { content: fmtN(grand), styles: { fontStyle: 'bold', halign: 'right', fillColor: [10, 42, 67], textColor: 255 } },
  ])
  return body
}

export function buildDocumentHTML(data, logoUrl) {
  const d = enrichExportData(data, logoUrl)
  const logo = d.logoUrl || getDefaultLogoDataUrl()
  const { grand, audit } = computeTotals(d)
  const meta = d.meta || {}
  const docTitle = DOC_TYPES[d.type] || 'CONSTRUCTION DOCUMENT'
  const ts = new Date(d.exportedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const initials = esc(d.company.initials || 'DLC')
  const paymentTermsHtml = paymentTermsToHtml(meta.paymentTerms)
  const documentSections = d.documentSections?.length
    ? d.documentSections
    : normalizeDocumentSections(null, {
      meta,
      extras: { drawingAnalysis: d.drawingAnalysis, assumptions: d.assumptions, exclusions: d.exclusions },
    })
  const orderedBodyHtml = buildOrderedSectionsHtml({ ...d, meta, documentSections }, { grand, audit })

  let boqHtml = ''
  if (d.boqRows?.length) {
    let rows = ''
    let cs = ''
    for (const r of d.boqRows) {
      if (r.section && r.section !== cs) {
        cs = r.section
        rows += `<tr class="section-row"><td colspan="5">${esc(cs.toUpperCase())}</td></tr>`
      }
      rows += `<tr><td>${esc(r.desc)}</td><td>${esc(r.unit)}</td><td class="num">${esc(r.qty || '—')}</td>
        <td class="num">${r.clientSupplied ? '—' : ghs(r.rate)}</td>
        <td class="num ${r.clientSupplied ? 'client' : ''}">${r.clientSupplied ? 'CLIENT SUPPLY' : ghs(r.amount)}</td></tr>`
    }
    boqHtml = `<section class="export-section"><h2 class="sec">Bill of Quantities</h2>
      <table class="data"><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></section>`
  }

  const matsHtml = buildGroupedMaterialsHtml(
    d,
    d.boqRows?.length ? 'Materials Breakdown' : 'Materials Schedule',
  )

  const laborHtml = d.labor?.length ? `
    <section class="export-section"><h2 class="sec">Labour Breakdown</h2>
    <table class="data"><thead><tr><th>Trade</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${buildTableRows(d.labor, [
      r => `<td>${esc(r.trade)}</td>`,
      r => `<td>${esc(r.desc)}</td>`,
      r => `<td class="num">${esc(r.qty)}</td>`,
      r => `<td class="num">${ghs(r.rate)}</td>`,
      r => `<td class="num">${ghs(r.amount)}</td>`,
    ])}</tbody></table></section>` : ''

  const prelimsHtml = d.prelims?.length ? `
    <section class="export-section"><h2 class="sec">Preliminaries</h2>
    <table class="data"><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.prelims.map(r => `<tr><td>${esc(r.item)}</td><td class="num">${ghs(r.amount)}</td></tr>`).join('')}</tbody></table></section>` : ''

  const risksHtml = d.risks?.length ? `
    <section class="export-section"><h2 class="sec">Risk Register</h2>
    <table class="data"><thead><tr><th>Risk</th><th>Rating</th><th>Mitigation</th></tr></thead>
    <tbody>${d.risks.map(r => `<tr><td>${esc(r.risk || r.desc)}</td><td>${esc(r.rating)}</td><td>${esc(r.mitigation)}</td></tr>`).join('')}</tbody></table></section>` : ''

  const procHtml = d.procurement?.length ? `
    <section class="export-section"><h2 class="sec">Procurement Schedule</h2>
    <table class="data"><thead><tr><th>Material</th><th>Qty</th><th>Supplier</th><th>Lead time</th><th>Status</th></tr></thead>
    <tbody>${d.procurement.map(r => `<tr><td>${esc(r.material || r.desc)}</td><td>${esc(r.quantity)} ${esc(r.unit)}</td>
      <td>${esc(r.supplier)}</td><td>${esc(r.leadTime)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></section>` : ''

  const variationHtml = d.variations?.length ? `
    <section class="export-section"><h2 class="sec">Variation Items</h2>
    <table class="data"><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.variations.map(r => `<tr><td>${esc(r.desc)}</td><td class="num">${ghs(r.amount)}</td></tr>`).join('')}</tbody></table></section>` : ''

  const summaryRows = (audit || []).filter(a => a.layer && !a.bold)

  const takeoffHtml = d.drawingAnalysis?.takeoffNotes ? `
    <section class="export-section"><h2 class="sec">Drawing &amp; Document Takeoff</h2>
    <div class="scope">${esc(d.drawingAnalysis.takeoffNotes).replace(/\n/g, '<br/>')}</div></section>` : ''

  const assumptionsHtml = d.assumptions?.length ? `
    <section class="export-section"><h2 class="sec">Assumptions</h2>
    <div class="notes"><ul>${d.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></section>` : ''

  const exclusionsHtml = d.exclusions?.length ? `
    <section class="export-section"><h2 class="sec">Exclusions &amp; Clarifications</h2>
    <div class="notes"><ul>${d.exclusions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></section>` : ''

  const metaCells = [
    ['Reference', meta.quoteNum],
    ['Date issued', fmtDate(meta.date)],
    ['Valid until', validUntil(meta.date, meta.validDays)],
    ['Client', meta.clientName],
    ['Contact', meta.clientContact],
    ['Email', meta.clientEmail],
    ['Location', meta.projectLocation],
  ].map(([l, v]) => `<div class="meta-cell"><div class="meta-lbl">${esc(l)}</div><div class="meta-val">${esc(v || '—')}</div></div>`).join('')

  const executiveHtml = meta.executiveSummary ? `
    <section class="export-section"><h2 class="sec">Executive Summary</h2>
    <div class="scope">${esc(meta.executiveSummary).replace(/\n/g, '<br/>')}</div></section>` : ''

  const scopeHtml = meta.projectDescription ? `
    <section class="export-section"><h2 class="sec">Scope of Works</h2>
    <div class="scope">${esc(meta.projectDescription).replace(/\n/g, '<br/>')}</div></section>` : ''

  const commercialHtml = (grand > 0 || summaryRows.length) ? `
    <section class="export-section commercial-block">
      <h2 class="sec">Commercial Summary</h2>
      ${summaryRows.map(a => `<div class="sum-row"><span>${esc(a.layer)}</span><span>${a.isDeduction ? '− ' : ''}${ghs(a.amount)}</span></div>`).join('')}
      <div class="sum-row grand"><span>FINAL CONTRACT SUM</span><span>${ghs(grand)}</span></div>
    </section>` : ''

  const paymentHtml = paymentTermsHtml ? `
    <section class="export-section"><h2 class="sec">Payment Terms</h2>
    <div class="notes payment-terms">${paymentTermsHtml}</div></section>` : ''

  const notesHtml = ''

  const legacyBodyHtml = ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${esc(docTitle)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:Helvetica,Arial,sans-serif;background:#e8ecf2;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.document{width:210mm;min-height:297mm;background:#fff;margin:12px auto;box-shadow:0 4px 20px rgba(0,0,0,.1)}
.hdr{background:#0A2A43;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.cn{font-size:15px;font-weight:800;color:#fff}
.cd{font-size:9px;color:rgba(255,255,255,.75);line-height:1.5;margin-top:5px}
.logo-wrap{width:50px;height:50px;flex-shrink:0;background:#fff;border-radius:7px;padding:3px;display:flex;align-items:center;justify-content:center}
.logo-wrap img{max-width:100%;max-height:100%;object-fit:contain}
.logo-fb{width:44px;height:44px;background:#B00020;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff}
.ac{height:3px;background:linear-gradient(90deg,#B00020,#0A2A43)}
.bd{padding:24px 28px 32px}
.dt{font-size:19px;font-weight:800;color:#0A2A43}
.ds{font-size:11px;color:#B00020;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:6px 0 14px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:16px}
.meta-cell{background:#f4f7fb;border:1px solid #d0d8e8;padding:7px 9px;border-radius:4px}
.meta-lbl{font-size:8px;font-weight:700;color:#B00020;text-transform:uppercase}
.meta-val{font-size:10px;font-weight:700;color:#0A2A43;margin-top:2px}
.scope{background:#f4f7fb;border-left:3px solid #0A2A43;padding:10px 12px;margin-bottom:14px;font-size:10.5px;line-height:1.55}
.export-section{margin-bottom:14px}
.sec{font-size:11px;font-weight:800;color:#0A2A43;text-transform:uppercase;margin:16px 0 7px;border-bottom:2px solid #B00020;padding-bottom:3px}
table.data{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}
table.data thead tr{background:#0A2A43}
table.data th{padding:7px 9px;text-align:left;font-size:8.5px;color:#fff;text-transform:uppercase}
table.data td{padding:6px 9px;border-bottom:1px solid #e0e8f0;vertical-align:top}
table.data tr.section-row td{background:#eef2f8;font-weight:700;color:#0A2A43}
table.data tr.subtotal-row td{background:#f8fafc;font-weight:700;color:#0A2A43;border-top:1px solid #d0d8e8}
table.data tr.grand-row td{background:#0A2A43;color:#FCD34D;font-weight:800}
table.data td.num{text-align:right}
table.data td.client{color:#B00020;font-weight:600}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:10.5px}
.sum-row.grand{background:#0A2A43;color:#FCD34D;padding:10px 12px;border-radius:5px;margin-top:6px;font-weight:800}
.notes{font-size:10px;line-height:1.55;padding:10px;background:#fafbfc;border:1px solid #e0e8f0;border-radius:4px}
.notes ul{margin:0;padding-left:16px}
.ftr{background:#0A2A43;padding:9px 28px;display:flex;justify-content:space-between;font-size:8.5px;color:rgba(255,255,255,.85);margin-top:20px}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px;padding-top:14px;border-top:1px solid #ddd}
.sig-lbl{font-size:8px;font-weight:700;color:#B00020;text-transform:uppercase}
.sig-box{height:44px;background:#eee;border-radius:4px;margin:6px 0}
@media print{html,body{background:#fff;margin:0}.document{margin:0;box-shadow:none;width:100%}table.data thead{display:table-header-group}}
</style></head><body>
<div class="document" id="export-document-root">
  <div class="hdr">
    <div><div class="cn">${esc(d.company.name)}</div><div class="cd">${esc(d.company.address)}<br/>Reg: ${esc(d.company.registration)}<br/>
    ${esc(d.company.phone1)} · ${esc(d.company.email)}<br/>${esc(d.company.website)}</div></div>
    <div class="logo-wrap"><img src="${logo}" alt="Logo" onerror="this.outerHTML='<div class=logo-fb>${initials}</div>'"/></div>
  </div>
  <div class="ac"></div>
  <div class="bd">
    <div class="dt">${esc(docTitle)}</div>
    <div class="ds">${esc(meta.projectTitle || 'Construction Project')}</div>
    ${orderedBodyHtml}
    <div class="sig">
      <div><div class="sig-lbl">Prepared by</div><div class="sig-box"></div><div style="font-size:9px">${esc(d.company.authorizedBy)} — ${esc(d.company.position)}</div></div>
      <div><div class="sig-lbl">Client acceptance</div><div class="sig-box"></div><div style="font-size:9px">${esc(meta.clientName || 'Client')}</div></div>
    </div>
  </div>
  <div class="ftr"><span>${esc(d.company.name)} · ${esc(d.company.registration)}</span><span>Generated: ${esc(ts)}</span></div>
</div></body></html>`
}

export function generateHTMLFallback(data, logoUrl) {
  return buildDocumentHTML(data, logoUrl)
}

/**
 * jsPDF + autoTable export (original working engine).
 * Renders the same document sections as buildDocumentHTML — no canvas capture.
 */
export async function generatePDF(data, logoUrl) {
  if (!await ensureJsPDF() || !window.jspdf) return null

  const d = enrichExportData(data, logoUrl)
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210
  const ML = 15
  const MR = 195
  const BW = MR - ML
  let y = 0
  const logo = d.logoUrl
  const meta = d.meta || {}
  const { grand, audit } = computeTotals(d)
  const paymentTermsText = paymentTermsToPlainText(meta.paymentTerms)

  exportLog('pdf-generation', {
    boqRows: d.boqRows?.length || 0,
    materials: d.materials?.length || 0,
    labor: d.labor?.length || 0,
    prelims: d.prelims?.length || 0,
  })

  const drawHdr = () => {
    doc.setFillColor(10, 42, 67)
    doc.rect(0, 0, PW, 30, 'F')
    doc.setFillColor(176, 0, 32)
    doc.rect(0, 30, PW, 2.5, 'F')
    try {
      if (logo?.startsWith('data:image')) {
        const fmt = logo.includes('image/png') ? 'PNG' : logo.includes('svg') ? 'SVG' : 'JPEG'
        doc.addImage(logo, fmt, PW - 30, 5, 22, 22)
      } else {
        throw new Error('no inline logo')
      }
    } catch {
      doc.setFillColor(176, 0, 32)
      doc.roundedRect(PW - 28, 5, 20, 20, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(d.company.initials || 'DLC', PW - 18, 17, { align: 'center' })
    }
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(d.company.name, ML, 12)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`${d.company.address} | Reg: ${d.company.registration}`, ML, 18)
    doc.text(`${d.company.phone1} | ${d.company.email}`, ML, 23)
  }

  const drawFtr = (p, total) => {
    doc.setFillColor(10, 42, 67)
    doc.rect(0, 285, PW, 12, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(`${d.company.name} | ${d.company.registration}`, ML, 292)
    const ts = new Date(d.exportedAt).toLocaleString('en-GB')
    doc.text(`Page ${p}/${total} · ${ts}`, MR, 292, { align: 'right' })
  }

  const chk = (n) => {
    if (y + n > 275) { doc.addPage(); drawHdr(); y = 38 }
  }

  const secHdr = (title) => {
    chk(12)
    doc.setFillColor(247, 249, 252)
    doc.rect(ML, y, BW, 8, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(10, 42, 67)
    doc.text(title.toUpperCase(), ML + 4, y + 5.5)
    y += 11
  }

  const bodyText = (text, fontSize = 8.5) => {
    if (!text?.trim()) return
    chk(10)
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(text.trim(), BW)
    for (const line of lines) {
      chk(5)
      doc.text(line, ML, y)
      y += 4.2
    }
    y += 3
  }

  const autoTable = (head, body, title) => {
    if (!body?.length) return
    secHdr(title)
    doc.autoTable({
      startY: y,
      head: [head],
      body,
      margin: { left: ML, right: PW - MR, top: 38, bottom: 20 },
      headStyles: { fillColor: [10, 42, 67], fontSize: 8, textColor: 255 },
      bodyStyles: { fontSize: 8, textColor: 30 },
      styles: { overflow: 'linebreak', cellWidth: 'wrap' },
      showHead: 'everyPage',
      didDrawPage: () => { drawHdr(); y = 38 },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  drawHdr()
  y = 37

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(10, 42, 67)
  doc.text(DOC_TYPES[d.type] || 'DOCUMENT', ML, y + 7)
  y += 12
  doc.setFontSize(9)
  doc.setTextColor(176, 0, 32)
  doc.text((meta.projectTitle || 'Project').toUpperCase(), ML, y)
  y += 10

  const documentSections = d.documentSections?.length
    ? d.documentSections
    : normalizeDocumentSections(null, {
      meta,
      extras: { drawingAnalysis: d.drawingAnalysis, assumptions: d.assumptions, exclusions: d.exclusions },
    })

  for (const section of getEnabledSections(documentSections)) {
    switch (section.type) {
      case 'client_info': {
        secHdr(section.title)
        bodyText([
          `Reference: ${meta.quoteNum || '—'}`,
          `Date issued: ${fmtDate(meta.date)}`,
          `Valid until: ${validUntil(meta.date, meta.validDays)}`,
          `Client: ${meta.clientName || '—'}`,
          `Contact: ${meta.clientContact || '—'}`,
          `Email: ${meta.clientEmail || '—'}`,
          `Location: ${meta.projectLocation || '—'}`,
        ].join('\n'))
        break
      }
      case 'project_scope':
      case 'takeoff':
      case 'assumptions':
      case 'exclusions':
      case 'notes':
      case 'custom': {
        const text = stripHtml(section.html)
        if (text) { secHdr(section.title); bodyText(text) }
        break
      }
      case 'boq':
        if (d.boqRows?.length) {
          const body = []
          let cs = ''
          for (const row of d.boqRows) {
            if (row.section !== cs) {
              cs = row.section
              body.push([{ content: cs.toUpperCase(), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 242, 248] } }])
            }
            body.push([
              row.desc || '', row.unit || '', row.qty || '—',
              row.clientSupplied ? '—' : fmtN(parseFloat(row.rate)),
              row.clientSupplied ? 'CLIENT' : fmtN(parseFloat(row.amount)),
            ])
          }
          autoTable(['Description', 'Unit', 'Qty', 'Rate', 'Amount'], body, section.title)
        }
        break
      case 'materials': {
        const matBody = buildGroupedMaterialsPdfBody(d)
        if (matBody.length) autoTable(['Description', 'Unit', 'Qty', 'Rate', 'Amount'], matBody, section.title)
        break
      }
      case 'labor':
        if (d.labor?.length) {
          autoTable(
            ['Trade', 'Description', 'Qty', 'Rate', 'Amount'],
            d.labor.map(r => [r.trade || '', r.desc || '', r.qty || '', fmtN(parseFloat(r.rate)), fmtN(parseFloat(r.amount))]),
            section.title,
          )
        }
        break
      case 'prelims':
        if (d.prelims?.length) {
          autoTable(['Item', 'Amount'], d.prelims.map(r => [r.item || '', fmtN(parseFloat(r.amount))]), section.title)
        }
        break
      case 'commercial': {
        const summaryRows = (audit || []).filter(a => a.layer && !a.bold)
        if (summaryRows.length || grand > 0) {
          secHdr(section.title)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(30, 30, 30)
          for (const row of summaryRows) {
            chk(7)
            const label = row.layer || ''
            const val = row.isDeduction ? `- GHS ${fmtN(row.amount)}` : `GHS ${fmtN(row.amount)}`
            doc.text(label, ML + 2, y)
            doc.text(val, MR - 2, y, { align: 'right' })
            y += 6
          }
          chk(14)
          doc.setFillColor(10, 42, 67)
          doc.rect(ML, y - 2, BW, 10, 'F')
          doc.setTextColor(252, 211, 77)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text('FINAL CONTRACT SUM', ML + 4, y + 5)
          doc.text(`GHS ${fmtN(grand)}`, MR - 4, y + 5, { align: 'right' })
          y += 14
        }
        break
      }
      case 'payment_terms':
        if (paymentTermsText) { secHdr(section.title); bodyText(paymentTermsText) }
        break
      default:
        break
    }
  }

  chk(35)
  secHdr('Signatures')
  doc.setFontSize(8)
  doc.setTextColor(176, 0, 32)
  doc.text('PREPARED BY', ML, y)
  doc.text('CLIENT ACCEPTANCE', ML + BW / 2 + 5, y)
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.rect(ML, y, BW / 2 - 5, 14)
  doc.rect(ML + BW / 2 + 5, y, BW / 2 - 5, 14)
  y += 18
  doc.setFontSize(8)
  doc.setTextColor(30, 30, 30)
  doc.text(d.company.authorizedBy || '', ML, y)
  doc.text(meta.clientName || 'Client', ML + BW / 2 + 5, y)

  const totalPages = doc.internal.getNumberOfPages()
  exportLog('pdf-generation', `Rendered ${totalPages} page(s)`)
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFtr(p, totalPages)
  }

  return doc.output('arraybuffer')
}

export async function printDocument(data, logoUrl) {
  exportLog('dom-rendering', 'Building preview HTML for print…')
  const html = buildDocumentHTML(data, logoUrl)
  const win = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100')
  if (!win) throw new Error('Print blocked — allow popups for this site')

  win.document.open()
  win.document.write(html)
  win.document.close()

  return new Promise((resolve, reject) => {
    const doPrint = () => {
      try {
        win.focus()
        win.print()
        exportLog('dom-rendering', 'Print dialog opened')
        resolve(true)
      } catch (e) {
        reject(e)
      }
    }
    if (win.document.readyState === 'complete') {
      setTimeout(doPrint, 500)
    } else {
      win.onload = () => setTimeout(doPrint, 500)
    }
  })
}

export async function downloadPDF(data, filename, onProgress, logoUrl) {
  onProgress?.('Preparing document…')
  const logo = logoUrl || resolveLogoUrl()
  const enriched = enrichExportData(data, logo)

  exportLog('dom-rendering', 'Building preview HTML for parity check…')
  const previewHtml = buildDocumentHTML(enriched, logo)
  const validation = validateExportDocument(enriched, previewHtml)
  if (!validation.ok) {
    exportLog('dom-rendering', { warning: 'Preview/HTML section gaps', errors: validation.errors })
  } else {
    exportLog('dom-rendering', 'Preview HTML contains all expected sections')
  }

  try {
    onProgress?.('Generating PDF…')
    exportLog('pdf-generation', 'Starting jsPDF autoTable export (no canvas capture)')
    const bytes = await generatePDF(enriched, logo)
    if (bytes) {
      onProgress?.('Saving PDF…')
      exportLog('file-saving', { filename, bytes: bytes.byteLength })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      triggerDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
      return { ok: true, method: 'pdf' }
    }
    exportLog('pdf-generation', 'jsPDF returned null — falling back to HTML')
  } catch (e) {
    exportLog('pdf-generation', { error: e.message })
    console.error(`${LOG_PREFIX} PDF generation failed:`, e)
  }

  onProgress?.('Saving print-ready HTML…')
  exportLog('file-saving', 'HTML fallback download')
  const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' })
  triggerDownload(blob, filename.replace(/\.pdf$/i, '.html'))
  return {
    ok: true,
    method: 'html',
    message: 'PDF engine unavailable — HTML document downloaded. Open it and use Print → Save as PDF.',
  }
}

export async function printPDF(data, logoUrl) {
  return printDocument(data, logoUrl)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 8000)
}
