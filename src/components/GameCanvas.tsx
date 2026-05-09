import { useEffect, useRef, useState } from 'react'
import { SceneManager } from '../game/engine/SceneManager'
import { GameLoop } from '../game/engine/GameLoop'
import { buildSpaceStationRoom } from '../game/world/RoomBuilder'
import { Player } from '../game/characters/Player'
import { WeaponView } from '../game/weapons/WeaponView'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loadStatus, setLoadStatus] = useState<string>('Initializing...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const sceneManager = new SceneManager(canvas)
    let loop: GameLoop | null = null
    let disposed = false

    async function init() {
      setLoadStatus('Building space station...')
      const loaded = await buildSpaceStationRoom(sceneManager.scene)
      console.log('[GameCanvas] Room GLBs loaded:', loaded)

      setLoadStatus('Loading character...')
      const player = await Player.load(sceneManager.scene)

      setLoadStatus('Loading weapon...')
      const weaponView = await WeaponView.load()

      if (disposed) return

      setReady(true)
      setLoadStatus('')

      loop = new GameLoop((dt) => {
        player.update(dt)
        weaponView.update(dt)
        sceneManager.followPlayer(player.position)
        sceneManager.render(weaponView)
      })
      loop.start()
    }

    init().catch((err: unknown) => {
      console.error('[GameCanvas] Init failed:', err)
      setLoadStatus('Failed to load assets — check console')
    })

    return () => {
      disposed = true
      loop?.stop()
      sceneManager.dispose()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8,12,20,0.92)',
            color: '#aabbcc',
            fontFamily: 'monospace',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 6, color: '#fff' }}>
            TRAITION
          </div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>{loadStatus}</div>
        </div>
      )}
    </div>
  )
}
