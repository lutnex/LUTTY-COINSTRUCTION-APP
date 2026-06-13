import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { fmtN } from '../../utils/formatters.js'
import { DOCUMENT_CATEGORIES } from '../../utils/savedDocuments.js'
import ConfirmDialog from '../shared/ConfirmDialog.jsx'

const CAT_LABEL = Object.fromEntries(DOCUMENT_CATEGORIES.map(c => [c.id, c.label]))

export default function SavedDocumentsPage({
  documents,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  onRefresh,
}) {
  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const startRename = (doc) => {
    setRenameId(doc.id)
    setRenameValue(doc.name)
  }

  const submitRename = () => {
    if (renameId && renameValue.trim()) {
      onRename(renameId, renameValue.trim())
    }
    setRenameId(null)
  }

  const confirmDelete = () => {
    if (deleteId) onDelete(deleteId)
    setDeleteId(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 20, padding: '10px 20px', background: C.carbon, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, color: C.amber, fontWeight: 500 }}>{documents.length}</div>
          <div style={{ fontSize: 9.5, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Saved Documents</div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>SAVED DOCUMENTS</div>
            <div style={{ fontSize: 12.5, color: C.textDim }}>Estimates, BOQs, quotations, and invoices — separate from construction projects.</div>
          </div>
          <button type="button" onClick={onRefresh} style={btn('outline')}>↻ Refresh</button>
        </div>

        {documents.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 13 }}>
            No saved documents yet. Create a document in Document Generator and click <strong style={{ color: C.amber }}>Save Document</strong>.
          </div>
        ) : (
          documents.map(doc => (
            <div key={doc.id} style={{
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: 16, marginBottom: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: '3px 8px', borderRadius: 4,
                background: C.amberGlow, border: `1px solid ${C.amberLo}`, color: C.amber,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {CAT_LABEL[doc.category] || doc.category}
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                {renameId === doc.id ? (
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenameId(null) }}
                    style={{ background: '#141B24', border: `1px solid ${C.amber}`, borderRadius: 6, color: C.text, padding: '6px 8px', width: '100%', fontSize: 13 }}
                    autoFocus
                  />
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                      {doc.projectName || 'No project name'} · GHS {fmtN(doc.contractSum)} · {new Date(doc.updatedAt).toLocaleDateString('en-GB')}
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onOpen(doc)} style={btn('primary', true)}>Open</button>
                <button type="button" onClick={() => startRename(doc)} style={btn('outline', true)}>Rename</button>
                <button type="button" onClick={() => onDuplicate(doc.id)} style={btn('outline', true)}>Duplicate</button>
                <button type="button" onClick={() => onExport(doc)} style={btn('outline', true)}>Export PDF</button>
                <button type="button" onClick={() => setDeleteId(doc.id)} style={btn('danger', true)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Document"
        message="Are you sure you want to permanently delete this saved document?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

function btn(variant, sm = false) {
  const p = sm ? '5px 11px' : '7px 14px'
  const fs = sm ? 11 : 12.5
  const base = { padding: p, borderRadius: 6, fontSize: fs, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  const map = {
    primary: { ...base, background: '#F59E0B', color: '#070A0D' },
    outline: { ...base, background: 'transparent', border: '1px solid #253040', color: '#6E84A3' },
    danger: { ...base, background: 'transparent', border: '1px solid rgba(248,113,113,.4)', color: '#F87171' },
  }
  return map[variant] || base
}
