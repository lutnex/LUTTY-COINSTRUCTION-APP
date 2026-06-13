export function Spinner({ size = 12, color = '#F59E0B' }) {
  return (
    <div style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `2px solid rgba(245,158,11,.2)`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin .65s linear infinite',
      flexShrink: 0,
    }} />
  )
}
