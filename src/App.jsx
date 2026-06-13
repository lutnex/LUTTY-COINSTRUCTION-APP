// src/App.jsx
import { useState, useCallback, useEffect } from 'react'
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
import { useChat } from './hooks/useChat.js'
import { useAIHealth } from './hooks/useAIHealth.js'
import { useAIUsage } from './hooks/useAIUsage.js'
import { useBOQ } from './hooks/useBOQ.js'
import { useDocGen } from './hooks/useDocGen.js'
import { buildBOQReviewPrompt, normalizePromptInput } from './utils/promptBuilder.js'
import { serializeBOQ, saveDocGenDraft } from './utils/boqWorkflow.js'
import { mergeExtractIntoProjectData } from './utils/projectIntelligence.js'
import { downloadPDF, printDocument, buildDocumentHTML } from './services/ai/pdfEngine.js'
import { useCompanyLogo } from './hooks/useCompanyLogo.js'
import { DEFAULT_PRICES, DEFAULT_RISKS, DEFAULT_PROC, C } from './utils/constants.js'
import { loadEstimatePreferences, persistEstimatePreferences } from './utils/financialAdjustments.js'
import EstimatePreferencesPage from './components/tools/EstimatePreferencesPage.jsx'
import SavedDocumentsPage from './components/documents/SavedDocumentsPage.jsx'
import {
  loadSavedDocuments,
  createSavedDocument,
  saveDocument,
  deleteSavedDocument,
  renameSavedDocument,
  duplicateSavedDocument,
} from './utils/savedDocuments.js'

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

  const [tab,        setTab]        = useState('chat')
  const [prices,     setPrices]     = useState(DEFAULT_PRICES)
  const [risks,      setRisks]      = useState(DEFAULT_RISKS)
  const [proc,       setProc]       = useState(DEFAULT_PROC)
  const [pdfStatus,  setPdfStatus]  = useState(null)
  const [estimatePreferences, setEstimatePreferencesRaw] = useState(() => loadEstimatePreferences())
  const [savedDocuments, setSavedDocuments] = useState(() => loadSavedDocuments())
  const [draftRecovered, setDraftRecovered] = useState(false)

  const refreshSavedDocuments = useCallback(() => {
    setSavedDocuments(loadSavedDocuments())
  }, [])

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
    intelligence.mergeFromExtract(extract)
  }, [intelligence])

  const chat = useChat({ prices, onUsage: handleUsage, onExtract: handleAIExtract })

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

  // ── BOQ import from AI ───────────────────────────────────────────────────
  const handleImportBOQ = useCallback((rows) => {
    intelligence.mergeFromExtract({ boqRows: rows })
    toast.success(`${rows.length} rows imported to BOQ Builder`, undefined, {
      label: 'View BOQ', fn: () => setTab('boq'),
    })
  }, [intelligence, toast])

  // ── Send extract data to DocGen (from AI chat) ───────────────────────────
  const handleSendToDocGen = useCallback((extract) => {
    const tid = toast.loading('Sending BOQ to Document Generator…')
    intelligence.mergeFromExtract(extract)
    const payload = intelligence.getDocGenPayload({
      docType: extract.boqRows?.length ? 'boq' : 'estimate',
      source: 'ai-chat',
    })
    if (!payload) {
      toast.fail(tid, 'Transfer failed', 'No document data available')
      return
    }
    saveDocGenDraft(payload)
    docGen.applyBOQTransfer(payload)
    setTab('docgen')
    toast.done(tid, 'Data sent to Document Generator', `${payload.boqRows?.length || payload.materials?.length || 0} items ready`)
  }, [docGen, intelligence, toast])

  // ── BOQ Builder → Document Generator ─────────────────────────────────────
  const handleBOQToDocGen = useCallback(async (rows) => {
    if (!rows?.length) {
      toast.warn('No BOQ items', 'Add at least one line item before sending to Document Generator')
      return
    }
    const tid = toast.loading('Sending BOQ to Document Generator…')
    try {
      const activeProject = projState.projects.find(p => p.id === projState.activeId)
      intelligence.setBoqItems(rows)
      const payload = intelligence.getDocGenPayload({ docType: 'boq', source: 'boq-builder' })
        || serializeBOQ(rows, { project: activeProject, totals: { ...boq.totals, financialAdjustments: docGen.financialAdjustments } })
      saveDocGenDraft(payload)
      const ok = docGen.applyBOQTransfer(payload)
      if (!ok) throw new Error('Transfer failed — no valid BOQ data')
      setTab('docgen')
      toast.done(tid, 'BOQ transferred successfully', `${rows.length} items · ${activeProject?.name || payload.meta.projectTitle}`)
    } catch (e) {
      toast.fail(tid, 'BOQ transfer failed', e.message)
    }
  }, [boq.totals, docGen, intelligence, projState, toast])

  // ── PDF export from AI extract ────────────────────────────────────────────
  const handleSaveToProject = useCallback(async (extract, projectId) => {
    const merged = mergeExtractIntoProjectData(intelligence.data, extract)
    intelligence.setData(merged)
    dispatch({ type: 'APPLY_INTELLIGENCE', id: projectId, data: merged })
  }, [dispatch, intelligence])

  const handlePDFExport = useCallback(async (extract) => {
    const tid = toast.loading('Generating PDF…')
    setPdfStatus('Preparing…')
    intelligence.mergeFromExtract(extract)
    const payload = intelligence.getDocGenPayload({ docType: 'estimate', source: 'ai-export' })
    const data = {
      type: 'estimate',
      meta: payload?.meta || {
        quoteNum: 'DLC-AI-EXPORT',
        date: new Date().toISOString().slice(0, 10),
        validDays: '30',
        clientName: '',
        clientContact: '',
        clientEmail: '',
        projectLocation: '',
        projectTitle: extract.projectTitle || 'Construction Estimate',
        projectDescription: extract.projectScope || '',
      },
      boqRows: payload?.boqRows || extract.boqRows || [],
      materials: payload?.materials || extract.materials || [],
      matCategories: payload?.matCategories || extract.matCategories || [],
      labor: payload?.labor || extract.labor || [],
      prelims: payload?.prelims || [],
      assumptions: payload?.assumptions || extract.assumptions || [],
      exclusions: payload?.exclusions || extract.exclusions || [],
      drawingAnalysis: payload?.drawingAnalysis || { takeoffNotes: extract.takeoffNotes || '' },
      pricing: payload?.pricing,
      contractSum: payload?.contractSum || extract.contractSum || 0,
    }
    try {
      await downloadPDF(
        data,
        `${extract.projectTitle || 'estimate'}.pdf`,
        s => { setPdfStatus(s); toast.update(tid, { body: s }) },
        companyLogo.getExportLogo(),
      )
      toast.done(tid, 'PDF downloaded')
    } catch {
      toast.fail(tid, 'PDF failed', 'Try the DocGen tab instead')
    }
    setPdfStatus(null)
  }, [toast, companyLogo, intelligence])

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
    const saved = saveDocument(doc)
    if (saved) {
      docGen.setActiveSavedDocId(saved.id)
      refreshSavedDocuments()
      toast.success('Document saved', saved.name, {
        label: 'View saved', fn: () => setTab('documents'),
      })
    } else {
      toast.error('Save failed', 'Document could not be saved')
    }
  }, [docGen, buildExportData, companyLogo, refreshSavedDocuments, toast])

  const handleOpenSavedDocument = useCallback((doc) => {
    const ok = docGen.loadDocumentSnapshot(doc.snapshot, doc.id)
    if (ok) {
      setTab('docgen')
      toast.success('Document loaded', doc.name)
    } else {
      toast.error('Load failed', 'Could not restore this document')
    }
  }, [docGen, toast])

  const handleDeleteSavedDocument = useCallback((id) => {
    const ok = deleteSavedDocument(id)
    if (ok) {
      refreshSavedDocuments()
      if (docGen.activeSavedDocId === id) docGen.setActiveSavedDocId(null)
      toast.success('Document deleted')
    } else {
      toast.error('Document could not be deleted')
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
      />

      <Sidebar
        activeTab={tab}
        onTabChange={setTab}
        boqCount={boq.rows.length}
        savedDocCount={savedDocuments.length}
        onQuickAction={firePrompt}
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
        {tab === 'chat' && (
          <ChatPage
            chat={chat}
            prices={prices}
            onImportBOQ={handleImportBOQ}
            onSendToDocGen={handleSendToDocGen}
            onPDFExport={handlePDFExport}
            onSaveToProject={handleSaveToProject}
            projState={projState}
            dispatch={dispatch}
            setTab={setTab}
          />
        )}

        {tab === 'documents' && (
          <SavedDocumentsPage
            documents={savedDocuments}
            onOpen={handleOpenSavedDocument}
            onRename={(id, name) => {
              if (renameSavedDocument(id, name)) {
                refreshSavedDocuments()
                toast.success('Document renamed')
              } else {
                toast.error('Rename failed')
              }
            }}
            onDuplicate={(id) => {
              const copy = duplicateSavedDocument(id)
              if (copy) {
                refreshSavedDocuments()
                toast.success('Document duplicated', copy.name)
              } else {
                toast.error('Duplicate failed')
              }
            }}
            onExport={handleExportSavedDocument}
            onDelete={handleDeleteSavedDocument}
            onRefresh={refreshSavedDocuments}
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
            prices={prices}
            setPrices={setPrices}
            onAIAnalyze={(txt) => firePrompt(txt)}
            aiBusy={chat.busy}
          />
        )}

        {tab === 'calcs' && (
          <CalcsPage onAIAssist={(txt) => firePrompt(txt)} aiBusy={chat.busy} />
        )}

        {tab === 'tools' && (
          <ToolsPage onLaunch={(prompt) => firePrompt(prompt)} aiBusy={chat.busy} />
        )}

        {tab === 'settings' && (
          <EstimatePreferencesPage
            preferences={estimatePreferences}
            setPreferences={setEstimatePreferences}
          />
        )}
      </main>
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
