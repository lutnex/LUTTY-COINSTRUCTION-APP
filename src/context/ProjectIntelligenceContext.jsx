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
import { normalizeBoqRow } from '../utils/boqItemFactory.js'

const ProjectIntelligenceContext = createContext(null)

export function ProjectIntelligenceProvider({ children, activeProject }) {
  const [data, setData] = useState(() => loadIntelligence() || emptyProjectData())
  const skipSave = useRef(false)

  const recomputePricing = useCallback((d) => {
    const pricing = computePricing({
      boqRows: d.boqItems,
      materials: d.materials,
      labor: d.labor,
      prelims: d.prelims,
      financialAdjustments: d.financialAdjustments,
    })
    return { ...d, pricing }
  }, [])

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
