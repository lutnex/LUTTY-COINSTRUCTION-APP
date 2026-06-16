import { Component } from 'react'
import { C } from '../../utils/constants.js'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReset = () => {
    try {
      localStorage.removeItem('constructiq-project-intelligence')
      localStorage.removeItem('constructiq-workflow-session')
    } catch { /* ignore */ }
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
          maxWidth: 520, background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 28, textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.amber, letterSpacing: 2, marginBottom: 8 }}>
            APP RECOVERED FROM ERROR
          </div>
          <p style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            A saved project in your browser may be corrupted from an older version.
            Your chat is preserved — reset workflow data to continue.
          </p>
          <code style={{ display: 'block', fontSize: 11, color: C.red, marginBottom: 20, wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unknown error'}
          </code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => this.setState({ error: null })}
              style={btn('outline')}>Try again</button>
            <button type="button" onClick={this.handleReset}
              style={btn('primary')}>Reset workflow data & reload</button>
          </div>
        </div>
      </div>
    )
  }
}

function btn(v) {
  const base = { padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none' }
  if (v === 'primary') return { ...base, background: C.amber, color: '#070A0D' }
  return { ...base, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim }
}
