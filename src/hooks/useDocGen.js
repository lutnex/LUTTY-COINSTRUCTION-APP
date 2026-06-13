import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { today } from '../utils/formatters.js'
import { hydrateBOQDocument, loadDocGenDraft, persistDocGenState, clearDocGenDraft } from '../utils/boqWorkflow.js'
import { computePricing } from '../services/pricing/pricingEngine.js'
import { normalizeBoqRow } from '../utils/boqItemFactory.js'
import {
  loadFinancialAdjustments,
  persistFinancialAdjustments,
  applyPreferenceDefaults,
  createDefaultFinancialAdjustments,
} from '../utils/financialAdjustments.js'
import {
  normalizePaymentTerms,
  resolveInitialPaymentTerms,
} from '../utils/paymentTerms.js'
import {
  createCategory,
  createMaterial,
  findCategoryById,
  findOrCreateCategory,
  insertMaterialAtCategory,
  moveMaterial,
  normalizeMaterialState,
  removeCategoryFromState,
  reorderList,
} from '../utils/materialCategories.js'
import {
  createDefaultSectionLayout,
  createSection,
  normalizeDocumentSections,
  applyAiSuggestionsToSections,
  syncSectionHtmlToMeta,
  reorderSections,
  duplicateSection,
  deleteSection,
  getSectionByType,
  sectionsToLegacyExtras,
  stripHtml,
} from '../utils/documentSections.js'

const DEFAULT_META = {
  quoteNum: 'DLC-2025-001',
  date: today(),
  validDays: '30',
  clientName: '',
  clientContact: '',
  clientEmail: '',
  projectLocation: '',
  projectTitle: '',
  projectDescription: '',
  notes: '',
  paymentTerms: null,
}

