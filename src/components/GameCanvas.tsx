import { useEffect, useRef, useState } from 'react'
import { SceneManager } from '../game/engine/SceneManager'
import { GameLoop } from '../game/engine/GameLoop'
import { buildSpaceStationRoom } from '../game/world/RoomBuilder'
import { Player } from '../game/characters/Player'
import { spawnNPCs } from '../game/characters/NPCManager'
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

      // Room atmosphere lights
      // Main room center: tile (5.5,5.5) in 12×12 → world (11,0,11)
      sceneManager.addRoomLight(11, 3, 11,  0xffcc66, 5, 24)
      // North room center: tile (5.5,-4.5) → world (11,0,-9)
      sceneManager.addRoomLight(11, 3, -9,  0x66aaff, 4, 14)
      // East room center: tile (15,5.5) → world (30,0,11)
      sceneManager.addRoomLight(30, 3, 11,  0xff8844, 4, 14)
      // West room center: tile (-4,5.5) → world (-8,0,11)
      sceneManager.addRoomLight(-8, 3, 11,  0xaa66ff, 4, 14)
      // Station module center: tile (5.5,15.5) → world (11,0,31)
      sceneManager.addRoomLight(11, 3, 31,  0x44ffcc, 3, 12)

      setLoadStatus('Loading character...')
      const player = await Player.load(sceneManager.scene)

      setLoadStatus('Spawning NPCs...')
      await spawnNPCs(sceneManager.scene)

      setLoadStatus('Loading weapon...')
      const weaponView = await WeaponView.load()

      if (disposed) return

      // Snap camera immediately so there's no fly-in from origin
      sceneManager.snapToPlayer(player.position)

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
