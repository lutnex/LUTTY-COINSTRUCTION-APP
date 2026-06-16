// src/components/shared/Sidebar.jsx
import { C } from '../../utils/constants.js'
import { useProjects } from '../../context/ProjectContext.jsx'

const NAV = [
  { id: 'chat',        ico: '🤖', label: 'Estimator Agent'    },
  { id: 'projects',    ico: '📁', label: 'My Projects'        },
  { id: 'documents',   ico: '📄', label: 'Saved Documents'    },
  { id: 'boq',         ico: '📋', label: 'BOQ Builder'        },
  { id: 'variation',   ico: '📝', label: 'Variation Order'    },
  { id: 'docgen',      ico: '🖨️',  label: 'Document Generator'},
  { id: 'procurement', ico: '🛒', label: 'Procurement'        },
  { id: 'risks',       ico: '⚠️',  label: 'Risk Register'     },
  { id: 'prices',      ico: '💰', label: 'Price Profiles'     },
  { id: 'market',      ico: '📈', label: 'Material Market Trends' },
  { id: 'calcs',       ico: '🔢', label: 'Calculators'        },
  { id: 'tools',       ico: '🔧', label: 'Quick Tools'        },
  { id: 'settings',    ico: '⚙️', label: 'Estimate Preferences'},
]

const QUICK_ACTIONS = [
  { label: 'Full BOQ',     prompt: 'Follow QS WORKFLOW Phase 1 only: measured quantities, materials needing prices, assumptions, exclusions, provisional items. Do NOT apply unit rates until I provide them.' },
  { label: 'Full Estimate',prompt: 'Follow QS WORKFLOW. Phase 1 measurement & clarification only. Ask for each material price, specification, and supply type. No assumed market prices.' },
  { label: 'Variation Order', action: 'variation:new', display: 'New Variation Order' },
  { label: 'Variation Order', action: 'variation:review', display: 'Review Variation' },
  { label: 'Variation Order', action: 'variation:export', display: 'Export Variation' },
  { label: 'Risk Analysis',prompt: 'Full commercial risk assessment — ask me about scope, contract type, and known risks.' },
]

export function Sidebar({ activeTab, onTabChange, boqCount, savedDocCount = 0, voCount = 0, onQuickAction, onVariationAction, aiBusy }) {
  const { state } = useProjects()

  return (
    <nav style={{
      background: C.carbon,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 12,
    }}>
      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: C.textFaint, letterSpacing: '2px', textTransform: 'uppercase', padding: '0 14px 6px' }}>
          Workspace
        </div>

        {NAV.map(n => (
          <div
            key={n.id}
            onClick={() => onTabChange(n.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 14px',
              cursor: 'pointer',
              color: activeTab === n.id ? C.amber : C.textDim,
              fontSize: 12.5, fontWeight: 500,
              transition: 'all .15s',
              background: activeTab === n.id ? C.panel2 : 'transparent',
              borderLeft: `2px solid ${activeTab === n.id ? C.amber : 'transparent'}`,
              borderRadius: '0 4px 4px 0',
              marginRight: 6,
            }}
          >
            <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{n.ico}</span>
            {n.label}
            {n.id === 'boq' && boqCount > 0 && (
              <span style={{ marginLeft: 'auto', background: C.amber, color: C.ink, borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', fontFamily: 'IBM Plex Mono' }}>
                {boqCount}
              </span>
            )}
            {n.id === 'projects' && (
              <span style={{ marginLeft: 'auto', background: C.panel, border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 10, fontSize: 10, padding: '1px 6px', fontFamily: 'IBM Plex Mono' }}>
                {state.projects.length}
              </span>
            )}
            {n.id === 'documents' && savedDocCount > 0 && (
              <span style={{ marginLeft: 'auto', background: C.panel, border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 10, fontSize: 10, padding: '1px 6px', fontFamily: 'IBM Plex Mono' }}>
                {savedDocCount}
              </span>
            )}
            {n.id === 'variation' && voCount > 0 && (
              <span style={{ marginLeft: 'auto', background: C.panel, border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 10, fontSize: 10, padding: '1px 6px', fontFamily: 'IBM Plex Mono' }}>
                {voCount}
              </span>
            )}
          </div>
        ))}

        {/* Quick launch */}
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: C.textFaint, letterSpacing: '2px', textTransform: 'uppercase', padding: '16px 14px 6px' }}>
          Quick Launch
        </div>

        {QUICK_ACTIONS.map(a => (
          <div
            key={a.display || a.label}
            onClick={() => {
              if (aiBusy) return
              if (a.action?.startsWith('variation:')) {
                onVariationAction?.(a.action.split(':')[1])
              } else if (a.prompt) {
                onQuickAction(a.prompt)
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px',
              cursor: aiBusy ? 'not-allowed' : 'pointer',
              color: aiBusy ? C.textFaint : C.textDim,
              fontSize: 12, transition: 'all .15s',
              opacity: aiBusy ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!aiBusy) e.currentTarget.style.color = C.amber }}
            onMouseLeave={e => { if (!aiBusy) e.currentTarget.style.color = C.textDim }}
          >
            <span style={{ fontSize: 11, color: C.amberLo }}>▶</span>
            {a.display || `New ${a.label}`}
          </div>
        ))}
      </div>

      {/* Footer status */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, fontSize: 9, fontFamily: 'IBM Plex Mono', color: C.textFaint, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}60` }}/>
        System operational
      </div>
    </nav>
  )
}
