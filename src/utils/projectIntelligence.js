import { today } from './formatters.js'
import { normalizeBoqRow } from './boqItemFactory.js'
import { computePricing } from '../services/pricing/pricingEngine.js'
import { resolveInitialPaymentTerms, normalizePaymentTerms } from './paymentTerms.js'
import { normalizeMaterialState } from './materialCategories.js'

export const INTELLIGENCE_STORAGE_KEY = 'constructiq-project-intelligence'

export function emptyProjectData() {
  return {
    client: { name: '', contact: '', email: '' },
    projectInfo: {
      title: '',
      location: '',
      description: '',
      quoteNum: '',
      date: today(),
      validDays: '30',
      notes: '',
    },
    drawingAnalysis: {
      takeoffNotes: '',
      roomSchedule: [],
      dimensions: [],
      finishes: [],
      specifications: [],
    },
    boqItems: [],
    materials: [],
    matCategories: [],
    labor: [],
    assumptions: [],
    exclusions: [],
    provisional: [],
    risks: [],
    collections: [],
    pricing: null,
    summaries: { commercial: '' },
    financialAdjustments: null,
    metadata: { source: null, updatedAt: null, version: 1 },
  }
}

/** Merge AI extract + optional patch into project intelligence. */
export function mergeExtractIntoProjectData(prev, extract, { replaceBoq = false } = {}) {
  const base = prev ? { ...prev } : emptyProjectData()
  if (!extract) return base

  const incomingRows = Array.isArray(extract.boqRows) ? extract.boqRows : []
  const baseItems = Array.isArray(base.boqItems) ? base.boqItems : []
  const boqItems = (replaceBoq ? incomingRows : [...baseItems, ...incomingRows])
    .map((r, i) => normalizeBoqRow({ ...r, source: 'ai' }, i))

  const dedupe = []
  const seen = new Set()
  for (const r of boqItems) {
    const key = `${r.section}|${r.desc}`.toLowerCase()
    if (seen.has(key) && r.source === 'ai') continue
    seen.add(key)
    dedupe.push(r)
  }

  const pricing = computePricing({
    boqRows: dedupe,
    materials: extract.materials?.length ? extract.materials : base.materials,
    labor: extract.labor?.length ? extract.labor : base.labor,
    financialAdjustments: base.financialAdjustments,
  })

  const notesParts = []
  if (extract.assumptions?.length) notesParts.push('ASSUMPTIONS:\n' + extract.assumptions.join('\n'))
  if (extract.exclusions?.length) notesParts.push('EXCLUSIONS:\n' + extract.exclusions.join('\n'))
  if (extract.takeoffNotes) notesParts.push('DRAWING TAKEOFF:\n' + extract.takeoffNotes)

  return {
    ...base,
    client: {
      ...base.client,
      name: base.client.name || extract.clientName || '',
    },
    projectInfo: {
      ...base.projectInfo,
      title: extract.projectTitle || base.projectInfo.title,
      description: extract.projectScope || extract.takeoffNotes || base.projectInfo.description,
      location: extract.projectLocation || base.projectInfo.location,
      notes: notesParts.join('\n\n') || base.projectInfo.notes,
    },
    drawingAnalysis: {
      ...base.drawingAnalysis,
      takeoffNotes: extract.takeoffNotes || base.drawingAnalysis.takeoffNotes,
    },
    boqItems: dedupe,
    materials: extract.materials?.length
      ? normalizeMaterialState(
        extract.materials.map((m, i) => ({ ...m, id: m.id ?? Date.now() + i })),
        extract.matCategories?.length ? extract.matCategories : base.matCategories,
      ).materials
      : base.materials,
    matCategories: extract.materials?.length
      ? normalizeMaterialState(extract.materials, extract.matCategories || base.matCategories).categories
      : (base.matCategories || []),
    labor: extract.labor?.length ? extract.labor.map((l, i) => ({ ...l, id: l.id ?? Date.now() + i })) : base.labor,
    assumptions: extract.assumptions?.length ? extract.assumptions : base.assumptions,
    exclusions: extract.exclusions?.length ? extract.exclusions : base.exclusions,
    provisional: extract.provisional?.length ? extract.provisional : base.provisional,
    risks: extract.risks?.length ? extract.risks : base.risks,
    collections: extract.collections?.length ? extract.collections : base.collections,
    pricing,
    summaries: {
      commercial: extract.contractSum
        ? `Contract sum: GHS ${Number(extract.contractSum).toLocaleString('en')}`
        : base.summaries.commercial,
    },
    metadata: {
      ...base.metadata,
      source: 'ai-chat',
      updatedAt: new Date().toISOString(),
    },
  }
}

