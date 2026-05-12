import * as THREE from 'three'
import type { MissionData, MissionType, GameStateManager } from '../state/GameState'

const INTERACT_RADIUS = 2.5

// Visual markers placed in the scene for each mission terminal
export class MissionSystem {
  markers: Map<string, THREE.Object3D> = new Map()

  init(scene: THREE.Scene, missions: MissionData[]) {
    for (const m of missions) {
      const marker = this._makeMarker(m.type)
      marker.position.set(m.position.x, 0.05, m.position.z)
      scene.add(marker)
      this.markers.set(m.id, marker)
    }
  }

  /** Returns the nearest incomplete mission within interact radius, or null */
  getNearMission(
    pos: THREE.Vector3,
    gsm: GameStateManager,
  ): MissionData | null {
    let best: MissionData | null = null
    let bestDist = Infinity

    for (const m of gsm.missions) {
      if (m.completed) continue
      const dx = pos.x - m.position.x
      const dz = pos.z - m.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < INTERACT_RADIUS && dist < bestDist) {
        bestDist = dist
        best = m
      }
    }
    return best
  }

  /** Assign pending missions to NPC wanderers */
  assignMissionsToNPCs(npcs: { id: string; alive: boolean; role: string; missionId: string | null; assignMission: (pos: { x: number; z: number }, id: string) => void }[], gsm: GameStateManager) {
    const pendingMissions = gsm.missions.filter(
      (m) => !m.completed && !m.workedBy,
    )

    const idleNpcs = npcs.filter(
      (n) => n.alive && n.role !== 'TRAITOR' && n.missionId === null,
    )

    for (let i = 0; i < Math.min(pendingMissions.length, idleNpcs.length); i++) {
      const mission = pendingMissions[i]
      const npc = idleNpcs[i]
      mission.workedBy = npc.id
      npc.assignMission(mission.position, mission.id)
    }
  }

  updateMarkers(gsm: GameStateManager) {
    for (const m of gsm.missions) {
      const marker = this.markers.get(m.id)
      if (!marker) continue
      // Fade out completed markers
      marker.visible = !m.completed
    }
  }

  private _makeMarker(_type: MissionType): THREE.Object3D {
    // Visual markers removed — placeholder geometry will be replaced with proper UI
    return new THREE.Group()
  }
}
