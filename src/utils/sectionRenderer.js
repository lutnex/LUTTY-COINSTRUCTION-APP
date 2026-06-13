import { fmtN, fmtDate, validUntil } from './formatters.js'
import {
  hasPaymentTerms,
  paymentTermsToHtml,
  paymentTermsToPlainText,
} from './paymentTerms.js'
import {
  groupMaterialsByCategory,
  categorySubtotal,
  materialsGrandTotal,
  normalizeMaterialState,
} from './materialCategories.js'
import {
  getEnabledSections,
  sanitizeRichHtml,
  stripHtml,
} from './documentSections.js'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ghs(v) {
  const n = parseFloat(v)
  return isFinite(n) ? `GHS ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
}

function richSectionHtml(title, html) {
  const body = sanitizeRichHtml(html || '')
  if (!stripHtml(body).trim()) return ''
  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2><div class="notes">${body}</div></section>`
}

function buildBoqHtml(d) {
  if (!d.boqRows?.length && !d.boqCategorySummaries?.length) return ''

  if (d.presentationStyle === 'premium' && d.boqCategorySummaries?.length) {
    const rows = d.boqCategorySummaries.map(g => `<tr>
      <td><strong>${esc(g.section)}</strong><br><span style="font-size:11px;color:#6E84A3">${esc(g.summaryDesc)}</span></td>
      <td class="num"><strong>${ghs(g.subtotal)}</strong></td></tr>`).join('')
    return `<section class="export-section"><h2 class="sec">Premium Quotation Summary</h2>
      <table class="data"><thead><tr><th>Category</th><th>Amount (GHS)</th></tr></thead><tbody>${rows}</tbody></table></section>`
  }

  let rows = ''
  let cs = ''
  const visible = d.boqRows.filter(r => !r.hideInPremium && r.supplyType !== 'excluded' && !r.excluded)
  for (const r of visible) {
    if (r.section && r.section !== cs) {
      cs = r.section
      rows += `<tr class="section-row"><td colspan="6">${esc(cs.toUpperCase())}</td></tr>`
    }
    const spec = r.specification ? `<br><span style="font-size:11px;color:#6E84A3">${esc(r.specification)}</span>` : ''
    const flags = [
      r.clientSupplied || r.supplyType === 'client-supplied' ? 'CLIENT SUPPLY' : null,
      r.supplyType === 'provisional' || r.provisional ? 'PROVISIONAL' : null,
      r.supplyType === 'optional' || r.optional ? 'OPTIONAL' : null,
      r.priceSource === 'assumption' ? 'ASSUMPTION' : null,
    ].filter(Boolean).join(' · ')
    rows += `<tr>
      <td>${esc(r.desc)}${spec}${flags ? `<br><em style="font-size:10px">${esc(flags)}</em>` : ''}</td>
      <td>${esc(r.unit)}</td>
      <td class="num">${esc(r.qty || '—')}</td>
      <td class="num">${r.clientSupplied ? '—' : ghs(r.rate)}</td>
      <td class="num ${r.clientSupplied ? 'client' : ''}">${r.clientSupplied ? 'CLIENT SUPPLY' : ghs(r.amount)}</td>
      <td>${esc(r.itemRef || '')}</td></tr>`
  }
  return `<section class="export-section"><h2 class="sec">Bill of Quantities</h2>
    <table class="data"><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Ref</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

function buildMaterialsHtml(d, title) {
  const { categories, materials } = normalizeMaterialState(d.materials || [], d.matCategories || [])
  const groups = groupMaterialsByCategory(categories, materials).filter(g => g.items.length > 0)
  if (!groups.length) return ''
  let rows = ''
  for (const { category, items } of groups) {
    rows += `<tr class="section-row"><td colspan="5">${esc(category.name.toUpperCase())}</td></tr>`
    for (const r of items) {
      rows += `<tr><td>${esc(r.desc)}</td><td>${esc(r.unit)}</td><td class="num">${esc(r.qty)}</td>
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
    <table class="data"><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

function buildLaborHtml(d, title) {
  if (!d.labor?.length) return ''
  const rows = d.labor.map(r => `<tr><td>${esc(r.trade)}</td><td>${esc(r.desc)}</td><td class="num">${esc(r.qty)}</td>
    <td class="num">${ghs(r.rate)}</td><td class="num">${ghs(r.amount)}</td></tr>`).join('')
  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2>
    <table class="data"><thead><tr><th>Trade</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

function buildPrelimsHtml(d, title) {
  if (!d.prelims?.length) return ''
  const rows = d.prelims.map(r => `<tr><td>${esc(r.item)}</td><td class="num">${ghs(r.amount)}</td></tr>`).join('')
  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2>
    <table class="data"><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

function buildCommercialHtml(d, title, grand, audit) {
  const summaryRows = (audit || []).filter(a => a.layer && !a.bold)
  if (!(grand > 0 || summaryRows.length)) return ''
  return `<section class="export-section commercial-block"><h2 class="sec">${esc(title)}</h2>
    ${summaryRows.map(a => `<div class="sum-row"><span>${esc(a.layer)}</span><span>${a.isDeduction ? '− ' : ''}${ghs(a.amount)}</span></div>`).join('')}
    <div class="sum-row grand"><span>FINAL CONTRACT SUM</span><span>${ghs(grand)}</span></div></section>`
}

function buildClientInfoHtml(meta, title) {
  const cells = [
    ['Reference', meta.quoteNum],
    ['Date issued', fmtDate(meta.date)],
    ['Valid until', validUntil(meta.date, meta.validDays)],
    ['Client', meta.clientName],
    ['Contact', meta.clientContact],
    ['Email', meta.clientEmail],
    ['Location', meta.projectLocation],
  ].map(([l, v]) => `<div class="meta-cell"><div class="meta-lbl">${esc(l)}</div><div class="meta-val">${esc(v || '—')}</div></div>`).join('')
  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2><div class="meta">${cells}</div></section>`
}

function buildPaymentHtml(meta, title) {
  const html = paymentTermsToHtml(meta.paymentTerms)
  if (!html) return ''
  return `<section class="export-section"><h2 class="sec">${esc(title)}</h2><div class="notes payment-terms">${html}</div></section>`
}

export function renderSectionHtml(section, d, { grand, audit } = {}) {
  const title = section.title
  switch (section.type) {
    case 'client_info':
      return buildClientInfoHtml(d.meta || {}, title)
    case 'project_scope':
    case 'takeoff':
    case 'assumptions':
    case 'exclusions':
    case 'provisional':
    case 'optional_items':
    case 'client_supplied':
    case 'notes':
    case 'custom':
      return richSectionHtml(title, section.html)
    case 'boq':
      return d.boqRows?.length ? buildBoqHtml(d).replace('Bill of Quantities', esc(title)) : ''
    case 'materials':
      return buildMaterialsHtml(d, title)
    case 'labor':
      return buildLaborHtml(d, title)
    case 'prelims':
      return buildPrelimsHtml(d, title)
    case 'commercial':
      return buildCommercialHtml(d, title, grand, audit)
    case 'payment_terms':
      return buildPaymentHtml(d.meta || {}, title)
    default:
      return richSectionHtml(title, section.html)
  }
}

export function renderSectionPlainText(section, d, { grand, audit } = {}) {
  const title = section.title
  switch (section.type) {
    case 'client_info': {
      const m = d.meta || {}
      return `${title}\nReference: ${m.quoteNum || '—'}\nClient: ${m.clientName || '—'}\nLocation: ${m.projectLocation || '—'}`
    }
    case 'project_scope':
    case 'takeoff':
    case 'assumptions':
    case 'exclusions':
    case 'provisional':
    case 'optional_items':
    case 'client_supplied':
    case 'notes':
    case 'custom':
      return stripHtml(section.html) ? `${title}\n${stripHtml(section.html)}` : ''
    case 'boq':
      return d.boqRows?.length ? `${title}\n[BOQ table]` : ''
    case 'materials':
      return d.materials?.length ? `${title}\n[Materials table]` : ''
    case 'labor':
      return d.labor?.length ? `${title}\n[Labour table]` : ''
    case 'prelims':
      return d.prelims?.length ? `${title}\n[Preliminaries]` : ''
    case 'commercial':
      return grand > 0 ? `${title}\nFINAL CONTRACT SUM: GHS ${fmtN(grand)}` : ''
    case 'payment_terms': {
      const t = paymentTermsToPlainText(d.meta?.paymentTerms)
      return t ? `${title}\n${t}` : ''
    }
    default:
      return stripHtml(section.html) ? `${title}\n${stripHtml(section.html)}` : ''
  }
}

export function buildOrderedSectionsHtml(d, totals) {
  const sections = getEnabledSections(d.documentSections)
  if (!sections.length) return ''
  return sections.map(s => renderSectionHtml(s, d, totals)).filter(Boolean).join('')
}

export function isSectionTypeEnabled(sections, type) {
  return getEnabledSections(sections).some(s => s.type === type)
}

export function shouldExportLegacyField(sections, type) {
  if (!sections?.length) return false
  return isSectionTypeEnabled(sections, type)
}
