import { useRef, useCallback, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import {
  createTemplatePaymentTerms,
  persistUserPaymentTermsDefault,
  stripHtml,
} from '../../utils/paymentTerms.js'

function execFormat(command) {
  document.execCommand(command, false, null)
}

export default function PaymentTermsEditor({ terms, onChange, onSavedDefault, onReset }) {
  const addTerm = () => {
    onChange([...terms, { id: Date.now(), html: '' }])
  }

  const updateTerm = (id, html) => {
    onChange(terms.map(t => (t.id === id ? { ...t, html } : t)))
  }

  const removeTerm = (id) => {
    onChange(terms.filter(t => t.id !== id))
  }

  const moveTerm = (id, dir) => {
    const idx = terms.findIndex(t => t.id === id)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= terms.length) return
    const copy = [...terms]
    ;[copy[idx], copy[next]] = [copy[next], copy[idx]]
    onChange(copy)
  }

  const handleSaveDefault = () => {
    const nonEmpty = terms.filter(t => stripHtml(t.html).trim())
    if (persistUserPaymentTermsDefault(nonEmpty)) {
      onSavedDefault?.()
    }
  }

  const handleReset = () => {
    onChange(createTemplatePaymentTerms())
    onReset?.()
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {terms.map((term, idx) => (
          <TermRow
            key={term.id}
            term={term}
            isFirst={idx === 0}
            isLast={idx === terms.length - 1}
            onUpdate={html => updateTerm(term.id, html)}
            onRemove={() => removeTerm(term.id)}
            onMoveUp={() => moveTerm(term.id, -1)}
            onMoveDown={() => moveTerm(term.id, 1)}
          />
        ))}
      </div>

      <button type="button" onClick={addTerm} style={addBtnStyle}>+ Add Term</button>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleSaveDefault} style={btn('primary', true)}>
          Save as My Default Payment Terms
        </button>
        <button type="button" onClick={handleReset} style={btn('outline', true)}>
          Reset to Default
        </button>
      </div>
    </div>
  )
}

function TermRow({ term, isFirst, isLast, onUpdate, onRemove, onMoveUp, onMoveDown }) {
  const editorRef = useRef(null)
  const lastHtml = useRef(term.html)

  useEffect(() => {
    if (!editorRef.current) return
    if (term.html !== lastHtml.current && editorRef.current.innerHTML !== term.html) {
      editorRef.current.innerHTML = term.html || ''
      lastHtml.current = term.html
    }
  }, [term.html])

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      lastHtml.current = editorRef.current.innerHTML
      onUpdate(editorRef.current.innerHTML)
    }
  }, [onUpdate])

  const handleFormat = (command) => {
    editorRef.current?.focus()
    execFormat(command)
    syncContent()
  }

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      alignItems: 'flex-start',
      background: C.carbon,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button type="button" onClick={onMoveUp} disabled={isFirst} title="Move up" style={iconBtn(isFirst)}>▲</button>
        <button type="button" onClick={onMoveDown} disabled={isLast} title="Move down" style={iconBtn(isLast)}>▼</button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button type="button" onClick={() => handleFormat('bold')} title="Bold" style={toolBtn}><strong>B</strong></button>
          <button type="button" onClick={() => handleFormat('italic')} title="Italic" style={toolBtn}><em>I</em></button>
          <button type="button" onClick={() => handleFormat('insertUnorderedList')} title="Bullet list" style={toolBtn}>•</button>
        </div>
        <div
          ref={(el) => {
            editorRef.current = el
            if (el && !el.dataset.init) {
              el.innerHTML = term.html || ''
              el.dataset.init = '1'
              lastHtml.current = term.html
            }
          }}
          contentEditable
          suppressContentEditableWarning
          onInput={syncContent}
          onBlur={syncContent}
          style={{
            background: '#141B24',
            border: `1px solid #253040`,
            borderRadius: 6,
            color: '#DDE5F0',
            fontFamily: 'DM Sans',
            fontSize: 12.5,
            padding: '8px 10px',
            minHeight: 36,
            outline: 'none',
            lineHeight: 1.5,
          }}
          data-placeholder="Enter payment term…"
        />
      </div>

      <button type="button" onClick={onRemove} title="Delete term" style={delBtn}>✕</button>
    </div>
  )
}

const toolBtn = {
  background: 'transparent',
  border: `1px solid #253040`,
  color: '#6E84A3',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
  borderRadius: 4,
  fontFamily: 'DM Sans',
  minWidth: 26,
}

const delBtn = {
  background: 'transparent',
  border: `1px solid #253040`,
  color: '#F87171',
  fontSize: 11.5,
  padding: '3px 7px',
  cursor: 'pointer',
  borderRadius: 4,
  flexShrink: 0,
  marginTop: 28,
}

const addBtnStyle = {
  background: 'transparent',
  border: `1px solid #253040`,
  color: '#6E84A3',
  fontSize: 11,
  padding: '5px 11px',
  cursor: 'pointer',
  borderRadius: 6,
  marginTop: 8,
  fontFamily: 'DM Sans',
}

function iconBtn(disabled) {
  return {
    background: 'transparent',
    border: `1px solid #253040`,
    color: disabled ? '#3a4a5c' : '#6E84A3',
    fontSize: 9,
    padding: '2px 5px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 3,
    lineHeight: 1,
  }
}

function btn(variant = 'outline', sm = false) {
  const p = sm ? '5px 11px' : '7px 14px'
  const fs = sm ? 11.5 : 12.5
  const base = {
    padding: p, borderRadius: 6, fontSize: fs, fontWeight: 500, cursor: 'pointer',
    border: 'none', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const map = {
    primary: { ...base, background: '#F59E0B', color: '#070A0D' },
    outline: { ...base, background: 'transparent', border: `1px solid #253040`, color: '#6E84A3' },
  }
  return map[variant] || base
}
