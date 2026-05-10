interface Props {
  winner: 'INNOCENT' | 'TRAITOR'
  ejectedName?: string
  ejectedRole?: string
  onRestart: () => void
}

export default function VictoryScreen({ winner, ejectedName, ejectedRole, onRestart }: Props) {
  const isInnocent = winner === 'INNOCENT'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isInnocent ? 'rgba(0,20,40,0.96)' : 'rgba(30,0,0,0.96)',
        zIndex: 500,
        fontFamily: 'monospace',
        color: '#fff',
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 'bold',
          letterSpacing: 6,
          color: isInnocent ? '#4488ff' : '#ff4444',
          textShadow: `0 0 50px ${isInnocent ? '#4488ff' : '#ff4444'}88`,
        }}
      >
        {isInnocent ? 'INNOCENTS WIN' : 'TRAITORS WIN'}
      </div>

      <div style={{ fontSize: 14, opacity: 0.55, letterSpacing: 2 }}>
        {isInnocent
          ? 'The crew survived and completed their mission.'
          : 'The traitors have taken over the ship.'}
      </div>

      {ejectedName && (
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '16px 32px',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.5, letterSpacing: 2, marginBottom: 6 }}>
            LAST EJECTED
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>{ejectedName}</div>
          {ejectedRole && (
            <div
              style={{
                fontSize: 13,
                marginTop: 4,
                color:
                  ejectedRole === 'TRAITOR'
                    ? '#ff4444'
                    : ejectedRole === 'DETECTIVE'
                    ? '#ffcc00'
                    : '#4488ff',
                letterSpacing: 2,
              }}
            >
              was {ejectedRole}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onRestart}
        style={{
          marginTop: 24,
          background: 'transparent',
          border: `2px solid ${isInnocent ? '#4488ff' : '#ff4444'}`,
          borderRadius: 8,
          color: isInnocent ? '#4488ff' : '#ff4444',
          fontFamily: 'monospace',
          fontSize: 16,
          letterSpacing: 3,
          padding: '12px 40px',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = isInnocent
            ? 'rgba(68,136,255,0.15)'
            : 'rgba(255,68,68,0.15)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  )
}
