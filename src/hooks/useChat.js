import { useState, useRef, useCallback, useEffect } from 'react'
import { callAI } from '../services/ai/client.js'
import { parseAIResponse } from '../services/ai/responseParser.js'
import { normalizePromptInput } from '../utils/promptBuilder.js'
import { toUserFacingError } from '../services/ai/errors.js'
import { createRequestGuard } from '../services/ai/request.js'
import { extractFileContent, buildMessageContent, describeExtraction } from '../utils/fileExtractor.js'
import { resolvePromptMode, getSystemPromptForMode, augmentBOQUserPrompt } from '../services/boq/boqEngine.js'

export function useChat({ prices = [], onUsage, onExtract } = {}) {
  const [msgs,          setMsgs]          = useState([])
  const [inp,           setInp]           = useState('')
  const [busy,          setBusy]          = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [attempt,       setAttempt]       = useState(1)
  const [attach,        setAttach]        = useState(null)
  const [imgPrev,       setImgPrev]       = useState(null)
  const [fileLoading,   setFileLoading]   = useState(false)

  const abortRef   = useRef(null)
  const endRef     = useRef(null)
  const taRef      = useRef(null)
  const fileRef    = useRef(null)
  const imgUrlRef  = useRef(null)
  const guard      = useRef(createRequestGuard()).current

  const scrollBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => () => {
    abortRef.current?.abort()
    if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current)
  }, [])

  const clearImgPreview = useCallback(() => {
    if (imgUrlRef.current) {
      URL.revokeObjectURL(imgUrlRef.current)
      imgUrlRef.current = null
    }
    setImgPrev(null)
  }, [])

  const handleFile = useCallback(async (file, onToast) => {
    setFileLoading(true)
    try {
      const extracted = await extractFileContent(file)
      const desc = describeExtraction(extracted)

      if (!desc.ok) {
        onToast?.('error', desc.title, desc.body)
        setFileLoading(false)
        return
      }

      setAttach(extracted)

      if (extracted.kind === 'image' && extracted.b64) {
        clearImgPreview()
        const blob = await fetch(`data:${extracted.mime};base64,${extracted.b64}`).then(r => r.blob())
        imgUrlRef.current = URL.createObjectURL(blob)
        setImgPrev(imgUrlRef.current)
      }

      onToast?.('success', desc.title, desc.body)
    } catch (e) {
      console.error('[Attach] handleFile error:', e)
      onToast?.('error', 'File read failed', e?.message || 'Unknown error')
    }
    setFileLoading(false)
  }, [clearImgPreview])

  const send = useCallback(async (text, retryCtx, onToast) => {
    const txt = retryCtx ? (typeof text === 'string' ? text.trim() : '') : normalizePromptInput(text ?? inp)
    const currentAttach = retryCtx?.attach ?? attach
    if (!txt && !currentAttach && !retryCtx) return

    let reqId = null
    if (!retryCtx) {
      reqId = guard.tryAcquire()
      if (!reqId) {
        onToast?.('warn', 'Please wait', 'An AI request is already in progress')
        return
      }
    }

    setInp('')
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const priceCtx = prices.length
      ? '\n\n[SAVED RATES — use only when user has not supplied a price; never override user-entered rates]:\n' + prices.map(p => `${p.material}${p.specification ? ` (${p.specification})` : ''}: GHS ${p.price}/${p.unit}${p.supplier ? ` — ${p.supplier}` : ''}`).join('\n')
      : '\n\n[PRICING RULE]: No saved rates available — ask user for every material unit price. Do not invent market prices.'

    const promptMode = retryCtx?.progressKey || resolvePromptMode(txt, currentAttach)
    const isBoqMode = promptMode === 'boq' || promptMode === 'drawing'
    const userPrompt = augmentBOQUserPrompt(txt, currentAttach) + priceCtx

    let content
    if (currentAttach) {
      content = buildMessageContent(currentAttach, userPrompt, { boqMode: isBoqMode })
    } else {
      content = userPrompt || txt + priceCtx
    }

    const systemPrompt = retryCtx?.prompt ?? getSystemPromptForMode(promptMode === 'drawing' ? 'boq' : promptMode)

    const userMsg = {
      id:      `u${Date.now()}`,
      role:    'user',
      content,
      display: txt || (currentAttach ? `[${(currentAttach.kind || 'FILE').toUpperCase()}: ${currentAttach.name}]` : ''),
      imgPrev: currentAttach?.kind === 'image' ? imgPrev : null,
      docName: currentAttach?.name,
      attachMeta: currentAttach ? {
        name: currentAttach.name,
        method: currentAttach.extractionMethod,
        textLength: currentAttach.textLength,
        imageCount: currentAttach.images?.length ?? 0,
      } : null,
    }

    const history = retryCtx ? retryCtx.messages : [...msgs, userMsg]
    if (!retryCtx) setMsgs(history)
    if (!retryCtx) {
      setAttach(null)
      clearImgPreview()
    }
    setBusy(true)
    setAttempt(retryCtx?.attemptCount || 1)

    const aiId  = `a${Date.now()}`
    const aiMsg = { id: aiId, role: 'assistant', content: '', display: '', streaming: true }
    setMsgs(prev => [...(retryCtx ? prev : history), aiMsg])

    const hasVision = (currentAttach?.images?.length ?? 0) > 0
    const pKey = hasVision && isBoqMode ? 'drawing' : promptMode

    const maxTokens = isBoqMode || currentAttach
      ? (retryCtx?.maxTokens ?? 8192)
      : (retryCtx?.maxTokens ?? 3000)

    let result
    try {
      result = await callAI({
        messages:     history,
        systemPrompt,
        maxTokens,
        signal:       abortRef.current.signal,
        progressKey:  pKey,
        onProgress:   (s, att) => { setProgressLabel(s); setAttempt(att) },
        onChunk:      (partial, done) =>
          setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, content: partial, display: partial, streaming: !done } : m)),
      })
    } catch (e) {
      result = { ok: false, error: e?.message || 'Unexpected error', status: 0, durationMs: 0 }
    } finally {
      if (reqId) guard.release(reqId)
    }

    setProgressLabel('')
    setBusy(false)

    if (result.aborted && !result.text) {
      setMsgs(prev => prev.filter(m => m.id !== aiId || m.content))
      return
    }

    if (!result.ok) {
      const facing = toUserFacingError(result)
      const nextAttempt = (retryCtx?.attemptCount || 1) + 1
      const retCtx = {
        messages: history, prompt: systemPrompt, maxTokens, progressKey: pKey,
        attemptCount: nextAttempt, attach: currentAttach,
      }
      setMsgs(prev => prev.map(m => m.id === aiId ? {
        ...m, streaming: false, failed: true,
        display: facing.detail,
        content: facing.detail,
        errorStatus: facing.status,
        errorTitle: facing.title,
        retryCtx: facing.retryable ? retCtx : undefined,
      } : m))
      onToast?.('error', facing.title, facing.detail.split('\n')[0], facing.retryable ? { label: 'Retry', fn: () => send(undefined, retCtx, onToast) } : undefined)
      return
    }

    let extract
    try {
      extract = parseAIResponse(result.text)
    } catch {
      extract = { hasBOQ: false, hasEstimate: false }
    }

    const tokensUsed = (result.inputTokens ?? 0) + (result.outputTokens ?? 0)
    if (tokensUsed > 0) {
      onUsage?.({ tokens: tokensUsed, input: result.inputTokens, output: result.outputTokens })
    }

    setMsgs(prev => prev.map(m => m.id === aiId
      ? {
        ...m, streaming: false, content: result.text, display: result.text, extract,
        tokensIn: result.inputTokens, tokensOut: result.outputTokens, durationMs: result.durationMs,
      }
      : m
    ))

    if (extract?.hasBOQ) onToast?.('success', 'BOQ detected', `${extract.boqRows.length} line items — review workflow before import`)
    else if (extract?.requiresApproval) onToast?.('info', 'QS review required', 'Confirm measurements and supply prices before importing priced BOQ')
    else if (extract?.hasEstimate && extract.contractSum) {
      onToast?.('info', 'Estimate total detected', `GHS ${Number(extract.contractSum).toLocaleString('en')}`)
    }

    if (extract && (extract.hasBOQ || extract.hasEstimate || extract.hasRisks || extract.contractSum)) {
      if (!extract.requiresApproval) onExtract?.(extract)
    }

    setTimeout(scrollBottom, 50)
  }, [inp, attach, imgPrev, msgs, prices, onUsage, onExtract, clearImgPreview, guard])

  const setImgPrevSafe = useCallback((url) => {
    if (!url && imgUrlRef.current) {
      URL.revokeObjectURL(imgUrlRef.current)
      imgUrlRef.current = null
    }
    setImgPrev(url)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
    setProgressLabel('')
    setMsgs(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)))
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    clearImgPreview()
    setAttach(null)
    setMsgs([])
    setBusy(false)
    setProgressLabel('')
  }, [clearImgPreview])

  return {
    msgs, inp, setInp, busy, progressLabel, attempt,
    attach, imgPrev, fileLoading, setAttach, setImgPrev: setImgPrevSafe,
    endRef, taRef, fileRef,
    send, stop, clear, handleFile,
  }
}
