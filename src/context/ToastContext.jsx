import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'

const ToastContext = createContext(null)
const C = { amber:'#F59E0B', gold:'#FCD34D', text:'#DDE5F0', textDim:'#6E84A3', textFaint:'#334155', border:'#253040', amberGlow:'rgba(245,158,11,0.10)' }
const TOAST_META = {
  success:{ icon:'✓', border:'rgba(52,211,153,.45)', bg:'rgba(52,211,153,.07)', color:'#34D399' },
  error:  { icon:'✕', border:'rgba(248,113,113,.45)', bg:'rgba(248,113,113,.07)', color:'#F87171' },
  info:   { icon:'ℹ', border:'rgba(56,189,248,.35)',  bg:'rgba(56,189,248,.06)',  color:'#38BDF8' },
  warn:   { icon:'⚠', border:'rgba(251,146,60,.4)',   bg:'rgba(251,146,60,.07)', color:'#FB923C' },
  loading:{ icon:'…', border:'rgba(245,158,11,.35)',  bg:C.amberGlow, color:C.amber },
}

function ToastCard({ t, onRemove }) {
  const m = TOAST_META[t.kind] || TOAST_META.info
  return (
    <div style={{ background:m.bg, border:`1px solid ${m.border}`, borderLeft:`3px solid ${m.border}`, borderRadius:10, padding:'11px 14px', display:'flex', alignItems:'flex-start', gap:11, boxShadow:'0 8px 32px rgba(0,0,0,.5)', animation:'slideIn .28s ease', minWidth:260, maxWidth:380 }}>
      <div style={{ width:22, height:22, borderRadius:'50%', background:m.border, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, color:m.color, fontWeight:700 }}>
        {t.kind==='loading' ? <div style={{ width:10, height:10, border:`2px solid rgba(245,158,11,.2)`, borderTop:`2px solid ${C.amber}`, borderRadius:'50%', animation:'spin .7s linear infinite' }}/> : m.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.text, lineHeight:1.3 }}>{t.title}</div>
        {t.body && <div style={{ fontSize:11.5, color:C.textDim, marginTop:2, lineHeight:1.5 }}>{t.body}</div>}
        {t.action && <button onClick={()=>{ t.action.fn(); onRemove(t.id) }} style={{ marginTop:7, background:'transparent', border:`1px solid ${m.border}`, borderRadius:5, color:m.color, fontSize:11.5, fontWeight:600, padding:'3px 9px', cursor:'pointer', fontFamily:'DM Sans' }}>{t.action.label}</button>}
      </div>
      <button onClick={()=>onRemove(t.id)} style={{ background:'none', border:'none', color:C.textFaint, cursor:'pointer', fontSize:16, lineHeight:1, flexShrink:0, paddingLeft:4 }}>×</button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const ctr = useRef(0)
  const show = useCallback((t) => {
    const id = ++ctr.current
    setToasts(prev => [...prev, { ...t, id }])
    const dur = t.duration ?? (t.kind==='error' ? 6000 : t.kind==='loading' ? 0 : 4000)
    if (dur > 0) setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), dur)
    return id
  }, [])
  const update = useCallback((id, patch) => setToasts(p => p.map(x => x.id===id ? {...x,...patch} : x)), [])
  const remove = useCallback((id) => setToasts(p => p.filter(x => x.id !== id)), [])
  const ctx = useMemo(() => ({
    show, update, remove,
    success:(title,body,action)=> show({kind:'success',title,body,action}),
    error:  (title,body,action)=> show({kind:'error',title,body,action,duration:6000}),
    info:   (title,body)=>        show({kind:'info',title,body}),
    warn:   (title,body)=>        show({kind:'warn',title,body}),
    loading:(title,body)=>        show({kind:'loading',title,body,duration:0}),
    done:   (id,title,body)=>   { update(id,{kind:'success',title,body}); setTimeout(()=>remove(id),3500) },
    fail:   (id,title,body,action)=>{ update(id,{kind:'error',title,body,action}); setTimeout(()=>remove(id),6100) },
  }), [show, update, remove])
  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, display:'flex', flexDirection:'column', gap:10, zIndex:9999 }}>
        {toasts.map(t => <ToastCard key={t.id} t={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
