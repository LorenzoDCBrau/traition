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
      e.preventDefault()
      if (e.key === 'Escape') { closedRef.current = true; onClose(false); return }

      // Only accept letter input while ACTIVE; ignore keys during SHOWING / after result
      if (terminal.status === 'ACTIVE') {
        terminal.handleKey(e.key.toUpperCase())
      }
      forceUpdate((n) => n + 1)
      // Re-read status after handleKey may have mutated it
      const st = terminal.status
      if (st === 'SUCCESS' || st === 'FAIL') {
        setTimeout(() => {
          if (!closedRef.current) { closedRef.current = true; onClose(st === 'SUCCESS') }
        }, 900)
      }
    }

    window.addEventListener('keydown', onKey)

    const tick = setInterval(() => {
      if (closedRef.current) { clearInterval(tick); return }
      terminal.update(1 / 30)
      forceUpdate((n) => n + 1)
      if (terminal.status === 'FAIL' && !closedRef.current) {
        clearInterval(tick)
        setTimeout(() => {
          if (!closedRef.current) { closedRef.current = true; onClose(false) }
        }, 900)
      }
    }, 33)

    return () => {
      window.removeEventListener('keydown', onKey)
      clearInterval(tick)
    }
  }, [terminal, onClose])

  const { sequence, input, timeLeft, status } = terminal
  const isShowing = status === 'SHOWING'
  const isActive  = status === 'ACTIVE'

  const totalTime = isShowing ? 3 : 15
  const progress  = (timeLeft / totalTime) * 100

  const barColor = isShowing
    ? '#ffcc00'
    : progress > 50 ? '#00ffcc' : progress > 25 ? '#ffcc00' : '#ff4444'

  const statusColor =
    status === 'SUCCESS' ? '#00ffcc' : status === 'FAIL' ? '#ff4444' : isShowing ? '#ffcc00' : '#fff'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)',
        zIndex: 300,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          background: '#060c1a',
          border: `2px solid ${isShowing ? '#ffcc00' : '#00ffcc'}`,
          borderRadius: 14,
          padding: '40px 56px',
          minWidth: 480,
          textAlign: 'center',
          boxShadow: `0 0 50px ${isShowing ? '#ffcc0033' : '#00ffcc33'}`,
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 5, color: isShowing ? '#ffcc00' : '#00ffcc', marginBottom: 28 }}>
          {isShowing ? 'MEMORIZE SEQUENCE' : 'HACK TERMINAL'}
        </div>

        {/* Sequence display */}
        <div
          style={{
            fontSize: isShowing ? 64 : 52,
            letterSpacing: 18,
            marginBottom: 28,
            transition: 'font-size 0.3s',
          }}
        >
          {sequence.split('').map((ch, i) => {
            if (isShowing) {
              return (
                <span key={i} style={{ color: '#ffcc00', textShadow: '0 0 20px #ffcc0088' }}>
                  {ch}
                </span>
              )
            }
            const typed = input[i]
            const wrong = typed !== undefined && typed !== ch
            return (
              <span key={i} style={{ color: wrong ? '#ff4444' : typed ? '#00ffcc' : '#556677' }}>
                {ch}
              </span>
            )
          })}
        </div>

        {/* Player input (hidden during SHOWING) */}
        <div
          style={{
            fontSize: 52,
            letterSpacing: 18,
            color: '#88aacc',
            minHeight: 70,
            marginBottom: 24,
            opacity: isShowing ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
        >
          {isActive || status === 'SUCCESS' || status === 'FAIL'
            ? input.padEnd(sequence.length, '_')
            : sequence.split('').map(() => '_').join('')}
        </div>

        {/* Timer bar */}
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: barColor,
              transition: 'width 0.1s, background 0.3s',
              borderRadius: 4,
            }}
          />
        </div>

        <div style={{ fontSize: 15, color: statusColor, letterSpacing: 2, minHeight: 24 }}>
          {status === 'SUCCESS' && '✓ ACCESS GRANTED'}
          {status === 'FAIL'    && '✗ ACCESS DENIED'}
          {isShowing && `Memorize — ${Math.ceil(timeLeft)}s`}
          {isActive  && `Type the sequence — ${Math.ceil(timeLeft)}s remaining`}
        </div>

        <div style={{ fontSize: 11, color: '#334455', marginTop: 14 }}>
          {isShowing ? 'Get ready to type...' : 'ESC to cancel'}
        </div>
      </div>
    </div>
  )
}
