import { useState, useEffect } from 'react'
import { C } from '../../utils/constants.js'

export default function SaveProjectDialog({
  open,
  defaults = {},
  onSave,
  onCancel,
}) {
  const [projectTitle, setProjectTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setProjectTitle(defaults.projectTitle || defaults.title || '')
    setClientName(defaults.clientName || '')
    setLocation(defaults.projectLocation || defaults.location || '')
    setDescription(defaults.projectDescription || defaults.description || '')
  }, [open, defaults])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave?.({
      projectTitle: projectTitle.trim(),
      clientName: clientName.trim(),
      location: location.trim(),
      projectDescription: description.trim(),
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 350,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, minWidth: 380, maxWidth: 480, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 1.5, color: C.amber, marginBottom: 6 }}>SAVE PROJECT</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Save generated BOQ, pricing, and project details.</div>

        <Field label="Project title">
          <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} style={inputStyle} required placeholder="e.g. Joy City Extension" />
        </Field>
        <Field label="Client name">
          <input value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} placeholder="Client or company name" />
        </Field>
        <Field label="Location">
          <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} placeholder="e.g. Accra, Ghana" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Brief project scope" />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={btn('outline')}>Cancel</button>
          <button type="submit" style={btn('primary')}>Save Project</button>
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
