/**
 * React preview wrapper for the canonical DE-LUTEROITS export template.
 * Export pipelines use src/utils/deLuteroitsDocumentTemplate.js — keep in sync.
 */

import { DELUTEROITS_DOCUMENT_STYLES } from '../../utils/deLuteroitsDocumentTemplate.js'

export function DeLuteroitsDocumentTemplate({ html, className = '' }) {
  if (!html) return null
  return (
    <div className={className} style={{ background: '#e8ecf2', minHeight: '100%' }}>
      <style>{DELUTEROITS_DOCUMENT_STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export default DeLuteroitsDocumentTemplate
