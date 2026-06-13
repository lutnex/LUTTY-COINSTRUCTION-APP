import { createContext, useContext, useReducer, useEffect } from 'react'
import { intelligenceToProjectPatch } from '../utils/projectIntelligence.js'
import { normalizeBoqRow } from '../utils/boqItemFactory.js'
import { loadProjectState, persistProjectState } from '../utils/projectStore.js'

const ProjectContext = createContext(null)
const today = () => new Date().toISOString().slice(0, 10)

function reducer(state, action) {
  switch (action.type) {
    case 'CREATE':
      return { ...state, projects: [...state.projects, action.project], activeId: action.project.id }
    case 'UPDATE':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id ? { ...p, ...action.patch, updatedAt: today() } : p),
      }
    case 'SET_ACTIVE':
      return { ...state, activeId: action.id }
    case 'REPLACE_BOQ':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id
          ? { ...p, boqRows: (action.rows || []).map((r, i) => normalizeBoqRow(r, i)), updatedAt: today() }
          : p),
      }
    case 'MERGE_BOQ': {
      const ex = new Set(state.projects.find(p => p.id === action.id)?.boqRows.map(r => r.desc.toLowerCase()) ?? [])
      const fresh = action.rows.filter(r => !ex.has(r.desc.toLowerCase())).map((r, i) => normalizeBoqRow(r, i))
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id
          ? { ...p, boqRows: [...p.boqRows, ...fresh], updatedAt: today() }
          : p),
      }
    }
    case 'MERGE_RISKS': {
      const cur = state.projects.find(p => p.id === action.id)?.risks ?? []
      const merged = [...cur, ...action.risks.filter(r => !cur.some(c => c.risk === r.risk))]
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id ? { ...p, risks: merged, updatedAt: today() } : p),
      }
    }
    case 'APPLY_INTELLIGENCE': {
      const patch = intelligenceToProjectPatch(action.data)
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id
          ? {
            ...p,
            ...patch,
            boqRows: patch.boqRows,
            intelligence: action.data,
            updatedAt: today(),
          }
          : p),
      }
    }
    case 'SAVE_DOCUMENT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.id ? { ...p, documents: [...p.documents, action.doc] } : p),
      }
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
      }
    default:
      return state
  }
}

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadProjectState)

  useEffect(() => {
    persistProjectState(state)
  }, [state])

  return <ProjectContext.Provider value={{ state, dispatch }}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects must be inside ProjectProvider')
  return ctx
}
