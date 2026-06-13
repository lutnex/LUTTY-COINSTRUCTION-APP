import { useRef, useCallback, useEffect } from 'react'
import { C } from '../../utils/constants.js'

function execFormat(command, value = null) {
  document.execCommand(command, false, value)
}

export default function RichTextEditor({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Enter content…',
  minHeight = 80,
}) {
  const editorRef = useRef(null)
  const lastHtml = useRef(value)

  useEffect(() => {
    if (!editorRef.current) return
    if (value !== lastHtml.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
      lastHtml.current = value
    }
  }, [value])

  const sync = useCallback(() => {
    if (!editorRef.current || disabled) return
    lastHtml.current = editorRef.current.innerHTML
    onChange?.(editorRef.current.innerHTML)
  }, [onChange, disabled])

  const format = (command, val = null) => {
    if (disabled) return
    editorRef.current?.focus()
    execFormat(command, val)
    sync()
  }

  return (
    <div style={{ opacity: disabled ? 0.65 : 1 }}>
      {!disabled && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          <ToolBtn onClick={() => format('bold')} title="Bold"><strong>B</strong></ToolBtn>
          <ToolBtn onClick={() => format('italic')} title="Italic"><em>I</em></ToolBtn>
          <ToolBtn onClick={() => format('underline')} title="Underline"><u>U</u></ToolBtn>
          <ToolBtn onClick={() => format('insertUnorderedList')} title="Bullets">•</ToolBtn>
          <ToolBtn onClick={() => format('insertOrderedList')} title="Numbering">1.</ToolBtn>
        </div>
      )}
      <div
        ref={(el) => {
          editorRef.current = el
          if (el && !el.dataset.init) {
            el.innerHTML = value || ''
            el.dataset.init = '1'
            lastHtml.current = value
          }
        }}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        style={{
          background: disabled ? '#0f1419' : '#141B24',
          border: `1px solid ${disabled ? '#1a2330' : '#253040'}`,
          borderRadius: 6,
          color: '#DDE5F0',
          fontFamily: 'DM Sans',
          fontSize: 12.5,
          padding: '10px 12px',
          minHeight,
          outline: 'none',
          lineHeight: 1.55,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  )
}

function ToolBtn({ children, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      background: 'transparent', border: `1px solid #253040`, color: '#6E84A3',
      fontSize: 11, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, fontFamily: 'DM Sans', minWidth: 26,
    }}>
      {children}
    </button>
  )
}
