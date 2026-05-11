import { useEffect, useState } from 'react'
import type { Role } from '../game/state/GameState'

interface Props {
  role: Role
  onDone: () => void
}

const ROLE_INFO: Record<Role, { color: string; desc: string }> = {
  INNOCENT: {
    color: '#4488ff',
    desc: 'Complete all 5 missions to win. Report any bodies you find.',
  },
  TRAITOR: {
    color: '#ff4444',
    desc: 'Eliminate innocents and sabotage missions. Do not get caught.',
  },
  DETECTIVE: {
    color: '#ffcc00',
    desc: 'Complete missions and use your unique ability to reveal one player\'s role during a discussion.',
  },
}

export default function RoleReveal({ role, onDone }: Props) {
  const [countdown, setCountdown] = useState(3)
  const info = ROLE_INFO[role]

  useEffect(() => {
    const timer = setTimeout(() => { onDone() }, 3000)
    const iv = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => { clearTimeout(timer); clearInterval(iv) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,10,18,0.93)',
        zIndex: 200,
        fontFamily: 'monospace',
        color: '#fff',
        gap: 20,
      }}
    >
      <div style={{ fontSize: 14, letterSpacing: 4, opacity: 0.5 }}>YOUR ROLE IS</div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 'bold',
          color: info.color,
          letterSpacing: 8,
          textShadow: `0 0 30px ${info.color}88`,
        }}
      >
        {role}
      </div>
      <div
        style={{
          maxWidth: 360,
          textAlign: 'center',
          fontSize: 14,
          lineHeight: 1.7,
          opacity: 0.75,
          color: info.color,
        }}
      >
        {info.desc}
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 13,
          opacity: 0.4,
          letterSpacing: 2,
        }}
      >
        Starting in {countdown}...
      </div>
    </div>
  )
}
