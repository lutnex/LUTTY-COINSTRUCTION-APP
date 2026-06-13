import { C } from '../../utils/constants.js'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, minWidth: 320, maxWidth: 420, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 1.5, color: C.amber, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={btn('outline')}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} style={btn(danger ? 'danger' : 'primary')}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function btn(variant) {
  const base = { padding: '8px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  if (variant === 'danger') return { ...base, background: '#DC2626', color: '#fff' }
  if (variant === 'primary') return { ...base, background: '#F59E0B', color: '#070A0D' }
  return { ...base, background: 'transparent', border: '1px solid #253040', color: '#6E84A3' }
}