/** Build DocGen / PDF payload from unified project data. */
export function projectDataToDocPayload(data, { docType = 'boq', source = 'intelligence' } = {}) {
  if (!data) return null
  const p = data.pricing || computePricing({
    boqRows: data.boqItems,
    materials: data.materials,
    labor: data.labor,
    financialAdjustments: data.financialAdjustments,
  })

  return {
    version: 1,
    source,
    transferredAt: data.metadata?.updatedAt || new Date().toISOString(),
    docType,
    meta: {
      quoteNum: data.projectInfo.quoteNum || `DLC-${today().replace(/-/g, '')}`,
      date: data.projectInfo.date || today(),
      validDays: data.projectInfo.validDays || '30',
      clientName: data.client.name || '',
      clientContact: data.client.contact || '',
      clientEmail: data.client.email || '',
      projectLocation: data.projectInfo.location || '',
      projectTitle: data.projectInfo.title || 'Construction Project',
      projectDescription: data.projectInfo.description || '',
      notes: data.projectInfo.notes || '',
      paymentTerms: data.projectInfo.paymentTerms != null
        ? normalizePaymentTerms(data.projectInfo.paymentTerms)
        : resolveInitialPaymentTerms(null),
    },
    boqRows: data.boqItems,
    ...(() => {
      const matNorm = normalizeMaterialState(data.materials || [], data.matCategories || [])
      return {
        matCategories: matNorm.categories,
        materials: matNorm.materials.length ? matNorm.materials : undefined,
      }
    })(),
    labor: data.labor || [],
    prelims: p.prelimsForDoc || [],
    risks: data.risks || [],
    assumptions: data.assumptions || [],
    exclusions: data.exclusions || [],
    provisional: data.provisional || [],
    optionalItems: (data.boqItems || []).filter(r => r.supplyType === 'optional' || r.optional),
    clientSuppliedItems: (data.boqItems || []).filter(r => r.clientSupplied || r.supplyType === 'client-supplied'),
    drawingAnalysis: data.drawingAnalysis || {},
    collections: data.collections || [],
    pricing: p,
    financialAdjustments: data.financialAdjustments,
    workflow: data.workflow || null,
    presentationStyle: data.workflow?.presentationStyle || data.presentationStyle || 'detailed',
    contractSum: p.layers.finalEstimate,
    totals: p.summary,
  }
}

export function saveIntelligence(data) {
  try {
    localStorage.setItem(INTELLIGENCE_STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('[intelligence] save failed', e)
    return false
  }
}

export function loadIntelligence() {
  try {
    const raw = localStorage.getItem(INTELLIGENCE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.boqItems) {
      data.boqItems = Array.isArray(data.boqItems)
        ? data.boqItems.map((r, i) => normalizeBoqRow(r, i))
        : []
    }
    if (!Array.isArray(data.assumptions)) data.assumptions = []
    if (!Array.isArray(data.exclusions)) data.exclusions = []
    if (!Array.isArray(data.provisional)) data.provisional = []
    return data
  } catch {
    return null
  }
}

export function projectToIntelligence(project) {
  if (!project) return emptyProjectData()
  const base = mergeExtractIntoProjectData(emptyProjectData(), {
    boqRows: project.boqRows || [],
    risks: project.risks || [],
    contractSum: project.contractSum,
    projectTitle: project.meta?.projectTitle || project.name,
    projectScope: project.meta?.projectDescription,
    projectLocation: project.meta?.projectLocation,
    clientName: project.meta?.clientName,
  }, { replaceBoq: true })
  if (project.meta?.paymentTerms != null) {
    base.projectInfo.paymentTerms = normalizePaymentTerms(project.meta.paymentTerms)
  }
  return base
}

export function intelligenceToProjectPatch(data) {
  return {
    boqRows: data.boqItems || [],
    risks: data.risks || [],
    contractSum: data.pricing?.layers?.finalEstimate || 0,
    meta: {
      clientName: data.client?.name,
      clientContact: data.client?.contact,
      clientEmail: data.client?.email,
      projectLocation: data.projectInfo?.location,
      projectTitle: data.projectInfo?.title,
      projectDescription: data.projectInfo?.description,
      notes: data.projectInfo?.notes,
      paymentTerms: data.projectInfo?.paymentTerms,
    },
    materials: data.materials || [],
    matCategories: data.matCategories || [],
    labor: data.labor || [],
    prelims: data.pricing?.prelimsForDoc || [],
    intelligence: data,
  }
}
