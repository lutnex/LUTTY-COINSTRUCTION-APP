import { INITIAL_PROJECTS } from '../data/seedData.js'

export const PROJECTS_STORAGE_KEY = 'constructiq-projects'

export function loadProjectState() {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (!raw) return { projects: INITIAL_PROJECTS, activeId: null }
    const parsed = JSON.parse(raw)
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : INITIAL_PROJECTS,
      activeId: parsed.activeId ?? null,
    }
  } catch {
    return { projects: INITIAL_PROJECTS, activeId: null }
  }
}

export function persistProjectState(state) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({
      projects: state.projects,
      activeId: state.activeId,
    }))
    return true
  } catch (e) {
    console.error('[projectStore] persist failed', e)
    return false
  }
}

export function removeProjectFromStorage(id) {
  const state = loadProjectState()
  const next = {
    projects: state.projects.filter(p => p.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  }
  return persistProjectState(next) ? next : null
}
