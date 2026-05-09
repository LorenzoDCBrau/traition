export default function HUD() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        color: '#fff',
        fontFamily: 'monospace',
      }}
    >
      {/* Crosshair */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          opacity: 0.8,
        }}
      >
        +
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 32px',
          fontSize: 14,
        }}
      >
        <span>HP 100</span>
        <span style={{ letterSpacing: 2, fontSize: 18, fontWeight: 'bold' }}>TRAITION</span>
        <span>AMMO ∞</span>
      </div>
    </div>
  )
}
