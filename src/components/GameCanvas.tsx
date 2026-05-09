import { useEffect, useRef } from 'react'
import { SceneManager } from '../game/engine/SceneManager'
import { GameLoop } from '../game/engine/GameLoop'
import { buildTestRoom } from '../game/world/RoomBuilder'
import { Player } from '../game/characters/Player'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const sceneManager = new SceneManager(canvas)
    const { scene, camera } = sceneManager

    buildTestRoom(scene)
    const player = new Player(scene)

    const loop = new GameLoop((dt) => {
      player.update(dt, camera)
      sceneManager.render()
    })
    loop.start()

    return () => {
      loop.stop()
      player.dispose()
      sceneManager.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
