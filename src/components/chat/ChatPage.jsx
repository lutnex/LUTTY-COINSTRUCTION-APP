import { useEffect, useRef } from 'react'
import { C, QUICK_PROMPTS, BOQ_SECTIONS } from '../../utils/constants.js'
import { renderMd } from '../../utils/formatters.js'
import WorkflowPanel from './WorkflowPanel.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function ChatPage({ chat, prices, onImportBOQ, onSendToDocGen, onPDFExport, onSaveToProject, projState, dispatch, setTab }) {
  const toast = useToast()
  const { msgs, inp, setInp, busy, progressLabel, attempt, attach, imgPrev, fileLoading, endRef, taRef, fileRef, send, stop, clear, handleFile, setAttach, setImgPrev } = chat

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + 'px'
    }
  }, [inp])

  const onSend = (text, retryCtx) => send(text, retryCtx, (kind, title, body, action) => toast[kind]?.(title, body, action))
  const onFile = (file) => handleFile(file, (kind, title, body) => toast[kind]?.(title, body))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 22px', borderBottom: `1px solid ${C.border}`, background: C.carbon, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 19, letterSpacing: '1.5px', color: C.amber }}>Lutty Construction Estimator</div>
          <div style={{ fontSize: 11.5, color: C.textDim }}>Senior QS · Estimator · Engineer · AI Workflow Pipeline</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {msgs.length > 0 && <button onClick={clear} style={btn('outline')}>Clear Chat</button>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 18, padding: 32 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 52, letterSpacing: 5, color: C.amber, textShadow: '0 0 80px rgba(245,158,11,.3)' }}>LUTTY CONSTRUCTIQ</div>
            <div style={{ color: C.textDim, fontSize: 14, maxWidth: 480, lineHeight: 1.7 }}>
              AI generates structured BOQs automatically. Every response shows workflow actions — import to BOQ, export PDF, or save to project.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 640 }}>
              {QUICK_PROMPTS.map(p => (
                <div key={p} onClick={() => !busy && onSend(p)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '5px 12px', fontSize: 12, color: busy ? C.textFaint : C.textDim, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {msgs.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 10, animation: 'fu .28s ease' }}>
            {/* Avatar */}
            <div style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginTop: 3, background: m.role === 'user' ? C.muted : 'linear-gradient(135deg,#7a3a0a,#f59e0b)' }}>
              {m.role === 'user' ? '👤' : '🏗️'}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{m.role === 'user' ? 'You' : 'Estimator Agent'}</span>
                {m.streaming && <span style={{ color: C.amber, fontSize: 9 }}>● LIVE</span>}
                {m.durationMs && !m.streaming && <span style={{ color: C.textFaint, fontSize: 9 }}>{(m.durationMs / 1000).toFixed(1)}s</span>}
                {m.tokensOut && !m.streaming && <span style={{ color: C.textFaint, fontSize: 9 }}>{m.tokensOut} tokens</span>}
              </div>

              {m.failed ? (
                /* Error card */
                <div style={{ background: 'rgba(248,113,113,.05)', border: '1px solid rgba(248,113,113,.25)', borderRadius: '4px 12px 12px 12px', padding: '12px 14px', animation: 'shake .3s ease' }}>
                  <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>⚠ {m.errorTitle || `AI request failed${m.errorStatus ? ` (HTTP ${m.errorStatus})` : ''}`}</div>
                  <div style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5, marginBottom: 10, fontFamily: "'IBM Plex Mono'", wordBreak: 'break-word' }}>{m.display || 'Connection failed'}</div>
                  {m.retryCtx && (
                    <button onClick={() => onSend(undefined, m.retryCtx)}
                      style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.35)', borderRadius: 7, color: C.red, fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      ↺ Retry
                    </button>
                  )}
                </div>
              ) : (
                /* Message bubble */
                <div style={{ background: m.role === 'user' ? C.slate : C.panel, border: `1px solid ${m.role === 'user' ? C.muted : C.border}`, borderRadius: m.role === 'user' ? '10px 2px 10px 10px' : '2px 10px 10px 10px', padding: '12px 15px', color: C.text, lineHeight: 1.75, fontSize: 13.5 }}>
                  {m.imgPrev && <img src={m.imgPrev} alt="preview" style={{ maxWidth: 220, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 8, display: 'block' }} />}
                  {m.docName && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 12, color: C.textDim, marginBottom: 8 }}>📄 {m.docName}</div>}
                  <div dangerouslySetInnerHTML={{ __html: renderMd(m.display ?? m.content ?? '') }} />
                  {m.streaming && (
                    <>
                      <div style={{ height: 2, background: C.border, borderRadius: 1, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ height: '100%', background: `linear-gradient(90deg,${C.amber},${C.gold})`, animation: 'prog 2s ease-in-out infinite' }} />
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.amber, marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, animation: 'pulse .9s ease-in-out infinite' }} />
                        {progressLabel || 'Generating…'}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Workflow panel after assistant messages */}
              {m.role === 'assistant' && !m.streaming && !m.failed && m.extract && (
                <WorkflowPanel
                  extract={m.extract}
                  onImportBOQ={onImportBOQ}
                  onSendToDocGen={onSendToDocGen}
                  onPDFExport={onPDFExport}
                  onSaveToProject={onSaveToProject}
                  projState={projState}
                  dispatch={dispatch}
                  setTab={setTab}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {busy && !msgs.some(m => m.streaming) && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginTop: 3, background: 'linear-gradient(135deg,#7a3a0a,#f59e0b)' }}>🏗️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.textFaint, marginBottom: 4 }}>ESTIMATOR AGENT</div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px 10px 10px 10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: C.amber, animation: `bk 1.2s ${i * 0.16}s infinite` }} />)}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10.5, color: C.amber }}>
                    {attempt > 1 ? `Retry ${attempt}… ${progressLabel}` : progressLabel || 'Connecting…'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '11px 22px', borderTop: `1px solid ${C.border}`, background: C.carbon, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Tool chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['📎 Attach File',   () => fileRef.current?.click()],
            ['📋 Full BOQ',      () => onSend('Generate a complete professional BOQ using master bill structure B1–B25. Full scope, drawing takeoff, assumptions, collections, commercial summary, and risks.')],
            ['💰 Estimate',      () => onSend('Full construction estimate with commercial summary. Ask me project details.')],
            ['🤖 Review My BOQ', () => onSend('Review my current BOQ — flag missing items, wrong rates, and commercial risks.')],
            ['⚠️ Risk Analysis', () => onSend('Full commercial risk assessment. Ask me about scope and contract type.')],
          ].map(([label, fn]) => (
            <div key={label} onClick={() => !busy && fn()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: '4px 11px', fontSize: 12, color: busy ? C.textFaint : C.textDim, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>
              {label}
            </div>
          ))}
          {fileLoading && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, color: C.textDim }}>⏳ Reading…</div>}
          {imgPrev && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, color: C.textDim }}>🖼️ {attach?.name}<button onClick={() => { setAttach(null); setImgPrev(null) }} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button></div>}
          {attach && !imgPrev && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, color: C.textDim }}>📄 {attach.name}<button onClick={() => setAttach(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button></div>}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={taRef}
            rows={1}
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            onPaste={e => { const f = e.clipboardData.files[0]; if (f) onFile(f) }}
            placeholder="Describe your project, upload a drawing, or request a BOQ…"
            style={{ flex: 1, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: 'DM Sans', fontSize: 13.5, padding: '8px 12px', resize: 'none', outline: 'none', minHeight: 40, maxHeight: 120, lineHeight: 1.5, transition: 'border-color .2s' }}
          />
          {busy
            ? <button onClick={stop} style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, color: C.red, fontSize: 12, fontWeight: 600, padding: '0 14px', height: 40, cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0 }}>■ Stop</button>
            : <button onClick={() => onSend()} style={{ background: C.amber, color: C.ink, border: 'none', borderRadius: 8, width: 40, height: 40, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>➤</button>
          }
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

function btn(variant = 'outline') {
  const base = { padding: '6px 13px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s' }
  if (variant === 'outline') return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
  if (variant === 'primary') return { ...base, background: C.amber, border: 'none', color: C.ink }
  return base
}
