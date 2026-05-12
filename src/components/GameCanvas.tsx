import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SceneManager } from '../game/engine/SceneManager'
import { GameLoop } from '../game/engine/GameLoop'
import { buildSpaceStationRoom } from '../game/world/RoomBuilder'
import { Player } from '../game/characters/Player'
import { spawnNPCs } from '../game/characters/NPCManager'
import { GameStateManager } from '../game/state/GameState'
import { MissionSystem } from '../game/missions/MissionSystem'
import { BodyManager } from '../game/bodies/BodyManager'
import { SabotageSystem } from '../game/sabotage/SabotageSystem'
import { SoundManager } from '../game/audio/SoundManager'
import { NPC, NPC_NAMES } from '../game/characters/NPC'

export interface GameCanvasRefs {
  gsm: GameStateManager
  getPlayerPos: () => { x: number; z: number }
  getNearMission: () => import('../game/state/GameState').MissionData | null
  getNearBody: () => boolean
  getNearEnemy: () => boolean
  activateSabotage: (type: import('../game/state/GameState').SabotageType) => void
}

interface Props {
  onReady: (refs: GameCanvasRefs) => void
}

export default function GameCanvas({ onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initializedRef = useRef(false)
  const [loadStatus, setLoadStatus] = useState<string>('Initializing...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const canvas = canvasRef.current!
    const sceneManager = new SceneManager(canvas)
    const gsm = new GameStateManager()
    const missionSys = new MissionSystem()
    const bodyMgr = new BodyManager()
    const sound = new SoundManager()
    let loop: GameLoop | null = null
    let disposed = false
    let npcs: NPC[] = []
    let player: Player | null = null
    let sabotSys: SabotageSystem | null = null

    // Proximity state shared with React via refs (avoids React re-render on every frame)
    let nearMission: import('../game/state/GameState').MissionData | null = null
    let nearBody = false
    let nearEnemy = false

    // NPC mission assignment interval
    let missionAssignInterval = 0

    async function init() {
      setLoadStatus('Building space station...')
      await buildSpaceStationRoom(sceneManager.scene)

      sceneManager.addRoomLight( 0, 3,  0, 0xffcc66, 6, 28)
      sceneManager.addRoomLight(-8, 3, -8, 0x66aaff, 3, 12)
      sceneManager.addRoomLight( 8, 3, -8, 0xff8844, 3, 12)
      sceneManager.addRoomLight(-8, 3,  8, 0xaa66ff, 3, 12)
      sceneManager.addRoomLight( 8, 3,  8, 0x44ffcc, 3, 12)

      setLoadStatus('Loading character...')
      player = await Player.load(sceneManager.scene)

      // Initialise state FIRST so we know roles before spawning NPCs
      setLoadStatus('Assigning roles...')
      const namePool = [...NPC_NAMES].sort(() => Math.random() - 0.5)
      const TEMP_NAMES = Array.from({ length: 17 }, (_, i) => namePool[i % namePool.length])
      gsm.init(TEMP_NAMES)
      const npcRoles = gsm.players.filter((p) => !p.isHuman).map((p) => p.role)

      setLoadStatus('Spawning NPCs...')
      npcs = await spawnNPCs(sceneManager.scene, npcRoles)

      // Sync NPC ids back to GameState players
      npcs.forEach((npc, i) => {
        const p = gsm.players.filter((pl) => !pl.isHuman)[i]
        if (p) {
          p.id = npc.id
          npc.name = p.name
        }
      })

      setLoadStatus('Initialising systems...')
      missionSys.init(sceneManager.scene, gsm.missions)
      sabotSys = new SabotageSystem(sceneManager.scene)

      if (disposed) return

      sceneManager.snapToPlayer(player.position)

      // ── Player interaction callbacks ──────────────────────────────────────
      player.onInteract = () => {
        if (gsm.phase !== 'PLAYING') return

        // Traitor: eliminate nearby NPC
        if (gsm.playerRole === 'TRAITOR' && nearEnemy) {
          const closest = _closestAliveNPC(player!.position, 2)
          if (closest) {
            sound.playReport()
            gsm.eliminatePlayer(closest.id)
            closest.die(sceneManager.scene)
            const body = {
              id: `body-${closest.id}`,
              playerId: closest.id,
              playerName: closest.name,
              position: { x: closest.position.x, z: closest.position.z },
              reported: false,
            }
            gsm.addBody(body)
            bodyMgr.addBodyMesh(body, sceneManager.scene)
          }
          return
        }

        // All: interact with mission
        if (nearMission) {
          sound.playInteract()
          // HackTerminal requires UI — emit event to React
          if (nearMission.type === 'HACK_TERMINAL') {
            gsm.dispatchEvent(new CustomEvent('open_hack_terminal', { detail: nearMission }))
          } else {
            // Auto-complete non-hack missions after 3 seconds for the player
            const mId = nearMission.id
            setTimeout(() => gsm.completeMission(mId), 3000)
          }
        }
      }

      player.onReport = () => {
        if (gsm.phase !== 'PLAYING') return
        const body = bodyMgr.getNearBody(player!.position, gsm.bodies)
        if (body) {
          sound.playReport()
          gsm.reportBody(body.id)
          gsm.startDiscussion('You', body.playerName)
        }
      }

      // ── Game-state event listeners ────────────────────────────────────────
      gsm.addEventListener('mission_complete', () => {
        sound.playInteract()
        missionSys.updateMarkers(gsm)
      })

      gsm.addEventListener('game_over', () => {
        if (gsm.winner === 'INNOCENT') sound.playVictory()
        else sound.playDefeat()
      })

      gsm.addEventListener('sabotage_activated', () => {
        sound.playAlert()
      })

      // Assign missions to NPCs every 8 seconds
      missionAssignInterval = window.setInterval(() => {
        if (gsm.phase === 'PLAYING') {
          missionSys.assignMissionsToNPCs(npcs, gsm)
        }
      }, 8000)

      setReady(true)
      setLoadStatus('')

      // Expose refs to Game.tsx
      const refs: GameCanvasRefs = {
        gsm,
        getPlayerPos: () => ({ x: player!.position.x, z: player!.position.z }),
        getNearMission: () => nearMission,
        getNearBody: () => nearBody,
        getNearEnemy: () => nearEnemy,
        activateSabotage: (type) => {
          sabotSys?.activate(type, gsm)
        },
      }
      onReady(refs)

      // ── Game loop ─────────────────────────────────────────────────────────
      loop = new GameLoop((dt) => {
        if (gsm.phase !== 'PLAYING' && gsm.phase !== 'ROLE_REVEAL') {
          // Still render but don't update game logic
          sceneManager.render()
          return
        }

        if (player) player.update(dt)

        if (player && gsm.phase === 'PLAYING') {
          // Update NPC AI
          for (const npc of npcs) {
            npc.update(dt, player.position, npcs, gsm)
          }

          // Sync NPC positions to GameState for minimap
          for (let i = 0; i < npcs.length; i++) {
            const p = gsm.players.find((pl) => pl.id === npcs[i].id)
            if (p) {
              p.position.x = npcs[i].position.x
              p.position.z = npcs[i].position.z
            }
          }
          gsm.players[0].position.x = player.position.x
          gsm.players[0].position.z = player.position.z

          // Proximity checks (cheap distance math, no React state)
          nearMission = missionSys.getNearMission(player.position, gsm)
          nearBody = !!bodyMgr.getNearBody(player.position, gsm.bodies)
          nearEnemy = gsm.playerRole === 'TRAITOR' && !!_closestAliveNPC(player.position, 2)

          // Add body meshes for any newly created bodies
          for (const body of gsm.bodies) {
            bodyMgr.addBodyMesh(body, sceneManager.scene)
          }

          // Sabotage tick
          gsm.tickSabotages()
          sabotSys?.update(gsm)
        }

        if (player) sceneManager.followPlayer(player.position)
        sceneManager.render()
      })
      loop.start()
    }

    function _closestAliveNPC(pos: THREE.Vector3, radius: number): NPC | null {
      let best: NPC | null = null
      let bestDist = radius
      for (const npc of npcs) {
        if (!npc.alive) continue
        const d = npc.position.distanceTo(pos)
        if (d < bestDist) { bestDist = d; best = npc }
      }
      return best
    }

    init().catch((err: unknown) => {
      console.error('[GameCanvas] Init failed:', err)
      setLoadStatus('Failed to load assets — check console')
    })

    return () => {
      disposed = true
      loop?.stop()
      clearInterval(missionAssignInterval)
      sceneManager.dispose()
      sound.dispose()
    }
  }, [onReady])

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
