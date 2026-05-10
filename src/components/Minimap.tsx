import { useEffect, useRef } from 'react'
import type { GameStateManager } from '../game/state/GameState'

interface Props {
  gsm: GameStateManager | null
  playerPos: { x: number; z: number }
}

const MAP_SIZE = 150
const ROOM = 24  // world units

function worldToMap(wx: number, wz: number): [number, number] {
  const x = ((wx + ROOM / 2) / ROOM) * MAP_SIZE
  const y = ((wz + ROOM / 2) / ROOM) * MAP_SIZE
  return [x, y]
}

export default function Minimap({ gsm, playerPos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let rafId = 0

    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE)

      // Background
      ctx.fillStyle = 'rgba(10,14,24,0.9)'
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

      // Room border
      ctx.strokeStyle = '#334466'
      ctx.lineWidth = 1.5
      ctx.strokeRect(2, 2, MAP_SIZE - 4, MAP_SIZE - 4)

      if (gsm) {
        const playerRole = gsm.playerRole

        // Bodies
        for (const b of gsm.bodies) {
          if (b.reported) continue
          const [mx, my] = worldToMap(b.position.x, b.position.z)
          ctx.fillStyle = '#888'
          ctx.font = 'bold 9px monospace'
          ctx.fillText('✕', mx - 4, my + 4)
        }

        // NPCs
        for (const p of gsm.players) {
          if (p.isHuman || !p.alive) continue
          const [mx, my] = worldToMap(p.position.x, p.position.z)

          let color = '#44bb44'
          if (p.role === 'TRAITOR' && (playerRole === 'TRAITOR' || playerRole === 'DETECTIVE')) {
            color = '#ff4444'
          } else if (p.role === 'DETECTIVE' && playerRole === 'DETECTIVE') {
            color = '#ffcc00'
          }

          ctx.beginPath()
          ctx.arc(mx, my, 3, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }

        // Mission markers
        for (const m of gsm.missions) {
          if (m.completed) continue
          const [mx, my] = worldToMap(m.position.x, m.position.z)
          ctx.beginPath()
          ctx.arc(mx, my, 4, 0, Math.PI * 2)
          ctx.strokeStyle = '#00ffcc'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Player dot (always white, on top)
      const [px, py] = worldToMap(playerPos.x, playerPos.z)
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [gsm, playerPos])

  return (
    <canvas
      ref={canvasRef}
      width={MAP_SIZE}
      height={MAP_SIZE}
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        borderRadius: 6,
        border: '1px solid #334466',
        opacity: 0.92,
      }}
    />
  )
}
