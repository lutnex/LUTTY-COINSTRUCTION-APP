// src/utils/markdown.js — Render AI markdown to HTML

import { C } from './constants.js'

export function renderMd(text) {
  if (!text) return ''
  let t = text
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/^####\s(.+)$/gm, `<h4 style='color:${C.amber};font-size:13px;margin:8px 0 4px'>$1</h4>`)
  t = t.replace(/^#{2,3}\s(.+)$/gm, `<h3 style='color:${C.gold};font-family:Bebas Neue;font-size:18px;margin:14px 0 5px'>$1</h3>`)
  t = t.replace(/^---$/gm, `<hr style='border:none;border-top:1px solid ${C.border};margin:10px 0'/>`)
  t = t.replace(/`([^`]+)`/g, `<code style='background:${C.slate};padding:1px 6px;border-radius:3px;font-family:monospace;font-size:12px;color:${C.sky}'>$1</code>`)

  // Tables
  t = t.replace(/((\|[^\n]+\|\n?)+)/g, m => {
    const rows = m.trim().split('\n').filter(r => r.trim() && !r.match(/^\|[-| :]+\|$/))
    if (!rows.length) return m
    const hdr = rows[0].split('|').filter(c => c.trim()).map(c => `<th style='background:${C.slate};color:${C.amber};padding:6px 10px;border:1px solid ${C.border};font-family:monospace;font-size:10px'>${c.trim()}</th>`).join('')
    const body = rows.slice(1).map(r => '<tr>' + r.split('|').filter(c => c.trim()).map(c => `<td style='padding:5px 10px;border:1px solid ${C.border};font-size:12.5px'>${c.trim()}</td>`).join('') + '</tr>').join('')
    return `<table style='width:100%;border-collapse:collapse;margin:10px 0'><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table>`
  })

  // Lists
  t = t.replace(/^[•\-\*]\s(.+)$/gm, `<li style='margin:3px 0;color:${C.textDim}'>$1</li>`)
  t = t.replace(/^\d+\.\s(.+)$/gm, `<li style='margin:3px 0'>$1</li>`)
  t = t.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, m => `<ul style='padding-left:18px;margin:6px 0'>${m}</ul>`)

  return t
}
