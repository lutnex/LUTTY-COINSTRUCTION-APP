import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { fmtN } from '../../utils/formatters.js'
import { useToast } from '../../context/ToastContext.jsx'
import ConfirmDialog from '../shared/ConfirmDialog.jsx'
import { loadProjectState } from '../../utils/projectStore.js'

export default function ProjectsPage({ projState, dispatch, setTab, onOpenInDocGen }) {
  const toast = useToast()
  const { projects, activeId } = projState
  const [deleteTarget, setDeleteTarget] = useState(null)

  const createProject = () => {
    const id = `proj-${Date.now()}`
    dispatch({
      type: 'CREATE',
      project: {
        id, name: 'New Project', type: 'Residential', status: 'draft',
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
        meta: { quoteNum: `DLC-${Date.now().toString().slice(-5)}`, date: new Date().toISOString().slice(0, 10), validDays: '30', clientName: '', clientContact: '', clientEmail: '', projectLocation: '', projectTitle: 'New Project', projectDescription: '' },
        boqRows: [], materials: [], labor: [], prelims: [], risks: [], procurement: [],
        contractSum: 0, documents: [],
      },
    })
    toast.success('New project created', 'Click it to set as active project')
  }

  const TYPE_ICON = { Industrial: '🏭', Residential: '🏠', Civil: '🛣️', Commercial: '🏢' }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Stat bar */}
      <div style={{ display: 'flex', gap: 20, padding: '10px 20px', background: C.carbon, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {[
          [projects.length, 'Projects'],
          [`GHS ${fmtN(projects.reduce((s, p) => s + p.contractSum, 0))}`, 'Pipeline'],
          [projects.filter(p => p.status === 'active').length, 'Active'],
          [projects.filter(p => p.boqRows.length > 0).length, 'With BOQ'],
        ].map(([val, lbl]) => (
          <div key={lbl}><div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: C.amber, fontWeight: 500 }}>{val}</div><div style={{ fontSize: 9.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div></div>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>MY PROJECTS</div>
            <div style={{ fontSize: 12.5, color: C.textDim }}>Construction jobs, drawing analyses, and AI project data. Saved estimates and BOQs live under Saved Documents.</div>
          </div>
          <button onClick={createProject} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: C.amber, border: 'none', color: C.ink, fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 }}>+ New Project</button>
        </div>

        {projects.map(p => (
          <div key={p.id}>
            <div
              onClick={() => dispatch({ type: 'SET_ACTIVE', id: activeId === p.id ? null : p.id })}
              style={{ background: activeId === p.id ? C.panel2 : C.panel, border: `1px solid ${activeId === p.id ? C.amber : C.border}`, borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'all .15s', marginBottom: 8, display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: activeId === p.id ? `0 0 0 1px ${C.amberLo}` : 'none' }}>
              <div style={{ fontSize: 24 }}>{TYPE_ICON[p.type] || '🏗️'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                  {activeId === p.id && <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.amber, border: `1px solid ${C.amberLo}`, borderRadius: 4, padding: '1px 6px' }}>ACTIVE</span>}
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", padding: '2px 8px', borderRadius: 20, background: p.status === 'active' ? 'rgba(52,211,153,.1)' : p.status === 'complete' ? 'rgba(100,116,139,.1)' : 'rgba(245,158,11,.1)', color: p.status === 'active' ? C.green : p.status === 'complete' ? C.textDim : C.amber }}>{p.status}</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{p.type}</span>
                  <span>{p.meta.clientName || 'No client'}</span>
                  <span>{p.meta.projectLocation || 'No location'}</span>
                  <span>Updated {p.updatedAt}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textFaint }}>{p.boqRows.length} BOQ rows</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textFaint }}>{p.risks.length} risks</span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textFaint }}>{p.materials?.length || 0} materials</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {p.contractSum > 0 && <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: C.amber }}>GHS {fmtN(p.contractSum)}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={e => { e.stopPropagation(); onOpenInDocGen?.(p); setTab('docgen') }}
                    style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, fontFamily: 'DM Sans' }}>Open in DocGen</button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.red, fontFamily: 'DM Sans' }}>Delete</button>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Project"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          const id = deleteTarget.id
          const name = deleteTarget.name
          dispatch({ type: 'DELETE_PROJECT', id })
          setDeleteTarget(null)
          setTimeout(() => {
            const stillThere = loadProjectState().projects.some(p => p.id === id)
            if (stillThere) toast.error('Project could not be deleted', 'Please try again')
            else toast.success('Project deleted', name)
          }, 150)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

