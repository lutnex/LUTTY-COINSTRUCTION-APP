import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { SECTION_KINDS, reorderSections, duplicateSection } from '../../utils/documentSections.js'
import ConfirmDialog from '../shared/ConfirmDialog.jsx'

export default function SectionManager({ open, sections, onChange, onClose, onAddCustom }) {
  const [dragId, setDragId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  if (!open) return null

  const visible = sections.filter(s => s.status !== 'deleted')

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const from = visible.findIndex(s => s.id === dragId)
    const to = visible.findIndex(s => s.id === targetId)
    onChange(reorderSections(visible, from, to))
    setDragId(null)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 1.5, color: C.amber }}>MANAGE SECTIONS</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Enable, rename, reorder, duplicate, or delete document sections.</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {visible.map(section => (
            <div
              key={section.id}
              draggable
              onDragStart={() => setDragId(section.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(section.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: C.carbon, border: `1px solid ${section.enabled ? C.border : '#1a2330'}`,
                borderRadius: 8, marginBottom: 8,
              }}
            >
              <span style={{ cursor: 'grab', color: C.textFaint }}>⠿</span>
              <input
                value={section.title}
                onChange={e => onChange(visible.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                style={{
                  flex: 1, background: '#141B24', border: `1px solid #253040`, borderRadius: 6,
                  color: C.text, fontSize: 12, padding: '6px 8px',
                }}
              />
              <span style={{ fontSize: 9, color: C.textFaint, fontFamily: "'IBM Plex Mono'", whiteSpace: 'nowrap' }}>
                {SECTION_KINDS[section.type]?.kind || 'richtext'}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textDim, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={e => onChange(visible.map(s => s.id === section.id ? { ...s, enabled: e.target.checked } : s))}
                />
                On
              </label>
              <button type="button" onClick={() => onChange(duplicateSection(visible, section.id))} style={iconBtn} title="Duplicate">⧉</button>
              <button type="button" onClick={() => setDeleteId(section.id)} style={iconBtn} title="Delete">🗑</button>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button type="button" onClick={onAddCustom} style={btn('outline')}>+ Add Custom Section</button>
          <button type="button" onClick={onClose} style={btn('primary')}>Done</button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Section"
        message="Remove this section from the document? It will not appear in exports."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          onChange(visible.filter(s => s.id !== deleteId))
          setDeleteId(null)
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

function btn(variant) {
  const base = { padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  if (variant === 'primary') return { ...base, background: '#F59E0B', color: '#070A0D' }
  return { ...base, background: 'transparent', border: '1px solid #253040', color: '#6E84A3' }
}

const iconBtn = {
  background: 'transparent', border: '1px solid #253040', color: '#6E84A3',
  fontSize: 12, padding: '4px 7px', cursor: 'pointer', borderRadius: 4,
}
