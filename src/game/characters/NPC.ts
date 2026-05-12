import * as THREE from 'three'
import type { Role } from '../roles/RoleSystem'
import type { GameStateManager } from '../state/GameState'

const SPEED_INNOCENT = 2.5
const SPEED_TRAITOR  = 3.2
const BOUNDARY = 20
const ARRIVE_DIST = 0.6
const KILL_DIST   = 1.8
const HUNT_DIST   = 6.0   // Traitor follows player within this range

type AIState = 'WANDER' | 'MISSION' | 'HUNT' | 'DEAD'

export const NPC_NAMES = [
  'Aria','Bolt','Cyan','Drake','Echo','Flux','Ghost','Haze',
  'Iris','Jolt','Knox','Luna','Mace','Nova','Onyx',
  'Pixel','Quill','Rex','Sage','Thorn',
]

export class NPC {
  id: string
  name: string
  role: Role
  alive = true
  position: THREE.Vector3
  model: THREE.Group
  nameSprite: THREE.Sprite

  private scene: THREE.Scene
  private aiState: AIState = 'WANDER'
  private wanderTarget: THREE.Vector3
  private missionTarget: THREE.Vector3 | null = null
  missionId: string | null = null
  private missionTimer = 0
  private killCooldown = 0
  private spawnX: number
  private spawnZ: number

  constructor(
    id: string,
    name: string,
    role: Role,
    model: THREE.Group,
    startPos: THREE.Vector3,
    scene: THREE.Scene,
  ) {
    this.id = id
    this.name = name
    this.role = role
    this.model = model
    this.scene = scene
    this.position = startPos.clone()
    this.spawnX = startPos.x
    this.spawnZ = startPos.z
    this.wanderTarget = this._randomWanderPoint()
    this.nameSprite = this._makeLabel(name, role)
    scene.add(this.nameSprite)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  assignMission(worldPos: { x: number; z: number }, missionId: string) {
    this.missionTarget = new THREE.Vector3(worldPos.x, this.position.y, worldPos.z)
    this.missionId = missionId
    this.aiState = 'MISSION'
    this.missionTimer = 0
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    allNpcs: NPC[],
    gsm: GameStateManager,
  ) {
    if (!this.alive || this.aiState === 'DEAD') return
    if (gsm.phase !== 'PLAYING') return

    this.killCooldown = Math.max(0, this.killCooldown - dt)

    if (this.role === 'TRAITOR') {
      this._updateTraitor(dt, playerPos, allNpcs, gsm)
    } else {
      this._updateInnocent(dt, allNpcs, gsm)
    }

    // Sync Three.js model + label
    this.model.position.set(this.position.x, this.position.y, this.position.z)
    this.nameSprite.position.set(this.position.x, this.position.y + 2.6, this.position.z)
  }

  die(scene: THREE.Scene) {
    this.alive = false
    this.aiState = 'DEAD'
    scene.remove(this.nameSprite)
    // Tilt model to simulate lying on floor
    this.model.rotation.z = Math.PI / 2
    this.model.position.y = 0.3
  }

  // ── AI: Innocent / Detective ──────────────────────────────────────────────

  private _updateInnocent(dt: number, _allNpcs: NPC[], gsm: GameStateManager) {
    if (this.aiState === 'MISSION' && this.missionTarget && this.missionId) {
      const dist = this._moveTo(this.missionTarget, SPEED_INNOCENT, dt)
      if (dist < ARRIVE_DIST) {
        this.missionTimer += dt
        if (this.missionTimer >= 3) {
          gsm.completeMission(this.missionId)
          this.missionTarget = null
          this.missionId = null
          this.aiState = 'WANDER'
          this.missionTimer = 0
        }
      }
    } else {
      this.aiState = 'WANDER'
      const dist = this._moveTo(this.wanderTarget, SPEED_INNOCENT, dt)
      if (dist < ARRIVE_DIST) {
        this.wanderTarget = this._randomWanderPoint()
      }
    }
  }

  // ── AI: Traitor ───────────────────────────────────────────────────────────

  private _updateTraitor(
    dt: number,
    playerPos: THREE.Vector3,
    allNpcs: NPC[],
    gsm: GameStateManager,
  ) {
    const distToPlayer = this.position.distanceTo(playerPos)

    // Follow player loosely
    if (distToPlayer > HUNT_DIST) {
      this.aiState = 'WANDER'
      const dist = this._moveTo(this.wanderTarget, SPEED_TRAITOR, dt)
      if (dist < ARRIVE_DIST) this.wanderTarget = this._randomWanderPoint()
    } else {
      this.aiState = 'HUNT'
      // Stay at comfortable distance
      if (distToPlayer > 5) {
        const target = new THREE.Vector3(playerPos.x, this.position.y, playerPos.z)
        this._moveTo(target, SPEED_TRAITOR, dt)
      }
    }

    if (this.killCooldown > 0) return

    // Try to eliminate a lone innocent NPC
    for (const npc of allNpcs) {
      if (npc === this || !npc.alive || npc.role === 'TRAITOR') continue

      const distToTarget = this.position.distanceTo(npc.position)
      if (distToTarget > KILL_DIST) continue

      // Check no other NPCs or player nearby
      const nearbyCount = allNpcs.filter(
        (n) => n !== this && n !== npc && n.alive && n.position.distanceTo(npc.position) < 4,
      ).length

      if (nearbyCount > 0) continue
      if (playerPos.distanceTo(npc.position) < 5) continue

      // Kill
      gsm.eliminatePlayer(npc.id)
      npc.die(this.scene)

      const body = {
        id: `body-${npc.id}`,
        playerId: npc.id,
        playerName: npc.name,
        position: { x: npc.position.x, z: npc.position.z },
        reported: false,
      }
      gsm.addBody(body)
      this.killCooldown = 20 // 20 second cooldown between kills
      break
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _moveTo(target: THREE.Vector3, speed: number, dt: number): number {
    const dx = target.x - this.position.x
    const dz = target.z - this.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 0.01) return 0

    const step = Math.min(speed * dt, dist)
    this.position.x += (dx / dist) * step
    this.position.z += (dz / dist) * step

    this.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.position.x))
    this.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.position.z))

    this.model.rotation.y = Math.atan2(dx, dz)
    return dist - step
  }

  private _randomWanderPoint(): THREE.Vector3 {
    const sx = this.spawnX ?? 0
    const sz = this.spawnZ ?? 0
    const x = Math.max(-BOUNDARY, Math.min(BOUNDARY, sx + (Math.random() - 0.5) * 4))
    const z = Math.max(-BOUNDARY, Math.min(BOUNDARY, sz + (Math.random() - 0.5) * 4))
    return new THREE.Vector3(x, this.position?.y ?? 0, z)
  }

  private _makeLabel(name: string, role: Role): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 256, 64)
    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(10, 8, 236, 46, 6)
    ctx.fill()
    ctx.font = 'bold 26px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = role === 'TRAITOR' ? '#ff4444' : role === 'DETECTIVE' ? '#ffcc00' : '#88ddff'
    ctx.fillText(name, 128, 42)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(2.5, 0.65, 1)
    return sprite
  }
}
