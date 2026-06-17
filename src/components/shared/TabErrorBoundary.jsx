import { Component } from 'react'
import { C } from '../../utils/constants.js'
import { logErrorBoundary } from '../../utils/sessionDebug.js'

/** Catches errors in a single tab/modal so the rest of the app keeps running. */
export default class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    logErrorBoundary(error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    const label = this.props.label || 'This view'

    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, background: C.ink,
      }}>
        <div style={{
          maxWidth: 480, background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: C.amber, letterSpacing: 1.5, marginBottom: 8 }}>
            {label} encountered an error
          </div>
          <p style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            Your chat and saved session are preserved. Try again or return to the Estimator Agent.
          </p>
          <code style={{ display: 'block', fontSize: 11, color: C.red, marginBottom: 16, wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unknown error'}
          </code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => this.setState({ error: null })} style={btn('outline')}>
              Try again
            </button>
            <button type="button" onClick={() => this.props.onGoChat?.()} style={btn('primary')}>
              Return to Chat
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function btn(v) {
  const base = { padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none' }
  if (v === 'primary') return { ...base, background: C.amber, color: '#070A0D' }
  return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
}
