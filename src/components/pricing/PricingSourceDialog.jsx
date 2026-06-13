import { C } from '../../utils/constants.js'
import { PRICING_SOURCE_OPTIONS } from '../../utils/priceProfileTypes.js'

export default function PricingSourceDialog({ open, profileName, onSelect, onCancel }) {
  if (!open) return null

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: 1.5, marginBottom: 6 }}>CHOOSE PRICING SOURCE</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
          Which pricing source should I use? The AI will not silently choose rates.
          {profileName && <span> Active profile: <strong style={{ color: C.text }}>{profileName}</strong></span>}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {PRICING_SOURCE_OPTIONS.map(opt => (
            <button key={opt.id} type="button" onClick={() => onSelect?.(opt.id)} style={card}>
              <div style={{ fontWeight: 700, color: C.amber, marginBottom: 4, textAlign: 'left' }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, textAlign: 'left' }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={btn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 360 }
const panel = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, maxWidth: 560, width: '94vw' }
const card = { textAlign: 'left', padding: 14, borderRadius: 10, cursor: 'pointer', background: C.slate, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'DM Sans' }
const btn = { padding: '8px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, fontFamily: 'DM Sans' }
