import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react'
import {
  emptyProjectData,
  mergeExtractIntoProjectData,
  projectDataToDocPayload,
  saveIntelligence,
  loadIntelligence,
  projectToIntelligence,
} from '../utils/projectIntelligence.js'
import { computePricing } from '../services/pricing/pricingEngine.js'
import { buildProjectEstimate, lockProjectEstimate, ESTIMATE_SOURCES } from '../utils/projectEstimate.js'
import { normalizeBoqRow } from '../utils/boqItemFactory.js'
import { reconcileMaterialSchedule } from '../utils/materialAudit.js'

const ProjectIntelligenceContext = createContext(null)

export function ProjectIntelligenceProvider({ children, activeProject }) {
  const [data, setData] = useState(() => loadIntelligence() || emptyProjectData())
  const skipSave = useRef(false)

  const recomputePricing = useCallback((d) => {
    if (d.projectEstimate?.locked) {
      return {
        ...d,
        pricing: d.projectEstimate.pricingSnapshot,
        financialAdjustments: d.projectEstimate.financialAdjustmentsSnapshot ?? d.financialAdjustments,
      }
    }
    const materials = reconcileMaterialSchedule(d.materials, {
      commercialBreakdown: d.commercialBreakdown,
      importBaseline: d.importBaseline,
    })
    const pricingInput = {
      boqRows: d.boqItems,
      materials,
      labor: d.labor,
      prelims: d.prelims,
      financialAdjustments: d.financialAdjustments,
    }
    const pricing = computePricing(pricingInput)
    const projectEstimate = buildProjectEstimate({
      ...pricingInput,
      source: d.metadata?.source === 'boq-builder' ? ESTIMATE_SOURCES.BOQ_BUILDER : ESTIMATE_SOURCES.AI_CHAT,
    })
    return { ...d, materials, pricing, projectEstimate }
  }, [])

  const approveAndLockEstimate = useCallback((approval) => {
    setData(prev => {
      const locked = lockProjectEstimate(prev.projectEstimate || {}, approval, {
        boqRows: prev.boqItems,
        materials: prev.materials,
        labor: prev.labor,
        prelims: prev.prelims,
        financialAdjustments: prev.financialAdjustments,
        source: approval.source || ESTIMATE_SOURCES.USER_OVERRIDE,
      })
      return recomputePricing({
        ...prev,
        projectEstimate: locked,
        financialAdjustments: locked.financialAdjustmentsSnapshot,
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      })
    })
  }, [recomputePricing])

  const setBoqItems = useCallback((items) => {
    setData(prev => {
      const next = recomputePricing({
        ...prev,
        boqItems: items.map((r, i) => normalizeBoqRow(r, i)),
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString(), source: 'boq-builder' },
      })
      return next
    })
  }, [recomputePricing])

  const mergeFromExtract = useCallback((extract, { replaceBoq = false } = {}) => {
    setData(prev => {
      const next = mergeExtractIntoProjectData(prev, extract, { replaceBoq })
      return recomputePricing(next)
    })
  }, [recomputePricing])

  const loadFromProject = useCallback((project) => {
    if (!project) return
    skipSave.current = true
    setData(recomputePricing(projectToIntelligence(project)))
    setTimeout(() => { skipSave.current = false }, 100)
  }, [recomputePricing])

  const getDocGenPayload = useCallback((opts) => {
    return projectDataToDocPayload(data, opts)
  }, [data])

  const patchProjectInfo = useCallback((patch) => {
    setData(prev => ({
      ...prev,
      projectInfo: { ...prev.projectInfo, ...patch },
      client: patch.clientName != null ? { ...prev.client, name: patch.clientName } : prev.client,
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }))
  }, [])

  useEffect(() => {
    if (skipSave.current) return
    const t = setTimeout(() => saveIntelligence(data), 300)
    return () => clearTimeout(t)
  }, [data])

  useEffect(() => {
    if (activeProject?.id) loadFromProject(activeProject)
  }, [activeProject?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    data,
    setData,
    setBoqItems,
    mergeFromExtract,
    loadFromProject,
    getDocGenPayload,
    patchProjectInfo,
    recomputePricing,
    approveAndLockEstimate,
  }

  return (
    <ProjectIntelligenceContext.Provider value={value}>
      {children}
    </ProjectIntelligenceContext.Provider>
  )
}

export function useProjectIntelligence() {
  const ctx = useContext(ProjectIntelligenceContext)
  if (!ctx) throw new Error('useProjectIntelligence must be inside ProjectIntelligenceProvider')
  return ctx
}
