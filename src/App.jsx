// src/App.jsx
import { useState, useCallback, useEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { ToastProvider, useToast } from './context/ToastContext.jsx'
import { ProjectProvider, useProjects } from './context/ProjectContext.jsx'
import { ProjectIntelligenceProvider, useProjectIntelligence } from './context/ProjectIntelligenceContext.jsx'
import { Topbar } from './components/shared/Topbar.jsx'
import { Sidebar } from './components/shared/Sidebar.jsx'
import ChatPage from './components/chat/ChatPage.jsx'
import BOQPage from './components/boq/BOQPage.jsx'
import DocGenPage from './components/docgen/DocGenPage.jsx'
import ProjectsPage from './components/projects/ProjectsPage.jsx'
import { ProcurementPage } from './components/tools/ProcurementPage.jsx'
import { RisksPage } from './components/tools/RisksPage.jsx'
import { PricesPage } from './components/tools/PricesPage.jsx'
import { CalcsPage } from './components/tools/CalcsPage.jsx'
import { ToolsPage } from './components/tools/ToolsPage.jsx'
import MarketTrendsPage from './components/tools/MarketTrendsPage.jsx'
import QSExportWorkflow from './components/boq/QSExportWorkflow.jsx'
import SaveProjectDialog from './components/projects/SaveProjectDialog.jsx'
import SavePricesToProfileDialog from './components/pricing/SavePricesToProfileDialog.jsx'
import ExtractPricesDialog from './components/pricing/ExtractPricesDialog.jsx'
import PricingSourceDialog from './components/pricing/PricingSourceDialog.jsx'
import WorkflowReviewDialog from './components/chat/WorkflowReviewDialog.jsx'
import { useChat } from './hooks/useChat.js'
import { useAIHealth } from './hooks/useAIHealth.js'
import { useAIUsage } from './hooks/useAIUsage.js'
import { useBOQ } from './hooks/useBOQ.js'
import { useDocGen } from './hooks/useDocGen.js'
import { buildBOQReviewPrompt, normalizePromptInput } from './utils/promptBuilder.js'
import { serializeBOQ, saveDocGenDraft } from './utils/boqWorkflow.js'
import { mergeExtractIntoProjectData, projectDataToDocPayload, intelligenceToProjectPatch, emptyProjectData } from './utils/projectIntelligence.js'
import { applyPresentationStyle, PRESENTATION_STYLES } from './utils/qsWorkflow.js'
import { PRICING_SOURCE_MODES, PRICING_SOURCE_OPTIONS } from './utils/priceProfileTypes.js'
import {
  WORKFLOW_ACTIONS,
  logWorkflowAction,
  hasBoqOrEstimateData,
  hasVariationData,
  prepareWorkflowData,
  saveWorkflowSession,
  loadWorkflowSession,
  clearWorkflowSession,
  buildMergedFromExtract,
  buildPdfExportPayload,
  enrichExtractForExport,
  canOpenQsWorkflow,
  ensureBoqRows,
  validateWorkflowAction,
} from './utils/workflowActions.js'
import TabErrorBoundary from './components/shared/TabErrorBoundary.jsx'
import { useWorkspaceSession } from './hooks/useWorkspaceSession.js'
import { clearWorkspaceSnapshot } from './utils/workspaceSession.js'
import { logSessionDebug } from './utils/sessionDebug.js'

function getLastChatExtract(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.extract) return msgs[i].extract
  }
  return null
}
import {
  loadPriceProfileState,
  getActiveProfileItems,
  getActiveProfile,
  updateActiveProfileItems,
  addItemsToProfile,
  createProfile,
  setActiveProfileId,
  savePriceProfileState,
} from './utils/priceStore.js'
import { extractAgreedPricesFromChat, extractAllPricesFromContext } from './utils/priceExtraction.js'
import { loadAllPriceProfiles, persistPriceProfiles } from './services/priceProfilesService.js'
import { fetchMaterialPrices } from './services/materialPricesService.js'
import { saveAppSession, loadAppSession, clearAppSession } from './utils/sessionStore.js'
import { downloadPDF, printDocument, buildDocumentHTML } from './services/ai/pdfEngine.js'
import { useCompanyLogo } from './hooks/useCompanyLogo.js'
import { DEFAULT_PRICES, DEFAULT_RISKS, DEFAULT_PROC, C } from './utils/constants.js'
import { loadEstimatePreferences, persistEstimatePreferences } from './utils/financialAdjustments.js'
import EstimatePreferencesPage from './components/tools/EstimatePreferencesPage.jsx'
import SavedDocumentsPage from './components/documents/SavedDocumentsPage.jsx'
import VariationOrderPage from './components/variation/VariationOrderPage.jsx'
import {
  loadAllSavedDocuments,
  saveDocumentUnified,
  deleteDocumentUnified,
  renameDocumentUnified,
  duplicateDocumentUnified,
  createSavedDocument,
  migrateLocalDocumentsToCloud,
  exportLocalDocumentsForMigration,
  parseBackupDocuments,
  importBackupDocuments,
  getDocumentsNeedingCloudSync,
  CLOUD_WARNING,
} from './services/savedDocumentsService.js'
import { fetchCloudDocuments } from './services/supabase/savedDocumentsCloud.js'
import { loadSavedDocuments, createRevisedDocument, nextRevisionForDocument, getSavedDocument } from './utils/savedDocuments.js'
import { useCloudSave } from './hooks/useCloudSave.js'
import { VO_SOURCE_TYPES } from './utils/variationOrderTypes.js'
import { applyCalculationsToOrder } from './utils/variationCalculations.js'
import {
  loadAllVariationOrders,
  saveVariationOrderUnified,
  deleteVariationOrderUnified,
  createNewVariationOrder,
} from './services/variationOrdersService.js'

function AppShell() {
  const { state: projState, dispatch } = useProjects()
  const activeProject = projState.projects.find(p => p.id === projState.activeId) ?? null

  return (
    <ProjectIntelligenceProvider activeProject={activeProject}>
      <AppShellInner projState={projState} dispatch={dispatch} />
    </ProjectIntelligenceProvider>
  )
}

