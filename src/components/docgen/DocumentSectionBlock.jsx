import { useState } from 'react'
import { C } from '../../utils/constants.js'
import RichTextEditor from './RichTextEditor.jsx'
import ConfirmDialog from '../shared/ConfirmDialog.jsx'
import { stripHtml } from '../../utils/documentSections.js'

export default function DocumentSectionBlock({
  section,
  onUpdate,
  onAccept,
  onDelete,
  children,
  showEditor = true,
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const isSuggested = section.status === 'suggested'
  const hasContent = Boolean(stripHtml(section.html).trim()) || Boolean(children)

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${section.enabled ? (isSuggested ? 'rgba(56,189,248,.35)' : C.border) : '#1a2330'}`,
      borderRadius: 10,
      padding: 16,
      marginBottom: 12,
      opacity: section.enabled ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ cursor: 'grab', color: C.textFaint, fontSize: 12 }} title="Drag to reorder in Manage Sections">⠿</span>

        {editingTitle ? (
          <input
            value={section.title}
            onChange={e => onUpdate({ title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
            autoFocus
            style={{
              flex: 1, minWidth: 160, background: '#141B24', border: `1px solid ${C.amber}`,
              borderRadius: 6, color: C.amber, fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1, padding: '4px 8px',
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditingTitle(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue'",
            fontSize: 14, letterSpacing: 1, color: C.amber, padding: 0, textAlign: 'left',
          }}>
            {section.title}
          </button>
        )}

        {section.locked && (
          <span style={{ fontSize: 10, color: C.sky, fontFamily: "'IBM Plex Mono'" }}>🔒 Locked</span>
        )}
        {isSuggested && (
          <span style={{
            fontSize: 9, color: C.sky, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase',
            letterSpacing: 1, border: '1px solid rgba(56,189,248,.35)', borderRadius: 4, padding: '2px 6px',
          }}>
            AI Suggested
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textDim, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={e => onUpdate({ enabled: e.target.checked, status: e.target.checked && isSuggested ? 'active' : section.status })}
            />
            Include in document
          </label>
          <button type="button" onClick={() => onUpdate({ locked: !section.locked })} style={miniBtn(section.locked)}>
            {section.locked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
          <button type="button" onClick={() => setDeleteConfirm(true)} style={miniBtn(false, true)}>🗑 Delete</button>
        </div>
      </div>

      {isSuggested && hasContent && (
        <div style={{
          background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.25)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12, color: C.textDim,
        }}>
          <div style={{ marginBottom: 8, color: C.sky, fontWeight: 600 }}>Suggested Content — review before including</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={onAccept} style={actionBtn('green')}>✔ Accept</button>
            <button type="button" onClick={() => onUpdate({ status: 'active', enabled: true })} style={actionBtn('amber')}>✏ Edit & Include</button>
            <button type="button" onClick={() => onUpdate({ html: '', status: 'active', enabled: false })} style={actionBtn('outline')}>🗑 Dismiss</button>
          </div>
        </div>
      )}

      {children || (showEditor && (
        <RichTextEditor
          value={section.html}
          onChange={html => onUpdate({ html, status: 'active' })}
          placeholder={`Enter ${section.title.toLowerCase()}…`}
        />
      ))}

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Section"
        message={`Remove "${section.title}" from this document? It will not be included in exports and will not regenerate automatically.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => { onDelete(); setDeleteConfirm(false) }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}

function miniBtn(active, danger = false) {
  return {
    background: 'transparent',
    border: `1px solid ${danger ? 'rgba(248,113,113,.35)' : active ? C.amberLo : C.border}`,
    color: danger ? '#F87171' : active ? C.amber : C.textDim,
    fontSize: 10,
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: 4,
    fontFamily: 'DM Sans',
  }
}

function actionBtn(variant) {
  const map = {
    green: { background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.35)', color: '#34D399' },
    amber: { background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: '#F59E0B' },
    outline: { background: 'transparent', border: '1px solid #253040', color: '#6E84A3' },
  }
  return { ...map[variant], fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: 'DM Sans' }
}
