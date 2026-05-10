import { useEffect, useRef, useState } from 'react'
import type { HackTerminal } from '../game/missions/HackTerminal'

interface Props {
  terminal: HackTerminal
  onClose: (success: boolean) => void
}

export default function HackTerminalUI({ terminal, onClose }: Props) {
  const [, forceUpdate] = useState(0)
  const closedRef = useRef(false)

  useEffect(() => {
    terminal.start()

    const onKey = (e: KeyboardEvent) => {
      if (closedRef.current) return
      if (e.key === 'Escape') { closedRef.current = true; onClose(false); return }
      terminal.handleKey(e.key)
      forceUpdate((n) => n + 1)

      if (terminal.status === 'SUCCESS' || terminal.status === 'FAIL') {
        setTimeout(() => { if (!closedRef.current) { closedRef.current = true; onClose(terminal.status === 'SUCCESS') } }, 900)
      }
    }

    window.addEventListener('keydown', onKey)

    const tick = setInterval(() => {
      if (closedRef.current) { clearInterval(tick); return }
      terminal.update(1 / 30)
      forceUpdate((n) => n + 1)
      if (terminal.status === 'FAIL' && !closedRef.current) {
        clearInterval(tick)
        setTimeout(() => { if (!closedRef.current) { closedRef.current = true; onClose(false) } }, 900)
      }
    }, 33)

    return () => {
      window.removeEventListener('keydown', onKey)
      clearInterval(tick)
    }
  }, [terminal, onClose])

  const { sequence, input, timeLeft, status } = terminal
  const progress = (timeLeft / 10) * 100

  const statusColor =
    status === 'SUCCESS' ? '#00ffcc' : status === 'FAIL' ? '#ff4444' : '#fff'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        zIndex: 300,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          background: '#0a0f1e',
          border: '2px solid #00ffcc',
          borderRadius: 12,
          padding: '32px 48px',
          minWidth: 420,
          textAlign: 'center',
          boxShadow: '0 0 40px #00ffcc44',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 4, color: '#00ffcc', marginBottom: 24 }}>
          HACK TERMINAL
        </div>

        {/* Sequence to type */}
        <div style={{ fontSize: 42, letterSpacing: 14, color: '#fff', marginBottom: 20 }}>
          {sequence.split('').map((ch, i) => {
            const typed = input[i]
            const correct = typed === ch
            const wrong = typed !== undefined && !correct
            return (
              <span
                key={i}
                style={{ color: wrong ? '#ff4444' : typed ? '#00ffcc' : '#fff' }}
              >
                {ch}
              </span>
            )
          })}
        </div>

        {/* Player input */}
        <div style={{ fontSize: 38, letterSpacing: 14, color: '#88aacc', minHeight: 52, marginBottom: 20 }}>
          {input.padEnd(sequence.length, '_')}
        </div>

        {/* Timer bar */}
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: progress > 50 ? '#00ffcc' : progress > 25 ? '#ffcc00' : '#ff4444',
              transition: 'width 0.1s, background 0.3s',
              borderRadius: 3,
            }}
          />
        </div>

        <div style={{ fontSize: 13, color: statusColor, letterSpacing: 2, minHeight: 22 }}>
          {status === 'SUCCESS' && '✓ ACCESS GRANTED'}
          {status === 'FAIL' && '✗ ACCESS DENIED'}
          {status === 'ACTIVE' && `${Math.ceil(timeLeft)}s remaining — type the sequence`}
        </div>

        <div style={{ fontSize: 10, color: '#445566', marginTop: 12 }}>
          ESC to cancel
        </div>
      </div>
    </div>
  )
}
