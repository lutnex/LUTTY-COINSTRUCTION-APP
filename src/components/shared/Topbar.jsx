// src/components/shared/Topbar.jsx
import { C } from '../../utils/constants.js'
import { Spinner } from './Spinner.jsx'
import { useProjects } from '../../context/ProjectContext.jsx'

export function Topbar({ busy, progressLabel, attempt, onStop, aiUsage, aiHealth }) {
  const { state } = useProjects()
  const activeProject = state.projects.find(p => p.id === state.activeId)

  const latencyLabel = aiHealth?.latencyMs != null && !aiHealth?.checking
    ? `${aiHealth.latencyMs}ms`
    : null

  return (
    <header style={{
      gridColumn: '1/-1',
      background: C.carbon,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      gap: 10,
      zIndex: 30,
      height: 52,
    }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 21, letterSpacing: '2.5px', color: C.amber, flex: 1 }}>
        LUTTY CONSTRUCTIQ{' '}
        <em style={{ color: C.textDim, fontStyle: 'normal', fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 0, marginLeft: 8 }}>
          v6.0 — AI Construction OS
        </em>
      </div>

      <div style={{ background: C.amberGlow, border: `1px solid ${C.amberLo}`, borderRadius: 20, padding: '2px 10px', fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.amber, letterSpacing: '1px' }}>
        PRO
      </div>

      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.amberGlow, border: `1px solid ${C.amberLo}`, borderRadius: 20, padding: '4px 12px 4px 8px' }}>
          <Spinner size={13} />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10.5, color: C.amber, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {progressLabel || 'Processing…'}
          </span>
          {attempt > 1 && (
            <span style={{ background: C.amberLo, borderRadius: 10, padding: '1px 6px', fontSize: 9, color: C.gold, fontFamily: 'IBM Plex Mono' }}>
              retry {attempt}
            </span>
          )}
          <button
            onClick={onStop}
            style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 10, color: C.red, fontSize: 10.5, padding: '1px 8px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, lineHeight: 1.4 }}
          >
            ■ Stop
          </button>
        </div>
      )}

      <div
        title={[aiHealth?.message, latencyLabel && `Latency: ${latencyLabel}`].filter(Boolean).join(' · ')}
        onClick={() => aiHealth?.refresh?.()}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'IBM Plex Mono', fontSize: 10,
          color: aiHealth?.checking ? C.textDim : aiHealth?.ok ? C.green : C.red,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: aiHealth?.checking ? C.textDim : aiHealth?.ok ? C.green : C.red,
          boxShadow: aiHealth?.ok ? `0 0 8px ${C.green}` : aiHealth?.checking ? 'none' : `0 0 8px ${C.red}`,
        }}/>
        {aiHealth?.checking ? 'AI Checking…' : aiHealth?.ok ? 'AI Online' : 'AI Offline'}
        {latencyLabel && aiHealth?.ok && (
          <span style={{ color: C.textFaint, marginLeft: 2 }}>{latencyLabel}</span>
        )}
      </div>

      {aiUsage?.requestCount > 0 && (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: C.textFaint, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: C.textDim }}>{(aiUsage.totalTokens / 1000).toFixed(1)}k tok</span>
          <span>{aiUsage.requestCount} req · {aiUsage.estimatedCost}</span>
        </div>
      )}

      {activeProject && (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: C.sky, borderLeft: `1px solid ${C.border}`, paddingLeft: 10, display: 'flex', alignItems: 'center', gap: 5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.sky, flexShrink: 0 }}/>
          {activeProject.name}
        </div>
      )}
    </header>
  )
}
