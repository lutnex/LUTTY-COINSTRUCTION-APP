import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { DOCUMENT_CATEGORIES } from '../../utils/savedDocuments.js'

export default function SaveDocumentDialog({ open, defaultName, defaultProject, defaultCategory, onSave, onCancel }) {
  const [name, setName] = useState(defaultName || '')
  const [projectName, setProjectName] = useState(defaultProject || '')
  const [category, setCategory] = useState(defaultCategory || 'estimate')

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), projectName: projectName.trim(), category })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, minWidth: 360, maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 1.5, color: C.amber, marginBottom: 16 }}>SAVE DOCUMENT</div>

        <Field label="Document Name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} required autoFocus placeholder="e.g. Joy City Pool Estimate" />
        </Field>
        <Field label="Project Name">
          <input value={projectName} onChange={e => setProjectName(e.target.value)} style={inputStyle} placeholder="Optional project reference" />
        </Field>
        <Field label="Category">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DOCUMENT_CATEGORIES.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
                <input type="radio" name="docCategory" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={btn('outline')}>Cancel</button>
          <button type="submit" style={btn('primary')}>Save Document</button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { background: '#141B24', border: '1px solid #253040', borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 12.5, padding: '8px 10px', outline: 'none', width: '100%' }

function btn(variant) {
  const base = { padding: '8px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  if (variant === 'primary') return { ...base, background: '#F59E0B', color: '#070A0D' }
  return { ...base, background: 'transparent', border: '1px solid #253040', color: '#6E84A3' }
}
