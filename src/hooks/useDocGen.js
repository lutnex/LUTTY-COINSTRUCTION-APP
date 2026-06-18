import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { today } from '../utils/formatters.js'
import { hydrateBOQDocument, loadDocGenDraft, persistDocGenState, clearDocGenDraft } from '../utils/boqWorkflow.js'
import { consolidateExtractForImport } from '../utils/chatExtract.js'
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
import {
  createEmptyVariationDraft,
  loadVariationDraft,
  saveVariationDraft,
  clearVariationDraft,
  nextRevisionNumber,
  REVISED_EXPORT_STYLES,
} from '../utils/docGenVariationTypes.js'
import {
  buildRevisedDocumentPayload,
  computeVariationTotalsWithInclusion,
  normalizeVariationItemForDocGen,
  variationItemsFromExtract,
} from '../utils/variationToDocGen.js'
import { createEmptyVariationItem, normalizeVariationItem } from '../utils/variationOrderTypes.js'
import { applyCalculationsToOrder } from '../utils/variationCalculations.js'
import {
  coerceFieldValue,
  sanitizePatch,
  safeJsonClone,
  isDomOrEvent,
} from '../utils/safeSerialize.js'

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
  const [variationDraft, setVariationDraftRaw] = useState(null)
  const [variationUndoStack, setVariationUndoStack] = useState([])
  const hydrated = useRef(false)
  const skipPersist = useRef(false)

  const setMeta = useCallback((key, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setMetaRaw(m => ({ ...m, [key]: safeVal }))
  }, [])

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

  const updateMat = useCallback((id, field, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setMats(prev => prev.map(r => {
      if (r.id !== id) return r
      const u = { ...r, [field]: safeVal }
      if ((field === 'qty' || field === 'rate') && !u.clientSupply) {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? String(q * rt) : ''
      }
      if (field === 'clientSupply' && safeVal) u.amount = ''
      return u
    }))
  }, [])

  const updateBoqRow = useCallback((id, field, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setBoqRows(prev => prev.map(r => {
      if (r.id !== id || r.locked) return r
      const u = { ...r, [field]: safeVal }
      if ((field === 'qty' || field === 'rate') && !u.clientSupplied) {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? (q * rt) : ''
      }
      if (field === 'clientSupplied' && safeVal) u.rate = '0'
      return u
    }))
  }, [])

  const updateLabor = useCallback((id, field, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setLabor(prev => prev.map(r => {
      if (r.id !== id) return r
      const u = { ...r, [field]: safeVal }
      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? String(q * rt) : ''
      }
      return u
    }))
  }, [])

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

  const updatePrelim = useCallback((id, field, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setPrelims(p => p.map(r => r.id === id && !r.locked ? { ...r, [field]: safeVal } : r))
  }, [])
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
    const consolidated = consolidateExtractForImport(extract)
    if (consolidated.materials?.length || consolidated.matCategories?.length) {
      setMaterialState(consolidated.matCategories || [], consolidated.materials || [])
    }
    if (consolidated.boqItems?.length || consolidated.boqRows?.length) {
      const rows = consolidated.boqItems?.length ? consolidated.boqItems : consolidated.boqRows
      setBoqRows(rows.map((r, i) => normalizeBoqRow(r, i)))
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
    if (consolidated.labor?.length) setLabor(consolidated.labor)
    if (extract.contractSum) setContractSum(0)
    setExtras({
      assumptions: consolidated.assumptions || extract.assumptions || [],
      exclusions: consolidated.exclusions || extract.exclusions || [],
      provisional: consolidated.provisional || extract.provisional || [],
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
    const vDraft = loadVariationDraft()
    if (vDraft?.items?.length) setVariationDraftRaw(vDraft)
  }, [])

  useEffect(() => {
    if (!hydrated.current || skipPersist.current) return
    const hasData = boqRows.length > 0 || mats.some(m => m.desc) || meta.projectTitle
    if (!hasData) return
    const t = setTimeout(() => {
      persistDocGenState({ docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections })
      if (variationDraft) saveVariationDraft(variationDraft)
      setLastAutoSaved(new Date().toISOString())
    }, 400)
    return () => clearTimeout(t)
  }, [docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections, variationDraft])

  useEffect(() => {
    if (!hydrated.current) return
    const interval = setInterval(() => {
      const hasData = boqRows.length > 0 || mats.some(m => m.desc) || meta.projectTitle
      if (!hasData || skipPersist.current) return
      persistDocGenState({ docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections })
      if (variationDraft) saveVariationDraft(variationDraft)
      setLastAutoSaved(new Date().toISOString())
    }, 120000)
    return () => clearInterval(interval)
  }, [docType, meta, boqRows, mats, matCategories, labor, prelims, contractSum, extras, financialAdjustments, preview, documentSections, variationDraft])

  const setVariationDraft = useCallback((next) => {
    setVariationDraftRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      if (resolved) saveVariationDraft(resolved)
      else clearVariationDraft()
      return resolved
    })
  }, [])

  const startVariationDraft = useCallback(({
    originalDocumentId = null,
    originalSnapshot = null,
    variationOrder = null,
    items = [],
    revisionNumber = 1,
  } = {}) => {
    const snap = originalSnapshot || {
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
      documentSections,
    }
    const draft = createEmptyVariationDraft({
      originalDocumentId: originalDocumentId || activeSavedDocId,
      originalSnapshot: snap,
      originalTotal: snap.contractSum || contractSum || 0,
      originalBoqSnapshot: safeJsonClone(snap.boqRows || boqRows) || [],
      revisionNumber,
      variationOrderId: variationOrder?.id || null,
      variationNumber: variationOrder?.variationNumber || '',
      projectName: variationOrder?.projectName || snap.meta?.projectTitle || '',
      items: items.length ? items.map(normalizeVariationItemForDocGen) : [],
    })
    setVariationUndoStack([])
    setVariationDraft(draft)
    return draft
  }, [activeSavedDocId, boqRows, docType, meta, mats, matCategories, labor, prelims, contractSum, financialAdjustments, documentSections, setVariationDraft])

  const pushVariationUndo = useCallback(() => {
    setVariationUndoStack(stack => {
      if (!variationDraft) return stack
      return [...stack.slice(-20), safeJsonClone(variationDraft)].filter(Boolean)
    })
  }, [variationDraft])

  const undoVariationDraft = useCallback(() => {
    setVariationUndoStack(stack => {
      if (!stack.length) return stack
      const prev = stack[stack.length - 1]
      setVariationDraftRaw(prev)
      saveVariationDraft(prev)
      return stack.slice(0, -1)
    })
  }, [])

  const updateVariationItem = useCallback((id, patch) => {
    if (isDomOrEvent(patch)) return
    const safePatch = sanitizePatch(patch)
    pushVariationUndo()
    setVariationDraft(draft => {
      if (!draft) return draft
      const items = (draft.items || []).map(item =>
        item.id === id ? normalizeVariationItemForDocGen({ ...item, ...safePatch }) : item,
      )
      return { ...draft, items }
    })
  }, [pushVariationUndo, setVariationDraft])

  const addVariationItem = useCallback((partial = {}) => {
    const safePartial = isDomOrEvent(partial) ? {} : sanitizePatch(partial)
    pushVariationUndo()
    setVariationDraft(draft => {
      if (!draft) return draft
      const items = [...(draft.items || []), normalizeVariationItemForDocGen(
        createEmptyVariationItem((draft.items?.length || 0) + 1),
      )]
      if (Object.keys(safePartial).length) {
        items[items.length - 1] = normalizeVariationItemForDocGen({ ...items[items.length - 1], ...safePartial })
      }
      return { ...draft, items }
    })
  }, [pushVariationUndo, setVariationDraft])

  const removeVariationItem = useCallback((id) => {
    pushVariationUndo()
    setVariationDraft(draft => {
      if (!draft) return draft
      return { ...draft, items: (draft.items || []).filter(i => i.id !== id) }
    })
  }, [pushVariationUndo, setVariationDraft])

  const importVariationItems = useCallback((items) => {
    pushVariationUndo()
    setVariationDraft(draft => {
      if (!draft) return draft
      const merged = [...(draft.items || []), ...items.map(normalizeVariationItemForDocGen)]
      return { ...draft, items: merged.map((item, i) => ({ ...item, itemNo: i + 1 })) }
    })
  }, [pushVariationUndo, setVariationDraft])

  const loadVariationFromOrder = useCallback((vo) => {
    if (!vo) return null
    const calc = applyCalculationsToOrder(vo)
    return startVariationDraft({
      originalDocumentId: vo.originalEstimateId || activeSavedDocId,
      variationOrder: calc,
      items: calc.items || [],
      revisionNumber: nextRevisionNumber([variationDraft?.revisionNumber].filter(Boolean)),
    })
  }, [activeSavedDocId, startVariationDraft, variationDraft?.revisionNumber])

  const importVariationFromExtract = useCallback((extract) => {
    const items = variationItemsFromExtract(extract)
    if (!items.length) return false
    if (!variationDraft) {
      startVariationDraft({ items })
    } else {
      importVariationItems(items)
    }
    return true
  }, [importVariationItems, startVariationDraft, variationDraft])

  const variationCalculations = useMemo(() => {
    if (!variationDraft?.items?.length) return null
    return computeVariationTotalsWithInclusion(
      variationDraft.items,
      variationDraft.originalTotal || contractSum || 0,
    )
  }, [variationDraft, contractSum])

  const buildVariationPreviewPayload = useCallback((exportStyle) => {
    if (!variationDraft?.originalSnapshot) return null
    return buildRevisedDocumentPayload(variationDraft.originalSnapshot, variationDraft, { exportStyle })
  }, [variationDraft])

  const finalizeVariationToDocument = useCallback((exportStyle = REVISED_EXPORT_STYLES.FULL) => {
    const payload = buildVariationPreviewPayload(exportStyle)
    if (!payload) return false
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
      ...payload,
      source: 'variation-revision',
    })
    if (payload.documentSections?.length) {
      setDocumentSectionsRaw(normalizeDocumentSections(payload.documentSections, { meta: payload.meta, extras: payload }))
    }
    setIntelligenceExtras({
      presentationStyle: payload.presentationStyle,
      boqCategorySummaries: payload.boqCategorySummaries,
    })
    setTransferSource('variation-revision')
    setVariationDraft({
      ...variationDraft,
      status: 'finalized',
      approvedAt: new Date().toISOString(),
      exportStyle,
    })
    setTimeout(() => { skipPersist.current = false }, 300)
    return payload
  }, [buildVariationPreviewPayload, setIntelligenceExtras, setVariationDraft, variationDraft])

  const clearVariationWorkflow = useCallback(() => {
    setVariationDraft(null)
    setVariationUndoStack([])
    clearVariationDraft()
  }, [setVariationDraft])

  const updateVariationDraftMeta = useCallback((patch) => {
    const safePatch = sanitizePatch(patch)
    setVariationDraft(draft => (draft ? { ...draft, ...safePatch } : draft))
  }, [setVariationDraft])

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
    setVariationDraftRaw(prev => {
      if (!savedDocId || !prev?.originalDocumentId || prev.originalDocumentId === savedDocId) return prev
      clearVariationDraft()
      return null
    })
    setVariationUndoStack([])
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
    clearVariationWorkflow()
    setExtras({ assumptions: [], exclusions: [], drawingAnalysis: {}, risks: [], pricing: null })
    setDocumentSectionsRaw(createDefaultSectionLayout())
    setLastAutoSaved(null)
    setTimeout(() => { skipPersist.current = false }, 300)
  }, [clearVariationWorkflow])

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
    const vItems = variationDraft?.items || []
    const vSummary = variationCalculations || variationDraft?.originalSnapshot?.revision?.calculations || null
    const syncedMeta = syncSectionHtmlToMeta(documentSections, meta)
    return {
      type: docType,
      meta: {
        ...syncedMeta,
        ...(variationDraft ? {
          revisionNumber: variationDraft.revisionNumber,
          variationNumber: variationDraft.variationNumber,
          originalQuoteRef: variationDraft.originalSnapshot?.meta?.quoteNum || syncedMeta.originalQuoteRef,
          originalDocumentDate: variationDraft.originalSnapshot?.meta?.date || syncedMeta.originalDocumentDate,
        } : {}),
      },
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
      contractSum: vSummary?.revisedTotal ?? pricing.layers.finalEstimate,
      documentSections,
      presentationStyle: extras.presentationStyle,
      boqCategorySummaries: extras.boqCategorySummaries,
      workflow: extras.workflow,
      variations: vItems,
      variationSummary: vSummary,
      revision: variationDraft ? {
        revisionNumber: variationDraft.revisionNumber,
        variationNumber: variationDraft.variationNumber,
        variationOrderId: variationDraft.variationOrderId,
        originalDocumentId: variationDraft.originalDocumentId,
        originalTotal: variationDraft.originalTotal,
        exportStyle: variationDraft.exportStyle,
        status: variationDraft.status,
        userNotes: variationDraft.userNotes,
      } : null,
    }
  }, [docType, meta, mats, matCategories, labor, prelims, boqRows, extras, pricing, financialAdjustments, documentSections, variationDraft, variationCalculations])

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
    variationDraft, variationCalculations, hasVariationDraft: Boolean(variationDraft),
    canUndoVariation: variationUndoStack.length > 0,
    startVariationDraft, loadVariationFromOrder, importVariationFromExtract, importVariationItems,
    addVariationItem, updateVariationItem, removeVariationItem, undoVariationDraft,
    updateVariationDraftMeta, buildVariationPreviewPayload, finalizeVariationToDocument,
    clearVariationWorkflow,
  }
}
