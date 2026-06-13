import { C } from '../../utils/constants.js'
import { DEFAULT_ESTIMATE_PREFERENCES } from '../../utils/financialAdjustments.js'

const PREF_ITEMS = [
  { key: 'autoContingency', label: 'Automatically add Contingency' },
  { key: 'autoOverheads', label: 'Automatically add Overheads' },
  { key: 'autoProfit', label: 'Automatically add Profit' },
  { key: 'autoVat', label: 'Automatically add VAT' },
]

export default function EstimatePreferencesPage({ preferences, setPreferences }) {
  const prefs = { ...DEFAULT_ESTIMATE_PREFERENCES, ...preferences }

  const toggle = (key) => {
    setPreferences({ ...prefs, [key]: !prefs[key] })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>
        ESTIMATE PREFERENCES
      </div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 20, maxWidth: 640, lineHeight: 1.6 }}>
        Control how commercial adjustments behave. All options are off by default — the AI calculates
        direct project costs only. Contingency, overheads, profit, and VAT are commercial decisions
        you apply manually in the Document Generator.
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, maxWidth: 520 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, color: C.amber, marginBottom: 14 }}>
          Financial Defaults
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PREF_ITEMS.map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: C.text,
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 8,
                background: prefs[key] ? C.amberGlow : C.carbon,
                border: `1px solid ${prefs[key] ? C.amberLo : C.border}`,
              }}
            >
              <input type="checkbox" checked={Boolean(prefs[key])} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.textFaint, marginTop: 16, lineHeight: 1.5 }}>
          When enabled, the corresponding adjustment toggle is pre-selected on new estimates. Values
          are still entered manually — the AI never applies profit margins or contingency percentages.
        </p>
      </div>
    </div>
  )
}
