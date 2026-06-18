/**
 * Count line items in document export data and generated HTML for parity validation.
 */

import {
  groupMaterialsByCategory,
  normalizeMaterialState,
} from './materialCategories.js'
import { getEnabledSections, normalizeDocumentSectionsForExport } from './documentSections.js'
import { hasPaymentTerms } from './paymentTerms.js'

function getExportSections(d) {
  if (d.documentSections?.length) {
    return getEnabledSections(d.documentSections)
  }
  return getEnabledSections(normalizeDocumentSectionsForExport(null, {
    meta: d.meta,
    extras: {
      drawingAnalysis: d.drawingAnalysis,
      assumptions: d.assumptions,
      exclusions: d.exclusions,
      provisional: d.provisional,
      optionalItems: d.optionalItems,
      clientSuppliedItems: d.clientSuppliedItems,
    },
    sourceText: d.sourceText,
    hasBoq: d.boqRows?.length > 0,
  }))
}

function sectionTypeEnabled(sections, type) {
  return sections.some(s => s.type === type)
}

function visibleBoqRows(boqRows = [], presentationStyle, boqCategorySummaries) {
  if (presentationStyle === 'premium' && boqCategorySummaries?.length) {
    return []
  }
  return boqRows.filter(r => !r.hideInPremium && r.supplyType !== 'excluded' && !r.excluded)
}

function resolveMaterialGroups(data) {
  const { categories, materials } = normalizeMaterialState(data.materials || [], data.matCategories || [])
  return groupMaterialsByCategory(categories, materials).filter(g => g.items.length > 0)
}

/**
 * Count exportable rows from the full Document Generator state (same rules as sectionRenderer).
 */
export function countDocumentExportItems(data) {
  const d = data || {}
  const exportSections = getExportSections(d)
  const matGroups = sectionTypeEnabled(exportSections, 'materials') ? resolveMaterialGroups(d) : []
  const boqRows = sectionTypeEnabled(exportSections, 'boq')
    ? visibleBoqRows(d.boqRows, d.presentationStyle, d.boqCategorySummaries)
    : []
  const boqCategories = new Set(boqRows.map(r => r.section || 'General')).size
  const materialCategories = matGroups.length
  const materialRows = matGroups.reduce((sum, g) => sum + g.items.length, 0)
  const laborRows = sectionTypeEnabled(exportSections, 'labor') ? (d.labor || []).length : 0
  const prelimRows = sectionTypeEnabled(exportSections, 'prelims') ? (d.prelims || []).length : 0
  const variationRows = (d.variations || []).length
  const premiumSummaryRows = d.presentationStyle === 'premium' && d.boqCategorySummaries?.length
    ? d.boqCategorySummaries.length
    : 0

  const boqLineItems = premiumSummaryRows || boqRows.length
  const totalCategories = materialCategories + (boqRows.length ? boqCategories : 0)
  const totalLineItems = materialRows + laborRows + prelimRows + variationRows + boqLineItems

  const sections = exportSections
  const hasPayment = sectionTypeEnabled(exportSections, 'payment_terms') && hasPaymentTerms(d.meta?.paymentTerms)

  return {
    totalCategories,
    materialRows,
    materialCategories,
    laborRows,
    prelimRows,
    variationRows,
    boqRows: boqLineItems,
    boqCategories,
    premiumSummaryRows,
    totalLineItems,
    enabledSections: sections.length,
    hasAssumptions: Boolean(d.assumptions?.length || sections.some(s => s.type === 'assumptions' && stripSectionHtml(s.html))),
    hasExclusions: Boolean(d.exclusions?.length || sections.some(s => s.type === 'exclusions' && stripSectionHtml(s.html))),
    hasPaymentTerms: hasPayment,
    hasSignatureMarkers: true,
  }
}

function stripSectionHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim()
}

/**
 * Count table body rows in export HTML (data rows vs structural rows).
 */
export function countHtmlExportItems(html) {
  if (!html?.trim()) {
    return { dataRows: 0, sectionRows: 0, subtotalRows: 0, totalTableRows: 0 }
  }

  let doc
  if (typeof DOMParser !== 'undefined') {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } else {
    return countHtmlExportItemsRegex(html)
  }

  let dataRows = 0
  let sectionRows = 0
  let subtotalRows = 0
  let totalTableRows = 0

  for (const tr of doc.querySelectorAll('table.data tbody tr')) {
    totalTableRows += 1
    if (tr.classList.contains('section-row')) {
      sectionRows += 1
    } else if (tr.classList.contains('subtotal-row') || tr.classList.contains('grand-row')) {
      subtotalRows += 1
    } else {
      dataRows += 1
    }
  }

  return {
    dataRows,
    sectionRows,
    subtotalRows,
    totalTableRows,
    hasCommercialSummary: html.includes('FINAL CONTRACT SUM') || html.includes('Commercial Summary'),
    hasPaymentTerms: html.includes('Payment Terms'),
    hasSignature: html.includes('Prepared by') || html.includes('Client Authorised') || html.includes('sig-box'),
    hasAssumptions: /Assumptions/i.test(html),
    hasExclusions: /Exclusions/i.test(html),
  }
}

function countHtmlExportItemsRegex(html) {
  const rows = html.match(/<tr[\s>]/gi) || []
  const sectionRows = (html.match(/class="section-row"/gi) || []).length
  const subtotalRows = (html.match(/class="(?:subtotal-row|grand-row)"/gi) || []).length
  return {
    dataRows: Math.max(0, rows.length - sectionRows - subtotalRows),
    sectionRows,
    subtotalRows,
    totalTableRows: rows.length,
    hasCommercialSummary: html.includes('FINAL CONTRACT SUM'),
    hasPaymentTerms: html.includes('Payment Terms'),
    hasSignature: html.includes('sig-box'),
    hasAssumptions: /Assumptions/i.test(html),
    hasExclusions: /Exclusions/i.test(html),
  }
}

/**
 * Compare model counts with HTML counts before PDF capture.
 */
export function validateExportItemParity(data, html) {
  const model = countDocumentExportItems(data)
  const rendered = countHtmlExportItems(html)
  const errors = []

  if (model.totalLineItems > 0 && rendered.dataRows < model.totalLineItems) {
    errors.push(
      `Line items: HTML has ${rendered.dataRows} data rows but document state has ${model.totalLineItems}`,
    )
  }

  if (model.materialRows > 0 && rendered.dataRows === 0 && !html.includes('Materials')) {
    errors.push('Materials section missing from export HTML')
  }
  if (model.laborRows > 0 && !html.includes('Labour')) {
    errors.push('Labour section missing from export HTML')
  }
  if (model.prelimRows > 0 && !html.includes('Preliminaries')) {
    errors.push('Preliminaries section missing from export HTML')
  }
  if (model.variationRows > 0 && !html.includes('Variation') && !html.includes('Revision')) {
    errors.push('Variation section missing from export HTML')
  }
  if (model.hasPaymentTerms && !rendered.hasPaymentTerms) {
    errors.push('Payment terms missing from export HTML')
  }

  return {
    ok: errors.length === 0,
    errors,
    model,
    rendered,
  }
}

export const EXPORT_INCOMPLETE_MESSAGE = 'PDF export incomplete. Some document items were not included.'
