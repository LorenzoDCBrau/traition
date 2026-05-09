import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SceneManager } from '../game/engine/SceneManager'
import { GameLoop } from '../game/engine/GameLoop'
import { buildSpaceStationRoom } from '../game/world/RoomBuilder'
import { Player } from '../game/characters/Player'
import { spawnNPCs, DEBUG_NPCS_LOADED } from '../game/characters/NPCManager'
import { WeaponView } from '../game/weapons/WeaponView'

type DebugInfo = {
  npcsLoaded: number
  webglVersion: string
  srgb: boolean
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loadStatus, setLoadStatus] = useState<string>('Initializing...')
  const [ready, setReady] = useState(false)
  const [debug, setDebug] = useState<DebugInfo | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const sceneManager = new SceneManager(canvas)
    let loop: GameLoop | null = null
    let disposed = false

    async function init() {
      setLoadStatus('Building space station...')
      const loaded = await buildSpaceStationRoom(sceneManager.scene)
      console.log('[GameCanvas] Room GLBs loaded:', loaded)

      // Room atmosphere lights — single room centered at origin, boundary ±12
      sceneManager.addRoomLight( 0, 3,  0, 0xffcc66, 6, 28)  // center
      sceneManager.addRoomLight(-8, 3, -8, 0x66aaff, 3, 12)  // NW corner
      sceneManager.addRoomLight( 8, 3, -8, 0xff8844, 3, 12)  // NE corner
      sceneManager.addRoomLight(-8, 3,  8, 0xaa66ff, 3, 12)  // SW corner
      sceneManager.addRoomLight( 8, 3,  8, 0x44ffcc, 3, 12)  // SE corner

      setLoadStatus('Loading character...')
      const player = await Player.load(sceneManager.scene)

      setLoadStatus('Spawning NPCs...')
      await spawnNPCs(sceneManager.scene)

      setLoadStatus('Loading weapon...')
      const weaponView = await WeaponView.load()

      if (disposed) return

      // Snap camera immediately so there's no fly-in from origin
      sceneManager.snapToPlayer(player.position)

      // Collect debug info
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      const glVersion = gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1'
      const srgb = sceneManager.renderer.outputColorSpace === THREE.SRGBColorSpace

      setTimeout(() => {
        setDebug({
          npcsLoaded: DEBUG_NPCS_LOADED,
          webglVersion: glVersion,
          srgb,
        })
        console.log(
          `[DEBUG] Characters loaded: ${DEBUG_NPCS_LOADED}/18` +
          ` | Renderer: ${glVersion} | SRGB: ${srgb}`,
        )
      }, 500)

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
      {debug && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.72)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 4,
            lineHeight: 1.6,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <div>Characters loaded: {debug.npcsLoaded}/18</div>
          <div>Renderer: {debug.webglVersion}</div>
          <div>Color space: SRGB {debug.srgb ? 'yes' : 'NO'}</div>
        </div>
      )}
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