export function useDocGen(estimatePreferences = null) {
  const [docType, setDocType]         = useState('estimate')
  const [meta,    setMetaRaw]         = useState(DEFAULT_META)
  const [mats,    setMats]            = useState([])
  const [matCategories, setMatCategories] = useState(() => [createCategory()])
  const [labor,   setLabor]           = useState([])
  const [prelims, setPrelims]         = useState([])
  const [boqRows, setBoqRows]         = useState([])
  const [contractSum, setContractSum] = useState(0)
  const [financialAdjustments, setFinancialAdjustmentsRaw] = useState(() => loadFinancialAdjustments())
  const [preview, setPreview]         = useState(null)
  const [busy,    setBusy]            = useState(false)
  const [transferSource, setTransferSource] = useState(null)
  const [extras, setExtras]           = useState({
    assumptions: [], exclusions: [], provisional: [], optionalItems: [], clientSuppliedItems: [],
    drawingAnalysis: {}, risks: [], pricing: null, workflow: null, presentationStyle: null, boqCategorySummaries: null,
  })
  const [documentSections, setDocumentSectionsRaw] = useState(() => createDefaultSectionLayout())
  const [lastAutoSaved, setLastAutoSaved] = useState(null)
  const [activeSavedDocId, setActiveSavedDocId] = useState(null)
  const hydrated = useRef(false)
  const skipPersist = useRef(false)

  const setMeta = useCallback((key, val) =>
    setMetaRaw(m => ({ ...m, [key]: val })), [])

  const setPaymentTerms = useCallback((next) => {
    setMetaRaw(m => ({
      ...m,
      paymentTerms: typeof next === 'function'
        ? next(normalizePaymentTerms(m.paymentTerms))
        : normalizePaymentTerms(next),
    }))
  }, [])

  const setFinancialAdjustments = useCallback((next) => {
    setFinancialAdjustmentsRaw(next)
  }, [])

  useEffect(() => {
    persistFinancialAdjustments(financialAdjustments)
  }, [financialAdjustments])

  const setDocumentSections = useCallback((next) => {
    setDocumentSectionsRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      return Array.isArray(resolved) ? resolved : prev
    })
  }, [])

  const updateSection = useCallback((id, patch) => {
    setDocumentSectionsRaw(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...patch } : s)
      const updated = next.find(s => s.id === id)
      if (updated && patch.html !== undefined) {
        if (updated.type === 'project_scope') {
          setMetaRaw(m => ({ ...m, projectDescription: stripHtml(updated.html) }))
        }
        if (updated.type === 'notes') {
          setMetaRaw(m => ({ ...m, notes: stripHtml(updated.html) }))
        }
      }
      return next
    })
  }, [])

  const acceptSectionSuggestion = useCallback((id) => {
    setDocumentSectionsRaw(prev => prev.map(s => s.id === id
      ? { ...s, status: 'active', enabled: true }
      : s))
  }, [])

  const removeSection = useCallback((id) => {
    setDocumentSectionsRaw(prev => deleteSection(prev, id))
  }, [])

  const isSectionEnabled = useCallback((type) => {
    return documentSections.some(s => s.type === type && s.enabled && s.status !== 'deleted')
  }, [documentSections])

  const setIntelligenceExtras = useCallback((patch) => {
    setExtras(e => ({ ...e, ...patch }))
    if (patch.assumptions || patch.exclusions || patch.provisional || patch.optionalItems || patch.clientSuppliedItems || patch.drawingAnalysis) {
      setDocumentSectionsRaw(prev => applyAiSuggestionsToSections(prev, {
        assumptions: patch.assumptions,
        exclusions: patch.exclusions,
        provisional: patch.provisional,
        optionalItems: patch.optionalItems,
        clientSuppliedItems: patch.clientSuppliedItems,
        takeoffNotes: patch.drawingAnalysis?.takeoffNotes,
      }))
    }
  }, [])

  const updateMat = useCallback((id, field, val) =>
    setMats(prev => prev.map(r => {
      if (r.id !== id) return r
      const u = { ...r, [field]: val }
      if ((field === 'qty' || field === 'rate') && !u.clientSupply) {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? String(q * rt) : ''
      }
      if (field === 'clientSupply' && val) u.amount = ''
      return u
    })), [])

  const updateBoqRow = useCallback((id, field, val) =>
    setBoqRows(prev => prev.map(r => {
      if (r.id !== id || r.locked) return r
      const u = { ...r, [field]: val }
      if ((field === 'qty' || field === 'rate') && !u.clientSupplied) {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? (q * rt) : ''
      }
      if (field === 'clientSupplied' && val) u.rate = '0'
      return u
    })), [])

  const updateLabor = useCallback((id, field, val) =>
    setLabor(prev => prev.map(r => {
      if (r.id !== id) return r
      const u = { ...r, [field]: val }
      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? String(q * rt) : ''
      }
      return u
    })), [])

  const setMaterialState = useCallback((categories, materials) => {
    const normalized = normalizeMaterialState(materials, categories)
    setMatCategories(normalized.categories)
    setMats(normalized.materials)
  }, [])

  const addMat = useCallback(({ categoryId, categoryName, desc, qty, unit, rate }) => {
    setMatCategories(prevCats => {
      let cats = prevCats
      let resolvedId = categoryId
      if (categoryName) {
        const result = findOrCreateCategory(cats, categoryName)
        cats = result.categories
        resolvedId = result.categoryId
      } else {
        resolvedId = findCategoryById(cats, resolvedId)?.id ?? cats[0]?.id
      }
      const q = parseFloat(qty) || 0
      const rt = parseFloat(rate) || 0
      const mat = createMaterial(resolvedId, {
        desc: desc || '',
        unit: unit || 'nr',
        qty: qty || '',
        rate: rate || '',
        amount: (q && rt) ? String(q * rt) : '',
      })
      setMats(prev => insertMaterialAtCategory(prev, cats, mat))
      return cats
    })
  }, [])

  const addMatCategory = useCallback((name) => {
    setMatCategories(prev => [...prev, createCategory(name)])
  }, [])

  const renameMatCategory = useCallback((id, name) => {
    setMatCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  }, [])

  const deleteMatCategory = useCallback((id) => {
    setMatCategories(prevCats => {
      const { categories, materials } = removeCategoryFromState(prevCats, mats, id)
      setMats(materials)
      return categories
    })
  }, [mats])

  const reorderMatCategories = useCallback((from, to) => {
    setMatCategories(prev => reorderList(prev, from, to))
  }, [])

  const moveMat = useCallback((matId, toCategoryId, toIndex) => {
    setMats(prev => moveMaterial(prev, matCategories, matId, toCategoryId, toIndex))
  }, [matCategories])

  const removeMat = useCallback((id) => setMats(p => p.filter(r => r.id !== id)), [])

  const addLabor    = useCallback(() => setLabor(p => [...p, { id: Date.now(), trade: '', desc: '', unit: 'days', qty: '', rate: '', amount: '' }]), [])
  const removeLabor = useCallback((id) => setLabor(p => p.filter(r => r.id !== id)), [])

  const updatePrelim  = useCallback((id, field, val) => setPrelims(p => p.map(r => r.id === id && !r.locked ? { ...r, [field]: val } : r)), [])
  const addPrelim     = useCallback(() => setPrelims(p => [...p, { id: Date.now(), item: '', amount: '' }]), [])
  const removePrelim  = useCallback((id) => setPrelims(p => p.filter(r => r.id !== id || r.locked)), [])

  const applyBOQTransfer = useCallback((payload) => {
    const ok = hydrateBOQDocument({
      setDocType,
      setMetaRaw,
      setBoqRows,
      setMats,
      setMatCategories,
      setMaterialState,
      setLabor,
      setPrelims,
      setContractSum,
      setIntelligenceExtras,
      setFinancialAdjustments: setFinancialAdjustmentsRaw,
    }, payload)
    if (ok) {
      setTransferSource(payload.source || 'boq-builder')
      if (estimatePreferences && !payload.financialAdjustments) {
        setFinancialAdjustmentsRaw(prev =>
          applyPreferenceDefaults(prev, estimatePreferences)
        )
      }
    }
    return ok
  }, [estimatePreferences])

  const fillFromExtract = useCallback((extract) => {
    if (extract.materials?.length || extract.matCategories?.length) {
      setMaterialState(extract.matCategories || [], extract.materials || [])
    }
    if (extract.boqRows?.length) {
      setBoqRows(extract.boqRows.map((r, i) => normalizeBoqRow(r, i)))
      setDocType('boq')
    }
    if (extract.projectTitle || extract.projectScope) {
      setMetaRaw(m => ({
        ...m,
        projectTitle: extract.projectTitle || m.projectTitle,
        projectDescription: extract.projectScope || m.projectDescription,
        clientName: extract.clientName || m.clientName,
        projectLocation: extract.projectLocation || m.projectLocation,
      }))
    }
    if (extract.labor?.length) setLabor(extract.labor)
    if (extract.contractSum) setContractSum(0)
    setExtras({
      assumptions: extract.assumptions || [],
      exclusions: extract.exclusions || [],
      provisional: extract.provisional || [],
      optionalItems: [],
      clientSuppliedItems: [],
      drawingAnalysis: { takeoffNotes: extract.takeoffNotes || '' },
      risks: extract.risks || [],
      pricing: extract.pricing || null,
      workflow: null,
      presentationStyle: null,
      boqCategorySummaries: null,
    })
    setDocumentSectionsRaw(prev => applyAiSuggestionsToSections(prev, extract))
  }, [])

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const draft = loadDocGenDraft()
    if (draft) {
      hydrateBOQDocument({
        setDocType, setMetaRaw, setBoqRows, setMats, setMatCategories, setMaterialState, setLabor, setPrelims, setContractSum, setIntelligenceExtras,
        setFinancialAdjustments: setFinancialAdjustmentsRaw,
      }, draft)
      if (draft.source) setTransferSource(draft.source)
      if (draft.preview) setPreview(draft.preview)
      if (draft.documentSections?.length) {
        setDocumentSectionsRaw(normalizeDocumentSections(draft.documentSections, { meta: draft.meta, extras: draft }))
      } else {
        setDocumentSectionsRaw(normalizeDocumentSections(null, { meta: draft.meta, extras: draft }))
      }
      setLastAutoSaved(draft.transferredAt || new Date().toISOString())
    } else {
      setMetaRaw(m => ({
        ...m,
        paymentTerms: resolveInitialPaymentTerms(null),
      }))
      setDocumentSectionsRaw(createDefaultSectionLayout())
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current || skipPersist.current) return
    const hasData = boqRows.length > 0 || mats.some(m => m.desc) || meta.projectTitle
    if (!hasData) return
    const t = setTimeout(() => {
      persistDocGenState({ docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections })
      setLastAutoSaved(new Date().toISOString())
    }, 400)
    return () => clearTimeout(t)
  }, [docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections])

  useEffect(() => {
    if (!hydrated.current) return
    const interval = setInterval(() => {
      const hasData = boqRows.length > 0 || mats.some(m => m.desc) || meta.projectTitle
      if (!hasData || skipPersist.current) return
      persistDocGenState({ docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections })
      setLastAutoSaved(new Date().toISOString())
    }, 120000)
    return () => clearInterval(interval)
  }, [docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections])

  const getDocumentSnapshot = useCallback((previewHtml = null) => ({
    version: 1,
    docType,
    meta,
    boqRows,
    materials: mats,
    matCategories,
    labor,
    prelims,
    contractSum,
    financialAdjustments,
    assumptions: extras.assumptions,
    exclusions: extras.exclusions,
    drawingAnalysis: extras.drawingAnalysis,
    risks: extras.risks,
    pricing: extras.pricing,
    previewHtml: previewHtml ?? preview,
    transferSource,
    documentSections,
  }), [docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, financialAdjustments, extras, preview, transferSource, documentSections])

  const loadDocumentSnapshot = useCallback((snapshot, savedDocId = null) => {
    if (!snapshot) return false
    skipPersist.current = true
    hydrateBOQDocument({
      setDocType,
      setMetaRaw,
      setBoqRows,
      setMats,
      setMatCategories,
      setMaterialState,
      setLabor,
      setPrelims,
      setContractSum,
      setIntelligenceExtras,
      setFinancialAdjustments: setFinancialAdjustmentsRaw,
    }, {
      docType: snapshot.docType || 'estimate',
      meta: snapshot.meta,
      boqRows: snapshot.boqRows || [],
      materials: snapshot.materials || [],
      matCategories: snapshot.matCategories || [],
      labor: snapshot.labor || [],
      prelims: snapshot.prelims || [],
      financialAdjustments: snapshot.financialAdjustments,
      assumptions: snapshot.assumptions || [],
      exclusions: snapshot.exclusions || [],
      drawingAnalysis: snapshot.drawingAnalysis || {},
      risks: snapshot.risks || [],
      pricing: snapshot.pricing || null,
      source: snapshot.transferSource || 'saved-document',
      documentSections: snapshot.documentSections,
    })
    if (snapshot.documentSections?.length) {
      setDocumentSectionsRaw(normalizeDocumentSections(snapshot.documentSections, { meta: snapshot.meta, extras: snapshot }))
    }
    setPreview(snapshot.previewHtml || null)
    setTransferSource(snapshot.transferSource || 'saved-document')
    setActiveSavedDocId(savedDocId)
    setTimeout(() => { skipPersist.current = false }, 300)
    return true
  }, [])

  const resetDocument = useCallback(({ newQuoteNum = false } = {}) => {
    skipPersist.current = true
    clearDocGenDraft()
    setDocType('estimate')
    setMetaRaw({
      ...DEFAULT_META,
      quoteNum: newQuoteNum ? `DLC-${Date.now().toString().slice(-6)}` : DEFAULT_META.quoteNum,
      date: today(),
      paymentTerms: resolveInitialPaymentTerms(null),
    })
    setMats([])
    setMatCategories([createCategory()])
    setLabor([])
    setPrelims([])
    setBoqRows([])
    setContractSum(0)
    setFinancialAdjustmentsRaw(createDefaultFinancialAdjustments())
    setPreview(null)
    setTransferSource(null)
    setActiveSavedDocId(null)
    setExtras({ assumptions: [], exclusions: [], drawingAnalysis: {}, risks: [], pricing: null })
    setDocumentSectionsRaw(createDefaultSectionLayout())
    setLastAutoSaved(null)
    setTimeout(() => { skipPersist.current = false }, 300)
  }, [])

  const pricing = useMemo(() => computePricing({
    boqRows,
    materials: mats,
    labor,
    prelims,
    financialAdjustments,
  }), [boqRows, mats, labor, prelims, financialAdjustments])

  const totals = useMemo(() => ({
    ...pricing.summary,
    grand: pricing.layers.finalEstimate,
  }), [pricing])

  const pdfData = useCallback(() => {
    const legacy = sectionsToLegacyExtras(documentSections)
    return {
      type: docType,
      meta: syncSectionHtmlToMeta(documentSections, meta),
      materials: mats,
      matCategories,
      labor,
      prelims,
      boqRows: boqRows.length ? boqRows : [],
      assumptions: legacy.assumptions,
      exclusions: legacy.exclusions,
      provisional: extras.provisional || [],
      optionalItems: extras.optionalItems || [],
      clientSuppliedItems: extras.clientSuppliedItems || [],
      drawingAnalysis: legacy.drawingAnalysis,
      risks: extras.risks,
      pricing,
      financialAdjustments,
      contractSum: pricing.layers.finalEstimate,
      documentSections,
      presentationStyle: extras.presentationStyle,
      boqCategorySummaries: extras.boqCategorySummaries,
      workflow: extras.workflow,
    }
  }, [docType, meta, mats, matCategories, labor, prelims, boqRows, extras, pricing, financialAdjustments, documentSections])

  const hasBOQData = boqRows.length > 0 || mats.some(m => m.desc) || meta.projectTitle?.trim()

  const paymentTerms = normalizePaymentTerms(meta.paymentTerms)

  return {
    docType, setDocType,
    meta, setMeta, setMetaRaw,
    paymentTerms, setPaymentTerms,
    mats, matCategories, updateMat, addMat, addMatCategory, removeMat, setMats, setMatCategories,
    renameMatCategory, deleteMatCategory, reorderMatCategories, moveMat, setMaterialState,
    boqRows, setBoqRows, updateBoqRow,
    labor, updateLabor, addLabor, removeLabor, setLabor,
    prelims, updatePrelim, addPrelim, removePrelim, setPrelims,
    contractSum, setContractSum,
    preview, setPreview,
    busy, setBusy,
    transferSource, setTransferSource,
    extras, setIntelligenceExtras,
    totals, pricing, pdfData, hasBOQData,
    financialAdjustments, setFinancialAdjustments,
    fillFromExtract, applyBOQTransfer,
    resetDocument, loadDocumentSnapshot, getDocumentSnapshot,
    lastAutoSaved, activeSavedDocId, setActiveSavedDocId,
    documentSections, setDocumentSections, updateSection, acceptSectionSuggestion, removeSection,
    isSectionEnabled,
  }
}
