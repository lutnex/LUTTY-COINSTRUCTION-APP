import { Component } from 'react'
import { C } from '../../utils/constants.js'
import { logErrorBoundary } from '../../utils/sessionDebug.js'

export default class ErrorBoundary extends Component {
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

  handleReturnDashboard = () => {
    if (typeof window.__constructiqGoDashboard === 'function') {
      window.__constructiqGoDashboard()
      return
    }
    window.location.assign(`${window.location.origin}${window.location.pathname}`)
  }

  handleRestoreSession = () => {
    if (typeof window.__constructiqRestoreSession === 'function') {
      window.__constructiqRestoreSession()
      return
    }
    window.location.reload()
  }

  handleClearBroken = () => {
    if (typeof window.__constructiqClearBrokenSession === 'function') {
      window.__constructiqClearBrokenSession()
      return
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#070A0D', padding: 24, fontFamily: 'DM Sans, sans-serif',
      }}>
        <div style={{
          maxWidth: 540, background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 28, textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.amber, letterSpacing: 2, marginBottom: 8 }}>
            SOMETHING WENT WRONG
          </div>
          <p style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            The app hit an unexpected error. Your work may still be saved in the browser.
            Use the options below to recover without losing your chat.
          </p>
          <code style={{ display: 'block', fontSize: 11, color: C.red, marginBottom: 20, wordBreak: 'break-word', textAlign: 'left' }}>
            {this.state.error?.message || 'Unknown error'}
          </code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={this.handleReturnDashboard} style={btn('outline')}>
              Return to Dashboard
            </button>
            <button type="button" onClick={this.handleRestoreSession} style={btn('primary')}>
              Restore Last Session
            </button>
            <button type="button" onClick={this.handleClearBroken} style={btn('danger')}>
              Clear Broken Session
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function btn(v) {
  const base = { padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none' }
  if (v === 'primary') return { ...base, background: C.amber, color: '#070A0D' }
  if (v === 'danger') return { ...base, background: 'rgba(248,113,113,.15)', border: '1px solid rgba(248,113,113,.4)', color: C.red }
  return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
}