function AppShellInner({ projState, dispatch }) {
  const toast = useToast()
  const intelligence = useProjectIntelligence()

  const [tab,        setTab]        = useState(() => loadAppSession()?.tab || 'chat')
  const [priceProfileState, setPriceProfileState] = useState(() => loadPriceProfileState())
  const prices = useMemo(() => getActiveProfileItems(priceProfileState), [priceProfileState])
  const activeProfile = useMemo(() => getActiveProfile(priceProfileState), [priceProfileState])
  const bootSession = useMemo(() => loadAppSession(), [])
  const [extractedPrices, setExtractedPrices] = useState(() => bootSession?.extractedPrices || [])
  const setPrices = useCallback((next) => {
    setPriceProfileState(prev => updateActiveProfileItems(prev, next))
  }, [])
  const [livePrices, setLivePrices] = useState([])
  const [savePricesOpen, setSavePricesOpen] = useState(false)
  const [extractPricesOpen, setExtractPricesOpen] = useState(false)
  const [pricingSourceOpen, setPricingSourceOpen] = useState(false)
  const [workflowReviewOpen, setWorkflowReviewOpen] = useState(false)
  const [workflowReviewData, setWorkflowReviewData] = useState(null)
  const [qsWorkflowOpen, setQsWorkflowOpen] = useState(false)
  const [qsWorkflowData, setQsWorkflowData] = useState(null)
  const [qsInitialStep, setQsInitialStep] = useState(0)
  const [qsInitialStyle, setQsInitialStyle] = useState(null)
  const [saveProjectOpen, setSaveProjectOpen] = useState(false)
  const [saveProjectExtract, setSaveProjectExtract] = useState(null)
  const [risks,      setRisks]      = useState(DEFAULT_RISKS)
  const [proc,       setProc]       = useState(DEFAULT_PROC)
  const [pdfStatus,  setPdfStatus]  = useState(null)
  const [estimatePreferences, setEstimatePreferencesRaw] = useState(() => loadEstimatePreferences())
  const [savedDocuments, setSavedDocuments] = useState([])
  const [savedDocsLoading, setSavedDocsLoading] = useState(true)
  const [savedDocsMigrating, setSavedDocsMigrating] = useState(false)
  const [savedDocsImporting, setSavedDocsImporting] = useState(false)
  const [pendingMigrationCount, setPendingMigrationCount] = useState(0)
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [variationOrders, setVariationOrders] = useState([])
  const [voInitialAction, setVoInitialAction] = useState(null)
  const [workflowState, setWorkflowState] = useState(() => loadWorkflowSession() || {})
  const [qsAutoCompare, setQsAutoCompare] = useState(false)

  useEffect(() => {
    const session = loadWorkflowSession()
    if (!session?.presentationStyle && !session?.pricingConfig) return
    intelligence.setData(prev => ({
      ...prev,
      pricingConfig: session.pricingConfig || prev.pricingConfig,
      workflow: {
        ...(prev.workflow || {}),
        presentationStyle: session.presentationStyle || prev.workflow?.presentationStyle,
      },
      presentationStyle: session.presentationStyle || prev.presentationStyle,
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPendingMigrationCount = useCallback(async () => {
    const localDocs = loadSavedDocuments()
    const { docs: cloudDocs, error } = await fetchCloudDocuments()
    if (error) {
      setPendingMigrationCount(localDocs.length)
      return
    }
    setPendingMigrationCount(getDocumentsNeedingCloudSync(localDocs, cloudDocs).length)
  }, [])

  const refreshSavedDocuments = useCallback(async () => {
    setSavedDocsLoading(true)
    try {
      const { docs, error, cloudActive, migration } = await loadAllSavedDocuments()
      setSavedDocuments(docs)
      if (cloudActive) {
        await refreshPendingMigrationCount()
      } else {
        setPendingMigrationCount(0)
      }
      if (migration?.migrated > 0 && migration.failed === 0) {
        toast.success(
          'Documents migrated to cloud',
          `${migration.migrated} local document${migration.migrated === 1 ? '' : 's'} synced to Supabase`,
        )
      } else if (migration?.failed > 0) {
        toast.warn('Partial cloud sync', migration.errors.join('; '))
      } else if (error && cloudActive === false) {
        // local-only mode — no toast needed
      } else if (error) {
        toast.warn('Cloud sync issue', error)
      }
    } catch (e) {
      toast.error('Could not load documents', e.message || 'Try refreshing')
    } finally {
      setSavedDocsLoading(false)
    }
  }, [toast, refreshPendingMigrationCount])

  const handleMigrateToCloud = useCallback(async () => {
    setSavedDocsMigrating(true)
    try {
      const result = await migrateLocalDocumentsToCloud()
      await refreshSavedDocuments()
      if (result.ok && result.migrated > 0) {
        toast.success(
          'Sync complete',
          `${result.migrated} document${result.migrated === 1 ? '' : 's'} uploaded to Supabase`,
        )
      } else if (result.ok) {
        toast.success('Already synced', 'All local documents are in Supabase')
      } else {
        toast.error('Sync failed', result.errors.join('; ') || 'Could not upload documents')
      }
    } catch (e) {
      toast.error('Sync failed', e.message || 'Could not upload documents')
    } finally {
      setSavedDocsMigrating(false)
    }
  }, [refreshSavedDocuments, toast])

  const handleExportLocalDocuments = useCallback(() => {
    const count = exportLocalDocumentsForMigration()
    if (count > 0) {
      toast.success('Export started', `${count} document${count === 1 ? '' : 's'} saved to JSON`)
    } else {
      toast.warn('Nothing to export', 'No local documents found on this device')
    }
  }, [toast])

  const handleImportBackup = useCallback(async (raw, fileName, readError = null) => {
    if (readError) {
      toast.error('Import failed', readError)
      return
    }

    setSavedDocsImporting(true)
    try {
      const docs = parseBackupDocuments(raw)
      if (!docs.length) {
        toast.warn('Import skipped', 'No valid documents found in backup file')
        return
      }

      const result = await importBackupDocuments(docs)
      await refreshSavedDocuments()

      if (result.ok && result.imported > 0) {
        toast.success(
          'Backup imported',
          `${result.imported} document${result.imported === 1 ? '' : 's'} added to Supabase` +
            (result.skipped ? ` (${result.skipped} already existed)` : ''),
        )
      } else if (result.ok) {
        toast.success('Already imported', `All ${result.total} documents from ${fileName} are already in Supabase`)
      } else if (result.imported > 0) {
        toast.warn(
          'Partial import',
          `${result.imported} imported, ${result.failed} failed. ${result.errors.join('; ')}`,
        )
      } else {
        toast.error('Import failed', result.errors.join('; ') || 'Could not import backup')
      }
    } catch (e) {
      toast.error('Import failed', e instanceof Error ? e.message : 'Invalid backup file')
    } finally {
      setSavedDocsImporting(false)
    }
  }, [refreshSavedDocuments, toast])

  useEffect(() => {
    refreshSavedDocuments()
  }, [refreshSavedDocuments])

  const refreshVariationOrders = useCallback(async () => {
    try {
      const { orders } = await loadAllVariationOrders()
      setVariationOrders(orders)
    } catch (e) {
      console.error('[variation] load failed', e)
    }
  }, [])

  useEffect(() => {
    refreshVariationOrders()
  }, [refreshVariationOrders])

  const handleSaveVariationOrder = useCallback(async (vo) => {
    const result = await saveVariationOrderUnified(vo)
    if (result.ok) {
      await refreshVariationOrders()
      if (result.warning) toast.warn('Saved locally', result.warning)
      else toast.success('Variation saved', result.order?.variationNumber)
    } else {
      toast.error('Save failed', result.error)
    }
    return result
  }, [refreshVariationOrders, toast])

  const handleDeleteVariationOrder = useCallback(async (id) => {
    const result = await deleteVariationOrderUnified(id)
    if (result.ok) {
      await refreshVariationOrders()
      if (result.error) toast.warn('Deleted locally', result.error)
      else toast.success('Variation deleted')
    } else {
      toast.error('Delete failed', result.error)
    }
  }, [refreshVariationOrders, toast])

  const handleVariationQuickAction = useCallback((mode) => {
    setVoInitialAction(mode)
    setTab('variation')
  }, [])

  const clearVoInitialAction = useCallback(() => setVoInitialAction(null), [])

  useEffect(() => {
    loadAllPriceProfiles().then(({ state }) => {
      if (state) setPriceProfileState(state)
    })
    fetchMaterialPrices().then(({ prices: lp }) => setLivePrices(lp || []))
  }, [])

  useEffect(() => {
    savePriceProfileState(priceProfileState)
  }, [priceProfileState])

  useEffect(() => {
    saveAppSession({
      tab,
      activeProjectId: projState.activeId,
      extractedPrices,
      estimatePreferences,
      priceProfileActiveId: priceProfileState.activeProfileId,
    })
  }, [tab, projState.activeId, extractedPrices, estimatePreferences, priceProfileState.activeProfileId])

  useEffect(() => {
    saveWorkflowSession({
      presentationStyle: intelligence.data?.workflow?.presentationStyle || workflowState.presentationStyle,
      pricingConfig: intelligence.data?.pricingConfig || workflowState.pricingConfig,
      pricingSourceLabel: workflowState.pricingSourceLabel,
    })
  }, [intelligence.data?.workflow?.presentationStyle, intelligence.data?.pricingConfig, workflowState])

  const setEstimatePreferences = useCallback((next) => {
    setEstimatePreferencesRaw(prev => {
      const updated = typeof next === 'function' ? next(prev) : next
      persistEstimatePreferences(updated)
      return updated
    })
  }, [])

  const docGen = useDocGen(estimatePreferences)

  useEffect(() => {
    if (draftRecovered || !docGen.lastAutoSaved) return
    setDraftRecovered(true)
    toast.info('Draft recovered', 'Your last document draft was restored automatically')
  }, [docGen.lastAutoSaved, draftRecovered, toast])
  const boq    = useBOQ(intelligence, docGen.financialAdjustments)
  const companyLogo = useCompanyLogo()
  const aiHealth = useAIHealth()
  const cloudSave = useCloudSave()
  const aiUsage = useAIUsage()

  const buildExportData = useCallback(() => {
    const base = docGen.pdfData()
    const intel = intelligence.data
    return {
      ...base,
      exportedAt: new Date().toISOString(),
      logoUrl: companyLogo.getExportLogo(),
      pricing: base.pricing || intel.pricing,
      risks: base.type === 'risk_report' ? risks.map(r => ({
        risk: r.risk, rating: r.rating, mitigation: r.mitigation,
      })) : (base.risks?.length ? base.risks : intel.risks),
      procurement: base.type === 'procurement' ? proc.map(p => ({
        material: p.material, quantity: p.quantity, unit: p.unit,
        supplier: p.supplier, leadTime: p.leadTime, status: p.status,
      })) : (base.procurement || []),
    }
  }, [docGen, companyLogo, risks, proc, intelligence.data])

  const handleUsage = useCallback(({ input, output }) => {
    aiUsage.trackRequest({ inputTokens: input, outputTokens: output })
  }, [aiUsage])

  const handleAIExtract = useCallback((extract) => {
    if (extract?.requiresApproval) return
    intelligence.mergeFromExtract(extract)
  }, [intelligence])

  const chat = useChat({ prices, onUsage: handleUsage, onExtract: handleAIExtract })

  const session = useWorkspaceSession({
    tab,
    chatMsgs: chat.msgs,
    intelligenceData: intelligence.data,
    workflowState,
    extractedPrices,
    activeProjectId: projState.activeId,
    estimatePreferences,
    priceProfileActiveId: priceProfileState.activeProfileId,
    toast,
  })

  const applyExtractNow = useCallback((extract, opts = {}) => {
    const merged = intelligence.recomputePricing(
      buildMergedFromExtract(intelligence.data, extract, opts),
    )
    flushSync(() => intelligence.setData(merged))
    return merged
  }, [intelligence])

  const handleOpenQSWorkflow = useCallback((source, opts = {}) => {
    try {
      const merged = prepareWorkflowData(intelligence.data, source, {
        presentationStyle: opts.initialStyle || intelligence.data?.workflow?.presentationStyle,
        pricingConfig: intelligence.data?.pricingConfig,
      })
      if (!canOpenQsWorkflow(merged, source)) {
        logWorkflowAction('open-qs-workflow-blocked', { reason: 'no-data', rows: merged.boqItems?.length })
        toast.warn('Nothing to review', 'Generate a BOQ or estimate in chat first')
        return false
      }
      flushSync(() => {
        setQsInitialStep(opts.initialStep ?? 0)
        setQsInitialStyle(opts.initialStyle ?? merged.presentationStyle ?? null)
        setQsAutoCompare(Boolean(opts.autoCompare))
        setQsWorkflowData(merged)
        setQsWorkflowOpen(true)
      })
      logWorkflowAction('open-qs-workflow', { step: opts.initialStep ?? 0, style: opts.initialStyle, rows: merged.boqItems?.length })
      return true
    } catch (err) {
      console.error('[WorkflowAction] open-qs-workflow failed:', err)
      toast.error('Workflow failed', err?.message || 'Could not open review panel')
      return false
    }
  }, [intelligence, toast])

  const setPresentationStyle = useCallback((style) => {
    flushSync(() => {
      setWorkflowState(prev => ({ ...prev, presentationStyle: style }))
      intelligence.setData({
        ...intelligence.data,
        workflow: { ...(intelligence.data.workflow || {}), presentationStyle: style },
        presentationStyle: style,
      })
    })
    logWorkflowAction('set-presentation-style', { style })
  }, [intelligence])

  const extractPricesFromContext = useCallback((extract) => {
    return extractAllPricesFromContext(extract, chat.msgs)
  }, [chat.msgs])

  const handleOpenSaveProject = useCallback((extract) => {
    setSaveProjectExtract(extract)
    setSaveProjectOpen(true)
  }, [])

  const handleSaveProjectFromDialog = useCallback((fields) => {
    const extract = saveProjectExtract
    if (!extract) return

    const merged = mergeExtractIntoProjectData(intelligence.data, {
      ...extract,
      projectTitle: fields.projectTitle,
      clientName: fields.clientName,
      projectLocation: fields.location,
      projectScope: fields.projectDescription,
    })
    merged.projectInfo = {
      ...merged.projectInfo,
      title: fields.projectTitle,
      location: fields.location,
      description: fields.projectDescription,
    }
    merged.client = { ...merged.client, name: fields.clientName }
    const priced = intelligence.recomputePricing({
      ...merged,
      pricingConfig: workflowState.pricingConfig || merged.pricingConfig,
      workflow: {
        ...(merged.workflow || {}),
        presentationStyle: workflowState.presentationStyle || merged.workflow?.presentationStyle,
      },
    })
    intelligence.setData(priced)

    const patch = intelligenceToProjectPatch(priced)
    const chatSnapshot = serializeChatMessages(chat.msgs)
    const todayStr = new Date().toISOString().slice(0, 10)
    const activeId = projState.activeId
    const pricingConfig = priced.pricingConfig || workflowState.pricingConfig
    const presentationStyle = priced.workflow?.presentationStyle || workflowState.presentationStyle

    if (activeId) {
      dispatch({
        type: 'UPDATE',
        id: activeId,
        patch: {
          name: fields.projectTitle || 'Untitled Project',
          meta: {
            ...(projState.projects.find(p => p.id === activeId)?.meta || {}),
            clientName: fields.clientName,
            projectLocation: fields.location,
            projectTitle: fields.projectTitle,
            projectDescription: fields.projectDescription,
            pricingConfig,
            presentationStyle,
          },
          chatSnapshot,
          ...patch,
        },
      })
      dispatch({ type: 'APPLY_INTELLIGENCE', id: activeId, data: priced })
      toast.success('Project updated', fields.projectTitle || 'Saved')
    } else {
      const id = `proj-${Date.now()}`
      dispatch({
        type: 'CREATE',
        project: {
          id,
          name: fields.projectTitle || 'Untitled Project',
          type: 'Residential',
          status: 'draft',
          createdAt: todayStr,
          updatedAt: todayStr,
          meta: {
            quoteNum: `DLC-${Date.now().toString().slice(-5)}`,
            date: todayStr,
            validDays: '30',
            clientName: fields.clientName,
            clientContact: '',
            clientEmail: '',
            projectLocation: fields.location,
            projectTitle: fields.projectTitle,
            projectDescription: fields.projectDescription,
            pricingConfig,
            presentationStyle,
          },
          chatSnapshot,
          boqRows: patch.boqRows,
          materials: patch.materials,
          labor: patch.labor,
          prelims: patch.prelims,
          risks: patch.risks,
          procurement: [],
          contractSum: patch.contractSum,
          documents: [],
          intelligence: priced,
        },
      })
      toast.success('Project saved', fields.projectTitle || 'New project', {
        label: 'View Projects',
        fn: () => setTab('projects'),
      })
    }

    setSaveProjectOpen(false)
    setSaveProjectExtract(null)
  }, [dispatch, intelligence, projState.activeId, projState.projects, saveProjectExtract, chat.msgs, toast, workflowState])

  const handleQSExport = useCallback(({ presentationStyle, priceInputs, rows, assumptions, exclusions, workflowMeta }) => {
    const tid = toast.loading('Exporting to Document Generator…')
    try {
      const merged = mergeExtractIntoProjectData(intelligence.data, {
        boqRows: rows,
        assumptions,
        exclusions,
        userApprovedPricing: true,
      }, { replaceBoq: true })
      merged.workflow = { presentationStyle, approvedAt: new Date().toISOString(), ...workflowMeta }
      intelligence.setData(intelligence.recomputePricing(merged))
      let payload = projectDataToDocPayload(merged, {
        docType: rows?.length ? 'boq' : 'estimate',
        source: 'qs-workflow',
      })
      payload = applyPresentationStyle(payload, presentationStyle)
      saveDocGenDraft(payload)
      const ok = docGen.applyBOQTransfer(payload)
      if (!ok) throw new Error('Transfer failed')
      setQsWorkflowOpen(false)
      setTab('docgen')
      toast.done(tid, 'Approved export sent to Document Generator', `${rows.length} items · ${presentationStyle === 'premium' ? 'Premium Quotation' : 'Detailed BOQ'}`)
    } catch (e) {
      toast.fail(tid, 'Export failed', e.message)
    }
  }, [docGen, intelligence, toast])

  const handleSaveWorkflowPrices = useCallback((priceInputs = []) => {
    const next = [...prices]
    for (const input of priceInputs) {
      if (!input.unitPrice) continue
      const idx = next.findIndex(p => p.material === input.material && (p.specification || '') === (input.specification || ''))
      const row = {
        id: idx >= 0 ? next[idx].id : Date.now() + Math.random(),
        material: input.material,
        specification: input.specification || '',
        unit: input.unit || 'nr',
        price: String(input.unitPrice),
        supplier: input.supplier || '',
        lastUpdated: new Date().toISOString().slice(0, 10),
        source: 'user_agreed',
        category: input.category || 'material',
      }
      if (idx >= 0) next[idx] = { ...next[idx], ...row }
      else next.push(row)
    }
    setPrices(next)
    persistPriceProfiles(updateActiveProfileItems(priceProfileState, next))
  }, [prices, priceProfileState, setPrices])

  const handleExtractPrices = useCallback(() => {
    const extracted = extractAgreedPricesFromChat(chat.msgs)
    if (!extracted.length) {
      toast.warn('No prices found', 'Agree rates in chat first (e.g. Cement 42.5R = 110 GHS/bag)')
      return
    }
    setExtractedPrices(extracted)
    toast.success(`${extracted.length} price(s) extracted`, 'Review and save to your Price Profile')
    setSavePricesOpen(true)
  }, [chat.msgs, toast])

  const handleSavePricesToProfile = useCallback(() => {
    const extracted = extractedPrices.length ? extractedPrices : extractAgreedPricesFromChat(chat.msgs)
    if (!extracted.length) {
      toast.warn('No prices to save', 'Extract prices from chat first or agree rates with the AI')
      return
    }
    setExtractedPrices(extracted)
    setSavePricesOpen(true)
  }, [chat.msgs, extractedPrices, toast])

  const handleConfirmSavePrices = useCallback(async ({ profileId, items, conflictMode }) => {
    let next = addItemsToProfile(priceProfileState, profileId, items, conflictMode)
    next = setActiveProfileId(next, profileId)
    setPriceProfileState(next)
    const result = await persistPriceProfiles(next)
    setSavePricesOpen(false)
    if (result.ok || result.warning) {
      toast.success('Prices saved to profile', `${items.length} rate(s) added`)
    } else {
      toast.warn('Saved locally', result.error || 'Cloud sync unavailable')
    }
  }, [priceProfileState, toast])

  const handleCreatePriceProfile = useCallback((name) => {
    const next = createProfile(priceProfileState, name)
    setPriceProfileState(next)
    return next.activeProfileId
  }, [priceProfileState])

  const handleOpenPricingSource = useCallback(() => {
    setPricingSourceOpen(true)
  }, [])

  const handleSelectPricingSource = useCallback((mode) => {
    const label = PRICING_SOURCE_OPTIONS.find(o => o.id === mode)?.label || mode
    intelligence.setData({
      ...intelligence.data,
      pricingConfig: {
        sourceMode: mode,
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        chosenAt: new Date().toISOString(),
      },
    })
    setWorkflowState(prev => ({
      ...prev,
      pricingConfig: { sourceMode: mode, profileName: activeProfile.name },
      pricingSourceLabel: label,
    }))
    setPricingSourceOpen(false)
    toast.success('Pricing source set', label)
    logWorkflowAction(WORKFLOW_ACTIONS.CHOOSE_PRICING_SOURCE, { mode, label })
  }, [activeProfile, intelligence, toast])

  const handleStartNewProject = useCallback(() => {
    if (!window.confirm('Clear chat and start a new project? Save your session first if you want to keep this work.')) {
      return
    }
    chat.forceSave?.()
    chat.clear()
    clearAppSession()
    clearWorkflowSession()
    clearWorkspaceSnapshot()
    sessionStorage.removeItem('constructiq-session-restored')
    setWorkflowState({})
    intelligence.setData(emptyProjectData())
    docGen.resetDocument({ newQuoteNum: true })
    setQsWorkflowOpen(false)
    setQsWorkflowData(null)
    setSaveProjectOpen(false)
    setSaveProjectExtract(null)
    setSavePricesOpen(false)
    setExtractPricesOpen(false)
    setWorkflowReviewOpen(false)
    setWorkflowReviewData(null)
    setExtractedPrices([])
    setTab('chat')
    logSessionDebug('new-project-cleared')
    toast.info('New project started', 'Chat and workflow cleared — use Save Session to keep work before clearing')
  }, [chat, docGen, intelligence, session, toast])

  // ── Navigate + fire a prompt ─────────────────────────────────────────────
  const firePrompt = useCallback((prompt) => {
    if (chat.busy) {
      toast.warn('AI is busy', 'Wait for the current request or press Stop in the top bar')
      return
    }
    const text = normalizePromptInput(prompt)
    if (!text) {
      toast.warn('Empty prompt', 'Add a message or select data to analyze')
      return
    }
    setTab('chat')
    chat.send(text, null, (kind, title, body, action) => toast[kind]?.(title, body, action))
  }, [chat, toast])

  const handleVariationAIAssist = useCallback((prompt) => {
    firePrompt(prompt)
  }, [firePrompt])

  const handleImportVariation = useCallback(async (items) => {
    const vo = createNewVariationOrder({
      items,
      reasonForVariation: 'Imported from AI variation schedule',
      sourceType: 'manual',
      projectName: intelligence.data.projectInfo?.title || '',
      clientName: intelligence.data.client?.name || '',
      originalEstimateRef: intelligence.data.projectInfo?.quoteNum || '',
      originalEstimateTotal: intelligence.data.pricing?.summary?.grand || 0,
      originalBoqSnapshot: JSON.parse(JSON.stringify(intelligence.data.boqItems || [])),
    }, variationOrders)
    const result = await saveVariationOrderUnified(vo)
    if (result.ok) {
      await refreshVariationOrders()
      toast.success(`${items.length} items imported to ${result.order?.variationNumber}`)
      return { navigate: 'variation' }
    }
    toast.error('Import failed', result.error || 'Could not save variation order')
    return { ok: false }
  }, [intelligence, variationOrders, refreshVariationOrders, toast])

  // ── PDF export from AI extract ────────────────────────────────────────────
  const handlePDFExport = useCallback(async (extract) => {
    const tid = toast.loading('Generating PDF…')
    setPdfStatus('Preparing…')
    try {
      const enriched = enrichExtractForExport(extract)
      const merged = applyExtractNow(enriched, {
        replaceBoq: ensureBoqRows(enriched).length > 0,
      })
      const style = workflowState.presentationStyle || merged.workflow?.presentationStyle
      const data = buildPdfExportPayload(merged, enriched, { style })
      const result = await downloadPDF(
        data,
        `${extract.projectTitle || 'estimate'}.pdf`,
        s => { setPdfStatus(s); toast.update(tid, { body: s }) },
        companyLogo.getExportLogo(),
      )
      if (result?.method === 'html') {
        toast.done(tid, 'HTML document downloaded', result.message)
      } else {
        toast.done(tid, 'PDF downloaded')
      }
      logWorkflowAction(WORKFLOW_ACTIONS.EXPORT_PDF, { ok: true, rows: data.boqRows?.length, method: result?.method })
    } catch (e) {
      logWorkflowAction(WORKFLOW_ACTIONS.EXPORT_PDF, { ok: false, error: e?.message })
      toast.fail(tid, 'PDF failed', e?.message || 'Try the DocGen tab instead')
    } finally {
      setPdfStatus(null)
    }
  }, [toast, companyLogo, workflowState.presentationStyle, applyExtractNow])

  const handleConfirmExtractedPrices = useCallback((items) => {
    setExtractedPrices(items)
    setExtractPricesOpen(false)
    toast.success(`${items.length} price(s) confirmed`, 'Use Save Prices to Profile when ready')
    logWorkflowAction(WORKFLOW_ACTIONS.EXTRACT_PRICES, { confirmed: items.length })
  }, [toast])

  const handleWorkflowReviewApprove = useCallback(() => {
    intelligence.setData({
      ...intelligence.data,
      workflow: {
        ...(intelligence.data.workflow || {}),
        reviewedAt: new Date().toISOString(),
        userApprovedReview: true,
      },
    })
    setWorkflowReviewOpen(false)
    toast.success('Review approved', 'You can now choose pricing source and export')
    logWorkflowAction(WORKFLOW_ACTIONS.REVIEW, { approved: true })
  }, [intelligence, toast])

  const handleWorkflowAction = useCallback((actionId, extract, opts = {}) => {
    logWorkflowAction(actionId, {
      hasBoq: hasBoqOrEstimateData(extract),
      hasVariation: hasVariationData(extract),
      boqRows: ensureBoqRows(extract).length,
    })

    const validation = validateWorkflowAction(actionId, extract, {
      workflowState,
      extractedPricesCount: extractedPrices.length,
      livePricesCount: livePrices?.length || 0,
    })
    if (!validation.ok) {
      toast.warn('Action unavailable', validation.reason)
      return { ok: false, reason: validation.reason }
    }

    try {
      switch (actionId) {
        case WORKFLOW_ACTIONS.IMPORT_BOQ: {
          if (!hasBoqOrEstimateData(extract) && !ensureBoqRows(extract).length) {
            toast.warn('No BOQ data', 'Ask the AI to generate a BOQ or estimate first')
            return { ok: false }
          }
          const merged = applyExtractNow(extract, { replaceBoq: true })
          const count = ensureBoqRows(extract).length || merged.boqItems?.length || 0
          toast.success('Imported to BOQ Builder', `${count} lines with assumptions and notes`)
          return { navigate: 'boq' }
        }

        case WORKFLOW_ACTIONS.REVIEW: {
          if (!hasBoqOrEstimateData(extract)) {
            toast.warn('Nothing to review', 'Generate BOQ or estimate data in chat first')
            return { ok: false }
          }
          const merged = applyExtractNow(extract)
          const reviewData = prepareWorkflowData(merged, extract, {
            presentationStyle: workflowState.presentationStyle || intelligence.data?.workflow?.presentationStyle,
            pricingConfig: intelligence.data?.pricingConfig,
          })
          flushSync(() => {
            setWorkflowReviewData(reviewData)
            setWorkflowReviewOpen(true)
          })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.EXTRACT_PRICES: {
          const extracted = extractPricesFromContext(extract)
          if (!extracted.length) {
            toast.warn('No prices found', 'Agree rates in chat or generate a priced BOQ first')
            return { ok: false }
          }
          flushSync(() => {
            setExtractedPrices(extracted)
            setExtractPricesOpen(true)
          })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.SAVE_PRICES_PROFILE: {
          const extracted = extractedPrices.length ? extractedPrices : extractPricesFromContext(extract)
          if (!extracted.length) {
            toast.warn('No prices to save', 'Use Extract Prices from Chat first')
            return { ok: false }
          }
          flushSync(() => {
            setExtractedPrices(extracted)
            setSavePricesOpen(true)
          })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.CHOOSE_PRICING_SOURCE: {
          flushSync(() => setPricingSourceOpen(true))
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.COMPARE_PROFILE_MARKET: {
          if (!hasBoqOrEstimateData(extract)) {
            toast.warn('No BOQ to price', 'Generate a BOQ in chat before comparing prices')
            return { ok: false }
          }
          if (!livePrices?.length) {
            toast.warn('Live market prices unavailable', 'Use profile or manual prices instead')
          }
          applyExtractNow(extract)
          handleOpenQSWorkflow(extract, { initialStep: 1, autoCompare: true })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.PREMIUM_QUOTATION: {
          if (!hasBoqOrEstimateData(extract)) {
            toast.warn('No BOQ data', 'Generate a BOQ or estimate before choosing presentation style')
            return { ok: false }
          }
          applyExtractNow(extract)
          setPresentationStyle(PRESENTATION_STYLES.PREMIUM)
          toast.success('Style selected', 'Premium Quotation — summarized client-facing category totals')
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.DETAILED_BOQ: {
          if (!hasBoqOrEstimateData(extract)) {
            toast.warn('No BOQ data', 'Generate a BOQ or estimate before choosing presentation style')
            return { ok: false }
          }
          applyExtractNow(extract)
          setPresentationStyle(PRESENTATION_STYLES.DETAILED)
          toast.success('Style selected', 'Detailed BOQ — full item-by-item breakdown')
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.EXPORT_DOCGEN: {
          if (!hasBoqOrEstimateData(extract)) {
            toast.warn('No export data', 'Generate a BOQ or estimate in chat first')
            return { ok: false }
          }
          const style = workflowState.presentationStyle || intelligence.data?.workflow?.presentationStyle
          if (!style) {
            toast.warn('Select document style first', 'Choose Premium Quotation or Detailed BOQ before export')
            return { ok: false }
          }
          applyExtractNow(extract)
          handleOpenQSWorkflow(extract, { initialStep: 4, initialStyle: style })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.SAVE_PROJECT: {
          applyExtractNow(extract)
          flushSync(() => {
            setSaveProjectExtract(extract)
            setSaveProjectOpen(true)
          })
          return { ok: true }
        }

        case WORKFLOW_ACTIONS.EXPORT_PDF: {
          if (!hasBoqOrEstimateData(extract) && !extract?.contractSum) {
            toast.warn('Nothing to export', 'Generate an estimate or BOQ in chat first')
            return { ok: false }
          }
          return handlePDFExport(extract)
        }

        case WORKFLOW_ACTIONS.IMPORT_VARIATION: {
          if (!extract?.variationItems?.length) {
            toast.warn('No variation items', 'Ask the AI to build a variation schedule first')
            return { ok: false }
          }
          return handleImportVariation(extract.variationItems)
        }

        default:
          toast.warn('Not configured', 'This feature is not fully configured yet.')
          return { ok: false }
      }
    } catch (err) {
      console.error(`[WorkflowAction] ${actionId} failed:`, err)
      toast.error('Action failed', err?.message || 'Something went wrong — chat state preserved')
      return { ok: false, error: err?.message }
    } finally {
      session.saveNow()
      chat.forceSave?.()
    }
  }, [
    applyExtractNow, extractPricesFromContext, extractedPrices.length, handleImportVariation,
    handleOpenQSWorkflow, handlePDFExport, intelligence, livePrices, setPresentationStyle,
    toast, workflowState.presentationStyle, session, chat,
  ])

  // ── BOQ import from AI (legacy callback) ───────────────────────────────────
  const handleImportBOQ = useCallback((rows) => {
    intelligence.mergeFromExtract({ boqRows: rows }, { replaceBoq: true })
    toast.success(`${rows.length} rows imported to BOQ Builder`, undefined, {
      label: 'View BOQ', fn: () => setTab('boq'),
    })
  }, [intelligence, toast])

  const handleSendToDocGen = useCallback((extract) => {
    handleOpenQSWorkflow(extract)
  }, [handleOpenQSWorkflow])

  // ── BOQ Builder → QS workflow → Document Generator ───────────────────────
  const handleBOQToDocGen = useCallback(async (rows) => {
    if (!rows?.length) {
      toast.warn('No BOQ items', 'Add at least one line item before export')
      return
    }
    intelligence.setBoqItems(rows)
    handleOpenQSWorkflow({ boqRows: rows, ...intelligence.data, boqItems: rows })
  }, [handleOpenQSWorkflow, intelligence, toast])

  // ── DocGen PDF actions ────────────────────────────────────────────────────
  const handleDocDownload = useCallback(async () => {
    if (!docGen.hasBOQData && !docGen.meta.projectTitle?.trim()) {
      toast.warn('Document is empty', 'Add BOQ data or project details before exporting')
      return
    }
    const tid = toast.loading('Generating PDF…')
    setPdfStatus('Preparing document…')
    try {
      const data = buildExportData()
      const result = await downloadPDF(
        data,
        `${docGen.meta.quoteNum || 'document'}.pdf`,
        s => { setPdfStatus(s); toast.update(tid, { body: s }) },
        data.logoUrl,
      )
      if (result.method === 'pdf') {
        toast.done(tid, 'PDF downloaded', docGen.meta.projectTitle || undefined)
      } else {
        toast.done(tid, 'Document saved', result.message || 'HTML export — use Print → Save as PDF')
      }
    } catch (e) {
      console.error('[export] download failed:', e)
      const msg = e.message || 'Try Preview then Print'
      toast.fail(tid, msg.startsWith('Export blocked') ? 'Incomplete document' : 'Export failed', msg)
    }
    setPdfStatus(null)
  }, [docGen, buildExportData, toast])

  const handleDocPrint = useCallback(async () => {
    if (!docGen.hasBOQData && !docGen.meta.projectTitle?.trim()) {
      toast.warn('Document is empty', 'Add BOQ data or project details before printing')
      return
    }
    const tid = toast.loading('Opening print preview…')
    setPdfStatus('Preparing print layout…')
    try {
      await printDocument(buildExportData(), companyLogo.getExportLogo())
      toast.done(tid, 'Print dialog opened', 'Select your printer or Save as PDF')
    } catch (e) {
      console.error('[export] print failed:', e)
      toast.fail(tid, 'Print failed', e.message || 'Allow popups and try again')
    }
    setPdfStatus(null)
  }, [docGen, buildExportData, companyLogo, toast])

  const handleClearForm = useCallback(() => {
    docGen.resetDocument()
    toast.success('Form cleared', 'Ready for a new document')
  }, [docGen, toast])

  const handleStartNewDocument = useCallback(() => {
    docGen.resetDocument({ newQuoteNum: true })
    toast.success('New document started', 'All fields have been reset')
  }, [docGen, toast])

  const handleSaveDocument = useCallback(async (fields) => {
    let previewHtml = docGen.preview
    if (!previewHtml) {
      try {
        previewHtml = buildDocumentHTML(buildExportData(), companyLogo.getExportLogo())
      } catch { /* preview optional */ }
    }
    const snapshot = {
      ...docGen.getDocumentSnapshot(previewHtml),
      contractSum: docGen.totals.grand,
    }
    const doc = createSavedDocument({
      name: fields.name,
      projectName: fields.projectName,
      category: fields.category,
      snapshot,
    })
    const result = await saveDocumentUnified(doc)
    if (result.ok) {
      docGen.setActiveSavedDocId(doc.id)
      await refreshSavedDocuments()
      if (result.warning) {
        toast.warn('Saved locally', result.warning)
      } else if (result.cloudActive) {
        toast.success('Document saved to cloud', doc.name, {
          label: 'View saved', fn: () => setTab('documents'),
        })
      } else {
        toast.success('Document saved', doc.name, {
          label: 'View saved', fn: () => setTab('documents'),
        })
      }
    } else {
      toast.error('Save failed', result.error || 'Document could not be saved')
    }
  }, [docGen, buildExportData, companyLogo, refreshSavedDocuments, toast])

  const handleApplyVariationFromOrder = useCallback((vo) => {
    const draft = docGen.loadVariationFromOrder(vo)
    if (draft) {
      toast.success('Variation loaded', `${vo.variationNumber} — ${draft.items?.length || 0} items`)
    } else {
      toast.error('Load failed', 'Could not apply this variation order')
    }
  }, [docGen, toast])

  const handleCreateVariationFromDocument = useCallback(async () => {
    const snapshot = docGen.getDocumentSnapshot()
    const parentId = docGen.activeSavedDocId
    const vo = createNewVariationOrder({
      originalEstimateId: parentId || '',
      originalEstimateRef: snapshot.meta?.quoteNum || '',
      originalEstimateTotal: docGen.totals.grand,
      originalBoqSnapshot: JSON.parse(JSON.stringify(snapshot.boqRows || [])),
      projectName: snapshot.meta?.projectTitle || '',
      clientName: snapshot.meta?.clientName || '',
      projectLocation: snapshot.meta?.projectLocation || '',
      clientContact: snapshot.meta?.clientContact || '',
      clientEmail: snapshot.meta?.clientEmail || '',
      sourceType: VO_SOURCE_TYPES.ESTIMATE,
    }, variationOrders)
    const result = await saveVariationOrderUnified(vo)
    if (result.ok) {
      await refreshVariationOrders()
      docGen.loadVariationFromOrder(result.order)
      toast.success('Variation order created', result.order?.variationNumber)
    } else {
      toast.error('Create failed', result.error || 'Could not create variation order')
    }
  }, [docGen, variationOrders, refreshVariationOrders, toast])

  const handleImportVariationFromChat = useCallback(() => {
    const fromChat = chat.msgs.slice().reverse().find(m => m.role === 'assistant' && m.extract?.variationItems?.length)?.extract
    const extract = fromChat || (intelligence.data?.variationItems?.length ? { variationItems: intelligence.data.variationItems } : null)
    if (!extract?.variationItems?.length) {
      toast.warn('No variation items', 'Ask AI to build a variation schedule in chat first')
      return false
    }
    const ok = docGen.importVariationFromExtract(extract)
    if (ok) {
      toast.success('Imported from chat', `${extract.variationItems.length} variation items`)
    }
    return ok
  }, [chat.msgs, docGen, intelligence.data, toast])

  const handleFinalizeVariation = useCallback((exportStyle) => {
    if (!docGen.variationDraft?.items?.length) {
      toast.warn('No variation items', 'Add at least one variation line')
      return
    }
    const payload = docGen.finalizeVariationToDocument(exportStyle)
    if (!payload) {
      toast.error('Apply failed', 'Could not finalize variation')
      return
    }
    try {
      const data = { ...buildExportData(), ...payload, type: payload.docType }
      docGen.setPreview(buildDocumentHTML(data, companyLogo.getExportLogo()))
    } catch { /* preview optional */ }
    toast.success(
      'Variation applied',
      `Revised total: GHS ${Number(payload.variationSummary?.revisedTotal || 0).toLocaleString('en')}`,
    )
  }, [docGen, buildExportData, companyLogo, toast])

  const handleSaveRevisedDocument = useCallback(async (fields = {}) => {
    const vd = docGen.variationDraft
    if (!vd || vd.status !== 'finalized') {
      toast.warn('Not finalized', 'Preview and approve the variation before saving')
      return
    }
    const parent = docGen.activeSavedDocId ? getSavedDocument(docGen.activeSavedDocId) : null
    const previewPayload = docGen.buildVariationPreviewPayload(vd.exportStyle)
    if (!previewPayload) {
      toast.error('Save failed', 'Could not build revised document')
      return
    }
    let previewHtml = docGen.preview
    if (!previewHtml) {
      try {
        const data = { ...buildExportData(), ...previewPayload, type: previewPayload.docType }
        previewHtml = buildDocumentHTML(data, companyLogo.getExportLogo())
      } catch { /* optional */ }
    }
    const revNum = fields.asNewRevision
      ? nextRevisionForDocument(parent?.id || vd.originalDocumentId)
      : (vd.revisionNumber || 1)
    const snapshot = {
      ...previewPayload,
      previewHtml,
      contractSum: previewPayload.variationSummary?.revisedTotal ?? docGen.totals.grand,
    }
    const doc = createRevisedDocument({
      parentDocument: parent || {
        id: vd.originalDocumentId,
        name: fields.name || docGen.meta.projectTitle,
        projectName: fields.projectName || docGen.meta.projectTitle,
        category: docGen.docType,
        contractSum: vd.originalTotal,
      },
      revisionNumber: revNum,
      variationOrderId: vd.variationOrderId,
      variationNumber: vd.variationNumber,
      snapshot,
      name: fields.name,
    })
    const result = await saveDocumentUnified(doc)
    if (result.ok) {
      docGen.setActiveSavedDocId(doc.id)
      docGen.updateVariationDraftMeta({ revisionNumber: revNum, status: 'saved' })
      await refreshSavedDocuments()
      toast.success('Revised document saved', doc.name, {
        label: 'View saved', fn: () => setTab('documents'),
      })
    } else {
      toast.error('Save failed', result.error || 'Could not save revised document')
    }
  }, [docGen, buildExportData, companyLogo, refreshSavedDocuments, toast])

  const handleDownloadRevisedPdf = useCallback(async () => {
    const vd = docGen.variationDraft
    if (!vd || vd.status !== 'finalized') {
      toast.warn('Not finalized', 'Finalize the variation before downloading')
      return
    }
    const tid = toast.loading('Generating revised PDF…')
    setPdfStatus('Preparing revised document…')
    try {
      const payload = docGen.buildVariationPreviewPayload(vd.exportStyle)
      const data = { ...buildExportData(), ...payload, type: payload?.docType || docGen.docType }
      const ref = docGen.meta.quoteNum || 'revised-document'
      const result = await downloadPDF(
        data,
        `${ref}-rev${vd.revisionNumber || 1}.pdf`,
        s => { setPdfStatus(s); toast.update(tid, { body: s }) },
        data.logoUrl,
      )
      if (result.method === 'pdf') {
        toast.done(tid, 'Revised PDF downloaded')
      } else {
        toast.done(tid, 'Document saved', result.message)
      }
    } catch (e) {
      toast.fail(tid, 'Export failed', e.message || 'Try Preview then Print')
    }
    setPdfStatus(null)
  }, [docGen, buildExportData, toast])

  const handleSaveVariationSeparately = useCallback(async () => {
    const vd = docGen.variationDraft
    if (!vd?.items?.length) {
      toast.warn('No items', 'Add variation items first')
      return
    }
    const snapshot = docGen.getDocumentSnapshot()
    let vo = vd.variationOrderId
      ? variationOrders.find(v => v.id === vd.variationOrderId)
      : null
    if (!vo) {
      vo = createNewVariationOrder({
        originalEstimateId: docGen.activeSavedDocId || vd.originalDocumentId || '',
        originalEstimateRef: snapshot.meta?.quoteNum || '',
        originalEstimateTotal: vd.originalTotal || docGen.totals.grand,
        originalBoqSnapshot: vd.originalBoqSnapshot || snapshot.boqRows || [],
        projectName: snapshot.meta?.projectTitle || '',
        clientName: snapshot.meta?.clientName || '',
        items: vd.items,
        reasonForVariation: vd.userNotes || 'Applied from Document Generator',
        sourceType: VO_SOURCE_TYPES.ESTIMATE,
      }, variationOrders)
    } else {
      vo = applyCalculationsToOrder({
        ...vo,
        items: vd.items,
        reasonForVariation: vd.userNotes || vo.reasonForVariation,
        revisedTotal: docGen.variationCalculations?.revisedTotal ?? vo.revisedTotal,
      })
    }
    const result = await saveVariationOrderUnified(vo)
    if (result.ok) {
      await refreshVariationOrders()
      docGen.updateVariationDraftMeta({ variationOrderId: result.order?.id, variationNumber: result.order?.variationNumber })
      toast.success('Variation saved', result.order?.variationNumber, {
        label: 'Open VO module', fn: () => setTab('variation'),
      })
    } else {
      toast.error('Save failed', result.error)
    }
  }, [docGen, variationOrders, refreshVariationOrders, toast])

  const handleOpenSavedDocument = useCallback((doc) => {
    const ok = docGen.loadDocumentSnapshot(doc.snapshot, doc.id)
    if (ok) {
      setTab('docgen')
      toast.success('Document loaded', doc.name)
    } else {
      toast.error('Load failed', 'Could not restore this document')
    }
  }, [docGen, toast])

  const handleDeleteSavedDocument = useCallback(async (id) => {
    const result = await deleteDocumentUnified(id)
    if (result.ok) {
      await refreshSavedDocuments()
      if (docGen.activeSavedDocId === id) docGen.setActiveSavedDocId(null)
      if (result.error) toast.warn('Deleted locally', result.error)
      else toast.success('Document deleted')
    } else {
      toast.error('Document could not be deleted', result.error)
    }
  }, [docGen, refreshSavedDocuments, toast])

  const handleExportSavedDocument = useCallback(async (doc) => {
    const tid = toast.loading('Generating PDF…')
    setPdfStatus('Preparing document…')
    try {
      const data = {
        ...doc.snapshot,
        type: doc.snapshot.docType,
        exportedAt: new Date().toISOString(),
        logoUrl: companyLogo.getExportLogo(),
      }
      await downloadPDF(
        data,
        `${doc.name}.pdf`,
        s => { setPdfStatus(s); toast.update(tid, { body: s }) },
        data.logoUrl,
      )
      toast.done(tid, 'PDF downloaded', doc.name)
    } catch (e) {
      toast.fail(tid, 'Export failed', e.message || 'Try opening the document first')
    }
    setPdfStatus(null)
  }, [companyLogo, toast])

  const handleDocPreview = useCallback(async () => {
    if (!docGen.hasBOQData && !docGen.meta.projectTitle?.trim()) {
      toast.warn('Document is empty', 'Send BOQ data or fill project details first')
      return
    }
    const tid = toast.loading('Building preview…')
    try {
      docGen.setPreview(buildDocumentHTML(buildExportData(), companyLogo.getExportLogo()))
      toast.done(tid, 'Preview ready')
    } catch (e) {
      toast.fail(tid, 'Preview failed', e.message)
    }
  }, [docGen, buildExportData, companyLogo, toast])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      gridTemplateRows: '52px 1fr',
      height: '100vh',
      overflow: 'hidden',
      background: C.ink,
    }}>
      <Topbar
        busy={chat.busy}
        progressLabel={chat.progressLabel}
        attempt={chat.attempt}
        onStop={chat.stop}
        aiUsage={aiUsage}
        aiHealth={aiHealth}
        cloudSave={cloudSave}
      />

      <Sidebar
        activeTab={tab}
        onTabChange={setTab}
        boqCount={boq.rows.length}
        savedDocCount={savedDocuments.length}
        voCount={variationOrders.length}
        onQuickAction={firePrompt}
        onVariationAction={handleVariationQuickAction}
        aiBusy={chat.busy}
      />

      {/* PDF overlay */}
      {pdfStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center', minWidth: 300 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: '1.5px', color: C.amber, marginBottom: 6 }}>Building PDF</div>
            <div style={{ fontSize: 36, margin: '12px 0' }}>📄</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textDim, marginTop: 8 }}>{pdfStatus}</div>
            <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden', marginTop: 14 }}>
              <div style={{ height: '100%', background: `linear-gradient(90deg,${C.amber},${C.gold})`, animation: 'prog 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      )}

      <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TabErrorBoundary label="Main workspace" onGoChat={() => setTab('chat')}>
        {tab === 'chat' && (
          <ChatPage
            chat={chat}
            prices={prices}
            workflowState={workflowState}
            onWorkflowAction={handleWorkflowAction}
            onExtractPrices={() => handleWorkflowAction(WORKFLOW_ACTIONS.EXTRACT_PRICES, getLastChatExtract(chat.msgs))}
            onSavePricesToProfile={() => handleWorkflowAction(WORKFLOW_ACTIONS.SAVE_PRICES_PROFILE, getLastChatExtract(chat.msgs))}
            onChoosePricingSource={() => handleWorkflowAction(WORKFLOW_ACTIONS.CHOOSE_PRICING_SOURCE, getLastChatExtract(chat.msgs))}
            onSaveSession={() => {
              session.saveNow()
              chat.forceSave?.()
              toast.success('Session saved', 'Chat, BOQ, and workflow state stored locally')
            }}
            onRestoreSession={() => session.restoreLastSession({ reload: true })}
            extractedPricesCount={extractedPrices.length}
            livePricesCount={livePrices?.length || 0}
            onStartNewProject={handleStartNewProject}
            setTab={setTab}
          />
        )}

        {tab === 'documents' && (
          <SavedDocumentsPage
            documents={savedDocuments}
            loading={savedDocsLoading}
            migrating={savedDocsMigrating}
            importing={savedDocsImporting}
            pendingMigrationCount={pendingMigrationCount}
            cloudWarning={!cloudSave?.ok && !cloudSave?.checking ? (cloudSave?.message || CLOUD_WARNING) : null}
            cloudActive={cloudSave?.ok}
            onOpen={handleOpenSavedDocument}
            onRename={async (id, name) => {
              const result = await renameDocumentUnified(id, name)
              if (result.ok) {
                await refreshSavedDocuments()
                if (result.warning) toast.warn('Renamed locally', result.warning)
                else toast.success('Document renamed')
              } else {
                toast.error('Rename failed', result.error)
              }
            }}
            onDuplicate={async (id) => {
              const result = await duplicateDocumentUnified(id)
              if (result.ok && result.doc) {
                await refreshSavedDocuments()
                toast.success('Document duplicated', result.doc.name)
              } else {
                toast.error('Duplicate failed', result.error)
              }
            }}
            onExport={handleExportSavedDocument}
            onDelete={handleDeleteSavedDocument}
            onRefresh={refreshSavedDocuments}
            onMigrateToCloud={handleMigrateToCloud}
            onExportLocal={handleExportLocalDocuments}
            onImportBackup={handleImportBackup}
          />
        )}

        {tab === 'projects' && (
          <ProjectsPage
            projState={projState}
            dispatch={dispatch}
            setTab={setTab}
            onOpenInDocGen={(proj) => {
              intelligence.loadFromProject(proj)
              const payload = intelligence.getDocGenPayload({ docType: 'boq', source: 'project' })
                || serializeBOQ(proj.boqRows, { project: proj, totals: { grand: proj.contractSum } })
              saveDocGenDraft(payload)
              docGen.applyBOQTransfer(payload)
              setTab('docgen')
              toast.success('Project loaded in Document Generator', proj.name)
            }}
          />
        )}

        {tab === 'boq' && (
          <BOQPage
            boq={boq}
            onSendToDocGen={handleBOQToDocGen}
            onAIReview={(rows) => firePrompt(buildBOQReviewPrompt(rows))}
            aiBusy={chat.busy}
          />
        )}

        {tab === 'variation' && (
          <VariationOrderPage
            variationOrders={variationOrders}
            onRefresh={refreshVariationOrders}
            onSave={handleSaveVariationOrder}
            onDelete={handleDeleteVariationOrder}
            savedDocuments={savedDocuments}
            projects={projState.projects}
            intelligence={intelligence}
            onAIAssist={handleVariationAIAssist}
            aiBusy={chat.busy}
            initialAction={voInitialAction}
            onClearInitialAction={clearVoInitialAction}
          />
        )}

        {tab === 'docgen' && (
          <DocGenPage
            docGen={docGen}
            onDownload={handleDocDownload}
            onPrint={handleDocPrint}
            onPreview={handleDocPreview}
            onSaveDocument={handleSaveDocument}
            onClearForm={handleClearForm}
            onStartNewDocument={handleStartNewDocument}
            onAIFill={() => firePrompt('Auto-fill my document from the current BOQ context. Generate professional scope, materials, and labor. Do NOT modify or suggest payment terms — those are controlled by the user.')}
            toast={toast}
            pdfStatus={pdfStatus}
            activeProjName={projState.projects.find(p => p.id === projState.activeId)?.name}
            companyLogo={companyLogo}
            aiBusy={chat.busy}
            variationOrders={variationOrders}
            onApplyVariationFromOrder={handleApplyVariationFromOrder}
            onCreateVariationFromDocument={handleCreateVariationFromDocument}
            onImportVariationFromChat={handleImportVariationFromChat}
            onSaveRevisedDocument={handleSaveRevisedDocument}
            onDownloadRevisedPdf={handleDownloadRevisedPdf}
            onSaveVariationSeparately={handleSaveVariationSeparately}
            onFinalizeVariation={handleFinalizeVariation}
          />
        )}

        {tab === 'procurement' && (
          <ProcurementPage
            proc={proc}
            setProc={setProc}
            onAIReview={(txt) => firePrompt(txt)}
            aiBusy={chat.busy}
          />
        )}

        {tab === 'risks' && (
          <RisksPage
            risks={risks}
            setRisks={setRisks}
            onAIAnalyze={(txt) => firePrompt(txt)}
            aiBusy={chat.busy}
          />
        )}

        {tab === 'prices' && (
          <PricesPage
            priceProfileState={priceProfileState}
            setPriceProfileState={setPriceProfileState}
            onPersist={persistPriceProfiles}
            onAIAnalyze={(txt) => firePrompt(txt)}
            aiBusy={chat.busy}
          />
        )}

        {tab === 'calcs' && (
          <CalcsPage onAIAssist={(txt) => firePrompt(txt)} aiBusy={chat.busy} />
        )}

        {tab === 'tools' && (
          <ToolsPage onLaunch={(prompt) => firePrompt(prompt)} aiBusy={chat.busy} onOpenMarket={() => setTab('market')} />
        )}

        {tab === 'market' && (
          <MarketTrendsPage prices={prices} onPricesChange={(next) => { setPrices(next); persistPriceProfiles(updateActiveProfileItems(priceProfileState, next)) }} />
        )}

        {tab === 'settings' && (
          <EstimatePreferencesPage
            preferences={estimatePreferences}
            setPreferences={setEstimatePreferences}
          />
        )}
        </TabErrorBoundary>
      </main>

      <QSExportWorkflow
        open={qsWorkflowOpen}
        onClose={() => { setQsWorkflowOpen(false); setQsAutoCompare(false) }}
        data={qsWorkflowData}
        savedPrices={prices}
        profileName={activeProfile?.name}
        livePrices={livePrices}
        onSavePrices={handleSaveWorkflowPrices}
        onExport={handleQSExport}
        initialStep={qsInitialStep}
        initialStyle={qsInitialStyle}
        autoOpenCompare={qsAutoCompare}
      />

      <ExtractPricesDialog
        open={extractPricesOpen}
        items={extractedPrices}
        onConfirm={handleConfirmExtractedPrices}
        onCancel={() => setExtractPricesOpen(false)}
      />

      <WorkflowReviewDialog
        open={workflowReviewOpen}
        data={workflowReviewData}
        presentationStyle={workflowState.presentationStyle || intelligence.data?.workflow?.presentationStyle}
        onApprove={handleWorkflowReviewApprove}
        onClose={() => setWorkflowReviewOpen(false)}
      />

      <SavePricesToProfileDialog
        open={savePricesOpen}
        items={extractedPrices}
        profiles={priceProfileState.profiles}
        activeProfileId={priceProfileState.activeProfileId}
        onSave={handleConfirmSavePrices}
        onCancel={() => setSavePricesOpen(false)}
        onCreateProfile={handleCreatePriceProfile}
      />

      <PricingSourceDialog
        open={pricingSourceOpen}
        profileName={activeProfile?.name}
        onSelect={handleSelectPricingSource}
        onCancel={() => setPricingSourceOpen(false)}
      />

      <SaveProjectDialog
        open={saveProjectOpen}
        defaults={{
          projectTitle: saveProjectExtract?.projectTitle || intelligence.data?.projectInfo?.title || '',
          clientName: saveProjectExtract?.clientName || intelligence.data?.client?.name || '',
          projectLocation: saveProjectExtract?.projectLocation || intelligence.data?.projectInfo?.location || '',
          projectDescription: saveProjectExtract?.projectScope || intelligence.data?.projectInfo?.description || '',
        }}
        onSave={handleSaveProjectFromDialog}
        onCancel={() => { setSaveProjectOpen(false); setSaveProjectExtract(null) }}
      />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ProjectProvider>
        <AppShell />
      </ProjectProvider>
    </ToastProvider>
  )
}
